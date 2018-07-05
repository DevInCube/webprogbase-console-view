class SourceError extends Error {

    constructor(sourceObject, message) {
        super(`[${sourceObject.constructor.name}] ${message}`);
    }
}

module.exports = { SourceError };