import test from 'node:test';
import assert from 'node:assert/strict';
import {ions,IonEngine,gradeName,gradeFormula} from '../dist/ions-engine.mjs';
const ion=name=>ions.find(x=>x.name===name);
test('all 32 ions from the table are represented with distinct names',()=>{
 assert.equal(ions.length,32);assert.equal(new Set(ions.map(x=>x.name)).size,32);
 assert.deepEqual([ion('Hydrogen phosphite').body,ion('Hydrogen phosphite').charge],['HPO3','2-']);
 assert.deepEqual([ion('Periodate').body,ion('Periodate').charge],['IO4','-']);
});
test('names and formulas handle aliases and charge without accepting the wrong ion',()=>{
 assert.ok(gradeName(ion('Hydrogen carbonate'),' BICARBONATE ion '));
 assert.ok(gradeFormula(ion('Acetate'),'CH3COO-'));assert.ok(gradeFormula(ion('Acetate'),'C2H3O2^-'));
 assert.ok(gradeFormula(ion('Sulfate'),'SO4^2-'));assert.ok(gradeFormula(ion('Sulfate'),'SO₄²⁻'));
 assert.ok(!gradeFormula(ion('Sulfate'),'SO4-'));assert.ok(!gradeFormula(ion('Sulfate'),'so4^2-'));
 assert.ok(!gradeFormula(ion('Sulfate'),'SO3^2-'));assert.ok(!gradeFormula(ion('Sulfate'),'SO4'));
});
test('each group cycles through all eight cards in both directions and survives refresh',()=>{
 let game=new IonEngine();const passes=[[],[],[],[]];
 for(let i=0;i<32;i++){
  const q=game.next(),p=game.s.pass,x=ions[q.id];passes[p].push(q.id);
  const a=p<2?q.id:p===2?x.name:x.body+'^'+x.charge;
  assert.equal(game.answer(a,q.questionId),true);const saved=game.snapshot();game=new IonEngine(saved);
  assert.equal(game.answer(a,q.questionId),false);assert.deepEqual(game.snapshot(),saved);game.advance();
 }
 for(const pass of passes)assert.equal(new Set(pass).size,8);
 assert.equal(game.s.pass,4);assert.equal(game.s.correct,32);assert.equal(game.nextGroup(),true);assert.equal(game.s.group,1);
});
test('studying missed ions preserves the original question and accumulates independent totals',()=>{
 let game=new IonEngine();const q=game.next();game.answer(q.options.find(id=>id!==q.id),q.questionId);const original=game.snapshot();
 assert.equal(game.startReview(),true);assert.deepEqual(game.s.reviewIds,[q.id]);
 let review=game.next();game.answer(review.id,review.questionId);game=new IonEngine(game.snapshot());game.advance();
 assert.equal(game.endReview(),true);assert.deepEqual(game.s.current,original.current);assert.deepEqual(game.s.feedback,original.feedback);
 assert.equal(game.s.answers,2);assert.equal(game.s.correct,1);assert.equal(game.s.misses[q.id],1);
});
