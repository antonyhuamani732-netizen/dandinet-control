import { CATEGORIAS, NOMBRE_CATEGORIA, ACCESORIOS } from './data/capeco.js';
import { ESPECIALIDADES, PARTIDAS, TIPOS, medidas, nuevoElemento } from './data/elementos.js';
import { calcElemento, calcPartidaElemento, claveRendimiento, esFijo } from './calc/elemento.js';
import { piezasItem } from './calc/acero.js';
import { textoPatron } from './calc/corte.js';
import { resumen, seleccionada, claveSel } from './calc/index.js';
import { rendimientoRegistro, resumenObra, diasConCuadrilla } from './calc/obra.js';
import { num } from './calc/util.js';
import { cargar, guardar, uid, restaurarTablas, importar } from './storage.js';
import { figuraElemento, figuraMalla } from './ui/figuras.js';
import { tramosHTML, estribosVivo, PRESETS } from './ui/estribos.js';

const APAREJOS = { soga: 'Soga', cabeza: 'Cabeza', canto: 'Canto' };

// ---------- utilidades ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 2) => (Number.isFinite(n) ? n : 0).toLocaleString('es-PE', { minimumFractionDigits: d, maximumFractionDigits: d });
const sol = (n) => `S/ ${fmt(n, 2)}`;
const cantTxt = (x, und) => `${fmt(x, und === 'und' ? 0 : 2)}`;

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

function aviso(texto, accion) {
  const t = $('#aviso');
  t.innerHTML = `<span>${esc(texto)}</span>${accion ? `<button type="button" data-act="${accion.act}">${esc(accion.texto)}</button>` : ''}`;
  t.hidden = false;
  clearTimeout(aviso.timer);
  aviso.timer = setTimeout(() => { t.hidden = true; }, accion ? 6000 : 2600);
}

// ---------- proyecto de ejemplo ----------
function ejemplo() {
  const E = (tipo, nombre, n, dims, extra = {}) => {
    const el = nuevoElemento(tipo, nombre, uid());
    el.n = n;
    Object.assign(el.dims, dims);
    if (el.partidas.acero) el.partidas.acero.armado = TIPOS[tipo].armado ? TIPOS[tipo].armado(medidas(el)) : [];
    return Object.assign(el, extra);
  };
  const muro = E('muro', 'Muro eje A', 1, { L: 8, H: 2.6 });
  muro.partidas.muro.vanos = [{ ancho: 0.9, alto: 2.1, cant: 1 }, { ancho: 1.2, alto: 1.0, cant: 2 }];
  const exc = E('manual', 'Excavación de zanjas', 1, {});
  Object.assign(exc.partidas.manual, { und: 'm³', cantidad: 14.5, rend: 3.5, cuadrilla: { capataz: 0.1, operario: 0, oficial: 0, peon: 1 } });
  const elementos = [
    E('cimiento', 'CC-1', 1, { L: 32, B: 0.4, h: 0.8 }),
    E('sobrecimiento', 'SC-1', 1, { L: 32, B: 0.15, h: 0.3 }),
    E('zapata', 'Z-1', 6, { A: 1.2, B: 1.2, h: 0.6 }),
    E('columna', 'C-1', 6, { b: 0.25, h: 0.25, H: 2.8 }),
    E('viga', 'VP-101', 4, { b: 0.25, h: 0.4, L: 4.5 }),
    E('losa_aligerada', 'Techo 1', 1, { A: 4, B: 8 }),
    muro,
    exc,
  ];
  elementos[2].partidas.concreto.ejecutado = true;
  return {
    id: uid(),
    nombre: 'Vivienda 1 piso (ejemplo)',
    creado: new Date().toISOString(),
    elementos,
    registros: [
      { id: uid(), fecha: new Date().toISOString().slice(0, 10), elementoId: muro.id, partida: 'muro', cantidad: 6, horas: 8, personas: { capataz: 0, operario: 1, oficial: 0, peon: 1 }, nota: 'Ejemplo' },
    ],
    seleccion: { excluidos: {}, modo: 'todo' },
  };
}

// ---------- estado ----------
const S = cargar(ejemplo);
let vista = 'partidas';
const ui = { cerrados: new Set(), editor: null, deshacer: null, confirmar: null, obraSel: null };

const proyecto = () => S.proyectos.find((p) => p.id === S.actual);
function persistir() {
  if (!guardar(S)) aviso('No se pudo guardar en este dispositivo');
}

// ---------- campos ----------
function campo(label, path, valor, opt = {}) {
  const id = `f-${path.replace(/\W/g, '-')}`;
  const datos = `data-k="${path}"${opt.rehacer ? ' data-rehacer' : ''}`;
  const letra = opt.letra ? `<b class="letra">${esc(opt.letra)}</b>` : '';
  if (opt.opciones) {
    const ops = Object.entries(opt.opciones)
      .map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(valor) ? ' selected' : ''}>${esc(t)}</option>`).join('');
    return `<label class="campo${opt.ancho ? ' ancho' : ''}" for="${id}"><span>${letra}${esc(label)}</span><select id="${id}" ${datos}>${ops}</select></label>`;
  }
  const tipo = opt.texto ? 'text' : 'number';
  const extra = opt.texto ? '' : ' inputmode="decimal" step="any" min="0"';
  const ph = opt.placeholder != null ? ` placeholder="${esc(opt.placeholder)}"` : '';
  return `<label class="campo${opt.ancho ? ' ancho' : ''}" for="${id}"><span>${letra}${esc(label)}</span><input id="${id}" type="${tipo}"${extra}${ph} ${datos} value="${esc(valor ?? '')}"></label>`;
}

function check(label, path, valor, rehacer) {
  return `<label class="check"><input type="checkbox" data-k="${path}" data-bool${rehacer ? ' data-rehacer' : ''}${valor ? ' checked' : ''}><span>${esc(label)}</span></label>`;
}

const diametros = () => Object.fromEntries(Object.entries(S.tablas.acero.diametros).map(([k, v]) => [k, `Ø ${v.nombre}`]));

function opcionesMezcla(tipo) {
  const o = {};
  if (TIPOS[tipo].mezcla === 'ciclopeo') {
    const c = S.tablas.concreto.ciclopeo[tipo];
    if (c) o.ciclopeo = `Ciclópeo ${c.nombre}`;
  }
  for (const fc of Object.keys(S.tablas.concreto.fc)) o[fc] = `f'c = ${fc} kg/cm²`;
  return o;
}

function resumenMedidas(el) {
  const t = TIPOS[el.tipo];
  if (el.tipo === 'manual') return el.partidas.manual.und || '';
  return t.dims.slice(0, 3).map((x) => fmt(num(el.dims[x.k]))).join(' × ');
}

// ---------- bloques de resultado ----------
function tablaMateriales(mats) {
  if (!mats.length) return '<p class="nota">Sin materiales.</p>';
  return `<div class="tabla-scroll"><table class="tabla">
    <thead><tr><th>Material</th><th>Und</th><th class="n">Cantidad</th></tr></thead>
    <tbody>${mats.map((m) => `<tr><td>${esc(m.nombre)}</td><td>${esc(m.und)}</td><td class="n">${cantTxt(m.cantidad, m.und)}</td></tr>`).join('')}</tbody>
  </table></div>`;
}

function bloqueRendimiento(R) {
  if (!R) return '<p class="nota">Sin rendimiento para esta partida.</p>';
  const filas = CATEGORIAS.filter((c) => R.hh[c] > 0)
    .map((c) => `<tr><td>${NOMBRE_CATEGORIA[c]} <small>(${fmt(R.cuadrilla[c], 1)})</small></td><td class="n">${fmt(R.hh[c])}</td><td class="n">${sol(R.hh[c] * num(S.tablas.costoHH[c]))}</td></tr>`).join('');
  return `<div class="cifras">
      <div><span>Rendimiento</span><b>${fmt(R.rend)} ${esc(R.und)}/día</b><small>${R.propia ? 'cuadrilla propia' : 'cuadrilla CAPECO'}</small></div>
      <div><span>Plazo</span><b>${fmt(R.dias, 1)} días</b><small>${R.cuadrillas} cuadrilla${R.cuadrillas > 1 ? 's' : ''}</small></div>
      <div><span>Mano de obra</span><b>${sol(R.costo)}</b><small>${sol(R.costoUnitario)} / ${esc(R.und)}</small></div>
    </div>
    <div class="tabla-scroll"><table class="tabla">
      <thead><tr><th>Categoría</th><th class="n">HH</th><th class="n">Costo</th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr><td>Total (${fmt(R.hhPorUnidad, 3)} HH/${esc(R.und)})</td><td class="n">${fmt(R.hhTotal)}</td><td class="n">${sol(R.costo)}</td></tr></tfoot>
    </table></div>`;
}

function resultadoPartida(el, clave) {
  const r = calcPartidaElemento(el, clave, S.tablas);
  if (r.error) return `<p class="error">${esc(r.error)}</p>`;
  return `<div class="metrado"><span>Metrado${r.fijo ? ' fijo' : ''}</span><b>${fmt(r.cantidad)} <small>${esc(r.und)}</small></b></div>
    ${r.fijo ? `<p class="nota">Calculado con medidas: ${fmt(r.calculado)} ${esc(r.und)}. Materiales escalados al valor fijo.</p>` : ''}
    ${r.aviso ? `<p class="error">${esc(r.aviso)}</p>` : ''}
    ${r.detalle ? `<p class="nota">${esc(r.detalle)}</p>` : ''}
    <h4>Materiales</h4>${tablaMateriales(r.materiales)}
    ${r.corte ? despieceHTML(r) : ''}
    <h4>Rendimiento y mano de obra</h4>${bloqueRendimiento(r.rendimiento)}`;
}

