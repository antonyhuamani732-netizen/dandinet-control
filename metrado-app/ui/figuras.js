// Figuras de referencia en SVG. Son esquemáticas: la forma no cambia de proporción,
// pero las cotas muestran las medidas que el usuario escribió (mismas letras que los campos).

const f2 = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n.toFixed(2) : '–';
};
const cota = (letra, v) => `${letra} = ${f2(v)}`;

function svg(contenido, vb = '-45 -8 370 212') {
  return `<svg class="figura" viewBox="${vb}" role="img" xmlns="http://www.w3.org/2000/svg">${contenido}</svg>`;
}

function texto(x, y, t, ancla = 'middle', clase = 'fig-cota') {
  return `<text x="${x}" y="${y}" text-anchor="${ancla}" class="${clase}">${t}</text>`;
}

// Caja en perspectiva caballera. W = ancho frontal, H = alto, D = profundidad (px).
function caja(W, H, D, { ancho, fondo, alto }) {
  const x = (280 - W - D) / 2;
  const y = (180 - H + D) / 2 + 6;
  const d = D;
  const cara = `
    <polygon class="fig-cara" points="${x},${y} ${x + W},${y} ${x + W},${y + H} ${x},${y + H}"/>
    <polygon class="fig-tapa" points="${x},${y} ${x + d},${y - d} ${x + W + d},${y - d} ${x + W},${y}"/>
    <polygon class="fig-lado" points="${x + W},${y} ${x + W + d},${y - d} ${x + W + d},${y + H - d} ${x + W},${y + H}"/>`;
  const cotas = `
    <line class="fig-linea" x1="${x}" y1="${y + H + 12}" x2="${x + W}" y2="${y + H + 12}"/>
    ${texto(x + W / 2, y + H + 26, ancho)}
    <line class="fig-linea" x1="${x + W + 10}" y1="${y + H + 4}" x2="${x + W + d + 10}" y2="${y + H - d + 4}"/>
    ${texto(x + W + d / 2 + 16, y + H - d / 2 + 14, fondo, 'start')}
    <line class="fig-linea" x1="${x - 10}" y1="${y}" x2="${x - 10}" y2="${y + H}"/>
    ${texto(x - 14, y + H / 2 + 4, alto, 'end')}`;
  return svg(cara + cotas);
}

export function figuraElemento(tipo, m, el = {}) {
  switch (tipo) {
    case 'zapata':
      return caja(150, 40, 46, { ancho: cota('A', m.A), fondo: cota('B', m.B), alto: cota('h', m.h) });
    case 'cimiento':
      return caja(180, 60, 26, { ancho: cota('L', m.L), fondo: cota('B', m.B), alto: cota('h', m.h) });
    case 'sobrecimiento':
      return caja(180, 34, 16, { ancho: cota('L', m.L), fondo: cota('B', m.B), alto: cota('h', m.h) });
    case 'columna':
      return caja(40, 120, 28, { ancho: cota('b', m.b), fondo: cota('h', m.h), alto: cota('H', m.H) });
    case 'viga':
      return caja(180, 40, 24, { ancho: cota('L', m.L), fondo: cota('b', m.b), alto: cota('h', m.h) });
    case 'placa':
      return caja(120, 110, 14, { ancho: cota('L', m.L), fondo: cota('e', m.e), alto: cota('H', m.H) });
    case 'losa_maciza':
      return caja(170, 16, 60, { ancho: cota('A', m.A), fondo: cota('B', m.B), alto: cota('e', m.e) });
    case 'losa_aligerada': return figuraAligerado(m, el.peralte);
    case 'escalera': return figuraEscalera(m);
    case 'muro': return figuraMuro(m, el.partidas?.muro?.vanos || []);
    default: return '';
  }
}

