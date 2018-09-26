const NeDB = require('nedb');

class DbHelper {
    constructor(filename) {
        this.filename = filename;
        this.quotes = { _id: 'quotes' };
        this.stats = { _id: 'stats', users: {} };
    }

    load(callback) {
        this.database = new NeDB({ filename: this.filename, autoload: true });
        this.database.find({ _id: 'quotes' }, (q_err, q_docs) => {
            if (q_docs.length === 0)
                this.database.insert(this.quotes);
            else
                this.quotes = q_docs[0]

            this.database.find({ _id: 'stats' }, (s_err, s_docs) => {
                if (s_docs.length === 0)
                    this.database.insert(this.stats);
                else
                    this.stats = s_docs[0];

                callback();
            });
        });
    }

    checkOrCreateUser(userId, username, firstName) {
        if (!this.stats.users.hasOwnProperty(userId)) {
            this.stats.users[userId] = {
                id: userId,
                username: username,
                firstName: firstName,
                quotes: 0
            };
        }
    }

    updateInDB(_id, container, objId) {
        let dbObj = {};
        dbObj[objId] = container[objId];

        this.database.update({ _id: _id }, { $set: dbObj });
    }
}

module.exports = DbHelper;