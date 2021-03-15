function checkMatchPredicate(predicate, obj) {
    switch (typeof predicate) {
        case 'string': {
            return new RegExp(predicate, 'im').test("" + obj);
        }
        case 'number': {
            return +obj === predicate;
        }
        case 'boolean': {
            return !!obj === predicate;
        }
        case 'object': {
            if (Array.isArray(predicate)) {
                return !!new Function('obj', `return (${predicate[0]});`)(obj);
            } else {
                for (const [key, value] of Object.entries(predicate)) {
                    if (!(key in obj)) return false;
                    if (!checkMatchPredicate(value, obj[key])) return false;
                }
                return true;
            }
        }
        default: {
            console.error(`Unsupported predicate:`, predicate);
            console.error(`Matched object:`, obj);
            throw new Error(`Unsupported predicate: ${JSON.stringify(predicate)}`);
        }
    }
}

function updateActionsObject(oldActions) {
    if (Array.isArray(oldActions)) return oldActions;

    return Object.entries(oldActions).map(([key, value]) => {
        if ('text' in value) {
            return [key, value.probability === undefined ? 1 : value.probability, value.text];
        }

        const newValue = {...value};
        const portedResponses = ['text', 'sticker', 'markov'].filter(a => a in newValue);
        portedResponses.forEach(a => delete newValue[a]);
        delete newValue.probability;
        
        const res = {
            match: {
                text: key,
                ...newValue,
            },
            response: portedResponses[0] === 'markov' ? 'markov' : [
                portedResponses[0],
                value[portedResponses[0]],
            ],
        };

        if ('probability' in value) {
            res.probability = value.probability;
        }

        return res;
    });
}


module.exports = {
    updateActionsObject,
    checkMatchPredicate,
};