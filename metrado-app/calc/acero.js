import { num } from './util.js';

// Cuenta estribos de una distribución tipo "1@.05, 4@.10, r@.25" aplicada en ambos
// extremos de un elemento de longitud libre `largo`.
export function contarEstribos(distribucion, largo) {
  const tramos = String(distribucion || '')
    .split(/[,;]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .map((t) => {
      const [cant, sep] = t.split('@').map((x) => x.trim());
      if (sep === undefined) throw new Error(`Tramo inválido "${t}". Usa el formato 4@.10`);
      return { resto: /^r/.test(cant), cant: num(cant), sep: num(sep) };
    });
  let fijos = 0;
  let ocupado = 0;
  let resto = null;
  for (const t of tramos) {
    if (t.resto) resto = t.sep;
    else {
      fijos += t.cant;
      ocupado += t.cant * t.sep;
    }
  }
  const libre = num(largo) - 2 * ocupado;
  let centrales = 0;
  if (resto > 0 && libre > 0) centrales = Math.max(0, Math.ceil(libre / resto - 1e-9) - 1);
  if (libre < 0) throw new Error('La distribución de estribos excede la longitud del elemento');
  return 2 * fijos + centrales;
}

export function longitudEstribo(b, h, rec, ganchoEstribo) {
  return 2 * (num(b) - 2 * num(rec)) + 2 * (num(h) - 2 * num(rec)) + 2 * num(ganchoEstribo);
}

// ---------- armado por ítems (v2) ----------

// Posiciones (m desde un extremo) de estribos con tramos [{n, s}] en cada extremo y
// el resto a `resto` en el centro.
export function posicionesEstribos(tramos, resto, largo) {
  const L = num(largo);
  const izq = [];
  let x = 0;
  for (const t of tramos || []) {
    for (let i = 0; i < num(t.n); i++) {
      x += num(t.s);
      izq.push(x);
    }
  }
  const ocupado = x;
  const libre = L - 2 * ocupado;
  if (libre < -1e-9) throw new Error('Los tramos de estribos exceden la longitud del elemento');
  const centro = [];
  const r = num(resto);
  if (r > 0 && libre > 0) {
    const k = Math.max(0, Math.ceil(libre / r - 1e-9) - 1);
    const paso = libre / (k + 1);
    for (let i = 1; i <= k; i++) centro.push(ocupado + i * paso);
  }
  const der = izq.map((p) => L - p).reverse();
  return [...izq, ...centro, ...der];
}

export function tramosATexto(tramos, resto) {
  const partes = (tramos || []).filter((t) => num(t.n) > 0).map((t) => `${num(t.n)}@${fmtM(t.s)}`);
  if (num(resto) > 0) partes.push(`r@${fmtM(resto)}`);
  return partes.join(', ');
}

function fmtM(x) {
  return String(num(x)).replace(/^0\./, '.');
}

// Devuelve las piezas de un ítem para UN elemento: [{diam, long, cant, uso}] y datos extra.
export function piezasItem(it, T, planta = {}) {
  const D = T.acero.diametros[it.diam];
  if (!D) return { piezas: [], info: '' };
  if (it.tipo === 'barras') {
    const long = num(it.long) + num(it.ganchos) * D.gancho + num(it.traslapes) * D.traslape;
    return { piezas: [{ diam: it.diam, long, cant: num(it.cant), uso: it.uso }], info: `${num(it.cant)} × ${long.toFixed(2)} m` };
  }
  if (it.tipo === 'malla') {
    const X = num(it.largoX ?? planta.X);
    const Y = num(it.largoY ?? planta.Y);
    const rec = num(it.rec);
    const sep = num(it.sep);
    if (!sep) throw new Error(`Malla ${it.uso || ''}: el espaciamiento debe ser mayor que cero`);
    const [lb, ancho] = it.dir === 'Y' ? [Y, X] : [X, Y];
    const cant = Math.floor((ancho - 2 * rec) / sep + 1e-9) + 1;
    const long = lb - 2 * rec + num(it.ganchos) * D.gancho;
    if (cant <= 0 || long <= 0) throw new Error(`Malla ${it.uso || ''}: revisa medidas y recubrimiento`);
    const capas = num(it.capas) || 1;
    return {
      piezas: [{ diam: it.diam, long, cant: cant * capas, uso: it.uso }],
      info: `${cant} barras${capas > 1 ? ` × ${capas} capas` : ''} de ${long.toFixed(2)} m`,
      cant, long,
    };
  }
  if (it.tipo === 'estribos') {
    const pos = posicionesEstribos(it.tramos, it.resto, it.long);
    const long = longitudEstribo(it.b, it.h, it.rec, D.ganchoEstribo);
    if (long <= 0) throw new Error('Estribo: revisa la sección y el recubrimiento');
    return {
      piezas: [{ diam: it.diam, long, cant: pos.length, uso: it.uso || 'Estribos' }],
      info: `${pos.length} estribos de ${long.toFixed(2)} m`,
      pos, long, cant: pos.length,
      interior: { b: num(it.b) - 2 * num(it.rec), h: num(it.h) - 2 * num(it.rec), gancho: D.ganchoEstribo },
    };
  }
  return { piezas: [], info: '' };
}

// Armado completo de un elemento repetido n veces.
export function calcArmado(items, n, T, planta) {
  const piezas = [];
  const detalle = [];
  for (const it of items || []) {
    const r = piezasItem(it, T, planta);
    detalle.push({ it, ...r });
    for (const p of r.piezas) piezas.push({ ...p, cant: p.cant * n });
  }
  const kgPorDiam = {};
  let kg = 0;
  for (const p of piezas) {
    const k = p.long * p.cant * T.acero.diametros[p.diam].kgm;
    kgPorDiam[p.diam] = (kgPorDiam[p.diam] || 0) + k;
    kg += k;
  }
  return { piezas, detalle, kgPorDiam, kg };
}
