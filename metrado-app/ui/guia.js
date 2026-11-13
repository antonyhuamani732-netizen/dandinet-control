// Guía para metrar, por partida. Texto referencial: manda lo que digan los planos.
import { calcArmado } from '../calc/acero.js';
import { RECUBRIMIENTOS, fichaDiametro } from '../calc/norma.js';
import { figuraArmado, figuraSeccionViga, figuraElemento } from './figuras.js';
import { icono } from './iconos.js';

const SECCIONES = [
  ['corrido', 'Acero longitudinal corrido'],
  ['bastones', 'Bastones: el acero de la izquierda y de la derecha'],
  ['anclajes', 'Anclajes y ganchos en cada apoyo'],
  ['vigas', 'Viga peraltada, chata y de borde'],
  ['caso', 'Caso: viga chata que llega a una viga peraltada'],
  ['confinamiento', 'Confinamiento y nudos'],
  ['empalmes', 'Dónde empalmar'],
  ['desperdicio', 'Cómo considerar el desperdicio'],
];

function ejemplo(T, izq, der, items) {
  const a = calcArmado(items.map((it) => ({ tipo: 'barras', modo: 'apoyos', rec: 0.04, izq, der, ...it })), 1, T, { luz: 4 });
  return figuraArmado(4, a.detalle, { apoyos: { izq: izq.nombre, der: der.nombre } });
}

