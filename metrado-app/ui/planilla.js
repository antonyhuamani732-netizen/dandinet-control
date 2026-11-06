// Planillas al estilo CAPECO: metrados por partida y planilla de acero por diámetro.
import { TIPOS, medidas } from '../data/elementos.js';
import { calcPartidaElemento, esFijo, varillasPorPeso } from '../calc/elemento.js';
import { cortePorDiametro } from '../calc/corte.js';
import { num } from '../calc/util.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f = (n, d = 2) => (Number.isFinite(n) && n !== 0 ? n.toLocaleString('es-PE', { minimumFractionDigits: d, maximumFractionDigits: d }) : '');

// Subcapítulos de estructuras como en el presupuesto CAPECO.
const CAPITULO = {
  cimiento: 'OE.2.2', sobrecimiento: 'OE.2.2',
  zapata: 'OE.2.3', columna: 'OE.2.3', viga: 'OE.2.3', placa: 'OE.2.3', losa_maciza: 'OE.2.3', losa_aligerada: 'OE.2.3', escalera: 'OE.2.3',
  muro: 'OE.3.1', manual: 'OE.X',
};
const NOMBRE_CAP = { 'OE.2.2': 'Obras de concreto simple', 'OE.2.3': 'Obras de concreto armado', 'OE.3.1': 'Muros y tabiques de albañilería', 'OE.X': 'Otras partidas' };
const NOMBRE_PARTIDA = {
  concreto: (el, T) => (el.mezcla === 'ciclopeo' ? `Concreto ${T.concreto.ciclopeo[el.tipo]?.nombre || 'ciclópeo'}` : `Concreto f'c = ${el.mezcla} kg/cm²`),
  encofrado: () => 'Encofrado y desencofrado',
  acero: () => 'Acero de refuerzo fy = 4200 kg/cm²',
  muro: (el, T) => `Muro de ${T.ladrillos[el.partidas.muro.ladrillo]?.nombre || 'ladrillo'} en ${el.partidas.muro.aparejo}`,
  manual: (el) => el.nombre,
};

// Filas de la planilla de metrados agrupadas por capítulo → tipo → partida.
export function filasMetrado(proyecto, T) {
  const caps = new Map();
  for (const el of proyecto.elementos) {
    if (el.oculto) continue;
    const cap = CAPITULO[el.tipo] || 'OE.X';
    for (const c of Object.keys(el.partidas)) {
      const p = el.partidas[c];
      if (p.activa === false) continue;
      const r = calcPartidaElemento(el, c, T);
      if (!caps.has(cap)) caps.set(cap, new Map());
      const tipos = caps.get(cap);
      if (!tipos.has(el.tipo)) tipos.set(el.tipo, new Map());
      const partidas = tipos.get(el.tipo);
      const k = `${c}:${c === 'concreto' ? el.mezcla : ''}:${c === 'manual' ? el.id : ''}`;
      if (!partidas.has(k)) partidas.set(k, { nombre: NOMBRE_PARTIDA[c](el, T), und: r.und, filas: [], total: 0 });
      const g = partidas.get(k);
      const dims = dimsFila(el, c, p);
      g.filas.push({ el, clave: c, r, ...dims });
      if (!r.error) g.total += r.cantidad;
    }
  }
  return caps;
}

function dimsFila(el, c, p) {
  if (esFijo(p) && c !== 'manual') return { nota: 'metrado fijo' };
  const t = TIPOS[el.tipo];
  const m = medidas(el);
  if (c === 'concreto') {
    if (el.tipo === 'losa_aligerada') return { largo: num(m.A), ancho: num(m.B), nota: `h = ${el.peralte} cm` };
    if (el.tipo === 'escalera') return { nota: 'garganta + pasos' };
    const [a, b, h] = t.conc(m).map(num);
    return { largo: a, ancho: b, alto: h };
  }
  if (c === 'muro') {
    const v = (p.vanos || []).length;
    return { largo: num(m.L), alto: num(m.H), nota: v ? `descuenta ${v} vano${v > 1 ? 's' : ''}` : '' };
  }
  if (c === 'encofrado') return { nota: { zapata: 'perímetro × h', columna: 'perímetro × H', viga: `${el.clase || ''}`, sobrecimiento: '2 caras', placa: '2 caras' }[el.tipo] || 'área de fondo' };
  if (c === 'acero') return { nota: 'ver planilla de acero' };
  return {};
}

