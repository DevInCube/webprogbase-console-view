const {SourceError} = require('./error');

class InputForm {

    constructor(state, fieldsObject) {
        this.state = state;  // next form state to send data to
        const pairs = Object.entries(this._expandFormFields(fieldsObject))
            .map(f => ([ 
                // key
                f[0],
                // field data
                {  
                    ...f[1],
                    value: null,
                } 
            ]));
        // all fields with their key, data and value
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
        const pairs = Object.entries(this.fields)
            .map(f => ({ key: f[0], value: f[1].value}))
            .map(p => [p.key, p.value]);
        return pairsToObject(pairs);
    }

    _expandFormFields(data) {
        const expandedFormFieldsDict = {};
        for (const [key, value] of Object.entries(data)) {
            const fieldData = getFormFieldData(value, key);
            expandedFormFieldsDict[key] = fieldData;
        }
        return expandedFormFieldsDict;

        function getFormFieldData(value, key) {
            if (typeof value === 'object') {
                if (value.description && !(typeof value.description === "string")) {
                    throw new SourceError(`Form field "${key}" description is not string`);
                }
                if (value.default && !(typeof value.default === "string")) {
                    throw new SourceError(`Form field "${key}" default is not string`);
                }
                if (value.auto && !(typeof value.auto === "string")) {
                    throw new SourceError(`Form field "${key}" auto is not string`);
                }
                return value;
            } else {
                return {
                    description: value
                };
            }
        }
    }
}

module.exports = { InputForm };


function pairsToObject(pairs) {
    return pairs.reduce((a, i) => { a[i[0]] = i[1]; return a; }, {});
}