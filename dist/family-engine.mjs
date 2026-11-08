export const FAMILY_STORAGE_KEY = 'element-learn:families:v1';
export const FAMILY_VERSION = 1;
export const FAMILY_BATCH_SIZE = 50;
export const FAMILY_PASSES = 3;
const copy = value => JSON.parse(JSON.stringify(value));
const integer = (n, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= min && n <= max;
function shuffle(values, seed, previous = 0) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  if (result.length > 1 && result[0] === previous) [result[0], result[1]] = [result[1], result[0]];
  return result;
}
const confusable = {
  'alkali-metal': ['alkaline-earth-metal'], 'alkaline-earth-metal': ['alkali-metal'],
  'transition-metal': ['post-transition-metal'], 'post-transition-metal': ['transition-metal', 'metalloid'],
  metalloid: ['nonmetal', 'post-transition-metal'], nonmetal: ['metalloid', 'halogen'],
  halogen: ['noble-gas', 'nonmetal'], 'noble-gas': ['halogen'],
  lanthanide: ['actinide', 'transition-metal'], actinide: ['lanthanide', 'transition-metal']
};
function initialState(data) {
  return {version:FAMILY_VERSION, view:'play', mode:'all', colors:false, studyNumber:1,
    answerCount:0, questionSerial:0, shuffleSerial:0, batchSerial:0, lastNumber:0,
    decks:{all:{numbers:[],cursor:0}, missed:{numbers:[],cursor:0}},
    sessions:{all:null,missed:null},
    progress:Object.fromEntries(data.elements.map(e=>[e.number,{correct:0,wrong:0,lastAnswered:-1,lastMiss:-1}]))};
}
function validState(data, s) {
  const ids=new Set(data.elements.map(e=>e.number)), categories=new Set(data.categories.map(c=>c.id));
  const list=(numbers, max=118)=>Array.isArray(numbers) && numbers.length<=max
    && new Set(numbers).size===numbers.length && numbers.every(n=>ids.has(n));
  if(!s || s.version!==FAMILY_VERSION || !['play','study'].includes(s.view) || !['all','missed'].includes(s.mode)
    || typeof s.colors!=='boolean' || !ids.has(s.studyNumber) || !(s.lastNumber===0 || ids.has(s.lastNumber))
    || !integer(s.answerCount) || !integer(s.questionSerial,s.answerCount) || !integer(s.shuffleSerial) || !integer(s.batchSerial)) return false;
  let answered=0;
  for(const n of ids) {
    const p=s.progress?.[n];
    if(!p || !integer(p.correct) || !integer(p.wrong) || !integer(p.lastAnswered,-1,s.answerCount)
      || !integer(p.lastMiss,-1,s.answerCount) || p.lastMiss>p.lastAnswered
      || ((p.correct+p.wrong===0)!==(p.lastAnswered===-1)) || ((p.wrong===0)!==(p.lastMiss===-1))) return false;
    answered+=p.correct+p.wrong;
  }
  if(answered!==s.answerCount) return false;
  const questionIds=[];
  for(const mode of ['all','missed']) {
    const deck=s.decks?.[mode], b=s.sessions?.[mode];
    if(!deck || !list(deck.numbers) || !integer(deck.cursor,0,deck.numbers.length)
      || (mode==='all' && deck.numbers.length!==0 && deck.numbers.length!==ids.size)
      || (mode==='missed' && deck.numbers.some(n=>!s.progress[n].wrong))) return false;
    if(b===null) continue;
    if(!b || !integer(b.id,1,s.batchSerial) || b.mode!==mode || !list(b.numbers,FAMILY_BATCH_SIZE) || !b.numbers.length
      || !Array.isArray(b.queue) || b.queue.length!==b.numbers.length*FAMILY_PASSES
      || !integer(b.position,0,Math.min(b.queue.length,s.answerCount)) || !integer(b.correct,0,b.position) || !integer(b.wrong,0,b.position)
      || b.correct+b.wrong!==b.position) return false;
    for(let pass=0;pass<FAMILY_PASSES;pass++) {
      const part=b.queue.slice(pass*b.numbers.length,(pass+1)*b.numbers.length);
      if(!list(part) || part.some(n=>!b.numbers.includes(n))) return false;
    }
    if(b.current===null) {if(b.position!==b.queue.length || b.feedback!==null) return false;continue;}
    const q=b.current, f=b.feedback;
    if(!q || !/^f-q-[1-9][0-9]*$/.test(q.id) || !integer(Number(q.id.slice(4)),1,s.questionSerial)
      || q.number!==b.queue[b.position-Number(f!==null)] || !Array.isArray(q.options) || q.options.length!==Math.min(4,categories.size)
      || new Set(q.options).size!==q.options.length || q.options.some(c=>!categories.has(c))
      || !q.options.includes(data.elements.find(e=>e.number===q.number)?.category)) return false;
    questionIds.push(q.id);
    if(f!==null && (!f || f.questionId!==q.id || !q.options.includes(f.answer)
      || f.expected!==data.elements.find(e=>e.number===q.number).category || f.correct!==(f.answer===f.expected))) return false;
  }
  return new Set(questionIds).size===questionIds.length;
}

