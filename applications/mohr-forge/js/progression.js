(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.Progression=api;})(globalThis,function(){
  'use strict';
  const fresh=()=>({version:1,stars:{},xp:0,examBest:0,examAttempts:0});
  const points=stars=>stars===3?100:stars===2?85:70;
  function unlocked(p,chapter){return chapter===0||Array.from({length:chapter*3},(_,i)=>i).every(i=>p.stars[i]);}
  function complete(p,id,stars){
    if(!Number.isInteger(id)||id<0||id>=24||p.stars[id]||!unlocked(p,Math.floor(id/3))||![1,2,3].includes(stars)) return false;
    p.stars[id]=stars;p.xp+=points(stars);return true;
  }
  const examUnlocked=p=>Array.from({length:24},(_,i)=>i).every(i=>p.stars[i]);
  function restore(raw){
    try{
      const x=JSON.parse(raw);if(!x||x.version!==1||!x.stars||typeof x.stars!=='object'||Array.isArray(x.stars))return fresh();
      const p=fresh();
      for(let i=0;i<24;i++) if([1,2,3].includes(x.stars[i]))complete(p,i,x.stars[i]);
      p.examBest=Number.isFinite(x.examBest)?Math.min(100,Math.max(0,x.examBest)):0;
      p.examAttempts=Number.isInteger(x.examAttempts)&&x.examAttempts>=0?Math.min(x.examAttempts,100000):0;
      return p;
    }catch{return fresh();}
  }
  return {fresh,unlocked,complete,examUnlocked,restore};
});
