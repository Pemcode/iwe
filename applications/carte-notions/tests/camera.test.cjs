const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/camera.js');

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('aller-retour monde ↔ écran', () => {
  const cam = { x: 0.3, y: -0.2, k: 420 };
  const [sx, sy] = C.ecran(cam, 0.5, 0.1, 1200, 800);
  const [wx, wy] = C.monde(cam, sx, sy, 1200, 800);
  near(wx, 0.5); near(wy, 0.1);
});

test('le zoom garde fixe le point sous le curseur et respecte ses bornes', () => {
  const cam = { x: 0, y: 0, k: 300 };
  const avant = C.monde(cam, 900, 200, 1200, 800);
  const z = C.zoomer(cam, 2, 900, 200, 1200, 800, 100, 5000);
  const apres = C.monde(z, 900, 200, 1200, 800);
  near(avant[0], apres[0]); near(avant[1], apres[1]);
  assert.equal(C.zoomer(cam, 100, 0, 0, 1200, 800, 100, 5000).k, 5000);
});

test('le cadrage place la boîte dans la zone visible, fiche ouverte comprise', () => {
  const zone = { x: 0, y: 60, w: 800, h: 740 };
  const cam = C.cadrer([-1, -0.5, 1, 0.5], zone, 1200, 800, 40, 1, 1e6);
  const [x0, y0] = C.ecran(cam, -1, -0.5, 1200, 800);
  const [x1, y1] = C.ecran(cam, 1, 0.5, 1200, 800);
  assert.ok(x0 >= zone.x + 39 && x1 <= zone.x + zone.w - 39);
  assert.ok(y0 >= zone.y + 39 && y1 <= zone.y + zone.h - 39);
});

test('le vol part de a et arrive exactement à b', () => {
  const a = { x: 0, y: 0, k: 200 }, b = { x: 1, y: 1, k: 800 };
  assert.deepEqual(C.voler(a, b, 0, 1200, 800), a);
  const fin = C.voler(a, b, 1, 1200, 800);
  near(fin.x, 1); near(fin.y, 1); near(fin.k, 800, 1e-6);
  assert.ok(C.voler(a, b, 0.5, 1200, 800).k < Math.sqrt(200 * 800));
});
