const TeleBot = require('telebot');
const NeDB = require('nedb');
const fs = require('fs');

const settings = JSON.parse(fs.readFileSync('../settings.json'));
var quotes = { _id: 'quotes' };
var stats = { _id: 'stats' };

function main() {
    let token = fs.readFileSync(settings.tokenLocation);
    let bot = new TeleBot(token);
}

const database = new NeDB({ filename: 'data.db', autoload: true });
database.find({ _id: 'quotes' }, (q_err, q_docs) => {
    if (q_docs.length === 0)
        database.insert(quotes);
    else
        quotes = q_docs[0]

    database.find({ _id: 'stats' }, (s_err, s_docs) => {
        if (s_docs.length === 0)
            database.insert(stats);
        else
            stats = s_docs[0];

        main();
    });
});