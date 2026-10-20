const {test}=require('node:test');
const assert=require('node:assert/strict');
const G=require('../js/progression.js');
test('progression séquentielle ; pas de récompense répétée',()=>{
  const p=G.fresh(); assert.equal(G.unlocked(p,1),false);
  assert.equal(G.complete(p,3,3),false);
  [0,1,2].forEach(i=>assert.equal(G.complete(p,i,3),true));
  assert.equal(G.unlocked(p,1),true); assert.equal(p.xp,300);
  assert.equal(G.complete(p,0,3),false); assert.equal(p.xp,300);
  assert.equal(G.examUnlocked(p),false);
  for(let i=3;i<24;i++) G.complete(p,i,2);
  assert.equal(G.examUnlocked(p),true);
});
test('sauvegarde corrompue ou version inconnue : reprise propre',()=>{
  for(const raw of ['{broken','null','[]','{"version":99}','{"version":1,"stars":{"0":999}}']) {
    const p=G.restore(raw); assert.equal(p.xp,0); assert.equal(G.examUnlocked(p),false);
  }
  const p=G.fresh(); G.complete(p,0,2); const q=G.restore(JSON.stringify(p));
  assert.equal(q.xp,p.xp); assert.equal(q.stars[0],2);
});
