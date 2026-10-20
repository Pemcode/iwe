/* Rendu 2D de la carte sur un canevas : fond, liens, notions, étiquettes sans chevauchement, îles, mini-carte. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Rendu2D = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const POLICE = '"Atkinson Hyperlegible", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const POLICE_TITRE = '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif';
  const CELLULE = 28;

  function lireTheme() {
    const style = getComputedStyle(document.documentElement);
    const v = nom => style.getPropertyValue(nom).trim();
    return {
      nom: document.documentElement.dataset.theme || 'nuit',
      fond: v('--fond'), fond2: v('--fond-2'), encre: v('--encre'), encre2: v('--encre-2'), discret: v('--discret'),
      accent: v('--accent'), halo: v('--halo'), lien: v('--lien'), surface: v('--surface-pleine'),
      grilleMin: v('--grille-min'), grilleMaj: v('--grille-maj'), carrefour: v('--carrefour'),
      familles: [1, 2, 3, 4, 5, 6].map(k => v('--fam-' + k))
    };
  }

  function rgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function fonce(hex, f) {
    const [r, g, b] = rgb(hex);
    return `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;
  }

  function alea(graine) {
    let a = graine >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function lisse(a, b, x) {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  class Grille {
    constructor() { this.cases = new Map(); }
    cle(cx, cy) { return cx * 100003 + cy; }
    libre(r) {
      for (let cx = Math.floor(r[0] / CELLULE); cx <= Math.floor(r[2] / CELLULE); cx++) {
        for (let cy = Math.floor(r[1] / CELLULE); cy <= Math.floor(r[3] / CELLULE); cy++) {
          const liste = this.cases.get(this.cle(cx, cy));
          if (liste && liste.some(o => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1])) return false;
        }
      }
      return true;
    }
    reserver(r) {
      for (let cx = Math.floor(r[0] / CELLULE); cx <= Math.floor(r[2] / CELLULE); cx++) {
        for (let cy = Math.floor(r[1] / CELLULE); cy <= Math.floor(r[3] / CELLULE); cy++) {
          const cle = this.cle(cx, cy);
          if (!this.cases.has(cle)) this.cases.set(cle, []);
          this.cases.get(cle).push(r);
        }
      }
    }
  }

  class Rendu2D {
    constructor(canvas, modele) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.modele = modele;
      const n = modele.notions.length;
      this.sx = new Float32Array(n);
      this.sy = new Float32Array(n);
      this.r = new Float32Array(n);
      this.vis = new Uint8Array(n);
      this.etiquettes = [];
      this.iles = [];
      this.mesures = new Map();
      this.halos = new Map();
      this.W = 0; this.H = 0; this.dpr = 1;
      this.t = lireTheme();
    }

    redimensionner() {
      const rect = this.canvas.getBoundingClientRect();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      this.W = Math.max(1, rect.width); this.H = Math.max(1, rect.height);
      this.canvas.width = Math.round(this.W * this.dpr);
      this.canvas.height = Math.round(this.H * this.dpr);
      const hasard = alea(20261018);
      const nombre = Math.round(this.W * this.H / 2600);
      this.etoiles = Array.from({ length: nombre }, () => ({ x: hasard(), y: hasard(), r: hasard() < 0.92 ? 0.7 : 1.3,
        a: 0.15 + hasard() * 0.55, p: 0.015 + hasard() * 0.05 }));
      this.vignette = null;
    }

    theme() {
      this.t = lireTheme();
      this.halos.clear();
      this.vignette = null;
    }

    oublierMesures() { this.mesures.clear(); }

    couleur(famille) { return this.t.familles[(famille ? famille.slot : 6) - 1]; }

    largeur(texte, police) {
      const cle = police + '|' + texte;
      let w = this.mesures.get(cle);
      if (w === undefined) { this.ctx.font = police; w = this.ctx.measureText(texte).width; this.mesures.set(cle, w); }
      return w;
    }

    halo(couleur) {
      let image = this.halos.get(couleur);
      if (!image) {
        image = document.createElement('canvas');
        image.width = image.height = 64;
        const g = image.getContext('2d');
        const [r, v, b] = rgb(couleur.startsWith('#') ? couleur : '#ffffff');
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, `rgba(${r},${v},${b},0.55)`);
        grad.addColorStop(0.35, `rgba(${r},${v},${b},0.18)`);
        grad.addColorStop(1, `rgba(${r},${v},${b},0)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
        this.halos.set(couleur, image);
      }
      return image;
    }

    fond(cam) {
      const { ctx, W, H, t } = this;
      ctx.fillStyle = t.fond;
      ctx.fillRect(0, 0, W, H);
      if (t.nom === 'nuit') {
        if (!this.vignette) {
          this.vignette = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.hypot(W, H) * 0.62);
          this.vignette.addColorStop(0, t.fond2);
          this.vignette.addColorStop(1, t.fond);
        }
        ctx.fillStyle = this.vignette;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ffffff';
        for (const e of this.etoiles) {
          // Léger parallaxe : les étoiles glissent moins vite que la carte, d'où une impression de profondeur.
          const x = ((e.x * W - cam.x * cam.k * e.p) % W + W) % W;
          const y = ((e.y * H - cam.y * cam.k * e.p) % H + H) % H;
          ctx.globalAlpha = e.a;
          ctx.fillRect(x, y, e.r, e.r);
        }
        ctx.globalAlpha = 1;
      } else {
        const cible = 13 / cam.k;
        const puissance = Math.pow(10, Math.floor(Math.log10(cible)));
        const pas = puissance * (cible / puissance <= 2 ? 2 : cible / puissance <= 5 ? 5 : 10);
        const [x0, y0] = root.Camera.monde(cam, 0, 0, W, H);
        const [x1, y1] = root.Camera.monde(cam, W, H, W, H);
        for (const [style, multiple] of [[t.grilleMin, 1], [t.grilleMaj, 5]]) {
          const p = pas * multiple;
          ctx.beginPath();
          for (let x = Math.floor(x0 / p) * p; x <= x1; x += p) {
            const s = Math.round(root.Camera.ecran(cam, x, 0, W, H)[0]) + 0.5;
            ctx.moveTo(s, 0); ctx.lineTo(s, H);
          }
          for (let y = Math.floor(y0 / p) * p; y <= y1; y += p) {
            const s = Math.round(root.Camera.ecran(cam, 0, y, W, H)[1]) + 0.5;
            ctx.moveTo(0, s); ctx.lineTo(W, s);
          }
          ctx.strokeStyle = style;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    dessiner(etat) {
      const { ctx, W, H, t, modele } = this;
      const { notions, voisins } = modele;
      const cam = etat.cam;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.fond(cam);

      const zoom = cam.k / etat.kAjuste;
      const echelle = Math.min(2, Math.max(0.85, Math.pow(zoom, 0.4)));
      const actif = etat.selection;
      const pointe = actif == null ? etat.survol : null;
      const focus = new Set();
      const centre = actif != null ? actif : pointe;
      if (centre != null) { focus.add(centre); voisins[centre].forEach(v => focus.add(v.j)); }
      if (etat.apercu != null) focus.add(etat.apercu);
      const attenue = actif != null ? 0.14 : pointe != null ? 0.4 : 1;

      const visibles = [];
      for (const n of notions) {
        const i = n.i;
        const x = W / 2 + (n.x[0] - cam.x) * cam.k, y = H / 2 + (n.x[1] - cam.y) * cam.k;
        this.sx[i] = x; this.sy[i] = y;
        this.r[i] = (Math.min(8, 1.5 + 0.48 * Math.sqrt(n.f)) + (n.h ? 0.8 : 0)) * echelle;
        const ok = root.Graphe.visible(n, etat.filtres) || i === actif;
        this.vis[i] = ok && x > -60 && x < W + 60 && y > -60 && y < H + 60 ? 1 : ok ? 2 : 0;
        if (this.vis[i] === 1) visibles.push(i);
      }

      // Liens : un tracé par couleur et par force, couleur de l'île pour les liens internes.
      const largeur = Math.min(1.5, Math.max(0.6, 0.7 * Math.pow(zoom, 0.3)));
      const paquets = new Map();
      for (const [a, b, s, , , faible] of modele.data.liens) {
        // Les simples rapprochements de section apparaissent au zoom ou dans le voisinage choisi.
        if (faible && zoom < 1.7) continue;
        if (!this.vis[a] || !this.vis[b] || (this.vis[a] === 2 && this.vis[b] === 2)) continue;
        if (centre != null && (a === centre || b === centre)) continue;
        const interne = notions[a].c === notions[b].c;
        const cle = (interne ? modele.continents[notions[a].c].famille.slot : 0) * 3 + (s > 0.5 ? 2 : s > 0.25 ? 1 : 0);
        let liste = paquets.get(cle);
        if (!liste) paquets.set(cle, liste = []);
        liste.push(a, b);
      }
      const forceAlpha = t.nom === 'nuit' ? [0.09, 0.16, 0.27] : [0.12, 0.2, 0.32];
      ctx.lineWidth = largeur;
      ctx.lineCap = 'round';
      for (const [cle, liste] of paquets) {
        const slot = Math.floor(cle / 3), niveau = cle % 3;
        ctx.strokeStyle = slot ? t.familles[slot - 1] : `rgb(${t.lien})`;
        ctx.globalAlpha = forceAlpha[niveau] * (slot ? 1 : 0.8) * (attenue < 1 ? attenue * 0.9 : 1);
        ctx.beginPath();
        for (let k = 0; k < liste.length; k += 2) {
          ctx.moveTo(this.sx[liste[k]], this.sy[liste[k]]);
          ctx.lineTo(this.sx[liste[k + 1]], this.sy[liste[k + 1]]);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Liens de la notion choisie (ou survolée) : épais, dans la couleur de la voisine.
      if (centre != null) {
        for (const v of voisins[centre]) {
          if (!this.vis[v.j]) continue;
          ctx.strokeStyle = this.couleur(notions[v.j].famille);
          ctx.globalAlpha = actif != null ? 0.9 : 0.7;
          ctx.lineWidth = (actif != null ? 1.2 : 0.9) + 2.6 * v.s;
          ctx.setLineDash(v.faible ? [4, 4] : []);
          ctx.beginPath();
          ctx.moveTo(this.sx[centre], this.sy[centre]);
          ctx.lineTo(this.sx[v.j], this.sy[v.j]);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // Notions : d'abord les estompées, puis celles du voisinage par-dessus.
      const ordre = attenue < 1 ? visibles.filter(i => !focus.has(i)).concat(visibles.filter(i => focus.has(i))) : visibles;
      const nuit = t.nom === 'nuit';
      for (const i of ordre) {
        const n = notions[i];
        const couleur = this.couleur(n.famille);
        const alpha = focus.has(i) || attenue === 1 ? 1 : attenue;
        const x = this.sx[i], y = this.sy[i];
        if (alpha < 0.3) {
          // Hors du voisinage choisi : un petit point plat, pour que le regard reste sur les liens.
          ctx.globalAlpha = 0.28;
          ctx.fillStyle = couleur;
          ctx.beginPath();
          ctx.arc(x, y, Math.min(this.r[i], 1.6 + this.r[i] * 0.25), 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        const r = this.r[i];
        if (nuit && (n.h || r > 3.4) && alpha > 0.5) {
          const R = r * (n.h ? 4.2 : 3.4);
          ctx.globalAlpha = n.h ? 0.75 : 0.55;
          ctx.drawImage(this.halo(n.h ? t.carrefour : couleur), x - R, y - R, 2 * R, 2 * R);
        }
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        if (n.h) {
          ctx.fillStyle = t.carrefour;
          ctx.fill();
          ctx.lineWidth = Math.max(1.4, r * 0.38);
          ctx.strokeStyle = couleur;
          ctx.stroke();
          if (!nuit) { ctx.lineWidth = 0.8; ctx.strokeStyle = fonce(couleur, 0.55); ctx.beginPath(); ctx.arc(x, y, r + ctx.lineWidth, 0, Math.PI * 2); ctx.stroke(); }
        } else {
          ctx.fillStyle = couleur;
          ctx.fill();
          if (!nuit) { ctx.lineWidth = 0.9; ctx.strokeStyle = fonce(couleur, 0.6); ctx.stroke(); }
        }
      }
      ctx.globalAlpha = 1;

      // Anneaux : notion choisie (pulsation douce), aperçu de recherche, survol.
      const anneau = (i, couleur, epaisseur, ecart) => {
        if (i == null || !this.vis[i]) return;
        ctx.beginPath();
        ctx.arc(this.sx[i], this.sy[i], this.r[i] + ecart, 0, Math.PI * 2);
        ctx.lineWidth = epaisseur;
        ctx.strokeStyle = couleur;
        ctx.stroke();
      };
      if (actif != null) {
        const phase = (etat.temps % 2400) / 2400;
        ctx.globalAlpha = 0.5 * (1 - phase);
        anneau(actif, t.accent, 2, 4 + phase * 12);
        ctx.globalAlpha = 1;
        anneau(actif, t.accent, 2.5, 3.5);
      }
      anneau(etat.apercu, t.accent, 2, 4);
      if (pointe != null) anneau(pointe, t.encre, 1.5, 3);

      this.etiqueter(etat, zoom, focus, centre, visibles);
    }

    etiqueter(etat, zoom, focus, centre, visibles) {
      const { ctx, t, modele } = this;
      const { notions, voisins } = modele;
      const grille = new Grille();
      (etat.obstacles || []).forEach(o => grille.reserver(o));
      this.etiquettes = [];
      this.iles = [];
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';

      // Noms des îles : vue d'ensemble seulement, en encre (la pastille porte la couleur).
      const fondu = 1 - lisse(1.7, 3.0, zoom);
      if (fondu > 0.02) {
        const grande = Math.max(...modele.continents.map(c => c.taille));
        const iles = modele.continents.slice().sort((a, b) => b.taille - a.taille);
        for (const c of iles) {
          const membres = c.membres.filter(i => this.vis[i]);
          if (!membres.length) continue;
          const [x, y] = root.Camera.ecran(etat.cam, c.centre[0], c.centre[1], this.W, this.H);
          const taille = Math.round((13 + 8 * Math.sqrt(c.taille / grande)) * Math.min(1.25, Math.pow(zoom, 0.25)));
          const police = `700 ${taille}px ${POLICE_TITRE}`;
          const texte = c.nom.toUpperCase();
          const mesure = s => this.largeur(s, police) + s.length * 0.6;
          // Un nom trop long pour l'écran passe sur deux lignes, coupé au point médian.
          const lignes = mesure(texte) > this.W * 0.42 && texte.includes(' · ')
            ? [texte.split(' · ')[0] + ' ·', texte.split(' · ').slice(1).join(' · ')] : [texte];
          const pastilleL = taille * 0.9;
          const w = Math.max(...lignes.map(mesure)) + pastilleL;
          const h = lignes.length * taille * 1.05;
          const gauche = Math.min(Math.max(6, x - w / 2), this.W - 6 - w);
          let rect = null;
          for (const dy of [0, -h - 4, h + 4, -2 * h - 8, 2 * h + 8]) {
            const r = [gauche - 4, y + dy - h / 2, gauche + w + 4, y + dy + h / 2];
            if (r[0] >= 2 && r[2] <= this.W - 2 && r[1] >= 2 && r[3] <= this.H - 2 && grille.libre(r)) { rect = r; break; }
          }
          if (!rect) continue;
          grille.reserver(rect);
          this.iles.push({ k: c.k, rect });
          ctx.globalAlpha = fondu * (centre != null ? 0.35 : 0.92);
          ctx.font = police;
          if ('letterSpacing' in ctx) ctx.letterSpacing = '0.6px';
          const tx = rect[0] + 4 + pastilleL;
          const premiere = rect[1] + taille * 0.85;
          ctx.fillStyle = this.couleur(c.famille);
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(rect[0] + 4, premiere - taille * 0.62, taille * 0.55, taille * 0.55, 2);
          else ctx.rect(rect[0] + 4, premiere - taille * 0.62, taille * 0.55, taille * 0.55);
          ctx.fill();
          ctx.lineWidth = 4;
          lignes.forEach((ligne, k) => {
            const ty = premiere + k * taille * 1.05;
            ctx.strokeStyle = t.halo;
            ctx.strokeText(ligne, tx, ty);
            ctx.fillStyle = t.encre2;
            ctx.fillText(ligne, tx, ty);
          });
          if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        }
        ctx.globalAlpha = 1;
      }

      // Étiquettes des notions : voisinage d'abord, puis par importance, tant qu'il reste de la place.
      const candidats = [];
      if (centre != null) {
        candidats.push(centre);
        voisins[centre].forEach(v => candidats.push(v.j));
      }
      if (etat.apercu != null) candidats.push(etat.apercu);
      const surface = Math.min(1.3, Math.max(0.35, this.W * this.H / (1280 * 800)));
      const budget = centre != null && etat.selection != null ? 0 : Math.min(420, Math.round((12 + 36 * Math.pow(zoom, 1.5)) * surface));
      let places = 0;
      const vus = new Set();
      const essayer = (i, prioritaire) => {
        if (vus.has(i) || this.vis[i] !== 1) return;
        vus.add(i);
        const n = notions[i];
        const choisi = i === etat.selection;
        const taille = choisi ? 17 : prioritaire ? 13.5 : Math.round(11 + 4.5 * Math.sqrt(n.priorite / modele.pmax) + Math.min(2, zoom * 0.25));
        const police = `${choisi || prioritaire || n.h ? 700 : 400} ${taille}px ${POLICE}`;
        const w = this.largeur(n.l, police);
        const x = this.sx[i], y = this.sy[i], r = this.r[i] + 3;
        const d = r * 0.7;
        const positions = [
          [x + r, y + taille * 0.35], [x - r - w, y + taille * 0.35],
          [x - w / 2, y - r - 2], [x - w / 2, y + r + taille * 0.9],
          [x + d, y - d - 1], [x - d - w, y - d - 1], [x + d, y + d + taille * 0.8], [x - d - w, y + d + taille * 0.8]
        ];
        let choix = null;
        for (const [px, py] of positions) {
          const rect = [px - 2, py - taille * 0.82, px + w + 2, py + taille * 0.28];
          if (rect[0] >= 2 && rect[2] <= this.W - 2 && rect[1] >= 2 && rect[3] <= this.H - 2 && grille.libre(rect)) { choix = [px, py, rect]; break; }
        }
        // Seule la notion choisie impose son étiquette ; les autres attendent un zoom qui leur fasse de la place.
        if (!choix && choisi) { const [px, py] = positions[0]; choix = [px, py, [px - 2, py - taille * 0.82, px + w + 2, py + taille * 0.28]]; }
        if (!choix) return;
        grille.reserver(choix[2]);
        // Le disque d'une notion étiquetée reste dégagé : on peut toujours cliquer dessus.
        grille.reserver([x - r, y - r, x + r, y + r]);
        this.etiquettes.push({ i, rect: choix[2] });
        ctx.font = police;
        ctx.globalAlpha = prioritaire || etat.selection == null ? 1 : 0.5;
        ctx.lineWidth = choisi ? 5 : 3.5;
        ctx.strokeStyle = t.halo;
        ctx.strokeText(n.l, choix[0], choix[1]);
        ctx.fillStyle = prioritaire || n.h ? t.encre : t.encre2;
        ctx.fillText(n.l, choix[0], choix[1]);
        if (!prioritaire) places++;
      };
      // Les disques du voisinage sont réservés pour que les étiquettes ne les couvrent pas.
      for (const i of candidats) if (this.vis[i] === 1) grille.reserver([this.sx[i] - this.r[i], this.sy[i] - this.r[i], this.sx[i] + this.r[i], this.sy[i] + this.r[i]]);
      candidats.forEach(i => essayer(i, true));
      if (etat.survol != null && etat.selection != null) essayer(etat.survol, true);
      for (const i of modele.ordre) {
        if (places >= budget) break;
        essayer(i, false);
      }
      ctx.globalAlpha = 1;
    }

    toucher(sx, sy, tactile) {
      for (let k = this.etiquettes.length - 1; k >= 0; k--) {
        const { i, rect } = this.etiquettes[k];
        if (sx >= rect[0] && sx <= rect[2] && sy >= rect[1] && sy <= rect[3]) return { type: 'notion', i };
      }
      let meilleur = null, distance = Infinity;
      const tolerance = tactile ? 18 : 9;
      for (let i = 0; i < this.vis.length; i++) {
        if (this.vis[i] !== 1) continue;
        const d = Math.hypot(this.sx[i] - sx, this.sy[i] - sy);
        if (d < Math.max(this.r[i] + 4, tolerance) && d < distance) { meilleur = i; distance = d; }
      }
      if (meilleur != null) return { type: 'notion', i: meilleur };
      for (const { k, rect } of this.iles) {
        if (sx >= rect[0] && sx <= rect[2] && sy >= rect[1] && sy <= rect[3]) return { type: 'ile', k };
      }
      return null;
    }
  }

  /* Mini-carte : toutes les notions en points, et le cadre de ce que montre l'écran. */
  class MiniCarte {
    constructor(canvas, modele) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.modele = modele;
      this.image = null;
    }

    preparer(rendu) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const W = this.canvas.clientWidth || 180, H = this.canvas.clientHeight || 120;
      this.canvas.width = Math.round(W * dpr); this.canvas.height = Math.round(H * dpr);
      this.W = W; this.H = H; this.dpr = dpr;
      const [x0, y0, x1, y1] = this.modele.boite;
      this.k = Math.min((W - 12) / (x1 - x0), (H - 12) / (y1 - y0));
      this.ox = W / 2 - (x0 + x1) / 2 * this.k; this.oy = H / 2 - (y0 + y1) / 2 * this.k;
      this.image = document.createElement('canvas');
      this.image.width = this.canvas.width; this.image.height = this.canvas.height;
      const g = this.image.getContext('2d');
      g.scale(dpr, dpr);
      for (const n of this.modele.notions) {
        g.fillStyle = n.h ? rendu.t.carrefour : rendu.couleur(n.famille);
        g.globalAlpha = n.h ? 0.95 : 0.8;
        g.fillRect(this.ox + n.x[0] * this.k - 0.8, this.oy + n.x[1] * this.k - 0.8, 1.6, 1.6);
      }
    }

    dessiner(cam, W, H, rendu) {
      if (!this.image || !this.canvas.clientWidth) return;
      const { ctx } = this;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.W, this.H);
      ctx.drawImage(this.image, 0, 0, this.W, this.H);
      const [x0, y0] = root.Camera.monde(cam, 0, 0, W, H);
      const [x1, y1] = root.Camera.monde(cam, W, H, W, H);
      ctx.strokeStyle = rendu.t.accent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(this.ox + x0 * this.k, this.oy + y0 * this.k, (x1 - x0) * this.k, (y1 - y0) * this.k);
    }

    versMonde(px, py) {
      return [(px - this.ox) / this.k, (py - this.oy) / this.k];
    }
  }

  return { Rendu2D, MiniCarte, lireTheme };
});
