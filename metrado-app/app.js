import {
  CATEGORIAS, NOMBRE_CATEGORIA, ELEMENTOS_CONCRETO, ELEMENTOS_ENCOFRADO,
} from './data/capeco.js';
import { calcPartida, resumenProyecto } from './calc/index.js';
import { num } from './calc/util.js';
import { cargar, guardar, uid, restaurarTablas, importar } from './storage.js';

const TIPOS = {
  concreto: { nombre: 'Concreto', und: 'm³' },
  acero: { nombre: 'Acero', und: 'kg' },
  encofrado: { nombre: 'Encofrado', und: 'm²' },
  muro: { nombre: 'Muro', und: 'm²' },
};

const APAREJOS = { soga: 'Soga', cabeza: 'Cabeza', canto: 'Canto' };

// ---------- utilidades ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 2) => (Number.isFinite(n) ? n : 0).toLocaleString('es-PE', { minimumFractionDigits: d, maximumFractionDigits: d });
const sol = (n) => `S/ ${fmt(n, 2)}`;

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj, path, val) {
  const ks = path.split('.');
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) {
    if (o[ks[i]] == null) o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {};
    o = o[ks[i]];
  }
  o[ks[ks.length - 1]] = val;
}

function aviso(texto) {
  const t = $('#aviso');
  t.textContent = texto;
  t.hidden = false;
  clearTimeout(aviso.timer);
  aviso.timer = setTimeout(() => { t.hidden = true; }, 2600);
}

// ---------- datos de ejemplo ----------
function nuevaPartida(tipo) {
  const base = { id: uid(), tipo, nombre: '', rend: '', cuadrillas: 1 };
  if (tipo === 'concreto') base.datos = { elemento: 'columna', dims: ['0.25', '0.25', '3.00'], n: 1, mezcla: '210', peralte: '20' };
  if (tipo === 'acero') {
    base.datos = {
      n: 1,
      barras: [{ diam: '1/2', cant: 4, long: 3, ganchos: 1, traslapes: 0 }],
      estribos: { diam: '3/8', b: 0.25, h: 0.25, rec: 0.04, long: 3, dist: '1@.05, 4@.10, r@.25' },
    };
  }
  if (tipo === 'encofrado') base.datos = { elemento: 'columna', dims: ['0.25', '0.25', '3.00'], n: 1 };
  if (tipo === 'muro') {
    base.datos = {
      ladrillo: 'kk18', ladPers: { L: 24, A: 13, H: 9 }, aparejo: 'soga', junta: 1.5, mortero: '1:4',
      largo: 5, alto: 2.6, n: 1, vanos: [],
    };
  }
  return base;
}

function proyectoEjemplo() {
  const P = (tipo, nombre, datos, extra = {}) => ({ ...nuevaPartida(tipo), nombre, datos, ...extra });
  return {
    id: uid(),
    nombre: 'Vivienda 1 piso (ejemplo)',
    creado: new Date().toISOString(),
    partidas: [
      P('concreto', 'Cimiento corrido', { elemento: 'cimiento', dims: ['32', '0.40', '0.80'], n: 1, mezcla: 'ciclopeo', peralte: '20' }),
      P('concreto', 'Zapatas Z-1', { elemento: 'zapata', dims: ['1.20', '1.20', '0.60'], n: 6, mezcla: '210', peralte: '20' }),
      P('concreto', 'Columnas C-1', { elemento: 'columna', dims: ['0.25', '0.25', '2.80'], n: 6, mezcla: '210', peralte: '20' }),
      P('acero', 'Acero columnas C-1', {
        n: 6,
        barras: [{ diam: '1/2', cant: 4, long: 3.4, ganchos: 1, traslapes: 0 }],
        estribos: { diam: '3/8', b: 0.25, h: 0.25, rec: 0.04, long: 2.8, dist: '1@.05, 4@.10, r@.25' },
      }),
      P('encofrado', 'Encofrado columnas C-1', { elemento: 'columna', dims: ['0.25', '0.25', '2.80'], n: 6 }),
      P('concreto', 'Vigas VP-101', { elemento: 'viga', dims: ['0.25', '0.40', '4.50'], n: 4, mezcla: '210', peralte: '20' }),
      P('concreto', 'Losa aligerada h = 20', { elemento: 'losa_aligerada', dims: ['8.00', '6.00'], n: 1, mezcla: '210', peralte: '20' }),
      P('muro', 'Muro eje A', {
        ladrillo: 'kk18', ladPers: { L: 24, A: 13, H: 9 }, aparejo: 'soga', junta: 1.5, mortero: '1:4',
        largo: 8, alto: 2.6, n: 1, vanos: [{ ancho: 0.9, alto: 2.1, cant: 1 }, { ancho: 1.2, alto: 1.0, cant: 2 }],
      }),
    ],
  };
}

