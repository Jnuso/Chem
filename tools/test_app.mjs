// An isolated application integration test, not browser automation or a layout renderer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LearningEngine, STORAGE_KEY, DIRECTIONS} from '../dist/engine.mjs';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const source=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/,'');
const data=JSON.parse(readFileSync(new URL('../dist/data/elements.json',import.meta.url),'utf8'));
const decode=text=>text.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');

class MockElement {
  constructor(doc,id='',attrs='') {
    this.doc=doc;this.id=id;this.attributes={};this.dataset={};this.disabled=/\bdisabled\b/.test(attrs);this.hidden=/\bhidden\b/.test(attrs);this.value=decode(attrs.match(/\bvalue="([^"]*)"/)?.[1]??'');this.open=false;this.textContent='';this._html='';this.childIds=[];
    this.style={setProperty(){}};this.classes=new Set();this.classList={toggle:(c,on)=>{on?this.classes.add(c):this.classes.delete(c);}};
    for(const m of attrs.matchAll(/\bdata-([\w-]+)="([^"]*)"/g))this.dataset[m[1].replace(/-([a-z])/g,(_,l)=>l.toUpperCase())]=m[2];
  }
  set innerHTML(text) {
    this.childIds.forEach(id=>this.doc.elements.delete(id));this.childIds=[];this._html=text;
    for(const m of text.matchAll(/<([a-z]+)\b([^>]*\sid="([^"]+)"[^>]*)>/g)) {
      this.doc.elements.set(m[3],new MockElement(this.doc,m[3],m[2]));this.childIds.push(m[3]);
    }
  }
  get innerHTML(){return this._html;}
  setAttribute(k,v){this.attributes[k]=v;}
  removeAttribute(k){delete this.attributes[k];}
  toggleAttribute(k,on){on?this.setAttribute(k,''):this.removeAttribute(k);}
  focus(){this.doc.activeElement=this;}
  closest(selector){return selector==='button'||(selector==='#home-link'&&this.id==='home-link')?this:null;}
  matches(selector){return selector==='input,textarea'&&this.id==='typed-answer';}
  querySelector(selector) {
    const data=selector.match(/^\[data-(\w+)="([^"]+)"\]$/);
    const m=selector==='.choice'?this._html.match(/<button class="choice[^\"]*"([^>]+)>/)
      :data?this._html.match(new RegExp(`<button([^>]*data-${data[1]}="${data[2]}"[^>]*)>`)):null;
    return m?new MockElement(this.doc,'',m[1]):null;
  }
  showModal(){this.open=true;}
  close(){this.open=false;}
}
async function boot({saved=null,failRead=false,failWrite=false,webmcp=true,failRegister=false}={}) {
  const document={elements:new Map(),listeners:new Map(),collections:[],activeElement:null,
    getElementById(id){return this.elements.get(id)??null;},querySelectorAll(selector){return selector==='[data-collection]'?this.collections:[];},
    addEventListener(type,fn){const handlers=this.listeners.get(type)??[];handlers.push(fn);this.listeners.set(type,handlers);}};
  for(const m of html.matchAll(/<([a-z]+)\b([^>]*\sid="([^"]+)"[^>]*)>/g))document.elements.set(m[3],new MockElement(document,m[3],m[2]));
  for(const m of html.matchAll(/<button([^>]*data-collection="[^"]+"[^>]*)>/g))document.collections.push(new MockElement(document,'',m[1]));
  const tools=new Map();
  if(webmcp)document.modelContext={registerTool(tool,options){if(failRegister)throw Error('Unsupported');tools.set(tool.name,tool);assert.ok(options.signal instanceof AbortSignal);}};
  const storage={values:new Map(),failRead,failWrite,getItem(k){if(this.failRead)throw Error('Storage denied');return this.values.get(k)??null;},setItem(k,v){if(this.failWrite)throw Error('Storage full');this.values.set(k,v);}};
  if(saved!==null)storage.values.set(STORAGE_KEY,typeof saved==='string'?saved:JSON.stringify(saved));
  const window={addEventListener(){},scrollTo(){}};
  const fetch=async url=>{assert.equal(url,'./data/elements.json?details=1');return {ok:true,json:async()=>data};};
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  await new AsyncFunction('document','window','localStorage','fetch','LearningEngine','STORAGE_KEY','DIRECTIONS','AbortController','console',source)(document,window,storage,fetch,LearningEngine,STORAGE_KEY,DIRECTIONS,AbortController,{warn(){}});
  const el=id=>document.getElementById(id);
  const dispatch=(type,target,extra={})=>{const event={target,preventDefault(){this.prevented=true;},...extra};document.listeners.get(type)?.forEach(fn=>fn(event));return event;};
  const button=(id='',dataset={})=>{const b=el(id)??new MockElement(document,id);b.dataset={...b.dataset,...dataset};return b;};
  const click=(id,dataset={})=>dispatch('click',button(id,dataset));
  const state=()=>JSON.parse(storage.values.get(STORAGE_KEY));
  const answerCorrect=()=>{const q=state().current,e=data.elements[q.number-1];if(q.type==='choice')click('',{answer:String(q.number)});else {el('typed-answer').value=q.direction===DIRECTIONS[0]?e.name:e.symbol;dispatch('submit',el('answer-form'));}};
  assert.equal(el('app-error').hidden,true,el('app-error').textContent);
  return {document,tools,storage,el,dispatch,click,state,answerCorrect};
}

test('app boots offline with all 118 cells, ten families, selected-element details and saved state',async()=>{
  const a=await boot();
  assert.equal((a.el('periodic-table').innerHTML.match(/<button class="element /g)||[]).length,118);
  assert.equal((a.el('category-legend').innerHTML.match(/data-family=/g)||[]).length,10);
  assert.match(a.el('element-detail').innerHTML,/Silver/);assert.equal(a.el('learn-view').hidden,true);
  assert.equal(a.state().scope.length,118);assert.equal(a.state().current,null);
  assert.equal(a.state().selected.length,118);assert.equal(a.el('learning-count').textContent,118);
  assert.equal((a.el('element-collection').innerHTML.match(/class="collection-element"/g)||[]).length,118);
  assert.match(a.el('selection-summary').innerHTML,/all 118/);
});
test('element details show atomic molar mass, neutral electrons and accurately qualified oxidation states',async()=>{
  const a=await boot();a.click('',{element:'11'});
  assert.match(a.el('element-detail').innerHTML,/22\.9897693 g\/mol/);
  assert.match(a.el('element-detail').innerHTML,/Electrons \(neutral atom\)<\/span><strong>11/);
  assert.match(a.el('element-detail').innerHTML,/Oxidation states<\/span><strong>\+1/);
  assert.match(a.el('element-detail').innerHTML,/\+1 = 1 electron lost/);
  assert.match(a.el('element-detail').innerHTML,/not always charges of individual ions/);
  a.click('',{element:'26'});assert.match(a.el('element-detail').innerHTML,/\+3, \+2/);
  a.click('',{element:'8'});assert.match(a.el('element-detail').innerHTML,/15\.999 g\/mol/);
  assert.match(a.el('element-detail').innerHTML,/−2 = 2 electrons gained/);
  assert.match(a.el('element-detail').innerHTML,/molecules can contain multiple atoms/);
  a.click('',{element:'118'});assert.match(a.el('element-detail').innerHTML,/representative isotope; no standard atomic weight/);
  assert.equal(a.state().answerCount,0);
});
test('practice, answer, duplicate submission, Continue and restoration use the same saved state',async()=>{
  const a=await boot();a.click('practice-all');assert.equal(a.el('explore-view').hidden,true);assert.equal(a.el('learn-view').hidden,false);
  const q=a.state().current;a.answerCorrect();assert.equal(a.state().answerCount,1);assert.ok(a.state().feedback);
  a.click('',{answer:String(q.number)});assert.equal(a.state().answerCount,1);
  const restored=await boot({saved:a.state()});assert.equal(restored.state().answerCount,1);assert.match(restored.el('question-panel').innerHTML,/Correct\./);
  restored.click('continue-question');assert.equal(restored.state().answerCount,1);assert.equal(restored.state().feedback,null);assert.notEqual(restored.state().current.id,q.id);
  restored.click('home-link');assert.equal(restored.el('explore-view').hidden,false);assert.equal(restored.state().answerCount,1);
});
test('typing saves drafts, blank answers do not grade, and exact symbol case is explained',async()=>{
  const a=await boot();a.tools.get('set_study_selection').execute({numbers:[27]});
  a.answerCorrect();a.click('continue-question');
  a.el('typed-answer').value='Cob';a.dispatch('input',a.el('typed-answer'));assert.equal(a.state().draft,'Cob');
  const restored=await boot({saved:a.state()});assert.equal(restored.el('typed-answer').value,'Cob');
  restored.el('typed-answer').value=' ';restored.dispatch('submit',restored.el('answer-form'));assert.equal(restored.state().answerCount,1);assert.match(restored.el('answer-error').textContent,/Enter an answer/);
  for(let i=0;i<3;i++){restored.answerCorrect();restored.click('continue-question');}
  assert.equal(restored.state().current.direction,DIRECTIONS[1]);assert.equal(restored.state().current.type,'typed');
  restored.el('typed-answer').value='CO';restored.dispatch('submit',restored.el('answer-form'));
  assert.equal(restored.state().feedback.kind,'capitalization');assert.match(restored.el('question-panel').innerHTML,/Cobalt is <strong>Co<\/strong>/);
});
test('family and individual selections change study scope without clearing global answers',async()=>{
  const a=await boot();a.click('',{family:'noble-gas'});assert.equal(a.state().selected.length,111);assert.equal(a.document.activeElement.dataset.family,'noble-gas');
  a.click('',{family:'noble-gas'});assert.equal(a.state().selected.length,118);a.click('clear-selection');
  a.click('',{family:'noble-gas'});assert.equal(a.state().selected.length,7);
  a.click('',{family:'noble-gas'});assert.equal(a.state().selected.length,0);assert.equal(a.el('practice-selected').disabled,true);
  a.click('',{element:'26'});assert.match(a.el('element-detail').innerHTML,/Iron/);assert.equal(a.document.activeElement.dataset.element,'26');a.click('select-element');assert.deepEqual(a.state().selected,[26]);assert.equal(a.document.activeElement.id,'select-element');
  a.click('practice-selected');assert.deepEqual(a.state().scope,[26]);a.answerCorrect();a.click('explore-tab');a.click('practice-all');
  assert.equal(a.state().scope.length,118);assert.equal(a.state().answerCount,1);assert.ok(a.state().progress[26].directions[DIRECTIONS[0]].recognized);
});
test('Make new set selects successive tiles, survives refresh, and preserves learning until practice starts',async()=>{
  const a=await boot();a.click('practice-all');a.answerCorrect();a.click('explore-tab');
  const before=a.state();a.click('make-new-set');
  assert.equal(a.state().editingSet,true);assert.deepEqual(a.state().selected,[]);
  assert.equal(a.el('make-new-set').textContent,'Done selecting');assert.equal(a.el('practice-selected').disabled,true);
  assert.equal(a.el('set-selection-hint').hidden,false);assert.equal(a.el('select-element').hidden,true);
  for(const n of [47,33,18])a.click('',{element:String(n)});
  assert.deepEqual(a.state().selected,[18,33,47]);assert.equal(a.document.activeElement.dataset.element,'18');
  assert.match(a.el('periodic-table').innerHTML,/data-element="33" aria-pressed="true"/);
  assert.match(a.el('set-selection-hint').textContent,/3 selected/);assert.equal(a.el('practice-selected').disabled,false);
  a.click('',{element:'33'});assert.deepEqual(a.state().selected,[18,47]);
  a.click('',{family:'noble-gas'});assert.deepEqual(a.state().selected,[2,10,18,36,47,54,86,118]);
  for(const key of ['scope','current','feedback','progress','answerCount'])assert.deepEqual(a.state()[key],before[key]);
  const restored=await boot({saved:a.state()});assert.equal(restored.state().editingSet,true);
  assert.equal(restored.el('make-new-set').attributes['aria-pressed'],'true');assert.equal(restored.el('set-selection-hint').hidden,false);
  restored.click('',{element:'26'});assert.ok(restored.state().selected.includes(26));
  restored.click('make-new-set');assert.equal(restored.state().editingSet,false);assert.equal(restored.el('select-element').hidden,false);
  const chosen=restored.state().selected;restored.click('',{element:'33'});assert.deepEqual(restored.state().selected,chosen);
  restored.click('practice-selected');assert.deepEqual(restored.state().scope,chosen);
  assert.equal(restored.state().answerCount,1);assert.deepEqual(restored.state().progress,before.progress);
  restored.click('explore-tab');restored.click('make-new-set');restored.click('',{element:'26'});restored.click('practice-selected');
  assert.equal(restored.state().editingSet,false);assert.deepEqual(restored.state().scope,[26]);assert.equal(restored.el('learn-view').hidden,false);
  const oldSave=before;delete oldSave.editingSet;
  const older=await boot({saved:oldSave});assert.equal(older.state().editingSet,false);assert.deepEqual(older.state().progress,before.progress);
});
test('Send to back skips grading, survives refresh, ignores stale clicks and can restore priority',async()=>{
  const a=await boot();a.click('practice-all');const before=a.state(),oldButton=a.el('postpone-element');
  assert.equal(oldButton.disabled,false);a.click('postpone-element');
  assert.equal(a.state().answerCount,0);assert.deepEqual(a.state().deferred,[before.current.number]);
  assert.deepEqual(a.state().progress,before.progress);assert.notEqual(a.state().current.number,before.current.number);
  assert.match(a.el('question-panel').innerHTML,/sent to the back/);assert.ok(a.el('restore-postponed'));
  const after=a.state();a.dispatch('click',oldButton);assert.deepEqual(a.state(),after);
  const restored=await boot({saved:a.state()});assert.equal(restored.state().current.id,after.current.id);assert.deepEqual(restored.state().deferred,after.deferred);
  restored.click('restore-postponed');assert.deepEqual(restored.state().deferred,[]);assert.equal(restored.state().current.id,after.current.id);
  restored.answerCorrect();const answered=restored.state();restored.click('postpone-element');
  assert.equal(restored.state().answerCount,1);assert.deepEqual(restored.state().progress,answered.progress);assert.equal(restored.state().feedback,null);
  restored.tools.get('set_study_selection').execute({numbers:[27]});assert.equal(restored.el('postpone-element').disabled,true);
});
test('mixed review is labeled during new learning and leaves the scheduled retention date in place',async()=>{
  const e=new LearningEngine(data);e.setFocus([47]);
  while(e.summary().learned!==1){const q=e.nextQuestion();e.answer(q.type==='choice'?q.number:q.direction===DIRECTIONS[0]?'Silver':'Ag');e.continue();}
  e.setFocus([47,...data.groups[1].numbers]);e.state.current=null;e.state.learningSinceReview=0;e.state.view='learn';
  e.state.progress[47].due=e.state.answerCount+1000;
  const a=await boot({saved:e.snapshot()});
  for(let i=0;i<4;i++){assert.equal(a.state().current.review,false);a.answerCorrect();a.click('continue-question');}
  assert.equal(a.state().current.number,47);assert.equal(a.state().current.earlyReview,true);assert.match(a.el('question-panel').innerHTML,/Mixed review/);
  const due=a.state().progress[47].due;a.answerCorrect();assert.equal(a.state().progress[47].due,due);
  a.click('continue-question');assert.equal(a.state().current.review,false);
});
test('keyboard choice and Continue shortcuts update the saved counter and question',async()=>{
  const a=await boot();a.click('practice-all');const q=a.state().current,index=q.options.indexOf(q.number)+1;
  a.dispatch('keydown',new MockElement(a.document),{key:String(index)});assert.equal(a.state().answerCount,1);assert.ok(a.state().feedback.correct);
  a.dispatch('keydown',a.el('continue-question'),{key:'Enter'});assert.equal(a.state().feedback,null);assert.equal(a.state().answerCount,1);
});
test('typed practice shows only prompt-side information in the active group',async()=>{
  const a=await boot();a.tools.get('set_study_selection').execute({numbers:[33]});
  a.answerCorrect();a.click('continue-question');
  assert.equal(a.state().current.type,'typed');assert.doesNotMatch(a.el('group-panel').innerHTML,/Arsenic/);assert.doesNotMatch(a.el('question-panel').innerHTML,/Arsenic/);
  a.answerCorrect();a.click('continue-question');a.answerCorrect();a.click('continue-question');a.answerCorrect();a.click('continue-question');
  assert.equal(a.state().current.direction,DIRECTIONS[1]);assert.doesNotMatch(a.el('group-panel').innerHTML,/>As</);
});
test('unavailable storage keeps practice working and clearly labels unsaved answers',async()=>{
  const a=await boot({failRead:true});assert.equal(a.el('storage-warning').hidden,false);assert.equal(a.el('save-status').textContent,'Not saving');
  a.tools.get('set_study_selection').execute({numbers:[47]});a.click('',{answer:'47'});assert.equal(a.tools.get('read_study_progress').execute({}).answerCount,1);assert.match(a.el('question-panel').innerHTML,/This answer is not saved/);
  const b=await boot();b.click('practice-all');b.storage.failWrite=true;b.answerCorrect();
  assert.match(b.el('storage-warning').textContent,/cannot save/);assert.match(b.el('question-panel').innerHTML,/This answer is not saved/);
  b.click('postpone-element');assert.equal(b.tools.get('read_study_progress').execute({}).answerCount,1);
  assert.match(b.el('question-panel').innerHTML,/sent to the back/);assert.equal(b.el('save-status').textContent,'Not saving');
});
test('unreadable saved state is backed up and a usable fresh session appears',async()=>{
  const a=await boot({saved:'{broken json'});assert.equal(a.storage.values.get(STORAGE_KEY+':unreadable-backup'),'{broken json');
  assert.match(a.el('storage-warning').textContent,/fresh session/);assert.equal(a.state().answerCount,0);
});
test('reset is staged in a dialog and clears state only after the explicit reset action',async()=>{
  const a=await boot();a.click('practice-all');a.answerCorrect();a.click('reset-progress');assert.equal(a.el('reset-dialog').open,true);assert.equal(a.state().answerCount,1);
  a.el('reset-dialog').close();assert.equal(a.state().answerCount,1);
  a.click('reset-progress');a.click('confirm-reset');assert.equal(a.state().answerCount,0);assert.equal(a.state().current,null);assert.equal(a.el('learn-view').hidden,true);
});
test('optional WebMCP hooks share UI state, reject bad input and are harmless when unavailable',async()=>{
  const a=await boot();assert.equal(a.tools.size,2);
  const read=a.tools.get('read_study_progress'),select=a.tools.get('set_study_selection');assert.equal(read.annotations.readOnlyHint,true);assert.equal(select.annotations.readOnlyHint,false);
  const before=a.state();assert.throws(()=>select.execute({numbers:[]}));assert.throws(()=>select.execute({numbers:[1,1]}));assert.throws(()=>select.execute({numbers:[0]}));assert.throws(()=>select.execute({numbers:[1],extra:true}));assert.deepEqual(a.state(),before);
  assert.throws(()=>read.execute({extra:true}));const result=select.execute({numbers:[17,24]});assert.equal(result.summary.total,2);assert.equal(a.el('learn-view').hidden,false);assert.deepEqual(read.execute({}).scope,[17,24]);
  const unsupported=await boot({webmcp:false});unsupported.click('practice-all');assert.ok(unsupported.state().current);
  const failed=await boot({failRegister:true});failed.click('practice-all');assert.ok(failed.state().current);
});