function despieceHTML(r) {
  const D = S.tablas.acero.diametros;
  const filas = Object.entries(r.corte).map(([diam, c]) => `<tr><td>Ø ${esc(D[diam].nombre)}</td><td class="n">${fmt(r.armado.kgPorDiam[diam])}</td><td class="n"><b>${c.varillas}</b></td><td class="n">${fmt(c.desperdicio, 1)} %</td></tr>
    <tr class="sub"><td colspan="4">${c.patrones.map((p) => `${p.veces} × [${esc(textoPatron(p))}]`).join('<br>')}</td></tr>`).join('');
  if (!filas) return '';
  return `<h4>Varillas de ${esc(S.tablas.acero.longitudVarilla)} m (corte optimizado)</h4>
    <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Diámetro</th><th class="n">kg netos</th><th class="n">Varillas</th><th class="n">Desp.</th></tr></thead><tbody>${filas}</tbody></table></div>`;
}

// ---------- vista Partidas ----------
function chipPartida(el, clave, r) {
  const p = el.partidas[clave];
  const estado = p.activa === false ? ' inactiva' : '';
  const ej = p.ejecutado ? '<span class="sello">Ejecutada</span>' : '';
  const val = r.error ? '<small class="error">Revisar</small>' : p.activa === false ? '<small>No incluida</small>'
    : `<b>${fmt(r.cantidad)} ${esc(r.und)}</b>${r.rendimiento ? `<small>${fmt(r.rendimiento.dias, 1)} d</small>` : ''}`;
  return `<button type="button" class="pchip${estado}" data-editar="${el.id}" data-tab="${clave}">
    <span class="chip chip-${clave}">${esc(PARTIDAS[clave].nombre)}</span>${val}${esFijo(p) && clave !== 'manual' ? '<span class="sello">Fijo</span>' : ''}${ej}</button>`;
}

function tarjetaElemento(el) {
  const res = calcElemento(el, S.tablas);
  return `<article class="tarjeta${el.oculto ? ' oculto' : ''}">
    <div class="tarjeta-cab">
      <button type="button" class="tarjeta-nombre" data-editar="${el.id}">
        <span class="nombre">${esc(el.nombre)}${num(el.n) > 1 ? ` <span class="veces">× ${num(el.n)}</span>` : ''}${el.oculto ? ' <span class="sello">Oculto</span>' : ''}</span>
        <small>${esc(resumenMedidas(el))}</small>
      </button>
      <button type="button" class="menu-btn" data-menu="${el.id}" aria-label="Opciones de ${esc(el.nombre)}">⋯</button>
    </div>
    <div class="chips-partidas">${Object.keys(el.partidas).map((c) => chipPartida(el, c, res[c])).join('')}</div>
  </article>`;
}

function totalesGrupo(els) {
  const tot = {};
  for (const el of els) {
    if (el.oculto) continue;
    const res = calcElemento(el, S.tablas);
    for (const [c, r] of Object.entries(res)) {
      if (r.error || el.partidas[c].activa === false) continue;
      const k = c === 'manual' ? r.und : c;
      tot[k] = tot[k] || { und: r.und, cant: 0 };
      tot[k].cant += r.cantidad;
    }
  }
  return Object.values(tot).map((t) => `${fmt(t.cant, 1)} ${esc(t.und)}`).join(' · ');
}

function abierto(k) { return !ui.cerrados.has(k); }

function vistaPartidas() {
  const pr = proyecto();
  if (!pr) return '<p class="vacio">Crea un proyecto en la pestaña Proyectos.</p>';
  let html = `<div class="cab-vista"><h2>${esc(pr.nombre)}</h2>
    <div class="barra-acciones"><button type="button" class="link" data-act="desplegar">Desplegar todo</button><button type="button" class="link" data-act="contraer">Contraer todo</button></div></div>`;
  for (const [ek, esp] of Object.entries(ESPECIALIDADES)) {
    const els = pr.elementos.filter((e) => e.especialidad === ek);
    const k = `esp:${ek}`;
    html += `<section class="esp">
      <button type="button" class="esp-cab" data-toggle="${k}" aria-expanded="${abierto(k)}">
        <span class="codigo">${esp.codigo}</span><span class="titulo">${esp.nombre}</span><small>${els.length} elemento${els.length === 1 ? '' : 's'}</small><span class="flecha" aria-hidden="true"></span>
      </button>
      <div class="esp-cuerpo"${abierto(k) ? '' : ' hidden'}>`;
    const tipos = Object.entries(TIPOS).filter(([, t]) => t.esp === ek);
    let algun = false;
    for (const [tk, t] of tipos) {
      const g = els.filter((e) => e.tipo === tk);
      if (!g.length) continue;
      algun = true;
      const gk = `grp:${tk}`;
      html += `<div class="grupo">
        <button type="button" class="grupo-cab" data-toggle="${gk}" aria-expanded="${abierto(gk)}">
          <span class="titulo">${esc(t.plural)} <span class="cuenta">(${g.length})</span></span><small>${totalesGrupo(g)}</small><span class="flecha" aria-hidden="true"></span>
        </button>
        <div class="grupo-cuerpo"${abierto(gk) ? '' : ' hidden'}>
          ${g.map(tarjetaElemento).join('')}
          <button type="button" class="agregar-aqui" data-nuevo="${tk}">Agregar ${esc(t.nombre.toLowerCase())}</button>
        </div></div>`;
    }
    if (!algun) {
      html += `<p class="vacio">Sin elementos. ${tipos.map(([tk, t]) => `<button type="button" class="link" data-nuevo="${tk}">Agregar ${esc(t.nombre.toLowerCase())}</button>`).join(' ')}</p>`;
    }
    html += '</div></section>';
  }
  return `${html}<button type="button" class="fab" data-act="selector">Agregar elemento</button>`;
}

function selectorTipos() {
  return `<div class="flot-cab"><h3>Agregar elemento</h3><button type="button" class="cerrar" data-act="cerrar-flotante" aria-label="Cerrar">✕</button></div>
    ${Object.entries(ESPECIALIDADES).map(([ek, esp]) => `<h4>${esp.nombre}</h4><div class="selector">
      ${Object.entries(TIPOS).filter(([, t]) => t.esp === ek).map(([tk, t]) => {
        const el = nuevoElemento(tk, '', 'x');
        return `<button type="button" class="opcion-tipo" data-nuevo="${tk}">${figuraElemento(tk, medidas(el), el) || '<span class="sin-fig">Libre</span>'}<span>${esc(t.nombre)}</span></button>`;
      }).join('')}</div>`).join('')}`;
}

function menuElemento(el) {
  const pr = proyecto();
  const i = pr.elementos.indexOf(el);
  return `<div class="flot-cab"><h3>${esc(el.nombre)}</h3><button type="button" class="cerrar" data-act="cerrar-flotante" aria-label="Cerrar">✕</button></div>
    <div class="menu">
      <button type="button" data-editar="${el.id}">Editar medidas y partidas</button>
      <button type="button" data-act="duplicar" data-id="${el.id}">Duplicar</button>
      <button type="button" data-act="ocultar" data-id="${el.id}">${el.oculto ? 'Mostrar (vuelve a sumar)' : 'Ocultar (no suma en el resumen)'}</button>
      <button type="button" data-act="mover" data-id="${el.id}" data-d="-1"${i === 0 ? ' disabled' : ''}>Subir</button>
      <button type="button" data-act="mover" data-id="${el.id}" data-d="1"${i === pr.elementos.length - 1 ? ' disabled' : ''}>Bajar</button>
      <button type="button" class="texto-peligro" data-act="borrar-elemento" data-id="${el.id}">Borrar</button>
    </div>`;
}

// ---------- editor flotante del elemento ----------
function tabsEditor(el) {
  const t = [];
  if (el.tipo !== 'manual') t.push(['medidas', 'Medidas']);
  for (const c of Object.keys(el.partidas)) t.push([c, c === 'manual' ? 'Partida' : PARTIDAS[c].nombre]);
  return t;
}

function editorHTML() {
  const { draft: el, tab } = ui.editor;
  return `<form id="editor" class="editor" autocomplete="off">
    <div class="hoja-cab">
      <span class="tipo-el">${esc(TIPOS[el.tipo].nombre)}</span>
      <div class="hoja-nombre">
        <input aria-label="Nombre o código" data-k="nombre" value="${esc(el.nombre)}" placeholder="Z-1, eje A">
        <label class="veces-campo"><span>×</span><input aria-label="Cantidad de elementos iguales" type="number" inputmode="decimal" min="1" step="1" data-k="n" value="${esc(el.n)}"></label>
      </div>
      <button type="button" class="cerrar" data-act="cerrar-editor" aria-label="Cerrar sin guardar">✕</button>
    </div>
    <nav class="hoja-tabs" role="tablist">${tabsEditor(el).map(([k, n]) => {
      const p = el.partidas[k];
      return `<button type="button" role="tab" data-tabe="${k}" aria-selected="${k === tab}"${p && p.activa === false ? ' class="apagada"' : ''}>${esc(n)}</button>`;
    }).join('')}</nav>
    <div class="hoja-cuerpo" id="hoja-tab">${tabHTML(el, tab)}</div>
    <div class="hoja-pie">
      <button type="submit" class="primario">Guardar</button>
      <button type="button" class="secundario" data-act="cerrar-editor">Cancelar</button>
    </div>
  </form>`;
}

