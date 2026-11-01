// Persistencia local. Toda lectura/escritura pasa por aquí para que, cuando haya
// cuentas y suscripción, solo cambie este archivo (p. ej. a un backend con login).
import { DEFAULTS, VERSION_TABLAS } from './data/capeco.js';
import { TIPOS, nuevoElemento } from './data/elementos.js';

const CLAVE = 'metrado-capeco.v2';
const CLAVE_V1 = 'metrado-capeco.v1';

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Copia los valores guardados sobre los valores por defecto (así las tablas nuevas
// de futuras versiones aparecen aunque el usuario ya tenga datos).
function fusionar(base, guardado) {
  if (typeof base !== 'object' || base === null || typeof guardado !== 'object' || guardado === null) {
    return guardado ?? base;
  }
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(guardado)) out[k] = k in base ? fusionar(base[k], v) : v;
  return out;
}

function normalizarProyecto(p) {
  p.elementos ||= [];
  p.registros ||= [];
  p.seleccion ||= { excluidos: {}, modo: 'todo' };
  p.seleccion.excluidos ||= {};
  return p;
}

// ---------- migración desde la versión 1 (partidas sueltas) ----------
const ORDEN_ENC = { sobrecimiento: ['L', 'h'], placa: ['L', 'H'], escalera: ['B', 'L'] };

export function tramosDesdeTexto(texto) {
  const tramos = [];
  let resto = 0;
  for (const t of String(texto || '').split(/[,;]/).map((x) => x.trim().toLowerCase()).filter(Boolean)) {
    const [n, s] = t.split('@');
    if (/^r/.test(n)) resto = parseFloat(s) || 0;
    else tramos.push({ n: parseFloat(n) || 0, s: parseFloat(s) || 0 });
  }
  return { tramos, resto };
}

export function migrarV1(v1) {
  const proyectos = v1.proyectos.map((pv) => {
    const elementos = [];
    for (const pa of pv.partidas || []) {
      const d = pa.datos || {};
      let tipo = pa.tipo === 'muro' ? 'muro' : pa.tipo === 'acero' ? 'columna' : d.elemento;
      if (!TIPOS[tipo]) tipo = 'columna';
      const el = nuevoElemento(tipo, pa.nombre || TIPOS[tipo].nombre, uid());
      el.n = d.n || 1;
      for (const k of Object.keys(el.partidas)) el.partidas[k].activa = false;
      const clave = pa.tipo;
      if (pa.tipo === 'concreto' || pa.tipo === 'encofrado') {
        const orden = pa.tipo === 'encofrado' && ORDEN_ENC[tipo] ? ORDEN_ENC[tipo] : TIPOS[tipo].dims.map((x) => x.k);
        orden.forEach((k, i) => { if (d.dims?.[i] !== undefined) el.dims[k] = d.dims[i]; });
        if (d.mezcla) el.mezcla = d.mezcla;
        if (d.peralte) el.peralte = d.peralte;
      }
      if (pa.tipo === 'acero') {
        const armado = (d.barras || []).map((b) => ({ tipo: 'barras', uso: 'Barras', ...b }));
        if (d.estribos?.diam) {
          const { tramos, resto } = tramosDesdeTexto(d.estribos.dist);
          armado.push({ tipo: 'estribos', uso: 'Estribos', diam: d.estribos.diam, b: d.estribos.b, h: d.estribos.h, rec: d.estribos.rec, long: d.estribos.long, tramos, resto });
        }
        el.partidas.acero.armado = armado;
      }
      if (pa.tipo === 'muro') {
        el.dims = { L: d.largo, H: d.alto };
        Object.assign(el.partidas.muro, {
          ladrillo: d.ladrillo, ladPers: d.ladPers, aparejo: d.aparejo, junta: d.junta, mortero: d.mortero, vanos: d.vanos || [],
        });
      }
      if (el.partidas[clave]) {
        Object.assign(el.partidas[clave], { activa: true, rend: pa.rend || '', cuadrillas: pa.cuadrillas || 1 });
      }
      elementos.push(el);
    }
    return normalizarProyecto({ id: pv.id, nombre: pv.nombre, creado: pv.creado, elementos });
  });
  return { version: VERSION_TABLAS, actual: v1.actual, proyectos, tablas: v1.tablas };
}

export function cargar(ejemplo) {
  let datos = null;
  try { datos = JSON.parse(localStorage.getItem(CLAVE)); } catch { /* sin almacenamiento */ }
  if (!datos) {
    try {
      const v1 = JSON.parse(localStorage.getItem(CLAVE_V1));
      if (v1 && Array.isArray(v1.proyectos)) datos = migrarV1(v1);
    } catch { /* nada que migrar */ }
  }
  if (!datos || !Array.isArray(datos.proyectos)) {
    const p = ejemplo();
    datos = { version: VERSION_TABLAS, actual: p.id, proyectos: [p], tablas: null };
  }
  datos.proyectos.forEach(normalizarProyecto);
  datos.tablas = fusionar(structuredClone(DEFAULTS), datos.tablas || {});
  if (!datos.proyectos.some((p) => p.id === datos.actual)) datos.actual = datos.proyectos[0]?.id;
  return datos;
}

export function guardar(datos) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
    return true;
  } catch {
    return false;
  }
}

export function restaurarTablas(datos) {
  datos.tablas = structuredClone(DEFAULTS);
}

export function importar(texto) {
  let d = JSON.parse(texto);
  if (!d || !Array.isArray(d.proyectos)) throw new Error('El archivo no es un respaldo de Metrado CAPECO');
  if (d.proyectos.some((p) => Array.isArray(p.partidas) && !p.elementos)) d = migrarV1(d);
  d.proyectos.forEach(normalizarProyecto);
  d.tablas = fusionar(structuredClone(DEFAULTS), d.tablas || {});
  if (!d.proyectos.some((p) => p.id === d.actual)) d.actual = d.proyectos[0]?.id;
  return d;
}
