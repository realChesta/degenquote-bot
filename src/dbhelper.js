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
                this.quotes = q_docs[0];

            this.database.find({ _id: 'stats' }, (s_err, s_docs) => {
                if (s_docs.length === 0)
                    this.database.insert(this.stats);
                else
                    this.stats = s_docs[0];

                callback();
            });
        });
    }

    saveQuote(quoteId, text, userId) {
        if (!this.quotes.hasOwnProperty(quoteId)) {
            this.quotes[quoteId] = {
                id: quoteId,
                text: text,
                user: userId
            };

            if (this.stats.users[userId])
                this.stats.users[userId].quotes++;

            this.updateQuoteInDB(quoteId);

            return true;
        }
        else
            return false;
    }

    checkOrCreateUser(userId, username, firstName) {
        if (!this.stats.users.hasOwnProperty(userId)) {
            this.stats.users[userId] = {
                id: userId,
                username: username,
                firstName: firstName,
                quotes: 0
            };

            this.updateUserInDB(userId);

            return true;
        }
        else
            return false;
    }

    updateUserInDB(userId) {
        let userObj = {};
        userObj[userId] = this.stats.users[userId];
        this.database.update({ _id: 'stats' }, { $set: { users: userObj } });
    }

    updateQuoteInDB(quoteId) {
        let dbObj = {};
        dbObj[quoteId] = this.quotes[quoteId];
        this.database.update({ _id: 'quotes' }, { $set: dbObj });
    }

    updateInDB(_id, container, objId) {
        let dbObj = {};
        dbObj[objId] = container[objId];

        this.database.update({ _id: _id }, { $set: dbObj });
    }
}

module.exports = DbHelper;