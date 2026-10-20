const {test}=require('node:test');
const assert=require('node:assert/strict');
const Story=require('../js/story.js');

test('douze épisodes en trois actes, complets et réalisables par manipulation',()=>{
  assert.equal(Story.episodes.length,12);
  assert.equal(new Set(Story.episodes.map(e=>e.id)).size,12);
  assert.deepEqual([...new Set(Story.episodes.map(e=>e.act))],[1,2,3]);
  for(const ep of Story.episodes){
    assert.ok(ep.title&&ep.place&&ep.briefing&&ep.hint&&ep.debrief&&ep.controls.length,ep.id);
    assert.equal(ep.solution.length,ep.goals.length,ep.id);
    let state=Story.initialState(ep);
    const run=Story.runner(ep);
    let r=run.update(state);
    assert.equal(r.done[0],false,`${ep.id} : premier objectif atteint sans manipulation`);
    assert.equal(r.complete,false,ep.id);
    ep.solution.forEach((steps,g)=>{
      for(const patch of steps){state={...state,...patch};r=run.update(state);}
      assert.ok(r.done[g],`${ep.id} : objectif ${g+1} non atteint par la solution`);
    });
    assert.equal(r.complete,true,ep.id);
  }
});

test('objectifs séquentiels : un objectif atteint reste acquis, le suivant devient courant',()=>{
  const ep=Story.episodes[0],run=Story.runner(ep),s=Story.initialState(ep);
  let r=run.update({...s,...ep.solution[0].at(-1)});
  assert.equal(r.done[0],true);assert.equal(r.current,1);
  r=run.update(s);
  assert.equal(r.done[0],true);assert.equal(r.complete,false);
  assert.ok(r.progress>=0&&r.progress<=1);
});

test('le piège du facteur deux est signalé pendant l’épisode',()=>{
  const ep=Story.episodes.find(e=>e.id==='glissement'),run=Story.runner(ep);
  const r=run.update({...Story.initialState(ep),xy:1000});
  assert.equal(r.done[0],false);assert.match(r.feedback,/γ\/2|moitié/);
});

test('progression : déblocage, étoiles, XP non cumulables, sauvegarde robuste',()=>{
  const p=Story.fresh();
  assert.equal(Story.unlocked(p,0),true);assert.equal(Story.unlocked(p,1),false);
  assert.equal(Story.complete(p,Story.episodes[1].id,3),false);
  assert.equal(Story.complete(p,Story.episodes[0].id,3),true);assert.equal(Story.xp(p),80);
  assert.equal(Story.complete(p,Story.episodes[0].id,3),false);assert.equal(Story.xp(p),80);
  assert.equal(Story.unlocked(p,1),true);
  assert.equal(Story.complete(p,Story.episodes[1].id,2),true);assert.equal(Story.xp(p),145);
  for(const raw of ['{broken','null','[]','{"version":9}','{"version":1,"done":{"inconnu":3}}','{"version":1,"done":{"traction":7}}','{"version":1,"done":{"facette":3}}'])
    assert.equal(Story.xp(Story.restore(raw)),0,raw);
  const q=Story.restore(JSON.stringify(p));
  assert.equal(q.done[Story.episodes[1].id],2);assert.equal(Story.xp(q),145);
});
