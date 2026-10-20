const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../js/curriculum.js');
test('examen : valeurs de référence calculées indépendamment',()=>{
  const [a,b,c]=C.exam(0),near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<0.002,`${actual} ≠ ${expected}`);
  [180,80,40,70,124.899959968,561.904761905].forEach((v,i)=>near(a.fields[i].answer,v));
  [300,131.538461538,18.461538462,24.230769231,-214.285714286].forEach((v,i)=>near(b.fields[i].answer,v));
  near(c.fields[0].answer,160);near(c.fields[1].answer,-60);near(c.fields[2].answer,197.737199333);
  assert.equal(c.fields[5].answer,'Oui');
});
