const TeleBot = require('telebot');
const fs = require('fs');
const DbHelper = require('./dbhelper');
const dateformat = require('dateformat');

const settings = JSON.parse(fs.readFileSync('settings.json'));
var dbhelper = new DbHelper('data.db');

dbhelper.load(main);

function main() {
    let token = fs.readFileSync(settings.token_location, 'utf8');
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
        else if (saveQuote(msg.reply_to_message))
            return bot.sendMessage(msg.from.id, 'Quote saved.',
                { replyToMessage: msg.reply_to_message.message_id });
        else
            return bot.sendMessage(msg.from.id, 'I already have that quote saved.',
                { replyToMessage: msg.reply_to_message.message_id });
    });
    //#endregion

    //#region show
    bot.on(/^\/list(\s+.+)*$/i, (msg, props) => {
        let quotes = Object.values(dbhelper.quotes);

        //sort quotes by date
        quotes.sort((a,b) => {
            return a.date - b.date;
        });

        //TODO: uncomment
        //if (quotes.length <= 1)
        //    return msg.reply.text('There are no stored quotes yet.', { asReply: true });

        let pages = Math.ceil(quotes.length / settings.quotes_per_page);
        let startPage = 0;

        let args = props.match[1];

        if (args) {
            args = args.trim();
            let num = Number(args);
            if (!isNaN(num)) {
                //the argument is a number
                if (num > pages) {
                    return msg.reply.text('I only have ' + pages +
                        ' page' + (pages > 1 ? 's' : '') + ' worth of quotes. ' +
                        'Please pick a number between 1 and ' + pages + '.', { asReply: true });
                }
                else {
                    startPage = num - 1;
                }
            }
            //argument is something else
            else {

            }
        }

        let list = "*Stored Quotes* (page " + (startPage + 1) + " of " + pages + ")\n\n";

        for (let i = 0; i < settings.quotes_per_page; i++) {
            let q = quotes[(startPage * settings.quotes_per_page) + i]

            if (q !== "quotes")
                list += createQuoteString(q);
        }

        return msg.reply.text(list, { parseMode: 'Markdown' });
    });
    //#endregion

    //#region sieg
    bot.on(/\s*s+i+e+g+\s*/i, (msg) => {
        return msg.reply.text('heil', { asReply: true });
    });
    //#endregion

    bot.start();
}

function createQuoteString(quote) {
    return "\"" + quote.text + "\"\n" +
        "_-[" + dbhelper.stats.users[quote.user].first_name + "](tg://user?id=" + quote.user +"), " +
        dateformat(quote.date, "d.m.yy") + "_\n\n";
}

function saveQuote(quote) {
    dbhelper.checkOrCreateUser(quote.from.id, quote.from.username, quote.from.first_name);
    return dbhelper.saveQuote(quote.message_id, quote.text, quote.date, quote.from.id);
}

function getHelpText() {
    return "To store a quote, reply to the message with /quote (/q)\n" +
        "I can also execute the following commands for you:\n" +
        "/help - display the message you're currently reading\n";
}