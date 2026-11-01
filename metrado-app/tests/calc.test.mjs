import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../data/capeco.js';
import { nuevoElemento } from '../data/elementos.js';
import { calcPartidaElemento } from '../calc/elemento.js';
import { contarEstribos, posicionesEstribos, piezasItem } from '../calc/acero.js';
import { optimizarCorte, partir } from '../calc/corte.js';
import { porM2 } from '../calc/muros.js';
import { resumen, claveSel } from '../calc/index.js';
import { rendimientoRegistro, resumenObra, diasConCuadrilla } from '../calc/obra.js';
import { migrarV1, tramosDesdeTexto } from '../storage.js';

const T = structuredClone(DEFAULTS);
const cerca = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${a} ≠ ${b}`);
const m = (r, clave) => r.materiales.find((x) => x.clave === clave)?.cantidad;
let n = 0;
const el = (tipo, cambios = {}) => Object.assign(nuevoElemento(tipo, tipo, `e${n++}`), cambios);

test("1 m³ de concreto f'c 210 sin desperdicio = 9.73 bolsas", () => {
  const t = structuredClone(DEFAULTS);
  t.concreto.desperdicio = 0;
  const r = calcPartidaElemento(el('zapata', { dims: { A: 1, B: 1, h: 1 } }), 'concreto', t);
  cerca(r.cantidad, 1);
  cerca(m(r, 'cemento'), 9.73);
  cerca(m(r, 'arena'), 0.52);
});

test('cimiento ciclópeo 1:10 + 30% PG con 5% de desperdicio', () => {
  const r = calcPartidaElemento(el('cimiento', { dims: { L: 10, B: 0.4, h: 0.8 } }), 'concreto', T);
  cerca(r.cantidad, 3.2);
  cerca(m(r, 'cemento'), 3.2 * 2.9 * 1.05);
  cerca(m(r, 'piedra_grande'), 3.2 * 0.48 * 1.05);
});

test('losa aligerada h=20 y escalera', () => {
  const r = calcPartidaElemento(el('losa_aligerada', { dims: { A: 5, B: 4 } }), 'concreto', T);
  cerca(r.cantidad, 20 * 0.0875);
  cerca(m(r, 'ladrillo_techo_15'), 20 * 8.33 * 1.05);
  const e = calcPartidaElemento(el('escalera', { dims: { B: 1, L: 3, t: 0.15, np: 10, p: 0.25, cp: 0.175 } }), 'concreto', T);
  cerca(e.cantidad, 3 * 0.15 + (10 * 0.25 * 0.175) / 2);
});

test('metrado fijo escala los materiales', () => {
  const z = el('zapata', { dims: { A: 1, B: 1, h: 1 } });
  z.partidas.concreto.fijo = 2.5;
  const r = calcPartidaElemento(z, 'concreto', T);
  cerca(r.cantidad, 2.5);
  cerca(r.calculado, 1);
  cerca(m(r, 'cemento'), 2.5 * 9.73 * 1.05);
  cerca(r.rendimiento.dias, 2.5 / 25);
});

test('estribos: texto y tramos dan lo mismo (18 en 3 m)', () => {
  assert.equal(contarEstribos('1@.05, 4@.10, r@.25', 3), 18);
  const pos = posicionesEstribos([{ n: 1, s: 0.05 }, { n: 4, s: 0.1 }], 0.25, 3);
  assert.equal(pos.length, 18);
  cerca(pos[0], 0.05);
  cerca(pos[pos.length - 1], 2.95);
  assert.deepEqual(tramosDesdeTexto('1@.05, 4@.10, r@.25'), { tramos: [{ n: 1, s: 0.05 }, { n: 4, s: 0.1 }], resto: 0.25 });
});

test('malla de zapata 1.5×1.5, rec .075, Ø1/2"@.15 con 2 ganchos', () => {
  const r = piezasItem({ tipo: 'malla', diam: '1/2', sep: 0.15, rec: 0.075, dir: 'X', ganchos: 2 }, T, { X: 1.5, Y: 1.5 });
  assert.equal(r.cant, 10);
  cerca(r.long, 1.35 + 2 * 0.2);
});

test('columna: estribos y kg con armado típico', () => {
  const c = el('columna', { dims: { b: 0.25, h: 0.25, H: 3 } });
  c.partidas.acero.armado = [
    { tipo: 'barras', diam: '1/2', cant: 4, long: 3, ganchos: 1, traslapes: 0 },
    { tipo: 'estribos', diam: '3/8', b: 0.25, h: 0.25, rec: 0.04, long: 3, tramos: [{ n: 1, s: 0.05 }, { n: 4, s: 0.1 }], resto: 0.25 },
  ];
  const t = structuredClone(DEFAULTS);
  t.acero.desperdicio = 0;
  const r = calcPartidaElemento(c, 'acero', t);
  cerca(m(r, 'acero_1/2'), 4 * 3.2 * 0.994);
  cerca(m(r, 'acero_3/8'), 18 * 0.88 * 0.56);
  assert.equal(r.corte['3/8'].varillas, 2);
});

test('corte: 18 piezas de 0.88 m caben en 2 varillas; pieza de 12 m se traslapa', () => {
  const r = optimizarCorte([{ long: 0.88, cant: 18 }], 9, 0.4);
  assert.equal(r.varillas, 2);
  assert.deepEqual(partir(12, 9, 0.5), [9, 3.5]);
  const r2 = optimizarCorte([{ long: 12, cant: 2 }], 9, 0.5);
  assert.equal(r2.varillas, 3); // 2 × 9 m + 2 × 3.5 m en una tercera
});

test('encofrado de viga con accesorios y reúsos', () => {
  const v = el('viga', { n: 2, dims: { b: 0.25, h: 0.5, L: 4 } });
  v.partidas.encofrado.usos = 2;
  const r = calcPartidaElemento(v, 'encofrado', T);
  const area = (0.25 + 1) * 4 * 2;
  cerca(r.cantidad, area);
  cerca(m(r, 'acc_puntales'), area * 0.9 / 2);
  cerca(m(r, 'madera'), area * 5.5);
});

test('muro KK 18 huecos en soga, junta 1.5 cm, con vano', () => {
  const u = porM2(DEFAULTS.ladrillos.kk18, 'soga', 1.5);
  cerca(u.ladrillos, 37.348, 1e-2);
  cerca(u.mortero, 0.0251, 1e-3);
  const mu = el('muro', { dims: { L: 5, H: 2.6 } });
  mu.partidas.muro.vanos = [{ ancho: 1, alto: 2.1, cant: 1 }];
  const r = calcPartidaElemento(mu, 'muro', T);
  cerca(r.cantidad, 13 - 2.1);
  cerca(m(r, 'ladrillo_kk18'), 10.9 * u.ladrillos * 1.05, 1e-2);
});

test('rendimiento con cuadrilla propia', () => {
  const mu = el('muro', { dims: { L: 10, H: 1 } });
  mu.partidas.muro.rend = 6;
  mu.partidas.muro.cuadrilla = { capataz: 0, operario: 1, oficial: 0, peon: 1 };
  const r = calcPartidaElemento(mu, 'muro', T);
  cerca(r.rendimiento.hhTotal, (8 * 2 / 6) * 10);
  cerca(r.rendimiento.costo, (8 / 6) * 10 * (29 + 21));
});

test('partida manual con materiales por unidad', () => {
  const p = el('manual', { n: 2 });
  Object.assign(p.partidas.manual, { cantidad: 10, und: 'm³', rend: 4, materiales: [{ nombre: 'Agua', und: 'm³', porUnidad: 0.1 }] });
  const r = calcPartidaElemento(p, 'manual', T);
  cerca(r.cantidad, 20);
  cerca(r.materiales[0].cantidad, 2);
  cerca(r.rendimiento.dias, 5);
});

test('resumen: selección, ocultos y "por avanzar"', () => {
  const a = el('zapata', { dims: { A: 1, B: 1, h: 1 } });
  const b = el('zapata', { dims: { A: 1, B: 1, h: 1 } });
  const c = el('zapata', { dims: { A: 1, B: 1, h: 1 }, oculto: true });
  b.partidas.concreto.ejecutado = true;
  const pr = { elementos: [a, b, c] };
  const todo = resumen(pr, T, { modo: 'todo', excluidos: { [claveSel(a, 'acero')]: true } });
  assert.equal(todo.filas.filter((f) => f.clave === 'concreto').length, 2);
  assert.equal(todo.filas.filter((f) => f.clave === 'acero').length, 1);
  const pend = resumen(pr, T, { modo: 'pendiente', excluidos: {} });
  cerca(pend.materiales.find((x) => x.clave === 'cemento').cantidad, 9.73 * 1.05);
  assert.ok(pend.corte['1/2'].varillas > 0);
});

test('rendimiento en obra: 2 personas, 6 m² en 8 h', () => {
  const reg = { cantidad: 6, horas: 8, personas: { operario: 1, peon: 1 } };
  const r = rendimientoRegistro(reg);
  cerca(r.porDia, 6);
  cerca(r.hhPorUnidad, 16 / 6);
  const s = resumenObra([reg, { cantidad: 9, horas: 8, personas: { operario: 1, peon: 1 } }], DEFAULTS.rendimientos['muro.soga']);
  cerca(s.hhPorUnidad, 32 / 15);
  cerca(s.rend, 7.5);
  cerca(s.eficiencia, ((8 * 1.6) / 8.5) / (32 / 15) * 100);
  cerca(diasConCuadrilla(30, 16 / 6, 2), 5);
});

test('migración de la versión 1', () => {
  const v1 = {
    actual: 'p1',
    proyectos: [{
      id: 'p1', nombre: 'Casa',
      partidas: [
        { tipo: 'concreto', nombre: 'Zap', datos: { elemento: 'zapata', dims: ['1', '1', '1'], n: 2, mezcla: '175' } },
        { tipo: 'encofrado', nombre: 'Enc SC', datos: { elemento: 'sobrecimiento', dims: ['8', '0.3'], n: 1 } },
        { tipo: 'acero', nombre: 'Ac', datos: { n: 1, barras: [{ diam: '1/2', cant: 4, long: 3, ganchos: 1, traslapes: 0 }], estribos: { diam: '3/8', b: 0.25, h: 0.25, rec: 0.04, long: 3, dist: '1@.05, 4@.10, r@.25' } } },
        { tipo: 'muro', nombre: 'M', datos: { ladrillo: 'kk18', aparejo: 'soga', junta: 1.5, mortero: '1:4', largo: 5, alto: 2.6, n: 1, vanos: [] } },
      ],
    }],
  };
  const v2 = migrarV1(v1);
  const [z, sc, ac, mu] = v2.proyectos[0].elementos;
  assert.equal(z.mezcla, '175');
  assert.equal(z.partidas.acero.activa, false);
  cerca(calcPartidaElemento(z, 'concreto', T).cantidad, 2);
  cerca(calcPartidaElemento(sc, 'encofrado', T).cantidad, 2 * 8 * 0.3);
  assert.equal(calcPartidaElemento(ac, 'acero', T).armado.detalle[1].cant, 18);
  cerca(calcPartidaElemento(mu, 'muro', T).cantidad, 13);
});
