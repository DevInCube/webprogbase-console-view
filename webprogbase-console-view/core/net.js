const EventEmitter = require('events');

const socketMessageEvent = 'message';
const socketSendEvent = 'send';
const socketCloseEvent = 'close';
const socketConnectEvent = 'connect';

class Network {

    constructor() {
        this.ports = {};
    }

    bind(server) {
        let port = server.port;
        if (this.ports[port]) { 
            throw new SourceError(this, `Port ${port} is already binded`); }
        else {
            this.ports[port] = server;
            server.on(socketCloseEvent, () => {
                // unbind port
                delete this.ports[port];
            });
        }
    }

    connect(clientSocket, serverPort) {
        let server = this.ports[serverPort]; 
        if (!server) { return false; } 

        const clientPort = getRndInteger(49152, 65535);
        clientSocket.localPort = clientPort;
        clientSocket.remotePort = serverPort;

        let serverClientSocket = new Socket();
        serverClientSocket.remotePort = clientPort;
        serverClientSocket.localPort = serverPort;

        server.emit(socketConnectEvent, serverClientSocket);

        clientSocket.on(socketSendEvent, onServerMessage);
        serverClientSocket.on(socketSendEvent, onClientMessage);

        clientSocket.on(socketCloseEvent, onConnectionClosed);
        serverClientSocket.on(socketCloseEvent, onConnectionClosed);

        function onServerMessage(message) {
            serverClientSocket.emit(socketMessageEvent, message);
        }

        function onClientMessage(message) {
            clientSocket.emit(socketMessageEvent, message);
        }

        function onConnectionClosed() {
            clientSocket.off(socketSendEvent, onServerMessage);
            serverClientSocket.off(socketSendEvent, onClientMessage);
        }
        return true;

        function getRndInteger(min, max) {
            return Math.floor(Math.random() * (max - min) ) + min;
        }
    }
}

const network = new Network();

class Server extends EventEmitter {

    contructor() {
        this.port = 0;
    }

    listen(portNumber) {
        this.port = portNumber;
        network.bind(this);
    }

    close() {
        this.emit(socketCloseEvent);
    }
}

class Socket extends EventEmitter {

    contructor() {
        this.localPort = 0;
        this.remotePort = 0;
    }

    connect(portNumber) {
        return network.connect(this, portNumber);
    }

    send(message) {
        this.emit(socketSendEvent, message);
    }

    close() {
        this.emit(socketCloseEvent);
    }
}

module.exports = { Server, Socket };