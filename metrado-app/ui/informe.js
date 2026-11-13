// Informe para obra: lo que hay que pedir, qué cortar y cómo armar cada elemento.
// Se ve en la app, se imprime o guarda como PDF y se comparte como texto.
import { CATEGORIAS, NOMBRE_CATEGORIA } from '../data/capeco.js';
import { ESPECIALIDADES, PARTIDAS, TIPOS, medidas } from '../data/elementos.js';
import { resumen, seleccionada } from '../calc/index.js';
import { num } from '../calc/util.js';
import { figuraElemento, figuraEstribo, figuraDistribucion } from './figuras.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f = (n, d = 2) => (Number.isFinite(n) ? n : 0).toLocaleString('es-PE', { minimumFractionDigits: d, maximumFractionDigits: d });
const sol = (n) => `S/ ${f(n)}`;

export const SECCIONES_INFORME = {
  pedido: 'Lista de pedido',
  corte: 'Corte de varillas',
  elementos: 'Elementos y armado',
  mano: 'Mano de obra y plazo',
};

// Qué pieza de qué elemento sale de cada largo de corte, por diámetro.
function usosPorLargo(filas, T) {
  const mapa = {};
  for (const { el, r } of filas) {
    if (!r.armado) continue;
    for (const d of r.armado.detalle) {
      for (const p of d.piezas) {
        const k = `${p.diam}|${p.long.toFixed(2)}`;
        (mapa[k] ||= new Set()).add(`${el.nombre}: ${d.it.uso || p.uso || 'barras'}`);
      }
    }
  }
  return mapa;
}

function textoPatron(p) {
  const cuenta = new Map();
  for (const c of p.cortes) cuenta.set(c.toFixed(2), (cuenta.get(c.toFixed(2)) || 0) + 1);
  return [...cuenta];
}

function seccionPedido(s, T) {
  const D = T.acero.diametros;
  const mats = [...s.materiales].filter((m) => !m.clave.startsWith('acero_'));
  const acero = Object.keys(s.kgPorDiam).map((d) => `<tr><td>Acero corrugado Ø ${esc(D[d].nombre)} · varillas de ${esc(T.acero.longitudVarilla)} m</td><td>var</td>
    <td class="n"><b>${s.corte[d]?.varillas ?? ''}</b></td><td class="n">${s.varillasPeso[d] ?? ''}</td><td class="n">${f(s.kgPorDiam[d])} kg</td></tr>`).join('');
  return `<section class="inf-sec" id="inf-pedido">
    <h3><span class="inf-num">1</span> Lista de pedido</h3>
    <p class="nota">Cantidades con desperdicio según Tablas. Para el acero se muestran las varillas por corte (lo justo) y por peso + ${f(num(T.acero.despPeso), 0)} % (con holgura).</p>
    ${acero ? `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Acero</th><th>Und</th><th class="n">Por corte</th><th class="n">Por peso + %</th><th class="n">Peso neto</th></tr></thead><tbody>${acero}</tbody></table></div>` : ''}
    ${mats.length ? `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Material</th><th>Und</th><th class="n">Cantidad</th></tr></thead><tbody>
      ${mats.map((m) => `<tr><td>${esc(m.nombre)}</td><td>${esc(m.und)}</td><td class="n">${f(m.cantidad, m.und === 'und' ? 0 : 2)}</td></tr>`).join('')}</tbody></table></div>` : ''}
  </section>`;
}