// ---------- estado ----------
const S = cargar(proyectoEjemplo);
let vista = 'partidas';
let borrador = null; // partida en edición
let pendienteBorrar = null;

const proyecto = () => S.proyectos.find((p) => p.id === S.actual);
function persistir() {
  if (!guardar(S)) aviso('No se pudo guardar en este dispositivo');
}

// ---------- campos de formulario ----------
function campo(label, path, valor, opt = {}) {
  const id = `f-${path.replace(/\W/g, '-')}`;
  if (opt.opciones) {
    const ops = Object.entries(opt.opciones)
      .map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(valor) ? ' selected' : ''}>${esc(t)}</option>`)
      .join('');
    return `<label class="campo" for="${id}"><span>${esc(label)}</span><select id="${id}" data-k="${path}"${opt.rehacer ? ' data-rehacer' : ''}>${ops}</select></label>`;
  }
  const tipo = opt.texto ? 'text' : 'number';
  const extra = opt.texto ? '' : ' inputmode="decimal" step="any" min="0"';
  const ph = opt.placeholder != null ? ` placeholder="${esc(opt.placeholder)}"` : '';
  return `<label class="campo${opt.ancho ? ' ancho' : ''}" for="${id}"><span>${esc(label)}</span><input id="${id}" type="${tipo}"${extra}${ph} data-k="${path}" value="${esc(valor)}"></label>`;
}

function opcionesMezcla(elemento) {
  const o = {};
  if (ELEMENTOS_CONCRETO[elemento]?.ciclopeo) o.ciclopeo = `Ciclópeo ${S.tablas.concreto.ciclopeo[ELEMENTOS_CONCRETO[elemento].ciclopeo].nombre}`;
  for (const fc of Object.keys(S.tablas.concreto.fc)) o[fc] = `f'c = ${fc} kg/cm²`;
  return o;
}

