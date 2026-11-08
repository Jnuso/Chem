import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FamilyEngine} from '../dist/family-engine.mjs';
const data=JSON.parse(readFileSync(new URL('../dist/data/elements.json',import.meta.url),'utf8'));
const expected=(g,q=g.active().current)=>g.byNumber.get(q.number).category;
function answer(g,right=true){const q=g.active().current;g.answer(right?expected(g):q.options.find(c=>c!==expected(g)));g.continue();}
function finish(g,right=true){while(!g.completed())answer(g,right);}

test('batches cover all 118 elements in 50, 50, 18, with exactly three spaced appearances each',()=>{
  let g=new FamilyEngine(data);const all=[];
  for(const size of [50,50,18]) {
    assert.ok(g.start('all'));const b=g.active();assert.equal(b.numbers.length,size);assert.equal(b.queue.length,size*3);all.push(...b.numbers);
    const appearances=new Map();let previous=0;
    while(!g.completed()) {
      const q=g.active().current;assert.notEqual(q.number,previous);previous=q.number;
      appearances.set(q.number,(appearances.get(q.number)??0)+1);
      assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(q.options.includes(expected(g)));
      g.answer(expected(g));g=new FamilyEngine(data,g.snapshot());assert.ok(g.active().feedback);
      assert.equal(g.answer(expected(g)),false);g.continue();g=new FamilyEngine(data,g.snapshot());
    }
    assert.equal(appearances.size,size);assert.ok([...appearances.values()].every(n=>n===3));
  }
  assert.equal(new Set(all).size,118);assert.deepEqual(g.totals(),{correct:354,wrong:0,answers:354,accuracy:100,missed:0});
  assert.ok(Object.values(g.state.progress).every(p=>p.correct===3));g.start();assert.equal(g.active().numbers.length,50);
  assert.equal(g.state.decks.all.cursor,50);assert.equal(g.totals().answers,354);
});

test('wrong answers never extend a batch or require streaks; their lifetime totals accumulate',()=>{
  const g=new FamilyEngine(data);g.start();const first=[...g.active().numbers];finish(g,false);
  assert.equal(g.active().wrong,150);assert.equal(g.totals().wrong,150);assert.equal(g.totals().missed,50);
  first.forEach(n=>assert.deepEqual([g.state.progress[n].correct,g.state.progress[n].wrong],[0,3]));
  g.start('missed');assert.deepEqual(new Set(g.active().numbers),new Set(first));finish(g);
  first.forEach(n=>assert.deepEqual([g.state.progress[n].correct,g.state.progress[n].wrong],[3,3]));
  assert.equal(g.totals().accuracy,50);assert.equal(g.totals().missed,50,'Historical misses stay available for targeted practice');
});

test('Study missed is empty initially, ranks persistent mistakes, and covers every missed element across batches',()=>{
  const g=new FamilyEngine(data),empty=g.snapshot();assert.equal(g.start('missed'),false);assert.deepEqual(g.snapshot(),empty);
  for(let i=0;i<3;i++){g.start();finish(g,false);}
  assert.equal(g.missedNumbers().length,118);
  const studied=[];for(const size of [50,50,18]){g.start('missed');assert.equal(g.active().numbers.length,size);studied.push(...g.active().numbers);finish(g);}
  assert.equal(new Set(studied).size,118);
  const weak=studied[0];g.start('all');
  while(!g.completed()){const q=g.active().current;answer(g,q.number!==weak);}
  const ordered=g.missedNumbers();
  for(let i=1;i<ordered.length;i++)assert.ok(g.state.progress[ordered[i-1]].wrong>=g.state.progress[ordered[i]].wrong);
});

test('normal and missed sessions pause independently with their exact choices and feedback',()=>{
  let g=new FamilyEngine(data);g.start();g.answer(g.active().current.options.find(c=>c!==expected(g)));
  const normal=JSON.stringify(g.state.sessions.all);assert.ok(g.start('missed'));const missed=JSON.stringify(g.state.sessions.missed);
  g.start('all');assert.equal(JSON.stringify(g.active()),normal);g=new FamilyEngine(data,g.snapshot());
  assert.equal(JSON.stringify(g.active()),normal);g.start('missed');assert.equal(JSON.stringify(g.active()),missed);
  finish(g);assert.equal(g.active().numbers.length,1);assert.equal(g.active().queue.length,3);
  g.start('all');assert.equal(JSON.stringify(g.active()),normal);
});

test('refresh and stale actions cannot grade or continue a question twice, including the final question',()=>{
  let g=new FamilyEngine(data);g.start();const initial=g.snapshot();g=new FamilyEngine(data,initial);assert.deepEqual(g.snapshot(),initial);
  const old=g.active().current.id;assert.throws(()=>g.answer('not-a-family'));assert.equal(g.state.answerCount,0);
  g.answer(expected(g),old);const answered=g.snapshot();g=new FamilyEngine(data,answered);assert.deepEqual(g.snapshot(),answered);
  assert.equal(g.answer(expected(g),old),false);g.continue(old);const next=g.snapshot();assert.equal(g.continue(old),false);
  assert.equal(g.answer(expected(g),old),false);assert.deepEqual(g.snapshot(),next);
  while(g.active().position<g.active().queue.length-1)answer(g);
  g.answer(expected(g));g=new FamilyEngine(data,g.snapshot());assert.equal(g.completed(),false);assert.ok(g.active().feedback);
  g.start('all');assert.ok(g.active().feedback);g.continue();assert.equal(g.completed(),true);assert.equal(g.active().current,null);
});

test('studying colors and other elements preserves both learning sessions and all running totals',()=>{
  const g=new FamilyEngine(data);g.start();const before=g.snapshot();g.showStudy();g.toggleColors();g.inspect(56);
  assert.deepEqual(g.state.sessions,before.sessions);assert.deepEqual(g.state.progress,before.progress);assert.equal(g.state.answerCount,0);
  const restored=new FamilyEngine(data,g.snapshot());assert.equal(restored.state.view,'study');assert.equal(restored.state.colors,true);
  restored.showPlay();assert.deepEqual(restored.active(),before.sessions.all);assert.throws(()=>restored.inspect(119));
});

test('every family has valid distractors, including similar alkali and alkaline-earth options',()=>{
  const g=new FamilyEngine(data);const seen=new Set();
  for(let batch=0;batch<3;batch++) {
    g.start();while(!g.completed()) {
      const q=g.active().current,c=expected(g);seen.add(c);
      if(c==='alkali-metal')assert.ok(q.options.includes('alkaline-earth-metal'));
      if(c==='alkaline-earth-metal')assert.ok(q.options.includes('alkali-metal'));
      assert.ok(q.options.every(id=>data.categories.some(c=>c.id===id)));answer(g);
    }
  }
  assert.deepEqual(seen,new Set(data.categories.map(c=>c.id)));
});

test('invalid stored totals, decks, duplicated pass elements, feedback and unsupported versions are rejected',()=>{
  const g=new FamilyEngine(data);g.start();
  const invalid=change=>{const s=g.snapshot();change(s);assert.throws(()=>new FamilyEngine(data,s));};
  invalid(s=>s.version=2);invalid(s=>s.answerCount=1);invalid(s=>s.progress[1].wrong=-1);
  invalid(s=>s.decks.all.numbers[0]=s.decks.all.numbers[1]);invalid(s=>s.sessions.all.queue[0]=s.sessions.all.queue[1]);
  invalid(s=>s.sessions.all.current.options[0]='unknown');invalid(s=>s.sessions.all.feedback={correct:true});invalid(s=>s.colors='yes');
});
