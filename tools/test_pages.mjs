import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base='https://jnuso.github.io/example-repo/';
test('all site pages and app data use paths that remain inside a GitHub Pages project',()=>{
  for(const page of ['index.html','families.html','metal.html','ions.html']) {
    const source=readFileSync(new URL('../dist/'+page,import.meta.url),'utf8');
    for(const m of source.matchAll(/(?:href|src)="(\.\/[^"#]*)"/g)) assert.ok(new URL(m[1],base+page).href.startsWith(base));
    assert.doesNotMatch(source,/(?:href|src)="\/(?!\/)/);
  }
  for(const file of ['app.mjs','family-app.mjs','metal.html']) {
    const source=readFileSync(new URL('../dist/'+file,import.meta.url),'utf8');
    assert.match(source,/fetch\('\.\/data\/elements\.json'\)/);
    assert.equal(new URL('./data/elements.json',base+file).href,base+'data/elements.json');
  }
  const metal=readFileSync(new URL('../dist/metal.html',import.meta.url),'utf8');
  assert.match(metal,/from '\.\/family-engine\.mjs'/);
});
