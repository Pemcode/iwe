const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../js/curriculum.js');
test('24 défis complets, résolubles avec leurs corrigés et variantes',()=>{
  assert.equal(C.chapters.length,8);
  for(let seed=0;seed<4;seed++)for(let id=0;id<24;id++){
    const q=C.exercise(id,seed); assert.ok(q.context&&q.hint&&q.explanation&&q.fields.length);
    const correct=q.fields.map(f=>String(f.answer));
    assert.ok(C.grade(q,correct).every(Boolean));
    assert.ok(C.grade(q,q.fields.map(()=>'' )).every(v=>!v));
  }
});
test('examen : notation partielle et trois dossiers de synthèse',()=>{
  const e=C.exam(1); assert.equal(e.length,3);assert.ok(e.every(q=>q.fields.length>=4));
  const q=e[0],answers=q.fields.map(f=>String(f.answer));answers[0]='';
  assert.equal(C.grade(q,answers).filter(Boolean).length,q.fields.length-1);
  assert.notDeepEqual(C.exam(1),C.exam(2));
});
