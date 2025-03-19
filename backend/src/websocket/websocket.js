class WSServer {
    constructor(httpServer) {
        this.wss = new WebSocket.Server({ server: httpServer });
        this.connectionManager = connectionManager;

        this.wss.on('connection', (ws, req) => {
            authenticate(ws, req)
                .then(user => this._handleValidConnection(ws, user))
                .catch(error => this._handleInvalidConnection(ws, error));
        });
    }

    _handleValidConnection(ws, user) {
        this.connectionManager.add(user.id, ws);

        ws.on('message', data => {
            handleMessage(ws, data, user);
        });

        ws.on('close', () => this.connectionManager.remove(user.id));
    }

    _handleInvalidConnection(ws, error) {
        console.error('Connection rejected:', error);
        ws.close(4001, 'Authentication failed');
    }
}

module.exports = WSServer;