function figuraAligerado(m, peralte) {
  const x = 40;
  const y = 22;
  const W = 200;
  const H = 120;
  let viguetas = '';
  let ladrillos = '';
  for (let i = 0; i <= 7; i++) {
    const yy = y + (i * H) / 7;
    viguetas += `<line class="fig-vigueta" x1="${x}" y1="${yy}" x2="${x + W}" y2="${yy}"/>`;
    if (i < 7) {
      for (let j = 0; j < 8; j++) {
        ladrillos += `<rect class="fig-ladrillo" x="${x + 4 + j * 24.4}" y="${yy + 3}" width="20" height="${H / 7 - 6}"/>`;
      }
    }
  }
  return svg(`
    <rect class="fig-cara" x="${x}" y="${y}" width="${W}" height="${H}"/>
    ${ladrillos}${viguetas}
    <line class="fig-linea" x1="${x}" y1="${y + H + 12}" x2="${x + W}" y2="${y + H + 12}"/>
    ${texto(x + W / 2, y + H + 26, `${cota('A', m.A)} (viguetas)`)}
    <line class="fig-linea" x1="${x - 10}" y1="${y}" x2="${x - 10}" y2="${y + H}"/>
    ${texto(x - 14, y + H / 2 + 4, cota('B', m.B), 'end')}
    ${texto(x + W, y - 8, `h = ${peralte || 20} cm · viguetas @ 0.40`, 'end', 'fig-nota')}`);
}

function figuraEscalera(m) {
  const pasos = 6;
  const p = 26;
  const cp = 18;
  const x0 = 50;
  const y0 = 150;
  let pts = `${x0},${y0}`;
  for (let i = 0; i < pasos; i++) {
    pts += ` ${x0 + i * p},${y0 - (i + 1) * cp} ${x0 + (i + 1) * p},${y0 - (i + 1) * cp}`;
  }
  const xf = x0 + pasos * p;
  const yf = y0 - pasos * cp;
  const g = 14;
  return svg(`
    <polygon class="fig-cara" points="${pts} ${xf},${yf + g + 10} ${x0 + g},${y0 + 6} ${x0},${y0 + 6}"/>
    <line class="fig-linea" x1="${x0 + 10}" y1="${y0 + 22}" x2="${xf + 10}" y2="${yf + g + 26}"/>
    ${texto((x0 + xf) / 2 + 30, (y0 + yf) / 2 + 46, cota('L', m.L), 'start')}
    ${texto(x0 + p * 2 + p / 2, y0 - cp * 3 - 6, cota('p', m.p))}
    ${texto(x0 + p * 4 - 4, y0 - cp * 4.5 + 4, cota('cp', m.cp), 'end')}
    ${texto(x0 + 4, y0 + 22, cota('t', m.t), 'end')}
    ${texto(270, 20, `${cota('B', m.B)} · ${m.np ?? '–'} pasos`, 'end', 'fig-nota')}`);
}

function figuraMuro(m, vanos) {
  const x = 30;
  const y = 20;
  const W = 220;
  const H = 120;
  let hiladas = '';
  for (let i = 1; i < 12; i++) {
    const yy = y + (i * H) / 12;
    hiladas += `<line class="fig-hilada" x1="${x}" y1="${yy}" x2="${x + W}" y2="${yy}"/>`;
    const off = i % 2 ? 0 : 12;
    for (let xx = x + off; xx < x + W; xx += 24) {
      hiladas += `<line class="fig-hilada" x1="${xx}" y1="${yy - H / 12}" x2="${xx}" y2="${yy}"/>`;
    }
  }
  const huecos = vanos.length
    ? `<rect class="fig-vano" x="${x + 30}" y="${y + 30}" width="36" height="${H - 30}"/>${vanos.length > 1 ? `<rect class="fig-vano" x="${x + 130}" y="${y + 30}" width="56" height="40"/>` : ''}`
    : '';
  return svg(`
    <rect class="fig-cara" x="${x}" y="${y}" width="${W}" height="${H}"/>
    ${hiladas}${huecos}
    <line class="fig-linea" x1="${x}" y1="${y + H + 12}" x2="${x + W}" y2="${y + H + 12}"/>
    ${texto(x + W / 2, y + H + 26, cota('L', m.L))}
    <line class="fig-linea" x1="${x + W + 10}" y1="${y}" x2="${x + W + 10}" y2="${y + H}"/>
    ${texto(x + W + 6, y - 6, cota('H', m.H), 'end')}
    ${vanos.length ? texto(x + 48, y + 22, `${vanos.length} vano${vanos.length > 1 ? 's' : ''}`, 'middle', 'fig-nota') : ''}`);
}

