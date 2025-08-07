const Device = require('../models/device');
const User = require('../models/user');
const { UserDeviceRole } = require('../models/userDeviceRole');
const crypto = require('crypto');
const tcpServer = require('../services/tcpServer');
const { dither } = require('../services/photo/dithering');
const generateNumberImage = require('../services/photo/pinImageGenerator');
const { sendBuffer } = require('../services/photo/imageSender');

const createDevice = async (req, res) => {
    try {
        const rawSecret = crypto.randomBytes(31).toString('hex'); //62 hex characters

        const device = await Device.create({
            secret: rawSecret,
        });

        res.json({
            success: true,
            data: {
                uuid: device.uuid,
                publicId: device.publicId,
                secret: rawSecret,
            },
        });
    } catch (err) {
        console.error('Error creating device:', err);
        res.status(500).json({ success: false, error: 'Failed to create device' });
    }
};

const getAllDevices = async (req, res) => {
    try {
        const devices = await Device.findAll({
            include: [
                {
                    model: User,
                    as: 'Users',
                    attributes: ['username', 'firstName', 'lastName'],
                    through: {
                        where: {
                            role: 'OWNER'
                        },
                        attributes: []
                    }
                }
            ]
        });

        const list = devices.map(device => ({
            ...device.toJSON(),
            online: false,
            updating: false
        }));

        res.json({
            success: true,
            data: list
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching devices.'
        });
    }
};

const getUserDevices = async (req, res) => {
    try {
        const { id: userId } = req.user;

        console.log(userId);

        const devices = await UserDeviceRole.findAll({
            where: {
                userId: userId,
            },
            include: [
                {
                    model: Device,
                    attributes: ['id', 'lastSeen', 'name'],
                }
            ],
        });

        const list = devices.map(device => ({
            ...device.toJSON(),
            online: false,
            updating: false
        }));

        res.json({
            success: true,
            data: list
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching devices.'
        });
    }
};

const pairingDevices = new Map();

const startPairing = async (req, res) => {
    try {
        const { id: deviceCode } = req.body;
        const { id: userId } = req.user;

        const device = await Device.findOne({
            where: {
                publicId: deviceCode
            }
        })

        if (!device) {
            throw new Error("No device found with that id");
        }

        const client = tcpServer.getConnectedDevices().get(device.uuid);

        if (!client) {
            throw new Error("Client is not connected to server");
        }

        const prevOwner = await UserDeviceRole.findOne({
          where: {
            deviceId: device.uuid,
            role: "OWNER",
          }  
        })

        if (prevOwner) {
            throw new Error("This frame already has an owner");
        }

        const pin = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

        pairingDevices.set(deviceCode, {userId: userId, pin: pin, startTime: Date.now(), attempts: 0})

        const buffer = await dither(await generateNumberImage(pin));
        await sendBuffer(client, buffer);

        res.json({
            success: true,
        });
    } catch (e) {
        console.log(e)
        return res.status(400).json({
            success: false,
            data: {message: e || 'An error occurred while claiming the device.'}
        });
    }
}

const completePairing = (req, res) => {
    console.log(req);
}

module.exports = { createDevice, getUserDevices, getAllDevices, startPairing }