function formDatos(p) {
  const d = p.datos;
  const T = S.tablas;
  if (p.tipo === 'concreto') {
    const el = ELEMENTOS_CONCRETO[d.elemento];
    const elems = Object.fromEntries(Object.entries(ELEMENTOS_CONCRETO).map(([k, v]) => [k, v.nombre]));
    let h = `<div class="rejilla">
      ${campo('Elemento', 'datos.elemento', d.elemento, { opciones: elems, rehacer: true })}
      ${campo('Concreto', 'datos.mezcla', d.mezcla, { opciones: opcionesMezcla(d.elemento) })}`;
    if (d.elemento === 'losa_aligerada') {
      const per = Object.fromEntries(Object.keys(T.aligerado).filter((k) => /^\d+$/.test(k)).map((k) => [k, `h = ${k} cm`]));
      h += campo('Peralte', 'datos.peralte', d.peralte, { opciones: per });
    }
    h += el.dims.map((lab, i) => campo(lab, `datos.dims.${i}`, d.dims[i] ?? '')).join('');
    h += campo('N° de elementos iguales', 'datos.n', d.n);
    return `${h}</div>`;
  }
  if (p.tipo === 'encofrado') {
    const el = ELEMENTOS_ENCOFRADO[d.elemento];
    const elems = Object.fromEntries(Object.entries(T.encofrado).map(([k, v]) => [k, v.nombre]));
    return `<div class="rejilla">
      ${campo('Elemento', 'datos.elemento', d.elemento, { opciones: elems, rehacer: true })}
      ${el.dims.map((lab, i) => campo(lab, `datos.dims.${i}`, d.dims[i] ?? '')).join('')}
      ${campo('N° de elementos iguales', 'datos.n', d.n)}
    </div><p class="nota">Área de contacto: ${esc(el.ayuda)}.</p>`;
  }
  if (p.tipo === 'acero') {
    const dia = Object.fromEntries(Object.entries(T.acero.diametros).map(([k, v]) => [k, v.nombre]));
    const barras = d.barras.map((b, i) => `
      <div class="fila-rep">
        <div class="rejilla">
          ${campo('Ø', `datos.barras.${i}.diam`, b.diam, { opciones: dia })}
          ${campo('N° barras', `datos.barras.${i}.cant`, b.cant)}
          ${campo('Longitud (m)', `datos.barras.${i}.long`, b.long)}
          ${campo('Ganchos', `datos.barras.${i}.ganchos`, b.ganchos, { opciones: { 0: 'Sin gancho', 1: '1 gancho', 2: '2 ganchos' } })}
          ${campo('Traslapes', `datos.barras.${i}.traslapes`, b.traslapes)}
        </div>
        <button type="button" class="quitar" data-quitar="barras.${i}" aria-label="Quitar barras">Quitar</button>
      </div>`).join('');
    const e = d.estribos || {};
    return `<div class="rejilla">${campo('N° de elementos iguales', 'datos.n', d.n)}</div>
      <h4>Acero longitudinal</h4>${barras}
      <button type="button" class="secundario" data-agregar="barras">Agregar barras</button>
      <h4>Estribos</h4>
      <div class="rejilla">
        ${campo('Ø estribo', 'datos.estribos.diam', e.diam || '', { opciones: { '': 'Sin estribos', ...dia }, rehacer: true })}
        ${e.diam ? `
        ${campo('Sección b (m)', 'datos.estribos.b', e.b)}
        ${campo('Sección h (m)', 'datos.estribos.h', e.h)}
        ${campo('Recubrimiento (m)', 'datos.estribos.rec', e.rec)}
        ${campo('Longitud libre (m)', 'datos.estribos.long', e.long)}
        ${campo('Distribución (en cada extremo)', 'datos.estribos.dist', e.dist, { texto: true, ancho: true, placeholder: '1@.05, 4@.10, r@.25' })}` : ''}
      </div>`;
  }
  if (p.tipo === 'muro') {
    const lad = Object.fromEntries(Object.entries(T.ladrillos).map(([k, v]) => [k, `${v.nombre} (${v.L}×${v.A}×${v.H})`]));
    lad.otro = 'Otro (medidas propias)';
    const mort = Object.fromEntries(Object.keys(T.mortero).map((k) => [k, `Mortero C:A ${k}`]));
    const vanos = d.vanos.map((v, i) => `
      <div class="fila-rep">
        <div class="rejilla">
          ${campo('Ancho (m)', `datos.vanos.${i}.ancho`, v.ancho)}
          ${campo('Alto (m)', `datos.vanos.${i}.alto`, v.alto)}
          ${campo('Cantidad', `datos.vanos.${i}.cant`, v.cant)}
        </div>
        <button type="button" class="quitar" data-quitar="vanos.${i}" aria-label="Quitar vano">Quitar</button>
      </div>`).join('');
    return `<div class="rejilla">
      ${campo('Ladrillo', 'datos.ladrillo', d.ladrillo, { opciones: lad, rehacer: true })}
      ${d.ladrillo === 'otro' ? `
        ${campo('Largo L (cm)', 'datos.ladPers.L', d.ladPers.L)}
        ${campo('Ancho A (cm)', 'datos.ladPers.A', d.ladPers.A)}
        ${campo('Alto H (cm)', 'datos.ladPers.H', d.ladPers.H)}` : ''}
      ${campo('Aparejo', 'datos.aparejo', d.aparejo, { opciones: APAREJOS, rehacer: true })}
      ${campo('Junta (cm)', 'datos.junta', d.junta)}
      ${campo('Mortero', 'datos.mortero', d.mortero, { opciones: mort })}
      ${campo('Largo del muro (m)', 'datos.largo', d.largo)}
      ${campo('Alto del muro (m)', 'datos.alto', d.alto)}
      ${campo('N° de muros iguales', 'datos.n', d.n)}
    </div>
    <h4>Vanos a descontar (puertas y ventanas)</h4>${vanos || '<p class="nota">Sin vanos.</p>'}
    <button type="button" class="secundario" data-agregar="vanos">Agregar vano</button>`;
  }
  return '';
}

// ---------- bloques de resultado ----------
function tablaMateriales(mats) {
  if (!mats.length) return '';
  return `<div class="tabla-scroll"><table class="tabla">
    <thead><tr><th>Material</th><th>Und</th><th class="n">Cantidad</th></tr></thead>
    <tbody>${mats.map((m) => `<tr><td>${esc(m.nombre)}</td><td>${esc(m.und)}</td><td class="n">${fmt(m.cantidad, m.und === 'und' ? 0 : 2)}</td></tr>`).join('')}</tbody>
  </table></div>`;
}

function bloqueRendimiento(R) {
  if (!R) return '<p class="nota">Sin rendimiento en la tabla para esta partida.</p>';
  const filas = CATEGORIAS.filter((c) => R.hh[c] > 0)
    .map((c) => `<tr><td>${NOMBRE_CATEGORIA[c]}</td><td class="n">${fmt(R.hh[c])}</td><td class="n">${sol(R.hh[c] * num(S.tablas.costoHH[c]))}</td></tr>`).join('');
  return `<div class="cifras">
      <div><span>Rendimiento</span><b>${fmt(R.rend)} ${esc(R.und)}/día</b></div>
      <div><span>Plazo</span><b>${fmt(R.dias, 1)} días</b><small>${R.cuadrillas} cuadrilla${R.cuadrillas > 1 ? 's' : ''}</small></div>
      <div><span>Mano de obra</span><b>${sol(R.costo)}</b><small>${sol(R.costoUnitario)} / ${esc(R.und)}</small></div>
    </div>
    <div class="tabla-scroll"><table class="tabla">
      <thead><tr><th>Categoría</th><th class="n">HH</th><th class="n">Costo</th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr><td>Total (${fmt(R.hhPorUnidad, 3)} HH/${esc(R.und)})</td><td class="n">${fmt(R.hhTotal)}</td><td class="n">${sol(R.costo)}</td></tr></tfoot>
    </table></div>`;
}

