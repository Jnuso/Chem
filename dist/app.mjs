import {LearningEngine, STORAGE_KEY, DIRECTIONS} from './engine.mjs';

const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const labels = {unseen:'Not studied', learning:'Learning', learned:'Learned', 'needs-review':'Needs review'};
let data, engine, storageAvailable = true, storageMessage = '', selectedNumber = 47;
const categoryOf = element => data.categories.find(c => c.id === element.category);
const elementOf = number => engine.byNumber.get(number);
const directionLabel = direction => direction === DIRECTIONS[0] ? 'Symbol → name' : 'Name → symbol';
const mark = status => `<i class="status-mark ${status}" aria-hidden="true">${status === 'learned' ? '✓' : status === 'needs-review' ? '!' : ''}</i>`;
function steps(direction) {
  const completed = Number(direction.recognized) + direction.streak;
  return `<span class="mini-steps" aria-label="${completed} of 3 steps complete">${Array.from({length:3}, (_,i) => `<span class="mini-step ${i < completed ? 'done' : ''}"></span>`).join('')}</span>`;
}
function storageWarning() {
  $('storage-warning').textContent = storageMessage;
  $('storage-warning').hidden = !storageMessage;
  $('save-status').textContent = storageAvailable ? 'Progress saved here' : 'Not saving';
}
function save() {
  if (storageAvailable) {
    try {localStorage.setItem(STORAGE_KEY, JSON.stringify(engine.snapshot()));}
    catch {
      storageAvailable = false; storageMessage = 'Your browser cannot save progress. You can keep studying, but this session will be lost when you close or reload the page.';
      if (engine.state.view === 'learn') {renderGroup(); renderQuestion();}
    }
  }
  storageWarning();
}
function renderTable() {
  const selected = new Set(engine.state.selected);
  const editing = engine.state.editingSet;
  $('periodic-table').classList.toggle('selecting-set', editing);
  $('category-legend').innerHTML = data.categories.map(c => {
    const family = data.elements.filter(e => e.category === c.id);
    const all = family.every(e => selected.has(e.number));
    return `<button class="family-button ${all ? 'active' : ''}" style="--family:${c.color}" data-family="${c.id}" aria-pressed="${all}" title="${all ? 'Remove' : 'Select'} ${c.label.toLowerCase()} for practice"><span class="swatch" aria-hidden="true"></span>${escape(c.label)}</button>`;
  }).join('');
  const headers = Array.from({length:18}, (_,i) => `<span class="group-label" style="grid-column:${i+1};grid-row:1">${i+1}</span>`).join('');
  $('periodic-table').innerHTML = headers + data.elements.map(e => {
    const status = engine.status(e.number);
    return `<button class="element ${selected.has(e.number) ? 'selected' : ''} ${selectedNumber === e.number ? 'focused' : ''}" style="--family:${categoryOf(e).color};grid-column:${e.column};grid-row:${e.row}" data-element="${e.number}" ${editing ? `aria-pressed="${selected.has(e.number)}"` : ''} aria-label="${e.number}, ${escape(e.name)}, ${e.symbol}, ${escape(categoryOf(e).label)}, ${labels[status]}${selected.has(e.number) ? ', selected for practice' : ''}" title="${editing ? `${selected.has(e.number) ? 'Remove' : 'Add'} ${escape(e.name)} ${selected.has(e.number) ? 'from' : 'to'} your set` : `${escape(e.name)} · ${e.symbol} · ${labels[status]}`}"><span class="element-number">${e.number}</span><strong class="element-symbol">${e.symbol}</strong><span class="element-name">${escape(e.name)}</span>${editing && selected.has(e.number) ? '<span class="selection-tick" aria-hidden="true">✓</span>' : ''}${mark(status)}</button>`;
  }).join('') + '<span class="series-placeholder" style="grid-column:3;grid-row:7">57–71<span>Ln</span></span><span class="series-placeholder" style="grid-column:3;grid-row:8">89–103<span>An</span></span><span class="series-label" style="grid-column:1 / span 3;grid-row:10">Lanthanides · 57–71</span><span class="series-label" style="grid-column:1 / span 3;grid-row:11">Actinides · 89–103</span>';
}
function renderDetail() {
  const e = elementOf(selectedNumber), c = categoryOf(e), p = engine.state.progress[e.number];
  const selected = engine.state.selected.includes(e.number), status = engine.status(e.number);
  $('element-detail').style.setProperty('--family', c.color);
  $('element-detail').innerHTML = `<div class="detail-top"><span>ELEMENT ${String(e.number).padStart(3,'0')}</span><span>${e.symbol}</span></div><div class="detail-symbol">${e.symbol}</div><h2 class="detail-name">${escape(e.name)}</h2><p class="detail-family"><span class="swatch" aria-hidden="true"></span>${escape(c.label)}</p><div class="detail-fact"><span>Period</span><strong>${e.period}</strong></div><div class="detail-fact"><span>Group</span><strong>${e.group ?? 'f-block'}</strong></div><div class="detail-progress"><p class="eyebrow">YOUR PROGRESS</p><h3>${mark(status)} ${labels[status]}</h3>${DIRECTIONS.map(d => `<div class="direction-progress"><span>${directionLabel(d)}</span>${steps(p.directions[d])}</div>`).join('')}<button class="button secondary-button" id="select-element" aria-pressed="${selected}">${selected ? 'Remove from selection' : 'Add to study selection'}</button><button class="button quiet" id="practice-element">Practice this element</button></div><p class="detail-note">Category colors follow PubChem. Family classifications can vary between periodic tables.</p>`;
  $('select-element').hidden = engine.state.editingSet;
}
function renderSelection() {
  const selected = engine.state.selected;
  const editing = engine.state.editingSet;
  $('make-new-set').textContent = editing ? 'Done selecting' : 'Make new set';
  $('make-new-set').setAttribute('aria-pressed', String(editing));
  $('set-selection-hint').hidden = !editing;
  $('set-selection-hint').textContent = editing ? `New set · ${selected.length} selected. Click elements to add them. Click again to remove. When ready, choose Practice selected below the table.` : '';
  $('selection-summary').innerHTML = selected.length === 118 ? 'Study set: all 118 elements' : selected.length ? `<span>${selected.length} selected</span>${selected.slice(0,12).map(n => `<span class="selected-chip">${elementOf(n).symbol}</span>`).join('')}${selected.length > 12 ? `<span>+${selected.length - 12} more</span>` : ''}` : editing ? 'New study set: choose your first element.' : 'No custom selection. Learn still uses your saved study set.';
  $('practice-selected').disabled = selected.length === 0;
  $('practice-selected').textContent = selected.length ? `Practice ${selected.length} selected` : 'Practice selection';
  $('clear-selection').disabled = selected.length === 0;
}
function renderCollection() {
  const summary = engine.summary(data.elements.map(e => e.number));
  $('overall-summary').textContent = `${summary.learned} of 118 learned`;
  $('learning-count').textContent = summary.learning + summary.unseen;
  $('learned-count').textContent = summary.learned;
  $('review-count').textContent = summary['needs-review'];
  document.querySelectorAll('[data-collection]').forEach(b => {
    b.classList.toggle('active', b.dataset.collection === engine.state.collection);
    b.setAttribute('aria-pressed', String(b.dataset.collection === engine.state.collection));
  });
  const elements = data.elements.filter(e => engine.status(e.number) === engine.state.collection || (engine.state.collection === 'learning' && engine.status(e.number) === 'unseen'));
  const empty = {learning:'All 118 elements have been learned. Retention practice keeps them fresh.', learned:'Elements move here once you can recall both their names and symbols.', 'needs-review':'No refreshers needed. Missed retention checks will appear here.'};
  $('element-collection').innerHTML = elements.length ? elements.map(e => `<button class="collection-element" style="--family:${categoryOf(e).color}" data-element="${e.number}"><strong>${e.symbol}</strong>${escape(e.name)}${mark(engine.status(e.number))}</button>`).join('') : `<p class="empty-text">${empty[engine.state.collection]}</p>`;
}
function renderExplore() {renderTable(); renderDetail(); renderSelection(); renderCollection();}
function renderGroup() {
  const s = engine.state, q = s.current, group = engine.activeGroup(), numbers = engine.groupNumbers();
  const relevantGroups = data.groups.filter(g => g.numbers.some(n => s.scope.includes(n)));
  const groupIndex = relevantGroups.findIndex(g => g.id === group?.id) + 1;
  // Show only the prompt side: never expose the current answer in the sidebar.
  const visibleDirection = q?.direction ?? s.phase;
  const r = s.round;
  const position = r ? Math.min(r.numbers.length, r.cursor + (s.feedback && q?.roundCard ? 0 : 1)) : 0;
  const passLabel = r ? `${r.type === 'choice' ? 'Multiple choice' : 'Typing'} pass · ${position} / ${r.numbers.length}` : '';
  const items = numbers.map(n => {
    const e = elementOf(n), p = s.progress[n];
    const label = visibleDirection === DIRECTIONS[0] ? e.symbol : e.name;
    return `<div class="group-item"><strong>${escape(label)}</strong>${steps(p.directions[s.phase])}</div>`;
  }).join('');
  $('group-panel').innerHTML = group ? `<div class="group-header"><span>YOUR CURRENT GROUP</span><span>${groupIndex} / ${relevantGroups.length}</span></div><h2 class="phase-title">${directionLabel(s.phase)}</h2><p class="study-label">${s.phase === DIRECTIONS[0] ? 'First, learn the names.' : 'Now, recall the symbols.'}</p><p class="study-label" style="margin-top:8px">${passLabel}</p><div class="phase-track" aria-label="${s.phase === DIRECTIONS[0] ? 'Phase 1 of 2' : 'Phase 2 of 2'}"><span class="active"></span><span class="${s.phase === DIRECTIONS[1] ? 'active' : ''}"></span></div>${items}` : '<div class="group-header"><span>KEEP IT LEARNED</span></div><h2 class="phase-title">Retention practice</h2><p class="muted">All selected elements have been learned. Check what you remember, one element at a time.</p>';
  const summary = engine.summary();
  $('study-progress').innerHTML = `<h2>Your progress</h2><div class="progress-row"><span>Learned</span><strong>${summary.learned} / ${summary.total}</strong></div><div class="progress-bar" role="progressbar" aria-label="Elements learned" aria-valuenow="${summary.learned}" aria-valuemin="0" aria-valuemax="${summary.total}"><div class="progress-fill" style="width:${summary.learned / summary.total * 100}%"></div></div><div class="progress-row"><span>Learning</span><strong>${summary.learning}</strong></div><div class="progress-row"><span>Needs review</span><strong>${summary['needs-review']}</strong></div><div class="progress-row"><span>Answers so far</span><strong>${s.answerCount}</strong></div><p class="saved-note" style="margin-top:18px">${storageAvailable ? 'Your place is saved after every answer.' : 'Progress is not being saved.'}</p>`;
  const postponed = engine.postponedCount();
  if (postponed) $('study-progress').innerHTML += `<div class="progress-row"><span>Sent to back</span><strong>${postponed}</strong></div><button id="restore-postponed" class="button quiet restore-postponed">Bring postponed elements back</button>`;
}
function renderQuestion() {
  const s = engine.state, q = s.current, f = s.feedback, e = elementOf(q.number);
  const askName = q.direction === DIRECTIONS[0];
  const prompt = askName ? e.symbol : e.name;
  const tag = q.review ? s.progress[q.number].repairDirection ? 'Refresher' : q.earlyReview ? 'Mixed review' : 'Retention check' : q.type === 'choice' ? 'Recognize' : 'Recall';
  const choices = q.type === 'choice' ? `<div class="choices">${q.options.map((n,i) => {
    const option = elementOf(n), label = askName ? option.name : option.symbol;
    const outcome = f ? n === q.number ? 'correct' : label === f.answer ? 'incorrect' : '' : '';
    return `<button class="choice ${outcome}" data-answer="${n}" ${f ? 'disabled' : ''}><span class="choice-index" aria-hidden="true">${i+1}</span><span>${escape(label)}</span>${f && n === q.number ? '<span aria-label="Correct answer">✓</span>' : ''}</button>`;
  }).join('')}</div>` : `<form id="answer-form" class="answer-form"><label class="answer-label" for="typed-answer">${askName ? 'Element name' : 'Element symbol'}</label><input id="typed-answer" class="answer-input" name="answer" type="text" aria-label="${escape(askName ? 'Element name for ' + e.symbol : 'Element symbol for ' + e.name)}" value="${escape(f ? f.answer : s.draft)}" maxlength="200" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" ${f ? 'disabled' : ''} aria-describedby="answer-help"><div class="answer-actions"><span id="answer-help" class="muted">${askName ? 'Minor spelling errors are okay.' : 'Capitalization counts. Example: Co'}</span>${!f ? '<button type="submit" class="button primary">Check answer</button>' : ''}</div><p id="answer-error" class="muted" role="alert" hidden></p></form>`;
  const feedback = f ? `<div class="feedback ${f.correct ? '' : 'incorrect'}" role="status" aria-live="polite"><h3>${escape(f.title)}</h3><p>${f.correct ? f.kind === 'typo' ? `Minor spelling error accepted. The name is <strong>${escape(e.name)}</strong>.` : `<strong>${e.symbol}</strong> is <strong>${escape(e.name)}</strong>.` : f.kind === 'capitalization' ? `${escape(e.name)} is <strong>${e.symbol}</strong>. Capitalize the first letter${e.symbol.length === 2 ? ' and keep the second lowercase' : ''}.` : `The correct answer is <strong>${escape(f.expected)}</strong>. <strong>${e.symbol}</strong> is ${escape(e.name)}.`}</p><p class="feedback-note">${escape(f.note)}</p></div><div class="continue-row"><span class="saved-note">${storageAvailable ? 'Answer saved' : 'This answer is not saved'}</span><button id="continue-question" class="button primary">Continue</button></div>` : '';
  $('question-panel').innerHTML = `<div class="question-meta"><span>${directionLabel(q.direction)}</span><span class="question-tag">${tag}</span></div><div class="question-tools"><span class="saved-note">${engine.canPostpone() ? 'Study other elements first.' : 'No other element is ready to study.'}</span><button id="postpone-element" data-question-id="${q.id}" class="button quiet" title="Move this element behind the others without grading it" ${engine.canPostpone() ? '' : 'disabled'}>Send to back</button></div>${s.notice ? `<p class="group-banner" role="status">${escape(s.notice)}</p>` : ''}<div class="question-prompt"><h2>${askName ? 'What is the name of this element?' : 'What is the symbol for this element?'}</h2><p class="${askName ? 'prompt-symbol' : 'prompt-name'}">${escape(prompt)}</p></div>${choices}${feedback}<p class="question-bottom">${q.review ? 'A little retrieval keeps this element learned.' : q.type === 'choice' ? 'Start with recognition. Typed recall comes next.' : 'Recall it twice, then move forward.'}</p>`;
}
function renderLearn() {
  engine.nextQuestion();
  $('learn-subtitle').textContent = engine.state.scope.length === 118 ? 'All 118 elements, one small group at a time.' : `${engine.state.scope.length} selected elements. Your progress in the full table stays saved.`;
  renderGroup(); renderQuestion();
}
function render() {
  const learn = engine.state.view === 'learn';
  $('explore-view').hidden = learn; $('learn-view').hidden = !learn;
  $('explore-tab').classList.toggle('active', !learn); $('learn-tab').classList.toggle('active', learn);
  $('explore-tab').removeAttribute('aria-current'); $('learn-tab').removeAttribute('aria-current');
  if (learn) {$('learn-tab').setAttribute('aria-current', 'page'); renderLearn();}
  else {$('explore-tab').setAttribute('aria-current', 'page'); renderExplore();}
  const summary = engine.summary(data.elements.map(e => e.number));
  $('learn-tab-count').textContent = `${summary.learned} / 118`;
  storageWarning();
}
function focusQuestion() {
  const target = engine.state.feedback ? $('continue-question') : $('typed-answer') ?? $('question-panel').querySelector('.choice');
  target?.focus({preventScroll:true});
}
function showView(view) {
  engine.state.view = view;
  if (view === 'learn') engine.state.editingSet = false;
  render(); save();
  window.scrollTo({top:0, behavior:'auto'});
  if (view === 'learn') focusQuestion();
}
function startPractice(numbers) {
  engine.setFocus(numbers);
  engine.state.selected = [...numbers];
  showView('learn');
  return engine.summary();
}
function submitAnswer(answer) {
  try {if (engine.answer(answer)) {render(); save(); focusQuestion();}}
  catch(error) {const p = $('answer-error'); if(p) {p.textContent = error.message; p.hidden = false;} else {$('app-error').textContent = error.message; $('app-error').hidden = false;}}
}
function continueQuestion() {if(engine.continue()) {render(); save(); focusQuestion();}}
function postponeElement(questionId) {if(engine.postponeCurrent(questionId)) {render(); save(); focusQuestion();}}
function toggleSelected(number) {
  const selected = new Set(engine.state.selected);
  selected.has(number) ? selected.delete(number) : selected.add(number);
  engine.state.selected = [...selected];
}
function selectionChanged(focusTarget = null) {
  engine.state.selected = [...new Set(engine.state.selected)].sort((a,b) => a-b);
  renderExplore(); save();
  focusTarget?.()?.focus({preventScroll:true});
}
document.addEventListener('click', event => {
  if (engine && event.target.closest('#home-link')) {event.preventDefault(); showView('explore'); return;}
  const b = event.target.closest('button');
  if(!b || !engine || b.disabled) return;
  if(b.dataset.element) {
    selectedNumber = +b.dataset.element; engine.state.selectedNumber = selectedNumber;
    if (engine.state.editingSet) toggleSelected(selectedNumber);
    selectionChanged(() => $('periodic-table').querySelector(`[data-element="${selectedNumber}"]`));
  }
  else if(b.dataset.family) {
    const family = data.elements.filter(e => e.category === b.dataset.family).map(e => e.number);
    const selected = new Set(engine.state.selected), all = family.every(n => selected.has(n));
    family.forEach(n => all ? selected.delete(n) : selected.add(n)); engine.state.selected = [...selected];
    selectionChanged(() => $('category-legend').querySelector(`[data-family="${b.dataset.family}"]`));
  } else if(b.dataset.collection) {engine.state.collection = b.dataset.collection; renderCollection(); save();}
  else if(b.dataset.answer) submitAnswer(+b.dataset.answer);
  else switch(b.id) {
    case 'explore-tab': case 'change-study-set': showView('explore'); break;
    case 'learn-tab': showView('learn'); break;
    case 'practice-all': startPractice(data.elements.map(e => e.number)); break;
    case 'practice-selected': startPractice(engine.state.selected); break;
    case 'practice-element': startPractice([selectedNumber]); break;
    case 'make-new-set':
      if (!engine.state.editingSet) engine.state.selected = [];
      engine.state.editingSet = !engine.state.editingSet;
      selectionChanged(() => $('make-new-set')); break;
    case 'select-element': {
      toggleSelected(selectedNumber); selectionChanged(() => $('select-element')); break;
    }
    case 'clear-selection': engine.state.selected = []; selectionChanged(); break;
    case 'continue-question': continueQuestion(); break;
    case 'postpone-element': postponeElement(b.dataset.questionId); break;
    case 'restore-postponed': if(engine.restorePostponed()) {render(); save(); focusQuestion();} break;
    case 'reset-progress': $('reset-dialog').showModal(); break;
    case 'confirm-reset':
      engine = new LearningEngine(data); selectedNumber = engine.state.selectedNumber;
      $('reset-dialog').close(); render(); save(); $('explore-tab').focus(); break;
  }
});
document.addEventListener('submit', event => {
  if(event.target.id === 'answer-form') {event.preventDefault(); submitAnswer($('typed-answer').value);}
});
document.addEventListener('input', event => {
  if(event.target.id === 'typed-answer' && !engine.state.feedback) {engine.state.draft = event.target.value; save();}
});
document.addEventListener('keydown', event => {
  if(!engine || engine.state.view !== 'learn' || $('reset-dialog').open || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  const q = engine.state.current;
  if(event.key === 'Enter' && engine.state.feedback) {event.preventDefault(); continueQuestion();}
  else if(q.type === 'choice' && !engine.state.feedback && /^[1-4]$/.test(event.key) && !event.target.matches('input,textarea')) {event.preventDefault(); submitAnswer(q.options[+event.key-1]);}
});

function registerTools() {
  const context = document.modelContext;
  if(!context?.registerTool) return;
  const lifecycle = new AbortController();
  const register = tool => {
    try {Promise.resolve(context.registerTool(tool, {signal:lifecycle.signal})).catch(error => console.warn('WebMCP registration unavailable:', error.message));}
    catch(error) {console.warn('WebMCP registration unavailable:', error.message);}
  };
  register({name:'read_study_progress', title:'Read element progress', description:'Read the current study selection, progress counts, and learning status without answering questions.',
    inputSchema:{type:'object', properties:{}, additionalProperties:false}, annotations:{readOnlyHint:true, untrustedContentHint:false},
    execute(input) {if(!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw Error('Expected an empty object.'); return {scope:[...engine.state.scope], summary:engine.summary(), answerCount:engine.state.answerCount, elements:data.elements.map(e => ({number:e.number,status:engine.status(e.number)}))};}});
  register({name:'set_study_selection', title:'Choose elements to study', description:'Select a nonempty list of atomic numbers and open Learn. Keeps existing progress and clears the current question only when the selection changes.',
    inputSchema:{type:'object', properties:{numbers:{type:'array',items:{type:'integer',minimum:1,maximum:118},minItems:1,maxItems:118,uniqueItems:true}}, required:['numbers'], additionalProperties:false}, annotations:{readOnlyHint:false,untrustedContentHint:false},
    execute(input) {if(!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => k !== 'numbers')) throw Error('Expected only numbers.'); const summary = startPractice(input.numbers); return {scope:[...engine.state.scope], summary, view:engine.state.view};}});
  window.addEventListener('pagehide', () => lifecycle.abort(), {once:true});
}
try {
  const response = await fetch('./data/elements.json');
  if(!response.ok) throw Error('Element data could not be loaded. Restart the local app and refresh.');
  data = await response.json();
  let saved = null, raw = null;
  try {raw = localStorage.getItem(STORAGE_KEY);}
  catch {storageAvailable = false; storageMessage = 'Your browser cannot save progress. You can keep studying, but this session will be lost when you close or reload the page.';}
  if(raw) {
    try {saved = JSON.parse(raw); engine = new LearningEngine(data, saved);}
    catch {
      storageMessage = 'Saved progress could not be read, so a fresh session has been opened. A copy of the unreadable save is kept in browser storage when possible.';
      try {localStorage.setItem(STORAGE_KEY + ':unreadable-backup', raw);} catch {}
    }
  }
  engine ??= new LearningEngine(data);
  selectedNumber = engine.state.selectedNumber;
  render(); save(); registerTools();
} catch(error) {
  $('app-error').textContent = error.message;
  $('app-error').hidden = false;
  ['make-new-set','practice-all','practice-selected','learn-tab'].forEach(id => $(id).disabled = true);
}