function seccionCorte(s, T) {
  const D = T.acero.diametros;
  const usos = usosPorLargo(s.filas, T);
  const V = num(T.acero.longitudVarilla);
  const bloques = Object.entries(s.corte).map(([d, c]) => {
    const patrones = c.patrones.map((p) => {
      const partes = textoPatron(p);
      const barra = p.cortes.map((l) => `<span class="inf-trozo" style="flex:${l}">${f(l)}</span>`).join('') + (p.sobra > 0.005 ? `<span class="inf-sobra" style="flex:${p.sobra}">${f(p.sobra)}</span>` : '');
      return `<li>
        <p><b>${p.veces} varilla${p.veces > 1 ? 's' : ''}</b>: corta ${partes.map(([l, k]) => `${k} pieza${k > 1 ? 's' : ''} de ${l} m`).join(' + ')} <span class="nota">(sobra ${f(p.sobra)} m)</span></p>
        <div class="inf-varilla" aria-hidden="true">${barra}</div>
        <p class="nota">${partes.map(([l]) => `${l} m → ${[...(usos[`${d}|${l}`] || ['traslape de barra larga'])].join('; ')}`).map(esc).join('<br>')}</p>
      </li>`;
    }).join('');
    return `<details class="inf-det" open><summary>Ø ${esc(D[d].nombre)}: ${c.varillas} varillas de ${V} m <span class="nota">(desperdicio ${f(c.desperdicio, 1)} %)</span></summary><ol class="inf-cortes">${patrones}</ol></details>`;
  }).join('');
  return `<section class="inf-sec" id="inf-corte">
    <h3><span class="inf-num">2</span> Corte de varillas</h3>
    <p class="nota">Cómo sacar las piezas de cada varilla de ${V} m con el menor sobrante. Las barras de más de ${V} m se parten con su traslape. Corta primero las piezas largas.</p>
    ${bloques || '<p class="nota">Sin acero en la selección.</p>'}
  </section>`;
}

function piezaFila(el, d, T) {
  const D = T.acero.diametros;
  return d.piezas.map((p) => `<tr><td>${esc(d.it.uso || p.uso || '')}</td><td class="sin-corte">Ø ${esc(D[p.diam].nombre)}</td><td class="n">${f(p.cant, 0)}${num(el.n) > 1 ? ` × ${num(el.n)}` : ''}</td><td class="n"><b>${f(p.long)} m</b></td></tr>`).join('');
}

function bloqueEstribo(el, d, T) {
  if (d.it.tipo !== 'estribos' || !d.interior) return '';
  const fija = d.it.cantFija !== undefined && d.it.cantFija !== '' && d.it.cantFija !== null;
  const dist = (d.it.tramos || []).filter((t) => num(t.n)).map((t) => `${num(t.n)} @ ${f(num(t.s), 3)}`).join(', ');
  return `<div class="inf-estribo">
    <div class="inf-estribo-fig">${figuraEstribo(d.interior.b, d.interior.h, d.interior.gancho)}</div>
    <div>
      <p><b>${esc(d.it.uso || 'Estribos')} Ø ${esc(T.acero.diametros[d.it.diam].nombre)}</b></p>
      <p>Doblar a <b>${f(d.interior.b)} × ${f(d.interior.h)} m</b> por dentro, ganchos de <b>${f(d.interior.gancho)} m</b> a 135°.</p>
      <p>Cortar cada estribo de <b>${f(d.long)} m</b>. Van <b>${d.cant}</b> por elemento${num(el.n) > 1 ? `, <b>${d.cant * num(el.n)}</b> en total` : ''}.</p>
      ${!fija && dist ? `<p>Desde cada extremo: ${esc(dist)}${num(d.it.resto) ? `, resto @ ${f(num(d.it.resto))}` : ''}.${d.nudo ? ` Más ${d.nudo} dentro del nudo.` : ''}</p>` : ''}
    </div>
    ${!fija && d.pos?.length ? `<div class="inf-dist">${figuraDistribucion(d.pos, d.it.long, (d.it.tramos || []).reduce((s, t) => s + num(t.n), 0))}</div>` : ''}
  </div>`;
}

