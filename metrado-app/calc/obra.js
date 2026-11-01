import { CATEGORIAS } from '../data/capeco.js';
import { num } from './util.js';

const personasTotal = (p) => CATEGORIAS.reduce((s, c) => s + num(p?.[c]), 0);

// Un registro: cantidad hecha en `horas` con `personas` por categoría.
export function rendimientoRegistro(r) {
  const cant = num(r.cantidad);
  const horas = num(r.horas);
  const gente = personasTotal(r.personas);
  if (!cant || !horas || !gente) return null;
  return {
    porDia: (cant * 8) / horas, // con esa misma cuadrilla
    hhPorUnidad: (gente * horas) / cant,
    personas: gente,
  };
}

// Promedio ponderado de varios registros + comparación con la tabla CAPECO.
export function resumenObra(registros, tabla) {
  let cant = 0;
  let hh = 0;
  let horas = 0;
  const crewHoras = Object.fromEntries(CATEGORIAS.map((c) => [c, 0]));
  for (const r of registros) {
    if (!rendimientoRegistro(r)) continue;
    cant += num(r.cantidad);
    hh += personasTotal(r.personas) * num(r.horas);
    horas += num(r.horas);
    for (const c of CATEGORIAS) crewHoras[c] += num(r.personas?.[c]) * num(r.horas);
  }
  if (!cant || !horas) return null;
  const cuadrilla = Object.fromEntries(CATEGORIAS.map((c) => [c, Math.round((crewHoras[c] / horas) * 100) / 100]));
  const gente = personasTotal(cuadrilla);
  const hhPorUnidad = hh / cant;
  const out = {
    cantidad: cant,
    hh,
    hhPorUnidad,
    cuadrilla,
    // rendimiento por día equivalente con la cuadrilla promedio
    rend: gente ? (8 * gente) / hhPorUnidad : 0,
  };
  if (tabla && num(tabla.rend)) {
    const hhCapeco = (8 * personasTotal(tabla)) / num(tabla.rend);
    out.hhCapeco = hhCapeco;
    out.eficiencia = (hhCapeco / hhPorUnidad) * 100;
  }
  return out;
}

// Días para hacer `cantidad` con `personas` trabajando `horasDia` según HH/und.
export function diasConCuadrilla(cantidad, hhPorUnidad, personas, horasDia = 8) {
  const p = num(personas);
  if (!p || !num(horasDia)) return 0;
  return (num(cantidad) * num(hhPorUnidad)) / (p * num(horasDia));
}