function resultadoHTML(p) {
  let r;
  try { r = calcPartida(p, S.tablas); } catch (e) { return `<p class="error">${esc(e.message)}</p>`; }
  return `<div class="metrado"><span>Metrado</span><b>${fmt(r.cantidad)} <small>${esc(r.und)}</small></b></div>
    ${r.detalle ? `<p class="nota">${esc(r.detalle)}</p>` : ''}
    <h4>Materiales</h4>${tablaMateriales(r.materiales)}
    <h4>Rendimiento y mano de obra</h4>${bloqueRendimiento(r.rendimiento)}`;
}

// ---------- vistas ----------
function vistaPartidas() {
  const pr = proyecto();
  if (!pr) return '<p class="vacio">Crea un proyecto en la pestaña Proyectos.</p>';
  const items = pr.partidas.map((p) => {
    let linea;
    try {
      const r = calcPartida(p, S.tablas);
      linea = `<b class="cant">${fmt(r.cantidad)} ${esc(r.und)}</b>
        <span class="meta">${r.rendimiento ? `${fmt(r.rendimiento.dias, 1)} d · ${sol(r.rendimiento.costo)}` : ''}</span>`;
    } catch (e) {
      linea = `<span class="error">${esc(e.message)}</span>`;
    }
    return `<li><button type="button" class="partida" data-editar="${p.id}">
      <span class="chip chip-${p.tipo}">${TIPOS[p.tipo].nombre}</span>
      <span class="nombre">${esc(p.nombre || 'Sin nombre')}</span>${linea}</button></li>`;
  }).join('');
  return `<div class="cab-vista"><h2>${esc(pr.nombre)}</h2><span class="cuenta">${pr.partidas.length} partidas</span></div>
    ${items ? `<ul class="lista">${items}</ul>` : '<p class="vacio">Aún no hay partidas. Agrega la primera con los botones de abajo.</p>'}
    <div class="agregar">
      <span>Agregar partida</span>
      <div class="botones-tipo">${Object.entries(TIPOS).map(([k, t]) => `<button type="button" data-nueva="${k}"><span class="chip chip-${k}"></span>${t.nombre}</button>`).join('')}</div>
    </div>`;
}

function formRend(p) {
  let rk;
  try { rk = calcPartida(p, S.tablas).rendKey; } catch { rk = null; }
  const rt = rk ? S.tablas.rendimientos[rk] : null;
  return `<div class="rejilla">
      ${campo(`Rendimiento propio${rt ? ` (${rt.und}/día)` : ''}`, 'rend', p.rend, { placeholder: rt ? `CAPECO: ${rt.rend}` : '' })}
      ${campo('N° de cuadrillas', 'cuadrillas', p.cuadrillas)}
    </div>
    ${rt ? `<p class="nota">Cuadrilla de ${esc(rt.nombre.toLowerCase())}: ${CATEGORIAS.filter((c) => rt[c]).map((c) => `${rt[c]} ${NOMBRE_CATEGORIA[c].toLowerCase()}`).join(' + ')}. Cámbiala en Tablas.</p>` : ''}`;
}

function vistaEditor() {
  const p = borrador;
  return `<form id="editor" class="editor" autocomplete="off">
    <div class="cab-vista"><h2><span class="chip chip-${p.tipo}">${TIPOS[p.tipo].nombre}</span> ${p.nombre ? esc(p.nombre) : 'Nueva partida'}</h2></div>
    <div class="rejilla">${campo('Nombre de la partida', 'nombre', p.nombre, { texto: true, ancho: true, placeholder: 'Ej. Columnas C-1, eje A' })}</div>
    <div id="form-datos">${formDatos(p)}</div>
    <h4>Rendimiento</h4>
    <div id="form-rend">${formRend(p)}</div>
    <section class="resultado" id="resultado" aria-live="polite">${resultadoHTML(p)}</section>
    <div class="acciones">
      <button type="submit" class="primario">Guardar partida</button>
      <button type="button" class="secundario" data-accion="cancelar">Cancelar</button>
      ${proyecto().partidas.some((x) => x.id === p.id) ? `<button type="button" class="peligro" data-accion="borrar-partida">${pendienteBorrar === p.id ? 'Toca otra vez para borrar' : 'Borrar'}</button>` : ''}
    </div>
  </form>`;
}

function varillas(m) {
  const diam = m.clave.slice('acero_'.length);
  const d = S.tablas.acero.diametros[diam];
  return d ? Math.ceil(m.cantidad / (d.kgm * num(S.tablas.acero.longitudVarilla)) - 1e-9) : 0;
}

