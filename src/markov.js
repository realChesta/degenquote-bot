const startSym = '\t';
const endSym = '\n';
const syms = [startSym, endSym];

const stemmer = (...arr) => arr.map(a => !syms.includes(a) ? a.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : a).join(' ');
const sortComparator = (a, b) => a === b ? 0 : a === startSym ? -1 : b === startSym ? 1 : a === endSym ? -1 : b === endSym ? 1 : a.localeCompare(b);

class Markov {
    constructor(entries=[]) {
        this.map = new Map([...entries].map(a => [a[0].sym === 'start' ? startSym : a[0].sym === 'end' ? endSym : a[0], a[1]]));
    }

    addMessage(msg) {
        [...msg.split(/\s/g).filter(a => a), endSym].reduce((c, b) => ([c[1], `${c[0]} ${c[1]}`].forEach((a) => ((this.map.has(a) ? this.map : this.map.set(a, [])).get(a).push(b))), [c[1], stemmer(b)]), [startSym, startSym]);
    }

    generateMessage() {
        if (!this.map.size) return undefined;
        const msg = [];
        for (let sym = startSym, lsym = startSym; sym != endSym; !syms.includes(sym) && msg.push(sym)) sym = [((b, c) => (a => a[Math.floor(Math.random() * a.length)])(Math.random() >= 1 / Math.sqrt(1 + c.length) ? c : b))(this.map.get(stemmer(sym)), this.map.get(stemmer(lsym, sym)) || []), lsym = sym][0];
        return msg.join(' ');
    }

    compress() {
        // lossy
        this.map = new Map([...this.map.entries()].map(a => [a[0], a[1].map(a => [a, Math.random()]).sort((a, b) => a[1] - b[1]).slice(0, 100).filter((a, i) => i <= 4 || Math.random() >= 0).map(a => a[0])]));
        this.map = new Map([...this.map.entries()].filter(a => !a[0].match(/\s/) || a[1].length >= 2));
        const reachable = new Set();
        const stack = [stemmer(startSym), stemmer(startSym, startSym)];
        while (stack.length > 0) {
            const stem = stack.pop();
            if (!this.map.has(stem)) continue;
            if (reachable.has(stem)) continue;
            reachable.add(stem);
            const gotten = this.map.get(stem) || [];
            stack.push(...gotten.map(a => stemmer(a)));
            stack.push(...gotten.map(a => stemmer(stem, a)));
        }
        this.map = new Map([...this.map.entries()].filter(a => reachable.has(a[0])));
    }

    getEntries() {
        // sort so there is less information to reconstruct the chat from in the possibly exported object
        return [...this.map.entries()].sort((a, b) => sortComparator(a[0], b[0])).map(a => [a[0], a[1].sort(sortComparator)]).map(a => a.map(b => b === startSym ? {sym: 'start'} : b === endSym ? {sym: 'end'} : b));
    }
}

if (require.main === module) {
    if (process.argv.length > 3) {
        console.error(`Usage: npm run markov [-- path]`);
        console.error(process.argv);
    } else if (process.argv.length === 3) {
        const resp = process.argv[2];
        const fs = require('fs');
        const path = require('path');
        if (!fs.existsSync(resp) || !fs.statSync(resp).isDirectory()) throw new Error('Path not a directory: ' + resp);
        const markov = new Markov();
        console.error(`Reading message files... This might take a while.`);
        for (let i = 1;; i++) {
            const p = path.resolve(resp, `messages${i === 1 ? '' : i}.html`);
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
            [...html.matchAll(/\<div class\=\"text\"\>(.*?)\<\/div\>/sg)].forEach(a => markov.addMessage(getMsg(a[1])));
            if ((i & (i-1)) === 0) console.error(`Read ${i} message files`);
        }
        console.error('Compressing...');
        markov.compress();
        console.error('Getting entries...');
        const entries = markov.getEntries();
        console.error('Number of terms:', entries.length);
        console.error('Number of terms with only one follow-up:', entries.filter(a => a[1].length <= 1).length);
        console.error('Some example messages:');
        for (let i = 0; i < 10; i++) console.error('  ' + markov.generateMessage());
        console.log(JSON.stringify(entries));
    } else {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stderr
        });

        const markov = new Markov();
        rl.on('line', (input) => {
            if (input) markov.addMessage(input);
            console.log(markov.map);
            console.error(markov.generateMessage());
        });
        console.error('Type a few sentences!');
    }
}


module.exports = Markov;
