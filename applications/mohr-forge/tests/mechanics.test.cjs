const {test} = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/mechanics.js');
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-7, `${a} ≠ ${b}`);

test('rotation à 45°, signe du cisaillement et invariants',()=>{
  const r=M.rotate2(100,0,0,45); near(r.x,50); near(r.y,50); near(r.xy,-50);
  const p=M.principal2(100,0,0); near(p.max,100); near(p.min,0);
  const q=M.rotate2(120,40,30,37); near(q.x+q.y,160); near(q.x*q.y-q.xy*q.xy,3900);
});
test('3D couplé : valeurs propres connues, indépendantes de l’orientation',()=>{
  const a=[[100,20,20],[20,100,20],[20,20,100]];
  const e=M.principal3(a); [140,80,80].forEach((v,i)=>near(e[i],v));
  near(M.vonMises(a),60); near(M.tricircle(e)[0].radius,30);
});
test('cisaillement pur, compression et état hydrostatique',()=>{
  const a=[[0,50,0],[50,0,0],[0,0,0]];
  M.principal3(a).forEach((v,i)=>near(v,[50,0,-50][i])); near(M.vonMises(a),50*Math.sqrt(3));
  const h=[[-90,0,0],[0,-90,0],[0,0,-90]];
  near(M.vonMises(h),0); M.tricircle(M.principal3(h)).forEach(c=>near(c.radius,0));
});
test('Hooke 3D : facteur deux et contraction hors plan',()=>{
  const e=M.strain([[210,42,0],[42,0,0],[0,0,0]],210000,0.3);
  near(e[0][0],0.001); near(e[1][1],-0.0003); near(e[0][1],0.00026);
  near(e[2][2],-0.0003); near(2*e[0][1],0.00052);
});
test('cordon : premier critère passe, second échoue',()=>{
  const w=M.weld(380,0,0,470,0.9,1.25);
  assert.ok(w.ratioCombined<1); assert.ok(w.ratioNormal>1); assert.equal(w.pass,false);
});
test('saisie française stricte ; valeur nulle valide ; angles périodiques',()=>{
  near(M.parseNumber(' −1,25 '),-1.25); near(M.parseNumber('0'),0);
  for(const s of ['', '  ', '12MPa','1,2,3','Infinity','NaN','1 2']) assert.equal(M.parseNumber(s),null);
  assert.equal(M.matches('180',0,{angle:true}),true);
  assert.equal(M.matches('90',0,{angle:true}),false);
  assert.equal(M.matches('',0),false);
});
