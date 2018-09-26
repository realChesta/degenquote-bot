const TeleBot = require('telebot');
const NeDB = require('nedb');
const fs = require('fs');

const settings = JSON.parse(fs.readFileSync('settings.json'));

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

        saveQuote(msg.reply_to_message);
    });
    //#endregion

    bot.start();
}

function saveQuote(quote) {
    let toSave = {
        id: quote.message_id,
        text: quote.text
    };
    console.log(quote.from.id);
}

function getHelpText() {
    return "To store a quote, reply to the message with /quote (/q)\n" +
        "I can also execute the following commands for you:\n" +
        "/help - display the message you're currently reading\n";
}