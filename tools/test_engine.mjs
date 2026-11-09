import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LearningEngine, DIRECTIONS, gradeAnswer, buildGroups} from '../dist/engine.mjs';

const data = JSON.parse(readFileSync(new URL('../dist/data/elements.json', import.meta.url)));
const number = symbol => data.elements.find(e => e.symbol === symbol).number;
const element = n => data.elements.find(e => e.number === n);
const correct = (engine, q = engine.nextQuestion()) => q.type === 'choice' ? q.number : q.direction === DIRECTIONS[0] ? element(q.number).name : element(q.number).symbol;
function advance(engine, answer) {engine.answer(answer ?? correct(engine)); engine.continue();}
function learnScope(engine, limit = 1500) {
  let iterations = 0;
  while (engine.summary().learned !== engine.state.scope.length && iterations++ < limit) advance(engine);
  assert.ok(iterations < limit, 'The selected scope must reach Learned without stalling');
}

test('dataset: all 118 names, symbols, categories and table cells are unique and complete', () => {
  assert.equal(data.elements.length, 118);
  assert.deepEqual(data.elements.map(e => e.number), Array.from({length:118}, (_,i) => i+1));
  for(const field of ['name','symbol']) assert.equal(new Set(data.elements.map(e => e[field])).size, 118);
  assert.equal(data.categories.length, 10);
  assert.deepEqual(new Set(data.elements.map(e => e.category)), new Set(data.categories.map(c => c.id)));
  assert.equal(new Set(data.elements.map(e => `${e.row}:${e.column}`)).size, 118);
  for(const e of data.elements) {
    assert.match(e.symbol, /^[A-Z][a-z]?$/);
    assert.ok(e.name && e.column >= 1 && e.column <= 18);
    assert.ok(e.row >= 2 && e.row <= 11 && e.row !== 9);
    assert.ok(e.atomicMass && Number(e.atomicMass)>0);
    assert.equal(typeof e.isotopeMass,'boolean');
  }
  const rows = [[1,2], [3,10], [11,18], [19,36], [37,54], [55,86], [87,118]];
  rows.forEach(([start,end],i) => {
    data.elements.filter(e => e.number >= start && e.number <= end).forEach(e => assert.equal(e.period, i+1));
  });
  const main = [[2,[1,2]],[3,[3,4,5,6,7,8,9,10]],[4,[11,12,13,14,15,16,17,18]],
    [5,Array.from({length:18},(_,i)=>i+19)],[6,Array.from({length:18},(_,i)=>i+37)],
    [7,[55,56,...Array.from({length:15},(_,i)=>i+72)]],[8,[87,88,...Array.from({length:15},(_,i)=>i+104)]]];
  main.forEach(([row,numbers]) => assert.deepEqual(data.elements.filter(e=>e.row===row).sort((a,b)=>a.column-b.column).map(e=>e.number),numbers));
  assert.equal(element(1).column,1); assert.equal(element(2).column,18);
  assert.equal(element(5).column,13); assert.equal(element(13).column,13);
  assert.equal(element(72).column,4); assert.equal(element(104).column,4);
  assert.deepEqual(data.elements.filter(e=>e.row===10).map(e=>e.number),Array.from({length:15},(_,i)=>i+57));
  assert.deepEqual(data.elements.filter(e=>e.row===11).map(e=>e.number),Array.from({length:15},(_,i)=>i+89));
  assert.equal(element(85).category,'halogen'); assert.equal(element(118).name,'Oganesson');
});
test('confusion groups cover each element exactly once and begin with the agreed group', () => {
  assert.deepEqual(data.groups[0].numbers.slice(0,5).map(n=>element(n).symbol),['Ag','Ar','As','At','Au']);
  assert.equal(data.groups.length,12);
  assert.equal(new Set(data.groups.flatMap(g=>g.numbers)).size,118);
  assert.equal(data.groups.flatMap(g=>g.numbers).length,118);
  assert.ok(data.groups.every((g,i)=>g.numbers.length===(i===11?8:10)));
  assert.deepEqual(buildGroups(data.elements),data.groups);
  assert.ok(data.groups.some(g=>g.numbers.includes(number('Be'))&&g.numbers.includes(number('Bk'))), 'Beryllium and Berkelium share a name prefix');
  assert.ok(data.groups.some(g=>g.numbers.includes(number('H'))&&g.numbers.includes(number('He'))), 'Hydrogen and Helium share a symbol initial');
});
test('grading: every name and symbol accepts the exact answer', () => {
  data.elements.forEach(e => {
    assert.ok(gradeAnswer(data.elements,e.number,DIRECTIONS[0],e.name).correct);
    assert.ok(gradeAnswer(data.elements,e.number,DIRECTIONS[0],`  ${e.name.toUpperCase()}  `).correct);
    assert.ok(gradeAnswer(data.elements,e.number,DIRECTIONS[1],e.symbol).correct);
    assert.equal(gradeAnswer(data.elements,e.number,DIRECTIONS[1],e.symbol.toLowerCase()).correct,false);
  });
});
test('grading: spelling variants, conservative typos, transpositions and wrong capitalization', () => {
  for(const [s,alias] of [['Al','aluminium'],['Cs','caesium'],['S','sulphur']]) assert.equal(gradeAnswer(data.elements,number(s),DIRECTIONS[0],alias).kind,'alias');
  assert.equal(gradeAnswer(data.elements,number('As'),DIRECTIONS[0],'Arsneic').kind,'typo');
  assert.ok(gradeAnswer(data.elements,number('H'),DIRECTIONS[0],'Hydrogenn').correct);
  assert.equal(gradeAnswer(data.elements,number('H'),DIRECTIONS[0],'Hidrogne').correct,false);
  assert.equal(gradeAnswer(data.elements,number('Co'),DIRECTIONS[1],'CO').kind,'capitalization');
  assert.equal(gradeAnswer(data.elements,number('Co'),DIRECTIONS[1],' co ').correct,false);
});
test('grading: another element name and ambiguous typos never count as correct', () => {
  assert.equal(gradeAnswer(data.elements,number('Ra'),DIRECTIONS[0],'Radon').correct,false);
  assert.equal(gradeAnswer(data.elements,number('Ce'),DIRECTIONS[0],'erium').correct,false);
  assert.equal(gradeAnswer(data.elements,number('Er'),DIRECTIONS[0],'erium').correct,false);
  assert.equal(gradeAnswer(data.elements,number('Cl'),DIRECTIONS[0],'Chromium').correct,false);
});
test('ten-element group: one MC per element, then two shuffled typing passes before reversing', () => {
  const e = new LearningEngine(data);
  const passes = [[],[],[]];
  let previous = null;
  for(let i=0;i<30;i++) {
    const q=e.nextQuestion();
    assert.equal(q.direction,DIRECTIONS[0]); assert.equal(q.review,false);
    assert.equal(q.type,i<10?'choice':'typed');
    assert.notEqual(q.number,previous); previous=q.number;
    passes[Math.floor(i/10)].push(q.number);
    if(q.type==='choice') {assert.equal(q.options.length,4); assert.equal(new Set(q.options).size,4); assert.ok(q.options.every(n=>data.groups[0].numbers.includes(n)));}
    advance(e);
  }
  passes.forEach(pass=>assert.deepEqual([...pass].sort((a,b)=>a-b),[...data.groups[0].numbers].sort((a,b)=>a-b)));
  assert.notDeepEqual(passes[0],passes[1]); assert.notDeepEqual(passes[1],passes[2]);
  assert.equal(e.state.phase,DIRECTIONS[1]);
  assert.equal(e.state.current.direction,DIRECTIONS[1]);
  assert.equal(e.summary().learned,0);
  let cards=0,questions=0;
  while(cards<30 && questions++<50) {if(e.nextQuestion().roundCard)cards++;else assert.ok(e.state.current.review);advance(e);}
  assert.equal(cards,30);
  assert.equal(e.summary().learned,10);
  assert.equal(e.state.activeGroupId,data.groups[1].id);
  assert.equal(e.state.phase,DIRECTIONS[0]);
});
test('missed elements are retried among all ten peers, including when only one remains difficult', () => {
  const e=new LearningEngine(data), weak=number('As');
  for(let i=0;i<10;i++) {const q=e.nextQuestion();advance(e,q.number===weak?q.options.find(n=>n!==weak):correct(e,q));}
  assert.equal(e.state.current.type,'typed');
  assert.equal(e.state.progress[weak].directions[DIRECTIONS[0]].recognized,false);
  for(let pass=0;pass<3;pass++) {
    const asked=[];
    for(let i=0;i<10;i++) {const q=e.nextQuestion();assert.equal(q.type,'typed');asked.push(q.number);advance(e,pass===0&&q.number===weak?'wrong':correct(e,q));}
    assert.equal(new Set(asked).size,10);
    if(pass<2) assert.equal(e.state.phase,DIRECTIONS[0]);
  }
  assert.equal(e.state.progress[weak].directions[DIRECTIONS[0]].streak,2);
  assert.equal(e.state.phase,DIRECTIONS[1]);
});
test('duplicate answers, invalid choices and empty typing cannot advance the counter', () => {
  const e=new LearningEngine(data); e.setFocus([number('As')]);
  const q=e.nextQuestion(); assert.throws(()=>e.answer(999)); assert.equal(e.state.answerCount,0);
  assert.equal(e.answer(correct(e,q)),true); assert.equal(e.answer(correct(e,q)),false); assert.equal(e.state.answerCount,1);
  e.continue(); assert.throws(()=>e.answer('   ')); assert.equal(e.state.answerCount,1);
});
test('save recovery preserves an unanswered question, choices, draft and an answered feedback state', () => {
  let e=new LearningEngine(data); e.state.view='learn'; e.nextQuestion();
  let saved=e.snapshot(), restored=new LearningEngine(data,JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(restored.snapshot(),saved); assert.deepEqual(restored.nextQuestion(),saved.current);
  e.answer(correct(e)); saved=e.snapshot(); restored=new LearningEngine(data,saved);
  assert.deepEqual(restored.snapshot(),saved); assert.equal(restored.answer(correct(restored)),false);
  assert.equal(restored.state.answerCount,1);
  e.setFocus([number('As')]); e.nextQuestion(); e.answer(correct(e)); e.continue(); e.state.draft='Arse';
  saved=e.snapshot(); restored=new LearningEngine(data,saved); assert.equal(restored.state.draft,'Arse'); assert.deepEqual(restored.snapshot(),saved);
});
test('save recovery does not change the phase until Continue after the final answer', () => {
  const e=new LearningEngine(data); e.setFocus([number('As')]);
  advance(e); advance(e); e.answer(correct(e));
  assert.equal(e.state.phase,DIRECTIONS[0]);
  const restored=new LearningEngine(data,e.snapshot());
  assert.equal(restored.state.phase,DIRECTIONS[0]); restored.continue(); assert.equal(restored.state.phase,DIRECTIONS[1]);
});
test('corrupt saves and unsupported versions are rejected without silently trusting them', () => {
  const e=new LearningEngine(data); const saved=e.snapshot();
  assert.throws(()=>new LearningEngine(data,{...saved,version:4}));
  assert.throws(()=>new LearningEngine(data,{...saved,scope:[]}));
  assert.throws(()=>new LearningEngine(data,{...saved,answerCount:-1}));
  assert.throws(()=>new LearningEngine(data,{...saved,editingSet:'yes'}));
  assert.throws(()=>new LearningEngine(data,{...saved,deferred:[1,1]}));
  const badHold=e.snapshot();badHold.progress[1].reviewHoldUntil=-1;assert.throws(()=>new LearningEngine(data,badHold));
  const broken=e.snapshot(); broken.progress[1].directions[DIRECTIONS[0]].streak=9; assert.throws(()=>new LearningEngine(data,broken));
  const badQuestion=e.snapshot(); badQuestion.current={id:'q-0',number:1,direction:DIRECTIONS[0],review:false,type:'choice',options:[1,1,1,1]}; assert.throws(()=>new LearningEngine(data,badQuestion));
});
test('focused practice is still resumable and global progress survives selection changes', () => {
  const e=new LearningEngine(data); e.setFocus([number('As')]); learnScope(e);
  const p=JSON.stringify(e.state.progress[number('As')]), counter=e.state.answerCount;
  e.setFocus([number('Cl'),number('Cr')]); assert.equal(e.state.answerCount,counter);
  assert.equal(JSON.stringify(e.state.progress[number('As')]),p); assert.equal(e.status(number('As')),'learned');
  const before=e.snapshot(); assert.throws(()=>e.setFocus([])); assert.throws(()=>e.setFocus([0])); assert.throws(()=>e.setFocus([1,1])); assert.deepEqual(e.snapshot(),before);
  e.nextQuestion(); const same=e.snapshot(); e.setFocus([...e.state.scope].reverse()); assert.deepEqual(e.snapshot(),same);
});
test('retention: first review is scheduled after 10 answers and increases through 30, 60, 120', () => {
  const e=new LearningEngine(data); e.setFocus([number('As')]); learnScope(e);
  const p=e.state.progress[number('As')]; assert.equal(p.due-p.learnedAt,10);
  for(const interval of [30,60,120,120]) {
    p.due=e.state.answerCount;e.state.current=null;e.state.feedback=null;
    const q=e.nextQuestion(); const previousDirection=q.direction;
    assert.ok(q.review); assert.equal(q.type,'typed'); e.answer(correct(e,q));
    assert.equal(p.due-e.state.answerCount,interval); assert.notEqual(p.reviewDirection,previousDirection); e.continue();
  }
});
test('retention: new learning receives earliest overdue checks after four learning questions', () => {
  const e=new LearningEngine(data); e.setFocus(data.groups[0].numbers); learnScope(e);
  e.setFocus(data.elements.map(e=>e.number));
  const p=e.state.progress[number('Ag')]; p.due=e.state.answerCount; e.state.learningSinceReview=4;
  const q=e.nextQuestion(); assert.ok(q.review); assert.equal(q.number,number('Ag'));
  advance(e); assert.equal(e.state.learningSinceReview,0); assert.equal(e.state.current.review,false);
});
test('failed retention checks require two typed recalls and preserve the other direction', () => {
  const e=new LearningEngine(data); e.setFocus([number('As')]); learnScope(e);
  const q=e.nextQuestion(), p=e.state.progress[number('As')];
  e.answer('wrong'); assert.equal(e.status(number('As')),'needs-review'); assert.equal(p.directions[q.direction].streak,0);
  assert.equal(p.directions[DIRECTIONS.find(d=>d!==q.direction)].streak,2);
  assert.equal(p.due-e.state.answerCount,3); e.continue();
  advance(e); assert.equal(e.status(number('As')),'needs-review');
  e.answer(correct(e)); assert.equal(e.status(number('As')),'learned'); assert.equal(p.due-e.state.answerCount,10);
});
test('all 118: continuous successful practice reaches Learned and survives restore after every question', () => {
  let e=new LearningEngine(data), count=0, reviews=0, reverse=0;
  while(e.summary().learned<118 && count++<2500) {
    const q=e.nextQuestion(); if(q.review) reviews++; if(q.direction===DIRECTIONS[1]) reverse++;
    e.answer(correct(e,q)); e=new LearningEngine(data,e.snapshot());
    assert.ok(e.state.feedback); assert.equal(e.answer(correct(e)),false); e.continue();
    e=new LearningEngine(data,e.snapshot());
  }
  assert.equal(e.summary().learned,118); assert.ok(count<2500); assert.ok(reviews>0); assert.ok(reverse>0);
  assert.equal(e.state.activeGroupId,null); assert.equal(e.state.current.review,true);
});
test('legacy saves migrate to all 118 without erasing progress, pending feedback, or typed drafts', () => {
  const e=new LearningEngine(data);e.setFocus([number('As')]);learnScope(e);
  e.setFocus([number('Cl')]);e.nextQuestion();e.answer(correct(e));
  const legacy=e.snapshot();legacy.version=1;legacy.selected=[];legacy.activeGroupId='group-08';
  delete legacy.round;delete legacy.roundSerial;delete legacy.lastQuestionNumber;delete legacy.current.roundCard;
  const migrated=new LearningEngine(data,legacy);
  assert.equal(migrated.state.version,3);assert.equal(migrated.state.scope.length,118);assert.equal(migrated.state.selected.length,118);
  assert.deepEqual(migrated.state.progress,legacy.progress);assert.deepEqual(migrated.state.feedback,legacy.feedback);
  assert.equal(migrated.state.current.id,legacy.current.id);assert.equal(migrated.answer(correct(migrated)),false);
  assert.equal(migrated.state.answerCount,legacy.answerCount);migrated.continue();
  assert.equal(migrated.state.round.numbers.length,10);
  const draft=e.snapshot();draft.version=1;draft.activeGroupId='group-08';draft.current=null;draft.feedback=null;draft.draft='Chlo';
  delete draft.round;delete draft.roundSerial;delete draft.lastQuestionNumber;
  assert.equal(new LearningEngine(data,draft).state.draft,'Chlo');
});
test('a failed retained element inside a typing pass repairs the missed direction without corrupting the pass', () => {
  const e=new LearningEngine(data);const n=data.groups[0].numbers[0];e.setFocus([n]);learnScope(e);
  const review=e.nextQuestion();e.answer('wrong');e.continue();
  const repair=review.direction;
  // Rejoin the full group; the previously learned member now needs a refresher.
  e.setFocus(data.groups[0].numbers);
  let seen=false;
  for(let i=0;i<150;i++) {
    const q=e.nextQuestion();
    if(q.roundCard&&q.number===n){seen=true;assert.equal(q.direction,repair);}
    e.answer(correct(e,q));new LearningEngine(data,e.snapshot());e.continue();
    if(seen&&e.status(n)==='learned')break;
  }
  assert.ok(seen);assert.equal(e.status(n),'learned');
});

test('postponed elements wait behind all other unlearned elements and return with progress intact', () => {
  let e=new LearningEngine(data);e.setFocus([...data.groups[0].numbers,...data.groups[1].numbers.slice(0,2)]);
  const q=e.nextQuestion(),before=e.snapshot(),later=q.number;
  assert.ok(e.postponeCurrent(q.id));assert.notEqual(e.state.current.number,later);
  assert.equal(e.state.answerCount,0);assert.deepEqual(e.state.progress,before.progress);assert.deepEqual(e.state.deferred,[later]);
  assert.equal(e.postponeCurrent(q.id),false,'A stale click must not postpone a second element');
  let steps=0;
  while(e.state.scope.some(n=>n!==later&&e.status(n)!=='learned') && steps++<200) {
    assert.notEqual(e.nextQuestion().number,later);advance(e);e=new LearningEngine(data,e.snapshot());
  }
  assert.ok(steps<200);assert.equal(e.status(later),'unseen');
  learnScope(e);assert.equal(e.summary().learned,12);assert.deepEqual(e.state.deferred,[]);
});

test('postponing a typed card keeps its streak, and bringing it back preserves the current question', () => {
  let e=new LearningEngine(data);e.setFocus(data.groups[0].numbers);
  for(let i=0;i<20;i++)advance(e);
  const q=e.nextQuestion();assert.equal(q.type,'typed');assert.equal(e.state.progress[q.number].directions[q.direction].streak,1);
  e.state.draft='partial';const before=e.snapshot();e.postponeCurrent();
  assert.equal(e.state.draft,'');assert.equal(e.state.answerCount,20);assert.deepEqual(e.state.progress,before.progress);
  e=new LearningEngine(data,e.snapshot());assert.deepEqual(e.state.deferred,[q.number]);
  const current=e.state.current.id;assert.ok(e.restorePostponed());assert.equal(e.state.current.id,current);
  assert.equal(e.state.current.roundCard,false);assert.deepEqual(e.state.deferred,[]);new LearningEngine(data,e.snapshot());
  assert.deepEqual(e.state.progress,before.progress);learnScope(e);assert.equal(e.summary().learned,10);
});

test('postponing every selected element and changing focused sets never loses or strands a card', () => {
  let e=new LearningEngine(data);e.setFocus([33,85,17,24]);
  const seen=[];
  for(let i=0;i<4;i++) {const q=e.nextQuestion();seen.push(q.number);assert.ok(e.postponeCurrent());assert.notEqual(e.state.current.number,q.number);e=new LearningEngine(data,e.snapshot());}
  assert.equal(new Set(seen).size,4);assert.equal(e.state.answerCount,0);assert.equal(e.state.deferred.length,4);
  e.setFocus([33,17]);const before=[...e.state.deferred];e.nextQuestion();
  e.setFocus([33,85,17,24]);assert.deepEqual(e.state.deferred,before);learnScope(e);assert.equal(e.summary().learned,4);
  e.setFocus([33]);e.nextQuestion();assert.equal(e.canPostpone(),false);assert.equal(e.postponeCurrent(),false);
});

test('postponed retention questions wait while others are answered without pretending to be reviewed', () => {
  let e=new LearningEngine(data);e.setFocus(data.groups[0].numbers);learnScope(e);
  const q=e.nextQuestion(),before=e.snapshot(),n=q.number;e.postponeCurrent();
  assert.equal(e.state.answerCount,before.answerCount);assert.notEqual(e.state.current.number,n);
  const oldProgress={...before.progress[n],reviewHoldUntil:e.state.progress[n].reviewHoldUntil};
  assert.deepEqual(e.state.progress[n],oldProgress);const until=e.state.progress[n].reviewHoldUntil;
  while(e.state.answerCount<until) {assert.notEqual(e.nextQuestion().number,n);advance(e);e=new LearningEngine(data,e.snapshot());}
  let returned=false;
  for(let i=0;i<12;i++) {if(e.nextQuestion().number===n){returned=true;break;}advance(e);}
  assert.ok(returned);assert.equal(e.state.progress[n].lastReview,before.progress[n].lastReview);
});

test('old elements rotate after every four learning answers even before their scheduled reviews', () => {
  let e=new LearningEngine(data);const old=data.groups[0].numbers;e.setFocus(old);learnScope(e);
  e.setFocus([...old,...data.groups[1].numbers]);e.state.current=null;e.state.learningSinceReview=0;
  old.forEach(n=>{e.state.progress[n].due=e.state.answerCount+1000;e.state.progress[n].lastReview=e.state.answerCount;});
  const reviewed=new Set();let learning=0;
  for(let i=0;i<50;i++) {
    const q=e.nextQuestion();
    if(q.review) {
      assert.equal(learning,4);assert.ok(old.includes(q.number));assert.equal(q.earlyReview,true);assert.equal(q.type,'typed');
      const p=e.state.progress[q.number],due=p.due,level=p.reviewLevel,cursor=e.state.round.cursor;
      e.answer(correct(e,q));assert.equal(p.due,due);assert.equal(p.reviewLevel,level);assert.notEqual(p.reviewDirection,q.direction);
      assert.equal(e.state.round.cursor,cursor);reviewed.add(q.number);learning=0;e.continue();
    } else {learning++;advance(e);}
    e=new LearningEngine(data,e.snapshot());
  }
  assert.deepEqual(reviewed,new Set(old));
});

test('version-2 saves keep the exact question, scope, draft and feedback when priority support is added', () => {
  const e=new LearningEngine(data);e.setFocus([33]);advance(e);e.state.draft='Ars';
  for(const answered of [false,true]) {
    if(answered)e.answer(correct(e));
    const old=e.snapshot();old.version=2;delete old.deferred;
    Object.values(old.progress).forEach(p=>delete p.reviewHoldUntil);delete old.current.earlyReview;
    const restored=new LearningEngine(data,old);
    assert.equal(restored.state.version,3);assert.deepEqual(restored.state.scope,old.scope);
    assert.deepEqual(restored.state.current,old.current);assert.equal(restored.state.draft,old.draft);
    assert.deepEqual(restored.state.feedback,old.feedback);assert.equal(restored.state.answerCount,old.answerCount);
    assert.deepEqual(restored.state.deferred,[]);assert.equal(restored.state.progress[33].reviewHoldUntil,0);
  }
});
