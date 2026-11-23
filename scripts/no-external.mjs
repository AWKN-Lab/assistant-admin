import { readFileSync, readdirSync } from 'node:fs';
const files=['dist/index.html',...readdirSync('dist/assets').filter(n=>n.endsWith('.css')).map(n=>'dist/assets/'+n)];
for(const file of files){const s=readFileSync(file,'utf8');if(/(?:<script|<link)[^>]+(?:src|href)=["']https?:\/\//i.test(s)||/@import\s+(?:url\()?\s*["']?https?:\/\//i.test(s))throw new Error('External runtime URL in '+file)}
console.log('PASS no external JS/CSS loading URLs in built HTML and CSS');