export class FamilyEngine {
  constructor(data,saved=null) {
    this.data=data;this.byNumber=new Map(data.elements.map(e=>[e.number,e]));
    if(saved!==null && !validState(data,saved)) throw Error('Saved family-game progress could not be read.');
    this.state=saved===null?initialState(data):copy(saved);
  }
  snapshot(){return copy(this.state);}
  active(){return this.state.sessions[this.state.mode];}
  completed(batch=this.active()){return !!batch && batch.position===batch.queue.length && batch.feedback===null;}
  totals() {
    const correct=Object.values(this.state.progress).reduce((sum,p)=>sum+p.correct,0);
    return {correct,wrong:this.state.answerCount-correct,answers:this.state.answerCount,
      accuracy:this.state.answerCount?Math.round(correct/this.state.answerCount*100):null,missed:this.missedNumbers().length};
  }
  missedNumbers() {
    return this.data.elements.map(e=>e.number).filter(n=>this.state.progress[n].wrong>0)
      .sort((a,b)=>{const x=this.state.progress[a],y=this.state.progress[b];return y.wrong-x.wrong
        || y.wrong/(y.correct+y.wrong)-x.wrong/(x.correct+x.wrong) || y.lastMiss-x.lastMiss || a-b;});
  }
  shuffled(numbers,previous=0){this.state.shuffleSerial++;return shuffle(numbers,this.state.shuffleSerial*7919+this.state.answerCount*101,previous);}
  start(mode='all') {
    if(!['all','missed'].includes(mode)) throw Error('Choose all elements or missed elements.');
    if(mode==='missed' && !this.missedNumbers().length) return false;
    const s=this.state, saved=s.sessions[mode];
    s.mode=mode;s.view='play';
    if(saved && !this.completed(saved)) return true;
    const deck=s.decks[mode];
    if(deck.cursor===deck.numbers.length) {
      deck.numbers=mode==='all'?this.shuffled(this.data.elements.map(e=>e.number),s.lastNumber):this.missedNumbers();
      deck.cursor=0;
    }
    const numbers=deck.numbers.slice(deck.cursor,deck.cursor+FAMILY_BATCH_SIZE);
    deck.cursor+=numbers.length;
    const queue=[];
    for(let i=0;i<FAMILY_PASSES;i++) queue.push(...this.shuffled(numbers,queue.at(-1)??s.lastNumber));
    s.batchSerial++;
    s.sessions[mode]={id:s.batchSerial,mode,numbers,queue,position:0,correct:0,wrong:0,current:null,feedback:null};
    this.nextQuestion();return true;
  }
  nextQuestion() {
    const b=this.active();
    if(!b || b.current || b.position===b.queue.length) return b?.current??null;
    const number=b.queue[b.position],expected=this.byNumber.get(number).category;
    const others=this.shuffled(this.data.categories.map(c=>c.id).filter(c=>c!==expected));
    const distractors=[...new Set([...(confusable[expected]??[]),...others])].filter(c=>c!==expected && this.data.categories.some(category=>category.id===c)).slice(0,3);
    this.state.questionSerial++;
    b.current={id:`f-q-${this.state.questionSerial}`,number,options:this.shuffled([expected,...distractors])};
    return b.current;
  }
  answer(category,questionId=this.active()?.current?.id) {
    const b=this.active(),q=b?.current;
    if(!q || b.feedback || questionId!==q.id) return false;
    if(!q.options.includes(category)) throw Error('Choose one of the displayed element families.');
    const expected=this.byNumber.get(q.number).category,correct=category===expected,p=this.state.progress[q.number];
    this.state.answerCount++;this.state.lastNumber=q.number;b.position++;
    p[correct?'correct':'wrong']++;b[correct?'correct':'wrong']++;p.lastAnswered=this.state.answerCount;
    if(!correct)p.lastMiss=this.state.answerCount;
    b.feedback={questionId:q.id,answer:category,expected,correct};return true;
  }
  continue(questionId=this.active()?.current?.id) {
    const b=this.active();
    if(!b?.feedback || questionId!==b.current.id) return false;
    b.current=null;b.feedback=null;this.nextQuestion();return true;
  }
  showStudy(){this.state.view='study';}
  showPlay(){this.state.view='play';}
  toggleColors(){this.state.colors=!this.state.colors;}
  inspect(number){if(!this.byNumber.has(number))throw Error('Choose an element on the table.');this.state.studyNumber=number;}
}
