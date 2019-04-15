const TeleBot = require('telebot');
const fs = require('fs');
const DbHelper = require('./dbhelper');
const dateformat = require('dateformat');
const process = require('process');

//TODO: added by
//TODO: whitelist for /quote
//TODO: /help in dm only
//TODO: subscribe feature
//TODO: objectify settings

process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
    console.log(reason.stack);
});

var shouldShutdown = false;
var launchTime = new Date().getTime() / 1000;

const settingsfile = 'settings.json';
var settings = undefined;
try {
    settings = JSON.parse(fs.readFileSync(settingsfile));
} catch (e) {
    console.log('settings file doesn\'t exist or malformed, a new one will be created', e);
}

settings = {
    "token": "MISSING_TOKEN",
    "quotes_per_page": 5,
    "admins": [],
    "actions": {},
    ...settings
};
saveSettingsSync();

console.log('read settings.');

var dbhelper = new DbHelper('data.db');

dbhelper.load(main);

async function main() {
    console.log('database loaded.');

    let token = settings.token;
    if (token == "MISSING_TOKEN") {
        console.error('token in settings not set, please set the token, then restart');
        return;
    }
    token = token.trim();
    console.log('token read: "' + token + '"');
    let bot = new TeleBot(token);

    //#region start
    bot.on('/start', (msg) => {
        return msg.reply.text(
            "Hi! I'm the Degenerate Quote Bot. I can store all your notable weeb quotes.\n" +
            getHelpText(isAdmin(msg.from.username)),
            { parseMode: 'Markdown' });
    });
    //#endregion

    //#region help
    bot.on('/help', (msg) => {
        return msg.reply.text(getHelpText(isAdmin(msg.from.username)), { parseMode: 'Markdown' });
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

    bot.on(/^\/list(\s+.+)?$/i, (msg, props) => {
        if (shouldShutdown) return msg.reply.text("I'm shutting down right now, ask me again in a second");

        let quotes = getQuotesByDate();

        if (quotes.length < 1)
            return msg.reply.text('There are no stored quotes yet.', { asReply: true });

        let pages = Math.ceil(quotes.length / settings.quotes_per_page);
        let startPage = 0;

        let show = null;

        let args = props.match.input.match(/^\/list(\s+.+)?$/i)[1];

        let suffix = '';

        if (args) {
            args = args.trim();
            args = args.split(' ');
            for (arg of args) {
                let num = Number(arg);
                if (!isNaN(num)) {
                    //the argument is a number
                    if (args.indexOf(arg) < args.length - 1) {
                        return msg.reply.text('Page number is not last argument' +
                            'or multiple page arguments, skipping request.',
                            { asReply: true });
                    }
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
                    let matches = arg.match(/(\w+):(@?[\w-]+)/i);
                    if (!matches || (matches && matches.length < 3))
                        return msg.reply.text("Invalid syntax. Please see /help for the correct usage of this command.", { asReply: true });
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

                        case 'show':
                            if (['id'].includes(matches[1]))
                                show = matches[1];
                            else
                                return msg.reply.text("Invalid show argument.", { asReply: true });
                            break;

                        default:
                            return msg.reply.text("Unknown argument: '" + matches[0] + "'. Please see /help for all available arguments.", { asReply: true });
                    }
                }
            }
        }

        let list = "*Stored Quotes" + suffix + "* (page " + (startPage + 1) + " of " + pages + ")\n\n";

        let startIndex = startPage * settings.quotes_per_page;

        for (let i = startIndex; i < Math.min(startIndex + 5, quotes.length); i++) {
            if (quotes[i] !== "quotes")
                list += createQuoteString(quotes[i], show, 3800 / settings.quotes_per_page);
            // we make sure the message is not more than the 4096 char limit 
        }

        return msg.reply.text(list, { parseMode: 'Markdown' });
    });
    //#endregion

    //#region stats
    bot.on('/stats', msg => {
        //TODO: add args to list most quoted users, words

        let users = Object.values(dbhelper.users).sort((a, b) => { return b.quotes - a.quotes; });

        if (users.length < 4) {
            //TODO: maybe change this lazy way
            return msg.reply.text("Sorry, I don't have enough users to generate stats yet.", { asReply: true });
        }

        let text = `Here are some stats: So far, I have saved ${quotes.length} quotes from ${users.length} users. ` +
            `From them, ${formatUser(users[0].id)} is the most quoted one with *${users[0].quotes}* quotes, ` +
            `followed by ${formatUser(users[1].id)} with ${users[1].quotes}, and ${formatUser(users[2].id)} with ` +
            `${users[2].quotes} quotes. The least quoted user is ${formatUser(users[users.length - 2].id)} ` +
            `with ${users[users.length - 2].quotes} quotes.`;

        return msg.reply.text(text, { });
    });
    //#endregion

    //#region stop
    bot.on('/stop', msg => {
        if (isAdmin(msg.from.username)) {
            if (msg.date < launchTime) return msg.reply.text('you sent this before I booted, so I\'m ignoring it (sent at: ' + msg.date + ', boot time: ' + launchTime + ')');
            if (shouldShutdown) return msg.reply.text('am already shutting down, gimme a second');
            shouldShutdown = true;
            console.log("shutting down in 1000ms");
            setTimeout(() => bot.stop('shutting down...'), 1000);
            return msg.reply.text('goodbye');
        }
        else
            return msg.reply.text('You are not authorized to use this command.', { asReply: true });
    });
    //#endregion

    //#region reload
    bot.on('/reload', msg => {
        if (isAdmin(msg.from.username)) {
            settings = JSON.parse(fs.readFileSync(settingsfile));
            return msg.reply.text('settings reloaded.');
        }
        else
            return msg.reply.text('You are not authorized to use this command.', { asReply: true });
    });
    //#endregion

    //#region remove
    bot.on(['/remove', '/delete'], (msg, props) => {
        if (isAdmin(msg.from.username)) {
            let ids = props.match.input.match(/\d+/gi)
            let deleted = [];
            let failed = [];
            for (id of ids) {
                if (dbhelper.removeQuote(id))
                    deleted.push(id);
                else
                    failed.push(id);
            }
            let deltext = "";
            if (deleted.length > 0) {
                deltext += "Deleted the following quotes: " + deleted.join(', ') + '.';
            }
            if (failed.length > 0) {
                if (deltext.length > 0)
                    deltext += '\n\n';
                deltext += "Couldn't delete the following quotes: " + failed.join(', ') + '.\n' +
                    "(Double check your ids)";
            }
            return msg.reply.text(deltext, { asReply: true, parseMode: 'Markdown' });
        }
        else
            return msg.reply.text('You are not authorized to use this command.', { asReply: true });
    });
    //#endregion

    registerActions(settings.actions, bot);

    bot.start();
}

function isAdmin(username) {
    return settings.admins.indexOf(username) > -1;
}

function registerActions(actions, bot) {
    for (reg in actions) {
        let action = actions[reg];
        bot.on(new RegExp(reg, 'i'), msg => {

            if (action.probability <= Math.random())
                return;

            if (action.text)
                return msg.reply.text(action.text, { asReply: true });
            else if (action.sticker)
                return msg.reply.sticker(action.sticker, { asReply: true });
        });
    }
}

function createQuoteString(quote, show, maxlength) {
    return "_\"" + trimQuote(deharmifyQuote(quote.text), maxlength) + "\"_\n" +
        "-" + formatUser(quote.user) + ", " +
        dateformat(quote.date, "d.m.yy HH:MM") + getShowInfo(quote, show) + "\n\n";
}

function formatUser(userId) {
    return "[" + dbhelper.users[userId].first_name + "](tg://user?id=" + userId + ")";
}

function getShowInfo(quote, show) {
    if (!show)
        return '';

    let toReturn = " | ";

    switch (show) {
        case 'id':
            toReturn += quote.id;
            break;
    }

    return toReturn;
}

function deharmifyQuote(quote) {
    return quote.replace(/[()_*\[\]`]/gi, '{–}')
}

function trimQuote(text, maxlength) {
    if (text.length > maxlength)
        return text.substring(0, maxlength) + " [...]";
    return text;
}

function getQuotesByDate() {
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

    return quotes;
}

function saveQuote(quote) {
    dbhelper.checkOrCreateUser(quote.from.id, quote.from.username, quote.from.first_name);
    return dbhelper.saveQuote(quote.message_id, quote.text, quote.date * 1000, quote.from.id);
}

function getHelpText(admin) {
    let help = "To store a quote, reply to the message with /quote (/q).\n" +
        "To view all stored quotes, use /list.\n\n" +
        "Here's my full command list:\n\n" +
        "/quote, /q - store the referenced message as a quote.\n\n" +
        "/list `[arg1, arg2, ...] [page]` - display stored quotes, one page at a time.\n" +
        "`user:name` - display quotes from a user with a specific first name or username.\n" +
        "`before|after:dd-mm-yyyy-HH-MM` - display quotes from before/after a specific date and time.\n" +
        "`show:[info]` - use this to show more information on quotes. Available info: `id`\n\n" +
        "/help - display the message you're currently reading.";

    if (admin) {
        help += '\n\n' +
            "*Admin Commands*\nBecause you are an administrator," +
            " you're allowed to use the following additional commands:\n\n" +
            "/remove, /delete `[id1, id2, ...]` - deletes all given quotes.\n" +
            "*WARNING:* there is no second confirmation, be cautious!\n\n" +
            "/stop - stops the bot and ends the process.\n\n" +
            "/reload - reloads settings without restarting the bot.";
    }

    return help;
}

function getTopWords() {
    let quotes = Object.values(dbhelper.quotes);
    let wordDict = {};
    for (q of quotes) {
        let words = q.text.match(/\w+/gi);
        for (word of words) {
            word = word.toLowerCase();
            if (!wordDict.hasOwnProperty(word))
                wordDict[word] = 1;
            else
                wordDict[word]++;
        }
    }
    let wordList = []
    for (word in wordDict) {
        wordObj = {
            word: word,
            count: wordDict[word]
        };
        wordList.push(wordObj);
    }
    wordList = wordList.sort((a, b) => { return b.count - a.count });
    for (let i = 0; i < 50; i++) {
        console.log((i + 1) + ". " + wordList[i].word + " (" + wordList[i].count + "x)");
    }
}

function saveSettingsSync() {
    fs.writeFileSync(settingsfile, JSON.stringify(settings, null, 4));
}
