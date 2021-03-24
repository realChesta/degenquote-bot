const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const DbHelper = require('./dbhelper');
const dateformat = require('dateformat');
const process = require('process');
const Markov = require('./markov');
const {updateActionsObject, checkMatchPredicate} = require('./actions.js');
const { GPT2 } = require('./gpt2');

//TODO: added by
//TODO: whitelist for /quote
//TODO: /help in dm only
//TODO: subscribe feature
//TODO: objectify settings

process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
    console.log(reason.stack);
});

let uidCount = Math.floor(Math.random() * 100000);
let shouldShutdown = false;
let launchTime = new Date().getTime() / 1000;

const settingsfile = 'settings.json';
let settings = undefined;
if (fs.statSync(settingsfile)) {
    console.log('reading settings file...');
    const settingsContent = fs.readFileSync(settingsfile)
    try {
        settings = JSON.parse(settingsContent);
    } catch (e) {
        console.error('settings file is malformed', e);
        console.error('malformed settings file content:', settingsContent);
        throw e;
    }
} else {
    console.log('settings file does not exist, a new one will be created', e);
}

settings = {
    "token": "MISSING_TOKEN",
    "quotes_per_page": 5,
    "admins": [],
    "actions": [],
    "markov_file": "markov.json",
    "enable_markov_for_clusters": ["cluster:original"],
    "enable_gpt2_for_clusters": [],
    "bot_handle": "degenquote_bot",
    "python_name": "python3",
    ...settings
};
updateSettingsFromPreviousVersion();
saveSettingsSync();

console.log('settings read.');

const dbhelper = new DbHelper('data.db');
dbhelper.load(main);
console.log('database loaded.');

const markovEntries = fs.existsSync(settings.markov_file) ? JSON.parse(fs.readFileSync(settings.markov_file)) : [];
const markov = new Markov(markovEntries);
console.log('markov loaded.');

const gpt2 = new GPT2(settings.python_name);
console.log('gpt2 loaded.');

let token = settings.token;
if (token == "MISSING_TOKEN") {
    console.error('token in settings not set, please set the token, then restart');
    return;
}
token = token.trim();
console.log('token read.');
let bot = new TelegramBot(token, {polling: true});
console.log('bot loaded.');


