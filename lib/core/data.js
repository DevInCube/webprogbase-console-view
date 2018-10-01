class InputForm {

    constructor(state, fieldsObject) {
        this.state = state;  // next form state to send data to
        let pairs = Object.entries(this._expandFormFields(fieldsObject))
            .map(f => ([ 
                f[0],  // key
                {
                    description: f[1].description, 
                    default: f[1].default, 
                    value: f[1].value || null
                } 
            ]));
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

    _expandFormFields(data) {
        const expandedFormFieldsDict = {};
        for (let [key, value] of Object.entries(data)) {
            const fieldData = getFormFieldData(value);
            validateFieldData(fieldData.data, key);
            expandedFormFieldsDict[key] = fieldData;
        }
        return expandedFormFieldsDict;

        function getFormFieldData(value) {
            if (typeof value === 'object') {
                return value;
            } else {
                return {
                    description: value,
                    default: undefined,
                    value: undefined,
                };
            }
        }

        function validateFieldData(fieldData, fieldKey) {
            // @todo
        }
    }
}

module.exports = { InputForm };


function pairsToObject(pairs) {
    return pairs.reduce((a, i) => { a[i[0]] = i[1]; return a; }, {});
}