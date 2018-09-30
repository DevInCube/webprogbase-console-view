const {SourceError} = require('./error');

class Request {

    constructor(stateName, formData = null) {
        this.state = stateName;
        this.data = formData;  // key-value (string) dictionary, if present
    }
}

class Response {

    constructor(handler) {
        this.text = null;  // what text to show in view
        this.data = null;  // states object or input form
        this.redirectState = null;  // what state to redirect

        this.isHandled = false;  // was this reponse already handled
        this.handler = handler;
    }

    send(text, statesOrForm = null) {
        this.text = text;
        this.data = statesOrForm;
        this._handle();
    }

    redirect(toState, data = null) {
        this.redirectState = toState;
        this.data = data;
        this._handle();
    }

    _handle() {
        if (this.isHandled) {
            throw new SourceError(this, `Response is already handled`);
        }
        this.isHandled = true;
        this.handler(this);  // success
    }
}

module.exports = { Request, Response };