function vistaResumen() {
  const pr = proyecto();
  if (!pr) return '<p class="vacio">No hay proyecto seleccionado.</p>';
  const s = resumenProyecto(pr.partidas, S.tablas);
  const orden = (m) => (m.clave.startsWith('acero') ? 1 : m.clave.startsWith('ladrillo') ? 2 : ['madera', 'clavos', 'alambre8'].includes(m.clave) ? 3 : 0);
  const mats = [...s.materiales].sort((a, b) => orden(a) - orden(b));
  const filasMat = mats.map((m) => `<tr><td>${esc(m.nombre)}</td><td>${esc(m.und)}</td><td class="n">${fmt(m.cantidad, m.und === 'und' ? 0 : 2)}</td>
    <td class="n">${m.clave.startsWith('acero_') ? `${varillas(m)} var.` : ''}</td></tr>`).join('');
  const hhTot = CATEGORIAS.reduce((a, c) => a + s.hh[c], 0);
  const filasHH = CATEGORIAS.filter((c) => s.hh[c] > 0).map((c) => `<tr><td>${NOMBRE_CATEGORIA[c]}</td><td class="n">${fmt(s.hh[c])}</td><td class="n">${sol(s.hh[c] * num(S.tablas.costoHH[c]))}</td></tr>`).join('');
  const porPartida = s.filas.map(({ p, r, error }) => `<tr><td>${esc(p.nombre || 'Sin nombre')}</td>
    ${error ? `<td colspan="4" class="error">${esc(error)}</td>` : `<td class="n">${fmt(r.cantidad)} ${esc(r.und)}</td>
    <td class="n">${r.rendimiento ? fmt(r.rendimiento.rend) : '–'}</td><td class="n">${r.rendimiento ? fmt(r.rendimiento.dias, 1) : '–'}</td><td class="n">${r.rendimiento ? sol(r.rendimiento.costo) : '–'}</td>`}</tr>`).join('');
  return `<div class="cab-vista"><h2>Resumen · ${esc(pr.nombre)}</h2></div>
    <div class="cifras grandes">
      <div><span>Cemento</span><b>${fmt(s.materiales.find((m) => m.clave === 'cemento')?.cantidad || 0, 1)} bls</b></div>
      <div><span>Mano de obra</span><b>${sol(s.costo)}</b><small>${fmt(hhTot, 1)} HH</small></div>
      <div><span>Plazo en serie</span><b>${fmt(s.dias, 1)} días</b><small>suma de partidas</small></div>
    </div>
    <h3>Materiales del proyecto</h3>
    ${mats.length ? `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Material</th><th>Und</th><th class="n">Cantidad</th><th class="n">Varillas ${esc(S.tablas.acero.longitudVarilla)} m</th></tr></thead><tbody>${filasMat}</tbody></table></div>` : '<p class="vacio">Sin materiales todavía.</p>'}
    <h3>Rendimiento por partida</h3>
    <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Partida</th><th class="n">Metrado</th><th class="n">Rend./día</th><th class="n">Días</th><th class="n">M.O.</th></tr></thead><tbody>${porPartida}</tbody></table></div>
    <h3>Horas-hombre</h3>
    <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Categoría</th><th class="n">HH</th><th class="n">Costo</th></tr></thead><tbody>${filasHH}</tbody>
    <tfoot><tr><td>Total</td><td class="n">${fmt(hhTot)}</td><td class="n">${sol(s.costo)}</td></tr></tfoot></table></div>
    <p class="nota">Cantidades con desperdicio incluido según Tablas. El plazo en serie asume que las partidas no se traslapan.</p>
    <div class="acciones">
      <button type="button" class="primario" data-accion="csv">Exportar a Excel (CSV)</button>
    </div>`;
}

function editorTabla(titulo, base, filas, cols, nombreFila = (k) => k) {
  const T = S.tablas;
  const obj = getPath(T, base);
  const cab = cols.map((c) => `<th class="n">${esc(c.label)}</th>`).join('');
  const cuerpo = filas.map((k) => `<tr><th scope="row">${esc(nombreFila(k, obj[k]))}</th>${cols.map((c) => {
    const path = `${base}.${k}.${c.k}`;
    return `<td><input aria-label="${esc(`${nombreFila(k, obj[k])} ${c.label}`)}" class="celda" type="number" inputmode="decimal" step="any" data-t="${esc(path)}" value="${esc(obj[k][c.k])}"></td>`;
  }).join('')}</tr>`).join('');
  return `<details class="seccion-tabla"><summary>${esc(titulo)}</summary>
    <div class="tabla-scroll"><table class="tabla editable"><thead><tr><th></th>${cab}</tr></thead><tbody>${cuerpo}</tbody></table></div></details>`;
}

function campoTabla(label, path) {
  return `<label class="campo"><span>${esc(label)}</span><input type="number" inputmode="decimal" step="any" data-t="${path}" value="${esc(getPath(S.tablas, path))}"></label>`;
}

