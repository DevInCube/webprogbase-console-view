const { Socket } = require('./../core/net');
const { SourceError } = require('./../core/error');
const { Request, Response } = require('./../core/http');
const { InputForm } = require('./../core/data');

const initialUserState = '/';
const responseTimeoutMillis = 3000;
const goBackUserState = '<';
const goForwardUserState = '>';
const cancelInputForm = '<<';
const goBackFieldInputForm = '<';

class History {

    constructor(browser) {
        this.states = [];
        this.index = -1;

        this.browser = browser;
    }

    pushState(name, data) {
        if (this.state && this.state.name === name) { return; }  // ignore
        // clear history tail
        while (this.index !== this.states.length - 1) {
            this.states.pop();
        }
        this.states.push({ name, data });
        this.index += 1;
    }

    popState() {
        if (this.length <= 0) {
            throw new SourceError(this, `Invalid usage. No states to pop`);
        }
        this.states.pop();
        this.index -= 1;
    }

    back() {
        if (this.index <= 0) {
            throw new SourceError(this, `Invalid usage. No previous state`);
        }
        this.index -= 1;

        this.browser.sendRequest(new Request(this.state.name, this.state.data));
    }

    forward() {
        if (this.index >= this.states.length) {
            throw new SourceError(this, `Invalid usage. No next state`);
        }
        this.index += 1;
        
        this.browser.sendRequest(new Request(this.state.name, this.state.data));
    }

    get length() {
        return this.states.length;
    }

    get state() {
        return this.states[this.index];
    }

    get prev() {
        return this.index > 0;
    }

    get next() {
        return this.index < this.states.length - 1;
    }
}

const BrowserViewState = Object.freeze({
    Error: {},
    ShowText: {},
    InputForm: {}
});

class ConsoleBrowser {

    constructor() {
        this.viewState = BrowserViewState.ShowText;  // current view state (text | form)
        this.history = new History(this);  // state changes history & navigation

        // state data
        this.states = [];  // current states available
        this.form = null;  // current state form
        this.fieldIndex = 0;  // current state form current input field index

        this.timeout = null;  // request timeout

        let stdin = process.openStdin();
        // subscribe for console user input (fires after Enter is pressed)
        stdin.addListener("data", this._onInput.bind(this));
    }

    navigate(serverPort) {
        this.serverPort = serverPort;
        this._sendRequest(new Request(initialUserState));
    }

    _sendRequest(req) {
        let stateName = req.state;
        let formData = req.data;
        this.history.pushState(stateName, formData);

        this._clearScreen();
        this._showStateName();

        this.timeout = setTimeout(onTimeout.bind(this), responseTimeoutMillis);
        send.bind(this)(req, this._handleResponse.bind(this));

        function onTimeout() {
            const errorMsg = `No data received.\nUnable to load the state because the server sent no data.`;
            this._toError(new SourceError(this, errorMsg));
        }

        function send(req, resHandler) {
            let serverSocket = new Socket();
            if (!serverSocket.connect(this.serverPort)) {
                const errorMsg = `The app can't be reached.\nApp ${serverPort} refused to connect.`;
                this._toError(new SourceError(this, errorMsg));
                return;
            }
            serverSocket.on('message', message => {
                if (message instanceof Response) {
                    resHandler(message);
                }
                serverSocket.close();
            });
            serverSocket.send(req);
        }
    }

    _handleResponse(res) {
        clearTimeout(this.timeout);

        if (!res.isHandled) {
            const errorMsg = `Not found.\nThe requested state was not found on server.`;
            this._toError(new SourceError(this, errorMsg));
            return;
        }
        
        if (res.redirectState) {
            this.history.popState();
            this._redirect(res.redirectState);
        } else {
            if (res.data instanceof InputForm) {
                this._toInputForm(res.text, res.data);
            } else if (typeof(res.data) === 'object') {
                this._toShowText(res.text, res.data);
            }
        }
    }

    _onInput(dataObject) {
        let inputString = dataObject.toString().trim();

        if (this.viewState === BrowserViewState.ShowText) {
            if (!inputString) { return; }  // ignore empty input
            if (!Object.keys(this.states).includes(inputString)) {
                console.log(`Invalid state: '${inputString}'. Try again.`);
                this._showNextStateInput(false);
                return;
            }
            if (inputString === goBackUserState) {
                this.history.back();
            } else if (inputString === goForwardUserState) {
                this.history.forward();
            } else {
                this._sendRequest(new Request(inputString))
            }
        }
        else if (this.viewState === BrowserViewState.InputForm) {
            if (inputString === cancelInputForm) {
                this.history.back();  // cancel form input
            } else if (inputString === goBackFieldInputForm) {
                if (this.fieldIndex === 0) {
                    this.history.back();  // cancel form input
                } else {
                    this.fieldIndex -= 1;
                    this._showFormFieldInput();  // prev field
                }
            } else {
                this.form.setValueAt(this.fieldIndex, inputString);
                this.fieldIndex += 1;
                if (this.fieldIndex < this.form.length) {
                    this._showFormFieldInput();  // next field
                } else {
                    // form data is ready
                    this._sendRequest(new Request(this.form.state, this.form.getFormData()))
                }
            }
        }
    }

    _toError(err) {
        this._toShowText(err.toString());
    }

    _toShowText(text, states) {
        this.viewState = BrowserViewState.ShowText;
        this.states = prepareStates.bind(this)(states);
        //
        this._showText(text);
        this._showNextStateInput();

        function prepareStates(states) {
            let res = states || {};
            res[initialUserState] = "Home";
            if (this.history.prev) {
                res[goBackUserState] = "Back";
            }
            if (this.history.next) {
                res[goForwardUserState] = "Forward";
            }
            return res;
        }
    }

    _toInputForm(text, form) {
        if (form.length === 0) {
            throw new SourceError(this, `Form has no fields`);
        }
        //
        this.viewState = BrowserViewState.InputForm;
        this.form = form;
        this.fieldIndex = 0;
        // 
        this._showText(text);
        this._showFormInput();
        this._showFormFieldInput();
    }

    _redirect(redirectState) {
        this._sendRequest(new Request(redirectState));
    }

    _clearScreen() {
        if (process.platform === "win32") {
            process.stdout.write('\x1Bc');  // clear console (Win)
        }
        console.clear();
    }

    _showStateName() {
        console.log(`[${this.serverPort}] ${this.history.state.name}`);
        console.log('-------------------------------');
    }

    _showHistory() {
        console.log(this.history.states.map(x => x.name).join(", "));
        console.log('-------------------------------');
    }

    _showText(text) {
        console.log(text);
        console.log('-------------------------------');
    }

    _showNextStateInput(showOptions = true) {
        if (showOptions) {
            console.log('Choose the next state:');
            for (let [key, description] of Object.entries(this.states)) {
                console.log(`(${key}) ${description}`);
            }
        }
        process.stdout.write(`: `);
    }

    _showFormInput() {
        console.log(
            `Input form data:\n` + 
            `(${cancelInputForm}) Cancel form input\n` + 
            `(${goBackFieldInputForm}) Go back to previous field\n`);
    }

    _showFormFieldInput() {
        let field = this.form.getFieldAt(this.fieldIndex);
        let key = field[0];
        let description = field[1].description;
        process.stdout.write(`[${this.fieldIndex + 1}/${this.form.length}] (${key}) ${description}: `);
    }
}

module.exports = { ConsoleBrowser };