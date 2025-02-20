const Device = require('../models/device');
const User = require('../models/user');
const { UserDeviceRole } = require('../models/userDeviceRole');

const createDevice = async (req, res) => {

    const device = await Device.create({ id: 0 });

    res.json({
        success: true,
        data: device
    });
}

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
        const {id: userId} = req.user;

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


const startClaimDevice = async (req, res) => {
    try {
        const { id: deviceId } = req.body;
        const { id: userId} = req.user;

        const prevOwner = await UserDeviceRole.findOne({
            where: {
                deviceId,
                role: 'OWNER'
            }
        })

        if (prevOwner) {
            return res.status(400).json({
                success: false,
                message: 'This device already has an owner.'
            });
        }

        await UserDeviceRole.create({
            userId,
            deviceId,
            role: 'OWNER'
        });

        res.json({
            success: true,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while claiming the device.'
        });
    }
}

module.exports = { createDevice, getUserDevices, getAllDevices, startClaimDevice }