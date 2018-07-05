const logSourceName = "View";
const responseTimeoutMillis = 3000;
const initialUserState = '/';
const goBackUserState = '<';
const goForwardUserState = '>';
const cancelInputForm = '<<';
const goBackFieldInputForm = '<';

class Request {

    constructor(stateName, formData) {
        this.state = stateName;
        this.data = formData;  // key-value (string) dictionary, if present
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

        this.timeout = setTimeout(onTimeout.bind(this), responseTimeoutMillis);

        function onTimeout() {
            const errorMsg = `[${logSourceName}] Response timeout (${responseTimeoutMillis})`;
            this._handle(new Error(errorMsg));
        }
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

    _handle(err) {
        if (this.isHandled) {
            throw new Error(`[${logSourceName}] Response is already handled`);
        }
        this.isHandled = true;
        clearTimeout(this.timeout);
        this.handler(err, this);  // success
    }
}

const ViewStates = Object.freeze({
    ShowText: {},
    InputForm: {}
});

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

    constructor(view) {
        this.states = [];
        this.index = -1;

        this.view = view;
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

    back() {
        if (this.index <= 0) {
            throw new Error(`[${logSourceName}] Invalid history usage. No previous state`);
        }
        this.index -= 1;
        this.view._askUserState(this.state.name, this.state.data);
    }

    forward() {
        if (this.index >= this.states.length) {
            throw new Error(`[${logSourceName}] history usage. No next state`);
        }
        this.index += 1;
        this.view._askUserState(this.state.name, this.state.data);
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

class ConsoleView {
    
    constructor() {
        this.viewState = ViewStates.ShowText;  // current view state (text | form)
        this.handlers = {};  // request handlers
        this.history = new History(this);  // state changes history & navigation
        
        this.states = [];  // current states available
        this.form = null;  // current state form
        this.fieldIndex = 0;  // current state form current input field index
    }

    use(stateName, handler) {
        if (this.handlers[stateName]) {
            let errMsg = `[${logSourceName}] State '${stateName}' handler is already set`;
            throw new Error(errMsg);
        }
        this.handlers[stateName] = handler;
    }

    listen() {
        let stdin = process.openStdin();
        // subscribe for console user input (fires after Enter is pressed)
        stdin.addListener("data", this._onInput.bind(this));

        this._askUserState(initialUserState);
    }

    _onInput(dataObject) {
        let inputString = dataObject.toString().trim();

        if (this.viewState === ViewStates.ShowText) {
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
                this._askUserState(inputString);
            }
        }
        else if (this.viewState === ViewStates.InputForm) {
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
                    this._askUserState(this.form.state, this.form.getFormData());
                }
            }
        }
        else {
            throw new Error(`[${logSourceName}] Not supported: ${this.viewState}`);
        }
    }

    _askUserState(stateName, formData = null) {
        const stateHandler = this.handlers[stateName];
        if (!stateHandler) {
            let errMsg = `[${logSourceName}] State '${stateName}' handler is not set`;
            throw new Error(errMsg);
        }
        let request = new Request(stateName, formData);
        let response = new Response((err, res) => {
            if (err) { throw err; }
            if (res.redirectState) {
                this._redirect(res.redirectState);
            } else {
                this.history.pushState(stateName, formData);
                if (res.form) {
                    this._toInputForm(res.text, res.form);
                }
                else {
                    this._toShowText(res.text, res.states);
                }
            }
        });
        // process.stdout.write('\x1Bc');  // clear console (Win)
        console.clear();
        stateHandler(request, response);
    }

    _toShowText(text, states) {
        this.viewState = ViewStates.ShowText;
        this.states = prepareStates.bind(this)(states);
        //
        this._showStateAndText(text);
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
            throw new Error(`[${logSourceName}] Form has no fields`);
        }
        //
        this.viewState = ViewStates.InputForm;
        this.form = form;
        this.fieldIndex = 0;
        // 
        this._showStateAndText(text);
        this._showFormInput();
        this._showFormFieldInput();
    }

    _redirect(redirectState) {
        process.nextTick(() => this._askUserState(redirectState));
    }

    _showStateAndText(text) {
        console.log(this.history.state.name);
        console.log('-------------------------------');
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

module.exports = { ConsoleView, InputForm };

// utilities

function pairsToObject(pairs) {
    return pairs.reduce((a, i) => { a[i[0]] = i[1]; return a; }, {});
}