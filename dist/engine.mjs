export const STORAGE_KEY = 'element-learn:session:v1';
export const VERSION = 3;
export const GROUP_SIZE = 10;
export const DIRECTIONS = ['symbol-to-name', 'name-to-symbol'];
export const REVIEW_INTERVALS = [10, 30, 60, 120];
export const LEARNING_BETWEEN_REVIEWS = 4;
const opposite = direction => DIRECTIONS.find(d => d !== direction);
const normalize = value => String(value).trim().toLowerCase();
const clone = value => JSON.parse(JSON.stringify(value));
const integer = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min && value <= max;

export function editDistance(a, b) {
  const d = Array.from({length: a.length + 1}, (_, i) => Array.from({length: b.length + 1}, (_, j) => i ? j ? 0 : i : j));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + Number(a[i-1] !== b[j-1]));
    if (i > 1 && j > 1 && a[i-1] === b[j-2] && a[i-2] === b[j-1]) d[i][j] = Math.min(d[i][j], d[i-2][j-2] + 1);
  }
  return d[a.length][b.length];
}
function prefix(a, b) {
  let i = 0;
  while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
  return i;
}
export function similarityComparator(anchor) {
  const name = normalize(anchor.name);
  return (a, b) => prefix(name, normalize(b.name)) - prefix(name, normalize(a.name))
    || Number(b.symbol[0] === anchor.symbol[0]) - Number(a.symbol[0] === anchor.symbol[0])
    || editDistance(name, normalize(a.name)) - editDistance(name, normalize(b.name))
    || a.number - b.number;
}
function buildClusters(elements) {
  const first = ['Ag', 'Ar', 'As', 'At', 'Au'].map(symbol => elements.find(e => e.symbol === symbol).number);
  const groups = [{id: 'group-01', numbers: first}];
  let remaining = elements.filter(e => !first.includes(e.number)).sort((a, b) => a.number - b.number);
  while (remaining.length) {
    const anchor = remaining[0];
    const numbers = [anchor, ...remaining.slice(1).sort(similarityComparator(anchor)).slice(0, 4)].map(e => e.number);
    groups.push({id: `group-${String(groups.length + 1).padStart(2, '0')}`, numbers});
    remaining = remaining.filter(e => !numbers.includes(e.number));
  }
  return groups;
}
export function buildGroups(elements) {
  const clusters = buildClusters(elements);
  const groups = [];
  for (let i = 0; i < clusters.length; i += 2) {
    groups.push({id: `group-${String(groups.length + 1).padStart(2, '0')}`,
      numbers: clusters.slice(i, i + 2).flatMap(g => g.numbers)});
  }
  return groups;
}
function shuffled(values, seed, previous) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  if (result.length > 1 && result[0] === previous) [result[0], result[1]] = [result[1], result[0]];
  return result;
}
export function gradeAnswer(elements, number, direction, answer) {
  const element = elements.find(e => e.number === number);
  const entered = String(answer).trim();
  const expected = direction === 'symbol-to-name' ? element.name : element.symbol;
  if (direction === 'name-to-symbol') return {correct: entered === expected, expected, kind: entered === expected ? 'exact' : entered.toLowerCase() === expected.toLowerCase() ? 'capitalization' : 'wrong'};
  const text = normalize(entered);
  const names = e => [e.name, ...e.aliases].map(normalize);
  if (names(element).includes(text)) return {correct: true, expected, kind: text === normalize(element.name) ? 'exact' : 'alias'};
  if (elements.some(e => e.number !== number && names(e).includes(text))) return {correct: false, expected, kind: 'wrong'};
  const matches = elements.filter(e => names(e).some(name => editDistance(text, name) <= 1));
  const correct = matches.length === 1 && matches[0].number === number;
  return {correct, expected, kind: correct ? 'typo' : 'wrong'};
}
const directionProgress = () => ({recognized: false, streak: 0, lastAsked: -100});
export function freshState(data) {
  return {version: VERSION, scope: data.elements.map(e => e.number), view: 'explore', selected: data.elements.map(e => e.number), selectedNumber: 47, editingSet: false,
    collection: 'learning', answerCount: 0, correctCount: 0, learningSinceReview: 0, questionSerial: 0,
    activeGroupId: null, phase: DIRECTIONS[0], current: null, feedback: null, draft: '', notice: '',
    round: null, roundSerial: 0, lastQuestionNumber: 0, deferred: [],
    progress: Object.fromEntries(data.elements.map(e => [e.number, {
      directions: Object.fromEntries(DIRECTIONS.map(d => [d, directionProgress()])),
      learnedAt: null, lastReview: -1, reviewLevel: 0, due: null, reviewDirection: DIRECTIONS[0], repairDirection: null, reviewHoldUntil: 0
    }]))};
}

