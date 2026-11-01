import { CATEGORIAS } from '../data/capeco.js';
import { TIPOS } from '../data/elementos.js';
import { calcElemento } from './elemento.js';
import { cortePorDiametro } from './corte.js';

export const claveSel = (el, clave) => `${el.id}:${clave}`;

// ¿Entra esta partida al resumen? sel = { excluidos: {id:clave: true}, modo: 'todo' | 'pendiente' }
export function seleccionada(el, clave, sel = {}) {
  const p = el.partidas[clave];
  if (el.oculto || !p || p.activa === false) return false;
  if (sel.excluidos?.[claveSel(el, clave)]) return false;
  if (sel.modo === 'pendiente' && p.ejecutado) return false;
  return true;
}

// Consolida materiales, varillas, HH, costo y días de lo seleccionado.
export function resumen(proyecto, T, sel = {}) {
  const materiales = new Map();
  const hh = Object.fromEntries(CATEGORIAS.map((c) => [c, 0]));
  const grupos = new Map();
  const piezas = [];
  const filas = [];
  let costo = 0;
  let dias = 0;
  for (const el of proyecto.elementos) {
    const res = calcElemento(el, T);
    for (const [clave, r] of Object.entries(res)) {
      if (!seleccionada(el, clave, sel)) continue;
      filas.push({ el, clave, r });
      if (r.error) continue;
      for (const m of r.materiales) {
        const prev = materiales.get(m.clave);
        if (prev) prev.cantidad += m.cantidad;
        else materiales.set(m.clave, { ...m });
      }
      if (r.armado) {
        const f = r.escalaAcero ?? 1;
        for (const p of r.armado.piezas) piezas.push({ ...p, cant: Math.ceil(p.cant * f - 1e-9) });
      }
      const gk = `${el.tipo}:${clave}`;
      const g = grupos.get(gk) || {
        tipo: el.tipo, clave, nombre: `${TIPOS[el.tipo].plural} · ${r.nombre}`, und: r.und, cantidad: 0, hh: 0, costo: 0, dias: 0, elementos: 0,
      };
      g.cantidad += r.cantidad;
      g.elementos += 1;
      if (r.rendimiento) {
        for (const c of CATEGORIAS) hh[c] += r.rendimiento.hh[c];
        costo += r.rendimiento.costo;
        dias += r.rendimiento.dias;
        g.hh += r.rendimiento.hhTotal;
        g.costo += r.rendimiento.costo;
        g.dias += r.rendimiento.dias;
      }
      grupos.set(gk, g);
    }
  }
  const corte = cortePorDiametro(piezas, T);
  return { filas, materiales: [...materiales.values()], hh, costo, dias, grupos: [...grupos.values()], corte };
}
