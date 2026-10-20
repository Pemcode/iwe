/* Laboratory interface: the sandbox and the story episodes share the same views and controls. */
(function(root){
  'use strict';
  const KEYS=['x','y','z','xy','xz','yz'],PLANE=['x','y','xy'];
  const MODES=[['stress','Contraintes planes · σ'],['strain','Déformations dans le plan · ε'],['three','Contraintes 3D · tricercle'],['strainThree','Déformations 3D · tricercle'],['thermal','Dilatation empêchée · ΔT']];
  const RESTRAINTS=[['none','Libre'],['x','Bridée selon x'],['xy','Bridée selon x et y'],['xyz','Bridée selon x, y et z']];
  const LAYERS=[['arrows','Flèches'],['vector','Vecteur T'],['deformed','Déformée'],['principal','Directions principales'],['values','Valeurs'],['rosette','Rosette'],['trail','Trace'],['tresca','Plafond de Tresca']];
  const VIEWS={front:[0,0,'Vue de face'],iso:[-32,20,'Vue iso'],top:[0,85,'Vue de dessus']};
  const ROMAN=['I','II','III'];
  function defaultLayers(mode){return {arrows:mode!=='strain',vector:mode==='stress'||mode==='three',deformed:true,ghost:true,principal:false,values:true,rosette:false,trail:false,tresca:false};}

  function create(h){
    const {esc,f,matrixHTML,toast}=h,M=root.Mechanics,L=root.LabModel,S=root.Scene3D,St=root.Story;
    const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
    const num=v=>String(Math.round(v*100)/100);
    const maxAbs=m=>Math.max(...m.flat().map(Math.abs));
    const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sandbox={...L.defaults('stress'),layers:defaultLayers('stress')};
    let lab=sandbox,story=null,scene=null,main=null,trail=[],tween=0,mohrMap=null,last=null,mohrDrag=false;
    const three=()=>L.isThree(lab.mode),strainMode=()=>L.isStrain(lab.mode),thermal=()=>lab.mode==='thermal';
    const unit=()=>strainMode()?'µε':'MPa';
    const allowed=key=>!story||story.ep.controls.includes(key);
    const planarDrag=()=>!three()||!allowed('elev');
    const symbolOf=key=>key.length===2?(strainMode()?'ε':'τ'):(strainMode()?'ε':'σ');
    function rangeOf(key){
      const r=story?.ep.setup.ranges?.[key];if(r)return r;
      return {load:[0,3],hydro:[-300,300],omega:[-1500,1500],dT:[0,400]}[key]||(strainMode()?[-1500,1500]:[-300,300]);
    }
    const stepOf=key=>({load:0.01,dT:0.5,hydro:1,omega:5}[key]??(strainMode()?5:1));

    // A precise text field and a tactile slider drive the same value.
    function slider(key,label,aria,unitText,short){
      const [min,max]=rangeOf(key),value=lab[key];
      return `<div class="slide-field" data-key="${key}"><label for="lab-${key}">${label}</label><span class="input-wrap"><input id="lab-${key}" data-component="${key}" type="text" inputmode="decimal" autocomplete="off" value="${num(value)}" aria-label="${esc(aria)}">${unitText?`<span class="unit">${unitText}</span>`:''}</span><input type="range" class="slide" data-range="${key}" min="${min}" max="${max}" step="${stepOf(key)}" value="${value}" aria-label="Curseur ${esc(short)}"></div>`;
    }
    function controlsPanel(){
      const t=three(),s=strainMode(),th=thermal(),u=unit();
      const keys=th?[]:(t?KEYS:PLANE).filter(allowed);
      const modes=MODES.map(([v,l])=>`<option value="${v}"${v===lab.mode?' selected':''}>${l}</option>`).join('');
      return `<section class="panel lab-controls${story?' control-deck':''}" aria-label="Commandes du laboratoire">
        ${story?'<div class="eyebrow">TES COMMANDES · MANIPULE ET REGARDE L’ÉLÉMENT</div>':`<h2>La matière en entrée</h2><label class="field" for="lab-mode">Mode de calcul</label><select id="lab-mode">${modes}</select>`}
        ${keys.length?`<div class="eyebrow">TENSEUR SYMÉTRIQUE · <span class="nocaps">${u}</span></div><div class="slider-stack">${keys.map(k=>slider(k,`${symbolOf(k)}<sub>${k}</sub>`,`${k} (${u})`,u,symbolOf(k)+k)).join('')}</div>`:''}
        ${th?thermalControls():''}
        ${!th&&allowed('load')?slider('load','λ','Intensité du chargement λ','×','λ'):''}
        ${t&&!s&&!th&&allowed('hydro')?slider('hydro','p','Pression ajoutée p (MPa)','MPa','p'):''}
        ${s&&allowed('omega')?slider('omega','ω<sub>z</sub>','Rotation de corps rigide ωz (µrad)','µrad','ωz'):''}
        ${th?'':orientationHTML()}
        ${story?'':materialControls()+presetsHTML()}
        ${story?'':`<p class="compact lab-note" id="lab-note">${modeNote()}</p>`}
        <div id="lab-error" role="status" class="compact"></div>
      </section>`;
    }
    function thermalControls(){
      return `${allowed('dT')?slider('dT','ΔT','Échauffement ΔT (K)','K','ΔT'):''}
        ${allowed('restraint')?`<fieldset class="restraint"><legend>Bridage de l’élément</legend>${RESTRAINTS.map(([v,l])=>`<label class="radio-chip"><input type="radio" name="restraint" value="${v}"${lab.restraint===v?' checked':''}><span>${l}</span></label>`).join('')}</fieldset>`:''}`;
    }
    function materialControls(){
      const options=Object.entries(L.materials).map(([k,m])=>`<option value="${k}"${lab.material===k?' selected':''}>${m.label} · E = ${f(m.E/1000,0)} GPa · ν = ${f(m.nu,2)}</option>`).join('');
      return `<div class="material-row"><label class="field" for="lab-material">Matériau (valeurs Eurocode)</label><select id="lab-material">${options}</select>
        ${lab.mode==='strain'?'':`<label class="field" for="lab-fy">fy de référence (donnée)</label><span class="input-wrap"><input id="lab-fy" type="text" inputmode="decimal" autocomplete="off" value="${num(lab.fy)}" aria-label="Limite d’élasticité de référence fy (MPa)"><span class="unit">MPa</span></span>`}</div>`;
    }
    function presetsHTML(){
      if(thermal())return '';
      const t=three(),s=strainMode();
      return `<div class="presets" role="group" aria-label="Préréglages"><button type="button" class="preset" data-preset="traction">Traction</button><button type="button" class="preset" data-preset="shear">Cisaillement</button><button type="button" class="preset" data-preset="hydro">${t?(s?'Isotrope':'Hydrostatique'):'Équibiaxial'}</button><button type="button" class="preset" data-preset="weld">Zone soudée</button>${s?'':'<button type="button" class="preset" data-preset="fillet">Cordon d’angle</button>'}</div>`;
    }
    function modeNote(){
      if(thermal())return 'Dilatation libre αΔT dans les trois directions, empêchée selon les axes bridés. Modèle élastique à propriétés constantes : ni plasticité ni contraintes résiduelles.';
      if(lab.mode==='strainThree')return 'Entre les composantes du tenseur ε en µε : chaque terme hors diagonale vaut γij/2. Le diamètre extérieur donne γmax en 3D. Les flèches suivent la loi de Hooke.';
      if(lab.mode==='strain')return 'Entre εxy = γxy/2. Les nombres sont en microdéformations. Ce mode décrit le cercle dans xy, sans hypothèse sur εz : pas de contrainte calculée. ωz ajoute une rotation qui ne déforme rien.';
      if(lab.mode==='three')return 'Les termes symétriques sont liés automatiquement. Valeurs principales triées par ordre décroissant. p ajoute la même pression sur les trois faces.';
      return 'σz = τxz = τyz = 0. La troisième valeur principale doit toujours être prise en compte pour τmax absolu. λ multiplie tout le tenseur : chargement proportionnel.';
    }
    function layerAvailable(k){
      const stressShown=lab.mode!=='strain';
      if(k==='arrows'||k==='vector'||k==='values')return stressShown;
      if(k==='tresca')return !strainMode();
      if(k==='rosette')return !three();
      return true;
    }
    function stageHTML(){
      const t=three(),s=strainMode(),u=unit();
      const chips=LAYERS.filter(([k])=>layerAvailable(k)).map(([k,l])=>`<button type="button" class="chip" data-layer="${k}" aria-pressed="${!!lab.layers[k]}">${l}</button>`).join('');
      return `<div class="lab-views">
        <section class="stage3d" aria-labelledby="stage-title">
          <div class="stage-head"><div><div class="eyebrow">VUE 3D · GLISSE POUR TOURNER</div><h2 id="stage-title">L’élément de matière</h2></div>
            <div class="view-buttons" role="group" aria-label="Vues prédéfinies">${Object.entries(VIEWS).map(([k,v])=>`<button type="button" data-view="${k}">${v[2]}</button>`).join('')}</div></div>
          <div class="stage-canvas"><canvas id="element-3d" tabindex="0" role="img" aria-label="Élément de matière en 3D : glisser pour tourner la vue, flèches du clavier pour l’orienter, poignée n pour tourner la facette" aria-describedby="element-3d-desc"></canvas>
            <div class="stage-badges"><span id="amp-badge" class="amp-badge"></span>${allowed('amp')?'<button type="button" id="real-scale" class="real-scale" aria-pressed="false">Échelle réelle</button>':''}</div>
          </div>
          <div class="stage-legend" id="stage-legend" aria-hidden="true"></div>
          <div class="chips" role="group" aria-label="Couches affichées">${chips}</div>
          <p id="element-3d-desc" class="sr-only" aria-live="polite"></p>
        </section>
        <section class="panel plot-card">
          <div class="plot-head"><h2>${t?'Les trois cercles de Mohr':s?'Le cercle des déformations':'Le cercle des contraintes'}</h2><span>ORDONNÉE : ${s?'εx′y′ = γx′y′/2':t?'|τ| de la facette':'τx′y′'} · ${u}</span></div>
          <svg id="mohr-svg" viewBox="0 0 640 350" role="img" aria-label="Cercles de Mohr et point de la facette étudiée"></svg>
          <div id="plot-legend" class="plot-legend"></div>
          <p class="plot-caption">${t?'Une facette quelconque donne un point entre les cercles.':'Glisse le point P : la facette tourne avec lui.'} Échelles identiques sur les deux axes.</p>
          <div id="rotated-values" class="rotation-result" aria-live="polite"></div>
        </section>
      </div>`;
    }
    function angleRow(id,sym,value,aria,rangeAria){
      return `<div class="slider-row"><label for="${id}">${sym}</label><input type="range" id="${id}" min="-90" max="90" step="0.01" value="${value}" aria-label="${rangeAria}"><span class="angle-entry"><input id="${id}-number" data-angle="${id}" type="text" inputmode="decimal" maxlength="10" autocomplete="off" value="${num(value)}" aria-label="${aria}" aria-describedby="angle-error"><span>°</span></span></div>`;
    }
    function orientationHTML(){
      const t=three(),rows=[];
      if(allowed('angle'))rows.push(angleRow('angle',t?'φ':'θ',lab.angle,'Angle en degrés','Rotation de la normale'));
      if(t&&allowed('elev'))rows.push(angleRow('elev','ψ',lab.elev,'Élévation ψ (degrés)','Inclinaison de la normale'));
      if(t&&allowed('roll'))rows.push(angleRow('roll','χ',lab.roll,'Rotation propre χ (degrés)','Rotation propre des axes y′ et z′'));
      if(!rows.length)return '';
      return `<div class="orientation"><div class="eyebrow">${t?'LA FACETTE DANS L’ESPACE':'LE CHANGEMENT DE REPÈRE'}</div><p class="compact">${t?'φ : azimut de la normale n dans le plan xy ; ψ : élévation vers z ; χ fait tourner y′ et z′ autour de n.':'θ est l’angle de la normale x′, positif antihoraire. Axe τ vers le haut : le point tourne de −2θ.'}</p>${rows.join('')}<output for="angle" id="angle-value" class="sr-only">${num(lab.angle)}°</output><p id="angle-error" class="compact" role="status" hidden>Entre un angle entre −90° et +90° (virgule ou point acceptés).</p>${allowed('align')?'<button type="button" class="btn secondary small" id="align">Aligner sur les directions principales</button>':''}</div>`;
    }
    function tensorPanel(){
      const weldable=!strainMode()&&!thermal();
      return `<section class="panel tensor-panel"><div class="eyebrow">LE MÊME ÉTAT, DEUX REPÈRES</div><div class="matrices"><div id="tensor-display" class="tensor-display"></div><div id="tensor-rotated" class="tensor-display rotated"></div></div><p class="compact" id="tensor-note"></p>${weldable&&(!story||lab.weld)?`${story?'':`<button type="button" class="chip weld-chip" id="weld-toggle" aria-pressed="${!!lab.weld}">Contrôle cordon d’angle · EC3</button>`}<div id="weld-panel" class="weld-panel"${lab.weld?'':' hidden'}></div>`:''}</section>`;
    }
    function labGrid({before='',top=''}={}){
      return `<div class="lab-grid${story?' story-grid':''}"><div class="lab-aside">${before}${story?'':controlsPanel()}</div><div class="lab-main">${top}${story?controlsPanel():''}${stageHTML()}<div class="lab-under">${tensorPanel()}<section class="panel hud" id="lab-hud" aria-label="Tableau de bord"></section></div><div id="lab-results" class="lab-values" aria-live="polite"></div><div class="panel observe"><div class="eyebrow">À OBSERVER</div><p class="compact" id="lab-observe"></p></div></div></div>`;
    }
    function switchHTML(active){
      return `<nav class="lab-switch" aria-label="Modes du laboratoire"><a href="#histoire"${active==='story'?' aria-current="page"':''}><b>Mode histoire</b><span>12 épisodes guidés</span></a><a href="#laboratoire"${active==='sandbox'?' aria-current="page"':''}><b>Bac à sable</b><span>tout manipuler</span></a></nav>`;
    }
    function sandboxPage(target){
      main=target;story=null;lab=sandbox;
      main.innerHTML=`<div class="lab-page"><div class="lab-intro"><div><div class="eyebrow"><span class="dot"></span> LE LABORATOIRE · ACCÈS LIBRE</div><h1>Tourne le repère.<br>Garde le même état.</h1><p>Fais tourner l’élément du bout des doigts, oriente la facette ou déplace le point du cercle : les efforts, la déformée et le cercle réagissent ensemble. Ici, l’expérience ne coûte aucun XP.</p></div>${switchHTML('sandbox')}</div>${labGrid()}</div>`;
      mountLab();
    }
    function mountLab(){
      cancelAnimationFrame(tween);scene?.destroy();
      scene=S.create($('#element-3d'),{onNormal:normalDragged});
      const v=story?.ep.setup.view,[yaw,pitch]=v?[v.yaw,v.pitch]:three()?VIEWS.iso:[-26,16];
      scene.setDefaultView(yaw,pitch);scene.setView(yaw,pitch);
      wire();scene.resize();refresh();
    }
    function syncInputs(){
      $$('[data-component]').forEach(input=>{if(input!==document.activeElement){input.value=num(lab[input.dataset.component]);input.removeAttribute('aria-invalid');}});
      $$('[data-range]').forEach(range=>{range.value=String(lab[range.dataset.range]);});
      $$('input[name=restraint]').forEach(r=>{r.checked=r.value===lab.restraint;});
      syncAngles();
    }
    function syncAngles(){
      for(const id of ['angle','elev','roll']){
        const range=$('#'+id),field=$(`#${id}-number`);
        if(range)range.value=String(lab[id]);
        if(field&&field!==document.activeElement){field.value=num(lab[id]);field.removeAttribute('aria-invalid');}
      }
      if($('#angle-value'))$('#angle-value').textContent=`${num(lab.angle)}°`;
    }
    function setValue(key,value){
      if(KEYS.includes(key)||key==='load'||key==='hydro'||key==='omega'||key==='dT')trail=[];
      lab[key]=value;
    }
    function wire(){
      $('#lab-mode')?.addEventListener('change',e=>switchMode(e.target.value));
      $$('[data-component]').forEach(input=>input.addEventListener('input',()=>{
        const key=input.dataset.component,value=M.parseNumber(input.value);
        const bad=value===null||Math.abs(value)>1e6||(key==='load'&&value<0);
        if(bad){input.setAttribute('aria-invalid','true');$('#lab-error').textContent='Entre une valeur finie entre −1 000 000 et +1 000 000. Le tracé garde la dernière valeur valide.';return;}
        input.removeAttribute('aria-invalid');setValue(key,value);
        const range=$(`[data-range="${key}"]`);if(range)range.value=String(value);
        $('#lab-error').textContent=$('[data-component][aria-invalid=true]')?'Un champ reste invalide : sa dernière valeur valide est conservée.':'';
        refresh();
      }));
      $$('[data-range]').forEach(range=>range.addEventListener('input',()=>{
        const key=range.dataset.range;setValue(key,Number(range.value));
        const field=$(`#lab-${key}`);if(field){field.value=num(lab[key]);field.removeAttribute('aria-invalid');}
        refresh();
      }));
      for(const id of ['angle','elev','roll']){
        const range=$('#'+id),field=$(`#${id}-number`);if(!range)continue;
        range.addEventListener('input',()=>{cancelAnimationFrame(tween);lab[id]=Number(range.value);field.value=num(lab[id]);field.removeAttribute('aria-invalid');$('#angle-error').hidden=true;refresh();});
        field.addEventListener('input',()=>{
          const n=M.parseNumber(field.value),valid=n!==null&&n>=-90&&n<=90;
          field.setAttribute('aria-invalid',String(!valid));$('#angle-error').hidden=valid;
          if(valid){cancelAnimationFrame(tween);lab[id]=Math.round(n*100)/100;range.value=String(lab[id]);refresh();}
        });
        field.addEventListener('blur',()=>{if(field.getAttribute('aria-invalid')!=='true')field.value=num(lab[id]);});
      }
      $$('input[name=restraint]').forEach(r=>r.addEventListener('change',()=>{if(r.checked){lab.restraint=r.value;lab.scale=null;refresh();}}));
      $('#lab-material')?.addEventListener('change',e=>{lab.material=e.target.value;lab.amp=null;refresh();});
      $('#lab-fy')?.addEventListener('input',e=>{const v=M.parseNumber(e.target.value);if(v!==null&&v>0&&v<=5000){e.target.removeAttribute('aria-invalid');lab.fy=v;refresh();}else e.target.setAttribute('aria-invalid','true');});
      $$('[data-preset]').forEach(b=>b.addEventListener('click',()=>applyPreset(b.dataset.preset)));
      $$('[data-layer]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.layer;lab.layers[k]=!lab.layers[k];b.setAttribute('aria-pressed',String(lab.layers[k]));if(k==='trail')trail=[];refresh();}));
      $$('[data-view]').forEach(b=>b.addEventListener('click',()=>{const [yaw,pitch]=VIEWS[b.dataset.view];scene.animateView(yaw,pitch);}));
      $('#real-scale')?.addEventListener('click',()=>{lab.amp=lab.amp===1?null:1;refresh();});
      $('#align')?.addEventListener('click',align);
      $('#weld-toggle')?.addEventListener('click',e=>{lab.weld=!lab.weld;e.currentTarget.setAttribute('aria-pressed',String(lab.weld));$('#weld-panel').hidden=!lab.weld;if(lab.weld)lab.layers.vector=true;refresh();});
      const svg=$('#mohr-svg');
      svg.addEventListener('pointerdown',e=>{
        if(three()||!allowed('angle')||!e.target.closest('.mohr-handle'))return;
        e.preventDefault();cancelAnimationFrame(tween);mohrDrag=true;svg.setPointerCapture(e.pointerId);svg.classList.add('dragging');
      });
      svg.addEventListener('pointermove',e=>{if(mohrDrag)mohrPointer(e);});
      const stop=()=>{mohrDrag=false;svg.classList.remove('dragging');};
      svg.addEventListener('pointerup',stop);svg.addEventListener('pointercancel',stop);
    }
    function switchMode(mode,patch={}){
      const keep={material:lab.material,fy:lab.fy};
      Object.assign(sandbox,L.defaults(mode),keep,patch,{layers:{...defaultLayers(mode),...(patch.weld?{vector:true}:{})}});
      trail=[];sandboxPage(main);
    }
    function applyPreset(name){
      if(name==='fillet'){switchMode('three',{x:140,y:-20,z:0,xy:40,xz:30,yz:30,weld:true});toast('Cordon d’angle d’axe z : oriente la facette à 45° pour lire σ⊥, τ⊥ et τ∥.');return;}
      const s=strainMode(),t=three(),v=s?600:120;
      Object.assign(lab,{x:0,y:0,z:0,xy:0,xz:0,yz:0,angle:0,elev:0,roll:0,load:1,hydro:0,omega:0,amp:null,scale:null});
      if(name==='traction')lab.x=v;
      if(name==='shear')lab.xy=v/2;
      if(name==='hydro')Object.assign(lab,{x:v,y:v,z:t?v:0});
      if(name==='weld')Object.assign(lab,s?{x:600,y:-200,xy:300}:{x:120,y:40,z:t?-30:0,xy:30,xz:t?20:0});
      trail=[];syncInputs();refresh();
    }
    function normalDragged(n){
      cancelAnimationFrame(tween);
      if(planarDrag()){const th=Math.atan2(n[1],n[0])*180/Math.PI;lab.angle=Math.round((((th+90)%180+180)%180-90)*100)/100;}
      else{
        const v=n[0]<0||(Math.abs(n[0])<1e-9&&n[1]<0)?n.map(c=>-c):n;
        lab.angle=Math.round(Math.atan2(v[1],v[0])*18000/Math.PI)/100;
        lab.elev=Math.round(Math.asin(Math.max(-1,Math.min(1,v[2])))*18000/Math.PI)/100;
      }
      syncAngles();refresh();
    }
    function mohrPointer(e){
      const svg=$('#mohr-svg'),r=svg.getBoundingClientRect(),m=mohrMap;if(!m)return;
      const sx=(e.clientX-r.left)*m.width/r.width,sy=(e.clientY-r.top)*m.height/r.height;
      const sigma=(sx-m.width/2)/m.scale+m.mid,tau=(m.axisY-sy)/m.scale;
      if(Math.hypot(sigma-m.center,tau)<1e-9)return;
      const beta=Math.atan2(tau,sigma-m.center)*180/Math.PI,theta=(m.alpha-beta)/2;
      lab.angle=Math.round((((theta+90)%180+180)%180-90)*100)/100;syncAngles();refresh();
    }
    function align(){
      const d=last;let target;
      if(!three()){
        if(d.planar.angle===null){toast('Cercle réduit à un point : toutes les directions du plan sont principales.');return;}
        target={angle:d.planar.angle,elev:0,roll:0};
      }else{const a=L.principalAngles(d);target={angle:a.phi,elev:a.psi,roll:a.chi};}
      animateAngles(target);
    }
    function animateAngles(target){
      cancelAnimationFrame(tween);
      const from={angle:lab.angle,elev:lab.elev||0,roll:lab.roll||0};
      const delta=k=>{const x=target[k]-from[k];return ((x+90)%180+180)%180-90;};
      const finish=()=>{Object.assign(lab,target);syncAngles();refresh();};
      if(reduced()){finish();return;}
      const start=performance.now();
      const step=now=>{
        const t=Math.min(1,(now-start)/700),e=t<.5?4*t*t*t:1-(-2*t+2)**3/2;
        if(t>=1){finish();return;}
        for(const k of ['angle','elev','roll'])lab[k]=from[k]+delta(k)*e;
        syncAngles();refresh();tween=requestAnimationFrame(step);
      };
      tween=requestAnimationFrame(step);
    }
    function refresh(){
      if(!$('#element-3d'))return null;
      if(thermal())Object.assign(lab,{angle:0,elev:0,roll:0});
      const d=L.derive(lab);last=d;
      // Frozen scales: a bigger load gives longer arrows and a larger deformation.
      if(lab.amp==null||(lab.amp!==1&&lab.amp*maxAbs(d.grad)>0.38))lab.amp=L.autoAmp(d);
      if(lab.scale==null||maxAbs(d.stress||d.input)>1.8*lab.scale)lab.scale=L.autoScale(d);
      if(lab.layers.trail){trail.push([d.mohr.x,d.mohr.y]);if(trail.length>240)trail.shift();}
      drawScene(d);drawMohr(d);renderRotated(d);renderTensor(d);renderHud(d);renderResults(d);renderObserve(d);describe(d);
      if(story)updateStory();
      return d;
    }
    function drawScene(d){
      const layers=lab.layers,stressShown=!!d.stress&&lab.mode!=='strain';
      scene.render({
        Q:d.Q,grad:d.grad,amp:lab.amp,deformed:layers.deformed,ghost:layers.ghost,rotStrain:d.rotStrain,
        arrows:layers.arrows&&stressShown,rotStress:stressShown?d.rotStress:null,scale:lab.scale,values:layers.values,
        vector:layers.vector&&stressShown,facet:!thermal(),principal:layers.principal,eig:d.eig,
        rosette:layers.rosette&&!three(),walls:thermal()&&lab.restraint!=='none'?lab.restraint:'',heat:thermal()?lab.dT:0,
        planar:planarDrag(),draggable:!thermal()&&allowed('angle'),compact:innerWidth<560,
      });
      $('#amp-badge').textContent=lab.amp===1?'Déformée × 1 · échelle réelle':`Déformée × ${f(lab.amp,0)}`;
      $('#amp-badge').classList.toggle('real',lab.amp===1);
      const real=$('#real-scale');if(real){real.setAttribute('aria-pressed',String(lab.amp===1));real.textContent=lab.amp===1?'Amplifier la déformée':'Échelle réelle';}
      $('#stage-legend').innerHTML=(stressShown&&layers.arrows?`<span><i class="lg tension"></i>traction</span><span><i class="lg compression"></i>compression</span><span><i class="lg shear"></i>cisaillement</span>${layers.vector?'<span><i class="lg vector"></i>T = σ·n</span>':''}<span class="scale-note">flèche d’une arête = ${f(lab.scale,0)} MPa</span>`:'')+(layers.deformed?'<span><i class="lg ghost"></i>forme initiale</span>':'');
    }
    function drawMohr(d){
      const svg=$('#mohr-svg');if(!svg)return;
      const t=d.three,u=d.unit,circles=d.circles,P=d.mohr,s=d.strainInput;
      const width=Math.max(220,Math.min(680,svg.clientWidth||640)),height=width<400?320:350,axisY=height/2-5;
      svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
      const tresca=lab.layers.tresca&&!s?(lab.fy||355)/2:null;
      const values=circles.flatMap(c=>[c.center-c.radius,c.center+c.radius]).concat(P.x,trail.map(p=>p[0]));
      let lo=Math.min(0,...values),hi=Math.max(0,...values);
      if(hi===lo){lo-=1;hi+=1;}
      const extent=hi-lo,pad=extent*.12,vmax=Math.max(...circles.map(c=>c.radius),Math.abs(P.y),tresca||0);
      const scale=Math.min((width-70)/(extent+2*pad),(height-115)/(2*(vmax+pad)||1));
      const mid=(lo+hi)/2,X=v=>width/2+(v-mid)*scale,Y=v=>axisY-v*scale;
      const tickLabel=v=>v===0?'0':Math.abs(v)<0.001||Math.abs(v)>=100000?v.toExponential(1).replace('-','−'):f(v,Math.max(1,2-Math.floor(Math.log10(extent))));
      const colors=['#b84125','#648465','#9b9d6b'],sym=s?'ε':'σ';
      let out=`<title>${t?'Tricercle':'Cercle'} de Mohr</title><desc>Facette : composante normale ${f(P.x)} et ${t?'cisaillement':'composante tangentielle'} ${f(P.y)} ${u}.</desc>
        <defs><pattern id="plotgrid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#dfe3d9" stroke-width=".7"/></pattern>${t?`<mask id="admissible-mask"><rect width="${width}" height="${height}" fill="black"/><circle cx="${X(circles[0].center)}" cy="${axisY}" r="${circles[0].radius*scale}" fill="white"/><circle cx="${X(circles[1].center)}" cy="${axisY}" r="${circles[1].radius*scale}" fill="black"/><circle cx="${X(circles[2].center)}" cy="${axisY}" r="${circles[2].radius*scale}" fill="black"/></mask>`:''}</defs>
        <rect x="12" y="18" width="${width-24}" height="${height-55}" rx="9" fill="url(#plotgrid)"/>`;
      if(t)out+=`<rect class="admissible" x="0" y="0" width="${width}" height="${height}" fill="#bb4023" fill-opacity=".1" mask="url(#admissible-mask)"/>`;
      out+=`<path d="M16 ${axisY}H${width-16}M${X(0)} 25V${height-37}" stroke="#88947f"/><text x="${width-22}" y="${axisY-10}" fill="#52624d" font-size="13">${sym}</text><text x="${X(0)+9}" y="33" fill="#52624d" font-size="12">${s?'γ/2':t?'|τ|':'τ'}</text>`;
      const intervals=width<440?2:4;
      for(let i=0;i<=intervals;i++){const v=lo+(hi-lo)*i/intervals;out+=`<path d="M${X(v)} ${axisY-4}v8" stroke="#88947f"/><text class="axis-tick" x="${X(v)}" y="${axisY+22}" text-anchor="middle" font-family="monospace" fill="#52624d" font-size="11">${tickLabel(v)}</text>`;}
      const tick=Math.max(...circles.map(c=>c.radius)),labelLeft=X(0)>width*.65;
      if(tick>1e-8)for(const sign of [-1,1])out+=`<path d="M${X(0)-4} ${Y(sign*tick)}h8" stroke="#88947f"/><text x="${X(0)+(labelLeft?-8:8)}" y="${Y(sign*tick)+4}" text-anchor="${labelLeft?'end':'start'}" font-size="11" fill="#52624d">${tickLabel(sign*tick)}</text>`;
      if(tresca)for(const sign of [-1,1])out+=`<path d="M16 ${Y(sign*tresca)}H${width-16}" stroke="#bb4023" stroke-dasharray="7 5" stroke-width="1.2"/>${sign>0?`<text x="18" y="${Y(tresca)-6}" text-anchor="start" font-size="11" fill="#a33d25">plafond de Tresca · fy/2 = ${f(tresca,1)}</text>`:''}`;
      circles.forEach((c,i)=>{out+=`<circle class="mohr-circle" cx="${X(c.center)}" cy="${axisY}" r="${Math.max(0,c.radius*scale)}" fill="none" stroke="${t?colors[i]:'#47694c'}" stroke-width="2.2"/><circle cx="${X(c.center)}" cy="${axisY}" r="2.5" fill="${t?colors[i]:'#47694c'}"/>`;});
      if(t)d.eig.values.forEach((v,i)=>{out+=`<circle cx="${X(v)}" cy="${axisY}" r="3.5" fill="#26342f"/><text x="${X(v)+5}" y="${axisY-8-(i%2)*12}" text-anchor="start" font-size="12" fill="#26342f">${sym}${i+1}</text>`;});
      if(trail.length>1)out+=`<path d="M${trail.map(p=>`${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('L')}" fill="none" stroke="#bb4023" stroke-opacity=".45" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
      const center=t?null:circles[0].center,R=t?0:circles[0].radius;
      const alpha=Math.atan2(d.input[0][1],(d.input[0][0]-d.input[1][1])/2)*180/Math.PI;
      if(!t){
        const A={x:d.input[0][0],y:d.input[0][1]},Qp={x:d.rotated[1][1],y:-P.y};
        out+=`<path d="M${X(Qp.x)} ${Y(Qp.y)}L${X(P.x)} ${Y(P.y)}" stroke="#bb4023" stroke-width="1.3" stroke-dasharray="5 4"/>`;
        if(R>1e-9&&Math.abs(lab.angle)>=1){
          const r=Math.max(16,Math.min(R*scale*.38,48)),a0=alpha*Math.PI/180,a1=(alpha-2*lab.angle)*Math.PI/180;
          const p0=[X(center)+r*Math.cos(a0),axisY-r*Math.sin(a0)],p1=[X(center)+r*Math.cos(a1),axisY-r*Math.sin(a1)],sweep=lab.angle>0?1:0,large=Math.abs(2*lab.angle)>180?1:0;
          const mida=(a0+a1)/2;
          out+=`<path d="M${p0[0]} ${p0[1]}A${r} ${r} 0 ${large} ${sweep} ${p1[0]} ${p1[1]}" fill="none" stroke="#a33d25" stroke-width="1.4"/><text x="${X(center)+(r+8)*Math.cos(mida)}" y="${axisY-(r+8)*Math.sin(mida)+4}" text-anchor="start" font-size="12" fill="#a33d25" font-family="Georgia">2θ</text>`;
        }
        if(Math.abs(lab.angle)>=0.5)out+=`<circle cx="${X(A.x)}" cy="${Y(A.y)}" r="4.5" fill="#fffef9" stroke="#65726b" stroke-width="1.6"/><text x="${X(A.x)+8}" y="${Y(A.y)+16}" text-anchor="start" font-size="11" fill="#65726b" font-family="monospace">x · θ = 0</text>`;
        out+=`<circle cx="${X(Qp.x)}" cy="${Y(Qp.y)}" r="5" fill="#fffef9" stroke="#bb4023" stroke-width="2"/><text x="${Math.min(width-30,X(Qp.x)+9)}" y="${Math.min(height-40,Math.max(40,Y(Qp.y)+16))}" text-anchor="start" font-size="12" fill="#a33d25" font-family="monospace">y′</text>`;
        out+=`<path d="M${X(center)} ${axisY}L${X(P.x)} ${Y(P.y)}" stroke="#bb4023" stroke-width="1.3"/>`;
      }else out+=`<path d="M${X(P.x)} ${axisY}V${Y(P.y)}" stroke="#bb4023" stroke-width="1.1" stroke-dasharray="3 3"/>`;
      const handle=!t&&allowed('angle');
      out+=`<g class="${handle?'mohr-handle':'mohr-point'}">${handle?`<circle cx="${X(P.x)}" cy="${Y(P.y)}" r="18" fill="#bb4023" fill-opacity=".08"/>`:''}<circle cx="${X(P.x)}" cy="${Y(P.y)}" r="6.5" fill="#bb4023" stroke="#fffef9" stroke-width="2"/></g><text x="${Math.min(width-46,Math.max(12,X(P.x)+11))}" y="${Math.max(40,Y(P.y)-12)}" text-anchor="start" fill="#a33d25" font-family="monospace" font-size="12">P · x′</text>`;
      svg.innerHTML=out;
      mohrMap={width,height,axisY,scale,mid,center:center??0,alpha};
      $('#plot-legend').innerHTML=t?circles.map((c,i)=>`<span><i style="background:${colors[i]}" aria-hidden="true"></i>(${c.i+1},${c.j+1}) · R = ${f(c.radius,1)} ${u}</span>`).join('')+'<span><i class="zone" aria-hidden="true"></i>facettes quelconques</span>':`<span><i style="background:#bb4023" aria-hidden="true"></i>P : face x′</span><span><i class="hollow" aria-hidden="true"></i>y′ : face perpendiculaire</span><span><i class="hollow grey" aria-hidden="true"></i>x : repère initial</span>`;
    }
    function renderRotated(d){
      const u=d.unit,sym=d.symbol,F=d.facet;
      $('#rotated-values').innerHTML=d.three
        ?`<div>${sym}n = <b>${f(F.sigma)} ${u}</b><br>|τ| = <b>${f(F.tau)} ${u}</b><br><span class="compact">${d.strainInput?'ε':'τ'}y′x′ = ${f(F.ty)} · ${d.strainInput?'ε':'τ'}z′x′ = ${f(F.tz)} ${u}</span></div>`
        :`<div>${sym}n = <b>${f(F.sigma)} ${u}</b><br>${d.strainInput?'εx′y′':'τ signé'} = <b>${f(F.ty)} ${u}</b><br>${d.strainInput?`γx′y′ = ${f(2*F.ty)} µrad`:`${sym}y′ = ${f(d.rotated[1][1])} ${u}`}</div>`;
    }
    function renderTensor(d){
      const t=d.three,sym=d.symbol,u=d.unit;
      const cut=m=>t?m:[[m[0][0],m[0][1]],[m[1][0],m[1][1]]];
      $('#tensor-display').innerHTML=matrixHTML({symbol:sym,rows:cut(d.input).map(r=>r.map(v=>f(v,1))),unit:u});
      $('#tensor-rotated').innerHTML=matrixHTML({symbol:sym+'′',rows:cut(d.rotated).map(r=>r.map(v=>f(v,1))),unit:u,label:`Composantes dans le repère tourné x′y′${t?'z′':''}, en ${u}`});
      const notes=[`À gauche dans x, y${t?', z':''} ; à droite dans le repère tourné. La trace reste ${f(d.input[0][0]+d.input[1][1]+d.input[2][2])} ${u}.`];
      if(lab.load!==1&&!thermal())notes.push(`λ = ${f(lab.load,2)} est déjà appliqué.`);
      if(thermal())notes.push(`Contraintes issues de ΔT = ${f(lab.dT,1)} K et du bridage.`);
      $('#tensor-note').textContent=notes.join(' ');
      if($('#weld-panel')&&lab.weld&&d.weld)renderWeld(d.weld);
    }
    function gauge(title,value,ratio,note,unitText='MPa'){
      const level=ratio>1?'over':ratio>.8?'warn':'ok',w=Math.min(100,ratio/1.25*100);
      return `<div class="gauge" data-level="${level}"><div class="gauge-head"><span>${title}</span><b>${value}${unitText?' '+unitText:''}</b></div><div class="gauge-track" aria-hidden="true"><span style="width:${w}%"></span><i style="left:80%"></i></div><small>${note}</small></div>`;
    }
    function renderWeld(w){
      const verdict=w.pass?'Les deux contrôles locaux passent.':w.ratioNormal>1&&w.ratioCombined<=1?'Le critère normal échoue : le second verrou.':w.ratioCombined>1&&w.ratioNormal<=1?'Le critère combiné échoue.':'Les deux critères échouent.';
      $('#weld-panel').innerHTML=`<div class="eyebrow">CORDON D’ANGLE · EN 1993-1-8:2005 §4.5.3.2</div><p class="compact">La facette x′ est le plan de gorge, z′ l’axe du cordon. fu = ${w.fu} MPa, βw = ${f(w.beta,2)}, γM2 = ${f(w.gamma,2)} : paramètres imposés.</p><div class="weld-values"><span>σ⊥ = ${f(w.perp)} MPa</span><span>τ⊥ = ${f(w.tperp)} MPa</span><span>τ∥ = ${f(w.tpar)} MPa</span></div>${gauge('Critère combiné',f(w.ratioCombined,3),w.ratioCombined,`√[σ⊥² + 3(τ⊥² + τ∥²)] = ${f(w.combined,1)} ≤ ${f(w.limitCombined,1)} MPa`,'')}${gauge('Critère normal',f(w.ratioNormal,3),w.ratioNormal,`σ⊥ = ${f(Math.max(0,w.perp),1)} ≤ 0,9 fu/γM2 = ${f(w.limitNormal,1)} MPa`,'')}<p class="weld-verdict" data-pass="${w.pass}">${verdict}</p>`;
    }
    function renderHud(d){
      const parts=[],fy=lab.fy||355;
      if(d.stress&&lab.mode!=='strain'){
        parts.push(gauge('Von Mises',f(d.vm,1),d.vm/fy,`σVM / fy = ${f(d.vm/fy,2)} · fy = ${f(fy,0)} MPa (donnée)`));
        parts.push(gauge('Tresca',f(d.tresca,1),d.tresca/fy,`σ1 − σ3 = 2 τmax · comparé à fy`));
        parts.push(`<div class="hud-line"><span>Contrainte moyenne σm</span><b>${f(d.mean,1)} MPa</b><small>${d.mean>1?'triaxialité de traction':d.mean<-1?'compression moyenne':'état déviatorique'}</small></div>`);
      }
      const e=d.strain.map(r=>r.map(v=>v*1e6));
      const strainText=lab.mode==='strain'?`εx = ${f(e[0][0],2)} µε · εy = ${f(e[1][1],2)} µε · γxy = ${f(2*e[0][1],2)} µrad`:`εx = ${f(e[0][0],2)} µε · εy = ${f(e[1][1],2)} µε · εz = ${f(e[2][2],2)} µε`;
      parts.push(`<div class="hud-line strains"><span>${d.strainInput?'Déformations saisies':thermal()?'Déformations totales (Hooke + αΔT)':'Déformations (loi de Hooke)'}</span><b>${strainText}</b><small>${lab.mode==='strain'?'εz hors du modèle plan':`variation de volume ΔV/V = ${f(d.volume,1)} µε`}</small></div>`);
      if(lab.layers.rosette&&!three())parts.push(`<div class="hud-line"><span>Rosette 0° / 45° / 90°</span><b>a = ${f(d.rosette[0],1)} · b = ${f(d.rosette[1],1)} · c = ${f(d.rosette[2],1)} µε</b><small>lecture des jauges virtuelles</small></div>`);
      $('#lab-hud').innerHTML=`<div class="eyebrow">TABLEAU DE BORD</div>${parts.join('')}`;
    }
    function renderResults(d){
      const e=d.eig.values,p=d.planar,u=d.unit;
      const cells=thermal()||(three()&&!strainMode())?[['σ1',e[0],u],['σ2',e[1],u],['σ3',e[2],u],['τmax absolu',(e[0]-e[2])/2,u],['σVM',d.vm,u],['Contrainte moyenne',d.mean,u]]
        :lab.mode==='strainThree'?[['ε1',e[0],u],['ε2',e[1],u],['ε3',e[2],u],['γmax 3D',e[0]-e[2],'µrad'],['Trace ε',e[0]+e[1]+e[2],u],['Rayon extérieur',(e[0]-e[2])/2,u]]
        :lab.mode==='strain'?[['εmax du plan',p.max,u],['εmin du plan',p.min,u],['γmax du plan',2*p.radius,'µrad'],['Centre',p.center,u],['Rayon = γmax/2',p.radius,u],['θp',p.angle,'°']]
        :[['σmax du plan',p.max,u],['σmin du plan',p.min,u],['τmax du plan',p.radius,u],['τmax absolu 3D',(e[0]-e[2])/2,u],['σVM',d.vm,u],['θp',p.angle,'°']];
      $('#lab-results').innerHTML=cells.map(([name,v,un])=>`<div class="value-cell"><small>${name}</small><b>${v===null?'Indéfini':f(v)}</b><span>${v===null?'toutes directions':un}</span></div>`).join('');
    }
    function renderObserve(d){
      const R=d.three?(d.eig.values[0]-d.eig.values[2])/2:d.planar.radius,F=d.facet;
      const insights=[];
      if(!thermal()&&R>1e-9&&(d.three?F.tau:Math.abs(F.ty))<=R*0.004)insights.push('Plus aucun cisaillement sur la face x′ : tu es sur une direction principale.');
      if(!d.three&&!d.strainInput&&d.planar.max*d.planar.min>0)insights.push('Les deux contraintes du plan ont le même signe : avec σz = 0, le cisaillement maximal absolu sort du plan.');
      if(lab.amp===1)insights.push('À l’échelle réelle, la déformée est invisible : c’est l’hypothèse des petites perturbations (HPP).');
      const base=thermal()?'Chaque direction bridée reçoit une compression qui annule sa dilatation ; les directions libres s’allongent davantage (effet Poisson). Bridée dans les trois directions, la matière est en état hydrostatique : von Mises reste nul.'
        :lab.mode==='strainThree'?'Les trois cercles utilisent les déformations principales ε1 ≥ ε2 ≥ ε3. Le cisaillement d’ingénieur maximal vaut ε1−ε3, soit deux fois le rayon extérieur. La trace donne la déformation volumique aux petites déformations.'
        :three()?'Les cercles utilisent les valeurs propres de la matrice complète, y compris τxz et τyz. Une facette quelconque donne un point dans la zone colorée ; sur un plan principal, le point rejoint un cercle.'
        :strainMode()?'Le point suit le tenseur ε, dont le terme hors diagonale est γ/2. Observe que γmax est le diamètre, tandis que le rayon donne le cisaillement tensoriel maximal.'
        :'À θp, le cisaillement s’annule. La trace σx′ + σy′ reste constante. Compare τmax du plan et τmax absolu : la valeur σz = 0 peut changer les extrêmes en 3D.';
      $('#lab-observe').innerHTML=`${insights.map(t=>`<b class="insight">${esc(t)}</b> `).join('')}${esc(base)}`;
    }
    function describe(d){
      const F=d.facet,u=d.unit,e=d.strain.map(r=>r.map(v=>v*1e6));
      const orient=thermal()?'Élément bridé, aligné sur x, y, z.':d.three?`Facette orientée par φ = ${f(lab.angle)}° et ψ = ${f(lab.elev)}°.`:`Élément tourné de θ = ${f(lab.angle)}°.`;
      const face=`Face x′ : ${d.symbol}n = ${f(F.sigma)} ${u}, ${d.three?`|τ| = ${f(F.tau)}`:`τ = ${f(F.ty)}`} ${u}.`;
      const shape=lab.amp===1?'Déformée à l’échelle réelle : invisible, comme le suppose l’HPP.':`Déformée amplifiée × ${f(lab.amp,0)} : εx = ${f(e[0][0],0)}, εy = ${f(e[1][1],0)}${lab.mode==='strain'?'':`, εz = ${f(e[2][2],0)}`} µε.`;
      $('#element-3d-desc').textContent=`${orient} ${face} ${shape}`;
    }
    function stars(n){return `${'★'.repeat(n)}${'☆'.repeat(3-n)}`;}
    function hubPage(target){
      main=target;story=null;cancelAnimationFrame(tween);scene?.destroy();scene=null;
      const p=h.storyProgress(),done=St.episodes.filter(e=>p.done[e.id]).length,starCount=Object.values(p.done).reduce((a,b)=>a+b,0);
      const next=St.episodes.findIndex((e,i)=>!p.done[e.id]&&St.unlocked(p,i));
      main.innerHTML=`<div class="story-hub"><div class="lab-intro"><div><div class="eyebrow"><span class="dot"></span> MODE HISTOIRE · LA PASSERELLE</div><h1>Une passerelle à souder.<br>Douze expériences à vivre.</h1><p>Otto, chef d’atelier à la Forge, te confie une passerelle piétonne en acier. À chaque étape du chantier, une notion de mécanique des milieux continus se découvre en manipulant la matière, sous l’hypothèse des petites perturbations.</p></div>${switchHTML('story')}</div>
        <div class="stats-strip"><div class="stat"><b>${done}<span> / 12</span></b><span>épisodes réussis</span></div><div class="stat"><b>${starCount}<span> / 36</span></b><span>étoiles</span></div><div class="journey-progress"><div class="caption"><span>${done===12?'Passerelle livrée !':next>=0?`Prochain : ${esc(St.episodes[next].title)}`:'Rejoue pour décrocher toutes les étoiles'}</span><span>${Math.round(done/12*100)} %</span></div><div class="progress-track" role="progressbar" aria-label="Épisodes réussis" aria-valuemin="0" aria-valuemax="12" aria-valuenow="${done}"><span style="width:${done/12*100}%"></span></div></div></div>
        ${St.acts.map(act=>`<section class="act" aria-labelledby="act-${act.n}"><div class="act-head"><span class="act-number">ACTE ${ROMAN[act.n-1]}</span><div><h2 id="act-${act.n}">${act.title}</h2><p>${act.subtitle}</p></div></div><div class="episode-grid">${St.episodes.map((e,i)=>({e,i})).filter(({e})=>e.act===act.n).map(({e,i})=>{
          const open=St.unlocked(p,i),won=p.done[e.id];
          return `<button type="button" class="episode-card${won?' done':''}${i===next?' current':''}" data-episode="${i}"${open?'':' disabled'}><span class="episode-top"><span class="episode-num">ÉPISODE ${String(i+1).padStart(2,'0')}</span><span class="episode-stars">${won?stars(won):''}</span></span><h3>${esc(e.title)}</h3><p>${esc(e.place)}</p><span class="episode-status">${won?'Réussi · rejouer':open?'À jouer · 3 min':'Verrouillé · épisode précédent'}</span></button>`;
        }).join('')}</div></section>`).join('')}
        <p class="compact story-note">Situations reconstruites avec des données pédagogiques ; paramètres normatifs imposés. Le mode histoire complète les ateliers de calcul, il ne remplace ni un cours ni un dimensionnement réglementaire.</p></div>`;
      $$('[data-episode]').forEach(b=>b.addEventListener('click',()=>h.navigate(`histoire/${Number(b.dataset.episode)+1}`)));
    }
    function episodePage(target,index){
      main=target;
      const ep=St.episodes[index],p=h.storyProgress();
      if(!ep){h.navigate('histoire');return;}
      if(!St.unlocked(p,index)){story=null;scene?.destroy();scene=null;main.innerHTML=`<section class="panel empty-state"><div class="big-icon" aria-hidden="true">◎</div><h1>Épisode verrouillé</h1><p>Réussis l’épisode précédent pour suivre le fil de la passerelle.</p><a class="btn" href="#histoire">Voir les épisodes ↗</a></section>`;return;}
      story={ep,index,runner:St.runner(ep),hint:false,completed:false,goal:-1};
      lab={...St.initialState(ep),layers:{...defaultLayers(ep.setup.mode),...ep.setup.layers}};trail=[];
      const act=St.acts[ep.act-1];
      const mission=`<section class="story-mission" aria-labelledby="episode-title">
          <div class="mission-head"><div class="eyebrow"><span class="dot"></span> ACTE ${ROMAN[ep.act-1]} · ÉPISODE ${index+1} / 12</div><h1 id="episode-title">${esc(ep.title)}</h1><p class="mission-place">${esc(ep.place)}</p></div>
          <div class="briefing"><div class="mentor" aria-hidden="true">O</div><div><div class="mentor-name">Otto · chef d’atelier</div>${ep.briefing.map(t=>`<p>${esc(t)}</p>`).join('')}</div></div>
          <div class="objectives"><h2>Objectifs</h2><ol class="goals">${ep.goals.map((g,i)=>`<li class="goal"><span class="goal-mark" aria-hidden="true">${i+1}</span><span class="goal-text">${esc(g.text)}</span><span class="goal-state sr-only"></span></li>`).join('')}</ol>
            <div id="quest-tracker" class="quest-tracker"><span id="quest-step" class="quest-step"></span><span id="quest-text" class="quest-text" aria-live="polite"></span><span class="quest-bar" aria-hidden="true"><i id="quest-fill"></i></span><span id="quest-feedback" class="quest-feedback" aria-live="polite"></span></div>
            <div class="mission-actions"><button type="button" class="btn secondary small" id="story-hint-button">Un indice</button><button type="button" class="btn secondary small" id="story-restart">Recommencer</button></div>
            <div id="story-hint" class="hint" hidden>${esc(ep.hint)}</div></div>
        </section>`;
      const instruments=`<div class="instruments" role="group" aria-label="Instruments de l’épisode">${ep.watch.map(([label],i)=>`<div class="instrument"><small>${esc(label)}</small><b id="watch-${i}">—</b>${ep.targets?`<span>cible ${f(ep.targets[i])} µε</span>`:''}</div>`).join('')}</div>`;
      main.innerHTML=`<div class="story-page"><a class="back" href="#histoire">← LES ÉPISODES · ${esc(act.title.toUpperCase())}</a>${labGrid({before:mission,top:`<section id="episode-success" class="episode-success" tabindex="-1" aria-labelledby="success-title" hidden></section>${instruments}`})}</div>`;
      $('#story-hint-button').addEventListener('click',()=>{story.hint=true;$('#story-hint').hidden=false;$('#story-hint').scrollIntoView({block:'nearest',behavior:'instant'});});
      $('#story-restart').addEventListener('click',()=>episodePage(main,index));
      mountLab();
    }
    function updateStory(){
      const r=story.runner.update(lab),ep=story.ep;
      $$('.goal').forEach((li,i)=>{li.classList.toggle('done',r.done[i]);li.classList.toggle('current',i===r.current);li.querySelector('.goal-state').textContent=r.done[i]?' : atteint':i===r.current?' : en cours':' : à venir';});
      ep.watch.forEach(([,fn,u],i)=>{const el=$(`#watch-${i}`);if(el){const v=fn(r.derived,lab);el.textContent=`${f(v,u===''?3:u==='°'?2:1)}${u?' '+u:''}`;}});
      if(story.goal!==r.current){
        const newly=story.goal>=0&&r.current!==story.goal;
        story.goal=r.current;
        $('#quest-step').textContent=r.complete?'✓':`Objectif ${r.current+1} / ${ep.goals.length}`;
        $('#quest-text').textContent=r.complete?'Épisode réussi ! Lis le débrief.':ep.goals[r.current].text;
        if(newly&&!r.complete)toast('Objectif atteint ✓');
      }
      $('#quest-fill').style.width=`${Math.round(r.progress*100)}%`;
      $('#quest-feedback').textContent=r.feedback;
      $('#quest-tracker').classList.toggle('complete',r.complete);
      if(r.complete&&!story.completed){story.completed=true;celebrate();}
    }
    function celebrate(){
      const ep=story.ep,won=story.hint?2:3,gained=h.completeEpisode(ep.id,won),next=St.episodes[story.index+1];
      const box=$('#episode-success'),sparks=Array.from({length:14},(_,i)=>`<i style="--a:${i*360/14}deg;--d:${i%3}"></i>`).join('');
      box.innerHTML=`<div class="success-burst" aria-hidden="true">${sparks}</div><div class="eyebrow">ÉPISODE ${story.index+1} RÉUSSI</div><h2 id="success-title">${won===3?'Du travail de compagnon !':'Bien joué !'} <span class="reward-stars">${stars(won)}</span></h2><p>${gained?`+${gained} XP · `:''}${won<3?'Un indice utilisé : 2 étoiles. Rejoue sans indice pour la troisième.':'Sans indice : score parfait.'}</p><div class="debrief"><h3>Ce qu’il faut retenir</h3>${ep.debrief}</div><div class="answer-actions">${next?`<button type="button" class="btn orange" id="next-episode">Épisode suivant : ${esc(next.title)} ↗</button>`:'<a class="btn orange" href="#histoire">Passerelle livrée : revoir les épisodes ↗</a>'}<a class="btn secondary" href="#atelier/${ep.chapter*3}">S’entraîner au calcul · atelier ${ep.chapter+1}</a><button type="button" class="btn secondary" id="keep-playing">Continuer à manipuler</button></div>`;
      box.hidden=false;
      toast(gained?`Épisode réussi ! +${gained} XP`:'Épisode rejoué : la notion se consolide.');
      $('#next-episode')?.addEventListener('click',()=>h.navigate(`histoire/${story.index+2}`));
      $('#keep-playing').addEventListener('click',()=>$('#element-3d').focus());
      box.focus({preventScroll:true});box.scrollIntoView({block:'start',behavior:reduced()?'instant':'smooth'});
    }
    return {
      sandbox:sandboxPage,hub:hubPage,episode:episodePage,
      redraw(){if(last&&$('#mohr-svg'))drawMohr(last);},
      leave(){cancelAnimationFrame(tween);scene?.destroy();scene=null;story=null;},
    };
  }
  root.LabUI={create};
})(globalThis);
