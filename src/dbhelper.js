const NeDB = require('nedb');

class DbHelper {
    constructor(filename) {
        this.filename = filename;
        this.quotes = { _id: 'quotes' };
        this.users = { _id: 'users' };
        this.clusters = { _id: 'clusters' };
        this.chats = { _id: 'chats' };
    }

    load(callback) {
        this.database = new NeDB({ filename: this.filename, autoload: true });
        this.database.find({ _id: 'quotes' }, (q_err, q_docs) => {
            if (q_docs.length === 0)
                this.database.insert(this.quotes);
            else
                this.quotes = q_docs[0];

            this.database.find({ _id: 'users' }, (s_err, s_docs) => {
                if (s_docs.length === 0)
                    this.database.insert(this.users);
                else
                    this.users = s_docs[0];

                this.database.find({ _id: 'clusters' }, (s_err, s_docs) => {
                    if (s_docs.length === 0)
                        this.database.insert(this.clusters);
                    else
                        this.clusters = s_docs[0];

                    this.database.find({ _id: 'chats' }, (s_err, s_docs) => {
                        if (s_docs.length === 0)
                            this.database.insert(this.chats);
                        else
                            this.chats = s_docs[0];

                        if (callback)
                            callback();
                    });
                });
            });
        });
    }

    saveQuote(chatId, msgId, text, date, userId, quoterId) {
        const msgIdStr = msgId.toString(36);
        const chatIdStr = Math.abs(chatId).toString(36);
        const quoteId = (2 * msgIdStr.length + (chatIdStr < 0)).toString(36) + msgIdStr + chatIdStr;
        const oldQuoteId = msgId;
        if (!this.quotes.hasOwnProperty(quoteId) && !this.quotes.hasOwnProperty(oldQuoteId)) {
            this.quotes[quoteId] = {
                id: quoteId,
                text: text,
                date: date,
                user: userId,
                chatId: chatId,         // might not exist on older quotes
                quoterId: quoterId,     // might not exist on older quotes
            };

            if (this.users[userId])
                this.users[userId].quotes++;

            this.updateUserInDB(userId);
            this.updateQuoteInDB(quoteId);


            return true;
        }
        else
            return false;
    }

    removeQuote(quoteId) {
        if (!this.quotes.hasOwnProperty(quoteId))
            return false;

        let userId = this.quotes[quoteId].user;
        this.users[userId].quotes--;

        this.updateUserInDB(userId);

        let quoteObj = {};
        quoteObj[quoteId] = this.quotes[quoteId];
        this.database.update({ _id: this.quotes._id }, { $unset: quoteObj });

        delete this.quotes[quoteId];

        return true;
    }

    checkOrCreateUser(userId, username, firstName) {
        if (!this.users.hasOwnProperty(userId)) {
            this.users[userId] = {
                id: userId,
                username: username,
                first_name: firstName,
                quotes: 0
            };

            this.updateUserInDB(userId);

            return true;
        }
        else {
            if (this.users[userId].username != username || this.users[userId].first_name != firstName) {
                this.users[userId].username = username;
                this.users[userId].first_name = firstName;
                this.updateUserInDB(userId);
            }
            return false;
        }
    }

    getChatCluster(chatId) {
        const clusterId = this.chats[chatId] && this.chats[chatId].cluster;
        return clusterId || `chat:${chatId}`;
    }

    resetChatCluster(chatId) {
        if (!this.chats[chatId]) return;
        const clusterId = this.chats[chatId].cluster;
        delete this.chats[chatId].cluster;
        this.clusters[clusterId] = this.clusters[clusterId].filter(a => a !== chatId);
    }

    setChatCluster(chatId, clusterId) {
        if (!clusterId.startsWith(`cluster:`)) throw new Error(`Cluster name must start with 'cluster:'!`);
        this.resetChatCluster(chatId);

        if (!this.clusters[clusterId]) this.clusters[clusterId] = [];
        this.clusters[clusterId].push(chatId);
        this.updateClusterInDB(clusterId);
        
        if (!this.chats[chatId]) this.chats[chatId] = {};
        this.chats[chatId].cluster = clusterId;
        this.updateClusterInDB(chatId);
    }

    getAllChatsOfCluster(clusterId) {
        if (clusterId.startsWith(`chat:`)) {
            return [Number(clusterId.substr(5))];
        } else if (clusterId.startsWith(`cluster:`)) {
            return this.clusters[clusterId];
        }
        throw new Error(`Unknown cluster ID ${clusterId}!`);
    }

    updateUserInDB(userId) {
        this.updateInDB('users', this.users, userId);
    }

    updateQuoteInDB(quoteId) {
        this.updateInDB('quotes', this.quotes, quoteId);
    }

    updateClusterInDB(clusterId) {
        this.updateInDB('clusters', this.clusters, clusterId);
    }

    updateChatInDB(chatId) {
        this.updateInDB('chats', this.chats, chatId);
    }

    updateInDB(_id, container, objId) {
        let dbObj = {};
        dbObj[objId] = container[objId];

        this.database.update({ _id: _id }, { $set: dbObj });
    }
}

module.exports = DbHelper;