// Distribución de estribos a lo largo del elemento.
export function figuraDistribucion(pos, largo, nFijos) {
  const x = 12;
  const W = 296;
  const L = parseFloat(largo) || 1;
  const marcas = pos.map((p, i) => {
    const xx = x + (p / L) * W;
    const fijo = i < nFijos || i >= pos.length - nFijos;
    return `<line class="${fijo ? 'fig-estribo-fijo' : 'fig-estribo'}" x1="${xx.toFixed(1)}" y1="14" x2="${xx.toFixed(1)}" y2="46"/>`;
  }).join('');
  return `<svg class="figura distribucion" viewBox="0 0 320 70" role="img" xmlns="http://www.w3.org/2000/svg">
    <rect class="fig-cara" x="${x}" y="18" width="${W}" height="24"/>
    ${marcas}
    ${texto(x, 62, '0', 'start')}${texto(x + W / 2, 62, `${pos.length} estribos`, 'middle', 'fig-nota')}${texto(x + W, 62, `${f2(L)} m`, 'end')}
  </svg>`;
}

// Forma del estribo con medidas interiores y ganchos a 135°.
export function figuraEstribo(b, h, gancho) {
  const W = 110;
  const H = Math.max(50, Math.min(150, (W * (h || 1)) / (b || 1)));
  const x = 70;
  const y = (180 - H) / 2;
  const r = 6;
  const g = 22;
  return svg(`
    <rect class="fig-acero" x="${x}" y="${y}" width="${W}" height="${H}" rx="${r}"/>
    <line class="fig-acero" x1="${x + r}" y1="${y + 2}" x2="${x + r + g * 0.7}" y2="${y + 2 + g * 0.7}"/>
    <line class="fig-acero" x1="${x + 2}" y1="${y + r}" x2="${x + 2 + g * 0.7}" y2="${y + r + g * 0.7}"/>
    ${texto(x + W / 2, y + H + 18, `${f2(b)} m`)}
    ${texto(x + W + 8, y + H / 2 + 4, `${f2(h)} m`, 'start')}
    ${texto(x + 6, y - 8, `ganchos 135° de ${f2(gancho)} m`, 'start', 'fig-nota')}`);
}

// Planta de una malla con n barras (máx. 14 dibujadas).
export function figuraMalla(dir, cant) {
  const x = 40;
  const y = 16;
  const W = 200;
  const H = 120;
  const k = Math.min(cant || 0, 14);
  let lineas = '';
  for (let i = 0; i < k; i++) {
    const t = k === 1 ? 0.5 : i / (k - 1);
    lineas += dir === 'Y'
      ? `<line class="fig-acero" x1="${x + 8 + t * (W - 16)}" y1="${y + 6}" x2="${x + 8 + t * (W - 16)}" y2="${y + H - 6}"/>`
      : `<line class="fig-acero" x1="${x + 6}" y1="${y + 8 + t * (H - 16)}" x2="${x + W - 6}" y2="${y + 8 + t * (H - 16)}"/>`;
  }
  return svg(`<rect class="fig-cara" x="${x}" y="${y}" width="${W}" height="${H}"/>${lineas}
    ${texto(x + W / 2, y + H + 18, `${cant} barras en ${dir}${cant > 14 ? ' (se dibujan 14)' : ''}`, 'middle', 'fig-nota')}`, '0 0 280 160');
}
