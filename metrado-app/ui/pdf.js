// Genera un PDF A4 del informe sin usar el diálogo de impresión: cada bloque del
// informe se dibuja tal como se ve (SVG foreignObject → canvas → JPEG) y se arma un
// PDF mínimo con esas imágenes. Funciona sin internet y sin librerías.

const ANCHO_PX = 760; // ancho de diseño del informe
const ESCALA = 2; // nitidez
const A4 = { w: 595.28, h: 841.89, m: 34 };

// Colores claros fijos para el PDF, aunque el celular esté en modo oscuro.
const CLARO = `:root{--bg:#ffffff;--superficie:#ffffff;--hundido:#f0f2ee;--tinta:#1f2421;--tenue:#5d6560;--linea:#cfd4cd;
  --acento:#e2a200;--acento-tinta:#1f2421;--fig-relleno:#dfe3dd;--fig-tapa:#f3f5f1;--fig-lado:#c9cfc7;color-scheme:light}`;

async function cssDeLaApp() {
  let css = '';
  for (const hoja of document.styleSheets) {
    try {
      for (const r of hoja.cssRules) css += `${r.cssText}\n`;
    } catch { /* hoja de otro origen (fuentes): se omite */ }
  }
  return css;
}

function aImagen(html, css, ancho) {
  const doc = `<div xmlns="http://www.w3.org/1999/xhtml" class="raiz-pdf" style="width:${ancho}px;background:#fff;font:15px/1.45 Barlow,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1f2421">${html}</div>`;
  return new Promise((resolve, reject) => {
    const medidor = document.createElement('div');
    medidor.style.cssText = `position:fixed;left:-10000px;top:0;width:${ancho}px`;
    medidor.className = 'pdf-medidor';
    medidor.innerHTML = html;
    document.body.append(medidor);
    // Holgura por si la fuente del dibujo difiere un poco de la de pantalla.
    const alto = Math.ceil(medidor.getBoundingClientRect().height * 1.15) + 40;
    medidor.remove();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" data-theme="light" width="${ancho}" height="${alto}">
      <style>${css.replace(/<\/style/gi, '')}${CLARO}</style>
      <foreignObject x="0" y="0" width="100%" height="100%">${new XMLSerializer().serializeToString(new DOMParser().parseFromString(doc, 'text/html').body.firstChild)}</foreignObject></svg>`;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = ancho * ESCALA;
      c.height = alto * ESCALA;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      g.scale(ESCALA, ESCALA);
      g.drawImage(img, 0, 0);
      resolve(recortarBlanco(c));
    };
    img.onerror = () => reject(new Error('No se pudo dibujar el informe'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

// Quita el blanco sobrante al pie (la altura se mide con holgura para no cortar nada).
function recortarBlanco(c) {
  const g = c.getContext('2d');
  const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
  let ultima = 0;
  for (let y = height - 1; y >= 0 && !ultima; y--) {
    const fila = y * width * 4;
    for (let x = 0; x < width; x += 2) {
      const i = fila + x * 4;
      if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) { ultima = y; break; }
    }
  }
  const alto = Math.min(height, ultima + 1 + 8 * ESCALA);
  if (alto >= height) return c;
  const t = document.createElement('canvas');
  t.width = width;
  t.height = alto;
  t.getContext('2d').drawImage(c, 0, 0);
  return t;
}

// Bloques que no se deben partir entre páginas (si caben en una).
function bloques(informe) {
  const out = [];
  const envolver = (nodo, sec) => (sec
    ? `<article class="informe" style="border:0;padding:0;background:#fff"><section class="${sec.className}">${nodo.outerHTML}</section></article>`
    : `<article class="informe" style="border:0;padding:0;background:#fff">${nodo.outerHTML}</article>`);
  for (const hijo of informe.children) {
    if (hijo.classList.contains('inf-sec')) {
      for (const n of hijo.children) out.push(envolver(n, hijo));
    } else {
      out.push(envolver(hijo));
    }
  }
  return out;
}

async function jpeg(canvas) {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.88));
  return new Uint8Array(await blob.arrayBuffer());
}

// PDF mínimo: cada página es una lista de imágenes JPEG ubicadas en puntos.
function armarPDF(paginas) {
  const enc = new TextEncoder();
  const partes = [];
  const offsets = [];
  let largo = 0;
  const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; partes.push(b); largo += b.length; };
  const objetos = []; // [num, () => void]
  let n = 2; // 1 = catálogo, 2 = páginas
  const kids = [];
  const cuerpo = [];
  for (const pg of paginas) {
    const nPag = ++n;
    const nCont = ++n;
    const imgs = pg.map((im) => ({ ...im, num: ++n }));
    kids.push(nPag);
    const recursos = imgs.map((im, i) => `/I${i} ${im.num} 0 R`).join(' ');
    const ops = imgs.map((im, i) => `q ${im.w.toFixed(2)} 0 0 ${im.h.toFixed(2)} ${im.x.toFixed(2)} ${im.y.toFixed(2)} cm /I${i} Do Q`).join('\n');
    cuerpo.push([nPag, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /XObject << ${recursos} >> >> /Contents ${nCont} 0 R >>`]);
    cuerpo.push([nCont, `<< /Length ${ops.length} >>\nstream\n${ops}\nendstream`]);
    for (const im of imgs) cuerpo.push([im.num, im]);
  }
  objetos.push([1, '<< /Type /Catalog /Pages 2 0 R >>']);
  objetos.push([2, `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`]);
  objetos.push(...cuerpo);
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  for (const [num, o] of objetos) {
    offsets[num] = largo;
    if (typeof o === 'string') {
      push(`${num} 0 obj\n${o}\nendobj\n`);
    } else {
      push(`${num} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${o.pw} /Height ${o.ph} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${o.bytes.length} >>\nstream\n`);
      push(o.bytes);
      push('\nendstream\nendobj\n');
    }
  }
  const xref = largo;
  const total = n + 1;
  let tabla = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) tabla += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  push(`${tabla}trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(partes, { type: 'application/pdf' });
}

export async function informeAPdf(informe, alAvanzar = () => {}) {
  const css = await cssDeLaApp();
  const lista = bloques(informe);
  const util = A4.w - 2 * A4.m;
  const pt = util / ANCHO_PX; // puntos por px de diseño
  const altoUtil = A4.h - 2 * A4.m;
  const paginas = [[]];
  let y = 0; // usado en la página actual (pt)
  for (let i = 0; i < lista.length; i++) {
    alAvanzar(i / lista.length);
    const c = await aImagen(lista[i], css, ANCHO_PX);
    const alto = (c.height / ESCALA) * pt;
    if (alto <= altoUtil) {
      if (y + alto > altoUtil && y > 0) { paginas.push([]); y = 0; }
      paginas.at(-1).push({ c, y, alto });
      y += alto;
    } else {
      // Bloque más alto que una hoja: se corta en tramos.
      let desde = 0;
      while (desde < c.height) {
        if (y > altoUtil * 0.75) { paginas.push([]); y = 0; }
        const cabe = Math.floor(((altoUtil - y) / pt) * ESCALA);
        const tramo = Math.min(cabe, c.height - desde);
        const t = document.createElement('canvas');
        t.width = c.width;
        t.height = tramo;
        t.getContext('2d').drawImage(c, 0, desde, c.width, tramo, 0, 0, c.width, tramo);
        const a = (tramo / ESCALA) * pt;
        paginas.at(-1).push({ c: t, y, alto: a });
        y += a;
        desde += tramo;
        if (desde < c.height) { paginas.push([]); y = 0; }
      }
    }
  }
  const final = [];
  for (const pg of paginas) {
    const imgs = [];
    for (const b of pg) {
      imgs.push({ bytes: await jpeg(b.c), pw: b.c.width, ph: b.c.height, w: util, h: b.alto, x: A4.m, y: A4.h - A4.m - b.y - b.alto });
    }
    final.push(imgs);
  }
  alAvanzar(1);
  return armarPDF(final);
}