function guiaAcero(T, tema) {
  const col = { apoyo: 'columna', ancho: 0.25, nombre: 'Columna' };
  const pv = { apoyo: 'viga_peraltada', ancho: 0.25, nombre: 'V. peraltada' };
  const ch = { apoyo: 'viga_chata', ancho: 0.3, alto: 0.2, nombre: 'V. chata' };
  const cuerpo = {
    corrido: `<p>Es el acero que recorre toda la luz, de apoyo a apoyo, arriba (superior) y abajo (inferior). En la app es una barra <b>Por apoyos</b> con zona <b>Corrido</b>: su longitud es la luz libre más lo que entra en cada apoyo.</p>
      ${ejemplo(T, col, col, [{ uso: 'Superior', cara: 'sup', zona: 'corrido', diam: '5/8', cant: 2 }, { uso: 'Inferior', cara: 'inf', zona: 'corrido', diam: '5/8', cant: 2 }])}
      <p class="nota">1 = superior corrido, 2 = inferior corrido. Los ganchos entran al apoyo y bajan (arriba) o suben (abajo).</p>`,
    bastones: `<p>Los <b>bastones</b> son barras cortas que se agregan donde el momento es mayor: <b>arriba en los apoyos</b> (izquierdo y derecho) y <b>abajo al centro</b>. El "acero de la izquierda" es el bastón superior del apoyo izquierdo; el de la derecha, el del apoyo derecho. Pueden tener distinto diámetro o cantidad: créalos como ítems separados (zona <b>Izquierdo</b> o <b>Derecho</b>) o con <b>Ambos apoyos</b> si son iguales.</p>
      ${ejemplo(T, col, col, [
        { uso: 'Corrido sup', cara: 'sup', zona: 'corrido', diam: '5/8', cant: 2 },
        { uso: 'Bastón izq', cara: 'sup', zona: 'izq', frac: '3', diam: '5/8', cant: 1 },
        { uso: 'Bastón der', cara: 'sup', zona: 'der', frac: '4', diam: '1/2', cant: 1 },
        { uso: 'Corrido inf', cara: 'inf', zona: 'corrido', diam: '5/8', cant: 2 },
        { uso: 'Bastón central', cara: 'inf', zona: 'centro', frac: '2', diam: '1/2', cant: 1 },
      ])}
      <p class="nota">Largos típicos: bastón superior L/3 a L/4 desde la cara del apoyo; bastón inferior central L/2 a 2L/3. Usa siempre la medida del plano si la tiene.</p>`,
    anclajes: `<p>Cada extremo se mide según <b>dónde llega</b> la barra:</p>
      <ul>
        <li><b>Columna, viga peraltada, placa o zapata:</b> entra el ancho del apoyo menos el recubrimiento y dobla un gancho de 90° (12 db, editable en Tablas).</li>
        <li><b>Viga chata:</b> entra igual, pero el gancho no puede ser más alto que la viga chata menos dos recubrimientos. La app lo recorta y te avisa.</li>
        <li><b>Continúa:</b> la barra sigue al tramo vecino; aquí se mide hasta el eje del apoyo.</li>
        <li><b>Empalme por traslape:</b> suma la longitud de traslape del diámetro (columnas que siguen al piso de arriba).</li>
        <li><b>Libre (volado):</b> termina a un recubrimiento del borde.</li>
        <li><b>Manual:</b> escribe lo que diga el plano. Si quieres poner la longitud final de corte, usa el modo <b>Longitud total</b>.</li>
      </ul>`,
    vigas: `<div class="guia-figs">${figuraSeccionViga('peraltada', { b: 0.25, h: 0.5, e: 0.2, L: 4 })}${figuraSeccionViga('chata', { b: 0.6, h: 0.2, e: 0.2, L: 4 })}${figuraSeccionViga('borde', { b: 0.25, h: 0.5, e: 0.2, L: 4 })}</div>
      <ul>
        <li><b>Peraltada:</b> más alta que la losa. Encofrado: fondo + 2 costados de (h − e).</li>
        <li><b>Chata:</b> del mismo espesor que la losa, más ancha. Encofrado: solo el fondo. Sus ganchos son cortos porque su peralte es pequeño; suele llevar estribos de 1/4" o 6 mm.</li>
        <li><b>De borde:</b> en el perímetro, con losa a un solo lado. Encofrado: fondo + cara exterior completa + cara interior (h − e).</li>
      </ul>`,
    caso: `<p>Una <b>viga chata</b> del aligerado que llega por la izquierda a una <b>viga peraltada</b> y por la derecha a otra <b>viga chata</b>. A la izquierda el gancho completo cabe; a la derecha el gancho se recorta a la altura de la viga chata (0.20 − 2 × 0.04 = 0.12 m).</p>
      ${ejemplo(T, pv, ch, [{ uso: 'Superior', cara: 'sup', zona: 'corrido', diam: '1/2', cant: 2 }, { uso: 'Inferior', cara: 'inf', zona: 'corrido', diam: '1/2', cant: 2 }])}
      <p class="nota">En la app: barra <b>Por apoyos</b>, extremo izquierdo <b>Viga peraltada</b> (ancho 0.25) y extremo derecho <b>Viga chata</b> (ancho 0.30, alto 0.20). El desglose muestra cada sumando.</p>`,
    confinamiento: `<p>Cerca de los apoyos los estribos van más juntos (<b>zona de confinamiento</b>). En el editor de estribos, <b>Distribuir según norma</b> arma los tramos y la app avisa si tu distribución no cumple.</p>
      <ul>
        <li><b>Vigas (E.060):</b> zona de 2h desde cada cara; 1.er estribo a 0.05 m; so ≤ mín(d/4, 10 db, 24 db estribo, 0.30 m); fuera de la zona ≤ d/2.</li>
        <li><b>Columnas (E.060):</b> Lo = máx(altura libre/6, lado mayor, 0.50 m); so ≤ mín(8 db, lado menor/2, 0.10 m).</li>
        <li><b>Nudo viga-columna:</b> los estribos de la columna continúan dentro del nudo a ≤ 0.15 m. Marca <b>Estribos en el nudo</b> con la altura de la viga que llega.</li>
        <li><b>Albañilería confinada (E.070):</b> zona = máx(1.5 d, 0.45 m), s ≤ mín(d/4, 0.10 m), resto a 0.25 m (el típico 1@.05, 4@.10, r@.25).</li>
      </ul>`,
    empalmes: `<ul>
        <li><b>Columnas:</b> en la mitad central de la altura libre, fuera de la zona confinada. Nunca dentro del nudo.</li>
        <li><b>Vigas, acero superior:</b> en el tercio central de la luz.</li>
        <li><b>Vigas, acero inferior:</b> cerca de los apoyos, fuera del nudo y de la zona de 2h.</li>
        <li>No empalmes más del 50 % de las barras en la misma sección: alterna.</li>
        <li>Longitud de traslape por diámetro en Tablas › Acero. Cuando una barra pasa de 9 m, la app marca dónde caería el empalme y avisa si cae fuera de la zona recomendada.</li>
      </ul>
      <p class="nota">Criterios referenciales de las normas E.060 y E.070. Verifica con los planos y el ingeniero del proyecto.</p>`,
    desperdicio: `<p>Hay dos formas, y la app muestra ambas en cada partida de acero:</p>
      <ul>
        <li><b>% fijo sobre los kg netos</b> (forma CAPECO, 3 a 5 %): rápido para presupuesto. El valor general está en Tablas; cada partida puede tener el suyo.</li>
        <li><b>Real por corte de varillas de 9 m:</b> la app agrupa las piezas en varillas y cuenta lo que realmente compras (varillas × 9 m × kg/m). Útil para pedir material y ver si conviene cambiar largos.</li>
      </ul>
      <p>En concreto y muros el desperdicio es un % (Tablas), y también se puede cambiar por partida.</p>`,
  };
  cuerpo.recubrimientos = tablaRecubrimientos();
  cuerpo.diametros = tablaDiametros(T);
  const lista = [...SECCIONES.slice(0, 1), ['recubrimientos', 'Recubrimiento: uno por partida (E.060)'], ['diametros', 'Diámetros: medidas y para qué se usan'], ...SECCIONES.slice(1)];
  const ver = tema ? lista.filter(([k]) => k === tema) : lista;
  return ver.map(([k, t], i) => seccion(t, cuerpo[k], tema || i === 0)).join('');
}

