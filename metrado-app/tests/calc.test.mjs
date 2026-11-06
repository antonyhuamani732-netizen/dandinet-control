import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../data/capeco.js';
import { nuevoElemento } from '../data/elementos.js';
import { calcPartidaElemento } from '../calc/elemento.js';
import { contarEstribos, posicionesEstribos, piezasItem, anclaje } from '../calc/acero.js';
import { confinamiento, distribuirSegunNorma, verificarEstribos, zonasEmpalme } from '../calc/norma.js';
import { areaEncofrado } from '../calc/encofrado.js';
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
  const area = (0.25 + 2 * (0.5 - 0.2)) * 4 * 2; // peraltada: fondo + 2 × (h − e)
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

// ---------- v3 ----------
const D12 = DEFAULTS.acero.diametros['1/2'];

test('barra por apoyos: llega a viga peraltada y a viga chata', () => {
  const it = {
    tipo: 'barras', modo: 'apoyos', zona: 'corrido', diam: '1/2', cant: 2, rec: 0.04, luz: 4,
    izq: { apoyo: 'viga_peraltada', ancho: 0.25 }, der: { apoyo: 'viga_chata', ancho: 0.3, alto: 0.2 },
  };
  const r = piezasItem(it, T, {});
  // 4 + (0.25 − 0.04) + 0.20 gancho + (0.30 − 0.04) + gancho recortado a 0.20 − 0.08 = 0.12
  cerca(r.piezas[0].long, 4 + 0.21 + D12.gancho + 0.26 + 0.12);
  assert.equal(r.avisos.length, 1);
  assert.match(r.desglose[0], /= 4\.79 m/);
  assert.equal(anclaje({ apoyo: 'libre' }, D12, 0.04).recto, -0.04);
});

test('modo total no suma ganchos; bastones en ambos apoyos cuentan doble', () => {
  const t = piezasItem({ tipo: 'barras', modo: 'total', diam: '1/2', cant: 3, long: 5.2, ganchos: 2 }, T);
  cerca(t.piezas[0].long, 5.2);
  const b = piezasItem({ tipo: 'barras', modo: 'apoyos', zona: 'ambos', frac: '3', diam: '5/8', cant: 1, rec: 0.04,
    izq: { apoyo: 'columna', ancho: 0.25 }, der: { apoyo: 'columna', ancho: 0.25 } }, T, { luz: 4.5 });
  assert.equal(b.piezas.length, 2);
  cerca(b.piezas[0].long, 1.5 + 0.21 + DEFAULTS.acero.diametros['5/8'].gancho);
  assert.equal(b.info.startsWith('2 ×'), true);
});

test('barras sin modo (datos v2) dan lo mismo que antes', () => {
  const r = piezasItem({ tipo: 'barras', diam: '1/2', cant: 4, long: 3, ganchos: 1, traslapes: 0 }, T);
  cerca(r.piezas[0].long, 3.2);
});

test('encofrado por clase de viga', () => {
  cerca(areaEncofrado('viga', [0.6, 0.2, 4, 0.2], 'chata'), 0.6 * 4);
  cerca(areaEncofrado('viga', [0.25, 0.5, 4, 0.2], 'borde'), (0.25 + 0.5 + 0.3) * 4);
  cerca(areaEncofrado('viga', [0.25, 0.5, 4], undefined), (0.25 + 1) * 4);
});

test('confinamiento E.060: columna y viga', () => {
  const c = confinamiento('columna', 'E060', { b: 0.25, h: 0.4, luz: 2.6, dbLong: 0.0127, dbEst: 0.0095 });
  cerca(c.zona, 0.5);
  cerca(c.so, 0.1);
  const v = confinamiento('viga', 'E060', { b: 0.25, h: 0.5, luz: 4, dbLong: 0.0159, dbEst: 0.0095 });
  cerca(v.zona, 1.0);
  cerca(v.so, 0.11);
  const dist = distribuirSegunNorma(v);
  assert.deepEqual(dist.tramos, [{ n: 1, s: 0.05 }, { n: 10, s: 0.1 }]);
  assert.equal(dist.resto, 0.2);
  assert.equal(verificarEstribos({ ...dist }, v).length, 0);
  assert.ok(verificarEstribos({ tramos: [{ n: 1, s: 0.05 }, { n: 4, s: 0.1 }], resto: 0.25 }, v).length >= 2);
});