function tabHTML(el, tab) {
  if (tab === 'medidas') return tabMedidas(el);
  return tabPartida(el, tab);
}

function tabMedidas(el) {
  const t = TIPOS[el.tipo];
  const m = medidas(el);
  const res = calcElemento(el, S.tablas);
  return `<button type="button" class="fig-boton" data-act="zoom" aria-label="Ampliar figura"><span id="fig-el">${figuraElemento(el.tipo, m, el)}</span><span class="lupa">Ampliar</span></button>
    <div class="rejilla">
      ${t.dims.map((x) => campo(`${x.label} (${x.k === 'np' ? 'und' : 'm'})`, `dims.${x.k}`, el.dims[x.k], { letra: x.k })).join('')}
      ${el.mezcla !== undefined ? campo('Concreto', 'mezcla', el.mezcla, { opciones: opcionesMezcla(el.tipo) }) : ''}
      ${el.peralte !== undefined ? campo('Peralte de losa', 'peralte', el.peralte, { opciones: Object.fromEntries(Object.keys(S.tablas.aligerado).filter((k) => /^\d+$/.test(k)).map((k) => [k, `h = ${k} cm`])), rehacer: true }) : ''}
    </div>
    <h4>Partidas de este elemento</h4>
    <div class="lista-partidas" id="lista-partidas">${listaPartidasEditor(el, res)}</div>`;
}

function listaPartidasEditor(el, res) {
  return Object.keys(el.partidas).map((c) => {
    const p = el.partidas[c];
    const r = res[c];
    return `<div class="fila-partida${p.activa === false ? ' apagada' : ''}">
      ${check(PARTIDAS[c].nombre, `partidas.${c}.activa`, p.activa !== false, true)}
      <button type="button" class="link" data-tabe="${c}">${r.error ? `<span class="error">${esc(r.error)}</span>` : `${fmt(r.cantidad)} ${esc(r.und)}${esFijo(p) ? ' (fijo)' : ''}`} ›</button>
    </div>`;
  }).join('');
}

function tabPartida(el, c) {
  const p = el.partidas[c];
  const base = `partidas.${c}`;
  const rk = claveRendimiento(el, c);
  const rt = rk ? S.tablas.rendimientos[rk] : null;
  let especifico = '';
  if (c === 'concreto') {
    especifico = `<div class="rejilla">${campo('Concreto', 'mezcla', el.mezcla, { opciones: opcionesMezcla(el.tipo) })}</div>`;
  } else if (c === 'encofrado') {
    const acc = S.tablas.accesorios[el.tipo] || {};
    const lista = Object.entries(ACCESORIOS).filter(([k]) => num(acc[k]) > 0).map(([, a]) => a.nombre.toLowerCase()).join(', ');
    especifico = `<div class="rejilla">${campo('Reúsos del juego de accesorios', `${base}.usos`, p.usos ?? 1)}</div>
      <p class="nota">Incluye madera, clavos y alambre${lista ? `, más ${esc(lista)}` : ''}. Si encofras por partes, pon cuántas veces se reusa el mismo juego. Coeficientes en Tablas › Accesorios.</p>`;
  } else if (c === 'acero') {
    especifico = aceroHTML(el);
  } else if (c === 'muro') {
    especifico = muroHTML(el);
  } else if (c === 'manual') {
    return manualHTML(el);
  }
  return `<div class="partida-ctrl">
      ${check('Incluir esta partida', `${base}.activa`, p.activa !== false, true)}
      ${check('Ejecutada', `${base}.ejecutado`, p.ejecutado)}
    </div>
    <div class="segmento" role="group" aria-label="Metrado">
      <button type="button" data-act="modo" data-p="${c}" data-v="calc" aria-pressed="${!esFijo(p)}">Calculado</button>
      <button type="button" data-act="modo" data-p="${c}" data-v="fijo" aria-pressed="${esFijo(p)}">Valor fijo</button>
    </div>
    ${esFijo(p) ? `<div class="rejilla">${campo(`Metrado fijo (${PARTIDAS[c].und})`, `${base}.fijo`, p.fijo)}</div>` : ''}
    ${especifico}
    <section class="resultado" id="res-${c}" aria-live="polite">${resultadoPartida(el, c)}</section>
    ${rendimientoCampos(el, c, rt)}`;
}

function rendimientoCampos(el, c, rt) {
  const p = el.partidas[c];
  const base = `partidas.${c}`;
  const cu = p.cuadrilla;
  return `<details class="seccion-rend"${cu || p.rend ? ' open' : ''}><summary>Ajustar rendimiento y cuadrilla</summary>
    <div class="rejilla">
      ${campo(`Rendimiento propio${rt ? ` (${rt.und}/día)` : ''}`, `${base}.rend`, p.rend, { placeholder: rt ? `CAPECO: ${rt.rend}` : '' })}
      ${campo('N° de cuadrillas', `${base}.cuadrillas`, p.cuadrillas)}
    </div>
    ${rt ? `<p class="nota">Cuadrilla CAPECO: ${CATEGORIAS.filter((k) => rt[k]).map((k) => `${rt[k]} ${NOMBRE_CATEGORIA[k].toLowerCase()}`).join(' + ')}.</p>` : ''}
    <label class="check"><input type="checkbox" data-act="cuadrilla-propia" data-p="${c}"${cu ? ' checked' : ''}><span>Usar mi propia cuadrilla</span></label>
    ${cu ? `<div class="rejilla">${CATEGORIAS.map((k) => campo(NOMBRE_CATEGORIA[k], `${base}.cuadrilla.${k}`, cu[k])).join('')}</div>` : ''}
  </details>`;
}

function aceroHTML(el) {
  const p = el.partidas.acero;
  const n = num(el.n) || 1;
  const items = (p.armado || []).map((it, i) => itemAceroHTML(el, it, i, n)).join('');
  return `<h4>Armado</h4>
    <div class="items-acero">${items || '<p class="vacio">Sin armado. Agrega barras, una malla o estribos.</p>'}</div>
    <div class="barra-acciones">
      <button type="button" class="secundario chico" data-act="item-agregar" data-tipo="barras">Barras</button>
      <button type="button" class="secundario chico" data-act="item-agregar" data-tipo="malla">Malla X / Y</button>
      <button type="button" class="secundario chico" data-act="item-agregar" data-tipo="estribos">Estribos</button>
      ${TIPOS[el.tipo].armado ? '<button type="button" class="link" data-act="armado-tipico">Cargar armado típico</button>' : ''}
    </div>`;
}

function itemAceroHTML(el, it, i, n) {
  const base = `partidas.acero.armado.${i}`;
  const dia = diametros();
  let campos = '';
  if (it.tipo === 'barras') {
    campos = `<div class="rejilla">
      ${campo('Diámetro', `${base}.diam`, it.diam, { opciones: dia })}
      ${campo('N° de barras', `${base}.cant`, it.cant)}
      ${campo('Longitud (m)', `${base}.long`, it.long)}
      ${campo('Ganchos', `${base}.ganchos`, it.ganchos, { opciones: { 0: 'Sin gancho', 1: '1 gancho', 2: '2 ganchos' } })}
      ${campo('Traslapes por barra', `${base}.traslapes`, it.traslapes)}
    </div>`;
  } else if (it.tipo === 'malla') {
    const pl = TIPOS[el.tipo].planta ? TIPOS[el.tipo].planta(medidas(el)) : {};
    campos = `<div class="rejilla">
      ${campo('Diámetro', `${base}.diam`, it.diam, { opciones: dia })}
      ${campo('Barras paralelas a', `${base}.dir`, it.dir, { opciones: { X: `X (largo ${fmt(num(it.largoX ?? pl.X))} m)`, Y: `Y (ancho ${fmt(num(it.largoY ?? pl.Y))} m)` } })}
      ${campo('Espaciamiento (m)', `${base}.sep`, it.sep)}
      ${campo('Recubrimiento (m)', `${base}.rec`, it.rec)}
      ${campo('Ganchos', `${base}.ganchos`, it.ganchos, { opciones: { 0: 'Sin gancho', 1: '1 gancho', 2: '2 ganchos' } })}
      ${campo('Capas / caras', `${base}.capas`, it.capas ?? 1)}
      ${pl.X === undefined ? `${campo('Largo X (m)', `${base}.largoX`, it.largoX)}${campo('Ancho Y (m)', `${base}.largoY`, it.largoY)}` : ''}
    </div>
    <p class="nota">N° barras = (ancho − 2 × recubrimiento) ÷ espaciamiento + 1, en toda la longitud.</p>`;
  } else if (it.tipo === 'estribos') {
    campos = `<div class="rejilla">
      ${campo('Diámetro', `${base}.diam`, it.diam, { opciones: dia })}
      ${campo('Sección b (m)', `${base}.b`, it.b)}
      ${campo('Sección h (m)', `${base}.h`, it.h)}
      ${campo('Recubrimiento (m)', `${base}.rec`, it.rec)}
      ${campo('Longitud a estribar (m)', `${base}.long`, it.long)}
    </div>
    <div id="tramos-${i}">${tramosHTML(it, base)}</div>`;
  }
  const titulo = { barras: 'Barras', malla: 'Malla', estribos: 'Estribos' }[it.tipo];
  return `<details class="item-acero" open>
    <summary><span class="chip chip-acero">${titulo}</span><span class="item-uso">${esc(it.uso || titulo)}</span><span class="item-info" id="info-${i}">${esc(infoItem(el, it))}</span></summary>
    <div class="item-cuerpo">
      <div class="rejilla">${campo('Descripción', `${base}.uso`, it.uso, { texto: true, ancho: true })}</div>
      ${campos}
      <div class="vivo" id="vivo-${i}">${vivoItem(el, it, n)}</div>
      <button type="button" class="quitar" data-act="item-quitar" data-i="${i}">Quitar ${titulo.toLowerCase()}</button>
    </div>
  </details>`;
}

