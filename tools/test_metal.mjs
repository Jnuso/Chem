import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FamilyEngine} from '../dist/family-engine.mjs';
const source=JSON.parse(readFileSync(new URL('../dist/data/elements.json',import.meta.url)));
const nonmetals=new Set(['nonmetal','halogen','noble-gas']);
const data={elements:source.elements.filter(e=>e.category!=='metalloid').map(e=>({...e,category:nonmetals.has(e.category)?'nonmetal':'metal'})),categories:[{id:'metal'},{id:'nonmetal'}]};
test('binary classification covers the bundled nonmetals and metals and omits metalloids',()=>{
  for(const e of data.elements){const original=source.elements.find(x=>x.number===e.number);assert.equal(e.category,nonmetals.has(original.category)?'nonmetal':'metal');}
  assert.equal(data.elements.length+source.elements.filter(e=>e.category==='metalloid').length,118);
});
test('binary batches save and restore questions and independent mistake totals',()=>{
  let game=new FamilyEngine(data);game.start();const q=game.active().current;assert.deepEqual(new Set(q.options),new Set(['metal','nonmetal']));
  const expected=game.byNumber.get(q.number).category;game.answer(expected==='metal'?'nonmetal':'metal',q.id);
  const saved=game.snapshot();game=new FamilyEngine(data,saved);assert.deepEqual(game.snapshot(),saved);assert.equal(game.answer(expected,q.id),false);
  game.start('missed');assert.deepEqual(game.active().numbers,[q.number]);assert.equal(game.totals().wrong,1);
  game.start('all');assert.ok(game.active().feedback);game.continue();
  while(!game.completed()){const current=game.active().current;game.answer(game.byNumber.get(current.number).category);game.continue();}
  assert.equal(game.totals().answers,150);assert.equal(game.totals().wrong,1);
});
