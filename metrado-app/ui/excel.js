// Plantilla Excel, importación con validación y exportación del proyecto en el mismo formato.
// Recibe la librería XLSX (SheetJS) ya cargada, así se puede probar en Node.
import { TIPOS, nuevoElemento, medidas } from '../data/elementos.js';
import { piezasItem, tramosATexto } from '../calc/acero.js';
import { contextoAcero } from '../calc/elemento.js';
import { tramosDesdeTexto, uid } from '../storage.js';
import { num, evaluar } from '../calc/util.js';

const ESTRUCTURAS = Object.keys(TIPOS).filter((k) => TIPOS[k].esp === 'estructuras');
const LETRAS = ['b', 'h', 'H', 'L', 'A', 'B', 'e', 't', 'np', 'p', 'cp'];
const COL_EL = ['Elemento', 'Tipo', 'Cantidad', ...LETRAS, 'Concreto', 'Peralte losa (cm)', 'Clase de viga', 'Recubrimiento (cm)',
  'Incluir concreto', 'Incluir encofrado', 'Incluir acero', 'Concreto fijo (m3)', 'Encofrado fijo (m2)', 'Acero fijo (kg)'];
const COL_AC = ['Elemento', 'Tipo de acero', 'Descripción', 'Diámetro', 'Cantidad', 'Longitud (m)', 'Separación (m)', 'Dirección',
  'Ganchos', 'Distribución', 'Sección b (m)', 'Sección h (m)', 'Gancho estribo (m)'];
const COL_MU = ['Elemento', 'Cantidad', 'Largo L (m)', 'Alto H (m)', 'Ladrillo', 'Aparejo', 'Junta (cm)', 'Mortero', 'Vanos'];
const COL_MA = ['Partida', 'Unidad', 'Metrado', 'Cantidad', 'Rendimiento (und/día)', 'Capataz', 'Operario', 'Oficial', 'Peón'];

const si = (v) => /^(s[ií]|x|1|true|verdadero)$/i.test(String(v ?? '').trim());
const texto = (v) => String(v ?? '').trim();
const vacio = (v) => texto(v) === '';

function instrucciones(T) {
  const medidasPorTipo = ESTRUCTURAS.map((k) => [`  ${k}`, `${TIPOS[k].nombre}: ${TIPOS[k].dims.map((d) => `${d.k} = ${d.label}`).join(' · ')}`]);
  return [
    ['MANUAL DE IMPORTACIÓN · METRADO CAPECO'],
    [],
    ['Paso', 'Qué hacer'],
    ['1', 'Llena una fila por elemento en la hoja Elementos (zapatas, columnas, vigas, losas, escaleras, cimientos…).'],
    ['2', 'En la hoja Acero, una fila por grupo de barras, malla o estribos. La columna Elemento debe ser igual al nombre de la hoja Elementos.'],
    ['3', 'Muros en la hoja Muros; partidas libres (excavación, tarrajeo…) en la hoja Manual.'],
    ['4', 'Borra las filas de ejemplo que no uses. No cambies los títulos de las columnas.'],
    ['5', 'Guarda el archivo y en la app: Proyectos › Datos › Importar Excel. Verás una vista previa con los errores antes de agregar nada.'],
    [],
    ['Reglas'],
    ['Números', 'Puedes escribir fórmulas como texto: 25.283/2 o 2.28+0.3*2-2*0.04. Decimales con punto o coma.'],
    ['Medidas', 'En metros. Llena solo las letras que usa el tipo (ver abajo). El recubrimiento va en centímetros.'],
    ['Incluir', 'SI o NO. Vacío = lo normal del tipo.'],
    ['Fijo', 'Si escribes un metrado fijo, la app usa ese valor y ajusta los materiales.'],
    ['Acero', 'Si un elemento no tiene filas en Acero, se le pone su armado típico. Barras: cantidad + longitud total de corte. Malla: separación, dirección X/Y y ganchos. Estribos: sección b y h, y distribución (1@.05, 4@.10, r@.25) o cantidad fija.'],
    ['Vanos', 'En Muros: ancho x alto x cantidad separados por ; (ej. 0.9x2.1x1; 1.2x1.0x2).'],
    [],
    ['Tipos y sus medidas'],
    ...medidasPorTipo,
    [],
    ['Valores válidos'],
    ['Concreto', `${Object.keys(T.concreto.fc).join(', ')} o ciclopeo (solo cimiento y sobrecimiento)`],
    ['Peralte losa', Object.keys(T.aligerado).filter((k) => /^\d+$/.test(k)).join(', ')],
    ['Clase de viga', 'peraltada, chata, borde'],
    ['Tipo de acero', 'barras, malla, estribos'],
    ['Diámetro', Object.keys(T.acero.diametros).join(', ')],
    ['Ladrillo', Object.keys(T.ladrillos).join(', ')],
    ['Aparejo', 'soga, cabeza, canto'],
    ['Mortero', Object.keys(T.mortero).join(', ')],
  ];
}