export function planillaMetradosHTML(proyecto, T) {
  const caps = filasMetrado(proyecto, T);
  let filas = '';
  let iCap = 0;
  for (const [cap, tipos] of [...caps].sort(([a], [b]) => a.localeCompare(b))) {
    filas += `<tr class="pl-cap"><td>${esc(cap)}</td><td colspan="8">${esc(NOMBRE_CAP[cap]).toUpperCase()}</td></tr>`;
    iCap++;
    let iTipo = 0;
    for (const [tipo, partidas] of tipos) {
      iTipo++;
      filas += `<tr class="pl-tipo"><td>${esc(cap)}.${iTipo}</td><td colspan="8">${esc(TIPOS[tipo].plural).toUpperCase()}</td></tr>`;
      let iP = 0;
      for (const g of partidas.values()) {
        iP++;
        filas += `<tr class="pl-partida"><td>${esc(cap)}.${iTipo}.${iP}</td><td>${esc(g.nombre)}</td><td>${esc(g.und)}</td><td colspan="5"></td><td class="n">${f(g.total)}</td></tr>`;
        for (const x of g.filas) {
          filas += `<tr><td></td><td class="pl-desc">${esc(x.el.nombre)}${x.nota ? ` <small>(${esc(x.nota)})</small>` : ''}${x.r.error ? ` <small class="error">${esc(x.r.error)}</small>` : ''}</td><td></td>
            <td class="n">${f(num(x.el.n), 0)}</td><td class="n">${f(x.largo)}</td><td class="n">${f(x.ancho)}</td><td class="n">${f(x.alto)}</td>
            <td class="n">${f(x.r.cantidad)}</td><td></td></tr>`;
        }
      }
    }
  }
  if (!filas) return '<p class="vacio">No hay partidas activas.</p>';
  return `<div class="tabla-scroll planilla"><table class="tabla pl">
    <thead><tr><th>Ítem</th><th>Descripción</th><th>Und</th><th class="n">N° veces</th><th class="n">Largo</th><th class="n">Ancho</th><th class="n">Alto</th><th class="n">Parcial</th><th class="n">Total</th></tr></thead>
    <tbody>${filas}</tbody></table></div>`;
}

// Planilla de acero: una fila por pieza, columnas de longitud por diámetro.
export function datosAcero(proyecto, T) {
  const D = T.acero.diametros;
  const usados = new Set();
  const bloques = [];
  const piezas = [];
  const kgPorDiam = {};
  for (const el of proyecto.elementos) {
    const p = el.partidas.acero;
    if (el.oculto || !p || p.activa === false) continue;
    const r = calcPartidaElemento(el, 'acero', T);
    if (r.error || !r.armado) { bloques.push({ el, error: r.error }); continue; }
    const n = num(el.n) || 1;
    const filas = [];
    for (const d of r.armado.detalle) {
      for (const pz of d.piezas) {
        usados.add(pz.diam);
        const longTotal = pz.long * pz.cant * n;
        const kg = longTotal * D[pz.diam].kgm;
        filas.push({ uso: d.it.uso || pz.uso, diam: pz.diam, cant: pz.cant, n, long: pz.long, longTotal, kg });
        piezas.push({ diam: pz.diam, long: pz.long, cant: pz.cant * n });
        kgPorDiam[pz.diam] = (kgPorDiam[pz.diam] || 0) + kg;
      }
    }
    bloques.push({ el, filas, kg: filas.reduce((s, x) => s + x.kg, 0) });
  }
  const orden = Object.keys(D).filter((k) => usados.has(k));
  return { bloques, orden, kgPorDiam, varillasPeso: varillasPorPeso(kgPorDiam, T), corte: cortePorDiametro(piezas, T) };
}

