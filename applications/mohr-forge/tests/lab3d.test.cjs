const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../js/mechanics.js');
const L=require('../js/labmodel.js');
const S=require('../js/scene3d.js');
const near=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<eps,`${a} ≠ ${b}`);
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const mul=(m,v)=>m.map(r=>dot(r,v));
const transpose=m=>m[0].map((_,j)=>m.map(r=>r[j]));

test('vecteurs propres : σ·v = λv, base orthonormée directe, valeurs triées',()=>{
  for(const m of [[[100,20,20],[20,100,20],[20,20,100]],[[120,30,20],[30,40,0],[20,0,-30]],[[0,50,0],[50,0,0],[0,0,0]],[[-90,0,0],[0,-90,0],[0,0,-90]]]){
    const {values,vectors}=M.eigen3(m);
    assert.ok(values[0]>=values[1]&&values[1]>=values[2]);
    vectors.forEach((v,i)=>{mul(m,v).forEach((c,k)=>near(c,values[i]*v[k],1e-6));near(dot(v,v),1,1e-9);});
    near(dot(vectors[0],vectors[1]),0,1e-9);near(dot(vectors[0],vectors[2]),0,1e-9);
    cross(vectors[0],vectors[1]).forEach((c,k)=>near(c,vectors[2][k],1e-9));
    M.principal3(m).forEach((v,i)=>near(v,values[i],1e-6));
  }
});

test('repère tourné : Q orthonormé direct, invariants et rotation 2D retrouvée',()=>{
  const Q=M.frame(30);
  near(Q[0][0],Math.cos(Math.PI/6));near(Q[0][1],0.5);near(Q[2][2],1);
  const r=M.rotateTensor([[120,30,0],[30,40,0],[0,0,0]],Q),q=M.rotate2(120,40,30,30);
  near(r[0][0],q.x);near(r[1][1],q.y);near(r[0][1],q.xy);
  const Q3=M.frame(37,-22,15),r3=M.rotateTensor([[120,30,20],[30,40,0],[20,0,-30]],Q3);
  near(r3[0][0]+r3[1][1]+r3[2][2],130,1e-9);
  Q3.forEach((a,i)=>Q3.forEach((b,j)=>near(dot(a,b),i===j?1:0,1e-12)));
  cross(Q3[0],Q3[1]).forEach((c,k)=>near(c,Q3[2][k],1e-12));
});

test('facette quelconque : T = σn, σn² + τ² = |T|² et point entre les trois cercles',()=>{
  const s=[[180,0,0],[0,60,0],[0,0,-60]];
  for(const [phi,psi] of [[0,0],[45,0],[90,45],[0,45],[33,-61],[-70,12]]){
    const f=M.facet(s,M.frame(phi,psi)[0]),gap=(c,r)=>Math.hypot(f.sigma-c,f.tau)-r;
    near(f.sigma**2+f.tau**2,dot(f.t,f.t),1e-6);
    assert.ok(gap(60,120)<=1e-6);assert.ok(gap(120,60)>=-1e-6);assert.ok(gap(0,60)>=-1e-6);
  }
  near(M.facet(s,M.frame(0,45)[0]).tau,120,1e-9);
});

test('Hooke inverse et dilatation empêchée selon une, deux ou trois directions',()=>{
  const sig=[[120,30,20],[30,40,0],[20,0,-30]];
  M.stiffness(M.strain(sig)).forEach((r,i)=>r.forEach((v,j)=>near(v,sig[i][j],1e-6)));
  const x=M.thermal(100,'x'),xy=M.thermal(100,'xy'),xyz=M.thermal(100,'xyz'),free=M.thermal(100,'none');
  near(x.stress[0][0],-252,1e-9);near(x.stress[1][1],0);near(x.strain[0][0],0,1e-15);near(x.strain[1][1],1.3*1.2e-3,1e-12);
  near(xy.stress[1][1],-252/0.7,1e-9);near(xy.strain[2][2],1.2e-3*1.3/0.7,1e-12);
  near(xyz.stress[2][2],-252/0.4,1e-9);near(M.vonMises(xyz.stress),0,1e-9);
  free.stress.flat().forEach(v=>near(v,0));near(free.strain[1][1],1.2e-3,1e-15);
});

