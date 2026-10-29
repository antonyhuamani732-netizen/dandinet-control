import { CATEGORIAS } from '../data/capeco.js';
import { num } from './util.js';

// HH por categoría = 8 h × n° de obreros de esa categoría / rendimiento × metrado.
// Días = metrado / (rendimiento × cuadrillas). El costo no depende de las cuadrillas.
export function calcRendimiento(cantidad, r, costoHH, { rend, cuadrillas } = {}) {
  const R = num(rend) || num(r.rend);
  if (!R) throw new Error('El rendimiento debe ser mayor que cero');
  const c = Math.max(1, num(cuadrillas) || 1);
  const hh = {};
  let hhTotal = 0;
  let costo = 0;
  for (const cat of CATEGORIAS) {
    hh[cat] = (8 * num(r[cat]) / R) * cantidad;
    hhTotal += hh[cat];
    costo += hh[cat] * num(costoHH[cat]);
  }
  return {
    rend: R,
    und: r.und,
    cuadrillas: c,
    hh,
    hhTotal,
    hhPorUnidad: cantidad ? hhTotal / cantidad : 0,
    dias: cantidad / (R * c),
    costo,
    costoUnitario: cantidad ? costo / cantidad : 0,
  };
}