function infoItem(el, it) {
  try {
    const pl = TIPOS[el.tipo].planta ? TIPOS[el.tipo].planta(medidas(el)) : {};
    return piezasItem(it, S.tablas, pl).info;
  } catch (e) {
    return e.message;
  }
}

function vivoItem(el, it, n) {
  if (it.tipo === 'estribos') return estribosVivo(it, S.tablas, n);
  if (it.tipo === 'malla') {
    try {
      const pl = TIPOS[el.tipo].planta ? TIPOS[el.tipo].planta(medidas(el)) : {};
      const r = piezasItem(it, S.tablas, pl);
      return figuraMalla(it.dir, r.cant);
    } catch (e) {
      return `<p class="error">${esc(e.message)}</p>`;
    }
  }
  return '';
}

function muroHTML(el) {
  const p = el.partidas.muro;
  const base = 'partidas.muro';
  const lad = Object.fromEntries(Object.entries(S.tablas.ladrillos).map(([k, v]) => [k, `${v.nombre} (${v.L}×${v.A}×${v.H})`]));
  lad.otro = 'Otro (medidas propias)';
  const mort = Object.fromEntries(Object.keys(S.tablas.mortero).map((k) => [k, `Mortero C:A ${k}`]));
  const vanos = (p.vanos || []).map((v, i) => `
    <div class="fila-rep">
      <div class="rejilla">
        ${campo('Ancho (m)', `${base}.vanos.${i}.ancho`, v.ancho)}
        ${campo('Alto (m)', `${base}.vanos.${i}.alto`, v.alto)}
        ${campo('Cantidad', `${base}.vanos.${i}.cant`, v.cant)}
      </div>
      <button type="button" class="quitar" data-act="vano-quitar" data-i="${i}">Quitar vano</button>
    </div>`).join('');
  return `<div class="rejilla">
      ${campo('Ladrillo', `${base}.ladrillo`, p.ladrillo, { opciones: lad, rehacer: true })}
      ${p.ladrillo === 'otro' ? `
        ${campo('Largo L (cm)', `${base}.ladPers.L`, p.ladPers?.L)}
        ${campo('Ancho A (cm)', `${base}.ladPers.A`, p.ladPers?.A)}
        ${campo('Alto H (cm)', `${base}.ladPers.H`, p.ladPers?.H)}` : ''}
      ${campo('Aparejo', `${base}.aparejo`, p.aparejo, { opciones: APAREJOS, rehacer: true })}
      ${campo('Junta (cm)', `${base}.junta`, p.junta)}
      ${campo('Mortero', `${base}.mortero`, p.mortero, { opciones: mort })}
    </div>
    <h4>Vanos a descontar</h4>${vanos || '<p class="nota">Sin vanos.</p>'}
    <button type="button" class="secundario chico" data-act="vano-agregar">Agregar vano</button>`;
}

function manualHTML(el) {
  const p = el.partidas.manual;
  const base = 'partidas.manual';
  const cu = p.cuadrilla || {};
  const mats = (p.materiales || []).map((x, i) => `<div class="fila-rep"><div class="rejilla">
      ${campo('Material', `${base}.materiales.${i}.nombre`, x.nombre, { texto: true })}
      ${campo('Und', `${base}.materiales.${i}.und`, x.und, { texto: true })}
      ${campo('Cantidad por unidad', `${base}.materiales.${i}.porUnidad`, x.porUnidad)}
    </div><button type="button" class="quitar" data-act="mat-quitar" data-i="${i}">Quitar material</button></div>`).join('');
  return `<div class="partida-ctrl">${check('Incluir', `${base}.activa`, p.activa !== false, true)}${check('Ejecutada', `${base}.ejecutado`, p.ejecutado)}</div>
    <div class="rejilla">
      ${campo('Unidad', `${base}.und`, p.und, { texto: true, placeholder: 'm², m³, und, glb' })}
      ${campo('Metrado (por elemento)', `${base}.cantidad`, p.cantidad)}
      ${campo('Rendimiento (und/día)', `${base}.rend`, p.rend)}
      ${campo('N° de cuadrillas', `${base}.cuadrillas`, p.cuadrillas)}
    </div>
    <h4>Cuadrilla</h4>
    <div class="rejilla">${CATEGORIAS.map((k) => campo(NOMBRE_CATEGORIA[k], `${base}.cuadrilla.${k}`, cu[k])).join('')}</div>
    <h4>Materiales (opcional)</h4>${mats}
    <button type="button" class="secundario chico" data-act="mat-agregar">Agregar material</button>
    <section class="resultado" id="res-manual" aria-live="polite">${resultadoPartida(el, 'manual')}</section>`;
}

function abrirEditor(id, tab) {
  const el = proyecto().elementos.find((e) => e.id === id);
  if (!el) return;
  const draft = structuredClone(el);
  const tabs = tabsEditor(draft).map(([k]) => k);
  ui.editor = { draft, tab: tabs.includes(tab) ? tab : tabs[0], id };
  cerrarFlotante();
  $('#hoja-contenido').innerHTML = editorHTML();
  const d = $('#hoja');
  if (!d.open) d.showModal();
}

function rehacerTab() {
  const { draft, tab } = ui.editor;
  const cuerpo = $('#hoja-tab');
  const y = cuerpo.scrollTop;
  cuerpo.innerHTML = tabHTML(draft, tab);
  cuerpo.scrollTop = y;
  document.querySelectorAll('.hoja-tabs [data-tabe]').forEach((b) => {
    const p = draft.partidas[b.dataset.tabe];
    b.classList.toggle('apagada', !!p && p.activa === false);
  });
}

function refrescarVivo(path) {
  const { draft: el, tab } = ui.editor;
  if (tab === 'medidas') {
    $('#fig-el').innerHTML = figuraElemento(el.tipo, medidas(el), el);
    $('#lista-partidas').innerHTML = listaPartidasEditor(el, calcElemento(el, S.tablas));
    return;
  }
  const res = $(`#res-${tab}`);
  if (res) res.innerHTML = resultadoPartida(el, tab);
  const m = /^partidas\.acero\.armado\.(\d+)\./.exec(path || '');
  if (tab === 'acero') {
    const n = num(el.n) || 1;
    const idx = m ? [Number(m[1])] : el.partidas.acero.armado.map((_, i) => i);
    for (const i of idx) {
      const it = el.partidas.acero.armado[i];
      const info = $(`#info-${i}`);
      if (info) info.textContent = infoItem(el, it);
      const vivo = $(`#vivo-${i}`);
      if (vivo) vivo.innerHTML = vivoItem(el, it, n);
    }
  }
}

function cerrarEditor(guardado = false) {
  if (!guardado && ui.editor?.nuevo) {
    const pr = proyecto();
    pr.elementos = pr.elementos.filter((e) => e.id !== ui.editor.id);
    persistir();
    render();
  }
  ui.editor = null;
  const d = $('#hoja');
  if (d.open) d.close();
}

function guardarEditor() {
  const pr = proyecto();
  const el = ui.editor.draft;
  if (!String(el.nombre || '').trim()) el.nombre = TIPOS[el.tipo].nombre;
  const i = pr.elementos.findIndex((e) => e.id === el.id);
  if (i >= 0) pr.elementos[i] = el; else pr.elementos.push(el);
  persistir();
  cerrarEditor(true);
  render();
  aviso(`${el.nombre} guardado`);
}

function nombreNuevo(tipo) {
  const pref = TIPOS[tipo].pref;
  const usados = proyecto().elementos.filter((e) => e.tipo === tipo).length;
  return tipo === 'manual' ? 'Nueva partida' : `${pref}-${usados + 1}`;
}

function crearElemento(tipo) {
  const el = nuevoElemento(tipo, nombreNuevo(tipo), uid());
  const pr = proyecto();
  pr.elementos.push(el);
  ui.cerrados.delete(`esp:${el.especialidad}`);
  ui.cerrados.delete(`grp:${tipo}`);
  persistir();
  render();
  abrirEditor(el.id);
  ui.editor.nuevo = true;
}