test('estribos en el nudo se suman', () => {
  const r = piezasItem({ tipo: 'estribos', diam: '3/8', b: 0.25, h: 0.25, rec: 0.04, long: 3,
    tramos: [{ n: 1, s: 0.05 }, { n: 4, s: 0.1 }], resto: 0.25, nudo: { incluir: true, alto: 0.4, sep: 0.15 } }, T);
  assert.equal(r.cant, 18 + 3);
});

test('zonas de empalme: columna, viga superior e inferior', () => {
  const col = zonasEmpalme('columna', 'E060', { b: 0.25, h: 0.25, luz: 2.8 }, 'int');
  cerca(col.zonas[0].x0, 0.7);
  cerca(col.zonas[0].x1, 2.1);
  const sup = zonasEmpalme('viga', 'E060', { h: 0.4, luz: 6 }, 'sup');
  cerca(sup.zonas[0].x0, 2);
  const inf = zonasEmpalme('viga', 'E060', { h: 0.4, luz: 6 }, 'inf');
  assert.equal(inf.zonas.length, 2);
  cerca(inf.zonas[0].x0, 0.8);
});

test('desperdicio: propio de la partida y real por corte de varillas', () => {
  const z = el('zapata', { dims: { A: 1, B: 1, h: 1 } });
  z.partidas.concreto.desp = 0;
  cerca(m(calcPartidaElemento(z, 'concreto', T), 'cemento'), 9.73);
  const c = el('columna', { dims: { b: 0.25, h: 0.25, H: 3 } });
  c.partidas.acero.armado = [{ tipo: 'barras', modo: 'total', diam: '1/2', cant: 4, long: 3 }];
  c.partidas.acero.modoDesp = 'corte';
  const r = calcPartidaElemento(c, 'acero', T);
  cerca(m(r, 'acero_1/2'), 2 * 9 * D12.kgm); // 4 piezas de 3 m → 2 varillas
  cerca(r.desperdicio.kgPorcentaje, 12 * D12.kgm * 1.03);
});

// ---------- v4: método de hoja de cálculo ----------
import { num as numero, evaluar, esExpresion } from '../calc/util.js';
import { varillasPorPeso } from '../calc/elemento.js';

test('fórmulas como en Excel', () => {
  cerca(numero('25.283/2'), 12.6415);
  cerca(numero('=2.28+0.3*2-2*0.04'), 2.8);
  cerca(numero('14+8'), 22);
  cerca(numero('(1,2+0,3)*2'), 3);
  cerca(numero('0.17*2+0.12*2+2*0.08'), 0.74);
  assert.equal(numero('abc'), 0);
  assert.ok(Number.isNaN(evaluar('2+')));
  assert.equal(esExpresion('12.5'), false);
  assert.equal(esExpresion('25.283/2'), true);
});

test('longitud total con medida CAD ÷ escala', () => {
  const t = structuredClone(DEFAULTS);
  t.acero.escalaCAD = 2;
  const r = piezasItem({ tipo: 'barras', modo: 'total', diam: '5/8', cant: 2, long: '', cad: '25.283' }, t);
  cerca(r.piezas[0].long, 12.6415);
  cerca(piezasItem({ tipo: 'barras', modo: 'total', diam: '5/8', cant: 2, long: '25.283/2' }, T).piezas[0].long, 12.6415);
});

test('estribo con gancho propio y cantidad fija (VIGA P. 0.25×0.50, gancho 0.13)', () => {
  const r = piezasItem({ tipo: 'estribos', diam: '3/8', b: 0.25, h: 0.5, rec: 0.04, gancho: 0.13, cantFija: '84', tramos: [], resto: 0, long: 3 }, T);
  cerca(r.long, 1.44);
  assert.equal(r.cant, 84);
});

test('varillas por peso + 10 % con REDONDEAR.MAS', () => {
  const v = varillasPorPeso({ '5/8': 687.472, '1/2': 75.501, '3/8': 410.57 }, T);
  assert.deepEqual(v, { '5/8': 55, '1/2': 10, '3/8': 90 });
});
