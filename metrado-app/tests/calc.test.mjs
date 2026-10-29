import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../data/capeco.js';
import { calcPartida, resumenProyecto } from '../calc/index.js';
import { contarEstribos } from '../calc/acero.js';
import { porM2 } from '../calc/muros.js';

const T = structuredClone(DEFAULTS);
const cerca = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${a} ≠ ${b}`);
const m = (r, clave) => r.materiales.find((x) => x.clave === clave).cantidad;

test("1 m³ de concreto f'c 210 sin desperdicio = 9.73 bolsas", () => {
  const t = structuredClone(DEFAULTS);
  t.concreto.desperdicio = 0;
  const r = calcPartida({ tipo: 'concreto', datos: { elemento: 'zapata', dims: [1, 1, 1], n: 1, mezcla: '210' } }, t);
  cerca(r.cantidad, 1);
  cerca(m(r, 'cemento'), 9.73);
  cerca(m(r, 'arena'), 0.52);
  cerca(m(r, 'piedra'), 0.53);
});

test('cimiento ciclópeo 1:10 + 30% PG con 5% de desperdicio', () => {
  const r = calcPartida({ tipo: 'concreto', datos: { elemento: 'cimiento', dims: [10, 0.4, 0.8], n: 1, mezcla: 'ciclopeo' } }, T);
  cerca(r.cantidad, 3.2);
  cerca(m(r, 'cemento'), 3.2 * 2.9 * 1.05);
  cerca(m(r, 'piedra_grande'), 3.2 * 0.48 * 1.05);
});

test('losa aligerada h=20: volumen y ladrillos de techo', () => {
  const r = calcPartida({ tipo: 'concreto', datos: { elemento: 'losa_aligerada', dims: [5, 4], n: 1, mezcla: '210', peralte: '20' } }, T);
  cerca(r.cantidad, 20 * 0.0875);
  cerca(m(r, 'ladrillo_techo_15'), 20 * 8.33 * 1.05);
});

test('escalera: garganta + pasos', () => {
  const r = calcPartida({ tipo: 'concreto', datos: { elemento: 'escalera', dims: [1, 3, 0.15, 10, 0.25, 0.175], n: 1, mezcla: '210' } }, T);
  cerca(r.cantidad, 1 * (3 * 0.15 + (10 * 0.25 * 0.175) / 2));
});

test('estribos 1@.05, 4@.10, r@.25 en 3 m = 18', () => {
  assert.equal(contarEstribos('1@.05, 4@.10, r@.25', 3), 18);
});

test('columna 0.25×0.25×3 con 4Ø1/2" y estribos 3/8"', () => {
  const t = structuredClone(DEFAULTS);
  t.acero.desperdicio = 0;
  const r = calcPartida({
    tipo: 'acero',
    datos: {
      n: 1,
      barras: [{ diam: '1/2', cant: 4, long: 3, ganchos: 1, traslapes: 0 }],
      estribos: { diam: '3/8', b: 0.25, h: 0.25, rec: 0.04, long: 3, dist: '1@.05, 4@.10, r@.25' },
    },
  }, t);
  cerca(m(r, 'acero_1/2'), 4 * 3.2 * 0.994);
  cerca(m(r, 'acero_3/8'), 18 * 0.88 * 0.56);
  cerca(r.cantidad, 12.7232 + 8.8704);
});

test('muro KK 18 huecos en soga, junta 1.5 cm', () => {
  const u = porM2(DEFAULTS.ladrillos.kk18, 'soga', 1.5);
  cerca(u.ladrillos, 37.348, 1e-2);
  cerca(u.mortero, 0.0251, 1e-3);
  const r = calcPartida({
    tipo: 'muro',
    datos: { ladrillo: 'kk18', aparejo: 'soga', junta: 1.5, mortero: '1:4', largo: 5, alto: 2.6, vanos: [{ ancho: 1, alto: 2.1, cant: 1 }], n: 1 },
  }, T);
  cerca(r.cantidad, 13 - 2.1);
  cerca(m(r, 'ladrillo_kk18'), 10.9 * u.ladrillos * 1.05, 1e-2);
});

test('encofrado de viga: fondo + 2 costados', () => {
  const r = calcPartida({ tipo: 'encofrado', datos: { elemento: 'viga', dims: [0.25, 0.5, 4], n: 2 } }, T);
  cerca(r.cantidad, (0.25 + 1) * 4 * 2);
});

test('rendimiento: HH, días y costo de acero', () => {
  const r = calcPartida({ tipo: 'acero', cuadrillas: 2, datos: { n: 1, barras: [{ diam: '1/2', cant: 100, long: 5.03, ganchos: 0, traslapes: 0 }] } }, T);
  cerca(r.cantidad, 500, 0.1);
  const R = r.rendimiento;
  cerca(R.hh.operario, (8 / 250) * r.cantidad);
  cerca(R.hhTotal, (8 * 2.1 / 250) * r.cantidad);
  cerca(R.dias, r.cantidad / 500);
  cerca(R.costo, (8 / 250) * r.cantidad * (0.1 * 32 + 29 + 23));
});

test('resumen suma cemento de varias partidas e informa errores', () => {
  const s = resumenProyecto([
    { tipo: 'concreto', datos: { elemento: 'zapata', dims: [1, 1, 1], n: 1, mezcla: '210' } },
    { tipo: 'concreto', datos: { elemento: 'zapata', dims: [1, 1, 1], n: 1, mezcla: '175' } },
    { tipo: 'concreto', datos: { elemento: 'zapata', dims: [1, 1, 1], n: 1, mezcla: '999' } },
  ], T);
  cerca(s.materiales.find((x) => x.clave === 'cemento').cantidad, (9.73 + 8.43) * 1.05);
  assert.equal(s.filas.filter((f) => f.error).length, 1);
});