// ---------- ventana flotante ----------
function abrirFlotante(html, clase = '') {
  const d = $('#flotante');
  d.className = `flotante ${clase}`;
  $('#flotante-contenido').innerHTML = html;
  if (!d.open) d.showModal();
}
function cerrarFlotante() {
  const d = $('#flotante');
  if (d.open) d.close();
}

// ---------- vista Resumen ----------
function vistaResumen() {
  const pr = proyecto();
  if (!pr) return '<p class="vacio">No hay proyecto seleccionado.</p>';
  const sel = pr.seleccion;
  const s = resumen(pr, S.tablas, sel);
  const D = S.tablas.acero.diametros;
  const total = pr.elementos.reduce((a, e) => a + (e.oculto ? 0 : Object.values(e.partidas).filter((p) => p.activa !== false).length), 0);

  // árbol de selección
  let arbol = '';
  for (const [ek, esp] of Object.entries(ESPECIALIDADES)) {
    const els = pr.elementos.filter((e) => e.especialidad === ek && !e.oculto);
    if (!els.length) continue;
    arbol += `<div class="sel-esp">${selCheck(`esp:${ek}`, esp.nombre, els)}`;
    for (const [tk, t] of Object.entries(TIPOS).filter(([, x]) => x.esp === ek)) {
      const g = els.filter((e) => e.tipo === tk);
      if (!g.length) continue;
      arbol += `<div class="sel-tipo">${selCheck(`tipo:${tk}`, t.plural, g)}<div class="sel-els">`;
      for (const el of g) {
        arbol += `<div class="sel-el"><span>${esc(el.nombre)}</span>${Object.keys(el.partidas).filter((c) => el.partidas[c].activa !== false).map((c) => {
          const on = seleccionada(el, c, { excluidos: sel.excluidos });
          return `<label class="chk-chip${el.partidas[c].ejecutado ? ' hecho' : ''}"><input type="checkbox" data-sel="${claveSel(el, c)}"${on ? ' checked' : ''}>${esc(c === 'manual' ? 'Partida' : PARTIDAS[c].nombre)}</label>`;
        }).join('')}</div>`;
      }
      arbol += '</div></div>';
    }
    arbol += '</div>';
  }

  const orden = (m) => (m.clave.startsWith('acero') ? 1 : m.clave.startsWith('ladrillo') ? 2 : m.clave.startsWith('acc_') || ['madera', 'clavos', 'alambre8'].includes(m.clave) ? 3 : m.clave.startsWith('man_') ? 4 : 0);
  const mats = [...s.materiales].sort((a, b) => orden(a) - orden(b));
  const filasMat = mats.map((m) => {
    const diam = m.clave.startsWith('acero_') ? m.clave.slice(6) : null;
    return `<tr><td>${esc(m.nombre)}</td><td>${esc(m.und)}</td><td class="n">${cantTxt(m.cantidad, m.und)}</td><td class="n">${diam && s.corte[diam] ? `<b>${s.corte[diam].varillas}</b>` : ''}</td></tr>`;
  }).join('');
  const hhTot = CATEGORIAS.reduce((a, c) => a + s.hh[c], 0);
  const filasHH = CATEGORIAS.filter((c) => s.hh[c] > 0).map((c) => `<tr><td>${NOMBRE_CATEGORIA[c]}</td><td class="n">${fmt(s.hh[c])}</td><td class="n">${sol(s.hh[c] * num(S.tablas.costoHH[c]))}</td></tr>`).join('');
  const filasG = s.grupos.map((g) => `<tr><td>${esc(g.nombre)} <small>(${g.elementos})</small></td><td class="n">${fmt(g.cantidad)} ${esc(g.und)}</td><td class="n">${fmt(g.hh, 1)}</td><td class="n">${fmt(g.dias, 1)}</td><td class="n">${sol(g.costo)}</td></tr>`).join('');
  const errores = s.filas.filter((f) => f.r.error).map((f) => `<li>${esc(f.el.nombre)} · ${esc(PARTIDAS[f.clave].nombre)}: ${esc(f.r.error)}</li>`).join('');
  const kgAcero = mats.filter((m) => m.clave.startsWith('acero_')).reduce((a, m) => a + m.cantidad, 0);

  return `<div class="cab-vista"><h2>Resumen</h2></div>
    <div class="segmento" role="group" aria-label="Qué incluir">
      <button type="button" data-act="sel-modo" data-v="todo" aria-pressed="${sel.modo !== 'pendiente'}">Todo el proyecto</button>
      <button type="button" data-act="sel-modo" data-v="pendiente" aria-pressed="${sel.modo === 'pendiente'}">Solo por avanzar</button>
    </div>
    <details class="arbol" id="arbol"${ui.arbolAbierto ? ' open' : ''}>
      <summary>Elegir partidas · ${s.filas.length} de ${total}</summary>
      <div class="barra-acciones"><button type="button" class="link" data-act="sel-todo">Marcar todo</button><button type="button" class="link" data-act="sel-nada">Desmarcar todo</button></div>
      ${arbol || '<p class="nota">No hay partidas.</p>'}
    </details>
    ${errores ? `<ul class="errores">${errores}</ul>` : ''}
    <div class="cifras grandes">
      <div><span>Cemento</span><b>${fmt(s.materiales.find((m) => m.clave === 'cemento')?.cantidad || 0, 1)} bls</b></div>
      <div><span>Acero</span><b>${fmt(kgAcero, 0)} kg</b><small>${Object.values(s.corte).reduce((a, c) => a + c.varillas, 0)} varillas</small></div>
      <div><span>Mano de obra</span><b>${sol(s.costo)}</b><small>${fmt(s.dias, 1)} días · ${fmt(hhTot, 0)} HH</small></div>
    </div>
    <h3>Materiales</h3>
    ${mats.length ? `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Material</th><th>Und</th><th class="n">Cantidad</th><th class="n">Varillas ${esc(S.tablas.acero.longitudVarilla)} m</th></tr></thead><tbody>${filasMat}</tbody></table></div>` : '<p class="vacio">Nada seleccionado.</p>'}
    ${Object.keys(s.corte).length ? `<details class="seccion-tabla"><summary>Corte de varillas de lo seleccionado</summary>
      ${Object.entries(s.corte).map(([d, c]) => `<p class="nota"><b>Ø ${esc(D[d].nombre)}: ${c.varillas} varillas</b> (desperdicio ${fmt(c.desperdicio, 1)} %)<br>${c.patrones.map((p) => `${p.veces} × [${esc(textoPatron(p))}]`).join('<br>')}</p>`).join('')}
    </details>` : ''}
    <h3>Rendimiento por partida</h3>
    <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Partida</th><th class="n">Metrado</th><th class="n">HH</th><th class="n">Días</th><th class="n">M.O.</th></tr></thead><tbody>${filasG}</tbody></table></div>
    <h3>Horas-hombre</h3>
    <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Categoría</th><th class="n">HH</th><th class="n">Costo</th></tr></thead><tbody>${filasHH}</tbody>
    <tfoot><tr><td>Total</td><td class="n">${fmt(hhTot)}</td><td class="n">${sol(s.costo)}</td></tr></tfoot></table></div>
    <p class="nota">Días por partida con sus cuadrillas; el total asume que no se traslapan. Cantidades con desperdicio según Tablas.</p>
    <div class="acciones"><button type="button" class="primario" data-act="csv">Exportar selección a Excel (CSV)</button></div>`;
}

function selCheck(k, nombre, els) {
  const sel = proyecto().seleccion;
  let on = 0;
  let tot = 0;
  for (const el of els) {
    for (const c of Object.keys(el.partidas)) {
      if (el.partidas[c].activa === false) continue;
      tot++;
      if (!sel.excluidos[claveSel(el, c)]) on++;
    }
  }
  const estado = on === tot ? ' checked' : on ? ' data-indet' : '';
  return `<label class="sel-grupo"><input type="checkbox" data-selgrupo="${k}"${estado}><span>${esc(nombre)}</span></label>`;
}

// ---------- vista Obra (rendimiento real) ----------
function opcionesPartidasObra(pr) {
  const o = {};
  for (const el of pr.elementos) {
    for (const c of Object.keys(el.partidas)) {
      if (el.partidas[c].activa === false) continue;
      o[`${el.id}:${c}`] = `${el.nombre} · ${c === 'manual' ? el.partidas.manual.und || 'Partida' : PARTIDAS[c].nombre}`;
    }
  }
  return o;
}

function grupoObra(pr, reg) {
  const el = pr.elementos.find((e) => e.id === reg.elementoId);
  if (!el || !el.partidas[reg.partida]) return null;
  const rk = claveRendimiento(el, reg.partida);
  if (rk) return { clave: rk, nombre: S.tablas.rendimientos[rk]?.nombre || rk, tabla: S.tablas.rendimientos[rk], und: S.tablas.rendimientos[rk]?.und };
  const p = el.partidas[reg.partida];
  return { clave: `manual:${el.id}`, nombre: el.nombre, tabla: { rend: p.rend, und: p.und, ...(p.cuadrilla || {}) }, und: p.und, elId: el.id };
}

