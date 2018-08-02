const { Server } = require('./../core/net');
const { SourceError } = require('./../core/error');
const { Request, Response } = require('./../core/http');

class ServerApp {
    
    constructor() {
        this._handlers = {};  // state request handlers
    }

    /**
     * Register a request handler function for the state
     * @param {string} stateName name of the state
     * @param {(req: Request, res: Response) => void} handler state request handler function
     */
    use(stateName, handler) {
        if (this._handlers[stateName]) {
            let errMsg = `State '${stateName}' handler is already set`;
            throw new SourceError(this, errMsg);
        }
        this._handlers[stateName] = handler;
    }

    /**
     * Start listening for new clients' connections
     * @param {number} port port number where server will listen for new connections
     */
    listen(port) {
        let server = new Server();
        server.on('connect', clientSocket => {
            clientSocket.on('message', message => {
                if (!(message instanceof Request)) { 
                    clientSocket.close(); 
                    return;
                };
                const request = message;
                const stateHandler = this._handlers[request.state];
                if (!stateHandler) {
                    reply(new Response());  // not found
                    return;
                } 
                let response = new Response(reply);
                stateHandler(request, response);

                function reply(res) {
                    clientSocket.send(res);
                    clientSocket.close();
                }
            });
        });
        server.listen(port);
    }
}

module.exports = { ServerApp };