function seccionElementos(s, T, elevacion) {
  const porEl = new Map();
  for (const x of s.filas) {
    if (!porEl.has(x.el.id)) porEl.set(x.el.id, { el: x.el, partidas: [] });
    porEl.get(x.el.id).partidas.push(x);
  }
  let html = '';
  for (const [ek, esp] of Object.entries(ESPECIALIDADES)) {
    const grupo = [...porEl.values()].filter((g) => g.el.especialidad === ek);
    if (!grupo.length) continue;
    html += `<h4 class="inf-esp">${esc(esp.nombre)}</h4>`;
    for (const { el, partidas } of grupo) {
      const m = medidas(el);
      const t = TIPOS[el.tipo];
      const acero = partidas.find((x) => x.clave === 'acero')?.r;
      const fig = figuraElemento(el.tipo, m, el);
      html += `<details class="inf-det inf-el" open>
        <summary><b>${esc(el.nombre)}</b>${num(el.n) > 1 ? ` × ${num(el.n)}` : ''} <span class="nota">${esc(t.nombre)}</span></summary>
        <div class="inf-el-cuerpo">
          ${fig ? `<div class="inf-fig">${fig}</div>` : ''}
          <div>
            ${t.dims.length ? `<p class="inf-medidas">${t.dims.map((x) => `<span><b>${esc(x.k)}</b> = ${f(num(m[x.k]))}</span>`).join('')}</p>` : ''}
            <ul class="inf-partidas">${partidas.map(({ clave, r }) => `<li>${esc(PARTIDAS[clave].nombre)}: <b>${r.error ? esc(r.error) : `${f(r.cantidad)} ${esc(r.und)}`}</b>${r.fijo ? ' (fijo)' : ''}${r.rendimiento ? ` · ${f(r.rendimiento.dias, 1)} días` : ''}</li>`).join('')}</ul>
          </div>
        </div>
        ${acero?.armado ? `
          ${t.luz ? `<div class="inf-elev">${elevacion(el)}</div>` : ''}
          <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Pieza</th><th>Ø</th><th class="n">Cantidad</th><th class="n">Largo</th></tr></thead>
          <tbody>${acero.armado.detalle.map((d) => piezaFila(el, d, T)).join('')}</tbody></table></div>
          ${acero.armado.detalle.map((d) => bloqueEstribo(el, d, T)).join('')}` : ''}
      </details>`;
    }
  }
  return `<section class="inf-sec" id="inf-elementos">
    <h3><span class="inf-num">3</span> Elementos y armado</h3>
    <p class="nota">Medidas en metros. Las letras de cada figura son las mismas de las medidas.</p>
    ${html || '<p class="nota">Nada seleccionado.</p>'}
  </section>`;
}