async function main() {
    bot.on('polling_error', console.error);

    //#region start
    bot.onText(/^\/start/, (msg) => {
        return replyToMessage(msg, 
            "Hi! I'm the Degen Quote Bot. I can store all your notable quotes.\n" +
            getHelpText(isAdmin(msg.from.username)),
            { parse_mode: 'Markdown' });
    });
    //#endregion

    //#region help
    bot.onText(/^\/help/, (msg) => {
        return replyToMessage(msg, getHelpText(isAdmin(msg.from.username)), { parse_mode: 'Markdown' });
    });
    //#endregion

    //#region quote
    bot.onText(/^\/q(oute)?/, (msg) => {
        console.log(`/q called!`, JSON.stringify(msg));
        if (!msg.reply_to_message)
            return replyToMessage(msg, 'Please refer to a message.');
        else if (!msg.reply_to_message.text)
            return replyToMessage(msg.reply_to_message, "I can't save non-text messages.");
        else if (saveQuote(msg.reply_to_message, msg.from))
            return replyToMessage(msg.reply_to_message, `Thanks ${getUserDisplay(msg.from)}, quote saved.`);
        else
            return replyToMessage(msg.reply_to_message, "I already have that quote saved.");
    });
    //#endregion
    
    //#region cite
    bot.onText(/^\/c(ite)?((\s+[0-9a-z]+)+)$/, (msg, match) => {
        const ids = match[2].match(/[0-9a-z]+/gi);
        if (ids.length <= 0) {
            return replyToMessage(msg, 'You must specify at least one ID.');
        }
        
        let list = '';
        for (let id of ids) {
            const quote = dbhelper.quotes[id];
            if (!quote || !hasAccessToQuote(msg.chat, msg.from.id, quote)) {
                return replyToMessage(msg, `There's no quote with id ${id}!`);
            }
            list += createQuoteString(quote, '', 3800 / ids.length);
        }
        return replyToMessage(msg, list, { parse_mode: 'Markdown' });
    });
    //#endregion

    //#region list
    bot.onText(/^\/(admin)?list(\s+.+)?$/, (msg, match) => {
        if (shouldShutdown) return replyToMessage(msg, "I'm shutting down right now, ask me again in a second");

        const isAdminList = match[1] === 'admin';

        if (isAdminList && msg.chat.type !== 'private') {
            return replyToMessage(msg, `/adminlist can only be used in private chats with me!`);
        }

        let quotes = getQuotesByDate();
        if (!isAdminList) {
            quotes = quotes.filter(a => hasAccessToQuote(msg.chat, msg.from.id, a))
        }

        let pages = Math.ceil(quotes.length / settings.quotes_per_page);
        let startPage = 0;

        let show = null;

        let args = match[2];

        let suffix = '';

        if (args) {
            args = args.trim();
            args = args.split(' ');
            for (arg of args) {
                let num = Number(arg);
                if (!isNaN(num)) {
                    //the argument is a number
                    if (args.indexOf(arg) < args.length - 1) {
                        return replyToMessage(msg, 'Page number is not last argument' +
                            'or multiple page arguments, skipping request.');
                    }
                    if (num > pages || num < 1) {
                        return replyToMessage(msg, 'I only have ' + pages +
                            ' page' + (pages > 1 ? 's' : '') + ' worth of quotes. ' +
                            'Please pick a number between 1 and ' + pages + '.');
                    }
                    else {
                        startPage = num - 1;
                    }
                }
                //argument is something else
                else {
                    let matches = arg.match(/(\w+):(@?[\w-]+)/i);
                    if (!matches || (matches && matches.length < 3))
                        return replyToMessage(msg, "Invalid syntax. Please see /help for the correct usage of this command.");
                    matches.splice(0, 1);
                    switch (matches[0]) {
                        case 'user':
                            matches[1] = matches[1].replace('@', '');
                            let user = Object.values(dbhelper.users).find(u => {
                                return (u !== "users") && (u.username && u.username.toLowerCase() == matches[1].toLowerCase() ||
                                    u.first_name && u.first_name.toLowerCase() == matches[1].toLowerCase());
                            });
                            if (!user)
                                return replyToMessage(msg, "I couldn't find any quoted users with that name or username!");
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
                                return replyToMessage(msg, 'wrong time format. Please use the following format: dd-mm-yyyy-HH-MM');

                            let date = new Date(rawtime[2], rawtime[1] - 1, rawtime[0], rawtime[3], rawtime[4]);

                            quotes = quotes.filter(q => {
                                return (matches[0] === 'before') ? (q.date < date) : (q.date > date);
                            });
                            pages = Math.ceil(quotes.length / settings.quotes_per_page);
                            suffix = ": " + matches[0] + " " + dateformat(date, "d. mmm. yyyy H:MM");

                            if (quotes.length === 0)
                                return replyToMessage(msg, "I have no quotes from " + matches[0] + " " + dateformat(date, 'mmmm dS yyyy "at" H:MM') + "!");

                            break;

                        case 'show':
                            if (['id'].includes(matches[1]))
                                show = matches[1];
                            else
                                return replyToMessage(msg, "Invalid show argument.");
                            break;

                        default:
                            return replyToMessage(msg, "Unknown argument: '" + matches[0] + "'. Please see /help for all available arguments.");
                    }
                }
            }
        }

        if (quotes.length < 1)
            return replyToMessage(msg, 'There are no stored quotes in this chat.');

        let list = "*Stored Quotes" + suffix + "* (page " + (startPage + 1) + " of " + pages + ")\n\n";

        let startIndex = startPage * settings.quotes_per_page;

        for (let i = startIndex; i < Math.min(startIndex + 5, quotes.length); i++) {
            if (quotes[i] !== "quotes")
                list += createQuoteString(quotes[i], show, 3800 / settings.quotes_per_page);
            // we make sure the message is not more than the 4096 char limit 
        }

        return replyToMessage(msg, list, { parse_mode: 'Markdown' });
    });
    //#endregion

    //#region stats
    bot.onText(/^\/stats/, msg => {
        //TODO: add args to list most quoted users, words

        /** @type any */
        let quotes = Object.values(dbhelper.quotes).filter(a => a !== 'quotes').filter(a => hasAccessToQuote(msg.chat, msg.from.id, a));
        let users = [
            ...quotes.reduce(
                (map, a) => (map.set(a.user, (map.get(a.user) || 0) + 1)),
                new Map()
            ).entries()
        ].sort((a, b) => b[1] - a[1]);

        if (users.length < 4) {
            //TODO: maybe change this lazy way
            return replyToMessage(msg, "Sorry, I don't have enough users to generate stats yet.");
        }

        let text = `Here are some stats: So far, I have saved ${quotes.length} quotes from ${users.length} users. ` +
            `From them, ${formatUser(users[0][0])} is the most quoted one with *${users[0][1]}* quotes, ` +
            `followed by ${formatUser(users[1][0])} with ${users[1][1]}, and ${formatUser(users[2][0])} with ` +
            `${users[2][1]} quotes. The least quoted user is ${formatUser(users[users.length - 1][0])} ` +
            `with ${users[users.length - 1][1]} quotes.`;

        return replyToMessage(msg, text, { parse_mode: 'Markdown' });
    });
    //#endregion

    //#region stop
    bot.onText(/^\/stop/, msg => {
        if (isAdmin(msg.from.username)) {
            if (msg.date < launchTime) return replyToMessage(msg, 
                'You sent this before I booted, so I\'m ignoring it (sent at: ' + msg.date + ', boot time: ' +
                launchTime + ')'
            );
            if (shouldShutdown) return replyToMessage(msg, `I'm already shutting down, give me a second`);
            shouldShutdown = true;
            console.log("shutting down in 1000ms");
            setTimeout(() => process.exit(0), 1000);
            return replyToMessage(msg, 'goodbye');
        }
        else
            return replyToMessage(msg, 'You are not authorized to use this command.');
    });
    //#endregion

    //#region reload
    bot.onText(/^\/reload/, msg => {
        if (isAdmin(msg.from.username)) {
            settings = JSON.parse(fs.readFileSync(settingsfile));
            return replyToMessage(msg, 'settings reloaded.');
        }
        else
            return replyToMessage(msg, 'You are not authorized to use this command.');
    });
    //#endregion

    //#region setcluster
    bot.onText(/^\/setcluster(\s+([\-a-zA-Z0-9:]+))?\s*$/, (msg, match) => {
        if (!isAdmin(msg.from.username)) {
            return replyToMessage(msg, 'You are not authorized to use this command.');
        }

        if (!match[1]) {  
            dbhelper.resetChatCluster(msg.chat.id);
            return replyToMessage(msg, `Chat cluster has been reset!`);
        }

        const clusterName = match[2];
        if (!clusterName.startsWith(`cluster:`)) return replyToMessage(msg, `Cluster name must start with 'cluster:'!`);

        dbhelper.setChatCluster(msg.chat.id, clusterName);
        return replyToMessage(msg, `Chat cluster has been set to ${clusterName}!`);
    });
    //#endregion

    //#region setclusterfor
    bot.onText(/^\/setclusterfor\s+([\-a-zA-Z0-9:]+)(\s+([\-a-zA-Z0-9:]+))?\s*$/, (msg, match) => {
        if (!isAdmin(msg.from.username)) {
            return replyToMessage(msg, 'You are not authorized to use this command.');
        }

        const chatid = match[1];

        if (!match[2]) {  
            dbhelper.resetChatCluster(chatid);
            return replyToMessage(msg, `Chat cluster has been reset!`);
        }

        const clusterName = match[3];
        if (!clusterName.startsWith(`cluster:`)) return replyToMessage(msg, `Cluster name must start with 'cluster:'!`);

        dbhelper.setChatCluster(chatid, clusterName);
        return replyToMessage(msg, `Chat cluster has been set to ${clusterName}!`);
    });
    //#endregion

    //#region setclusterfor
    bot.onText(/^\/listchats$/, (msg, match) => {
        if (!isAdmin(msg.from.username)) {
            return replyToMessage(msg, 'You are not authorized to use this command.');
        }

        const clusters = new Map();

        for (const [chatId, chatInfo] of Object.entries(dbhelper.getAllChats())) {
            clusters.set(chatInfo.cluster, (clusters.get(chatInfo.cluster) || "") + `  ${chatId}: ${chatInfo.name}\n`);
        }

        return replyToMessage(msg, [...clusters].map(([k, v]) => `=== ${k || 'Unclustered'} ===\n${v}`).join("\n"));
    });
    //#endregion

    //#region remove
    bot.onText(/^\/(remove|delete)((\s+[0-9a-z]+)+)$/i, (msg, match) => {
        if (isAdmin(msg.from.username)) {
            let ids = match[2].match(/[0-9a-z]+/gi);
            let deleted = [];
            let failed = [];
            for (const id of ids) {
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
            return replyToMessage(msg, deltext, { parse_mode: 'Markdown' });
        }
        else
            return replyToMessage(msg, 'You are not authorized to use this command.');
    });
    //#endregion

    //#region markov
    bot.onText(/[^]*/, (msg) => {
        if (settings.enable_markov_for_clusters.includes(dbhelper.getChatCluster(msg.chat.id))
                && msg.reply_to_message
                && msg.reply_to_message.from.username === settings.bot_handle
                && (msg.text.includes('?') || Math.random() < 0.6)) {
            return replyToMessage(msg, markov.generateMessage());
        }
    });
    //#endregion

    //#region gpt2
    bot.onText(/[^]*/, async (msg) => {
        if (settings.enable_gpt2_for_clusters.includes(dbhelper.getChatCluster(msg.chat.id))
                && msg.reply_to_message
                && msg.reply_to_message.from.username === settings.bot_handle
                && (msg.text.includes('?') || Math.random() < 0.6)) {
            return replyWithGPT2(msg);
        }
    });
    //#endregion

    //#region idinfo
    bot.onText(/^\/idinfo/, (msg) => {
        const cluster = dbhelper.getChatCluster(msg.chat.id);
        return replyToMessage(msg, `
            Chat name: ${msg.chat.title || msg.chat.username || msg.chat.first_name}
            Chat id: ${msg.chat.id}
            Chat type: ${msg.chat.type}
            Chat cluster id: ${cluster}
            Adjacent chats in cluster: ${dbhelper.getAllChatsOfCluster(cluster).join(', ')}
        `.split('\n').map(a => a.trim()).join('\n'));
    });
    //#endregion

    registerActions(settings.actions, bot);
}

function isAdmin(username) {
    return settings.admins.indexOf(username) > -1;
}

function registerActions(actions, bot) {
    bot.on('message', msg => {

        dbhelper.updateChatInfo(msg.chat);
        gpt2.registerMessage(msg);

        const satisfiedGroups = new Set();
        for (const itAction of actions) {
            const action = !Array.isArray(itAction) ? itAction : {
                match: {text: itAction[0]},
                probability: itAction[1],
                response: ['text', itAction[2]],
            };

            if ('probability' in action && action.probability <= Math.random())
                continue;
            if ('cluster' in action && action.cluster !== dbhelper.getChatCluster(msg.chat.id))
                continue;

            if (!checkMatchPredicate(action.match, msg))
                continue;

            if ('group' in action) {
                if (satisfiedGroups.has(action.group)) continue;
                satisfiedGroups.add(action.group);
            }

            if (action.response === 'markov') {
                replyToMessage(msg, markov.generateMessage());
            } else if (action.response === 'gpt2') {
                replyWithGPT2(msg);
            } else if (action.response[0] === 'text') {
                replyToMessage(msg, action.response[1]);
            } else if (action.response[0] === 'sticker') {
                replyWithSticker(msg, action.response[1]);
            } else if (action.response[0] === 'image') {
                replyWithImage(msg, action.response[1]);
            } else if (action.response[0] === 'video') {
                replyWithVideo(msg, action.response[1]);
            } else {
                throw new Error(`Unknown response type! ${action.response[0]}`);
            }
        }
    });
}

function createQuoteString(quote, show, maxlength) {
    return "_\"" + trimQuote(deharmifyQuote(quote.text), maxlength) + "\"_\n" +
        "-" + formatUser(quote.user) + ", " +
        dateformat(quote.date, "d.m.yy HH:MM") + getShowInfo(quote, show) + "\n\n";
}

function hasAccessToQuote(chat, senderId, quote) {
    const clusterId = dbhelper.getChatCluster(chat.id);
    const chats = dbhelper.getAllChatsOfCluster(clusterId);
    return chats.includes(quote.chatId)
        || (quote.chatId === undefined && clusterId === 'cluster:original')
        || (chat.type === 'private' && quote.user === senderId);
}

function formatUser(userId) {
    const user = dbhelper.users[userId];
    return "[" + (user && user.first_name) + "](tg://user?id=" + userId + ")";
}

function getShowInfo(quote, show) {
    if (!show)
        return '';

    let toReturn = " | ";

    switch (show) {
        case 'id':
            toReturn += `id: ${quote.id}`;
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

function saveQuote(quote, quoter) {
    dbhelper.checkOrCreateUser(quote.from.id, quote.from.username, quote.from.first_name);
    return dbhelper.saveQuote(quote.chat.id, quote.message_id, quote.text, quote.date * 1000, quote.from.id, quoter.id);
}

function getHelpText(admin) {
    let help = "To store a quote, reply to the message with /quote (/q).\n" +
        "To view all stored quotes, use /list.\n\n" +
        "Here's my full command list:\n\n" +
        "/quote, /q - store the referenced message as a quote.\n\n" +
        "/cite `id1 [id2, ..., idn]`, /c - display the quotes with the given ID.\n\n" +
        "/list `[arg1, arg2, ...] [page]` - display stored quotes, one page at a time.\n" +
        "`user:name` - display quotes from a user with a specific first name or username.\n" +
        "`before|after:dd-mm-yyyy-HH-MM` - display quotes from before/after a specific date and time.\n" +
        "`show:[info]` - use this to show more information on quotes. Available info: `id`\n\n" +
        "/idinfo - display a bunch of id information of this chat.\n\n" +
        "/help - display the message you're currently reading.";

    if (admin) {
        help += '\n\n' +
            "*Admin Commands*\nBecause you are an administrator," +
            " you're allowed to use the following additional commands:\n\n" +
            "/remove, /delete `[id1, id2, ...]` - deletes all given quotes.\n" +
            "*WARNING:* there is no second confirmation, be cautious!\n\n" +
            "/stop - stops the bot and ends the process.\n\n" +
            "/adminlist - shows ALL quotes from all chats. Takes the same arguments as /list.\n\n" +
            "/setcluster `[clusterid]` - set the current chat's cluster to the passed argument (empty to reset).\n\n" +
            "/setclusterfor `chatid [clusterid]` - set the given chat's cluster to the passed argument (empty to reset).\n\n" +
            "/listchats - lists all chats sorted by their clusters.\n\n" +
            "/reload - reloads settings without restarting the bot.";
    }

    return help;
}

function getUserDisplay(user) {
    return user.username ? `@${user.username}` : user.first_name.replace('@', '(at)');
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

function replyToMessage(replyTo, text, options = {}) {
    bot.sendMessage(replyTo.chat.id, text, {reply_to_message_id: replyTo.message_id, ...options});
}

function replyWithSticker(replyTo, sticker, options = {}) {
    bot.sendSticker(replyTo.chat.id, sticker, {reply_to_message_id: replyTo.message_id, ...options});
}

function replyWithImage(replyTo, image, options = {}) {
    bot.sendPhoto(replyTo.chat.id, video, {reply_to_message_id: replyTo.message_id, ...options});
}

function replyWithVideo(replyTo, video, options = {}) {
    bot.sendVideo(replyTo.chat.id, video, {reply_to_message_id: replyTo.message_id, ...options});
}

function replyWithGPT2(replyTo) {
    const count = 1 + Math.floor(Math.log(1 / Math.random()) / Math.log(2));
    gpt2.generateMessage(replyTo)
        .then(t => (t || 'chill down').split("\n\n")
                                      .slice(0, count)
                                      .forEach(msg => replyToMessage(replyTo, msg, {reply_to_message_id: undefined})));
}

function updateSettingsFromPreviousVersion() {
    settings.actions = updateActionsObject(settings.actions);
}

function saveSettingsSync() {
    fs.writeFileSync(settingsfile, JSON.stringify(settings, null, 4));
}
