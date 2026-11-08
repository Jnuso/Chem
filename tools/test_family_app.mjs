// Isolated application events and storage checks; this is not a browser or layout renderer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FamilyEngine,FAMILY_STORAGE_KEY,FAMILY_BATCH_SIZE,FAMILY_PASSES} from '../dist/family-engine.mjs';
import {STORAGE_KEY} from '../dist/engine.mjs';
const html=readFileSync(new URL('../dist/families.html',import.meta.url),'utf8');
const source=readFileSync(new URL('../dist/family-app.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/,'');
const data=JSON.parse(readFileSync(new URL('../dist/data/elements.json',import.meta.url),'utf8'));
class MockElement {
  constructor(doc,id='',attrs='') {
    this.doc=doc;this.id=id;this.disabled=/\bdisabled\b/.test(attrs);this.hidden=/\bhidden\b/.test(attrs);this.dataset={};this.attributes={};this.open=false;this._html='';this.childIds=[];this.textContent='';
    this.style={setProperty(){}};this.classes=new Set();this.classList={toggle:(c,on)=>on?this.classes.add(c):this.classes.delete(c)};
    for(const m of attrs.matchAll(/\bdata-([\w-]+)="([^"]*)"/g))this.dataset[m[1].replace(/-([a-z])/g,(_,l)=>l.toUpperCase())]=m[2];
  }
  set innerHTML(value){this.childIds.forEach(id=>this.doc.elements.delete(id));this.childIds=[];this._html=value;for(const m of value.matchAll(/<([a-z]+)\b([^>]*\sid="([^"]+)"[^>]*)>/g)){this.doc.elements.set(m[3],new MockElement(this.doc,m[3],m[2]));this.childIds.push(m[3]);}}
  get innerHTML(){return this._html;}
  setAttribute(k,v){this.attributes[k]=v;}
  closest(selector){return selector==='button'?this:null;}
  matches(){return false;}
  focus(){this.doc.activeElement=this;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  scrollIntoView(){this.doc.located=this.dataset.familyCell;}
  querySelector(selector){
    const attr=selector.match(/^\[data-([\w-]+)="([^"]+)"\]$/);
    const m=selector==='.choice'?this._html.match(/<button class="choice[^\"]*"([^>]+)>/):attr?this._html.match(new RegExp(`<(?:button|div)([^>]*data-${attr[1]}="${attr[2]}"[^>]*)>`)):null;
    return m?new MockElement(this.doc,'',m[1]):null;
  }
}
async function boot({saved=null,failRead=false,failWrite=false}={}) {
  const document={elements:new Map(),listeners:new Map(),activeElement:null,located:null,getElementById(id){return this.elements.get(id)??null;},addEventListener(type,fn){const list=this.listeners.get(type)??[];list.push(fn);this.listeners.set(type,list);}};
  for(const m of html.matchAll(/<([a-z]+)\b([^>]*\sid="([^"]+)"[^>]*)>/g))document.elements.set(m[3],new MockElement(document,m[3],m[2]));
  const storage={values:new Map([[STORAGE_KEY,'name-progress-sentinel']]),failRead,failWrite,getItem(key){if(this.failRead)throw Error('Denied');return this.values.get(key)??null;},setItem(key,value){if(this.failWrite)throw Error('Full');this.values.set(key,value);}};
  if(saved!==null)storage.values.set(FAMILY_STORAGE_KEY,typeof saved==='string'?saved:JSON.stringify(saved));
  const fetch=async url=>{assert.equal(url,'./data/elements.json');return {ok:true,json:async()=>data};};
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  await new AsyncFunction('document','localStorage','fetch','FamilyEngine','FAMILY_STORAGE_KEY','FAMILY_BATCH_SIZE','FAMILY_PASSES',source)(document,storage,fetch,FamilyEngine,FAMILY_STORAGE_KEY,FAMILY_BATCH_SIZE,FAMILY_PASSES);
  const el=id=>document.getElementById(id),state=()=>JSON.parse(storage.values.get(FAMILY_STORAGE_KEY));
  const dispatch=(type,target,extra={})=>{const e={target,preventDefault(){this.prevented=true;},...extra};document.listeners.get(type)?.forEach(fn=>fn(e));return e;};
  const click=(id,dataset={})=>{const b=el(id)??new MockElement(document,id);b.dataset={...b.dataset,...dataset};return dispatch('click',b);};
  const answer=(right=true)=>{const b=state().sessions[state().mode],q=b.current,expected=data.elements[q.number-1].category;click('',{familyAnswer:right?expected:q.options.find(c=>c!==expected),questionId:q.id});};
  assert.equal(el('family-app-error').hidden,true,el('family-app-error').textContent);
  return {document,storage,el,state,dispatch,click,answer};
}
function neutral(table) {
  assert.equal((table.match(/class="element /g)||[]).length,118);
  assert.doesNotMatch(table,/alkali|alkaline|transition|metalloid|nonmetal|halogen|noble|lanthanide|actinide/i);
  data.categories.forEach(c=>assert.ok(!table.includes(c.color)));
  assert.equal((table.match(/--family:#c3ccda/g)||[]).length,118);
}

test('family page starts separately with a neutral 118-element table and 50-element batches',async()=>{
  const a=await boot();neutral(a.el('family-quiz-table').innerHTML);assert.equal(a.el('family-start-missed').disabled,true);
  assert.equal(a.state().answerCount,0);a.click('family-start-all');assert.equal(a.state().sessions.all.numbers.length,50);
  assert.match(a.el('family-question-panel').innerHTML,/Question 1 \/ 150/);assert.equal((a.el('family-question-panel').innerHTML.match(/data-family-answer=/g)||[]).length,4);
  assert.match(a.el('family-quiz-table').innerHTML,/family-target/);a.click('family-locate');assert.equal(+a.document.located,a.state().sessions.all.current.number);
  assert.equal(a.storage.values.get(STORAGE_KEY),'name-progress-sentinel');
});
test('color study screen reveals sections, survives reload, and returns to the exact neutral question',async()=>{
  const a=await boot();a.click('family-start-all');const before=a.state().sessions.all;
  a.click('family-study-tab');assert.equal(a.el('family-play-view').hidden,true);assert.equal(a.el('family-study-view').hidden,false);
  a.click('family-toggle-colors');assert.equal(a.el('family-toggle-colors').textContent,'Hide colors');assert.equal(a.el('family-study-legend').hidden,false);
  data.categories.forEach(c=>assert.ok(a.el('family-study-table').innerHTML.includes(c.color)));
  a.click('',{studyElement:'56'});assert.match(a.el('family-study-detail').innerHTML,/Alkaline earth metals/);assert.equal(a.document.activeElement.dataset.studyElement,'56');
  const r=await boot({saved:a.state()});assert.equal(r.state().colors,true);assert.equal(r.state().studyNumber,56);
  r.click('family-play-tab');neutral(r.el('family-quiz-table').innerHTML);assert.deepEqual(r.state().sessions.all,before);assert.equal(r.state().answerCount,0);
  r.click('family-study-tab');r.click('family-toggle-colors');neutral(r.el('family-study-table').innerHTML);
});
test('mistake totals enable Study missed while the normal batch and feedback remain paused',async()=>{
  const a=await boot();a.click('family-start-all');a.answer(false);const before=a.state().sessions.all,n=before.current.number;
  assert.equal(a.el('family-start-missed').disabled,false);assert.match(a.el('family-missed-list').innerHTML,/1 missed · 0 correct/);
  a.click('family-start-missed');assert.equal(a.state().mode,'missed');assert.deepEqual(a.state().sessions.missed.numbers,[n]);
  assert.match(a.el('family-question-panel').innerHTML,/Question 1 \/ 3/);a.answer();a.click('family-continue');
  a.click('family-start-all');assert.deepEqual(a.state().sessions.all,before);assert.match(a.el('family-question-panel').innerHTML,/Miss recorded/);
  const r=await boot({saved:a.state()});assert.equal(r.state().answerCount,2);assert.deepEqual(r.state().progress[n].correct,1);
  assert.deepEqual(r.state().sessions.all,before);assert.equal(r.storage.values.get(STORAGE_KEY),'name-progress-sentinel');
});
test('keyboard grading, stale choices, feedback recovery and the finished-batch screen are resumable',async()=>{
  const a=await boot();a.click('family-start-all');const q=a.state().sessions.all.current,expected=data.elements[q.number-1].category;
  const old=a.el('family-question-panel').querySelector('.choice');
  a.dispatch('keydown',old,{key:String(q.options.indexOf(expected)+1)});assert.equal(a.state().answerCount,1);
  const r=await boot({saved:a.state()});assert.match(r.el('family-question-panel').innerHTML,/Answer saved/);
  r.dispatch('keydown',r.el('family-continue'),{key:'Enter'});const next=r.state();
  r.dispatch('click',old);assert.deepEqual(r.state(),next);assert.equal(r.document.activeElement.dataset.questionId,next.sessions.all.current.id);
  const g=new FamilyEngine(data,r.state());while(!g.completed()){g.answer(g.byNumber.get(g.active().current.number).category);g.continue();}
  const done=await boot({saved:g.snapshot()});assert.match(done.el('family-question-panel').innerHTML,/BATCH COMPLETE/);done.click('family-next-batch');assert.equal(done.state().sessions.all.numbers.length,50);
});
test('family reset requires its dialog and leaves name/symbol storage unchanged',async()=>{
  const a=await boot();a.click('family-start-all');a.answer(false);a.click('family-reset');assert.equal(a.el('family-reset-dialog').open,true);assert.equal(a.state().answerCount,1);
  a.el('family-reset-dialog').close();assert.equal(a.state().answerCount,1);a.click('family-reset');a.click('family-confirm-reset');
  assert.equal(a.state().answerCount,0);assert.equal(a.state().sessions.all,null);assert.equal(a.el('family-start-missed').disabled,true);
  assert.equal(a.storage.values.get(STORAGE_KEY),'name-progress-sentinel');
});
test('unreadable or unavailable family storage never interrupts name/symbol progress or playing',async()=>{
  const a=await boot({saved:'{broken'});assert.equal(a.storage.values.get(FAMILY_STORAGE_KEY+':unreadable-backup'),'{broken');assert.match(a.el('family-storage-warning').textContent,/fresh family game/);
  assert.equal(a.storage.values.get(STORAGE_KEY),'name-progress-sentinel');
  const b=await boot({failRead:true});b.click('family-start-all');assert.equal(b.el('family-save-status').textContent,'Not saving');
  assert.equal((b.el('family-question-panel').innerHTML.match(/data-family-answer=/g)||[]).length,4);
  const c=await boot();c.click('family-start-all');c.storage.failWrite=true;c.answer();assert.match(c.el('family-question-panel').innerHTML,/This answer is not saved/);
  assert.match(c.el('family-storage-warning').textContent,/cannot save/);assert.equal(c.storage.values.get(STORAGE_KEY),'name-progress-sentinel');
});
