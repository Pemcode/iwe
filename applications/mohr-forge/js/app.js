/* Vanilla application; classic scripts keep direct file:// launch working. */
(()=>{
  'use strict';
  const C=Curriculum,G=Progression,St=Story,KEY='mohr-forge-v1',EXAMKEY='mohr-forge-exam-v1',STORYKEY='mohr-forge-story-v1';
  const $=s=>document.querySelector(s),main=$('main');
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const f=(v,d=2)=>Math.abs(v)<1e-8?'0':v.toLocaleString('fr-FR',{maximumFractionDigits:d}).replace('-', '−');
  function matrixHTML({symbol,rows,unit='',label:custom}){
    const label=custom||`Matrice ${symbol}, ${rows.length} lignes et ${rows[0].length} colonnes${unit?', en '+unit:''}`;
    return `<div class="matrix-equation"><span class="matrix-symbol" aria-hidden="true">${esc(symbol)} =</span><div class="matrix-brackets"><table class="matrix-table" aria-label="${esc(label)}"><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td${v==='?'?' class="matrix-unknown" aria-label="Composante inconnue"':''}>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${unit?`<span class="matrix-unit" aria-hidden="true">${esc(unit)}</span>`:''}</div>`;
  }
  function formattedText(item,key){
    const matrix=item[key+'Matrix'];
    if(!matrix)return esc(item[key]);
    return `${matrix.before?`<span class="matrix-prose">${esc(matrix.before)}</span>`:''}${matrixHTML(matrix)}${matrix.after?`<span class="matrix-prose">${esc(matrix.after)}</span>`:''}`;
  }
  function storageNotice(){const el=$('#storage-notice');el.hidden=false;el.textContent='Sauvegarde automatique indisponible dans ce navigateur. Exporte ta progression depuis le Carnet avant de fermer.';}
  function getStored(key){try{return localStorage.getItem(key);}catch{storageNotice();return null;}}
  function putStored(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{storageNotice();}}
  let progress=G.restore(getStored(KEY));
  const drafts=new Map();
  let examSession=restoreExam(getStored(EXAMKEY));
  let storyProgress=St.restore(getStored(STORYKEY));
  function restoreExam(raw){
    try{
      const x=JSON.parse(raw);
      if(!x||x.version!==1||!Number.isInteger(x.seed)||x.seed<0||x.seed>6||!Number.isInteger(x.index)||x.index<0||x.index>2||!Number.isFinite(x.started)||x.started<0||typeof x.submitted!=='boolean'||!Array.isArray(x.answers)||x.answers.length!==3)return null;
      if(x.answers.some(a=>!Array.isArray(a)||a.length>6||a.some(v=>typeof v!=='string'||v.length>150)))return null;
      return x;
    }catch{return null;}
  }
  const totalXp=()=>progress.xp+St.xp(storyProgress);
  function save(){putStored(KEY,progress);$('#xp').textContent=`${totalXp()} XP`;}
  let toastTimer;
  function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
  const completed=()=>Object.keys(progress.stars).length;
  const badgeEarned=i=>[0,1,2].every(j=>progress.stars[i*3+j]);
  const nextId=()=>Array.from({length:24},(_,i)=>i).find(i=>!progress.stars[i])??23;
  const rank=()=>completed()===24?'Compagnon de Mohr':completed()>=15?'Analyste en formation':completed()>=6?'Apprenti des tenseurs':'Explorateur de la matière';
  function navigate(route){if(location.hash===`#${route}`)render();else location.hash=route;}
  function focusPageHeading(){
    const heading=main.querySelector('h1');
    if(heading){
      heading.tabIndex=-1;
      document.title=`${heading.innerText.replace(/\s+/g,' ').trim()} — Mohr Forge`;
      heading.focus({preventScroll:true});
    }
    window.scrollTo({top:0,behavior:'instant'});
  }
  $('.skip').onclick=event=>{
    event.preventDefault();main.focus({preventScroll:true});
    main.scrollIntoView({block:'start',behavior:'instant'});
  };
  const Lab=LabUI.create({esc,f,matrixHTML,toast:text=>toast(text),navigate:route=>navigate(route),storyProgress:()=>storyProgress,
    completeEpisode(id,stars){const before=St.xp(storyProgress);if(St.complete(storyProgress,id,stars)){putStored(STORYKEY,storyProgress);save();}return St.xp(storyProgress)-before;}});
  function heroArt(){return `<div class="hero-art" aria-label="Illustration de trois cercles de Mohr et d’un élément de matière"><div class="art-label"><span>LA MATIÈRE CHANGE DE REPÈRE.</span><span>FIG. 01 / σ → ε</span></div><svg viewBox="0 0 470 280" role="img" aria-label="Tricercle de Mohr illustratif"><defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line y2="5" stroke="#71866a" stroke-width="1"/></pattern></defs><path d="M49 146H435M228 33V245" fill="none" stroke="#809076" stroke-width="1"/><path d="m427 142 8 4-8 4M224 41l4-8 4 8" fill="none" stroke="#809076"/><circle cx="242" cy="146" r="100" fill="none" stroke="#385942" stroke-width="1.7"/><circle cx="208" cy="146" r="66" fill="none" stroke="#859973" stroke-width="1.5"/><circle cx="308" cy="146" r="34" fill="none" stroke="#8e9d7d" stroke-width="1.5"/><path d="M242 146 312 76" stroke="#bb4023" stroke-width="1.5" stroke-dasharray="4 4"/><circle cx="312" cy="76" r="6" fill="#bb4023"/><path d="M272 146a30 30 0 0 0-9-21" stroke="#bb4023" fill="none"/><text x="278" y="122" font-size="12" fill="#bb4023" font-family="Georgia">2θ</text><g font-family="Georgia" font-size="17" fill="#405b42"><text x="348" y="167">σ₁</text><text x="273" y="167">σ₂</text><text x="123" y="168">σ₃</text><text x="234" y="35">τ</text><text x="433" y="165">σ</text></g><g transform="translate(79 60) rotate(-18)"><rect x="-22" y="-22" width="44" height="44" rx="2" fill="url(#hatch)" stroke="#3d5942" stroke-width="1.5"/><path d="M-36 0H36M0-36V36" stroke="#3d5942"/><path d="m32-4 4 4-4 4M-4-32l4-4 4 4" fill="none" stroke="#3d5942"/></g><text x="325" y="70" font-family="monospace" font-size="11" fill="#a33d25">(σn, τ)</text></svg><span class="art-note">Un état. Une infinité de points de vue.</span><span class="art-sigma">σ′ = Q σ Qᵀ</span></div>`;}
  function sketch(type='plate'){
    return `<div class="case-sketch"><svg viewBox="0 0 510 120" role="img" aria-label="${type==='weld'?'Schéma de principe d’un cordon d’angle, gorge a et normale n':'Schéma de principe d’une tôle soudée sollicitée en traction'}"><defs><pattern id="weld-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line y2="6" stroke="#9dab92"/></pattern></defs>${type==='weld'?'<path d="M100 91h295v14H100zM228 20h17v71h-17z" fill="#d3daca" stroke="#5c6d51"/><path d="M245 59v32h32z" fill="url(#weld-hatch)" stroke="#bb4023" stroke-width="2"/><path d="M246 89l15-15M260 75l33-33" stroke="#bb4023" stroke-width="1.5"/><path d="m284 43 9-1-1 9" fill="none" stroke="#bb4023"/><text x="303" y="43" fill="#bb4023" font-size="14">n</text><text x="252" y="105" fill="#bb4023" font-size="13">a</text><text x="110" y="36" fill="#65726b" font-size="11">COUPE DU CORDON</text><text x="322" y="76" fill="#65726b" font-size="11">gorge à 45°</text>':'<path d="M100 40h300v45H100z" fill="#dbe1d2" stroke="#607357"/><path d="M247 40v45M254 40v45" stroke="#bb4023" stroke-width="4"/><path d="M40 62h65m-57-6-8 6 8 6M395 62h70m-8-6 8 6-8 6" fill="none" stroke="#385942" stroke-width="2"/><text x="61" y="47" fill="#385942" font-size="13">N</text><text x="435" y="47" fill="#385942" font-size="13">N</text><text x="192" y="108" fill="#65726b" font-size="11">joint bout à bout</text><path d="M335 26h42m-6-4 6 4-6 4" fill="none" stroke="#65726b"/><text x="383" y="30" fill="#65726b" font-size="11">x</text>'}</svg></div>`;
  }
  function campaign(){
    const n=completed(),badges=C.chapters.filter((_,i)=>badgeEarned(i)).length;
    main.innerHTML=`<section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="dot"></span> TON PARCOURS DU / IWE</div><h1>La mécanique,<br>ça se <em>joue.</em></h1><p>Du premier tenseur au cordon soudé.<br>Manipule, relève les défis et fais parler<br class="desktop-break"> les cercles de Mohr.</p><div class="hero-actions"><button class="btn" id="continue">Continuer l’aventure <span aria-hidden="true">↗</span></button><a class="btn secondary" href="#histoire">Mode histoire</a><a class="btn secondary" href="#laboratoire">Explorer le labo</a></div></div>${heroArt()}</section><div class="stats-strip"><div class="stat"><b>${n}<span> / 24</span></b><span>défis maîtrisés</span></div><div class="stat"><b>${badges}<span> / 8</span></b><span>badges forgés</span></div><div class="journey-progress"><div class="caption"><span>${rank()}</span><span>${Math.round(n/24*100)} %</span></div><div class="progress-track" role="progressbar" aria-label="Parcours maîtrisé" aria-valuemin="0" aria-valuemax="24" aria-valuenow="${n}"><span style="width:${n/24*100}%"></span></div></div></div><div class="section-heading"><div><h2>À chaque atelier, un déclic.</h2><p>8 ateliers · des défis courts · le droit de se tromper</p></div><span>01 — 08 / PARCOURS PROGRESSIF</span></div><div class="dashboard-grid"><section class="mission-grid" aria-label="Les huit ateliers">${C.chapters.map((c,i)=>{const unlocked=G.unlocked(progress,i),done=badgeEarned(i);return `<button class="mission ${unlocked&&!done?'current':''}" data-chapter="${i}" ${unlocked?'':'disabled'}><div class="mission-top"><span class="mission-number">ATELIER ${String(i+1).padStart(2,'0')}</span><span class="mission-icon" aria-hidden="true">${c.icon}</span></div><h3>${c.title}</h3><p>${c.subtitle}</p><div class="mission-bottom"><span>${done?'✓ Maîtrisé':unlocked?`${c.time} · À toi de jouer`:'Verrouillé · atelier précédent'}</span><span class="mini-dots" aria-hidden="true">${[0,1,2].map(j=>`<i class="${progress.stars[i*3+j]?'done':''}"></i>`).join('')}</span></div></button>`;}).join('')}</section><aside class="dashboard-aside"><div class="side-card"><div class="eyebrow">TON PASSEPORT</div><div class="medal" aria-hidden="true">✧</div><h3>${rank()}</h3><p>Chaque notion maîtrisée laisse une trace. Forge tes huit badges et ouvre l’examen de synthèse.</p><div class="badge-list">${C.chapters.map((c,i)=>`<span class="badge-chip ${badgeEarned(i)?'earned':''}" title="${esc(c.badge)}" aria-label="${esc(c.badge)} : ${badgeEarned(i)?'obtenu':'à obtenir'}">${c.icon}</span>`).join('')}</div></div><div class="side-card story-card"><div class="eyebrow">MODE HISTOIRE · 12 ÉPISODES</div><h3>Une passerelle<br>à souder.</h3><p>Tire, tourne, bride et déforme la matière en 3D. Chaque épisode fait vivre une notion, de la facette au cordon d’angle.</p><a class="btn orange small" href="#histoire">${Object.keys(storyProgress.done).length?'Reprendre l’histoire ↗':'Commencer l’histoire ↗'}</a></div><div class="side-card light"><div class="eyebrow">LE DERNIER DÉFI</div><h3>Du savoir au<br>savoir-faire.</h3><p>Trois dossiers de soudage, une copie à rendre, un bilan pour progresser.</p><a class="btn secondary small" href="#examen">${n===24?'Passer l’examen blanc ↗':'Découvrir l’examen'}</a></div></aside></div>`;
    $('#continue').onclick=()=>navigate(n===24?'examen':`atelier/${nextId()}`);
    document.querySelectorAll('[data-chapter]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.chapter);navigate(`atelier/${[0,1,2].map(j=>i*3+j).find(j=>!progress.stars[j])??i*3}`);});
  }
  function fieldsHTML(q,values=[]){
    return `<div class="fields">${q.fields.map((v,i)=>`
      <label class="field ${v.options?'wide':''}">${esc(v.label)}
        ${v.options?`<select name="a${i}" required aria-describedby="answer-status-${i}">
          <option value="">Choisir une réponse</option>
          ${v.options.map(o=>`<option ${values[i]===o?'selected':''} value="${esc(o)}">${esc(o)}</option>`).join('')}
        </select>`:`<span class="input-wrap">
          <input name="a${i}" inputmode="decimal" type="text" maxlength="80" autocomplete="off" required
            value="${esc(values[i]??'')}" aria-describedby="answer-status-${i}"
            aria-label="${esc(v.label)}${v.unit?' ('+v.unit+')':''}">
          <span class="unit">${esc(v.unit)}</span>
        </span>`}
        <span id="answer-status-${i}" class="field-status"></span>
      </label>`).join('')}</div>`;
  }
  const formValues=form=>Array.from(form.querySelectorAll('[name]')).map(e=>e.value);
  function correctDetails(q){return `<div class="answer-detail">${q.fields.map(v=>`<div><b>${esc(v.label)}</b> : ${v.options?esc(v.answer):f(v.answer,3)} ${esc(v.unit)}</div>`).join('')}</div>`;}
  function locked(title,body){main.innerHTML=`<section class="panel empty-state"><div class="big-icon" aria-hidden="true">◎</div><h1>${title}</h1><p>${body}</p><button id="resume" class="btn">Reprendre le parcours ↗</button></section>`;$('#resume').onclick=()=>navigate(`atelier/${nextId()}`);}
  function task(id){
    if(!Number.isInteger(id)||id<0||id>=24){navigate('campagne');return;}
    const chapter=Math.floor(id/3),c=C.chapters[chapter];
    if(!G.unlocked(progress,chapter)){locked('Atelier verrouillé','Valide les trois défis de chaque atelier précédent pour avancer avec des bases solides.');return;}
    const q=C.exercise(id),d=drafts.get(id)??{values:[],tries:0,hint:false};drafts.set(id,d);
    const done=!!progress.stars[id];
    main.innerHTML=`<a class="back" href="#campagne">← LES ATELIERS</a><div class="page-heading"><div class="eyebrow">ATELIER ${String(chapter+1).padStart(2,'0')} / 08 · ${c.subtitle}</div><h1>${c.title}</h1></div><div class="task-stepper" aria-label="Défis de cet atelier">${[0,1,2].map(j=>`<button class="step ${id%3===j?'selected':''} ${progress.stars[chapter*3+j]?'solved':''}" data-step="${chapter*3+j}" ${id%3===j?'aria-current="step"':''}>${progress.stars[chapter*3+j]?'✓':'0'+(j+1)} · Défi ${j+1}</button>`).join('')}</div><div class="workbench"><section class="panel"><div class="eyebrow">MISSION ${id+1} / 24 <span>· ${done?'MAÎTRISÉE':'JUSQU’À 100 XP'}</span></div><h2 class="task-title">${q.title}</h2>${sketch(q.scene)}<div class="context">${formattedText(q,'context')}</div><form id="answer-form">${fieldsHTML(q,d.values)}<p class="input-help">Virgule ou point acceptés. Tolérance : 0,5 % (minimum 0,05 unité), 0,6° pour les angles ; rapports ±0,005.</p><div class="answer-actions"><button class="btn orange" type="submit">Vérifier ma réponse</button><button class="btn secondary" id="hint-button" type="button">Un indice</button></div></form><div id="hint" class="hint" ${d.hint?'':'hidden'}>${esc(q.hint)}</div><div id="feedback" aria-live="polite" tabindex="-1">${done?`<div class="feedback"><h3>Déjà maîtrisé <span class="reward-stars">${'★'.repeat(progress.stars[id])}</span></h3><p>Tu peux t’entraîner à nouveau. Les XP de ce défi ont déjà été attribués.</p><p>${esc(q.explanation)}</p>${correctDetails(q)}</div>`:''}</div><div id="next-wrap" class="answer-actions" ${done?'':'hidden'}><button class="btn" id="next-task">${G.examUnlocked(progress)?'Découvrir l’examen blanc':'Défi suivant'} ↗</button></div><div class="source-tag">${esc(q.reference)}</div></section><aside class="panel lesson"><div class="eyebrow">LA BOÎTE À OUTILS</div><h2>Comprendre avant de calculer.</h2>${c.lesson}<div class="formula">${formattedText(c,'formula')}</div>${(()=>{const i=St.episodes.findIndex(e=>e.chapter===chapter);return i>=0&&St.unlocked(storyProgress,i)?`<a class="btn secondary small" href="#histoire/${i+1}">Vivre l’épisode « ${esc(St.episodes[i].title)} » ↗</a> `:'';})()}<a class="btn secondary small" href="#laboratoire">Manipuler dans le laboratoire ↗</a><p class="compact" style="margin-top:16px">Les indices aident à apprendre : 3 étoiles au premier essai sans indice, 2 avec aide ou un nouvel essai, 1 au-delà. Aucun point retiré.</p></aside></div>`;
    document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>navigate(`atelier/${b.dataset.step}`));
    $('#answer-form').oninput=event=>{
      d.values=formValues($('#answer-form'));
      const i=Number(event.target.name.slice(1)),status=$(`#answer-status-${i}`);
      if(status){status.textContent='';status.className='field-status';event.target.removeAttribute('aria-invalid');}
    };
    $('#hint-button').onclick=()=>{d.hint=true;$('#hint').hidden=false;$('#hint').scrollIntoView({block:'nearest',behavior:'instant'});};
    $('#answer-form').onsubmit=event=>{
      event.preventDefault(); d.values=formValues(event.currentTarget);
      const results=C.grade(q,d.values);d.tries++;
      results.forEach((ok,i)=>{
        event.currentTarget.elements[`a${i}`].setAttribute('aria-invalid',String(!ok));
        const status=$(`#answer-status-${i}`);status.textContent=ok?'✓ Correct':'À revoir';
        status.className=`field-status ${ok?'correct':'incorrect'}`;
      });
      if(results.every(Boolean)){
        const stars=d.tries===1&&!d.hint?3:d.tries<=2?2:1,before=progress.xp,earned=G.complete(progress,id,stars);save();
        $('#feedback').innerHTML=`<div class="feedback"><h3>${earned?'Défi validé !':'Bien joué, notion consolidée.'} <span class="reward-stars">${'★'.repeat(progress.stars[id])}</span></h3><p>${earned?`+${progress.xp-before} XP · `:''}${esc(q.explanation)}</p>${correctDetails(q)}${earned&&badgeEarned(chapter)?`<p class="badge-name">✧ Badge forgé : ${c.badge}</p>`:''}</div>`;
        $('#next-wrap').hidden=false;$('#next-task').textContent=G.examUnlocked(progress)?'Découvrir l’examen blanc ↗':'Défi suivant ↗';
        if(earned)toast(badgeEarned(chapter)?`✧ ${c.badge} — badge obtenu !`:`+${progress.xp-before} XP · La notion prend forme.`);
      }else{
        $('#feedback').innerHTML=`<div class="feedback wrong"><h3>À retravailler, tu y es presque.</h3><p>${results.filter(Boolean).length} / ${results.length} réponse(s) juste(s). ${results.map((ok,i)=>ok?'':esc(q.fields[i].label)).filter(Boolean).join(' · ')} : vérifie le signe, l’unité et la formule.</p><p>Les champs à reprendre sont signalés. Tu peux demander un indice et réessayer.</p><button type="button" class="btn secondary small" id="correct-answers">Corriger mes réponses</button></div>`;
      }
      if($('#correct-answers'))$('#correct-answers').onclick=()=>{
        const first=$('#answer-form [aria-invalid=true]');
        if(first){first.focus({preventScroll:true});first.scrollIntoView({block:'center',behavior:'instant'});}
      };
      $('#feedback').focus({preventScroll:true});
      $('#feedback').scrollIntoView({block:'nearest',behavior:'instant'});
    };
    $('#next-task').onclick=()=>navigate(G.examUnlocked(progress)?'examen':`atelier/${nextId()}`);
  }
  function examPage(){
    if(!G.examUnlocked(progress)){
      main.innerHTML=`<div class="page-heading"><div class="eyebrow">LE DERNIER DÉFI</div><h1>À toi de signer<br>la note de calcul.</h1><p>Un examen blanc de synthèse pour mettre les acquis à l’épreuve.</p></div><div class="exam-intro"><section class="panel"><h2>Trois dossiers. Une vue d’ensemble.</h2><p>Une zone soudée bridée, une rosette sur tôle et un cordon d’angle. Des questions à étapes, une calculatrice et ton raisonnement.</p><div class="exam-rules"><div><b>50 min</b>temps conseillé</div><div><b>18</b>réponses notées</div><div><b>80 %</b>objectif de maîtrise</div></div><div class="feedback"><b>Encore ${24-completed()} défi(s) à maîtriser.</b><p>L’examen se débloque lorsque les huit ateliers sont terminés. Chaque bonne réponse compte, même si une autre étape est incorrecte.</p></div><button id="resume" class="btn" style="margin-top:20px">Reprendre le parcours ↗</button></section><aside class="side-card"><div class="eyebrow">OBJECTIF AUTONOMIE</div><h3>Poser. Calculer.<br>Interpréter.</h3><p>Un entraînement de niveau ingénieur soudeur, créé pour ce jeu. Ce n’est pas un sujet officiel ni une certification IWE.</p></aside></div>`;
      $('#resume').onclick=()=>navigate(`atelier/${nextId()}`);return;
    }
    if(examSession){if(examSession.submitted)examResult();else examQuestion();return;}
    main.innerHTML=`<section class="panel empty-state"><div class="eyebrow">PARCOURS TERMINÉ · EXAMEN DÉBLOQUÉ</div><div class="big-icon" aria-hidden="true">✧</div><h1>L’atelier est à toi.</h1><p>Résous trois dossiers avec une calculatrice. Les formules utiles ont été étudiées dans le parcours. Les paramètres normatifs nécessaires sont donnés.</p><div class="exam-rules"><div><b>50 min</b>conseillées, sans coupure</div><div><b>18 points</b>crédit partiel par réponse</div><div><b>80 %</b>objectif pédagogique</div></div><p class="compact">La copie se sauvegarde sur cet appareil. Les corrigés apparaissent après remise. Les arrondis acceptés sont les mêmes que dans les ateliers.</p><button class="btn orange" id="start-exam">Commencer l’examen blanc</button></section>`;
    $('#start-exam').onclick=()=>{examSession={version:1,seed:progress.examAttempts%7,index:0,started:Date.now(),submitted:false,answers:[[],[],[]]};putStored(EXAMKEY,examSession);examQuestion();};
  }
  function examQuestion(){
    const idx=examSession.index,q=C.exam(examSession.seed)[idx];
    main.innerHTML=`<div class="exam-form"><div class="exam-bar"><span>EXAMEN BLANC · DOSSIER ${idx+1} / 3 · VARIANTE ${examSession.seed+1}</span><span id="exam-clock"></span></div><section class="panel"><div class="eyebrow">CALCULATRICE AUTORISÉE · 6 POINTS</div><h1 class="task-title">${q.title}</h1>${sketch(q.scene)}<div class="context">${formattedText(q,'context')}</div><form id="exam-form" novalidate>${fieldsHTML(q,examSession.answers[idx])}<p class="input-help">0,5 % ou 0,05 unité minimum ; rapports ±0,005. Une réponse vide ne rapporte aucun point. Le temps est indicatif et n’interrompt pas la copie.</p><div class="answer-actions">${idx>0?'<button class="btn secondary" type="button" id="previous-case">Dossier précédent</button>':''}<button class="btn orange" type="submit">${idx<2?'Dossier suivant':'Rendre ma copie'}</button></div></form><div class="source-tag">${esc(q.reference)}</div></section><p class="compact" style="margin-top:15px">La copie est sauvegardée automatiquement. Tu peux quitter cette page et reprendre plus tard.</p></div>`;
    const storeAnswers=()=>{examSession.answers[idx]=formValues($('#exam-form'));putStored(EXAMKEY,examSession);};
    $('#exam-form').oninput=storeAnswers;$('#exam-form').onchange=storeAnswers;
    $('#exam-form').onsubmit=event=>{event.preventDefault();storeAnswers();if(idx<2){examSession.index++;putStored(EXAMKEY,examSession);examQuestion();window.scrollTo(0,0);}else{
      examSession.submitted=true;examSession.finished=Date.now();progress.examAttempts++;progress.examBest=Math.max(progress.examBest,examScore().percentage);save();putStored(EXAMKEY,examSession);examResult();window.scrollTo(0,0);
    }};
    if(idx>0)$('#previous-case').onclick=()=>{storeAnswers();examSession.index--;putStored(EXAMKEY,examSession);examQuestion();};updateTimer();focusPageHeading();
  }
  function updateTimer(){if($('#exam-clock')&&examSession){const mins=Math.floor(Math.max(0,Date.now()-examSession.started)/60000);$('#exam-clock').textContent=`${mins} min / 50 conseillées`;}}
  setInterval(updateTimer,15000);
  function examScore(){const qs=C.exam(examSession.seed),grades=qs.map((q,i)=>C.grade(q,examSession.answers[i])),points=grades.flat().filter(Boolean).length;return {qs,grades,points,percentage:Math.round(points/18*100)};}
  function examResult(){
    const {qs,grades,points,percentage}=examScore(),passed=percentage>=80;
    main.innerHTML=`<div class="exam-result" id="exam-result"><section class="panel"><div class="eyebrow">EXAMEN BLANC · COPIE CORRIGÉE · VARIANTE ${examSession.seed+1}</div><div class="score">${percentage}<small> / 100</small></div><h1 style="font-size:31px;margin-top:15px">${passed?'La synthèse prend forme.':'Les prochains déclics sont ici.'}</h1><p>${points} / 18 réponses justes. ${passed?'Objectif pédagogique atteint : badge « Synthèse soudage » obtenu.':'Reprends les ateliers signalés, puis tente une autre variante.'} Meilleur résultat : ${progress.examBest} %.</p>${qs.map((q,i)=>`<div class="result-row"><span>${q.title}</span><b>${grades[i].filter(Boolean).length} / 6</b><a href="#atelier/${q.chapter*3}">Revoir l’atelier ↗</a></div>`).join('')}<div class="answer-actions"><button class="btn orange" id="new-exam">Nouvelle variante</button><button class="btn secondary" id="print-result">Imprimer le bilan</button><button class="btn secondary" id="download-result">Exporter le bilan</button></div><p class="compact" style="margin-top:15px">Ce bilan atteste de ta progression dans le jeu ; il ne constitue pas une qualification professionnelle.</p></section>${qs.map((q,i)=>`<section class="panel"><h2>${q.title}</h2><div class="compact">${formattedText(q,'context')}</div><div class="table-wrap"><table class="review-table"><thead><tr><th>Étape</th><th>Ta réponse</th><th>Attendu</th><th>Point</th></tr></thead><tbody>${q.fields.map((v,j)=>`<tr><td>${esc(v.label)}</td><td>${esc(examSession.answers[i][j]||'—')}</td><td>${v.options?esc(v.answer):f(v.answer,3)} ${esc(v.unit)}</td><td class="${grades[i][j]?'yes':'no'}">${grades[i][j]?'1 / 1':'0 / 1'}</td></tr>`).join('')}</tbody></table></div><p class="context" style="margin-top:18px">${esc(q.explanation)}</p><p class="source-tag">${q.reference}</p></section>`).join('')}</div>`;
    focusPageHeading();
    $('#new-exam').onclick=()=>{examSession=null;putStored(EXAMKEY,null);examPage();};
    $('#print-result').onclick=()=>window.print();
    $('#download-result').onclick=()=>download('mohr-forge-bilan.txt',`MOHR FORGE — Bilan pédagogique\nScore : ${points}/18 (${percentage} %)\nVariante ${examSession.seed+1}\n\n`+qs.map((q,i)=>`${q.title}\n${q.context}\n`+q.fields.map((v,j)=>`${v.label} : ${examSession.answers[i][j]||'—'} ; attendu : ${v.options?v.answer:f(v.answer,3)} ${v.unit} ; ${grades[i][j]?1:0}/1`).join('\n')+`\n${q.explanation}`).join('\n\n'),'text/plain');
  }
  function download(name,text,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type:`${type};charset=utf-8`})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  function notebook(){
    main.innerHTML=`<div class="page-heading"><div class="eyebrow">TON CARNET D’ATELIER</div><h1>Les bons réflexes<br>restent avec toi.</h1><p>Conventions, formules, références et badges : tout ce qu’il faut pour revenir sur une notion.</p></div><div class="notebook"><section><div class="panel"><h2>Une convention, du début à la fin.</h2><table class="reference-table"><tbody><tr><th>Grandeur</th><th>Convention du jeu</th></tr><tr><td>Contrainte</td><td>MPa = N/mm² · traction + · compression −</td></tr><tr><td>σij</td><td>Force suivant i, face de normale j ; t = σn</td></tr><tr><td>Rotation</td><td>Normale x′ tournée de +θ antihoraire depuis x</td></tr><tr><td>Cercle</td><td>τ vers le haut · rotation du point de −2θ</td></tr><tr><td>Facette 3D</td><td>n = (cos ψ cos φ, cos ψ sin φ, sin ψ) ; on reporte |τ| vers le haut, entre les trois cercles</td></tr><tr><td>Déformée 3D</td><td>Amplifiée pour être visible, facteur affiché ; à l’échelle réelle, invisible (HPP)</td></tr><tr><td>Déformation</td><td>εxy = γxy/2 ; 1 µε = 10⁻⁶</td></tr><tr><td>Principales 3D</td><td>σ1 ≥ σ2 ≥ σ3 ; inclure 0 en contraintes planes</td></tr><tr><td>Modèle élastique</td><td>Isotrope, petites déformations ; E = 210 GPa, ν = 0,30 si indiqué</td></tr></tbody></table>${C.chapters.map(c=>`<details class="lesson" style="margin-top:16px"><summary>${c.title} · aide-mémoire</summary>${c.lesson}<div class="formula">${formattedText(c,'formula')}</div></details>`).join('')}</div><div class="panel"><h2>Références & périmètre</h2><p class="compact">Vérification des notices publiques : 30 septembre 2026. Les cas industriels sont reconstruits avec des données pédagogiques ; ils ne proviennent pas de mesures de chantier. Les calculs ne valent que pour les hypothèses données.</p><ol class="reference-list"><li><a href="https://www.boutique.afnor.org/fr-fr/norme/nf-en-199318/eurocode-3-calcul-des-structures-en-acier-partie-18-calcul-des-assemblages/fa114133/26358" target="_blank" rel="noopener">NF EN 1993-1-8, décembre 2005</a><small>Notice AFNOR indiquée en vigueur ; EN 1993-1-8:2005. Méthode directionnelle des soudures d’angle, §4.5.3.2.</small></li><li><a href="https://www.boutique.afnor.org/fr-fr/norme/nf-en-199318-na/eurocode-3-calcul-des-structures-en-acier-partie-18-calcul-des-assemblages-/fa149363/29575" target="_blank" rel="noopener">Annexe nationale française, juillet 2007</a><small>NF EN 1993-1-8/NA. Les paramètres de chaque exercice sont imposés explicitement.</small></li><li><a href="https://eurocodes.jrc.ec.europa.eu/sites/default/files/2022-06/06_Eurocodes_Steel_Workshop_WALD.pdf" target="_blank" rel="noopener">JRC · Bolts, welds, column base — F. Wald, 2014</a><small>Support public de formation sur les assemblages. Les exercices de ce jeu sont originaux.</small></li><li><a href="https://www.iso.org/standard/80209.html" target="_blank" rel="noopener">ISO 5817:2023</a><small>Niveaux d’imperfections des assemblages soudés par fusion : B, C, D. Le niveau de qualité ne remplace pas une vérification de résistance.</small></li><li><a href="https://www.boutique.afnor.org/fr-fr/norme/nf-en-10902-a1/execution-des-structures-en-acier-et-des-structures-en-aluminium-partie-2-e/fa209783/421615" target="_blank" rel="noopener">NF EN 1090-2+A1, mai 2024</a><small>Exécution des structures en acier. Les tableaux d’acceptation ne sont pas reproduits.</small></li><li><a href="https://eurocodes.jrc.ec.europa.eu/EN-Eurocodes/eurocode-3-design-steel-structures" target="_blank" rel="noopener">Eurocode 3 · EN 1993-1-9, fatigue</a><small>Le jeu apprend à calculer une étendue de contrainte et identifier les données manquantes ; il ne réalise pas un dimensionnement complet en fatigue.</small></li><li><a href="https://eurocodes.jrc.ec.europa.eu/sites/default/files/2025-08/20250603_2G_Eurocode3_JRC%2BWorkshop_final_website_0.pdf" target="_blank" rel="noopener">JRC · Eurocode 3 de deuxième génération, 2025</a><small>EN 1993-1-8:2024 est publiée au niveau européen. La transition nationale est en cours : vérifier édition, annexe nationale et pièces du marché pour un projet réel. Le jeu ne mélange pas ses règles avec celles de 2005.</small></li><li><a href="https://ocw.mit.edu/courses/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/pages/materials-structures/" target="_blank" rel="noopener">MIT OpenCourseWare · Materials / Structures</a><small>Transformations des contraintes et déformations, cercles de Mohr (M12 et M15). Comparer les conventions de signe avant d’utiliser un autre support.</small></li></ol><p class="compact">Ce jeu prépare à des calculs de niveau DU/IWE. Il ne reproduit aucun examen officiel et ne délivre aucune certification. Les textes normatifs complets et l’étude de l’assemblage restent nécessaires pour un dimensionnement professionnel.</p></div></section><aside><div class="panel"><div class="eyebrow">${totalXp()} XP · ${completed()}/24 DÉFIS · ${Object.keys(storyProgress.done).length}/12 ÉPISODES</div><h2>Les badges forgés</h2><div class="trophy-grid">${C.chapters.map((c,i)=>`<div class="trophy ${badgeEarned(i)?'earned':''}"><span aria-hidden="true">${c.icon}</span>${c.badge}<br><small>${badgeEarned(i)?'✓ Obtenu':'3 défis à maîtriser'}</small></div>`).join('')}<div class="trophy ${progress.examBest>=80?'earned':''}"><span aria-hidden="true">✧</span>Synthèse soudage<br><small>${progress.examBest>=80?'✓ Obtenu':'Examen ≥ 80 %'}</small></div></div><p class="compact" style="margin-top:17px">Un défi rapporte 100, 85 ou 70 XP selon l’aide et les essais. Un épisode du mode histoire rapporte 80 XP sans indice, 65 avec. Rejouer consolide les connaissances sans multiplier les points : seul le meilleur résultat compte.</p></div><div class="panel"><h2>Ta progression t’appartient.</h2><p class="compact">Sauvegarde sur cet appareil, sans compte. L’ouverture directe d’un fichier et une adresse web peuvent avoir des sauvegardes distinctes : utilise l’export pour transférer ton parcours.</p><div class="save-actions"><button class="btn small" id="export-progress">Exporter la progression</button><button class="btn secondary small" id="import-button">Importer</button><input type="file" accept="application/json,.json" id="import-progress" aria-label="Fichier de progression à importer"></div><div id="import-message" role="status" class="compact" style="margin-top:12px"></div><button class="text-link" id="reset-progress">Recommencer à zéro</button></div></aside></div>`;
    $('#export-progress').onclick=()=>download('mohr-forge-progression.json',JSON.stringify({...progress,story:storyProgress},null,2));
    $('#import-button').onclick=()=>$('#import-progress').click();
    $('#import-progress').onchange=async event=>{
      const file=event.target.files[0];if(!file)return;
      try{
        if(file.size>100000)throw new Error('Fichier trop volumineux.');const raw=await file.text(),x=JSON.parse(raw);
        if(!x||x.version!==1||!x.stars||typeof x.stars!=='object'||Array.isArray(x.stars)||Object.keys(x.stars).some(k=>!/^\d+$/.test(k)||Number(k)>23||![1,2,3].includes(x.stars[k])))throw new Error('Format de progression non reconnu.');
        if(!confirm('Remplacer la progression actuelle par celle de ce fichier ?'))return;
        progress=G.restore(raw);if(x.story)storyProgress=St.restore(JSON.stringify(x.story));putStored(STORYKEY,storyProgress);examSession=null;drafts.clear();save();putStored(EXAMKEY,null);notebook();toast('Progression importée.');
      }catch(e){$('#import-message').textContent=e instanceof SyntaxError?'Le fichier JSON est invalide.':e.message;}
    };
    $('#reset-progress').onclick=()=>{if(confirm('Effacer les badges, les XP et la copie d’examen sur cet appareil ? Pense à exporter ta progression.')){progress=G.fresh();storyProgress=St.fresh();putStored(STORYKEY,storyProgress);drafts.clear();examSession=null;save();putStored(EXAMKEY,null);notebook();toast('Un nouvel atelier commence.');}};
  }
  function render(){
    const route=location.hash.slice(1)||'campagne';
    document.querySelectorAll('.topbar nav a').forEach(a=>{const active=a.hash===`#${route}`||(route.startsWith('atelier/')&&a.hash==='#campagne')||(route.startsWith('histoire/')&&a.hash==='#histoire');a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    $('#xp').textContent=`${totalXp()} XP`;
    if(route!=='laboratoire'&&!route.startsWith('histoire'))Lab.leave();
    if(route==='laboratoire')Lab.sandbox(main);else if(route==='histoire')Lab.hub(main);else if(route.startsWith('histoire/'))Lab.episode(main,Number(route.split('/')[1])-1);else if(route==='examen')examPage();else if(route==='carnet')notebook();else if(route.startsWith('atelier/'))task(Number(route.split('/')[1]));else campaign();
    focusPageHeading();
  }
  window.addEventListener('resize',()=>Lab.redraw());
  window.addEventListener('hashchange',render);render();
})();
