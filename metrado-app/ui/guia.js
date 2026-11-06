// Guía de criterios para metrar acero. Texto referencial: manda lo que digan los planos.
import { calcArmado } from '../calc/acero.js';
import { figuraArmado, figuraSeccionViga } from './figuras.js';

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

export function guiaHTML(T, tema) {
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
  const lista = tema ? SECCIONES.filter(([k]) => k === tema) : SECCIONES;
  return `<div class="flot-cab"><h3>Guía para metrar acero</h3><button type="button" class="cerrar" data-act="cerrar-flotante" aria-label="Cerrar">✕</button></div>
    ${lista.map(([k, t], i) => `<details class="guia"${tema || i === 0 ? ' open' : ''}><summary>${t}</summary><div class="guia-cuerpo">${cuerpo[k]}</div></details>`).join('')}`;
}
