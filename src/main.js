const TeleBot = require('telebot');
const fs = require('fs');
const DbHelper = require('./dbhelper');

const settings = JSON.parse(fs.readFileSync('settings.json'));
var dbhelper = new DbHelper('data.db');

dbhelper.load(main);

function main() {
    let token = fs.readFileSync(settings.tokenLocation, 'utf8');
    let bot = new TeleBot(token);

    //#region start

    bot.on('/start', (msg) => {
        return msg.reply.text(
            "Hi! I'm the Degenerate Quote Bot. I can store all your notable weeb quotes.\n" +
            getHelpText(),
            { parseMode: 'Markdown' });
    });
    //#endregion

    //#region help
    bot.on('/help', (msg) => {
        return msg.reply.text(getHelpText(), { parseMode: 'Markdown' });
    });
    //#endregion

    //#region quote
    bot.on(['/q', '/quote'], (msg) => {
        if (!msg.reply_to_message)
            return msg.reply.text("Please refer to a message.", { asReply: true });

        if (saveQuote(msg.reply_to_message))
            return bot.sendMessage(msg.from.id, 'Quote saved.',
                { replyToMessage: msg.reply_to_message.message_id });
        else
            return bot.sendMessage(msg.from.id, 'I already have that quote saved.',
                { replyToMessage: msg.reply_to_message.message_id });
    });
    //#endregion

    //region sieg
    bot.on(/\s*s+i+e+g+\s*/i, (msg) => {
        return msg.reply.text('heil', { asReply: true });
    });
    //endregion

    bot.start();
}

function saveQuote(quote) {
    dbhelper.checkOrCreateUser(quote.from.id, quote.from.username, quote.from.first_name);
    return dbhelper.saveQuote(quote.message_id, quote.text, quote.from.id);
}

function getHelpText() {
    return "To store a quote, reply to the message with /quote (/q)\n" +
        "I can also execute the following commands for you:\n" +
        "/help - display the message you're currently reading\n";
}