# Quote-Bot

A Telegram Bot to store quotes.

## Installation

Clone the git repository and install the npm modules:

```shell
$ git clone https://github.com/realChesta/degenquote-bot.git
$ cd degenquote-bot
$ npm install
```

## Configuration

Run the bot once to create an empty `settings.json`. 

Alternatively, create it yourself. It should look like the following:

```json
{
    "token": "MISSING_TOKEN",
    "quotes_per_page": 5,
    "admins": [],
    "actions": {}
}
```

* `"token"`: your Telegram Bot API token
* `"quotes_per_page"`: how many quotes should be displayed per page with `/list`
* `"admins"`: the usernames of the users who should be able to manage the bot *(can use `/stop` a.o.)*
* `"actions"`: contains special configurable actions, see next section

### Actions

Quote-Bot can react to regexes with messages you configure. To do this, simply add an action to the `actions` object in `settings.json`. It should have the following format:

```json
{
    "regex": {
        "probability": 1,
        "text": "hello",
        "sticker": "yourstickerid"
    }
}
```

* `"regex"`: the regex the action should trigger
* `"probability"`: a number in the range `[0, 1]` giving with what probability the action should be triggered
* `"text"`: a text the bot should reply to the message that matched the regex
* `"sticker"`: the id of a sticker the bot should reply to the matched message with

**IMPORTANT:** only use `"text"` *or* `"sticker"`!

## Usage

Run the bot using `npm`:

```shell
$ cd degenquote-bot
$ npm start
```