export function planillaAceroHTML(proyecto, T) {
  const D = T.acero.diametros;
  const a = datosAcero(proyecto, T);
  if (!a.bloques.length) return '<p class="vacio">No hay partidas de acero.</p>';
  const cols = a.orden;
  const totLong = Object.fromEntries(cols.map((k) => [k, 0]));
  let filas = '';
  for (const b of a.bloques) {
    filas += `<tr class="pl-tipo"><td colspan="${5 + cols.length + 1}">${esc(b.el.nombre)}${num(b.el.n) > 1 ? ` × ${num(b.el.n)}` : ''}${b.error ? ` <small class="error">${esc(b.error)}</small>` : ''}<span class="pl-kg">${b.kg ? `${f(b.kg)} kg` : ''}</span></td></tr>`;
    for (const x of b.filas || []) {
      totLong[x.diam] += x.longTotal;
      filas += `<tr><td class="pl-desc">${esc(x.uso)}</td><td>${esc(D[x.diam].nombre)}</td><td class="n">${f(x.cant, 0)}</td><td class="n">${f(x.n, 0)}</td><td class="n">${f(x.long, 3)}</td>
        ${cols.map((k) => `<td class="n">${k === x.diam ? f(x.longTotal) : ''}</td>`).join('')}<td class="n">${f(x.kg)}</td></tr>`;
    }
  }
  const pie = (titulo, fn, cls = '') => `<tr class="pl-pie ${cls}"><td colspan="5">${titulo}</td>${cols.map((k) => `<td class="n">${fn(k)}</td>`).join('')}<td></td></tr>`;
  const kgTotal = Object.values(a.kgPorDiam).reduce((s, x) => s + x, 0);
  const V = num(T.acero.longitudVarilla);
  return `<div class="tabla-scroll planilla"><table class="tabla pl">
    <thead><tr><th>Descripción</th><th>Ø</th><th class="n">N° piezas</th><th class="n">N° elem.</th><th class="n">Long. (m)</th>
      ${cols.map((k) => `<th class="n">${esc(D[k].nombre)}</th>`).join('')}<th class="n">Peso (kg)</th></tr></thead>
    <tbody>${filas}</tbody>
    <tfoot>
      ${pie('Longitud total (m)', (k) => f(totLong[k]))}
      ${pie('Peso por metro (kg/m)', (k) => f(D[k].kgm, 3))}
      ${pie('Peso total (kg)', (k) => f(a.kgPorDiam[k]), 'fuerte')}
      ${pie(`Varillas de ${V} m: por peso + ${f(num(T.acero.despPeso), 0)} %`, (k) => a.varillasPeso[k], 'fuerte')}
      ${pie(`Varillas de ${V} m: por corte optimizado`, (k) => `${a.corte[k].varillas} <small>(${f(a.corte[k].desperdicio, 1)} %)</small>`)}
    </tfoot></table></div>
    <p class="nota">Peso total: <b>${f(kgTotal)} kg</b>. "Por peso + %" = REDONDEAR.MAS(kg ÷ (kg/m × ${V}) × (1 + %)), como en una hoja de cálculo. "Por corte" agrupa las piezas reales en varillas de ${V} m y parte las de más de ${V} m con traslape.</p>`;
}

// CSV (separado por punto y coma, abre en Excel en español).
export function csvPlanillas(proyecto, T) {
  const q = (t) => `"${String(t ?? '').replace(/"/g, '""')}"`;
  const n = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : '');
  const L = [[q(`PLANILLA DE METRADOS · ${proyecto.nombre}`)], ['Item', 'Descripcion', 'Und', 'N veces', 'Largo', 'Ancho', 'Alto', 'Parcial', 'Total'].map(q)];
  const caps = filasMetrado(proyecto, T);
  for (const [cap, tipos] of [...caps].sort(([a], [b]) => a.localeCompare(b))) {
    L.push([q(cap), q(NOMBRE_CAP[cap])]);
    let iT = 0;
    for (const [tipo, partidas] of tipos) {
      iT++;
      L.push([q(`${cap}.${iT}`), q(TIPOS[tipo].plural)]);
      let iP = 0;
      for (const g of partidas.values()) {
        iP++;
        L.push([q(`${cap}.${iT}.${iP}`), q(g.nombre), q(g.und), '', '', '', '', '', n(g.total)]);
        for (const x of g.filas) L.push(['', q(x.el.nombre), '', n(num(x.el.n), 0), n(x.largo), n(x.ancho), n(x.alto), n(x.r.cantidad), '']);
      }
    }
  }
  const a = datosAcero(proyecto, T);
  const D = T.acero.diametros;
  L.push([], [q(`PLANILLA DE ACERO · ${proyecto.nombre}`)], ['Elemento', 'Descripcion', 'Diametro', 'N piezas', 'N elem', 'Long', ...a.orden.map((k) => `Long ${D[k].nombre}`), 'Peso kg'].map(q));
  for (const b of a.bloques) {
    for (const x of b.filas || []) {
      L.push([q(b.el.nombre), q(x.uso), q(D[x.diam].nombre), x.cant, x.n, n(x.long), ...a.orden.map((k) => (k === x.diam ? n(x.longTotal) : '')), n(x.kg)]);
    }
  }
  L.push(['', q('Peso total kg'), '', '', '', '', ...a.orden.map((k) => n(a.kgPorDiam[k])), '']);
  L.push(['', q('Varillas por peso + %'), '', '', '', '', ...a.orden.map((k) => a.varillasPeso[k]), '']);
  L.push(['', q('Varillas por corte'), '', '', '', '', ...a.orden.map((k) => a.corte[k].varillas), '']);
  return `﻿${L.map((r) => r.join(';')).join('\r\n')}`;
}