const EJEMPLO = {
  elementos: [
    ['Z-1', 'zapata', 6, '', 0.6, '', '', 1.2, 1.2, '', '', '', '', '', 210, '', '', 7.5, 'SI', 'NO', 'SI'],
    ['C-1', 'columna', 6, 0.25, 0.25, 2.8, '', '', '', '', '', '', '', '', 210, '', '', 4, 'SI', 'SI', 'SI'],
    ['VP-101', 'viga', 4, 0.25, 0.4, '', 4.5, '', '', 0.2, '', '', '', '', 210, '', 'peraltada', 4],
    ['Techo 1', 'losa_aligerada', 1, '', '', '', '', 4, 8, '', '', '', '', '', 210, 20, '', 2],
    ['CC-1', 'cimiento', 1, '', 0.8, '', 32, '', 0.4, '', '', '', '', '', 'ciclopeo', '', '', '', 'SI', 'NO', 'NO'],
  ],
  acero: [
    ['C-1', 'barras', 'Longitudinal', '1/2', 4, '3.4+0.2', '', '', '', '', '', '', ''],
    ['C-1', 'estribos', 'Estribos', '3/8', '', '', '', '', '', '1@.05, 4@.10, r@.25', 0.25, 0.25, ''],
    ['VP-101', 'barras', 'Acero superior corrido', '5/8', 2, '25.283/2', '', '', '', '', '', '', ''],
    ['VP-101', 'barras', 'Acero inferior corrido', '5/8', 2, 5.4, '', '', '', '', '', '', ''],
    ['VP-101', 'estribos', 'Estribos', '3/8', 30, '', '', '', '', '', 0.25, 0.4, 0.13],
    ['Z-1', 'malla', 'Malla inferior X', '1/2', '', '', 0.15, 'X', 2, '', '', '', ''],
    ['Z-1', 'malla', 'Malla inferior Y', '1/2', '', '', 0.15, 'Y', 2, '', '', '', ''],
  ],
  muros: [['M-1', 1, 8, 2.6, 'kk18', 'soga', 1.5, '1:4', '0.9x2.1x1; 1.2x1.0x2']],
  manual: [['Excavación de zanjas', 'm3', 14.5, 1, 3.5, 0.1, 0, 0, 1]],
};

function hoja(XLSX, filas, anchos) {
  const ws = XLSX.utils.aoa_to_sheet(filas);
  if (anchos) ws['!cols'] = anchos.map((w) => ({ wch: w }));
  return ws;
}

function libro(XLSX, T, datos) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, hoja(XLSX, instrucciones(T), [22, 110]), 'Instrucciones');
  XLSX.utils.book_append_sheet(wb, hoja(XLSX, [COL_EL, ...datos.elementos], COL_EL.map((c) => Math.max(8, c.length + 2))), 'Elementos');
  XLSX.utils.book_append_sheet(wb, hoja(XLSX, [COL_AC, ...datos.acero], COL_AC.map((c) => Math.max(9, c.length + 2))), 'Acero');
  XLSX.utils.book_append_sheet(wb, hoja(XLSX, [COL_MU, ...datos.muros], COL_MU.map((c) => Math.max(9, c.length + 2))), 'Muros');
  XLSX.utils.book_append_sheet(wb, hoja(XLSX, [COL_MA, ...datos.manual], COL_MA.map((c) => Math.max(9, c.length + 2))), 'Manual');
  return wb;
}

export function plantilla(XLSX, T) {
  return libro(XLSX, T, EJEMPLO);
}