function validateState(data, state, version = VERSION) {
  const ids = new Set(data.elements.map(e => e.number));
  const idList = (values, allowEmpty = false) => Array.isArray(values) && (allowEmpty || values.length > 0)
    && values.length <= ids.size && new Set(values).size === values.length && values.every(n => ids.has(n));
  if (!state || state.version !== version || !idList(state.scope) || !idList(state.selected, true)
    || (state.editingSet !== undefined && typeof state.editingSet !== 'boolean')
    || !ids.has(state.selectedNumber) || !['explore', 'learn'].includes(state.view)
    || !['learning', 'learned', 'needs-review'].includes(state.collection)
    || !integer(state.answerCount) || !integer(state.correctCount, 0, state.answerCount)
    || !integer(state.learningSinceReview, 0, state.answerCount) || !integer(state.questionSerial, state.answerCount)
    || !DIRECTIONS.includes(state.phase) || !(state.activeGroupId === null || data.groups.some(g => g.id === state.activeGroupId))
    || typeof state.draft !== 'string' || state.draft.length > 200 || typeof state.notice !== 'string' || state.notice.length > 300) return false;
  for (const number of ids) {
    const p = state.progress?.[number];
    if (!p || !(p.learnedAt === null || integer(p.learnedAt, 1, state.answerCount))
      || !integer(p.lastReview, -1, state.answerCount) || !integer(p.reviewLevel, 0, 3)
      || !(p.due === null || integer(p.due)) || !DIRECTIONS.includes(p.reviewDirection)
      || !(p.repairDirection === null || DIRECTIONS.includes(p.repairDirection))) return false;
    if (version >= 3 && !integer(p.reviewHoldUntil)) return false;
    for (const direction of DIRECTIONS) {
      const d = p.directions?.[direction];
      if (!d || typeof d.recognized !== 'boolean' || !integer(d.streak, 0, 2)
        || !integer(d.lastAsked, -100, state.answerCount) || (!d.recognized && d.streak !== 0)) return false;
    }
    if (p.learnedAt === null && (p.repairDirection !== null || p.due !== null)) return false;
    if (p.learnedAt !== null && p.repairDirection === null && DIRECTIONS.some(d => p.directions[d].streak !== 2)) return false;
  }
  if (state.current !== null) {
    const q = state.current;
    if (!q || q.id !== `q-${state.questionSerial}` || !state.scope.includes(q.number) || !DIRECTIONS.includes(q.direction)
      || !['choice', 'typed'].includes(q.type) || typeof q.review !== 'boolean' || !Array.isArray(q.options)
      || (q.type === 'choice' && (q.review || q.options.length !== 4 || !idList(q.options) || !q.options.includes(q.number)))
      || (q.type === 'typed' && q.options.length !== 0)) return false;
  }
  if (state.feedback !== null) {
    const f = state.feedback;
    if (!state.current || !f || f.questionId !== state.current.id || typeof f.correct !== 'boolean'
      || typeof f.answer !== 'string' || f.answer.length > 200 || typeof f.expected !== 'string'
      || typeof f.title !== 'string' || typeof f.note !== 'string'
      || !['exact', 'alias', 'typo', 'capitalization', 'wrong'].includes(f.kind)) return false;
  }
  if (version >= 3 && (!idList(state.deferred, true) || state.deferred.some(n => state.progress[n].learnedAt !== null))) return false;
  if (version >= 2) {
    if (!integer(state.roundSerial) || !(state.lastQuestionNumber === 0 || ids.has(state.lastQuestionNumber))) return false;
    const r = state.round;
    if (r !== null) {
      const group = data.groups.find(g => g.id === r?.groupId);
      if (!group || state.activeGroupId !== r.groupId || state.phase !== r.direction
        || !DIRECTIONS.includes(r.direction) || !['choice', 'typed'].includes(r.type)
        || !idList(r.numbers) || !integer(r.cursor, 0, r.numbers.length)
        || r.numbers.some(n => !group.numbers.includes(n) || !state.scope.includes(n))) return false;
      const expected = group.numbers.filter(n => state.scope.includes(n));
      if (version === 2 && r.numbers.length !== expected.length) return false;
    }
    if (state.current) {
      const q = state.current;
      if (typeof q.roundCard !== 'boolean') return false;
      if (q.earlyReview !== undefined && typeof q.earlyReview !== 'boolean') return false;
      if (q.roundCard && (!r || q.number !== r.numbers[r.cursor - Number(state.feedback !== null)]
        || (!q.review && q.direction !== r.direction))) return false;
    }
  }
  return true;
}

