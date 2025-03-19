class ConnectionHandler {
    constructor() {
        this.connections = new Map();
    }

    add(id, ws) {
        this.connections.set(id, ws);
        console.log(`${id} connected. Active connections: ${this.connections.size}`);
    }

    remove(id) {
        this.connections.delete(id);
        console.log(`${id} disconnected. Remaining: ${this.connections.size}`);
    }

    get(id) {
        return this.connections.get(id);
    }
}

module.exports = new ConnectionHandler();