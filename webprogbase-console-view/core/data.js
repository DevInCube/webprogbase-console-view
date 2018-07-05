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

module.exports = { InputForm };


function pairsToObject(pairs) {
    return pairs.reduce((a, i) => { a[i[0]] = i[1]; return a; }, {});
}