export class LearningEngine {
  constructor(data, saved = null) {
    this.data = data;
    this.byNumber = new Map(data.elements.map(e => [e.number, e]));
    if (saved?.version === 1) {
      if (!validateState({...data, groups: buildClusters(data.elements)}, saved, 1)) throw Error('Saved progress could not be read.');
      saved = clone(saved);
      saved.version = 2;
      saved.scope = data.elements.map(e => e.number);
      saved.selected = [...saved.scope];
      saved.editingSet = false;
      const oldGroup = buildClusters(data.elements).find(g => g.id === saved.activeGroupId);
      const anchor = saved.current?.number ?? oldGroup?.numbers[0];
      saved.activeGroupId = data.groups.find(g => g.numbers.includes(anchor))?.id ?? null;
      saved.round = null; saved.roundSerial = 0;
      saved.lastQuestionNumber = saved.feedback ? saved.current.number : 0;
      if (saved.current) saved.current.roundCard = false;
    }
    if (saved?.version === 2) {
      if (!validateState(data, saved, 2)) throw Error('Saved progress could not be read.');
      saved = clone(saved); saved.version = VERSION; saved.deferred = [];
      for (const p of Object.values(saved.progress)) p.reviewHoldUntil = 0;
    }
    if (saved !== null && !validateState(data, saved)) throw Error('Saved progress could not be read.');
    this.state = saved === null ? freshState(data) : clone(saved);
    this.state.editingSet ??= false;
    if (!this.state.current) this.syncGroup();
  }
  snapshot() { return clone(this.state); }
  status(number) {
    const p = this.state.progress[number];
    if (p.repairDirection) return 'needs-review';
    if (p.learnedAt !== null) return 'learned';
    if (DIRECTIONS.some(d => p.directions[d].lastAsked >= 0)) return 'learning';
    return 'unseen';
  }
  summary(numbers = this.state.scope) {
    const summary = {total: numbers.length, unseen: 0, learning: 0, learned: 0, 'needs-review': 0};
    numbers.forEach(n => summary[this.status(n)]++);
    return summary;
  }
  activeGroup() {
    return this.data.groups.find(g => g.id === this.state.activeGroupId) ?? null;
  }
  primaryUnlearned() {
    return this.state.scope.filter(n => this.state.progress[n].learnedAt === null && !this.state.deferred.includes(n));
  }
  groupNumbers(group = this.activeGroup()) {
    const later = this.primaryUnlearned().length === 0;
    return group ? group.numbers.filter(n => this.state.scope.includes(n)
      && (this.state.progress[n].learnedAt === null || this.state.progress[n].reviewHoldUntil <= this.state.answerCount)
      && (later ? this.state.deferred.includes(n) || this.state.progress[n].learnedAt !== null : !this.state.deferred.includes(n))) : [];
  }
  syncGroup() {
    const s = this.state;
    if (s.round && s.round.cursor < s.round.numbers.length) {
      s.activeGroupId = s.round.groupId; s.phase = s.round.direction; return;
    }
    s.round = null;
    const unfinished = g => this.groupNumbers(g).some(n => s.progress[n].learnedAt === null);
    let group = this.activeGroup();
    const firstLater = !this.primaryUnlearned().length ? s.deferred.find(n => s.scope.includes(n)) : undefined;
    if (firstLater !== undefined) group = this.data.groups.find(g => g.numbers.includes(firstLater));
    else if (!group || !unfinished(group)) group = this.data.groups.find(unfinished) ?? null;
    const previousGroup = s.activeGroupId, previousPhase = s.phase;
    s.activeGroupId = group?.id ?? null;
    const numbers = this.groupNumbers(group).filter(n => s.progress[n].learnedAt === null);
    s.phase = numbers.some(n => s.progress[n].directions[DIRECTIONS[0]].streak < 2) ? DIRECTIONS[0] : DIRECTIONS[1];
    if (previousGroup && previousGroup !== s.activeGroupId) s.notice = group ? 'Group learned. Meet your next group.' : 'Every selected element is learned. Keep practicing to retain them.';
    else if (previousGroup && previousPhase !== s.phase && group) s.notice = s.phase === DIRECTIONS[1]
      ? 'Names learned. Now turn them back into symbols.' : 'First, recall the element names.';
  }
  setFocus(numbers) {
    if (!Array.isArray(numbers) || !numbers.length || numbers.some(n => !this.byNumber.has(n)) || new Set(numbers).size !== numbers.length) throw Error('Choose at least one valid element.');
    const scope = [...numbers].sort((a, b) => a - b);
    if (JSON.stringify(scope) === JSON.stringify([...this.state.scope].sort((a, b) => a - b))) return;
    this.state.scope = scope;
    this.state.current = null;
    this.state.feedback = null;
    this.state.draft = '';
    this.state.round = null;
    this.state.notice = 'Study set changed. Your progress is preserved.';
    this.syncGroup();
  }
  canPostpone() {
    const s = this.state;
    return !!s.current && s.scope.some(n => n !== s.current.number
      && (s.progress[n].learnedAt === null || s.progress[n].reviewHoldUntil <= s.answerCount));
  }
  postponeCurrent(questionId = this.state.current?.id) {
    const s = this.state, q = s.current;
    if (!this.canPostpone() || questionId !== q.id) return false;
    const p = s.progress[q.number], primary = this.primaryUnlearned().length > 0;
    const prompt = q.direction === DIRECTIONS[0] ? this.byNumber.get(q.number).symbol : this.byNumber.get(q.number).name;
    if (p.learnedAt === null) s.deferred = [...s.deferred.filter(n => n !== q.number), q.number];
    else p.reviewHoldUntil = s.answerCount + Math.max(1, s.scope.length - 1);
    if (s.round) {
      const index = s.round.numbers.indexOf(q.number);
      if (index >= 0) {
        s.round.numbers.splice(index, 1);
        if (index < s.round.cursor) s.round.cursor--;
        // Once only postponed elements remain, move this card to the end of its pass.
        if (!primary && p.learnedAt === null) s.round.numbers.push(q.number);
      }
      const nextLater = s.deferred.find(n => s.scope.includes(n));
      if (!s.round.numbers.length || (!primary && nextLater !== undefined
        && !this.activeGroup()?.numbers.includes(nextLater))) s.round = null;
      if (!primary && s.round?.numbers.slice(s.round.cursor).every(n => n === q.number)) s.round = null;
    }
    s.current = null; s.feedback = null; s.draft = ''; s.lastQuestionNumber = q.number;
    this.nextQuestion(q.number);
    s.notice = `${prompt} sent to the back. Other elements come first; your learning progress is unchanged.`;
    return true;
  }
  postponedCount() {
    return this.state.scope.filter(n => this.state.deferred.includes(n)
      || this.state.progress[n].reviewHoldUntil > this.state.answerCount).length;
  }
  restorePostponed() {
    const s = this.state;
    if (!this.postponedCount()) return false;
    s.deferred = s.deferred.filter(n => !s.scope.includes(n));
    s.scope.forEach(n => s.progress[n].reviewHoldUntil = 0);
    s.round = null;
    if (s.current) s.current.roundCard = false;
    s.notice = 'Postponed elements are back in normal practice.';
    if (!s.current) this.syncGroup();
    return true;
  }
  optionsFor(number, groupNumbers) {
    const element = this.byNumber.get(number), compare = similarityComparator(element);
    const peers = groupNumbers.filter(n => n !== number).map(n => this.byNumber.get(n)).sort(compare);
    const others = this.data.elements.filter(e => e.number !== number && !groupNumbers.includes(e.number)).sort(compare);
    const choices = [number, ...[...peers, ...others].slice(0, 3).map(e => e.number)];
    let seed = this.state.questionSerial;
    for (let i = choices.length - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    return choices;
  }
  nextQuestion(avoidNumber = 0) {
    const s = this.state;
    if (s.current) return s.current;
    this.syncGroup();
    const groupNumbers = this.groupNumbers();
    if (groupNumbers.length && !s.round) {
      s.roundSerial++;
      const type = groupNumbers.some(n => s.progress[n].directions[s.phase].lastAsked < 0) ? 'choice' : 'typed';
      s.round = {groupId: s.activeGroupId, direction: s.phase, type, cursor: 0,
        numbers: shuffled(groupNumbers, s.roundSerial * 7919 + s.answerCount * 101, s.lastQuestionNumber)};
    }
    const allReviews = s.scope.filter(n => s.progress[n].learnedAt !== null);
    let reviews = allReviews.filter(n => s.progress[n].reviewHoldUntil <= s.answerCount);
    if (!groupNumbers.length && !reviews.length) reviews = allReviews;
    const due = reviews.filter(n => s.progress[n].due <= s.answerCount)
      .sort((a, b) => s.progress[a].due - s.progress[b].due || s.progress[a].lastReview - s.progress[b].lastReview || a - b);
    let number, direction, review, roundCard = false;
    const pending = s.round?.numbers.slice(s.round.cursor) ?? [];
    const otherDue = due.filter(n => n !== pending[0] && n !== s.lastQuestionNumber);
    const otherReviews = reviews.filter(n => n !== pending[0] && n !== s.lastQuestionNumber)
      .sort((a, b) => Number(groupNumbers.includes(a)) - Number(groupNumbers.includes(b))
        || s.progress[a].lastReview - s.progress[b].lastReview
        || s.progress[a].learnedAt - s.progress[b].learnedAt || a - b);
    const mixedReview = otherDue[0] ?? otherReviews[0];
    if (pending.length && !(mixedReview !== undefined
      && (s.learningSinceReview >= LEARNING_BETWEEN_REVIEWS || pending[0] === avoidNumber))) {
      if (pending.length > 1 && pending[0] === s.lastQuestionNumber) {
        const i = s.round.cursor;
        [s.round.numbers[i], s.round.numbers[i+1]] = [s.round.numbers[i+1], s.round.numbers[i]];
      }
      number = s.round.numbers[s.round.cursor]; direction = s.round.direction;
      review = s.progress[number].learnedAt !== null; roundCard = true;
      if (review) direction = s.progress[number].repairDirection ?? s.progress[number].reviewDirection;
    } else {
      number = pending.length ? mixedReview : otherDue[0] ?? due[0] ?? [...reviews].sort((a, b) => Number(!!s.progress[b].repairDirection) - Number(!!s.progress[a].repairDirection)
        || s.progress[a].lastReview - s.progress[b].lastReview || a - b)[0];
      if (number === undefined) throw Error('No elements available to study.');
      direction = s.progress[number].repairDirection ?? s.progress[number].reviewDirection; review = true;
    }
    const type = review ? 'typed' : s.round.type;
    s.questionSerial++;
    s.current = {id: `q-${s.questionSerial}`, number, direction, review, roundCard, earlyReview: review && s.progress[number].due > s.answerCount, type, options: type === 'choice' ? this.optionsFor(number, groupNumbers) : []};
    return s.current;
  }
  answer(answer) {
    const s = this.state, q = s.current;
    if (!q || s.feedback) return false;
    if (q.type === 'choice' && !q.options.includes(answer)) throw Error('Choose one of the displayed answers.');
    if (q.type === 'typed' && (typeof answer !== 'string' || !answer.trim() || answer.length > 200)) throw Error('Enter an answer first.');
    const e = this.byNumber.get(q.number), p = s.progress[q.number], d = p.directions[q.direction];
    const entered = q.type === 'choice' ? (q.direction === DIRECTIONS[0] ? this.byNumber.get(answer).name : this.byNumber.get(answer).symbol) : answer;
    const result = q.type === 'choice'
      ? {correct: answer === q.number, expected: q.direction === DIRECTIONS[0] ? e.name : e.symbol, kind: answer === q.number ? 'exact' : 'wrong'}
      : gradeAnswer(this.data.elements, q.number, q.direction, answer);
    s.answerCount++;
    if (result.correct) s.correctCount++;
    d.lastAsked = s.answerCount;
    s.lastQuestionNumber = q.number;
    if (q.roundCard) s.round.cursor++;
    let title = result.correct ? 'Correct.' : 'Keep this one in mind.';
    let note = result.correct ? 'You’ll recall this again before it is learned.' : 'This will return for another try.';
    if (q.review) {
      s.learningSinceReview = 0;
      p.lastReview = s.answerCount;
      if (!result.correct) {
        p.repairDirection = q.direction; d.streak = 0; d.recognized = true;
        p.reviewLevel = 0; p.due = s.answerCount + 3;
        title = 'Time for a refresher.'; note = 'Moved to Needs review. Recall this direction twice to restore Learned.';
      } else if (p.repairDirection) {
        d.streak = Math.min(2, d.streak + 1);
        p.due = s.answerCount + 3;
        note = 'One more correct recall will restore Learned.';
        if (d.streak === 2) {
          p.repairDirection = null; p.reviewLevel = 0; p.due = s.answerCount + REVIEW_INTERVALS[0];
          p.reviewDirection = opposite(q.direction); title = 'Back in Learned.'; note = 'A retention check will return after 10 more answers.';
        }
      } else if (q.earlyReview) {
        p.reviewDirection = opposite(q.direction);
        title = 'Still got it.'; note = 'Keeping older elements in the mix. Your scheduled retention check stays in place.';
      } else {
        p.reviewLevel = Math.min(3, p.reviewLevel + 1);
        p.due = s.answerCount + REVIEW_INTERVALS[p.reviewLevel]; p.reviewDirection = opposite(q.direction);
        title = 'Still got it.'; note = `Next check after ${REVIEW_INTERVALS[p.reviewLevel]} more answers, in the other direction.`;
      }
    } else {
      s.learningSinceReview++;
      if (result.correct) {
        if (q.type === 'choice') {d.recognized = true; note = 'Typing starts after the group’s multiple-choice pass.';}
        else {d.recognized = true; d.streak = Math.min(2, d.streak + 1); note = d.streak === 2 ? 'This direction is learned.' : 'One more correct typed recall in a later pass to learn this direction.';}
      } else d.streak = 0;
      if (DIRECTIONS.every(direction => p.directions[direction].streak === 2)) {
        p.learnedAt = s.answerCount; p.due = s.answerCount + REVIEW_INTERVALS[0];
        s.deferred = s.deferred.filter(n => n !== q.number);
        title = 'Element learned.'; note = 'Both directions learned. It will return for a retention check.';
      }
    }
    s.feedback = {questionId: q.id, answer: String(entered), ...result, title, note};
    return true;
  }
  continue() {
    if (!this.state.feedback) return false;
    this.state.current = null; this.state.feedback = null; this.state.draft = ''; this.state.notice = '';
    this.nextQuestion();
    return true;
  }
}
