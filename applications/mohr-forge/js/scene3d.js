/* Orthographic 3D view of a material element on a 2D canvas. Math is pure; drawing needs a canvas. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.Scene3D=api;})(globalThis,function(){
  'use strict';
  const rad=a=>a*Math.PI/180;
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
  const scale=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
  const mulT=(V,v)=>[0,1,2].map(j=>V[0][j]*v[0]+V[1][j]*v[1]+V[2][j]*v[2]);
  // World x to the right, y up, z towards the viewer when yaw = pitch = 0.
  function view(yaw,pitch){
    const cy=Math.cos(rad(yaw)),sy=Math.sin(rad(yaw)),cp=Math.cos(rad(pitch)),sp=Math.sin(rad(pitch));
    return [[cy,0,sy],[sp*sy,cp,-sp*cy],[-cp*sy,sp,cp*cy]];
  }
  function project(p,V,cx,cy,u){return {x:cx+u*dot(V[0],p),y:cy-u*dot(V[1],p),z:dot(V[2],p)};}
  function pickSphere(sx,sy,V,cx,cy,u,r){
    let X=(sx-cx)/u,Y=-(sy-cy)/u;const d=Math.hypot(X,Y);
    if(d>r){X*=r/d;Y*=r/d;}
    return mulT(V,[X,Y,Math.sqrt(Math.max(0,r*r-X*X-Y*Y))]);
  }
  function pickPlane(sx,sy,V,cx,cy,u,normal){
    const origin=mulT(V,[(sx-cx)/u,-(sy-cy)/u,0]),dir=mulT(V,[0,0,1]),den=dot(normal,dir);
    if(Math.abs(den)<1e-9)return null;
    return add(origin,scale(dir,-dot(normal,origin)/den));
  }
  const COLORS={tension:'#ff8a5c',compression:'#66b6ff',shear:'#f2c14e',vector:'#fbfaf3',facet:'#ff8a5c',ghost:'rgba(236,240,228,.5)',edge:'#1c2823',label:'#e9eadf',muted:'#a9b5a8',axes:['#f08a6d','#9fcf8f','#8fb6f0']};
  const GAUGES=[{angle:0,color:'#7fd1c7',name:'a · 0°'},{angle:45,color:'#f2c14e',name:'b · 45°'},{angle:90,color:'#c9a0ff',name:'c · 90°'}];
  const fmt=(v,d=0)=>Math.abs(v)<1e-8?'0':v.toLocaleString('fr-FR',{maximumFractionDigits:d}).replace('-','−');

  function create(canvas,options={}){
    const ctx=canvas.getContext('2d'),state={yaw:-32,pitch:20,dpr:1,w:0,h:0,u:1,cx:0,cy:0},scene={data:null,handle:null};
    const defaultsView={yaw:-32,pitch:20};
    function resize(){
      const box=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
      state.w=Math.max(200,box.width);state.h=Math.max(200,box.height);state.dpr=dpr;
      canvas.width=Math.round(state.w*dpr);canvas.height=Math.round(state.h*dpr);
      draw();
    }
    function setView(yaw,pitch){state.yaw=((yaw+540)%360)-180;state.pitch=Math.max(-85,Math.min(85,pitch));canvas.dataset.yaw=state.yaw.toFixed(1);canvas.dataset.pitch=state.pitch.toFixed(1);draw();options.onView?.(state);}
    let tween=null;
    function animateView(yaw,pitch){
      cancelAnimationFrame(tween);
      const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches,from={yaw:state.yaw,pitch:state.pitch},start=performance.now();
      let dy=((yaw-from.yaw+540)%360)-180;
      if(reduce){setView(yaw,pitch);return;}
      const step=now=>{const t=Math.min(1,(now-start)/450),e=t<.5?2*t*t:1-(-2*t+2)**2/2;setView(from.yaw+dy*e,from.pitch+(pitch-from.pitch)*e);if(t<1)tween=requestAnimationFrame(step);};
      tween=requestAnimationFrame(step);
    }
    function arrow(a,b,color,width=2.4,head=9){
      const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
      if(len<2)return;
      const ux=dx/len,uy=dy/len,h=Math.min(head,len*.6);
      ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=width;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x-ux*h*.7,b.y-uy*h*.7);ctx.stroke();
      ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-ux*h-uy*h*.45,b.y-uy*h+ux*h*.45);ctx.lineTo(b.x-ux*h+uy*h*.45,b.y-uy*h-ux*h*.45);ctx.closePath();ctx.fill();
    }
    function label(text,p,color,font='600 11px "Cascadia Code",Consolas,monospace',dx=6,dy=-6,halo='rgba(22,32,28,.85)'){
      ctx.font=font;ctx.fillStyle=color;ctx.textAlign='left';ctx.textBaseline='alphabetic';
      const w=ctx.measureText(text).width,x=Math.min(state.w-w-4,Math.max(4,p.x+dx)),y=Math.min(state.h-6,Math.max(14,p.y+dy));
      ctx.lineWidth=3;ctx.strokeStyle=halo;ctx.strokeText(text,x,y);ctx.fillText(text,x,y);
    }
    function tipLabel(text,a,b,color,beside=false){
      const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;
      ctx.font='700 12px "Cascadia Code",Consolas,monospace';
      const w=ctx.measureText(text).width;
      // Beside the arrow (above it on screen) when the facet handle continues along the same line.
      let x=b.x+ux*9+(ux<-.3?-w:ux>.3?0:-w/2),y=b.y+uy*9+(uy>.3?11:uy<-.3?-2:4);
      if(beside){const m=(a.x+b.x)/2,n=(a.y+b.y)/2,px=uy>0?-uy:uy,py=uy>0?ux:-ux,s=Math.abs(py)<.2?1:Math.sign(-py)||1;x=m+px*s*14-w/2;y=n+py*s*14-(py*s<0?2:-10);}
      label(text,{x,y},color,'700 12px "Cascadia Code",Consolas,monospace',0,0);
    }
    function draw(){
      const d=scene.data;
      ctx.setTransform(state.dpr,0,0,state.dpr,0,0);ctx.clearRect(0,0,state.w,state.h);
      if(!d)return;
      const V=view(state.yaw,state.pitch);
      state.u=Math.min(state.w,state.h)/(d.compact?3.9:4.15);state.cx=state.w/2;state.cy=state.h/2+4;
      const P=p=>project(p,V,state.cx,state.cy,state.u);
      const Q=d.Q,G=d.grad,amp=d.deformed?d.amp:0;
      const world=c=>add(add(scale(Q[0],c[0]),scale(Q[1],c[1])),scale(Q[2],c[2]));
      const deform=X=>add(X,scale([dot(G[0],X),dot(G[1],X),dot(G[2],X)],amp));
      const corner=c=>deform(world(c));
      const viewZ=v=>dot(V[2],v);
      // Restraint walls behind the element are drawn first, the others on top with transparency.
      const walls=(d.walls||'').split('').map(axis=>'xyz'.indexOf(axis)).filter(i=>i>=0);
      const wallPolys=walls.flatMap(i=>[1,-1].map(s=>{
        const j=(i+1)%3,k=(i+2)%3,pts=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>{const p=[0,0,0];p[i]=s*1.22;p[j]=a*1.45;p[k]=b*1.45;return p;});
        return {pts,depth:viewZ(pts.reduce((m,p)=>add(m,scale(p,.25)),[0,0,0])),i};
      }));
      const drawWall=w=>{
        const pp=w.pts.map(P);ctx.beginPath();pp.forEach((p,n)=>n?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
        ctx.fillStyle=w.depth>0?'rgba(163,176,160,.22)':'rgba(163,176,160,.4)';ctx.fill();ctx.strokeStyle='rgba(214,222,206,.7)';ctx.lineWidth=1.2;ctx.stroke();
        ctx.save();ctx.clip();ctx.strokeStyle='rgba(214,222,206,.35)';ctx.lineWidth=1;
        const xs=pp.map(p=>p.x),ys=pp.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
        for(let x=x0-(y1-y0);x<x1;x+=9){ctx.beginPath();ctx.moveTo(x,y1);ctx.lineTo(x+(y1-y0),y0);ctx.stroke();}
        ctx.restore();
      };
      if(state.pitch>-10){
        const g=P([0,-1.55,0]),r=state.u*1.9,grad=ctx.createRadialGradient(g.x,g.y,0,g.x,g.y,r);
        grad.addColorStop(0,'rgba(0,0,0,.32)');grad.addColorStop(1,'rgba(0,0,0,0)');
        ctx.save();ctx.translate(g.x,g.y);ctx.scale(1,.28+.5*Math.sin(rad(Math.max(0,state.pitch))));ctx.translate(-g.x,-g.y);
        ctx.fillStyle=grad;ctx.beginPath();ctx.arc(g.x,g.y,r,0,Math.PI*2);ctx.fill();ctx.restore();
      }
      wallPolys.filter(w=>w.depth<0).forEach(drawWall);
      if(d.principal&&d.eig)drawPrincipal(d,P,V,false);
      // Faces: i = local axis, s = side. Corners listed counter-clockwise seen from outside.
      const faces=[];
      for(let i=0;i<3;i++)for(const s of [1,-1]){
        const j=(i+1)%3,k=(i+2)%3,order=s>0?[[-1,-1],[1,-1],[1,1],[-1,1]]:[[-1,-1],[-1,1],[1,1],[1,-1]];
        const cs=order.map(([a,b])=>{const c=[0,0,0];c[i]=s;c[j]=a;c[k]=b;return c;});
        const normal=scale(Q[i],s),center=[0,0,0];center[i]=s;
        faces.push({i,s,cs,normal,front:viewZ(normal)>1e-6,depth:viewZ(corner(center)),center:corner(center)});
      }
      const light=[-.35,.6,.72],heat=Math.max(0,Math.min(1,(d.heat||0)/300));
      const base=[201,209,196],hot=[255,146,84];
      faces.filter(f=>f.front).sort((a,b)=>a.depth-b.depth).forEach(f=>{
        const pts=f.cs.map(c=>P(corner(c))),shade=.62+.38*Math.max(0,dot(f.normal,light));
        const col=base.map((c,n)=>Math.round((c+(hot[n]-c)*heat)*shade));
        ctx.beginPath();pts.forEach((p,n)=>n?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
        ctx.fillStyle=`rgba(${col.join(',')},.94)`;ctx.fill();
        const studied=d.facet&&f.i===0;
        ctx.lineWidth=studied?2.6:1.2;ctx.strokeStyle=studied?COLORS.facet:COLORS.edge;ctx.stroke();
        if(studied){ctx.fillStyle='rgba(255,138,92,.16)';ctx.fill();}
      });
      // Stretch of the edges: local axis j stretches by ε′jj.
      if(d.deformed&&d.rotStrain){
        const m=Math.max(1e-12,...[0,1,2].map(j=>Math.abs(d.rotStrain[j][j])));
        faces.filter(f=>f.front).forEach(f=>{
          for(let e=0;e<4;e++){
            const a=f.cs[e],b=f.cs[(e+1)%4],axis=[0,1,2].find(n=>a[n]!==b[n]),eps=d.rotStrain[axis][axis];
            if(Math.abs(eps)/m<.08)continue;
            const pa=P(corner(a)),pb=P(corner(b));
            ctx.strokeStyle=eps>0?COLORS.tension:COLORS.compression;ctx.globalAlpha=.35+.55*Math.abs(eps)/m;ctx.lineWidth=2.4;
            ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke();ctx.globalAlpha=1;
          }
        });
      }
      if(d.ghost&&d.deformed){
        ctx.setLineDash([5,5]);ctx.strokeStyle=COLORS.ghost;ctx.lineWidth=1.2;
        for(let i=0;i<3;i++)for(const a of [-1,1])for(const b of [-1,1]){
          const c0=[0,0,0],c1=[0,0,0],j=(i+1)%3,k=(i+2)%3;c0[i]=-1;c1[i]=1;c0[j]=c1[j]=a;c0[k]=c1[k]=b;
          const p0=P(world(c0)),p1=P(world(c1));ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      if(d.rosette)drawRosette(d,P,deform);
      wallPolys.filter(w=>w.depth>=0).forEach(drawWall);
      // Arrows on visible faces, drawn in the rotated frame: t = σ·(s e′i).
      scene.handle=null;
      if(d.arrows&&d.rotStress){
        const k=0.9/(d.scale||100),cap=1.6;
        faces.filter(f=>f.front).forEach(f=>{
          const C=f.center,r=d.rotStress,studied=d.facet&&f.i===0;
          const sn=r[f.i][f.i],Ln=Math.min(cap,Math.abs(sn)*k);
          if(Ln>.02){
            const inner=add(C,scale(f.normal,.06)),outer=add(C,scale(f.normal,.06+Ln));
            const a=P(sn>0?inner:outer),b=P(sn>0?outer:inner);arrow(a,b,sn>0?COLORS.tension:COLORS.compression,3.2,11);
            if(d.values&&Ln>.12)tipLabel(fmt(sn),sn>0?a:b,sn>0?b:a,sn>0?COLORS.tension:COLORS.compression,studied);
          }
          const shear=[0,1,2].filter(j=>j!==f.i).map(j=>({j,v:f.s*r[j][f.i]}));
          if(studied&&d.vector){
            const tau=add(scale(Q[shear[0].j],shear[0].v*k),scale(Q[shear[1].j],shear[1].v*k)),T=add(scale(f.normal,sn*k),tau),o=add(C,scale(f.normal,.02));
            if(Math.hypot(...tau)>.02){const e=P(add(o,tau)),b=P(o);arrow(b,e,COLORS.shear,3.2,11);if(d.values&&Math.hypot(...tau)>.12)tipLabel('τ '+fmt(Math.hypot(...tau)/k),b,e,COLORS.shear);}
            if(Math.hypot(...T)>.02){const e=P(add(o,T));arrow(P(o),e,COLORS.vector,2.2,10);label('T',e,COLORS.vector,'italic 700 16px Georgia,serif',8,-6);}
          }else shear.forEach(({j,v})=>{
            const L=Math.min(cap,Math.abs(v)*k);if(L<.02)return;
            const o=add(C,scale(f.normal,.02)),b=P(o),e=P(add(o,scale(Q[j],Math.sign(v)*L)));
            arrow(b,e,COLORS.shear,2.6,10);if(d.values&&L>.12)tipLabel(fmt(Math.abs(v)),b,e,COLORS.shear);
          });
        });
      }
      // Studied facet: normal n and its drag handle on the visible side.
      if(d.facet){
        const f=faces.find(x=>x.i===0&&x.front)||faces.find(x=>x.i===0&&x.s===1),base=f.center,r=d.rotStress,k=0.9/(d.scale||100);
        const reach=d.arrows&&r?Math.min(1.6,Math.max(Math.abs(r[0][0])*k,d.vector?Math.hypot(r[0][0],r[1][0],r[2][0])*k:0)):0;
        const tip=add(base,scale(f.normal,Math.max(.75,reach+.4)));
        const pa=P(add(base,scale(f.normal,Math.max(0,reach)))),pb=P(tip);
        ctx.setLineDash([3,4]);ctx.strokeStyle=COLORS.facet;ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke();ctx.setLineDash([]);
        ctx.beginPath();ctx.arc(pb.x,pb.y,d.handle?8:6,0,Math.PI*2);ctx.fillStyle=COLORS.facet;ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#fffef9';ctx.stroke();
        label('n',pb,COLORS.facet,'italic 700 16px Georgia,serif',10,5);
        scene.handle={x:pb.x,y:pb.y,side:f.s};
      }
      if(d.principal&&d.eig)drawPrincipal(d,P,V,true);
      if(d.axisLabels!==false)faces.filter(f=>f.front&&f.s>0).forEach(f=>{
        const j=(f.i+1)%3,k2=(f.i+2)%3,c=[0,0,0];c[f.i]=1.02;c[j]=-.78;c[k2]=-.78;
        label(['x′','y′','z′'][f.i],P(corner(c)),'#2f4038','italic 700 15px Georgia,serif',-5,5,'rgba(236,240,230,.75)');
      });
      drawTriad(V);
    }
    function drawPrincipal(d,P,V,front){
      d.eig.vectors.forEach((v,n)=>{
        const a=P(scale(v,-1.95)),b=P(scale(v,1.95)),colors=['#ff9b73','#b9d98c','#8fc3ff'];
        if(!front){ctx.strokeStyle=colors[n];ctx.globalAlpha=.35;ctx.setLineDash([6,5]);ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;return;}
        const tipFront=dot(V[2],v)>=0?b:a;
        ctx.fillStyle=colors[n];ctx.beginPath();ctx.arc(tipFront.x,tipFront.y,3.5,0,Math.PI*2);ctx.fill();
        label(String(n+1),tipFront,colors[n],'700 13px "Cascadia Code",Consolas,monospace',6,4);
      });
    }
    function drawRosette(d,P,deform){
      GAUGES.forEach((g,n)=>{
        const c=Math.cos(rad(g.angle)),s=Math.sin(rad(g.angle)),axis=[c,s,0],side=[-s,c,0],z=1.015,L=.62,W=.1;
        const at=(a,b)=>P(deform(add([0,0,z],add(scale(axis,a),scale(side,b)))));
        const pts=[at(-L,-W),at(L,-W),at(L,W),at(-L,W)];
        ctx.beginPath();pts.forEach((p,m)=>m?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
        ctx.fillStyle=g.color+'33';ctx.fill();ctx.strokeStyle=g.color;ctx.lineWidth=1.6;ctx.stroke();
        for(let m=-1;m<=1;m++){const a=at(-L*.8,m*W*.55),b=at(L*.8,m*W*.55);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
        label(g.name,at(L+.08,0),g.color,'600 11px "Cascadia Code",Consolas,monospace',2,4+n*2);
      });
    }
    function drawTriad(V){
      const o={x:44,y:state.h-40},L=24;
      ['x','y','z'].forEach((name,i)=>{
        const e=[0,0,0];e[i]=1;const p={x:o.x+L*dot(V[0],e),y:o.y-L*dot(V[1],e)};
        arrow(o,p,COLORS.axes[i],1.6,6);label(name,p,COLORS.axes[i],'italic 13px Georgia,serif',3,4);
      });
    }
    // Pointer: orbit the view, or drag the normal handle to turn the facet.
    let drag=null;
    canvas.addEventListener('pointerdown',e=>{
      const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,h=scene.handle;
      const onHandle=h&&scene.data?.draggable&&Math.hypot(x-h.x,y-h.y)<=20;
      drag={mode:onHandle?'normal':'orbit',x:e.clientX,y:e.clientY,yaw:state.yaw,pitch:state.pitch,side:h?.side||1};
      canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');
      if(onHandle){scene.data.handle=true;draw();}
    });
    canvas.addEventListener('pointermove',e=>{
      const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,h=scene.handle;
      if(!drag){canvas.classList.toggle('on-handle',!!(h&&scene.data?.draggable&&Math.hypot(x-h.x,y-h.y)<=20));return;}
      if(drag.mode==='orbit'){setView(drag.yaw+(e.clientX-drag.x)*.45,drag.pitch+(e.clientY-drag.y)*.45);return;}
      const V=view(state.yaw,state.pitch);let n;
      if(scene.data.planar){const p=pickPlane(x,y,V,state.cx,state.cy,state.u,[0,0,1]);if(!p)return;n=p;}
      else n=pickSphere(x,y,V,state.cx,state.cy,state.u,1.75);
      n=scale(n,drag.side);const len=Math.hypot(...n);if(len<1e-6)return;
      options.onNormal?.(scale(n,1/len));
    });
    const end=e=>{if(!drag)return;if(drag.mode==='normal'){scene.data.handle=false;draw();}drag=null;canvas.classList.remove('dragging');try{canvas.releasePointerCapture(e.pointerId);}catch{}};
    canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
    canvas.addEventListener('dblclick',()=>animateView(defaultsView.yaw,defaultsView.pitch));
    canvas.addEventListener('keydown',e=>{
      const moves={ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,-8],ArrowDown:[0,8]};
      if(moves[e.key]){e.preventDefault();setView(state.yaw+moves[e.key][0],state.pitch+moves[e.key][1]);}
      else if(e.key==='0'||e.key==='Home'){e.preventDefault();animateView(defaultsView.yaw,defaultsView.pitch);}
    });
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>resize()):null;
    observer?.observe(canvas);
    return {
      render(data){scene.data={...data,handle:scene.data?.handle||false};draw();},
      resize,setView,animateView,
      destroy(){observer?.disconnect();cancelAnimationFrame(tween);},
      view:()=>({yaw:state.yaw,pitch:state.pitch}),
      setDefaultView(yaw,pitch){defaultsView.yaw=yaw;defaultsView.pitch=pitch;},
    };
  }
  return {view,project,pickSphere,pickPlane,create,GAUGES,COLORS};
});
