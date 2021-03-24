# Quote-Bot

A Telegram Bot to store quotes.

## Installation

Clone the git repository and install the npm modules:

```shell
$ git clone https://github.com/realChesta/degenquote-bot.git
$ cd degenquote-bot
$ npm install
$ npm start
```

For the GPT-2 features, you will need to install Tensorflow 1.15 (2.0 is not supported currently) and [GPT-2-Simple](https://github.com/minimaxir/gpt-2-simple) and feed the trained checkpoint into `src/gpt2/checkpoint/run1`.

## Configuration

Run the bot once to create an empty `settings.json`. 

Alternatively, create it yourself. It should look like the following:

```json
{
    "token": "MISSING_TOKEN",
    "quotes_per_page": 5,
    "admins": [],
    "actions": [],
    "enable_markov_for_clusters": [],
    "enable_gpt2_for_clusters": [],
    "markov_file": "markov.json",
    "python_name": "python3",
    "gpt3_key": "",
    "bot_handle": "my_tg_bot_handle_bot"
}
```

* `"token"`: your Telegram Bot API token
* `"quotes_per_page"`: how many quotes should be displayed per page with `/list`
* `"admins"`: the usernames of the users who should be able to manage the bot *(can use `/stop` a.o.)*
* `"actions"`: contains special configurable actions, see next section
* `"enable_markov_for_clusters"`: list of clusters in which the bot will respond with markov messages when replied to
* `"markov_file"`: the path to the Markov chain file
* `"python_name"`: name or path of the Python interpreter executable (for GPT-2)
* `"gpt3_key"`: the gpt-3 key for the openai-api
* `"bot_handle"`: the bot handle

### Actions

Quote-Bot can react to regexes with messages you configure. To do this, simply add an action to the `actions` array in `settings.json`. It should have one of the following formats:

```json
{
    "match": matchPredicate,  // see Match Predicates section below
    "probability": number, // optional
    "cluster": string, // optional; only run if the chat is in the given cluster
    "group": string, // optional; if given and multiple actions of the same group match, only the first will be executed
    "response": responseString | [responseType, responseValue]  // see Response Types section below
}
```

or

```json
[matchText, probability, responseText]

// shorthand for:
// {
//   "match": {
//     "text": matchText
//   },
//   "probability": probability,
//   "response": ["text", responseText]
// }
```

Example:

```json
"actions": [
    ["im sad", 1, "don't be sad, little one :)"],
    {
        "match": {
            "text": "he[ln]lo\\s+world", 
            "from": {
                "first_name": "^Bill$",
                "last_name": "^(Gates|Clinton)$"
            },
            "date": ["obj >= 1751117820"]
        },
        "probability": 0.5,
        "response": [
            "sticker",
            "1234ab"
        ]
    }
]
```

#### Match Predicates
Match predicates are special values that will be compared to the raw message object delivered by the Telegram API as detailed [here](https://core.telegram.org/bots/api#message). A match predicate object is one of the following:
* a string: matches if the predicate is a regex matching the input object's string representation (case-**in**sensitive). Empty string matches all values
* a number: matches if the predicate is equal to the input object's numeric representation (NaN is equal to NaN, +0 is equal to -0)
* a boolean: matches if the predicate is equal to the input object's truthiness
* `null`: matches if the input object is `null`
* an object with string keys and `matchPredicate` values: matches if the input object is an object or an array and each entry matches the respective match predicate
* a single-element tuple of the form `[string]`: matches if the JavaScript expression evaluates to a truthy value given that the input object is stored in a parameter `obj` (example: `["obj === 1"]` matches if the input object is equal to 1)

#### Response Types

* `["text", message]`: reply with text
* `["sticker", stickerid]`: reply with a sticker
* `["image", imageurl]`: reply with an image from the internet
* `["video", videourl]`: reply with a video from the internet
* `"markov"`: reply with a markov chain message
* `"gpt2"`: reply with a GPT-2 message


## Usage

Run the bot using `npm`:

```shell
$ cd degenquote-bot
$ npm start
```