test('aligner le repère sur les directions principales annule tous les cisaillements',()=>{
  for(const s of [[[120,30,20],[30,40,0],[20,0,-30]],[[120,30,0],[30,40,0],[0,0,0]],[[0,0,50],[0,0,0],[50,0,0]]]){
    const {values,vectors}=M.eigen3(s),a=M.alignAngles(vectors),r=M.rotateTensor(s,M.frame(a.phi,a.psi,a.chi));
    near(r[0][1],0,1e-6);near(r[0][2],0,1e-6);near(r[1][2],0,1e-6);
    values.forEach((v,i)=>near(r[i][i],v,1e-6));
  }
});

test('laboratoire : contraintes planes, effet Poisson, point de Mohr signé',()=>{
  const d=L.derive({...L.defaults('stress'),x:100,y:0,xy:0,angle:45});
  near(d.facet.sigma,50);near(d.facet.ty,-50);near(d.facet.tz,0);
  near(d.strain[0][0]*1e6,100/0.21,1e-6);near(d.strain[1][1]*1e6,-30/0.21,1e-6);near(d.strain[2][2]*1e6,-30/0.21,1e-6);
  near(d.mohr.x,50);near(d.mohr.y,-50);
  assert.equal(d.three,false);assert.equal(d.circles.length,1);
  near(L.derive({...L.defaults('stress'),load:2}).input[0][0],240);
});

test('laboratoire : déformations, rotation de corps rigide et rosette',()=>{
  const d=L.derive({...L.defaults('strain'),x:600,y:-200,xy:300});
  near(d.planar.radius,500);near(d.rosette[0],600);near(d.rosette[1],500);near(d.rosette[2],-200);
  assert.equal(d.stress,null);
  const g=L.derive({...L.defaults('strain'),x:0,y:0,xy:500,omega:-500});
  near(g.grad[1][0]*1e6,0,1e-9);near(g.grad[0][1]*1e6,1000,1e-9);
  const t=L.derive({...L.defaults('strainThree')});
  near(t.stress[0][0],M.stiffness(t.strain)[0][0]);
});

test('laboratoire : 3D, pression hydrostatique, bridage et cordon d’angle',()=>{
  const h=L.derive({...L.defaults('three'),x:100,y:100,z:100,xy:20,xz:20,yz:20,hydro:-100});
  near(h.mean,0,1e-9);near(h.vm,60,1e-9);near(h.tresca,60,1e-9);
  const t=L.derive({...L.defaults('thermal'),dT:100,restraint:'x'});
  near(t.stress[0][0],-252,1e-9);near(t.vm,252,1e-9);assert.equal(t.three,true);
  const w=L.derive({...L.defaults('three'),x:140,y:-20,z:0,xy:40,xz:30,yz:30,angle:45});
  near(w.weld.perp,100,1e-9);near(w.weld.tperp,-80,1e-9);near(w.weld.tpar,60/Math.SQRT2,1e-9);
  near(w.weld.ratioCombined,Math.sqrt(34600)/(470/(0.9*1.25)),1e-9);near(w.weld.ratioNormal,100/338.4,1e-9);
  near(w.mohr.x,100,1e-9);near(w.mohr.y,Math.hypot(80,60/Math.SQRT2),1e-9);
});

test('échelles automatiques : déformée amplifiée lisible, flèches arrondies',()=>{
  const d=L.derive({...L.defaults('stress'),x:210,y:0,xy:0});
  const amp=L.autoAmp(d);
  assert.ok([1,2,5].includes(amp/10**Math.floor(Math.log10(amp))));
  const shift=amp*Math.max(...d.grad.flat().map(Math.abs));
  assert.ok(shift>0.05&&shift<=0.2,String(shift));
  assert.equal(L.autoScale(d),250);
});

test('vue 3D orthographique : axes de face, projection et sélection inverses',()=>{
  const F=S.view(0,0);
  near(S.project([1,0,0],F,0,0,10).x,10);near(S.project([0,1,0],F,0,0,10).y,-10);near(S.project([0,0,1],F,0,0,10).z,1);
  const V=S.view(-30,20);
  V.forEach((a,i)=>V.forEach((b,j)=>near(dot(a,b),i===j?1:0,1e-12)));
  const p=mul(transpose(V),[0.2,-0.3,0.9]),sp=S.project(p,V,200,150,50);
  S.pickSphere(sp.x,sp.y,V,200,150,50,Math.hypot(...p)).forEach((v,i)=>near(v,p[i],1e-9));
  const q=[0.7,-0.2,0],sq=S.project(q,V,200,150,50);
  S.pickPlane(sq.x,sq.y,V,200,150,50,[0,0,1]).forEach((v,i)=>near(v,q[i],1e-9));
});