const seccion = (t, html, abierta) => `<details class="guia"${abierta ? ' open' : ''}><summary>${t}</summary><div class="guia-cuerpo">${html}</div></details>`;
const f = (n, d = 2) => (Number.isFinite(n) ? n : 0).toLocaleString('es-PE', { minimumFractionDigits: d, maximumFractionDigits: d });

function tablaRecubrimientos() {
  return `<p>El recubrimiento es la capa de concreto entre la cara del elemento y el acero más cercano (el estribo en vigas y columnas). <b>Se usa uno solo por partida de acero</b>: todas las barras, mallas y estribos de ese elemento lo toman. La app propone el valor de la norma según el tipo de elemento y lo puedes cambiar si el plano dice otro.</p>
    <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Caso (E.060, art. 7.7)</th><th class="n">Mínimo</th></tr></thead>
    <tbody>${RECUBRIMIENTOS.map((r) => `<tr><td>${r.caso}</td><td class="n"><b>${f(r.cm, 1)} cm</b></td></tr>`).join('')}</tbody></table></div>
    <p class="nota">Si el plano indica un recubrimiento mayor, manda el plano.</p>`;
}

function tablaDiametros(T) {
  const filas = Object.keys(T.acero.diametros).map((d) => {
    const x = fichaDiametro(d, T);
    return `<tr><td><b>${x.nombre}</b><br><small>${f(x.mm, 1)} mm</small></td><td class="n">${f(x.kgm, 3)}</td><td class="n">${f(x.gancho90)}</td><td class="n">${f(x.traslape)}</td><td class="n">${f(x.sepLibreMin * 100, 1)}</td><td>${x.uso}</td></tr>`;
  }).join('');
  return `<p>Al elegir un diámetro, la app muestra su ficha. Resumen (gancho y traslape editables en Tablas):</p>
    <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Ø</th><th class="n">kg/m</th><th class="n">Gancho 90° (m)</th><th class="n">Traslape (m)</th><th class="n">Sep. libre mín. (cm)</th><th>Uso recomendado</th></tr></thead><tbody>${filas}</tbody></table></div>
    <p class="nota">Separación libre mínima entre barras paralelas (E.060): la mayor entre el diámetro, 2.5 cm y 1.33 veces el tamaño máximo del agregado (3/4"). Estribos: 3/8" para barras longitudinales hasta 1"; 1/2" para barras mayores.</p>`;
}

