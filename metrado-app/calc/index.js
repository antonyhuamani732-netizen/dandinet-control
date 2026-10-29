import { calcConcreto } from './concreto.js';
import { calcAcero } from './acero.js';
import { calcEncofrado } from './encofrado.js';
import { calcMuro } from './muros.js';
import { calcRendimiento } from './rendimiento.js';

const CALC = { concreto: calcConcreto, acero: calcAcero, encofrado: calcEncofrado, muro: calcMuro };

export function calcPartida(p, T) {
  const fn = CALC[p.tipo];
  if (!fn) throw new Error(`Tipo de partida desconocido: ${p.tipo}`);
  const r = fn(p.datos, T);
  const tabla = T.rendimientos[r.rendKey];
  r.rendimiento = tabla
    ? calcRendimiento(r.cantidad, tabla, T.costoHH, { rend: p.rend, cuadrillas: p.cuadrillas })
    : null;
  return r;
}

// Consolida materiales, HH, costo y días de todas las partidas de un proyecto.
export function resumenProyecto(partidas, T) {
  const materiales = new Map();
  const hh = { capataz: 0, operario: 0, oficial: 0, peon: 0 };
  let costo = 0;
  let dias = 0;
  const filas = [];
  for (const p of partidas) {
    let r;
    try { r = calcPartida(p, T); } catch (e) { filas.push({ p, error: e.message }); continue; }
    filas.push({ p, r });
    for (const m of r.materiales) {
      const prev = materiales.get(m.clave);
      if (prev) prev.cantidad += m.cantidad;
      else materiales.set(m.clave, { ...m });
    }
    if (r.rendimiento) {
      for (const k of Object.keys(hh)) hh[k] += r.rendimiento.hh[k];
      costo += r.rendimiento.costo;
      dias += r.rendimiento.dias;
    }
  }
  return { filas, materiales: [...materiales.values()], hh, costo, dias };
}
