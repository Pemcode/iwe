/* Story mode: episodes checked on the laboratory model. Data values are pedagogical and imposed. */
(function(root,factory){const api=factory(typeof module==='object'?require('./labmodel.js'):root.LabModel);if(typeof module==='object')module.exports=api;else root.Story=api;})(globalThis,function(L){
  'use strict';
  const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
  const near=(v,target,tol)=>Math.abs(v-target)<=tol;
  const onCircle=(d,c,r)=>Math.abs(Math.hypot(d.mohr.x-c,d.mohr.y)-r)<=1.5;
  const maxRatio=d=>Math.max(d.weld.ratioCombined,d.weld.ratioNormal);
  const acts=[
    {n:1,title:'La matière sous tension',subtitle:'Vecteur contrainte, facettes et cercle de Mohr'},
    {n:2,title:'La matière se déforme',subtitle:'ε, γ/2, HPP, Hooke et dilatation empêchée'},
    {n:3,title:'L’espace et le cordon',subtitle:'Tricercle, critères et Eurocode 3'},
  ];
  const episodes=[
    {id:'traction',act:1,chapter:0,title:'L’éprouvette de qualification',place:'Laboratoire d’essais · QMOS',
      briefing:['Bienvenue à la Forge ! On attaque une passerelle piétonne en acier. Avant de souder, on qualifie le mode opératoire : une éprouvette est prélevée en travers du joint, puis tirée.','Tire progressivement et regarde la matière réagir. Ici, pas de rupture : on reste élastique.'],
      setup:{mode:'stress',state:{x:0,y:0,xy:0},ranges:{x:[0,300]},layers:{arrows:true,deformed:true,ghost:true,values:true,vector:false}},
      controls:['x','amp'],
      watch:[['σx',d=>d.input[0][0],'MPa'],['εx',d=>d.strain[0][0]*1e6,'µε'],['εy',d=>d.strain[1][1]*1e6,'µε'],['εz',d=>d.strain[2][2]*1e6,'µε']],
      goals:[
        {text:'Charge l’éprouvette jusqu’à σx = 200 MPa.',check:d=>near(d.input[0][0],200,3),progress:d=>d.input[0][0]/200},
        {text:'Trouve la contrainte qui allonge la matière de 1 ‰ : εx = 1 000 µε.',check:d=>near(d.strain[0][0]*1e6,1000,12),progress:d=>1-Math.abs(d.strain[0][0]*1e6-1000)/1000},
        {text:'Affiche la déformée à l’échelle réelle.',check:(d,s)=>s.amp===1,progress:()=>0},
      ],
      solution:[[{x:200}],[{x:210}],[{amp:1}]],
      hint:'ε = σ/E avec E = 210 000 MPa : lis εx dans les instruments pendant que tu tires. Le bouton « Échelle réelle » est sous la vue 3D.',
      debrief:'<p>Loi de Hooke : <b>σ = E·ε</b>. Pour l’acier, 1 ‰ d’allongement demande 210 MPa. La section se rétrécit : <b>εy = εz = −ν·εx</b> = −300 µε avec ν = 0,30 (effet Poisson).</p><p>À l’échelle réelle, rien ne se voit : c’est le cadre des <b>petites perturbations (HPP)</b>. Déplacements et déformations sont assez petits pour écrire l’équilibre sur la forme initiale et négliger les produits de petites quantités. Le laboratoire amplifie la déformée pour la rendre visible.</p>'},
    {id:'facette',act:1,chapter:1,title:'La coupe inclinée',place:'Laboratoire d’essais · même éprouvette',
      briefing:['Sur une éprouvette d’acier doux, les bandes de glissement apparaissent en biais. Pourquoi pas perpendiculairement à l’effort ?','Coupe la matière avec une facette de normale n. Le vecteur contrainte T = σ·n se décompose en une partie normale et un cisaillement τ.'],
      setup:{mode:'stress',state:{x:200,y:0,xy:0},layers:{arrows:true,deformed:false,vector:true,values:true}},
      controls:['angle'],
      watch:[['θ',(d,s)=>s.angle,'°'],['σn',d=>d.facet.sigma,'MPa'],['τx′y′',d=>d.facet.ty,'MPa'],['|T|',d=>Math.hypot(d.facet.sigma,d.facet.ty),'MPa']],
      goals:[
        {text:'Tourne la facette jusqu’au cisaillement maximal.',check:d=>Math.abs(d.facet.ty)>=99,progress:d=>Math.abs(d.facet.ty)/100},
        {text:'Trouve une facette que l’effort ne traverse pas : T = 0.',check:d=>Math.hypot(d.facet.sigma,d.facet.ty)<=2,progress:d=>1-Math.hypot(d.facet.sigma,d.facet.ty)/200},
      ],
      solution:[[{angle:45}],[{angle:90}]],
      hint:'τx′y′ = −σx sin θ cos θ : cherche où sin 2θ vaut ±1. Pour T = 0, la normale doit être perpendiculaire à l’effort.',
      debrief:'<p><b>T = σ·n</b>. En traction simple, σn = σx cos²θ et τx′y′ = −σx sin θ cos θ. |τ| culmine à <b>σx/2 à ±45°</b> : c’est sur ces facettes que les plans cristallins glissent, d’où les bandes de glissement inclinées.</p><p>À 90°, la facette est parallèle à l’effort : aucune contrainte ne la traverse.</p>'},
    {id:'cercle',act:1,chapter:2,title:'Le cercle apparaît',place:'Bureau d’études · gousset soudé',
      briefing:['Au pied d’un gousset soudé, le calcul donne σx = 120, σy = 40 et τxy = 30 MPa.','Fais tourner la facette d’un bout à l’autre et regarde le point P du plan de Mohr : il dessine… un cercle.'],
      setup:{mode:'stress',state:{x:120,y:40,xy:30},layers:{arrows:true,deformed:false,vector:true,values:true,trail:true}},
      controls:['angle'],
      watch:[['θ',(d,s)=>s.angle,'°'],['σn',d=>d.facet.sigma,'MPa'],['τx′y′',d=>d.facet.ty,'MPa'],['Rayon R',d=>d.planar.radius,'MPa']],
      goals:[
        {text:'Balaye θ de −90° à +90° : P trace tout le cercle.',track:(d,s,m)=>{m.bins=m.bins||new Set();m.bins.add(Math.min(11,Math.max(0,Math.floor((s.angle+90)/15))));},check:(d,s,m)=>m.bins.size>=10,progress:(d,s,m)=>m.bins.size/10},
        {text:'Amène P au sommet du cercle : τx′y′ = +R.',check:d=>d.facet.ty>=0.99*d.planar.radius,progress:d=>d.facet.ty/d.planar.radius},
      ],
      solution:[Array.from({length:13},(_,i)=>({angle:-90+15*i})),[{angle:-26.57}]],
      hint:'Fais glisser θ d’une extrémité à l’autre. Le sommet est à la verticale du centre du cercle.',
      debrief:'<p>Centre <b>C = (σx + σy)/2 = 80 MPa</b>, rayon <b>R = √[((σx − σy)/2)² + τxy²] = 50 MPa</b>.</p><p>Quand la facette tourne de θ, le point tourne de <b>2θ en sens inverse</b> : un demi-tour de facette fait un tour complet de cercle. Le sommet donne le cisaillement maximal du plan, τ = R.</p>'},
    {id:'principales',act:1,chapter:2,title:'Chasser le cisaillement',place:'Bureau d’études · gousset soudé',
      briefing:['Le bureau d’études veut la direction où le gousset est le plus tendu : une fissure perpendiculaire à cette direction serait la plus ouverte.','Tourne l’élément jusqu’à faire disparaître les flèches de cisaillement.'],
      setup:{mode:'stress',state:{x:120,y:40,xy:30},layers:{arrows:true,deformed:true,ghost:true,values:true}},
      controls:['angle'],
      watch:[['θ',(d,s)=>s.angle,'°'],['σn',d=>d.facet.sigma,'MPa'],['τx′y′',d=>d.facet.ty,'MPa'],['γx′y′',d=>d.gamma,'µrad']],
      goals:[
        {text:'Annule le cisaillement sur une face x′ la plus tendue possible.',check:d=>Math.abs(d.facet.ty)<=1.2&&d.facet.sigma>=d.planar.max-1,progress:d=>(1-Math.abs(d.facet.ty)/d.planar.radius)*(d.facet.sigma>=d.planar.center?1:.5)},
        {text:'Trouve maintenant la direction de la plus petite contrainte principale.',check:d=>Math.abs(d.facet.ty)<=1.2&&d.facet.sigma<=d.planar.min+1,progress:d=>(1-Math.abs(d.facet.ty)/d.planar.radius)*(d.facet.sigma<=d.planar.center?1:.5)},
      ],
      solution:[[{angle:18.43}],[{angle:-71.57}]],
      hint:'Surveille τx′y′ : il change de signe vers 18°. La saisie de l’angle accepte les décimales.',
      debrief:'<p><b>tan 2θp = 2τxy/(σx − σy)</b> : θp = 18,4°. σ1 = C + R = 130 MPa et σ2 = C − R = 30 MPa, sur deux directions perpendiculaires.</p><p>Matériau isotrope : les directions principales des déformations sont les mêmes. L’élément tourné s’allonge sans perdre ses angles droits (γx′y′ = 0).</p>'},
    {id:'glissement',act:2,chapter:3,title:'Le piège du facteur 2',place:'Atelier · raidisseur cisaillé',
      briefing:['Un carré de 10 mm glisse : son bord supérieur se décale de 0,01 mm vers la droite, le bord inférieur ne bouge pas. C’est un glissement simple, γ = 0,01/10 = 1 000 µrad.','Reproduis-le avec le tenseur ε… et une rotation de corps rigide ω.'],
      setup:{mode:'strain',state:{x:0,y:0,xy:0,omega:0},amp:150,ranges:{xy:[-1500,1500],omega:[-1500,1500]},view:{yaw:0,pitch:0},layers:{deformed:true,ghost:true}},
      controls:['xy','omega'],
      watch:[['εxy',d=>d.input[0][1],'µε'],['γxy = 2εxy',d=>2*d.input[0][1],'µrad'],['ω',(d,s)=>s.omega,'µrad']],
      goals:[
        {text:'Ferme l’angle droit de γ = 1 000 µrad.',check:d=>near(2*d.input[0][1],1000,20),progress:d=>1-Math.abs(2*d.input[0][1]-1000)/1000,
          trap:d=>near(d.input[0][1],1000,40)?'Piège : εxy vaut γ/2, la moitié du glissement. Ici l’angle se ferme de 2 000 µrad.':''},
        {text:'Immobilise le bord inférieur : ajoute la rotation ω qui le remet à l’horizontale.',check:d=>Math.abs(d.grad[1][0]*1e6)<=10&&near(d.grad[0][1]*1e6,1000,25),progress:d=>1-Math.abs(d.grad[1][0]*1e6)/500},
      ],
      solution:[[{xy:500}],[{omega:-500}]],
      hint:'γ est l’angle total perdu par le coin ; le tenseur n’en porte que la moitié. Pour le bord inférieur, tourne l’élément dans le sens horaire.',
      debrief:'<p><b>γxy = 2εxy</b> : le tenseur ne garde que la moitié du glissement, répartie sur les deux bords. Le glissement simple = <b>cisaillement pur + rotation</b> de corps rigide ω = −γ/2, qui ne déforme rien.</p><p>grad u = ε + ω : seule la partie symétrique ε crée des contraintes. Dans le cercle de Mohr des déformations, l’ordonnée est γ/2.</p>'},
    {id:'rosette',act:2,chapter:3,title:'La rosette du tablier',place:'Tablier de la passerelle · essai de chargement',
      briefing:['Pendant l’essai de chargement, une rosette 0°/45°/90° collée près d’un joint bout à bout lit ε0 = 600, ε45 = 400 et ε90 = −100 µε.','Règle le tenseur ε pour que les trois jauges virtuelles affichent ces lectures.'],
      setup:{mode:'strain',state:{x:0,y:0,xy:0},amp:120,ranges:{x:[-1000,1000],y:[-1000,1000],xy:[-1000,1000]},view:{yaw:0,pitch:0},layers:{deformed:true,ghost:true,rosette:true}},
      controls:['x','y','xy'],
      targets:[600,400,-100],
      watch:[['Jauge a · 0°',d=>d.rosette[0],'µε'],['Jauge b · 45°',d=>d.rosette[1],'µε'],['Jauge c · 90°',d=>d.rosette[2],'µε']],
      goals:[
        {text:'Accorde la jauge a (0°) sur 600 µε.',check:d=>near(d.rosette[0],600,8),progress:d=>1-Math.abs(d.rosette[0]-600)/600},
        {text:'Accorde la jauge c (90°) sur −100 µε, sans dérégler a.',check:d=>near(d.rosette[2],-100,8)&&near(d.rosette[0],600,8),progress:d=>1-Math.abs(d.rosette[2]+100)/400},
        {text:'Accorde la jauge b (45°) sur 400 µε, sans dérégler a et c.',check:d=>near(d.rosette[1],400,8)&&near(d.rosette[0],600,8)&&near(d.rosette[2],-100,8),progress:d=>1-Math.abs(d.rosette[1]-400)/400},
      ],
      solution:[[{x:600}],[{y:-100}],[{xy:150}]],
      hint:'La jauge a ne voit que εx, la jauge c que εy. La jauge b lit (εx + εy)/2 + εxy.',
      debrief:'<p>Une jauge orientée à θ lit <b>εθ = εx cos²θ + εy sin²θ + 2εxy sin θ cos θ</b>. D’où εx = ε0, εy = ε90 et <b>εxy = ε45 − (ε0 + ε90)/2 = 150 µε</b>, soit γxy = 2ε45 − ε0 − ε90 = 300 µrad.</p><p>En surface libre (σz = 0), la loi de Hooke donne ensuite les contraintes : c’est le dossier B de l’examen.</p>'},
    {id:'poisson',act:2,chapter:4,title:'Tôle mince, pièce épaisse',place:'Atelier · tôle mince et nœud épais',
      briefing:['Même chargement dans le plan, deux situations : une tôle mince, libre en épaisseur (σz = 0), et le cœur d’une pièce très épaisse où la matière voisine empêche l’épaisseur de varier (εz = 0).','Trouve la contrainte σz qu’il faut pour bloquer l’épaisseur.'],
      setup:{mode:'three',state:{x:150,y:60,z:0,xy:0,xz:0,yz:0},ranges:{z:[-100,200]},layers:{arrows:true,deformed:true,ghost:true,values:true}},
      controls:['z'],
      watch:[['σz',d=>d.input[2][2],'MPa'],['εz',d=>d.strain[2][2]*1e6,'µε'],['σVM',d=>d.vm,'MPa'],['σm',d=>d.mean,'MPa']],
      goals:[
        {text:'Bloque l’épaisseur : règle σz pour que εz = 0.',check:d=>Math.abs(d.strain[2][2]*1e6)<=5,progress:d=>1-Math.abs(d.strain[2][2]*1e6)/300},
        {text:'Trouve σz qui rend la contrainte de von Mises minimale.',check:d=>near(d.input[2][2],105,2),progress:d=>1-Math.abs(d.input[2][2]-105)/105},
      ],
      solution:[[{z:63}],[{z:105}]],
      hint:'εz = [σz − ν(σx + σy)]/E. Le minimum de von Mises s’obtient quand σz est au milieu de σx et σy.',
      debrief:'<p><b>εz = [σz − ν(σx + σy)]/E</b>. Tôle mince : σz = 0 et l’épaisseur diminue de 300 µε. Pièce épaisse : εz = 0 exige <b>σz = ν(σx + σy) = 63 MPa</b>.</p><p>Plus σz se rapproche de σx et σy, plus σVM baisse (77,9 MPa à σz = 105 MPa) alors que la contrainte moyenne monte : la triaxialité freine la plastification. C’est une raison de la sensibilité des assemblages soudés épais à la rupture fragile.</p>'},
    {id:'bridage',act:2,chapter:4,title:'La barre bridée',place:'Atelier · poste de soudage',
      briefing:['Un cordon chauffé à plus de 1 000 °C est entouré de métal froid qui l’empêche de se dilater : c’est une barre bridée.','Barre d’acier : E = 210 GPa, α = 12 × 10⁻⁶ K⁻¹, fy = 235 MPa donnée. Chauffe-la et regarde la contrainte monter.'],
      setup:{mode:'thermal',state:{dT:0,restraint:'x',fy:235},ranges:{dT:[0,300]},layers:{arrows:true,deformed:true,ghost:true,values:true}},
      controls:['dT','restraint'],
      watch:[['ΔT',(d,s)=>s.dT,'K'],['σx',d=>d.stress[0][0],'MPa'],['σVM',d=>d.vm,'MPa'],['σm',d=>d.mean,'MPa']],
      goals:[
        {text:'Bridée selon x : chauffe jusqu’à σVM = fy = 235 MPa.',check:(d,s)=>s.restraint==='x'&&near(d.vm,235,3),progress:(d,s)=>s.restraint==='x'?d.vm/235:0},
        {text:'Bride aussi selon y : à quel échauffement atteint-on fy maintenant ?',check:(d,s)=>s.restraint==='xy'&&near(d.vm,235,3),progress:(d,s)=>s.restraint==='xy'?d.vm/235:0},
        {text:'Bride dans les trois directions et chauffe au-delà de 200 K.',check:(d,s)=>s.restraint==='xyz'&&s.dT>=200,progress:(d,s)=>s.restraint==='xyz'?s.dT/200:0},
      ],
      solution:[[{dT:93.25}],[{restraint:'xy',dT:65.28}],[{restraint:'xyz',dT:200}]],
      hint:'Bridée en x seulement : σVM = EαΔT ≈ 2,52 MPa par kelvin. Change le bridage avec les boutons, puis ajuste ΔT.',
      debrief:'<p>Bridée selon x : <b>σx = −EαΔT</b>, soit 2,52 MPa par kelvin ; fy est atteinte vers 93 K. Bridée selon x et y : σx = σy = −EαΔT/(1 − ν), atteinte dès 65 K. Bridée partout : état hydrostatique, <b>σVM = 0</b> mais σm = −EαΔT/(1 − 2ν) ≈ −1 260 MPa à 200 K.</p><p>Au soudage, l’échauffement dépasse 1 000 K : la zone chaude plastifie en compression, puis se retrouve tendue en refroidissant. Les contraintes résiduelles avoisinent la limite d’élasticité. Ce modèle élastique à propriétés constantes explique l’origine du phénomène ; il ne calcule pas les contraintes résiduelles.</p>'},
    {id:'tricercle',act:3,chapter:5,title:'Trois cercles pour une facette',place:'Nœud épais · zone bridée',
      briefing:['Au cœur d’un nœud épais, l’état est tridimensionnel : σ1 = 180, σ2 = 60 et σ3 = −60 MPa, selon x, y et z.','Oriente la facette dans l’espace avec l’azimut et l’élévation. Le point P ne sort jamais de la zone entre les trois cercles.'],
      setup:{mode:'three',state:{x:180,y:60,z:-60,xy:0,xz:0,yz:0},layers:{arrows:true,vector:true,values:true,trail:true}},
      controls:['angle','elev'],
      watch:[['Azimut φ',(d,s)=>s.angle,'°'],['Élévation ψ',(d,s)=>s.elev,'°'],['σn',d=>d.facet.sigma,'MPa'],['|τ|',d=>d.facet.tau,'MPa']],
      goals:[
        {text:'Pose P sur le cercle (1,2), loin de l’axe : n reste dans le plan xy.',check:d=>onCircle(d,120,60)&&d.facet.tau>=30,progress:d=>d.facet.tau/60*(onCircle(d,120,60)?1:.5)},
        {text:'Pose P sur le cercle (2,3), loin de l’axe : n dans le plan yz.',check:d=>onCircle(d,0,60)&&d.facet.tau>=30,progress:d=>d.facet.tau/60*(onCircle(d,0,60)?1:.5)},
        {text:'Atteins le cisaillement maximal absolu, sur le grand cercle.',check:d=>d.facet.tau>=118.8,progress:d=>d.facet.tau/120},
      ],
      solution:[[{angle:45,elev:0}],[{angle:90,elev:45}],[{angle:0,elev:45}]],
      hint:'Azimut seul : n reste dans le plan xy. Azimut 90° puis élévation : n tourne dans le plan yz. Pour le grand cercle, incline n à 45° entre x et z.',
      debrief:'<p>Chaque cercle rassemble les facettes qui contiennent une direction principale : le cercle (1,2) quand n est perpendiculaire à la direction 3, et ainsi de suite. Une facette quelconque donne un point dans la <b>zone entre les cercles</b>.</p><p><b>τmax = (σ1 − σ3)/2 = 120 MPa</b>, sur les facettes à 45° des directions 1 et 3.</p>'},
    {id:'virole',act:3,chapter:5,title:'Le piège des contraintes planes',place:'Réservoir · virole soudée',
      briefing:['La virole soudée d’un réservoir est tendue dans deux directions : σx = 150 MPa (circonférentielle) et σy = 75 MPa (axiale). La paroi est mince et sa surface libre : σz = 0.','Le bureau d’études annonce τmax = 37,5 MPa en restant dans le plan de la tôle. Montre-lui qu’une facette est bien plus cisaillée.'],
      setup:{mode:'three',state:{x:150,y:75,z:0,xy:0,xz:0,yz:0},layers:{arrows:true,vector:true,values:true,trail:true}},
      controls:['angle','elev'],
      watch:[['Azimut φ',(d,s)=>s.angle,'°'],['Élévation ψ',(d,s)=>s.elev,'°'],['σn',d=>d.facet.sigma,'MPa'],['|τ|',d=>d.facet.tau,'MPa']],
      goals:[
        {text:'Trouve le cisaillement maximal en gardant n dans le plan de la tôle.',check:(d,s)=>Math.abs(s.elev)<=1&&d.facet.tau>=37.1,progress:(d,s)=>Math.abs(s.elev)<=1?d.facet.tau/37.5:0},
        {text:'Sors du plan : trouve une facette où |τ| dépasse 70 MPa.',check:d=>d.facet.tau>=70,progress:d=>d.facet.tau/75},
      ],
      solution:[[{angle:45,elev:0}],[{angle:0,elev:45}]],
      hint:'Dans le plan, le cisaillement culmine à 45° d’azimut. Pour sortir du plan, reviens à l’azimut 0° et incline la normale avec l’élévation.',
      debrief:'<p>En contraintes planes, la troisième contrainte principale vaut 0 et <b>compte</b>. Ici σ1 = 150, σ2 = 75 et σ3 = 0 MPa : <b>τmax,3D = 75 MPa</b>, sur des facettes inclinées à 45° dans l’épaisseur, contre 37,5 MPa dans le plan.</p><p>Tresca s’appuie sur cette valeur. Une tôle mince rompt d’ailleurs souvent en biseau, à 45° dans l’épaisseur.</p>'},
    {id:'hydrostatique',act:3,chapter:5,title:'La pression ne fait pas plier le métal',place:'Nœud épais · cœur de la zone bridée',
      briefing:['Voici le tenseur couplé d’une zone bridée : σ1 = 140 MPa, σ2 = σ3 = 80 MPa.','Le curseur p ajoute la même pression sur les trois faces. Observe les cercles, le plafond de Tresca et la jauge de von Mises.'],
      setup:{mode:'three',state:{x:100,y:100,z:100,xy:20,xz:20,yz:20,hydro:0},ranges:{hydro:[-300,200]},layers:{arrows:true,values:true,tresca:true}},
      controls:['hydro'],
      watch:[['p',(d,s)=>s.hydro,'MPa'],['σm',d=>d.mean,'MPa'],['σVM',d=>d.vm,'MPa'],['τmax',d=>d.tresca/2,'MPa']],
      goals:[
        {text:'Retire la partie sphérique : amène la contrainte moyenne σm à 0.',check:d=>Math.abs(d.mean)<=1,progress:d=>1-Math.abs(d.mean)/100},
        {text:'Comprime : descends σm sous −150 MPa en surveillant σVM.',check:d=>d.mean<=-149.5,progress:d=>(100-d.mean)/250},
      ],
      solution:[[{hydro:-100}],[{hydro:-250}]],
      hint:'σm = 100 + p. Regarde les rayons des cercles pendant que tu déplaces p.',
      debrief:'<p><b>σ = σm·I + s</b> : partie sphérique et déviateur. Une pression translate les trois cercles sans changer leurs rayons : τmax, Tresca et von Mises (60 MPa) ne voient que le déviateur.</p><p>Un métal ne plastifie pas sous pression hydrostatique seule. À l’inverse, une forte triaxialité de traction (σm grand et positif) favorise la rupture fragile.</p>'},
    {id:'cordon',act:3,chapter:6,title:'Le cordon du raidisseur',place:'Passerelle · raidisseur soudé',
      briefing:['Dernière étape : un raidisseur est soudé par un cordon d’angle d’axe z. Au droit du cordon, les contraintes de calcul sont données dans les axes x, y, z. La gorge est inclinée à 45° dans la section.','Oriente la facette sur la gorge, puis cherche l’effort maximal que le cordon peut reprendre selon EN 1993-1-8.'],
      setup:{mode:'three',state:{x:140,y:-20,z:0,xy:40,xz:30,yz:30,load:1,weld:true},ranges:{load:[0,3]},layers:{arrows:true,vector:true,values:true}},
      controls:['angle','load'],
      watch:[['σ⊥',d=>d.weld.perp,'MPa'],['τ⊥',d=>d.weld.tperp,'MPa'],['τ∥',d=>d.weld.tpar,'MPa'],['Taux maximal',d=>maxRatio(d),'']],
      goals:[
        {text:'Oriente la facette sur la gorge : normale à +45° dans la section.',check:(d,s)=>near(s.angle,45,0.6)&&near(s.elev||0,0,0.6)&&near(s.roll||0,0,0.6),progress:(d,s)=>1-Math.abs(s.angle-45)/45},
        {text:'Augmente l’effort λ jusqu’à la résistance : taux maximal entre 0,97 et 1.',check:(d,s)=>near(s.angle,45,0.6)&&maxRatio(d)>=0.97&&maxRatio(d)<=1,progress:d=>maxRatio(d),
          trap:d=>maxRatio(d)>1?'Au-delà de 1, le cordon est surchargé : redescends λ.':''},
      ],
      solution:[[{angle:45}],[{load:2.2}]],
      hint:'Tape 45 dans la saisie de l’angle pour être exact. Puis fais monter λ en surveillant les deux jauges Eurocode.',
      debrief:'<p>Méthode directionnelle (EN 1993-1-8:2005 §4.5.3.2) : <b>√[σ⊥² + 3(τ⊥² + τ∥²)] ≤ fu/(βw γM2) = 417,8 MPa</b> et <b>σ⊥ ≤ 0,9 fu/γM2 = 338,4 MPa</b>. Sur la gorge : σ⊥ = 100λ, τ⊥ = −80λ, τ∥ = 42,4λ MPa.</p><p>Le critère combiné gouverne : λmax ≈ 2,25. Paramètres imposés : fu = 470 MPa, βw = 0,90, γM2 = 1,25. La vérification complète demande aussi longueur efficace, gorge minimale, métal de base, fatigue et exécution (EN 1090-2).</p>'},
  ];
  function initialState(ep){return {...L.defaults(ep.setup.mode),...ep.setup.state,amp:ep.setup.amp??null};}
  function runner(ep){
    const done=ep.goals.map(()=>false),mem={};
    return {
      update(state){
        const d=L.derive(state);
        let current=done.indexOf(false);
        while(current>=0){
          const g=ep.goals[current];
          g.track?.(d,state,mem);
          if(!g.check(d,state,mem))break;
          done[current]=true;current=done.indexOf(false);
        }
        const g=current>=0?ep.goals[current]:null;
        return {done:done.slice(),current,complete:current<0,progress:g?clamp(g.progress?.(d,state,mem)):1,feedback:g?.trap?.(d,state)||'',derived:d};
      },
    };
  }
  const fresh=()=>({version:1,done:{}});
  const points=stars=>stars===3?80:stars===2?65:50;
  const indexOf=id=>episodes.findIndex(e=>e.id===id);
  function unlocked(p,index){return index===0||(index>0&&index<episodes.length&&!!p.done[episodes[index-1].id]);}
  function complete(p,id,stars){
    const i=indexOf(id);
    // Replaying may improve the stars; XP always follows the best result, never the number of attempts.
    if(i<0||!unlocked(p,i)||![1,2,3].includes(stars)||(p.done[id]||0)>=stars)return false;
    p.done[id]=stars;return true;
  }
  const xp=p=>Object.values(p.done).reduce((t,s)=>t+points(s),0);
  function restore(raw){
    try{
      const x=JSON.parse(raw),p=fresh();
      if(!x||x.version!==1||!x.done||typeof x.done!=='object'||Array.isArray(x.done))return p;
      episodes.forEach(e=>{if([1,2,3].includes(x.done[e.id]))complete(p,e.id,x.done[e.id]);});
      return p;
    }catch{return fresh();}
  }
  return {acts,episodes,initialState,runner,fresh,unlocked,complete,xp,restore,indexOf,points};
});
