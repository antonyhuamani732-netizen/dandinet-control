// Calculadora de obra en ventana flotante: libre (fórmulas), acero, concreto, ladrillos y conversiones.
import { num, evaluar } from '../calc/util.js';
import { optimizarCorte } from '../calc/corte.js';
import { porM2 } from '../calc/muros.js';
import { fichaDiametro } from '../calc/norma.js';
import { icono } from './iconos.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f = (n, d = 2) => (Number.isFinite(n) ? n : 0).toLocaleString('es-PE', { minimumFractionDigits: d, maximumFractionDigits: d });

const PESTANAS = { libre: 'Libre', acero: 'Acero', concreto: 'Concreto', ladrillos: 'Ladrillos', conversion: 'Conversión' };
const estado = { tab: 'libre', historial: [], v: {} };

const val = (k, def = '') => estado.v[k] ?? def;
const entrada = (k, label, def = '', ph = '') => `<label class="campo"><span>${esc(label)}</span><input type="text" inputmode="decimal" data-cv="${k}" value="${esc(val(k, def))}" placeholder="${esc(ph)}"></label>`;
const lista = (k, label, ops, def) => `<label class="campo"><span>${esc(label)}</span><select data-cv="${k}">${Object.entries(ops).map(([v, t]) => `<option value="${esc(v)}"${String(val(k, def)) === String(v) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
const res = (filas) => `<dl class="calc-res">${filas.map(([t, v, fuerte]) => `<div${fuerte ? ' class="fuerte"' : ''}><dt>${esc(t)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;

function cuerpo(T) {
  const D = T.acero.diametros;
  const dia = Object.fromEntries(Object.entries(D).map(([k, v]) => [k, `Ø ${v.nombre}`]));
  const V = num(T.acero.longitudVarilla);
  switch (estado.tab) {
    case 'acero': {
      const d = val('a_d', '1/2');
      const L = num(val('a_l', '5.4'));
      const n = num(val('a_n', '4'));
      const kg = L * n * D[d].kgm;
      const corte = L > 0 && n > 0 ? optimizarCorte([{ long: L, cant: Math.round(n) }], V, D[d].traslape) : { varillas: 0, desperdicio: 0 };
      const fi = fichaDiametro(d, T);
      return `<div class="rejilla">${lista('a_d', 'Diámetro', dia, '1/2')}${entrada('a_l', 'Largo de cada pieza (m)', '5.4', '25.283/2')}${entrada('a_n', 'Cantidad de piezas', '4')}</div>
        ${res([['Longitud total', `${f(L * n)} m`], ['Peso', `${f(kg)} kg`, true], [`Varillas de ${V} m (corte)`, `${corte.varillas} <small>(desp. ${f(corte.desperdicio, 1)} %)</small>`, true],
          [`Por peso + ${f(num(T.acero.despPeso), 0)} %`, `${Math.ceil((kg / (D[d].kgm * V)) * (1 + num(T.acero.despPeso) / 100) - 1e-9)}`], ['Diámetro', `${f(fi.mm, 1)} mm · ${esc(fi.pulg)}`], ['Peso de una varilla', `${f(fi.pesoVarilla)} kg`]])}`;
    }
    case 'concreto': {
      const fc = val('c_fc', '210');
      const vol = num(val('c_l', '1')) * num(val('c_a', '1')) * num(val('c_h', '1')) * (num(val('c_n', '1')) || 1);
      const c = T.concreto.fc[fc];
      const fd = 1 + num(T.concreto.desperdicio) / 100;
      return `<div class="rejilla">${entrada('c_l', 'Largo (m)', '1')}${entrada('c_a', 'Ancho (m)', '1')}${entrada('c_h', 'Alto (m)', '1')}${entrada('c_n', 'N° de veces', '1')}
        ${lista('c_fc', 'Resistencia', Object.fromEntries(Object.keys(T.concreto.fc).map((k) => [k, `f'c = ${k} kg/cm²`])), '210')}</div>
        ${res([['Volumen', `${f(vol, 3)} m³`, true], [`Cemento (+${f(num(T.concreto.desperdicio), 0)} %)`, `${f(vol * c.cemento * fd)} bls`, true], ['Arena gruesa', `${f(vol * c.arena * fd)} m³`],
          ['Piedra chancada', `${f(vol * c.piedra * fd)} m³`], ['Agua', `${f(vol * c.agua * fd * 1000, 0)} litros`]])}`;
    }
    case 'ladrillos': {
      const lad = val('l_t', 'kk18');
      const ap = val('l_ap', 'soga');
      const area = Math.max(0, num(val('l_l', '5')) * num(val('l_h', '2.6')) - num(val('l_v', '0')));
      const u = porM2(T.ladrillos[lad], ap, num(val('l_j', '1.5')));
      const mo = T.mortero[val('l_m', '1:4')];
      const vm = area * u.mortero * (1 + num(T.desperdicioMortero) / 100);
      return `<div class="rejilla">${entrada('l_l', 'Largo del muro (m)', '5')}${entrada('l_h', 'Alto (m)', '2.6')}${entrada('l_v', 'Área de vanos (m²)', '0', '0.9*2.1+1.2*1')}
        ${lista('l_t', 'Ladrillo', Object.fromEntries(Object.entries(T.ladrillos).map(([k, v]) => [k, v.nombre])), 'kk18')}
        ${lista('l_ap', 'Aparejo', { soga: 'Soga', cabeza: 'Cabeza', canto: 'Canto' }, 'soga')}${entrada('l_j', 'Junta (cm)', '1.5')}
        ${lista('l_m', 'Mortero', Object.fromEntries(Object.keys(T.mortero).map((k) => [k, `C:A ${k}`])), '1:4')}</div>
        ${res([['Área neta', `${f(area)} m²`], ['Ladrillos por m²', f(u.ladrillos, 1)], [`Ladrillos (+${f(num(T.desperdicioLadrillo), 0)} %)`, f(area * u.ladrillos * (1 + num(T.desperdicioLadrillo) / 100), 0), true],
          ['Mortero', `${f(vm, 3)} m³`], ['Cemento', `${f(vm * mo.cemento)} bls`, true], ['Arena gruesa', `${f(vm * mo.arena)} m³`]])}`;
    }
    case 'conversion': {
      const pulg = evaluar(val('v_p', '5/8'));
      const mm = num(val('v_mm', '12'));
      const d = val('v_d', '5/8');
      const kg = num(val('v_kg', '100'));
      return `<div class="rejilla">${entrada('v_p', 'Pulgadas (fracción)', '5/8')}${entrada('v_mm', 'Milímetros', '12')}</div>
        ${res([['Pulgadas → mm', Number.isFinite(pulg) ? `${f(pulg * 25.4, 2)} mm · ${f(pulg * 2.54, 2)} cm` : '—'], ['mm → pulgadas', `${f(mm / 25.4, 3)}"`]])}
        <div class="rejilla">${lista('v_d', 'Diámetro', dia, '5/8')}${entrada('v_kg', 'Peso (kg)', '100')}</div>
        ${res([['Metros de barra', `${f(kg / D[d].kgm)} m`], [`Varillas de ${V} m`, f(kg / (D[d].kgm * V), 2), true]])}`;
    }
    default: {
      const e = val('libre', '');
      const r = e ? evaluar(e) : NaN;
      return `<label class="campo ancho"><span>Escribe una operación (como en Excel)</span><input type="text" inputmode="decimal" class="calc-expr" data-cv="libre" value="${esc(e)}" placeholder="25.283/2 + 0.3*2"></label>
        <div class="calc-pantalla" id="calc-pantalla">${e ? (Number.isFinite(r) ? `= ${f(r, 4)}` : 'Revisa la operación') : '0'}</div>
        <div class="calc-teclas">${['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '(', '+', ')', '⌫', 'C', '='].map((k) => `<button type="button" data-ck="${k}">${k === '*' ? '×' : k === '/' ? '÷' : k}</button>`).join('')}</div>
        ${estado.historial.length ? `<ul class="calc-hist">${estado.historial.map((h) => `<li><button type="button" class="link" data-ch="${esc(h.e)}">${esc(h.e)} = ${f(h.r, 4)}</button></li>`).join('')}</ul>` : ''}`;
    }
  }
}

// Resultado numérico principal de la pestaña activa (para "Usar resultado").
function resultado(T) {
  if (estado.tab === 'libre') return evaluar(val('libre', ''));
  if (estado.tab === 'concreto') return num(val('c_l', '1')) * num(val('c_a', '1')) * num(val('c_h', '1')) * (num(val('c_n', '1')) || 1);
  if (estado.tab === 'acero') return num(val('a_l', '5.4')) * num(val('a_n', '4')) * T.acero.diametros[val('a_d', '1/2')].kgm;
  if (estado.tab === 'ladrillos') return Math.max(0, num(val('l_l', '5')) * num(val('l_h', '2.6')) - num(val('l_v', '0')));
  return NaN;
}

export function montarCalculadora(contenedor, T, destino) {
  const raiz = document.createElement('div');
  raiz.className = 'calc';
  contenedor.replaceChildren(raiz);
  const pintar = () => {
    const r = resultado(T);
    raiz.innerHTML = `<div class="flot-cab"><h3>${icono('calculadora')} Calculadora</h3><button type="button" class="cerrar" data-act="cerrar-flotante" aria-label="Cerrar">${icono('cerrar')}</button></div>
      <div class="pildoras" role="tablist">${Object.entries(PESTANAS).map(([k, t]) => `<button type="button" role="tab" class="pildora" data-ct="${k}" aria-selected="${k === estado.tab}">${t}</button>`).join('')}</div>
      <div class="calc-cuerpo">${cuerpo(T)}</div>
      ${destino ? `<button type="button" class="primario calc-usar" data-cu${Number.isFinite(r) ? '' : ' disabled'}>Usar ${Number.isFinite(r) ? f(r, 3) : ''} en «${esc(destino.etiqueta)}»</button>` : ''}`;
  };
  const refrescar = (foco) => {
    pintar();
    if (foco) {
      const el = raiz.querySelector(`[data-cv="${foco}"]`);
      if (el) { el.focus(); if (el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length); }
    }
  };
  raiz.addEventListener('input', (e) => {
    const k = e.target.dataset.cv;
    if (!k) return;
    estado.v[k] = e.target.value;
    refrescar(k);
  });
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.ct) { estado.tab = b.dataset.ct; refrescar(); return; }
    if (b.dataset.ch !== undefined) { estado.v.libre = b.dataset.ch; refrescar('libre'); return; }
    if (b.dataset.ck) {
      const k = b.dataset.ck;
      let e2 = val('libre', '');
      if (k === 'C') e2 = '';
      else if (k === '⌫') e2 = e2.slice(0, -1);
      else if (k === '=') {
        const r = evaluar(e2);
        if (Number.isFinite(r)) { estado.historial = [{ e: e2, r }, ...estado.historial].slice(0, 6); e2 = String(Math.round(r * 1e6) / 1e6); }
      } else e2 += k;
      estado.v.libre = e2;
      refrescar();
      return;
    }
    if ('cu' in b.dataset && destino) {
      const r = resultado(T);
      if (!Number.isFinite(r)) return;
      destino.input.value = String(Math.round(r * 1000) / 1000);
      destino.input.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#flotante')?.close();
    }
  });
  pintar();
}