function seccionMano(s, T) {
  const hhTot = CATEGORIAS.reduce((a, c) => a + s.hh[c], 0);
  return `<section class="inf-sec" id="inf-mano">
    <h3><span class="inf-num">4</span> Mano de obra y plazo</h3>
    <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Partida</th><th class="n">Metrado</th><th class="n">Días</th><th class="n">Costo M.O.</th></tr></thead>
    <tbody>${s.grupos.map((g) => `<tr><td>${esc(g.nombre)}</td><td class="n">${f(g.cantidad)} ${esc(g.und)}</td><td class="n">${f(g.dias, 1)}</td><td class="n">${sol(g.costo)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td>Total (${f(hhTot, 1)} HH)</td><td></td><td class="n">${f(s.dias, 1)}</td><td class="n">${sol(s.costo)}</td></tr></tfoot></table></div>
    <p class="nota">${CATEGORIAS.filter((c) => s.hh[c] > 0).map((c) => `${NOMBRE_CATEGORIA[c]}: ${f(s.hh[c], 1)} HH`).join(' · ')}. Días sumando partidas una tras otra.</p>
  </section>`;
}

export function informeHTML(proyecto, T, { secciones, elevacion }) {
  const s = resumen(proyecto, T, proyecto.seleccion);
  const kg = Object.values(s.kgPorDiam).reduce((a, x) => a + x, 0);
  const cemento = s.materiales.find((m) => m.clave === 'cemento')?.cantidad || 0;
  const varillas = Object.values(s.corte).reduce((a, c) => a + c.varillas, 0);
  const on = (k) => secciones[k] !== false;
  return `<article class="informe" id="informe">
    <header class="inf-cab">
      <p class="inf-eyebrow">Informe de metrado · ${esc(new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }))}</p>
      <h2>${esc(proyecto.nombre)}</h2>
      ${datosObraHTML(proyecto.datos)}
      <p class="nota">${proyecto.seleccion?.modo === 'pendiente' ? 'Solo lo que falta ejecutar' : 'Partidas elegidas en Resumen'} · ${s.filas.length} partidas</p>
      <div class="cifras grandes">
        <div><span>Acero</span><b>${f(kg, 0)} kg</b><small>${varillas} varillas</small></div>
        <div><span>Cemento</span><b>${f(cemento, 1)} bls</b></div>
        <div><span>Plazo</span><b>${f(s.dias, 1)} días</b><small>${sol(s.costo)} M.O.</small></div>
      </div>
    </header>
    ${on('pedido') ? seccionPedido(s, T) : ''}
    ${on('corte') ? seccionCorte(s, T) : ''}
    ${on('elementos') ? seccionElementos(s, T, elevacion) : ''}
    ${on('mano') ? seccionMano(s, T) : ''}
    <p class="nota inf-pie">Valores referenciales (CAPECO, E.060/E.070). Verificar con los planos y el ingeniero residente.</p>
  </article>`;
}

// Datos generales de la obra (los que el usuario llenó al crear el proyecto).
function datosObra(d = {}) {
  return [['Propietario', d.propietario], ['Ubicación', d.ubicacion], ['Residente', d.responsable],
    ['Inicio', d.inicio ? new Date(`${d.inicio}T00:00`).toLocaleDateString('es-PE') : ''], ['Plazo', d.plazo ? `${d.plazo} días` : ''],
    ['Obra', d.descripcion]].filter(([, v]) => v);
}

function datosObraHTML(d) {
  const filas = datosObra(d);
  return filas.length ? `<dl class="inf-datos">${filas.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : '';
}

// Resumen en texto para compartir por WhatsApp u otra app.
export function informeTexto(proyecto, T) {
  const s = resumen(proyecto, T, proyecto.seleccion);
  const D = T.acero.diametros;
  const L = [`*${proyecto.nombre}*`, ...datosObra(proyecto.datos).map(([k, v]) => `${k}: ${v}`), `Informe de metrado · ${new Date().toLocaleDateString('es-PE')}`, '', '*Pedido de acero*'];
  for (const [d, c] of Object.entries(s.corte)) L.push(`• Ø ${D[d].nombre}: ${c.varillas} varillas de ${T.acero.longitudVarilla} m (${f(s.kgPorDiam[d])} kg)`);
  const otros = s.materiales.filter((m) => !m.clave.startsWith('acero_'));
  if (otros.length) {
    L.push('', '*Otros materiales*');
    for (const m of otros) L.push(`• ${m.nombre}: ${f(m.cantidad, m.und === 'und' ? 0 : 2)} ${m.und}`);
  }
  if (Object.keys(s.corte).length) {
    L.push('', '*Corte de varillas*');
    for (const [d, c] of Object.entries(s.corte)) {
      for (const p of c.patrones) L.push(`• Ø ${D[d].nombre}: ${p.veces} var → ${textoPatron(p).map(([l, k]) => `${k}×${l} m`).join(' + ')} (sobra ${f(p.sobra)})`);
    }
  }
  L.push('', `Plazo estimado: ${f(s.dias, 1)} días · M.O. ${sol(s.costo)}`);
  return L.join('\n');
}

export function seleccionVacia(proyecto) {
  return !proyecto.elementos.some((el) => Object.keys(el.partidas).some((c) => seleccionada(el, c, proyecto.seleccion)));
}