// ---------- exportar ----------
export function exportarProyecto(XLSX, proyecto, T) {
  const datos = { elementos: [], acero: [], muros: [], manual: [] };
  for (const el of proyecto.elementos) {
    const m = medidas(el);
    if (el.tipo === 'muro') {
      const p = el.partidas.muro;
      datos.muros.push([el.nombre, el.n, m.L, m.H, p.ladrillo, p.aparejo, p.junta, p.mortero,
        (p.vanos || []).map((v) => `${v.ancho}x${v.alto}x${v.cant}`).join('; ')]);
      continue;
    }
    if (el.tipo === 'manual') {
      const p = el.partidas.manual;
      const c = p.cuadrilla || {};
      datos.manual.push([el.nombre, p.und, p.cantidad, el.n, p.rend, c.capataz, c.operario, c.oficial, c.peon]);
      continue;
    }
    const pa = el.partidas;
    const act = (k) => (pa[k] ? (pa[k].activa === false ? 'NO' : 'SI') : '');
    const fijo = (k) => (pa[k] && pa[k].fijo !== null && pa[k].fijo !== undefined ? pa[k].fijo : '');
    datos.elementos.push([el.nombre, el.tipo, el.n, ...LETRAS.map((k) => (k in m ? m[k] : '')), el.mezcla ?? '', el.peralte ?? '', el.clase ?? '',
      pa.acero?.recCm ?? '', act('concreto'), act('encofrado'), act('acero'), fijo('concreto'), fijo('encofrado'), fijo('acero')]);
    const ctx = contextoAcero(el);
    for (const it of pa.acero?.armado || []) {
      if (it.tipo === 'barras') {
        let r;
        try { r = piezasItem(it, T, ctx); } catch { continue; }
        for (const pz of r.piezas) {
          const largo = it.modo === 'total' && pa.acero ? texto(it.long) || pz.long : Math.round(pz.long * 1000) / 1000;
          datos.acero.push([el.nombre, 'barras', it.uso || '', it.diam, pz.cant, largo, '', '', '', '', '', '', '']);
        }
      } else if (it.tipo === 'malla') {
        datos.acero.push([el.nombre, 'malla', it.uso || '', it.diam, '', '', it.sep, it.dir, it.ganchos ?? 0, '', '', '', '']);
      } else if (it.tipo === 'estribos') {
        datos.acero.push([el.nombre, 'estribos', it.uso || '', it.diam, it.cantFija ?? '', '', '', '', '',
          vacio(it.cantFija) ? tramosATexto(it.tramos, it.resto) : '', it.b, it.h, it.gancho ?? '']);
      }
    }
  }
  return libro(XLSX, T, datos);
}

// ---------- importar ----------
function filas(XLSX, wb, nombre) {
  const ws = wb.Sheets[nombre];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: '', raw: true }).map((f, i) => ({ f, fila: i + 2 }));
}

// Número desde una celda: acepta número, texto con coma o fórmula escrita como texto.
function numero(v) {
  if (typeof v === 'number') return { ok: true, v };
  const t = texto(v);
  if (!t) return { ok: true, v: '' };
  const r = evaluar(t);
  return Number.isFinite(r) ? { ok: true, v: /[-+*/()x×÷]/.test(t.replace(/^[-+]/, '')) ? t : r } : { ok: false, v: t };
}

