import { TIPOS, PARTIDAS, medidas } from '../data/elementos.js';
import { ACCESORIOS } from '../data/capeco.js';
import { calcConcreto } from './concreto.js';
import { calcEncofrado } from './encofrado.js';
import { calcArmado } from './acero.js';
import { cortePorDiametro } from './corte.js';
import { calcMuro } from './muros.js';
import { calcRendimiento } from './rendimiento.js';
import { mat, num } from './util.js';

export const esFijo = (p) => p.fijo !== null && p.fijo !== undefined && p.fijo !== '';

function calcular(clave, el, p, T) {
  const t = TIPOS[el.tipo];
  const m = medidas(el);
  const n = num(el.n) || 1;
  if (clave === 'concreto') {
    return calcConcreto({ elemento: el.tipo, dims: t.conc(m), n, mezcla: el.mezcla, peralte: el.peralte }, T);
  }
  if (clave === 'encofrado') {
    const r = calcEncofrado({ elemento: el.tipo, dims: t.enc(m), n }, T);
    const acc = T.accesorios[el.tipo] || {};
    const usos = Math.max(1, num(p.usos) || 1);
    for (const [k, def] of Object.entries(ACCESORIOS)) {
      const c = num(acc[k]);
      if (c > 0) r.materiales.push(mat(`acc_${k}`, def.nombre, def.und, r.cantidad * c / usos));
    }
    if (usos > 1) r.detalle = `Accesorios para 1 de ${usos} reúsos del juego`;
    return r;
  }
  if (clave === 'acero') {
    const a = calcArmado(p.armado, n, T, t.planta ? t.planta(m) : {});
    const corte = cortePorDiametro(a.piezas, T);
    const f = 1 + num(T.acero.desperdicio) / 100;
    const materiales = [];
    for (const [diam, kg] of Object.entries(a.kgPorDiam)) {
      materiales.push(mat(`acero_${diam}`, `Acero corrugado ${T.acero.diametros[diam].nombre}`, 'kg', kg * f));
    }
    materiales.push(mat('alambre16', 'Alambre negro N°16', 'kg', a.kg * f * num(T.acero.alambrePorKg)));
    return { cantidad: a.kg, und: 'kg', materiales, detalle: '', rendKey: 'acero', armado: a, corte };
  }
  if (clave === 'muro') {
    return calcMuro({ ...p, largo: m.L, alto: m.H, n }, T);
  }
  if (clave === 'manual') {
    const cant = num(p.cantidad) * n;
    return {
      cantidad: cant,
      und: p.und || 'und',
      materiales: (p.materiales || []).filter((x) => x.nombre).map((x, i) => mat(`man_${x.nombre.toLowerCase()}`, x.nombre, x.und || 'und', cant * num(x.porUnidad))),
      detalle: '',
      rendKey: null,
    };
  }
  throw new Error(`Partida desconocida: ${clave}`);
}

// Resultado de una partida del elemento (aunque esté inactiva).
export function calcPartidaElemento(el, clave, T) {
  const p = el.partidas[clave];
  const base = { clave, nombre: PARTIDAS[clave].nombre, activa: p.activa !== false, ejecutado: !!p.ejecutado };
  let r;
  try {
    r = calcular(clave, el, p, T);
  } catch (e) {
    return { ...base, error: e.message, cantidad: 0, materiales: [], und: PARTIDAS[clave].und };
  }
  r.calculado = r.cantidad;
  if (esFijo(p) && clave !== 'manual') {
    const fijo = num(p.fijo);
    const f = r.cantidad > 0 ? fijo / r.cantidad : 0;
    r.materiales = r.materiales.map((x) => ({ ...x, cantidad: x.cantidad * f }));
    if (r.armado) r.escalaAcero = f;
    r.cantidad = fijo;
    r.fijo = true;
    if (!f && fijo) r.aviso = 'Ingresa medidas para calcular materiales por unidad';
  }
  let tabla = r.rendKey ? T.rendimientos[r.rendKey] : null;
  if (clave === 'manual') {
    tabla = { nombre: el.nombre, und: r.und, rend: num(p.rend), ...(p.cuadrilla || {}) };
  }
  if (tabla) {
    try {
      r.rendimiento = calcRendimiento(r.cantidad, tabla, T.costoHH, {
        rend: clave === 'manual' ? undefined : p.rend,
        cuadrillas: p.cuadrillas,
        cuadrilla: clave === 'manual' ? null : p.cuadrilla,
      });
    } catch (e) {
      r.rendimiento = null;
      r.aviso = e.message;
    }
  }
  return { ...base, ...r };
}

export function calcElemento(el, T) {
  const out = {};
  for (const clave of Object.keys(el.partidas)) out[clave] = calcPartidaElemento(el, clave, T);
  return out;
}

// Clave de la tabla de rendimientos para una partida de un elemento.
export function claveRendimiento(el, clave) {
  if (clave === 'concreto' || clave === 'encofrado') return `${clave}.${el.tipo}`;
  if (clave === 'acero') return 'acero';
  if (clave === 'muro') return `muro.${el.partidas.muro.aparejo}`;
  return null;
}
