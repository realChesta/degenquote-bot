const TeleBot = require('telebot');
const fs = require('fs');
const DbHelper = require('./dbhelper');
const dateformat = require('dateformat');

const settings = JSON.parse(fs.readFileSync('settings.json'));
var dbhelper = new DbHelper('data.db');

dbhelper.load(main);

async function main() {
    let token = fs.readFileSync(settings.token_location, 'utf8');
    let bot = new TeleBot(token);

    let copepack = await bot.getStickerSet('degenquote_cope');

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
            return msg.reply.text('Please refer to a message.', { asReply: true });
        else if (!msg.reply_to_message.text)
            return bot.sendMessage(msg.from.id, "I can't save non-text messages.",
                { replyToMessage: msg.reply_to_message.message_id });
        else if (saveQuote(msg.reply_to_message))
            return bot.sendMessage(msg.from.id, "Quote saved.",
                { replyToMessage: msg.reply_to_message.message_id });
        else
            return bot.sendMessage(msg.from.id, "I already have that quote saved.",
                { replyToMessage: msg.reply_to_message.message_id });
    });
    //#endregion

    //#region list
    bot.on(/^\/list(\s+.+)*$/i, (msg, props) => {
        let quotes = Object.values(dbhelper.quotes);

        //remove _id field
        let id_index = quotes.indexOf("quotes");
        if (id_index > -1) {
            quotes.splice(id_index, 1);
        }

        //sort quotes by date
        quotes.sort((a, b) => {
            return b.date - a.date;
        });

        if (quotes.length <= 1)
            return msg.reply.text('There are no stored quotes yet.', { asReply: true });

        let pages = Math.ceil(quotes.length / settings.quotes_per_page);
        let startPage = 0;

        let args = props.match[1];

        let suffix = '';

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
                let matches = args.match(/(\w+):(@?\w+)/i);
                if (!matches || (matches && matches.length < 3))
                    return msg.reply.text("Invalid syntax. Please se /help for the correct usage of this command.", { asReply: true });
                matches.splice(0, 1);
                switch (matches[0]) {
                    case 'user':
                        matches[1] = matches[1].replace('@', '');
                        let user = Object.values(dbhelper.users).find(u => {
                            return (u !== "users") && (u.username.toLowerCase() == matches[1].toLowerCase() ||
                                u.first_name.toLowerCase() == matches[1].toLowerCase());
                        });
                        if (!user)
                            return msg.reply.text("I couldn't find any quoted users with that name or username!", { asReply: true });
                        quotes = quotes.filter(q => {
                            return q.user == user.id;
                        });
                        pages = Math.ceil(quotes.length / settings.quotes_per_page);
                        suffix = ": " + user.first_name;
                        break;

                    default:
                        return msg.reply.text("Unknown argument: '" + matches[0] + "'. Please see /help for all available arguments.", { asReply: true });
                        break;
                }
            }
        }

        let list = "*Stored Quotes" + suffix + "* (page " + (startPage + 1) + " of " + pages + ")\n\n";

        let startIndex = startPage * settings.quotes_per_page;

        for (let i = startIndex; i < Math.min(startIndex + 5, quotes.length); i++) {
            if (quotes[i] !== "quotes")
                list += createQuoteString(quotes[i]);
        }

        return msg.reply.text(list, { parseMode: 'Markdown' });
    });
    //#endregion

    //#region sieg
    bot.on(/\s*s+i+e+g+\s*/i, (msg) => {
        return msg.reply.text('heil', { asReply: true });
    });
    //#endregion

    //#region cope
    bot.on(/(^|\s)cope(\s|$)/i, msg => {
        return msg.reply.sticker(copepack.stickers[0].file_id, { asReply: true });
    });
    //#endregion

    bot.start();
}

function createQuoteString(quote) {
    return "_\"" + quote.text + "\"_\n" +
        "-[" + dbhelper.users[quote.user].first_name + "](tg://user?id=" + quote.user + "), " +
        dateformat(quote.date, "d.m.yy HH:MM") + "\n\n";
}

function saveQuote(quote) {
    dbhelper.checkOrCreateUser(quote.from.id, quote.from.username, quote.from.first_name);
    return dbhelper.saveQuote(quote.message_id, quote.text, quote.date * 1000, quote.from.id);
}

function getHelpText() {
    return "To store a quote, reply to the message with /quote (/q).\n" +
        "To view all stored quotes, use /list.\n" +
        "Here's my full command list:\n" +
        "/quote, /q - store the referenced message as a quote.\n" +
        "/list [int] [user:[name]] - display stored quotes, one page at a time. Filter by users using 'user:name'.\n" +
        "/help - display the message you're currently reading\n";
}