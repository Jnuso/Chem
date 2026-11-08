import {FamilyEngine, FAMILY_STORAGE_KEY, FAMILY_BATCH_SIZE, FAMILY_PASSES} from './family-engine.mjs';
const $=id=>document.getElementById(id);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data,game,storageAvailable=true,storageMessage='';
const element=n=>game.byNumber.get(n);
const category=id=>data.categories.find(c=>c.id===id);
function storageWarning() {
  $('family-storage-warning').hidden=!storageMessage;$('family-storage-warning').textContent=storageMessage;
  $('family-save-status').textContent=storageAvailable?'Family progress saved':'Not saving';
}
function save() {
  if(storageAvailable)try{localStorage.setItem(FAMILY_STORAGE_KEY,JSON.stringify(game.snapshot()));}
  catch{storageAvailable=false;storageMessage='Your browser cannot save family-game progress. You can keep playing, but these answers will be lost when you close or reload the page.';renderQuestion();}
  storageWarning();
}
function tableHTML(study=false) {
  const colored=study&&game.state.colors,target=study?game.state.studyNumber:game.active()?.current?.number;
  const headers=Array.from({length:18},(_,i)=>`<span class="group-label" style="grid-column:${i+1};grid-row:1">${i+1}</span>`).join('');
  const cells=data.elements.map(e=>{
    const c=category(e.category),tag=study?'button':'div';
    const label=`${e.number}, ${e.name}, ${e.symbol}${e.number===target?', highlighted element':''}`;
    return `<${tag} class="element ${e.number===target?'family-target':''}" style="--family:${colored?c.color:'#c3ccda'};grid-column:${e.column};grid-row:${e.row}" data-family-cell="${e.number}" ${study?`data-study-element="${e.number}"`:''} aria-label="${escape(label)}" ${e.number===target?'aria-current="true"':''}><span class="element-number">${e.number}</span><strong class="element-symbol">${e.symbol}</strong><span class="element-name">${escape(e.name)}</span></${tag}>`;
  }).join('');
  // Neutral quiz labels and accessible names must not disclose a family.
  return headers+cells+'<span class="series-placeholder" style="grid-column:3;grid-row:7">57–71</span><span class="series-placeholder" style="grid-column:3;grid-row:8">89–103</span><span class="series-label" style="grid-column:1 / span 3;grid-row:10">Elements 57–71</span><span class="series-label" style="grid-column:1 / span 3;grid-row:11">Elements 89–103</span>';
}
function renderTotals() {
  const t=game.totals();
  $('family-running-totals').innerHTML=[['Correct',t.correct],['Missed answers',t.wrong],['Accuracy',t.accuracy===null?'—':`${t.accuracy}%`],['Elements to revisit',t.missed]].map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join('');
  const missed=game.missedNumbers();
  $('family-missed-list').innerHTML=missed.length?missed.map(n=>{const e=element(n),p=game.state.progress[n];return `<div class="family-missed-item"><span><strong>${e.symbol}</strong> ${escape(e.name)}</span><span>${p.wrong} missed · ${p.correct} correct · ${Math.round(p.correct/(p.correct+p.wrong)*100)}%</span></div>`;}).join(''):'<p class="empty-text">No missed answers yet. Play a batch to build your totals.</p>';
}
function renderControls() {
  const s=game.state,all=s.sessions.all,missed=s.sessions.missed;
  $('family-start-all').textContent=all&&!game.completed(all)?'Resume all-elements batch':all?'Next all-elements batch':'Start a batch of 50';
  $('family-start-missed').disabled=game.totals().missed===0;
  $('family-start-missed').textContent=missed&&!game.completed(missed)?'Resume Study missed':'Study missed';
  $('family-mode-note').textContent=s.mode==='missed'?'Study missed · lifetime mistakes, most missed first.':'All 118 elements · batches of 50, 50, then 18 before the next cycle.';
}
function renderQuestion() {
  const b=game.active(),q=b?.current,f=b?.feedback;
  if(!b) {$('family-question-panel').innerHTML=`<p class="eyebrow">FAMILY PRACTICE</p><h2>Know where it belongs.</h2><p class="family-intro muted">Start with ${FAMILY_BATCH_SIZE} different elements. Each appears once in each of ${FAMILY_PASSES} shuffled passes: 150 questions, all multiple choice.</p><p class="family-intro muted">Wrong answers add to your running totals. Every batch finishes after its three passes.</p>`;return;}
  if(game.completed(b)) {$('family-question-panel').innerHTML=`<p class="eyebrow">BATCH COMPLETE</p><h2>${b.correct} / ${b.queue.length} correct</h2><p class="family-intro muted">${b.numbers.length} elements, ${FAMILY_PASSES} passes. ${b.wrong} missed answers were recorded in your running totals.</p><button id="family-next-batch" class="button primary">${b.mode==='missed'?'Next missed batch':'Next batch'}</button><p class="family-intro muted">You can study the colored table or revisit missed elements whenever you want.</p>`;return;}
  const e=element(q.number),position=b.position+(f?0:1),pass=Math.min(FAMILY_PASSES,Math.ceil(position/b.numbers.length));
  const choices=q.options.map((id,i)=>`<button class="choice ${f?id===f.expected?'correct':id===f.answer?'incorrect':'':''}" data-family-answer="${id}" data-question-id="${q.id}" ${f?'disabled':''}><span class="choice-index" aria-hidden="true">${i+1}</span><span>${escape(category(id).label)}</span></button>`).join('');
  const feedback=f?`<div class="feedback ${f.correct?'':'incorrect'}" role="status" aria-live="polite"><h3>${f.correct?'Correct.':'Keep this section in mind.'}</h3><p><strong>${escape(e.name)} (${e.symbol})</strong> belongs to <strong>${escape(category(f.expected).label)}</strong>.</p><p class="feedback-note">${f.correct?'Correct answer added to your running totals.':'Miss recorded. You can revisit this element with Study missed.'}</p></div><div class="continue-row"><span class="saved-note">${storageAvailable?'Answer saved':'This answer is not saved'}</span><button id="family-continue" class="button primary" data-question-id="${q.id}">Continue</button></div>`:'';
  $('family-question-panel').innerHTML=`<div class="question-meta"><span>${b.mode==='missed'?'Study missed':'All elements'}</span><span class="question-tag">Pass ${pass} / ${FAMILY_PASSES}</span></div><p class="family-batch-position muted">Question ${position} / ${b.queue.length} · ${b.numbers.length} elements</p><div class="family-prompt"><h2>Which element family?</h2><p class="prompt-symbol">${e.symbol}</p><p class="prompt-name">${escape(e.name)}</p><p class="muted">Atomic number ${e.number}</p></div><button id="family-locate" class="text-button family-locate">Locate on table</button><div class="choices">${choices}</div>${feedback}`;
}
function renderStudy() {
  const s=game.state,e=element(s.studyNumber),c=category(e.category),p=s.progress[e.number];
  $('family-toggle-colors').textContent=s.colors?'Hide colors':'Show colors';$('family-toggle-colors').setAttribute('aria-pressed',String(s.colors));
  $('family-study-legend').hidden=!s.colors;
  $('family-study-legend').innerHTML=data.categories.map(c=>`<span class="family-button" style="--family:${c.color}"><span class="swatch" aria-hidden="true"></span>${escape(c.label)}</span>`).join('');
  $('family-study-table').innerHTML=tableHTML(true);
  $('family-study-detail').style.setProperty('--family',s.colors?c.color:'#c3ccda');
  $('family-study-detail').innerHTML=`<div class="detail-top"><span>ELEMENT ${String(e.number).padStart(3,'0')}</span><span>${e.symbol}</span></div><div class="detail-symbol">${e.symbol}</div><h2 class="detail-name">${escape(e.name)}</h2><p class="detail-family">${escape(c.label)}</p><div class="detail-fact"><span>Atomic number</span><strong>${e.number}</strong></div><div class="detail-fact"><span>Period</span><strong>${e.period}</strong></div><div class="detail-fact"><span>Group</span><strong>${e.group??'f-block'}</strong></div><div class="detail-progress"><p class="eyebrow">FAMILY-GAME TOTALS</p><div class="progress-row"><span>Correct</span><strong>${p.correct}</strong></div><div class="progress-row"><span>Missed</span><strong>${p.wrong}</strong></div></div><p class="detail-note">Families follow the bundled PubChem dataset. Your quiz resumes at the same question.</p>`;
}
function render() {
  const study=game.state.view==='study';
  $('family-play-view').hidden=study;$('family-study-view').hidden=!study;
  $('family-play-tab').classList.toggle('active',!study);$('family-study-tab').classList.toggle('active',study);
  $('family-play-tab').setAttribute('aria-pressed',String(!study));$('family-study-tab').setAttribute('aria-pressed',String(study));
  renderTotals();renderControls();renderQuestion();$('family-quiz-table').innerHTML=tableHTML();renderStudy();storageWarning();
}
function focusQuestion(){const b=game.active();(b?.feedback?$('family-continue'):game.completed(b)?$('family-next-batch'):$('family-question-panel').querySelector('.choice'))?.focus({preventScroll:true});}
function update(action,focus=false){try{if(action()===false)return;render();save();if(focus)focusQuestion();}catch(error){$('family-app-error').textContent=error.message;$('family-app-error').hidden=false;}}
document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!game||!b||b.disabled)return;
  if(b.dataset.familyAnswer){update(()=>game.answer(b.dataset.familyAnswer,b.dataset.questionId),true);return;}
  if(b.dataset.studyElement){update(()=>game.inspect(+b.dataset.studyElement));$('family-study-table').querySelector(`[data-study-element="${b.dataset.studyElement}"]`)?.focus({preventScroll:true});return;}
  switch(b.id){
    case 'family-start-all':update(()=>game.start('all'),true);break;
    case 'family-start-missed':update(()=>game.start('missed'),true);break;
    case 'family-next-batch':update(()=>game.start(game.state.mode),true);break;
    case 'family-continue':update(()=>game.continue(b.dataset.questionId),true);break;
    case 'family-study-tab':update(()=>game.showStudy());break;
    case 'family-play-tab':update(()=>game.showPlay(),true);break;
    case 'family-toggle-colors':update(()=>game.toggleColors());break;
    case 'family-locate':$('family-quiz-table').querySelector(`[data-family-cell="${game.active().current.number}"]`)?.scrollIntoView({block:'nearest',inline:'center',behavior:'auto'});break;
    case 'family-reset':$('family-reset-dialog').showModal();break;
    case 'family-confirm-reset':game=new FamilyEngine(data);$('family-reset-dialog').close();render();save();$('family-start-all').focus();break;
  }
});
document.addEventListener('keydown',event=>{
  if(!game||game.state.view!=='play'||$('family-reset-dialog').open||event.ctrlKey||event.altKey||event.metaKey||event.repeat||event.target.matches('input,textarea'))return;
  const b=game.active();if(!b?.current)return;
  if(event.key==='Enter'&&b.feedback){event.preventDefault();update(()=>game.continue(b.current.id),true);}
  else if(!b.feedback&&/^[1-4]$/.test(event.key)){event.preventDefault();update(()=>game.answer(b.current.options[+event.key-1],b.current.id),true);}
});
try {
  const response=await fetch('./data/elements.json');if(!response.ok)throw Error('Element data could not be loaded. Refresh the page and try again.');data=await response.json();
  let raw=null;try{raw=localStorage.getItem(FAMILY_STORAGE_KEY);}catch{storageAvailable=false;storageMessage='Your browser cannot save family-game progress. You can keep playing, but this session will be lost on reload.';}
  if(raw)try{game=new FamilyEngine(data,JSON.parse(raw));}catch{storageMessage='Saved family-game progress could not be read. A fresh family game is open; your name and symbol progress stays saved.';try{localStorage.setItem(FAMILY_STORAGE_KEY+':unreadable-backup',raw);}catch{}}
  game??=new FamilyEngine(data);render();save();
}catch(error){$('family-app-error').textContent=error.message;$('family-app-error').hidden=false;['family-start-all','family-start-missed','family-toggle-colors'].forEach(id=>$(id).disabled=true);}
