// Editor interactivo de estribos y tarjeta "Para el maestro".
import { piezasItem } from '../calc/acero.js';
import { optimizarCorte, textoPatron } from '../calc/corte.js';
import { num } from '../calc/util.js';
import { figuraDistribucion, figuraEstribo } from './figuras.js';

export const ESPACIOS = [0.05, 0.075, 0.1, 0.125, 0.15, 0.175, 0.2, 0.25, 0.3];

export const PRESETS = {
  columna: { nombre: 'Columna', tramos: [{ n: 1, s: 0.05 }, { n: 4, s: 0.1 }], resto: 0.25 },
  viga: { nombre: 'Viga', tramos: [{ n: 1, s: 0.05 }, { n: 5, s: 0.1 }], resto: 0.2 },
  sismica: { nombre: 'Confinada', tramos: [{ n: 1, s: 0.05 }, { n: 10, s: 0.1 }], resto: 0.25 },
  uniforme: { nombre: 'Uniforme @.20', tramos: [], resto: 0.2 },
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const m2 = (x) => num(x).toFixed(2);
const sep = (x) => `@${num(x).toFixed(3).replace(/0$/, '').replace(/^0\./, '.')}`;

function selectEspacio(path, valor, conCero) {
  const v = num(valor);
  const ops = [...new Set([...(conCero ? [0] : []), ...ESPACIOS, v])].sort((a, b) => a - b);
  return `<select class="sel-espacio" data-k="${path}" aria-label="Espaciamiento">${ops.map((o) => `<option value="${o}"${o === v ? ' selected' : ''}>${o === 0 ? 'sin resto' : sep(o)}</option>`).join('')}</select>`;
}

// Controles de tramos (se vuelven a dibujar al tocar +/−).
export function tramosHTML(it, base) {
  const filas = (it.tramos || []).map((t, j) => `
    <div class="tramo">
      <div class="paso" role="group" aria-label="Cantidad del tramo ${j + 1}">
        <button type="button" data-act="tramo-n" data-path="${base}.tramos.${j}.n" data-d="-1" aria-label="Menos">−</button>
        <output>${num(t.n)}</output>
        <button type="button" data-act="tramo-n" data-path="${base}.tramos.${j}.n" data-d="1" aria-label="Más">+</button>
      </div>
      ${selectEspacio(`${base}.tramos.${j}.s`, t.s)}
      <button type="button" class="quitar" data-act="tramo-quitar" data-path="${base}.tramos" data-i="${j}" aria-label="Quitar tramo">Quitar</button>
    </div>`).join('');
  return `<div class="tramos">
      <p class="nota">En cada extremo, desde la cara del apoyo:</p>
      ${filas || '<p class="nota">Sin tramos de confinamiento.</p>'}
      <button type="button" class="secundario chico" data-act="tramo-agregar" data-path="${base}.tramos">Agregar tramo</button>
      <div class="tramo resto"><span>Resto al centro</span>${selectEspacio(`${base}.resto`, it.resto, true)}</div>
      <div class="presets">${Object.entries(PRESETS).map(([k, p]) => `<button type="button" class="chip-btn" data-act="preset" data-path="${base}" data-preset="${k}">${p.nombre}</button>`).join('')}</div>
    </div>`;
}

// Parte viva: dibujo, conteo y tarjeta para el maestro.
export function estribosVivo(it, T, nElem) {
  let r;
  try { r = piezasItem(it, T); } catch (e) { return `<p class="error">${esc(e.message)}</p>`; }
  if (!r.pos) return '';
  const fijos = (it.tramos || []).reduce((s, t) => s + num(t.n), 0);
  const total = r.cant * nElem;
  const V = num(T.acero.longitudVarilla);
  const porVarilla = Math.floor(V / r.long + 1e-9);
  const corte = optimizarCorte([{ long: r.long, cant: total }], V, T.acero.diametros[it.diam].traslape);
  const textoDist = [...(it.tramos || []).filter((t) => num(t.n)).map((t) => `${num(t.n)}${sep(t.s)}`), num(it.resto) ? `resto ${sep(it.resto)}` : ''].filter(Boolean).join(', ');
  return `${figuraDistribucion(r.pos, it.long, fijos)}
    <p class="nota">Ø${esc(T.acero.diametros[it.diam].nombre)}: ${esc(textoDist || 'sin distribución')} c/extremo → <b>${r.cant} estribos</b> por elemento.</p>
    <div class="maestro">
      <h5>Para el maestro</h5>
      <div class="maestro-cuerpo">
        ${figuraEstribo(r.interior.b, r.interior.h, r.interior.gancho)}
        <dl>
          <div><dt>Medida interior</dt><dd>${m2(r.interior.b)} × ${m2(r.interior.h)} m</dd></div>
          <div><dt>Ganchos 135°</dt><dd>2 × ${m2(r.interior.gancho)} m</dd></div>
          <div><dt>Longitud de corte</dt><dd>${m2(r.long)} m</dd></div>
          <div><dt>Por elemento</dt><dd>${r.cant} und</dd></div>
          <div><dt>Total (× ${nElem})</dt><dd>${total} und</dd></div>
          <div><dt>Salen por varilla de ${V} m</dt><dd>${porVarilla} und</dd></div>
          <div><dt>Varillas a comprar</dt><dd><b>${corte.varillas}</b> (desperdicio ${corte.desperdicio.toFixed(1)} %)</dd></div>
        </dl>
      </div>
      ${corte.patrones.length ? `<p class="nota">Corte: ${corte.patrones.map((p) => `${p.veces} varilla${p.veces > 1 ? 's' : ''}: ${esc(textoPatron(p))}`).join(' · ')}</p>` : ''}
    </div>`;
}
