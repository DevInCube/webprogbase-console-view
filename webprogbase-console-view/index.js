const EventEmitter = require('events');

const responseTimeoutMillis = 3000;
const initialUserState = '/';
const goBackUserState = '<';
const goForwardUserState = '>';
const cancelInputForm = '<<';
const goBackFieldInputForm = '<';

class SourceError extends Error {

    constructor(sourceObject, message) {
        super(`[${sourceObject.constructor.name}] ${message}`);
    }
}

class Request {

    constructor(stateName, formData = null) {
        this.state = stateName;
        this.data = formData;  // key-value (string) dictionary, if present
        this.isRedirected = false;
    }
}

class Response {

    constructor(handler) {
        this.text = null;  // what text to show in view
        this.states = null;  // what states will be available
        this.form = null;  // (InputForm) what form to handle 
        this.redirectState = null;  // what state to redirect
        this.isHandled = false;  // was this reponse already handled

        this.handler = handler;
    }

    send(text, statesOrForm = null) {
        this.text = text;
        if (statesOrForm instanceof InputForm) {
            this.form = statesOrForm;
        } else if (typeof(statesOrForm) === 'object') {
            this.states = statesOrForm;
        }
        this._handle();
    }

    redirect(toState) {
        this.redirectState = toState;
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

class InputForm {

    constructor(state, fieldsObject) {
        this.state = state;  // next form state to send data to
        let pairs = Object.entries(fieldsObject)
            .map(f => ({ key: f[0], description: f[1]}))
            .map(p => [p.key, { description: p.description, value: null }]);
        // all fields with their key, description and value
        this.fields = pairsToObject(pairs);  
    }

    getFieldAt(index) {
        return Object.entries(this.fields)[index];
    }

    setValueAt(index, value) {
        this.getFieldAt(index)[1].value = value;
    }

    get length() {
        return Object.entries(this.fields).length;
    }

    getFormData() {
        let pairs = Object.entries(this.fields)
            .map(f => ({ key: f[0], value: f[1].value}))
            .map(p => [p.key, p.value]);
        return pairsToObject(pairs);
    }
}

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

class ConsoleBrowser extends EventEmitter {

    constructor() {
        super();

        this.viewState = BrowserViewState.ShowText;  // current view state (text | form)
        this.history = new History(this);  // state changes history & navigation

        // state data
        this.states = [];  // current states available
        this.form = null;  // current state form
        this.fieldIndex = 0;  // current state form current input field index

        this.timeout = null;  // request timeout
    }

    start() {
        let stdin = process.openStdin();
        // subscribe for console user input (fires after Enter is pressed)
        stdin.addListener("data", this._onInput.bind(this));

        this.sendRequest(new Request(initialUserState));
    }

    sendRequest(req) {
        let stateName = req.state;
        let formData = req.data;
        this.history.pushState(stateName, formData);

        this.timeout = setTimeout(onTimeout.bind(this), responseTimeoutMillis);

        this._clearScreen();
        this._showStateName();

        this.emit('request', req);

        function onTimeout() {
            const errorMsg = `No data received.\nUnable to load the state because the server sent no data.`;
            this._toError(new SourceError(this, errorMsg));
        }
    }

    handleResponse(res) {
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
            if (res.form) {
                this._toInputForm(res.text, res.form);
            }
            else {
                this._toShowText(res.text, res.states);
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
                this.sendRequest(new Request(inputString))
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
                    this.sendRequest(new Request(this.form.state, this.form.getFormData()))
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
        this.sendRequest(new Request(redirectState));
    }

    _clearScreen() {
        if (process.platform === "win32") {
            process.stdout.write('\x1Bc');  // clear console (Win)
        }
        console.clear();
    }

    _showStateName() {
        console.log(this.history.state.name);
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

class ServerApp {
    
    constructor() {
        this.browser = null;

        this.handlers = {};  // request handlers
    }

    use(stateName, handler) {
        if (this.handlers[stateName]) {
            let errMsg = `State '${stateName}' handler is already set`;
            throw new SourceError(this, errMsg);
        }
        this.handlers[stateName] = handler;
    }

    listen(browser) {
        this.browser = browser;
        this.browser.on('request', this._onRequest.bind(this));
    }

    _onRequest(request) {
        const stateHandler = this.handlers[request.state];
        if (!stateHandler) {
            let notFoundResponse = new Response();
            this.browser.handleResponse(notFoundResponse);
            return;
        }
        let response = new Response(res => this.browser.handleResponse(res));
        stateHandler(request, response);
    }
}

module.exports = { ConsoleBrowser, ServerApp, InputForm };

// utilities

function pairsToObject(pairs) {
    return pairs.reduce((a, i) => { a[i[0]] = i[1]; return a; }, {});
}