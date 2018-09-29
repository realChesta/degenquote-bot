const TeleBot = require('telebot');
const fs = require('fs');
const DbHelper = require('./dbhelper');
const dateformat = require('dateformat');

//TODO: added by
//TODO: whitelist for /quote
//TODO: shutdown command with whitelist
//TODO: /help in dm only


process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
    console.log(reason.stack);
});

const settings = JSON.parse(fs.readFileSync('settings.json'));
console.log('read settings.');

var dbhelper = new DbHelper('data.db');

dbhelper.load(main);

async function main() {
    console.log('database loaded.');

    let token = fs.readFileSync(settings.token_location, 'utf8').trim();
    console.log('token read: "' + token + '"');
    let bot = new TeleBot(token);

    let copepack = await bot.getStickerSet('degenquote_cope');
    console.log('sticker pack retrieved.');

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
            return bot.sendMessage(msg.chat.id, "I can't save non-text messages.",
                { replyToMessage: msg.reply_to_message.message_id });
        else if (msg.reply_to_message.from.username === "degenquote_bot")
            return msg.reply.text("I can't save things I said.", { asReply: true });
        else if (saveQuote(msg.reply_to_message))
            return bot.sendMessage(msg.chat.id, "Quote saved.",
                { replyToMessage: msg.reply_to_message.message_id });
        else
            return bot.sendMessage(msg.chat.id, "I already have that quote saved.",
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

        if (quotes.length < 1)
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
                if (num > pages || num < 1) {
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
                let matches = args.match(/(\w+):(@?[\w-]+)/i);
                if (!matches || (matches && matches.length < 3))
                    return msg.reply.text("Invalid syntax. Please se /help for the correct usage of this command.", { asReply: true });
                matches.splice(0, 1);
                switch (matches[0]) {
                    case 'user':
                        matches[1] = matches[1].replace('@', '');
                        let user = Object.values(dbhelper.users).find(u => {
                            return (u !== "users") && (u.username && u.username.toLowerCase() == matches[1].toLowerCase() ||
                                u.first_name && u.first_name.toLowerCase() == matches[1].toLowerCase());
                        });
                        if (!user)
                            return msg.reply.text("I couldn't find any quoted users with that name or username!", { asReply: true });
                        quotes = quotes.filter(q => {
                            return q.user == user.id;
                        });
                        pages = Math.ceil(quotes.length / settings.quotes_per_page);
                        suffix = ": " + user.first_name;
                        break;

                    case 'before':
                    case 'after':
                        let rawtime = matches[1].split('-').map(Number);
                        if (rawtime.length !== 5 || rawtime.some(isNaN))
                            return msg.reply.text('wrong time format. Please use the following format: dd-mm-yyyy-HH-MM', { asReply: true });

                        let date = new Date(rawtime[2], rawtime[1] - 1, rawtime[0], rawtime[3], rawtime[4]);

                        quotes = quotes.filter(q => {
                            return (matches[0] === 'before') ? (q.date < date) : (q.date > date);
                        });
                        pages = Math.ceil(quotes.length / settings.quotes_per_page);
                        suffix = ": " + matches[0] + " " + dateformat(date, "d. mmm. yyyy H:MM");

                        if (quotes.length === 0)
                            return msg.reply.text("I have no quotes from " + matches[0] + " " + dateformat(date, 'mmmm dS yyyy "at" H:MM') + "!");

                        break;

                    default:
                        return msg.reply.text("Unknown argument: '" + matches[0] + "'. Please see /help for all available arguments.", { asReply: true });
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

    bot.on('*', msg => {
        //console.log(msg.text);
        //return msg.reply.sticker(copepack.stickers[0].file_id, { asReply: true });
    });

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
        "To view all stored quotes, use /list.\n\n" +
        "Here's my full command list:\n\n" +
        "/quote, /q - store the referenced message as a quote.\n\n" +
        "/list `[argument]` - display stored quotes, one page at a time.\n" +
        "`user:name` - display quotes from a user with a specific first name or username.\n" +
        "`before|after:dd-mm-yyyy-HH-MM` - display quotes from before/after a specific date and time.\n\n" +
        "/help - display the message you're currently reading.";
}