function vistaTablas() {
  const T = S.tablas;
  const nom = (k, v) => v?.nombre || k;
  return `<div class="cab-vista"><h2>Tablas CAPECO</h2></div>
    <p class="nota">Valores referenciales. Ajústalos a tu zona, tus proveedores y la tabla salarial vigente; cada cambio recalcula todos los proyectos.</p>
    ${editorTabla("Concreto por m³ según f'c", 'concreto.fc', Object.keys(T.concreto.fc), [
      { k: 'cemento', label: 'Cemento bls' }, { k: 'arena', label: 'Arena m³' }, { k: 'piedra', label: 'Piedra m³' }, { k: 'agua', label: 'Agua m³' }], (k) => `f'c ${k}`)}
    ${editorTabla('Concreto ciclópeo por m³', 'concreto.ciclopeo', Object.keys(T.concreto.ciclopeo), [
      { k: 'cemento', label: 'Cemento bls' }, { k: 'hormigon', label: 'Hormigón m³' }, { k: 'piedra', label: 'Piedra m³' }, { k: 'agua', label: 'Agua m³' }], nom)}
    ${editorTabla('Losa aligerada por m²', 'aligerado', Object.keys(T.aligerado).filter((k) => /^\d+$/.test(k)), [
      { k: 'concreto', label: 'Concreto m³' }, { k: 'ladrillo', label: 'Ladrillos und' }, { k: 'altoLadrillo', label: 'Alto lad. cm' }], (k) => `h = ${k} cm`)}
    ${editorTabla('Acero de refuerzo', 'acero.diametros', Object.keys(T.acero.diametros), [
      { k: 'kgm', label: 'kg/m' }, { k: 'traslape', label: 'Traslape m' }, { k: 'gancho', label: 'Gancho m' }, { k: 'ganchoEstribo', label: 'Gancho estribo m' }], nom)}
    ${editorTabla('Encofrado por m²', 'encofrado', Object.keys(T.encofrado), [
      { k: 'madera', label: 'Madera p²' }, { k: 'clavos', label: 'Clavos kg' }, { k: 'alambre', label: 'Alambre N°8 kg' }], nom)}
    ${editorTabla('Ladrillos (cm)', 'ladrillos', Object.keys(T.ladrillos), [
      { k: 'L', label: 'Largo' }, { k: 'A', label: 'Ancho' }, { k: 'H', label: 'Alto' }], nom)}
    ${editorTabla('Mortero por m³', 'mortero', Object.keys(T.mortero), [
      { k: 'cemento', label: 'Cemento bls' }, { k: 'arena', label: 'Arena m³' }, { k: 'agua', label: 'Agua m³' }], (k) => `C:A ${k}`)}
    ${editorTabla('Rendimientos y cuadrillas', 'rendimientos', Object.keys(T.rendimientos), [
      { k: 'rend', label: 'Rend./día' }, ...CATEGORIAS.map((c) => ({ k: c, label: NOMBRE_CATEGORIA[c] }))], (k, v) => `${v.nombre} (${v.und})`)}
    <details class="seccion-tabla"><summary>Desperdicios y otros</summary>
      <div class="rejilla">
        ${campoTabla('Desperdicio concreto %', 'concreto.desperdicio')}
        ${campoTabla('Desperdicio acero %', 'acero.desperdicio')}
        ${campoTabla('Desperdicio ladrillo de muro %', 'desperdicioLadrillo')}
        ${campoTabla('Desperdicio mortero %', 'desperdicioMortero')}
        ${campoTabla('Desperdicio ladrillo de techo %', 'aligerado.desperdicioLadrillo')}
        ${campoTabla('Alambre N°16 por kg de acero', 'acero.alambrePorKg')}
        ${campoTabla('Longitud de varilla (m)', 'acero.longitudVarilla')}
      </div>
    </details>
    <details class="seccion-tabla" open><summary>Costo de hora-hombre (S/)</summary>
      <div class="rejilla">${CATEGORIAS.map((c) => campoTabla(NOMBRE_CATEGORIA[c], `costoHH.${c}`)).join('')}</div>
    </details>
    <div class="acciones">
      <button type="button" class="peligro" data-accion="restaurar">${pendienteBorrar === 'tablas' ? 'Toca otra vez para restaurar' : 'Restaurar valores CAPECO'}</button>
    </div>`;
}

function vistaProyectos() {
  const items = S.proyectos.map((p) => `<li class="proyecto${p.id === S.actual ? ' activo' : ''}">
      <input aria-label="Nombre del proyecto" class="nombre-proyecto" data-renombrar="${p.id}" value="${esc(p.nombre)}">
      <span class="meta">${p.partidas.length} partidas</span>
      <div class="acciones-fila">
        ${p.id === S.actual ? '<span class="chip">Abierto</span>' : `<button type="button" class="secundario" data-abrir="${p.id}">Abrir</button>`}
        <button type="button" class="secundario" data-duplicar="${p.id}">Duplicar</button>
        <button type="button" class="peligro" data-borrar-proyecto="${p.id}">${pendienteBorrar === p.id ? 'Confirmar' : 'Borrar'}</button>
      </div></li>`).join('');
  return `<div class="cab-vista"><h2>Proyectos</h2></div>
    <ul class="lista-proyectos">${items}</ul>
    <div class="acciones">
      <button type="button" class="primario" data-accion="nuevo-proyecto">Nuevo proyecto</button>
    </div>
    <h3>Respaldo</h3>
    <p class="nota">Los datos se guardan solo en este celular. Descarga un respaldo de vez en cuando o para pasarlos a otro equipo.</p>
    <div class="acciones">
      <button type="button" class="secundario" data-accion="respaldo">Descargar respaldo</button>
      <label class="boton secundario" for="importar">Cargar respaldo<input id="importar" type="file" accept=".json,application/json" hidden></label>
    </div>`;
}

// ---------- render ----------
function render() {
  const main = $('#vista');
  const html = { partidas: vistaPartidas, editor: vistaEditor, resumen: vistaResumen, tablas: vistaTablas, proyectos: vistaProyectos }[vista]();
  main.innerHTML = html;
  document.querySelectorAll('.tabs button').forEach((b) => {
    const activo = b.dataset.vista === vista || (vista === 'editor' && b.dataset.vista === 'partidas');
    b.setAttribute('aria-current', activo ? 'page' : 'false');
  });
  $('#proyecto-actual').textContent = proyecto()?.nombre || '';
}

function ir(v) {
  vista = v;
  pendienteBorrar = null;
  render();
  window.scrollTo(0, 0);
}

function refrescarEditor(rehacerForm) {
  if (rehacerForm) {
    $('#form-datos').innerHTML = formDatos(borrador);
    $('#form-rend').innerHTML = formRend(borrador);
  }
  $('#resultado').innerHTML = resultadoHTML(borrador);
}

// Ajusta dims al cambiar de elemento.
function alCambiarElemento() {
  const d = borrador.datos;
  const defs = borrador.tipo === 'concreto' ? ELEMENTOS_CONCRETO : ELEMENTOS_ENCOFRADO;
  const largo = defs[d.elemento].dims.length;
  d.dims = Array.from({ length: largo }, (_, i) => d.dims[i] ?? '');
  if (borrador.tipo === 'concreto' && !opcionesMezcla(d.elemento)[d.mezcla]) d.mezcla = '210';
}

// ---------- eventos ----------
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  const ds = b.dataset;
  if (ds.vista) { borrador = null; ir(ds.vista); return; }
  if (ds.nueva) { borrador = nuevaPartida(ds.nueva); ir('editor'); return; }
  if (ds.editar) {
    borrador = structuredClone(proyecto().partidas.find((p) => p.id === ds.editar));
    ir('editor');
    return;
  }
  if (ds.agregar) {
    const lista = borrador.datos[ds.agregar];
    if (ds.agregar === 'barras') lista.push({ diam: '3/8', cant: 2, long: 3, ganchos: 0, traslapes: 0 });
    else lista.push({ ancho: 1, alto: 2.1, cant: 1 });
    refrescarEditor(true);
    return;
  }
  if (ds.quitar) {
    const [lista, i] = ds.quitar.split('.');
    borrador.datos[lista].splice(Number(i), 1);
    refrescarEditor(true);
    return;
  }
  if (ds.abrir) { S.actual = ds.abrir; persistir(); ir('partidas'); return; }
  if (ds.duplicar) {
    const copia = structuredClone(S.proyectos.find((p) => p.id === ds.duplicar));
    copia.id = uid();
    copia.nombre += ' (copia)';
    copia.partidas.forEach((p) => { p.id = uid(); });
    S.proyectos.push(copia);
    persistir();
    render();
    return;
  }
  if (ds.borrarProyecto) {
    if (pendienteBorrar !== ds.borrarProyecto) { pendienteBorrar = ds.borrarProyecto; render(); return; }
    S.proyectos = S.proyectos.filter((p) => p.id !== ds.borrarProyecto);
    if (S.actual === ds.borrarProyecto) S.actual = S.proyectos[0]?.id;
    pendienteBorrar = null;
    persistir();
    render();
    aviso('Proyecto borrado');
    return;
  }
  switch (ds.accion) {
    case 'cancelar': borrador = null; ir('partidas'); break;
    case 'borrar-partida':
      if (pendienteBorrar !== borrador.id) { pendienteBorrar = borrador.id; render(); break; }
      proyecto().partidas = proyecto().partidas.filter((p) => p.id !== borrador.id);
      persistir();
      borrador = null;
      ir('partidas');
      aviso('Partida borrada');
      break;
    case 'nuevo-proyecto': {
      const p = { id: uid(), nombre: `Proyecto ${S.proyectos.length + 1}`, creado: new Date().toISOString(), partidas: [] };
      S.proyectos.push(p);
      S.actual = p.id;
      persistir();
      ir('partidas');
      break;
    }
    case 'restaurar':
      if (pendienteBorrar !== 'tablas') { pendienteBorrar = 'tablas'; render(); break; }
      restaurarTablas(S);
      pendienteBorrar = null;
      persistir();
      render();
      aviso('Tablas restauradas');
      break;
    case 'csv': exportarCSV(); break;
    case 'respaldo':
      descargar(`metrado-respaldo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(S, null, 1), 'application/json');
      break;
    default:
  }
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.k && borrador) {
    setPath(borrador, el.dataset.k, el.value);
    if (el.dataset.k === 'nombre') return;
    if ('rehacer' in el.dataset) {
      if (el.dataset.k === 'datos.elemento') alCambiarElemento();
      if (el.dataset.k === 'datos.estribos.diam' && el.value) {
        borrador.datos.estribos = { b: 0.25, h: 0.25, rec: 0.04, long: 3, dist: '1@.05, 4@.10, r@.25', ...borrador.datos.estribos, diam: el.value };
      }
      refrescarEditor(true);
    } else {
      refrescarEditor(false);
    }
    return;
  }
  if (el.dataset.t) {
    setPath(S.tablas, el.dataset.t, num(el.value));
    persistir();
    return;
  }
  if (el.dataset.renombrar) {
    S.proyectos.find((p) => p.id === el.dataset.renombrar).nombre = el.value;
    persistir();
    $('#proyecto-actual').textContent = proyecto()?.nombre || '';
  }
});