function vistaObra() {
  const pr = proyecto();
  if (!pr) return '<p class="vacio">No hay proyecto seleccionado.</p>';
  const ops = opcionesPartidasObra(pr);
  const f = ui.obraForm ||= { sel: Object.keys(ops)[0] || '', fecha: new Date().toISOString().slice(0, 10), cantidad: '', horas: 8, personas: { capataz: 0, operario: 1, oficial: 0, peon: 1 }, nota: '' };
  if (!ops[f.sel]) f.sel = Object.keys(ops)[0] || '';

  const grupos = new Map();
  for (const r of pr.registros) {
    const g = grupoObra(pr, r);
    if (!g) continue;
    const x = grupos.get(g.clave) || { ...g, registros: [] };
    x.registros.push(r);
    grupos.set(g.clave, x);
  }

  const tarjetas = [...grupos.values()].map((g) => {
    const s = resumenObra(g.registros, g.tabla);
    if (!s) return '';
    const ef = s.eficiencia;
    const tono = ef === undefined ? '' : ef >= 100 ? 'bien' : ef >= 80 ? 'medio' : 'bajo';
    const crew = CATEGORIAS.filter((c) => s.cuadrilla[c]).map((c) => `${fmt(s.cuadrilla[c], 1)} ${NOMBRE_CATEGORIA[c].toLowerCase()}`).join(' + ');
    const pend = metradoPendiente(pr, g.clave);
    return `<article class="obra-grupo">
      <div class="obra-cab"><h4>${esc(g.nombre)}</h4>${ef !== undefined ? `<span class="estado ${tono}">${fmt(ef, 0)} % de CAPECO</span>` : ''}</div>
      <div class="cifras">
        <div><span>Real</span><b>${fmt(s.hhPorUnidad, 2)} HH/${esc(g.und)}</b><small>${fmt(s.rend, 2)} ${esc(g.und)}/día con ${esc(crew)}</small></div>
        <div><span>CAPECO</span><b>${s.hhCapeco ? `${fmt(s.hhCapeco, 2)} HH/${esc(g.und)}` : '–'}</b><small>${g.tabla?.rend ? `${fmt(num(g.tabla.rend))} ${esc(g.und)}/día` : ''}</small></div>
        <div><span>Medido</span><b>${fmt(s.cantidad, 2)} ${esc(g.und)}</b><small>${g.registros.length} registro${g.registros.length > 1 ? 's' : ''} · ${fmt(s.hh, 1)} HH</small></div>
      </div>
      <div class="calc-dias">
        <label class="campo"><span>Me falta (${esc(g.und)})</span><input type="number" inputmode="decimal" step="any" min="0" data-calc="${esc(g.clave)}" data-campo="cant" value="${esc(fmt(pend, 2).replace(/,/g, ''))}"></label>
        <label class="campo"><span>Personas</span><input type="number" inputmode="decimal" step="1" min="1" data-calc="${esc(g.clave)}" data-campo="pers" value="${esc(Math.round(CATEGORIAS.reduce((a, c) => a + s.cuadrilla[c], 0)) || 2)}"></label>
        <output class="dias" data-hh="${s.hhPorUnidad}">${diasTxt(pend, s.hhPorUnidad, Math.round(CATEGORIAS.reduce((a, c) => a + s.cuadrilla[c], 0)) || 2)}</output>
      </div>
      <div class="acciones">
        <button type="button" class="primario chico" data-act="obra-aplicar" data-g="${esc(g.clave)}">Usar en mis partidas</button>
        ${g.clave.startsWith('manual:') ? '' : `<button type="button" class="secundario chico" data-act="obra-tabla" data-g="${esc(g.clave)}">Usar en tabla general</button>`}
      </div>
      <details><summary>Registros</summary><ul class="registros">${g.registros.map((r) => {
        const x = rendimientoRegistro(r);
        const el = pr.elementos.find((e) => e.id === r.elementoId);
        return `<li><span>${esc(r.fecha)} · ${esc(el?.nombre || '')}: ${fmt(num(r.cantidad))} ${esc(g.und)} en ${fmt(num(r.horas), 1)} h, ${x ? x.personas : 0} pers.${r.nota ? ` · ${esc(r.nota)}` : ''}</span>
          <button type="button" class="quitar" data-act="reg-borrar" data-id="${r.id}">Borrar</button></li>`;
      }).join('')}</ul></details>
    </article>`;
  }).join('');

  const prev = previaRegistro(pr, f);
  return `<div class="cab-vista"><h2>Rendimiento en obra</h2></div>
    <p class="nota">Anota lo que avanzó tu gente: cuánto hicieron, en cuántas horas y con cuántas personas. La app calcula tu rendimiento real y lo compara con CAPECO.</p>
    <form id="form-registro" class="tarjeta-form">
      <div class="rejilla">
        <label class="campo ancho"><span>Partida</span><select data-obra="sel">${Object.entries(ops).map(([v, t]) => `<option value="${esc(v)}"${v === f.sel ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <label class="campo"><span>Fecha</span><input type="date" data-obra="fecha" value="${esc(f.fecha)}"></label>
        <label class="campo"><span>Cantidad hecha</span><input type="number" inputmode="decimal" step="any" min="0" data-obra="cantidad" value="${esc(f.cantidad)}" placeholder="Ej. 6"></label>
        <label class="campo"><span>Horas trabajadas</span><input type="number" inputmode="decimal" step="any" min="0" data-obra="horas" value="${esc(f.horas)}"></label>
      </div>
      <div class="personas">${CATEGORIAS.map((c) => `<div class="paso-campo"><span>${NOMBRE_CATEGORIA[c]}</span><div class="paso">
        <button type="button" data-act="pers" data-c="${c}" data-d="-1" aria-label="Menos ${NOMBRE_CATEGORIA[c]}">−</button><output>${num(f.personas[c])}</output><button type="button" data-act="pers" data-c="${c}" data-d="1" aria-label="Más ${NOMBRE_CATEGORIA[c]}">+</button></div></div>`).join('')}</div>
      <label class="campo"><span>Nota (opcional)</span><input type="text" data-obra="nota" value="${esc(f.nota)}" placeholder="Clima, material, etc."></label>
      <p class="previa" id="previa-registro">${prev}</p>
      <button type="submit" class="primario">Registrar</button>
    </form>
    ${tarjetas || '<p class="vacio">Aún no hay registros. El primero aparecerá aquí con su comparación.</p>'}`;
}

function diasTxt(cant, hh, pers) {
  const d = diasConCuadrilla(cant, hh, pers);
  return `${fmt(d, 1)} días con ${fmt(num(pers), 0)} personas`;
}

function previaRegistro(pr, f) {
  const x = rendimientoRegistro(f);
  if (!x) return 'Completa cantidad, horas y personas para ver tu rendimiento.';
  const g = grupoObra(pr, { elementoId: f.sel.split(':')[0], partida: f.sel.split(':')[1] });
  const s = g ? resumenObra([f], g.tabla) : null;
  return `Rinde <b>${fmt(x.porDia)} ${esc(g?.und || '')}/día</b> · ${fmt(x.hhPorUnidad, 2)} HH/${esc(g?.und || 'und')}${s?.eficiencia !== undefined ? ` · ${fmt(s.eficiencia, 0)} % de CAPECO` : ''}`;
}

function metradoPendiente(pr, claveGrupo) {
  let tot = 0;
  for (const el of pr.elementos) {
    if (el.oculto) continue;
    for (const c of Object.keys(el.partidas)) {
      const p = el.partidas[c];
      if (p.activa === false || p.ejecutado) continue;
      const k = claveRendimiento(el, c) || `manual:${el.id}`;
      if (k !== claveGrupo) continue;
      const r = calcPartidaElemento(el, c, S.tablas);
      if (!r.error) tot += r.cantidad;
    }
  }
  return tot;
}

function aplicarObra(claveGrupo, enTabla) {
  const pr = proyecto();
  const regs = pr.registros.filter((r) => grupoObra(pr, r)?.clave === claveGrupo);
  const g = grupoObra(pr, regs[0]);
  const s = resumenObra(regs, g.tabla);
  if (!s) return;
  const rend = Math.round(s.rend * 100) / 100;
  if (enTabla) {
    Object.assign(S.tablas.rendimientos[claveGrupo], { rend, ...s.cuadrilla });
    persistir();
    aviso(`Tabla general: ${g.nombre} = ${fmt(rend)} ${g.und}/día`);
    return;
  }
  let n = 0;
  for (const el of pr.elementos) {
    for (const c of Object.keys(el.partidas)) {
      const k = claveRendimiento(el, c) || `manual:${el.id}`;
      if (k !== claveGrupo) continue;
      Object.assign(el.partidas[c], { rend, cuadrilla: { ...s.cuadrilla } });
      n++;
    }
  }
  persistir();
  aviso(`Aplicado a ${n} partida${n === 1 ? '' : 's'}: ${fmt(rend)} ${g.und}/día`);
}

// ---------- vista Tablas ----------
function editorTabla(titulo, base, filas, cols, nombreFila = (k) => k) {
  const obj = getPath(S.tablas, base);
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
    ${editorTabla('Accesorios de encofrado por m²', 'accesorios', Object.keys(T.accesorios),
      Object.entries(ACCESORIOS).map(([k, a]) => ({ k, label: `${a.nombre.split(' ')[0]} ${a.und}` })), (k) => T.encofrado[k]?.nombre || k)}
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
      <button type="button" class="peligro" data-act="restaurar">${ui.confirmar === 'tablas' ? 'Toca otra vez para restaurar' : 'Restaurar valores CAPECO'}</button>
    </div>`;
}

// ---------- vista Proyectos ----------
function vistaProyectos() {
  const items = S.proyectos.map((p) => `<li class="proyecto${p.id === S.actual ? ' activo' : ''}">
      <input aria-label="Nombre del proyecto" class="nombre-proyecto" data-renombrar="${p.id}" value="${esc(p.nombre)}">
      <span class="meta">${p.elementos.length} elementos · ${p.registros.length} registros de obra</span>
      <div class="acciones-fila">
        ${p.id === S.actual ? '<span class="chip">Abierto</span>' : `<button type="button" class="secundario" data-act="abrir" data-id="${p.id}">Abrir</button>`}
        <button type="button" class="secundario" data-act="duplicar-proyecto" data-id="${p.id}">Duplicar</button>
        <button type="button" class="peligro" data-act="borrar-proyecto" data-id="${p.id}">${ui.confirmar === p.id ? 'Confirmar' : 'Borrar'}</button>
      </div></li>`).join('');
  return `<div class="cab-vista"><h2>Proyectos</h2></div>
    <ul class="lista-proyectos">${items}</ul>
    <div class="acciones"><button type="button" class="primario" data-act="nuevo-proyecto">Nuevo proyecto</button></div>
    <h3>Respaldo</h3>
    <p class="nota">Los datos se guardan solo en este celular. Descarga un respaldo de vez en cuando o para pasarlos a otro equipo.</p>
    <div class="acciones">
      <button type="button" class="secundario" data-act="respaldo">Descargar respaldo</button>
      <label class="boton secundario" for="importar">Cargar respaldo<input id="importar" type="file" accept=".json,application/json" hidden></label>
    </div>`;
}

// ---------- render ----------
const VISTAS = { partidas: vistaPartidas, resumen: vistaResumen, obra: vistaObra, tablas: vistaTablas, proyectos: vistaProyectos };

function render() {
  const main = $('#vista');
  main.innerHTML = VISTAS[vista]();
  main.querySelectorAll('[data-indet]').forEach((i) => { i.indeterminate = true; });
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-current', b.dataset.vista === vista ? 'page' : 'false'));
  $('#proyecto-actual').textContent = proyecto()?.nombre || '';
}

function ir(v) {
  vista = v;
  ui.confirmar = null;
  render();
  window.scrollTo(0, 0);
}

// ---------- eventos ----------
function itemNuevo(tipo, el) {
  const m = medidas(el);
  if (tipo === 'barras') return { tipo, uso: 'Barras', diam: '1/2', cant: 4, long: 3, ganchos: 0, traslapes: 0 };
  if (tipo === 'malla') return { tipo, uso: 'Malla', diam: '3/8', sep: 0.2, rec: 0.05, dir: 'X', ganchos: 0, capas: 1 };
  return {
    tipo, uso: 'Estribos', diam: '3/8', b: m.b ?? 0.25, h: m.h ?? 0.25, rec: 0.04, long: m.H ?? m.L ?? 3,
    tramos: structuredClone(PRESETS.columna.tramos), resto: PRESETS.columna.resto,
  };
}

function accionEditor(b) {
  const ds = b.dataset;
  const el = ui.editor.draft;
  switch (ds.act) {
    case 'modo': {
      const p = el.partidas[ds.p];
      if (ds.v === 'fijo') p.fijo = p.fijo ?? Math.round(calcPartidaElemento(el, ds.p, S.tablas).cantidad * 100) / 100;
      else p.fijo = null;
      rehacerTab();
      return true;
    }
    case 'item-agregar': el.partidas.acero.armado.push(itemNuevo(ds.tipo, el)); rehacerTab(); return true;
    case 'item-quitar': el.partidas.acero.armado.splice(Number(ds.i), 1); rehacerTab(); return true;
    case 'armado-tipico': el.partidas.acero.armado = TIPOS[el.tipo].armado(medidas(el)); rehacerTab(); return true;
    case 'tramo-n': {
      const v = Math.max(0, num(getPath(el, ds.path)) + Number(ds.d));
      setPath(el, ds.path, v);
      refrescarTramos(ds.path);
      return true;
    }
    case 'tramo-agregar': getPath(el, ds.path).push({ n: 1, s: 0.1 }); refrescarTramos(ds.path); return true;
    case 'tramo-quitar': getPath(el, ds.path).splice(Number(ds.i), 1); refrescarTramos(ds.path); return true;
    case 'preset': {
      const it = getPath(el, ds.path);
      it.tramos = structuredClone(PRESETS[ds.preset].tramos);
      it.resto = PRESETS[ds.preset].resto;
      refrescarTramos(`${ds.path}.tramos`);
      return true;
    }
    case 'vano-agregar': el.partidas.muro.vanos.push({ ancho: 1, alto: 2.1, cant: 1 }); rehacerTab(); return true;
    case 'vano-quitar': el.partidas.muro.vanos.splice(Number(ds.i), 1); rehacerTab(); return true;
    case 'mat-agregar': (el.partidas.manual.materiales ||= []).push({ nombre: '', und: 'und', porUnidad: 1 }); rehacerTab(); return true;
    case 'mat-quitar': el.partidas.manual.materiales.splice(Number(ds.i), 1); rehacerTab(); return true;
    case 'zoom': abrirFlotante(`<div class="flot-cab"><h3>${esc(TIPOS[el.tipo].nombre)} · ${esc(el.nombre)}</h3><button type="button" class="cerrar" data-act="cerrar-flotante" aria-label="Cerrar">✕</button></div>${figuraElemento(el.tipo, medidas(el), el)}<p class="nota">Las letras de la figura son las mismas de los campos de medidas.</p>`, 'grande'); return true;
    case 'cerrar-editor': cerrarEditor(); return true;
    default: return false;
  }
}

function refrescarTramos(path) {
  const m = /armado\.(\d+)/.exec(path);
  if (!m) return;
  const i = Number(m[1]);
  const it = ui.editor.draft.partidas.acero.armado[i];
  $(`#tramos-${i}`).innerHTML = tramosHTML(it, `partidas.acero.armado.${i}`);
  refrescarVivo(`partidas.acero.armado.${i}.`);
}

document.addEventListener('click', (ev) => {
  const b = ev.target.closest('button, [data-act]');
  if (!b) return;
  const ds = b.dataset;
  if (ds.vista) { cerrarEditor(); ir(ds.vista); return; }
  if (ds.tabe && ui.editor) {
    ui.editor.tab = ds.tabe;
    $('#hoja-contenido').innerHTML = editorHTML();
    return;
  }
  if (ds.editar) { abrirEditor(ds.editar, ds.tab); return; }
  if (ds.nuevo) { cerrarFlotante(); crearElemento(ds.nuevo); return; }
  if (ds.toggle) {
    if (ui.cerrados.has(ds.toggle)) ui.cerrados.delete(ds.toggle); else ui.cerrados.add(ds.toggle);
    render();
    return;
  }
  if (ds.menu) { abrirFlotante(menuElemento(proyecto().elementos.find((e) => e.id === ds.menu)), 'menu-flot'); return; }
  if (ui.editor && accionEditor(b)) return;

  const pr = proyecto();
  switch (ds.act) {
    case 'selector': abrirFlotante(selectorTipos(), 'grande'); break;
    case 'cerrar-flotante': cerrarFlotante(); break;
    case 'desplegar': ui.cerrados.clear(); render(); break;
    case 'contraer':
      Object.keys(ESPECIALIDADES).forEach((k) => ui.cerrados.add(`esp:${k}`));
      Object.keys(TIPOS).forEach((k) => ui.cerrados.add(`grp:${k}`));
      render();
      break;
    case 'duplicar': {
      const i = pr.elementos.findIndex((e) => e.id === ds.id);
      const c = structuredClone(pr.elementos[i]);
      c.id = uid();
      c.nombre += ' (copia)';
      pr.elementos.splice(i + 1, 0, c);
      persistir(); cerrarFlotante(); render(); aviso('Elemento duplicado');
      break;
    }
    case 'ocultar': {
      const el = pr.elementos.find((e) => e.id === ds.id);
      el.oculto = !el.oculto;
      persistir(); cerrarFlotante(); render(); aviso(el.oculto ? `${el.nombre} oculto: no suma` : `${el.nombre} visible`);
      break;
    }
    case 'mover': {
      const i = pr.elementos.findIndex((e) => e.id === ds.id);
      const j = i + Number(ds.d);
      if (j < 0 || j >= pr.elementos.length) break;
      [pr.elementos[i], pr.elementos[j]] = [pr.elementos[j], pr.elementos[i]];
      persistir(); render();
      abrirFlotante(menuElemento(pr.elementos[j]), 'menu-flot');
      break;
    }
    case 'borrar-elemento': {
      const i = pr.elementos.findIndex((e) => e.id === ds.id);
      const [el] = pr.elementos.splice(i, 1);
      const regs = pr.registros.filter((r) => r.elementoId === el.id);
      pr.registros = pr.registros.filter((r) => r.elementoId !== el.id);
      ui.deshacer = { el, i, regs, proyecto: pr.id };
      persistir(); cerrarFlotante(); render();
      aviso(`${el.nombre} borrado`, { act: 'deshacer', texto: 'Deshacer' });
      break;
    }
    case 'deshacer': {
      const u = ui.deshacer;
      const p = S.proyectos.find((x) => x.id === u?.proyecto);
      if (!p) break;
      p.elementos.splice(u.i, 0, u.el);
      p.registros.push(...u.regs);
      ui.deshacer = null;
      persistir(); render(); $('#aviso').hidden = true;
      break;
    }
    case 'sel-modo': pr.seleccion.modo = ds.v; persistir(); render(); break;
    case 'sel-todo': pr.seleccion.excluidos = {}; ui.arbolAbierto = true; persistir(); render(); break;
    case 'sel-nada':
      for (const el of pr.elementos) for (const c of Object.keys(el.partidas)) pr.seleccion.excluidos[claveSel(el, c)] = true;
      ui.arbolAbierto = true; persistir(); render();
      break;
    case 'pers': {
      const f = ui.obraForm;
      f.personas[ds.c] = Math.max(0, num(f.personas[ds.c]) + Number(ds.d));
      b.parentElement.querySelector('output').textContent = f.personas[ds.c];
      $('#previa-registro').innerHTML = previaRegistro(pr, f);
      break;
    }
    case 'reg-borrar': pr.registros = pr.registros.filter((r) => r.id !== ds.id); persistir(); render(); break;
    case 'obra-aplicar': aplicarObra(ds.g, false); render(); break;
    case 'obra-tabla': aplicarObra(ds.g, true); render(); break;
    case 'abrir': S.actual = ds.id; ui.obraForm = null; persistir(); ir('partidas'); break;
    case 'duplicar-proyecto': {
      const copia = structuredClone(S.proyectos.find((p) => p.id === ds.id));
      copia.id = uid();
      copia.nombre += ' (copia)';
      const mapa = {};
      copia.elementos.forEach((e) => { mapa[e.id] = uid(); e.id = mapa[e.id]; });
      copia.registros.forEach((r) => { r.id = uid(); r.elementoId = mapa[r.elementoId]; });
      copia.seleccion = { excluidos: {}, modo: copia.seleccion?.modo || 'todo' };
      S.proyectos.push(copia);
      persistir(); render();
      break;
    }
    case 'borrar-proyecto':
      if (ui.confirmar !== ds.id) { ui.confirmar = ds.id; render(); break; }
      S.proyectos = S.proyectos.filter((p) => p.id !== ds.id);
      if (S.actual === ds.id) S.actual = S.proyectos[0]?.id;
      ui.confirmar = null; persistir(); render(); aviso('Proyecto borrado');
      break;
    case 'nuevo-proyecto': {
      const p = { id: uid(), nombre: `Proyecto ${S.proyectos.length + 1}`, creado: new Date().toISOString(), elementos: [], registros: [], seleccion: { excluidos: {}, modo: 'todo' } };
      S.proyectos.push(p);
      S.actual = p.id;
      ui.obraForm = null;
      persistir(); ir('partidas');
      break;
    }
    case 'restaurar':
      if (ui.confirmar !== 'tablas') { ui.confirmar = 'tablas'; render(); break; }
      restaurarTablas(S); ui.confirmar = null; persistir(); render(); aviso('Tablas restauradas');
      break;
    case 'csv': exportarCSV(); break;
    case 'respaldo': descargar(`metrado-respaldo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(S, null, 1), 'application/json'); break;
    default:
  }
});

// Cerrar la hoja tocando el fondo
$('#flotante').addEventListener('click', (ev) => { if (ev.target.id === 'flotante') cerrarFlotante(); });
$('#hoja').addEventListener('cancel', (ev) => { ev.preventDefault(); cerrarEditor(); });

document.addEventListener('input', (ev) => {
  const el = ev.target;
  const pr = proyecto();
  if (el.dataset.k && ui.editor) {
    const val = 'bool' in el.dataset ? el.checked : el.value;
    setPath(ui.editor.draft, el.dataset.k, val);
    if (el.dataset.k === 'nombre') return;
    if ('rehacer' in el.dataset) rehacerTab();
    else refrescarVivo(el.dataset.k);
    return;
  }
  if (el.dataset.t) { setPath(S.tablas, el.dataset.t, num(el.value)); persistir(); return; }
  if (el.dataset.renombrar) {
    S.proyectos.find((p) => p.id === el.dataset.renombrar).nombre = el.value;
    persistir();
    $('#proyecto-actual').textContent = proyecto()?.nombre || '';
    return;
  }
  if (el.dataset.sel) {
    if (el.checked) delete pr.seleccion.excluidos[el.dataset.sel]; else pr.seleccion.excluidos[el.dataset.sel] = true;
    ui.arbolAbierto = true; persistir(); render();
    return;
  }
  if (el.dataset.selgrupo) {
    const [nivel, k] = el.dataset.selgrupo.split(':');
    for (const e of pr.elementos) {
      if ((nivel === 'esp' && e.especialidad !== k) || (nivel === 'tipo' && e.tipo !== k)) continue;
      for (const c of Object.keys(e.partidas)) {
        if (el.checked) delete pr.seleccion.excluidos[claveSel(e, c)]; else pr.seleccion.excluidos[claveSel(e, c)] = true;
      }
    }
    ui.arbolAbierto = true; persistir(); render();
    return;
  }
  if (el.dataset.obra) {
    ui.obraForm[el.dataset.obra] = el.value;
    $('#previa-registro').innerHTML = previaRegistro(pr, ui.obraForm);
    return;
  }
  if (el.dataset.calc) {
    const card = el.closest('.obra-grupo');
    const cant = $('[data-campo="cant"]', card).value;
    const pers = $('[data-campo="pers"]', card).value;
    const out = $('output.dias', card);
    out.textContent = diasTxt(num(cant), num(out.dataset.hh), num(pers));
  }
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset.act === 'cuadrilla-propia' && ui.editor) {
    const d = ui.editor.draft;
    const p = d.partidas[el.dataset.p];
    if (el.checked) {
      const rk = claveRendimiento(d, el.dataset.p);
      const rt = rk ? S.tablas.rendimientos[rk] : {};
      p.cuadrilla = Object.fromEntries(CATEGORIAS.map((c) => [c, num(rt[c])]));
    } else {
      p.cuadrilla = null;
    }
    rehacerTab();
  }
});
document.addEventListener('toggle', (ev) => { if (ev.target.id === 'arbol') ui.arbolAbierto = ev.target.open; }, true);

document.addEventListener('submit', (ev) => {
  ev.preventDefault();
  if (ev.target.id === 'editor') { guardarEditor(); return; }
  if (ev.target.id === 'form-registro') {
    const pr = proyecto();
    const f = ui.obraForm;
    if (!rendimientoRegistro(f) || !f.sel) { aviso('Completa cantidad, horas y al menos una persona'); return; }
    const [elementoId, partida] = f.sel.split(':');
    pr.registros.push({ id: uid(), fecha: f.fecha, elementoId, partida, cantidad: num(f.cantidad), horas: num(f.horas), personas: { ...f.personas }, nota: f.nota });
    f.cantidad = '';
    f.nota = '';
    persistir(); render(); aviso('Registro guardado');
  }
});

document.addEventListener('change', async (ev) => {
  if (ev.target.id !== 'importar') return;
  const f = ev.target.files[0];
  if (!f) return;
  try {
    const d = importar(await f.text());
    Object.keys(S).forEach((k) => delete S[k]);
    Object.assign(S, d);
    persistir(); ir('partidas'); aviso('Respaldo cargado');
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
  const s = resumen(pr, S.tablas, pr.seleccion);
  const n = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '');
  const q = (t) => `"${String(t).replace(/"/g, '""')}"`;
  const L = [[q(`Proyecto: ${pr.nombre}`)], [q(pr.seleccion.modo === 'pendiente' ? 'Solo por avanzar' : 'Selección')], [],
    ['Especialidad', 'Elemento', 'Partida', 'Metrado', 'Und', 'Rend/dia', 'Dias', 'HH', 'Costo MO S/'].map(q)];
  for (const { el, clave, r } of s.filas) {
    const R = r.rendimiento;
    L.push([q(ESPECIALIDADES[el.especialidad].nombre), q(`${el.nombre} x${el.n}`), q(r.nombre), r.error ? q(r.error) : n(r.cantidad), q(r.und), R ? n(R.rend) : '', R ? n(R.dias, 1) : '', R ? n(R.hhTotal) : '', R ? n(R.costo) : '']);
  }
  L.push([], [q('Materiales')], ['Material', 'Und', 'Cantidad', 'Varillas'].map(q));
  for (const m of s.materiales) {
    const diam = m.clave.startsWith('acero_') ? m.clave.slice(6) : null;
    L.push([q(m.nombre), q(m.und), n(m.cantidad), diam && s.corte[diam] ? s.corte[diam].varillas : '']);
  }
  L.push([], [q('Mano de obra')], ['Categoria', 'HH', 'Costo S/'].map(q));
  for (const c of CATEGORIAS) L.push([q(NOMBRE_CATEGORIA[c]), n(s.hh[c]), n(s.hh[c] * num(S.tablas.costoHH[c]))]);
  const csv = `﻿${L.map((f) => f.join(';')).join('\r\n')}`;
  descargar(`metrado-${pr.nombre.replace(/[^\w-]+/g, '_')}.csv`, csv, 'text/csv;charset=utf-8');
}

// ---------- inicio ----------
render();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
