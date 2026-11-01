import { num } from './util.js';

// Parte una pieza más larga que la varilla en tramos con traslape.
export function partir(long, varilla, traslape) {
  const out = [];
  let resto = long;
  while (resto > varilla + 1e-9) {
    out.push(varilla);
    resto -= varilla - traslape;
  }
  out.push(resto);
  return out;
}

// Despiece de piezas [{long, cant}] de un diámetro en varillas comerciales (primero el más largo).
export function optimizarCorte(piezas, varilla = 9, traslape = 0.5) {
  const V = num(varilla);
  const lista = [];
  for (const p of piezas) {
    const tramos = partir(num(p.long), V, num(traslape));
    for (let i = 0; i < num(p.cant); i++) lista.push(...tramos);
  }
  lista.sort((a, b) => b - a);
  const barras = []; // { libre, cortes: [] }
  for (const l of lista) {
    if (l <= 0) continue;
    let b = null;
    for (const x of barras) if (x.libre >= l - 1e-9) { b = x; break; }
    if (!b) { b = { libre: V, cortes: [] }; barras.push(b); }
    b.cortes.push(l);
    b.libre -= l;
  }
  // Agrupa patrones iguales
  const patrones = new Map();
  for (const b of barras) {
    const clave = b.cortes.map((c) => c.toFixed(2)).join('+');
    const p = patrones.get(clave) || { veces: 0, cortes: b.cortes, sobra: b.libre };
    p.veces++;
    patrones.set(clave, p);
  }
  const usado = lista.reduce((s, l) => s + l, 0);
  const total = barras.length * V;
  return {
    varillas: barras.length,
    usado,
    desperdicio: total ? (total - usado) / total * 100 : 0,
    patrones: [...patrones.values()].sort((a, b) => b.veces - a.veces),
  };
}

export function textoPatron(p) {
  const cuenta = new Map();
  for (const c of p.cortes) cuenta.set(c.toFixed(2), (cuenta.get(c.toFixed(2)) || 0) + 1);
  const partes = [...cuenta].map(([l, k]) => `${k} × ${l} m`);
  return `${partes.join(' + ')} (sobra ${p.sobra.toFixed(2)} m)`;
}

// Corte para todas las piezas agrupadas por diámetro.
export function cortePorDiametro(piezas, T) {
  const por = {};
  for (const p of piezas) (por[p.diam] ||= []).push(p);
  const out = {};
  for (const [diam, ps] of Object.entries(por)) {
    out[diam] = optimizarCorte(ps, T.acero.longitudVarilla, T.acero.diametros[diam].traslape);
  }
  return out;
}