document.addEventListener('submit', (ev) => {
  ev.preventDefault();
  if (ev.target.id !== 'editor') return;
  const pr = proyecto();
  if (!String(borrador.nombre || '').trim()) {
    const def = borrador.tipo === 'concreto' || borrador.tipo === 'encofrado'
      ? `${TIPOS[borrador.tipo].nombre} ${(ELEMENTOS_CONCRETO[borrador.datos.elemento]?.nombre || '').toLowerCase()}`
      : TIPOS[borrador.tipo].nombre;
    borrador.nombre = def.trim();
  }
  const i = pr.partidas.findIndex((p) => p.id === borrador.id);
  if (i >= 0) pr.partidas[i] = borrador; else pr.partidas.push(borrador);
  persistir();
  borrador = null;
  ir('partidas');
  aviso('Partida guardada');
});

document.addEventListener('change', async (ev) => {
  if (ev.target.id !== 'importar') return;
  const f = ev.target.files[0];
  if (!f) return;
  try {
    const d = importar(await f.text());
    Object.keys(S).forEach((k) => delete S[k]);
    Object.assign(S, d);
    persistir();
    ir('partidas');
    aviso('Respaldo cargado');
  } catch (e) {
    aviso(e.message);
  }
});

// ---------- exportación ----------
function descargar(nombre, contenido, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportarCSV() {
  const pr = proyecto();
  const s = resumenProyecto(pr.partidas, S.tablas);
  const n = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '');
  const q = (t) => `"${String(t).replace(/"/g, '""')}"`;
  const L = [[q(`Proyecto: ${pr.nombre}`)], [], ['Partida', 'Tipo', 'Metrado', 'Und', 'Rend/dia', 'Dias', 'HH', 'Costo MO S/'].map(q)];
  for (const { p, r, error } of s.filas) {
    if (error) { L.push([q(p.nombre), q(TIPOS[p.tipo].nombre), q(`Error: ${error}`)]); continue; }
    const R = r.rendimiento;
    L.push([q(p.nombre), q(TIPOS[p.tipo].nombre), n(r.cantidad), q(r.und), R ? n(R.rend) : '', R ? n(R.dias, 1) : '', R ? n(R.hhTotal) : '', R ? n(R.costo) : '']);
  }
  L.push([], [q('Materiales')], ['Material', 'Und', 'Cantidad'].map(q));
  for (const m of s.materiales) L.push([q(m.nombre), q(m.und), n(m.cantidad)]);
  L.push([], [q('Mano de obra')], ['Categoria', 'HH', 'Costo S/'].map(q));
  for (const c of CATEGORIAS) L.push([q(NOMBRE_CATEGORIA[c]), n(s.hh[c]), n(s.hh[c] * num(S.tablas.costoHH[c]))]);
  const csv = '﻿' + L.map((f) => f.join(';')).join('\r\n');
  descargar(`metrado-${pr.nombre.replace(/[^\w-]+/g, '_')}.csv`, csv, 'text/csv;charset=utf-8');
}

// ---------- inicio ----------
render();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
