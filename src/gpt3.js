const {spawn} = require('child_process');
const process = require('process');

class GPT3 {
    constructor(pythonName, gpt3key, gpt3engine) {
        this.pythonName = pythonName;
        this.gpt3key = gpt3key;
        this.gpt3engine = gpt3engine;
        this.isRunning = false;
        this.recentMessages = new Map();
    }

    registerMessage(text, chatId, userDisplay) {
        if (!chatId) {
            chatId = text.chat.id;
            userDisplay = text.from.first_name || text.from.username;
            text = text.text;
        }
        if (!text) return;

        const startingPrompts = [
            "Mark: Hey QBot, how are you doing?",
            "QBot Ashcraft: I'm doing pretty well, thanks for asking!",
            "Mark: you're welcome"
        ];

        const txt = userDisplay + ": " + text.replace("\n", " \\n ");
        let arr = [...(this.recentMessages.get(chatId) || startingPrompts)]
        if (arr[arr.length - 1] !== txt) {
            arr.push(txt);
        }

        while (arr.length > 10) {
            arr.shift();
        }

        if (text.includes("reset please")) {
            arr = startingPrompts;
        }

        this.recentMessages.set(chatId, arr);
    }

    async generateMessage(msg) {
        this.registerMessage(msg);

        if (this.isRunning) {
            return null;
        }

        return await new Promise((resolve, reject) => {
            const msgs = this.recentMessages.get(msg.chat.id) || [];
            const text = msgs.join('\n').replace(/\@[a-zA-Z]+/g, "") + "\nQBot Ashcraft: ";

            console.log('Launching a GPT-3 instance...');
            this.isRunning = true;

            let res = '';
			const proc = spawn(this.pythonName, ['generate_gpt3.py', text, this.gpt3key, this.gpt3engine], {cwd: 'src/gpt3'});

            proc.stdout.on('data', (data) => {
                res += data;
            });

            proc.stderr.on('data', (data) => {
                process.stderr.write(data);
            });

            proc.on('close', (code) => {
                console.log(`A GPT-3 instance exited with exit code: ${code}`);
                this.isRunning = false;
    
                resolve(res.split('==== delimiter ====\n')[1].replace("\\n", "\n").trim() || 'no clue lol');
            });
        });
    }
}

/*
if (require.main === module) {
  if (process.argv.length !== 4) {
      console.error(`Usage: npm run gpt2 [-- inPath outPath]`);
      console.error(process.argv);
  } else if (process.argv.length === 4) {
      const inp = process.argv[2];
      const outp = process.argv[3];
      const fs = require('fs');
      const path = require('path');
      if (!fs.existsSync(inp) || !fs.statSync(inp).isDirectory()) throw new Error('Path not a directory: ' + inp);
      let res = "";
      console.error(`Reading message files... This might take a while.`);
      for (let i = 1;; i++) {
          const p = path.resolve(inp, `messages${i === 1 ? '' : i}.html`);
          if (!fs.existsSync(p)) {
              console.error(`Reading is done! (File ${p} does not exist - this is not an error)`);
              break;
          }
          const html = fs.readFileSync(p, 'utf8');
          function getMsg(h) {
              let lh;
              do {
                  lh = h;
                  h = h.replace(/<[^>]*>/gs, "");
              } while (h !== lh);
              return h.trim().replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&#039;/g, "'").replace(/&amp;/g, "&");
          }
          [...html.matchAll(/\<div class\=\"text\"\>(.*?)\<\/div\>/sg)].forEach(a => res += getMsg(a[1]) + "\n\n");
          if ((i & (i-1)) === 0) console.error(`Read ${i} message files`);
      }
      console.error('Storing to disk...');
      fs.writeFileSync(outp, res);
      console.error('Done!');
  }
}*/

module.exports = {
    GPT3
};