export function importarLibro(XLSX, wb, T, nombreProyecto = 'Proyecto importado') {
  const errores = [];
  const err = (hojaN, fila, msg) => errores.push({ hoja: hojaN, fila, msg });
  const elementos = [];
  const porNombre = new Map();

  for (const { f, fila } of filas(XLSX, wb, 'Elementos')) {
    const nombre = texto(f.Elemento);
    const tipo = texto(f.Tipo).toLowerCase();
    if (!nombre && !tipo) continue;
    if (!nombre) { err('Elementos', fila, 'Falta el nombre del elemento'); continue; }
    if (!ESTRUCTURAS.includes(tipo)) { err('Elementos', fila, `Tipo "${f.Tipo}" no válido. Usa: ${ESTRUCTURAS.join(', ')}`); continue; }
    if (porNombre.has(nombre)) { err('Elementos', fila, `El nombre ${nombre} está repetido`); continue; }
    const el = nuevoElemento(tipo, nombre, uid());
    const n = numero(f.Cantidad);
    el.n = n.ok && n.v !== '' ? n.v : 1;
    for (const d of TIPOS[tipo].dims) {
      const x = numero(f[d.k]);
      if (!x.ok) err('Elementos', fila, `Medida ${d.k} no es un número: "${x.v}"`);
      else if (x.v !== '') el.dims[d.k] = x.v;
    }
    const conc = texto(f.Concreto).toLowerCase();
    if (conc) {
      if (conc === 'ciclopeo' || conc === 'ciclópeo') {
        if (TIPOS[tipo].mezcla === 'ciclopeo') el.mezcla = 'ciclopeo'; else err('Elementos', fila, 'Ciclópeo solo para cimiento y sobrecimiento');
      } else if (T.concreto.fc[conc]) el.mezcla = conc;
      else err('Elementos', fila, `Concreto "${f.Concreto}" no válido`);
    }
    if (!vacio(f['Peralte losa (cm)']) && el.peralte !== undefined) {
      const pr = texto(f['Peralte losa (cm)']);
      if (T.aligerado[pr]) el.peralte = pr; else err('Elementos', fila, `Peralte ${pr} no válido`);
    }
    if (!vacio(f['Clase de viga']) && el.clase !== undefined) {
      const c = texto(f['Clase de viga']).toLowerCase();
      if (['peraltada', 'chata', 'borde'].includes(c)) el.clase = c; else err('Elementos', fila, `Clase de viga "${c}" no válida`);
    }
    if (el.partidas.acero && !vacio(f['Recubrimiento (cm)'])) {
      const r = numero(f['Recubrimiento (cm)']);
      if (r.ok) el.partidas.acero.recCm = num(r.v); else err('Elementos', fila, 'Recubrimiento no es un número');
    }
    for (const [col, k] of [['Incluir concreto', 'concreto'], ['Incluir encofrado', 'encofrado'], ['Incluir acero', 'acero']]) {
      if (el.partidas[k] && !vacio(f[col])) el.partidas[k].activa = si(f[col]);
    }
    for (const [col, k] of [['Concreto fijo (m3)', 'concreto'], ['Encofrado fijo (m2)', 'encofrado'], ['Acero fijo (kg)', 'acero']]) {
      if (el.partidas[k] && !vacio(f[col])) {
        const x = numero(f[col]);
        if (x.ok) el.partidas[k].fijo = num(x.v); else err('Elementos', fila, `${col} no es un número`);
      }
    }
    el._filaAcero = false;
    elementos.push(el);
    porNombre.set(nombre, el);
  }

  for (const { f, fila } of filas(XLSX, wb, 'Acero')) {
    const nombre = texto(f.Elemento);
    if (!nombre && vacio(f['Tipo de acero'])) continue;
    const el = porNombre.get(nombre);
    if (!el) { err('Acero', fila, `No hay un elemento llamado "${nombre}" en la hoja Elementos`); continue; }
    if (!el.partidas.acero) { err('Acero', fila, `${nombre} (${el.tipo}) no lleva acero`); continue; }
    const tipo = texto(f['Tipo de acero']).toLowerCase();
    const diam = texto(f['Diámetro']).replace(/["”]/g, '').replace(/\s+/g, '').toLowerCase();
    if (!T.acero.diametros[diam]) { err('Acero', fila, `Diámetro "${f['Diámetro']}" no válido. Usa: ${Object.keys(T.acero.diametros).join(', ')}`); continue; }
    if (!el._filaAcero) { el.partidas.acero.armado = []; el._filaAcero = true; }
    const uso = texto(f['Descripción']);
    const cant = numero(f.Cantidad);
    if (!cant.ok) { err('Acero', fila, 'Cantidad no es un número'); continue; }
    if (tipo === 'barras') {
      const largo = numero(f['Longitud (m)']);
      if (!largo.ok || largo.v === '') { err('Acero', fila, 'Barras: falta la longitud o no es un número'); continue; }
      el.partidas.acero.armado.push({ tipo: 'barras', modo: 'total', uso: uso || 'Barras', diam, cant: cant.v === '' ? 1 : cant.v, long: largo.v });
    } else if (tipo === 'malla') {
      const sep = numero(f['Separación (m)']);
      if (!sep.ok || !num(sep.v)) { err('Acero', fila, 'Malla: falta la separación'); continue; }
      const dir = texto(f['Dirección']).toUpperCase() === 'Y' ? 'Y' : 'X';
      el.partidas.acero.armado.push({ tipo: 'malla', uso: uso || `Malla en ${dir}`, diam, sep: sep.v, dir, ganchos: num(f.Ganchos) || 0 });
    } else if (tipo === 'estribos') {
      const m = medidas(el);
      const dist = texto(f['Distribución']);
      const { tramos, resto } = tramosDesdeTexto(dist || '1@.05, 4@.10, r@.25');
      const it = {
        tipo: 'estribos', uso: uso || 'Estribos', diam, b: num(f['Sección b (m)']) || m.b || 0.25, h: num(f['Sección h (m)']) || m.h || 0.25,
        long: TIPOS[el.tipo].luz ? TIPOS[el.tipo].luz(m) : 3, tramos, resto,
      };
      if (!vacio(f['Gancho estribo (m)'])) it.gancho = num(f['Gancho estribo (m)']);
      if (cant.v !== '' && !dist) it.cantFija = cant.v;
      el.partidas.acero.armado.push(it);
    } else {
      err('Acero', fila, `Tipo de acero "${f['Tipo de acero']}" no válido. Usa: barras, malla, estribos`);
    }
  }
  for (const el of elementos) delete el._filaAcero;

  for (const { f, fila } of filas(XLSX, wb, 'Muros')) {
    const nombre = texto(f.Elemento);
    if (!nombre) continue;
    const el = nuevoElemento('muro', nombre, uid());
    const L = numero(f['Largo L (m)']);
    const H = numero(f['Alto H (m)']);
    if (!L.ok || !H.ok || L.v === '' || H.v === '') { err('Muros', fila, 'Largo y alto son obligatorios y deben ser números'); continue; }
    el.dims = { L: L.v, H: H.v };
    el.n = num(f.Cantidad) || 1;
    const p = el.partidas.muro;
    const lad = texto(f.Ladrillo).toLowerCase();
    if (lad) { if (T.ladrillos[lad]) p.ladrillo = lad; else err('Muros', fila, `Ladrillo "${f.Ladrillo}" no válido`); }
    const ap = texto(f.Aparejo).toLowerCase();
    if (ap) { if (['soga', 'cabeza', 'canto'].includes(ap)) p.aparejo = ap; else err('Muros', fila, `Aparejo "${f.Aparejo}" no válido`); }
    if (!vacio(f['Junta (cm)'])) p.junta = num(f['Junta (cm)']);
    const mo = texto(f.Mortero);
    if (mo) { if (T.mortero[mo]) p.mortero = mo; else err('Muros', fila, `Mortero "${mo}" no válido`); }
    const vanos = texto(f.Vanos);
    p.vanos = [];
    if (vanos) {
      for (const v of vanos.split(';').map((x) => x.trim()).filter(Boolean)) {
        const [ancho, alto, cnt] = v.toLowerCase().split(/[x×*]/).map((x) => num(x.trim()));
        if (!ancho || !alto) err('Muros', fila, `Vano "${v}" no válido: usa ancho x alto x cantidad`);
        else p.vanos.push({ ancho, alto, cant: cnt || 1 });
      }
    }
    elementos.push(el);
  }

  for (const { f, fila } of filas(XLSX, wb, 'Manual')) {
    const nombre = texto(f.Partida);
    if (!nombre) continue;
    const el = nuevoElemento('manual', nombre, uid());
    const met = numero(f.Metrado);
    if (!met.ok) { err('Manual', fila, 'Metrado no es un número'); continue; }
    el.n = num(f.Cantidad) || 1;
    Object.assign(el.partidas.manual, {
      und: texto(f.Unidad) || 'und', cantidad: met.v === '' ? 0 : met.v, rend: num(f['Rendimiento (und/día)']) || 1,
      cuadrilla: { capataz: num(f.Capataz), operario: num(f.Operario), oficial: num(f.Oficial), peon: num(f['Peón']) },
    });
    elementos.push(el);
  }

  if (!wb.Sheets.Elementos && !wb.Sheets.Muros && !wb.Sheets.Manual) {
    err('Archivo', 0, 'No es la plantilla de Metrado CAPECO (faltan las hojas Elementos, Acero, Muros, Manual)');
  }
  return {
    proyecto: {
      id: uid(), nombre: nombreProyecto, creado: new Date().toISOString(), elementos, registros: [],
      seleccion: { excluidos: {}, modo: 'todo' },
    },
    errores,
  };
}
