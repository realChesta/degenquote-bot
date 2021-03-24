const {spawn} = require('child_process');
const process = require('process');

class GPT2 {
    constructor(pythonName) {
        this.pythonName = pythonName;
        this.isRunning = false;
        this.recentMessages = new Map();
    }

    registerMessage(msg) {
        const text = msg.text;
        if (!text) return;

        const arr = [...(this.recentMessages.get(msg.chat.id) || []), text];
        while (arr.length > 20) {
            arr.shift();
        }
        this.recentMessages.set(msg.chat.id, arr);
    }

    async generateMessage(msg) {
        if (this.isRunning) {
            return null;
        }

        return await new Promise((resolve, reject) => {
            const msgs = this.recentMessages.get(msg.chat.id) || [];
            if (msgs[msgs.length - 1] !== msg.text) msgs.push(msg.text);
            const text = msgs.join('\n\n');

            console.log('Launching a GPT-2 instance...');
            this.isRunning = true;

            let res = '';
            const proc = spawn(this.pythonName, ['generate.py', text], {cwd: 'src/gpt2'});

            proc.stdout.on('data', (data) => {
                res += data;
            });

            proc.stderr.on('data', (data) => {
                process.stderr.write(data);
            });

            proc.on('close', (code) => {
                console.log(`A GPT-2 instance exited with exit code: ${code}`);
                this.isRunning = false;
    
                resolve(res.split('==== delimiter ====\n')[1] || 'no clue lol');
            });
        });
    }
}

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
}

module.exports = {
    GPT2
};
