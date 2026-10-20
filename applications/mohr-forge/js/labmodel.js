/* Laboratory model: from the controls to every displayed quantity. MPa, µε for inputs; no DOM. */
(function(root,factory){const api=factory(typeof module==='object'?require('./mechanics.js'):root.Mechanics);if(typeof module==='object')module.exports=api;else root.LabModel=api;})(globalThis,function(M){
  'use strict';
  // Eurocode values: EN 1993-1-1 §3.2.6 (steel) and EN 1999-1-1 §3.2.5 (aluminium).
  const materials={
    steel:{label:'Acier',E:210000,nu:0.3,alpha:12e-6},
    alu:{label:'Aluminium',E:70000,nu:0.3,alpha:23e-6},
  };
  // Fillet weld parameters imposed by the exercises; not derived from a grade or a thickness.
  const WELD={fu:470,beta:0.9,gamma:1.25};
  const starts={
    stress:{x:120,y:40,z:0,xy:30,xz:0,yz:0},
    strain:{x:600,y:-200,z:0,xy:300,xz:0,yz:0},
    three:{x:120,y:40,z:-30,xy:30,xz:20,yz:0},
    strainThree:{x:600,y:-200,z:-100,xy:300,xz:100,yz:0},
    thermal:{x:0,y:0,z:0,xy:0,xz:0,yz:0},
  };
  const modes=Object.keys(starts);
  const isThree=mode=>mode==='three'||mode==='strainThree'||mode==='thermal';
  const isStrain=mode=>mode==='strain'||mode==='strainThree';
  function defaults(mode='stress'){
    if(!modes.includes(mode))mode='stress';
    return {mode,...starts[mode],angle:0,elev:0,roll:0,load:1,hydro:0,omega:0,material:'steel',fy:355,dT:mode==='thermal'?100:0,restraint:'x',weld:false,amp:null,scale:null};
  }
  const deg=r=>r*180/Math.PI;
  function derive(s){
    const mat=materials[s.material]||materials.steel,{E,nu,alpha}=mat;
    const thermal=s.mode==='thermal',strainInput=isStrain(s.mode),three=isThree(s.mode);
    const k=Number.isFinite(s.load)?s.load:1;
    let input,stress=null,strain;
    if(thermal){const t=M.thermal(s.dT||0,s.restraint||'x',E,nu,alpha);stress=t.stress;strain=t.strain;input=stress;}
    else{
      const raw=three?[[s.x,s.xy,s.xz],[s.xy,s.y,s.yz],[s.xz,s.yz,s.z]]:[[s.x,s.xy,0],[s.xy,s.y,0],[0,0,0]];
      const shift=three&&!strainInput?(s.hydro||0):0;
      input=raw.map((r,i)=>r.map((v,j)=>v*k+(i===j?shift:0)));
      if(strainInput){strain=input.map(r=>r.map(v=>v*1e-6));if(three)stress=M.stiffness(strain,E,nu);}
      else{stress=input;strain=M.strain(stress,E,nu);}
    }
    const Q=three?M.frame(s.angle||0,s.elev||0,s.roll||0):M.frame(s.angle||0);
    const rotated=M.rotateTensor(input,Q);
    const facet={sigma:rotated[0][0],ty:rotated[1][0],tz:rotated[2][0]};facet.tau=Math.hypot(facet.ty,facet.tz);
    const eig=M.eigen3(input),planar=M.principal2(input[0][0],input[1][1],input[0][1]);
    const circles=three?M.tricircle(eig.values):[{i:0,j:1,center:planar.center,radius:planar.radius}];
    // 2D: signed τx′y′ as in the courses; 3D: |τ| of an arbitrary facet, inside the three circles.
    const mohr=three?{x:facet.sigma,y:facet.tau}:{x:facet.sigma,y:facet.ty};
    const w=strainInput?(s.omega||0)*1e-6:0;
    const grad=strain.map((r,i)=>r.map((v,j)=>v+(i===0&&j===1?-w:i===1&&j===0?w:0)));
    const principalStress=stress?M.principal3(stress):null;
    const rotStress=stress?(strainInput?M.rotateTensor(stress,Q):rotated):null;
    const rotStrain=M.rotateTensor(strain,Q);
    const weld=rotStress?{perp:rotStress[0][0],tperp:rotStress[1][0],tpar:rotStress[2][0],...WELD,...M.weld(rotStress[0][0],rotStress[1][0],rotStress[2][0],WELD.fu,WELD.beta,WELD.gamma)}:null;
    const rosette=[0,45,90].map(a=>{const c=Math.cos(a*Math.PI/180),n=Math.sin(a*Math.PI/180);return (strain[0][0]*c*c+strain[1][1]*n*n+2*strain[0][1]*n*c)*1e6;});
    const vm=stress?M.vonMises(stress):null;
    return {
      mode:s.mode,three,thermal,strainInput,unit:strainInput?'µε':'MPa',symbol:strainInput?'ε':'σ',E,nu,alpha,material:mat,
      input,stress,strain,grad,Q,n:Q[0],rotated,rotStress,rotStrain,facet,mohr,eig,planar,circles,
      principalStress,vm,tresca:stress?principalStress[0]-principalStress[2]:null,
      mean:stress?(stress[0][0]+stress[1][1]+stress[2][2])/3:null,
      volume:(strain[0][0]+strain[1][1]+strain[2][2])*1e6,
      gamma:2*rotStrain[0][1]*1e6,weld,rosette,utilisation:vm===null?null:vm/(s.fy||355),
      principalAngle:planar.angle,
    };
  }
  // 1-2-5 (floor) and 1-2-2,5-5 (ceiling) steps keep scales readable and stable.
  function nice(v,up){
    const p=10**Math.floor(Math.log10(v)),m=v/p;
    return (up?[1,2,2.5,5,10].find(x=>x>=m-1e-9):[1,2,5,10].filter(x=>x<=m+1e-9).pop())*p;
  }
  function autoAmp(d){
    const m=Math.max(...d.grad.flat().map(Math.abs));
    return m>1e-12?Math.min(50000,Math.max(1,nice(0.14/m,false))):500;
  }
  function autoScale(d){
    const m=Math.max(...(d.stress||d.input).flat().map(Math.abs));
    return m>1e-9?nice(m,true):100;
  }
  // Frame angles that bring x′, y′, z′ onto the principal directions 1, 2, 3.
  function principalAngles(d){return M.alignAngles(d.eig.vectors);}
  return {materials,WELD,modes,isThree,isStrain,defaults,derive,autoAmp,autoScale,principalAngles,deg};
});
