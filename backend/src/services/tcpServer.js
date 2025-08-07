const { TcpServer } = require('./tcp');

const tcpServer = new TcpServer(7735);

module.exports = tcpServer;
