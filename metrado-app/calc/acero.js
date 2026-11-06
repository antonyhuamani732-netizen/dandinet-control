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

// ---------- barras medidas por apoyos ----------

export const APOYOS = {
  columna: 'Columna',
  zapata: 'Zapata / cimentación',
  viga_peraltada: 'Viga peraltada',
  viga_chata: 'Viga chata',
  placa: 'Placa / muro',
  continua: 'Continúa al otro tramo',
  traslape: 'Empalme por traslape',
  libre: 'Extremo libre (volado)',
  manual: 'Anclaje manual',
};

export const ZONAS = {
  corrido: 'Corrido (toda la luz)',
  izq: 'Bastón en apoyo izquierdo',
  der: 'Bastón en apoyo derecho',
  ambos: 'Bastones en ambos apoyos',
  centro: 'Bastón al centro',
};

// Lo que suma la barra en un extremo: tramo recto dentro del apoyo + gancho.
export function anclaje(ext = {}, D, rec) {
  const r = num(rec);
  const ancho = num(ext.ancho);
  switch (ext.apoyo) {
    case 'columna':
    case 'zapata':
    case 'viga_peraltada':
    case 'placa':
      return { recto: Math.max(0, ancho - r), gancho: D.gancho, aviso: '' };
    case 'viga_chata': {
      const cabe = Math.max(0, num(ext.alto) - 2 * r);
      const gancho = Math.min(D.gancho, cabe);
      return {
        recto: Math.max(0, ancho - r),
        gancho,
        aviso: gancho < D.gancho ? `En la viga chata el gancho se recorta a ${gancho.toFixed(2)} m (alto ${num(ext.alto).toFixed(2)} − 2 × rec).` : '',
      };
    }
    case 'continua': return { recto: ancho / 2, gancho: 0, aviso: '' };
    case 'traslape': return { recto: D.traslape, gancho: 0, aviso: '' };
    case 'libre': return { recto: -r, gancho: 0, aviso: '' };
    case 'manual': return { recto: num(ext.manual), gancho: 0, aviso: '' };
    default: return { recto: 0, gancho: 0, aviso: '' };
  }
}

const txtExt = (a, lado) => {
  const p = [];
  if (a.recto) p.push(`${a.recto.toFixed(2)} (${lado})`);
  if (a.gancho) p.push(`${a.gancho.toFixed(2)} (gancho ${lado})`);
  return p;
};

function barrasPorApoyos(it, D, T, ctx) {
  const luz = num(it.luz) || num(ctx.luz);
  if (!luz) throw new Error('Barras: indica la luz libre');
  const rec = it.rec ?? 0.04;
  const largo = it.frac === 'm' ? num(it.largo) : luz / (num(it.frac) || 3);
  const zona = it.zona || 'corrido';
  const cant = num(it.cant);
  const aI = anclaje(it.izq, D, rec);
  const aD = anclaje(it.der, D, rec);
  const avisos = [];
  const piezas = [];
  const tramos = []; // para dibujar: { x0, x1, izq, der }
  const desglose = [];
  const pieza = (base, extI, extD, x0, x1) => {
    const long = base + (extI ? extI.recto + extI.gancho : 0) + (extD ? extD.recto + extD.gancho : 0);
    desglose.push([`${base.toFixed(2)} (tramo)`, ...(extI ? txtExt(extI, 'izq') : []), ...(extD ? txtExt(extD, 'der') : [])].join(' + ') + ` = ${long.toFixed(2)} m`);
    piezas.push({ diam: it.diam, long, cant, uso: it.uso });
    tramos.push({ x0, x1, izq: extI, der: extD });
  };
  if (zona === 'corrido') pieza(luz, aI, aD, 0, luz);
  else if (zona === 'izq') pieza(largo, aI, null, 0, largo);
  else if (zona === 'der') pieza(largo, null, aD, luz - largo, luz);
  else if (zona === 'ambos') { pieza(largo, aI, null, 0, largo); pieza(largo, null, aD, luz - largo, luz); }
  else pieza(largo, null, null, (luz - largo) / 2, (luz + largo) / 2);
  if (zona !== 'centro' && zona !== 'der' && aI.aviso) avisos.push(aI.aviso);
  if (zona !== 'centro' && zona !== 'izq' && aD.aviso) avisos.push(aD.aviso);
  if (largo > luz + 1e-9) avisos.push('El bastón es más largo que la luz.');
  // ¿Dónde caería el empalme si la barra pasa la longitud comercial?
  const V = num(T.acero.longitudVarilla);
  const empalmes = [];
  for (const t of tramos) {
    const p = piezas[0];
    if (p && p.long > V + 1e-9) {
      const inicio = t.x0 - (t.izq ? t.izq.recto + t.izq.gancho : 0);
      empalmes.push({ x0: inicio + V - D.traslape, x1: inicio + V });
    }
  }
  const n = zona === 'ambos' ? 2 * cant : cant;
  return {
    piezas,
    info: `${n} × ${piezas.map((p) => p.long.toFixed(2)).join(' / ')} m`,
    desglose, avisos, tramos, empalmes, luz,
  };
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
    if (it.modo === 'apoyos') return barrasPorApoyos(it, D, T, planta);
    if (it.modo === 'total') {
      const long = num(it.long);
      return { piezas: [{ diam: it.diam, long, cant: num(it.cant), uso: it.uso }], info: `${num(it.cant)} × ${long.toFixed(2)} m (longitud total)` };
    }
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
    // Estribos dentro del nudo (altura de la viga que llega a la columna).
    const nudo = it.nudo?.incluir ? Math.ceil(num(it.nudo.alto ?? 0.4) / (num(it.nudo.sep) || 0.15) - 1e-9) : 0;
    const cant = pos.length + nudo;
    return {
      piezas: [{ diam: it.diam, long, cant, uso: it.uso || 'Estribos' }],
      info: `${cant} estribos de ${long.toFixed(2)} m${nudo ? ` (${nudo} en el nudo)` : ''}`,
      pos, long, cant, nudo,
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
