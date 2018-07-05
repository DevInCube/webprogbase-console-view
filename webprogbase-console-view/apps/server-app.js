const { Server } = require('./../core/net');
const { SourceError } = require('./../core/error');
const { Request, Response } = require('./../core/http');
const { InputForm } = require('./../core/data');

class ServerApp {
    
    constructor() {
        this.handlers = {};  // request handlers
    }

    use(stateName, handler) {
        if (this.handlers[stateName]) {
            let errMsg = `State '${stateName}' handler is already set`;
            throw new SourceError(this, errMsg);
        }
        this.handlers[stateName] = handler;
    }

    listen(port) {
        let server = new Server();
        server.on('connect', clientSocket => {
            clientSocket.on('message', message => {
                if (message instanceof Request) {
                    const request = message;
                    const stateHandler = this.handlers[request.state];
                    if (!stateHandler) {
                        let notFoundResponse = new Response();
                        clientSocket.send(notFoundResponse);
                        return;
                    }
                    let response = new Response(res => {
                        clientSocket.send(res);
                        clientSocket.close();
                    });
                    stateHandler(request, response);
                }
            });
        });
        server.listen(port);
    }
}

module.exports = { ServerApp };