function guiaConcreto() {
  const fig = (tipo, m, el = {}) => `<div class="guia-fig">${figuraElemento(tipo, m, el)}</div>`;
  return [
    seccion('Cómo se mide el concreto', `<p>Concreto = largo × ancho × alto × n° de veces (m³). Mide cada elemento una sola vez y repite con <b>N° de elementos iguales</b>. No cuentes dos veces el mismo volumen: donde dos elementos se cruzan, el volumen va en uno solo.</p>`, true),
    seccion('Cimientos y sobrecimientos', `${fig('cimiento', { L: 10, B: 0.4, h: 0.8 })}<p>Largo por ejes, descontando los cruces (en una esquina, el tramo se mide una vez). Ancho y alto según el plano. Son de concreto ciclópeo (cemento + hormigón + piedra) salvo que el plano diga armado.</p>`),
    seccion('Zapatas', `${fig('zapata', { A: 1.5, B: 1.5, h: 0.6 })}<p>A × B × peralte h. El acero es una malla inferior en X y en Y. Recubrimiento 7.5 cm porque se vacía contra el suelo.</p>`),
    seccion('Columnas', `${fig('columna', { b: 0.25, h: 0.25, H: 2.8 })}<p>Sección b × h por la altura H. Mide la altura desde la cara superior de la zapata o cimiento hasta el fondo de la losa; el nudo con la viga se mide en la viga o en la columna, pero no en ambas.</p>`),
    seccion('Vigas', `${fig('viga', { b: 0.25, h: 0.5, L: 4, e: 0.2 }, { clase: 'peraltada' })}<p>Base × peralte total × luz libre (entre caras de columnas). Peraltada: cuelga bajo la losa. Chata: del espesor de la losa. De borde: en el perímetro, con losa a un lado.</p>`),
    seccion('Losas', `${fig('losa_aligerada', { A: 4, B: 5 }, { peralte: '20' })}<p>Aligerado: área de la losa (sin las vigas) por el volumen de concreto por m² según el peralte (17, 20 o 25 cm); el ladrillo de techo se cuenta aparte (8.33 por m²). Losa maciza: largo × ancho × espesor.</p>`),
    seccion('Escaleras', `${fig('escalera', { B: 1, L: 3.2, t: 0.15, np: 10, p: 0.25, cp: 0.175 })}<p>Garganta (losa inclinada: ancho × longitud inclinada × espesor) + pasos (triángulos: ancho × paso × contrapaso ÷ 2 por cada paso).</p>`),
    seccion('Valor fijo', '<p>Si ya tienes el metrado (del plano o de otro cálculo), usa <b>Valor fijo</b> en la partida: la app conserva tu número y ajusta los materiales.</p>'),
  ].join('');
}

function guiaEncofrado() {
  return [
    seccion('Qué se encofra', `<p>Se mide el <b>área de contacto</b> entre la madera y el concreto (m²). Solo las caras que llevan molde: las que van contra el terreno, contra un muro ya hecho o bajo otra losa no se encofran.</p>`, true),
    seccion('Por elemento', `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Elemento</th><th>Área</th></tr></thead><tbody>
      <tr><td>Sobrecimiento</td><td>2 caras × largo × alto</td></tr>
      <tr><td>Zapata</td><td>Perímetro × peralte (solo si se encofra; en terreno firme no)</td></tr>
      <tr><td>Columna</td><td>Perímetro × altura (si un lado queda contra muro de ladrillo, descuéntalo)</td></tr>
      <tr><td>Viga peraltada</td><td>Fondo + 2 costados × (h − espesor de losa)</td></tr>
      <tr><td>Viga chata</td><td>Solo el fondo</td></tr>
      <tr><td>Viga de borde</td><td>Fondo + cara exterior completa + cara interior (h − e)</td></tr>
      <tr><td>Losas</td><td>Área de fondo</td></tr>
      <tr><td>Escalera</td><td>Fondo de la losa inclinada</td></tr></tbody></table></div>`),
    seccion('Accesorios y reúsos', '<p>Además de la madera de los tableros, la app suma puntales, soleras, tablones, estacas, barrotes, tornapuntas y cuñas según el elemento (Tablas › Accesorios). Si encofras por partes y reutilizas el mismo juego, pon cuántas veces se reusa: los accesorios se dividen entre ese número.</p>'),
  ].join('');
}

