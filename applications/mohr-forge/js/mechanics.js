/* Pure mechanics, MPa / mm / dimensionless strain. No DOM dependency. */
(function(root, factory) {
  const api=factory(); if(typeof module==='object') module.exports=api; else root.Mechanics=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const rad=a=>a*Math.PI/180;
  function rotate2(x,y,xy,angle){
    const c=Math.cos(2*rad(angle)),s=Math.sin(2*rad(angle)),m=(x+y)/2,d=(x-y)/2;
    return {x:m+d*c+xy*s,y:m-d*c-xy*s,xy:-d*s+xy*c};
  }
  function principal2(x,y,xy){
    const center=(x+y)/2,radius=Math.hypot((x-y)/2,xy);
    return {center,radius,max:center+radius,min:center-radius,angle:radius<1e-12?null:Math.atan2(2*xy,x-y)*90/Math.PI};
  }
  function principal3(matrix){
    if(!Array.isArray(matrix)||matrix.length!==3||matrix.some(r=>!Array.isArray(r)||r.length!==3||r.some(v=>!Number.isFinite(v)))) throw new Error('Tenseur 3 × 3 fini requis.');
    const a=matrix.map(r=>r.slice()),scale=Math.max(1,...a.flat().map(Math.abs));
    for(let i=0;i<3;i++) for(let j=0;j<3;j++) if(Math.abs(a[i][j]-a[j][i])>1e-10*scale) throw new Error('Le tenseur doit être symétrique.');
    // Jacobi rotations preserve symmetry; handles repeated roots without cubic cancellation.
    for(let it=0;it<60;it++){
      let p=0,q=1;
      for(const [i,j] of [[0,2],[1,2]]) if(Math.abs(a[i][j])>Math.abs(a[p][q])) [p,q]=[i,j];
      if(Math.abs(a[p][q])<1e-13*scale) break;
      const phi=0.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]),c=Math.cos(phi),s=Math.sin(phi);
      const pp=a[p][p],qq=a[q][q],pq=a[p][q];
      a[p][p]=c*c*pp-2*s*c*pq+s*s*qq; a[q][q]=s*s*pp+2*s*c*pq+c*c*qq;
      a[p][q]=a[q][p]=0;
      for(let k=0;k<3;k++) if(k!==p&&k!==q){ const kp=a[k][p],kq=a[k][q]; a[k][p]=a[p][k]=c*kp-s*kq; a[k][q]=a[q][k]=s*kp+c*kq; }
    }
    return [a[0][0],a[1][1],a[2][2]].sort((a,b)=>b-a);
  }
  const dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  // Same Jacobi rotations as principal3, with the rotations accumulated to obtain directions.
  function eigen3(matrix){
    principal3(matrix);
    const a=matrix.map(r=>r.slice()),v=[[1,0,0],[0,1,0],[0,0,1]],scale=Math.max(1,...a.flat().map(Math.abs));
    for(let it=0;it<60;it++){
      let p=0,q=1;
      for(const [i,j] of [[0,2],[1,2]]) if(Math.abs(a[i][j])>Math.abs(a[p][q])) [p,q]=[i,j];
      if(Math.abs(a[p][q])<1e-13*scale) break;
      const phi=0.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]),c=Math.cos(phi),s=Math.sin(phi);
      const pp=a[p][p],qq=a[q][q],pq=a[p][q];
      a[p][p]=c*c*pp-2*s*c*pq+s*s*qq; a[q][q]=s*s*pp+2*s*c*pq+c*c*qq; a[p][q]=a[q][p]=0;
      for(let k=0;k<3;k++){
        if(k!==p&&k!==q){const kp=a[k][p],kq=a[k][q];a[k][p]=a[p][k]=c*kp-s*kq;a[k][q]=a[q][k]=s*kp+c*kq;}
        const vp=v[k][p],vq=v[k][q];v[k][p]=c*vp-s*vq;v[k][q]=s*vp+c*vq;
      }
    }
    const order=[0,1,2].sort((i,j)=>a[j][j]-a[i][i]);
    const vectors=order.map(j=>{const u=[v[0][j],v[1][j],v[2][j]],big=u.reduce((m,x)=>Math.abs(x)>Math.abs(m)?x:m,0);return big<0?u.map(x=>-x):u;});
    vectors[2]=cross3(vectors[0],vectors[1]);
    return {values:order.map(j=>a[j][j]),vectors};
  }
  // Rotated basis (rows x′, y′, z′): x′ = n from azimuth φ and elevation ψ, then χ turns y′ and z′ about n.
  function frame(phi,psi=0,chi=0){
    const cp=Math.cos(rad(phi)),sp=Math.sin(rad(phi)),ce=Math.cos(rad(psi)),se=Math.sin(rad(psi)),cc=Math.cos(rad(chi)),sc=Math.sin(rad(chi));
    const n=[ce*cp,ce*sp,se],a=[-sp,cp,0],b=[-se*cp,-se*sp,ce];
    return [n,a.map((x,i)=>cc*x+sc*b[i]),a.map((x,i)=>-sc*x+cc*b[i])];
  }
  function rotateTensor(m,Q){return Q.map(qi=>Q.map(qj=>dot3(qi,m.map(r=>dot3(r,qj)))));}
  function facet(m,n){const t=m.map(r=>dot3(r,n)),sigma=dot3(n,t);return {t,sigma,tau:Math.sqrt(Math.max(0,dot3(t,t)-sigma*sigma))};}
  function stiffness(e,E=210000,nu=0.3){
    const lambda=E*nu/((1+nu)*(1-2*nu)),mu=E/(2*(1+nu)),tr=e[0][0]+e[1][1]+e[2][2];
    return e.map((r,i)=>r.map((v,j)=>2*mu*v+(i===j?lambda*tr:0)));
  }
  // Elastic free expansion αΔT, fully blocked along the listed axes and stress free along the others.
  function thermal(dT,restraint='x',E=210000,nu=0.3,alpha=12e-6){
    const blocked=[0,1,2].map(i=>restraint.includes('xyz'[i])),k=blocked.filter(Boolean).length,e0=alpha*dT;
    const s=k?-E*e0/(1-nu*(k-1)):0,free=e0-nu*k*s/E;
    return {stress:[0,1,2].map(i=>[0,1,2].map(j=>i===j&&blocked[i]?s:0)),strain:[0,1,2].map(i=>[0,1,2].map(j=>i===j&&!blocked[i]?free:0))};
  }
  // Angles of frame() whose rows follow the given right-handed directions (up to equivalent signs).
  function alignAngles(vectors){
    let [x,y,z]=vectors.map(v=>v.slice());
    if(x[0]<-1e-12||(Math.abs(x[0])<=1e-12&&x[1]<0)){x=x.map(c=>-c);z=z.map(c=>-c);}
    const phi=Math.hypot(x[0],x[1])<1e-12?0:Math.atan2(x[1],x[0])*180/Math.PI,psi=Math.asin(Math.max(-1,Math.min(1,x[2])))*180/Math.PI;
    const base=frame(phi,psi,0);
    let chi=Math.atan2(dot3(y,base[2]),dot3(y,base[1]))*180/Math.PI;
    if(chi>90)chi-=180;else if(chi<-90)chi+=180;
    return {phi,psi,chi};
  }
  function tricircle(e){return [[0,2],[0,1],[1,2]].map(([i,j])=>({i,j,center:(e[i]+e[j])/2,radius:(e[i]-e[j])/2}));}
  function vonMises(a){return Math.sqrt(((a[0][0]-a[1][1])**2+(a[1][1]-a[2][2])**2+(a[2][2]-a[0][0])**2)/2+3*(a[0][1]**2+a[0][2]**2+a[1][2]**2));}
  function strain(a,E=210000,nu=0.3){
    if(!(E>0&&nu>-1&&nu<0.5)) throw new Error('Constantes élastiques invalides.');
    const tr=a[0][0]+a[1][1]+a[2][2];
    return a.map((r,i)=>r.map((v,j)=>((1+nu)*v-(i===j?nu*tr:0))/E));
  }
  function weld(normal,transverse,longitudinal,fu,beta,gamma){
    const combined=Math.sqrt(normal**2+3*(transverse**2+longitudinal**2));
    const limitCombined=fu/(beta*gamma),limitNormal=0.9*fu/gamma;
    const ratioCombined=combined/limitCombined,ratioNormal=Math.max(0,normal)/limitNormal;
    return {combined,limitCombined,limitNormal,ratioCombined,ratioNormal,pass:ratioCombined<=1&&ratioNormal<=1};
  }
  function parseNumber(raw){
    if(typeof raw!=='string'&&typeof raw!=='number') return null;
    const s=String(raw).trim().replace(/−/g,'-').replace(',','.');
    if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) return null;
    const n=Number(s); return Number.isFinite(n)?n:null;
  }
  function matches(raw,expected,options={}){
    const n=parseNumber(raw); if(n===null) return false;
    const delta=options.angle?Math.abs(((n-expected+90)%180+180)%180-90):Math.abs(n-expected);
    return delta<=(options.tolerance??(options.angle?0.6:Math.max(0.05,Math.abs(expected)*0.005)));
  }
  return {rotate2,principal2,principal3,eigen3,frame,rotateTensor,facet,stiffness,thermal,alignAngles,tricircle,vonMises,strain,weld,parseNumber,matches};
});