function guiaMuros() {
  return [
    seccion('Cómo se mide un muro', '<p>Área = largo × alto, menos los vanos (puertas y ventanas). Agrega cada vano con su ancho, alto y cantidad. Los muros iguales se repiten con N° de muros iguales.</p>', true),
    seccion('Aparejo', `<div class="guia-figs">${['soga', 'cabeza', 'canto'].map((a) => `<div><b>${a[0].toUpperCase() + a.slice(1)}</b><p class="nota">${{ soga: 'Se ve el largo; muro del ancho del ladrillo (13 cm en KK). Lo más común.', cabeza: 'Se ve la cabeza; muro del largo del ladrillo (24 cm). Más ladrillos por m².', canto: 'Ladrillo echado de costado; tabiques delgados.' }[a]}</p></div>`).join('')}</div>`),
    seccion('Materiales', '<p>Ladrillos por m² = 1 ÷ ((largo + junta) × (alto + junta)) de la cara que se ve. Mortero = espesor del muro − volumen de ladrillos. Cemento y arena según la proporción del mortero (1:4, 1:5…). Junta típica 1.0 a 1.5 cm.</p>'),
  ].join('');
}

function guiaImportar() {
  return [
    seccion('Exportar e importar con Excel', `<ol>
      <li>En <b>Proyectos › Datos</b> toca <b>Descargar plantilla Excel</b>. Trae una hoja <b>Instrucciones</b> y filas de ejemplo.</li>
      <li>Llena <b>Elementos</b> (una fila por elemento), <b>Acero</b> (una fila por grupo de barras, malla o estribos), <b>Muros</b> y <b>Manual</b>.</li>
      <li>Puedes escribir fórmulas como texto: <code>25.283/2</code>.</li>
      <li>Toca <b>Importar Excel</b>: verás una vista previa con los errores por hoja y fila antes de agregar.</li>
      <li><b>Exportar Excel</b> guarda tu proyecto en el mismo formato, para corregirlo en la PC y volver a importarlo.</li></ol>`, true),
    seccion('Respaldo completo', '<p><b>Descargar respaldo</b> guarda todo (proyectos, tablas y registros de obra) en un archivo .json. Úsalo para pasar los datos a otro celular o PC con <b>Agregar proyecto desde archivo</b>.</p>'),
  ].join('');
}

export const PESTANAS_GUIA = { concreto: 'Concreto', encofrado: 'Encofrado', acero: 'Acero', muros: 'Muros', importar: 'Importar / exportar' };

export function guiaHTML(T, pestana = 'concreto', tema) {
  const cuerpo = { concreto: guiaConcreto, encofrado: guiaEncofrado, acero: () => guiaAcero(T, tema), muros: guiaMuros, importar: guiaImportar }[pestana] || guiaConcreto;
  return `<div class="flot-cab"><h3>${icono('guia')} Guía para metrar</h3><button type="button" class="cerrar" data-act="cerrar-flotante" aria-label="Cerrar">${icono('cerrar')}</button></div>
    <div class="pildoras" role="tablist">${Object.entries(PESTANAS_GUIA).map(([k, t]) => `<button type="button" role="tab" class="pildora" data-act="guia" data-pestana="${k}" aria-selected="${k === pestana}">${t}</button>`).join('')}</div>
    ${cuerpo()}`;
}
