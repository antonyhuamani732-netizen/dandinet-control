// Persistencia local. Toda lectura/escritura pasa por aquí para que, cuando haya
// cuentas y suscripción, solo cambie este archivo (p. ej. a un backend con login).
import { DEFAULTS, VERSION_TABLAS } from './data/capeco.js';

const CLAVE = 'metrado-capeco.v1';

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

export function cargar(ejemplo) {
  let datos = null;
  try { datos = JSON.parse(localStorage.getItem(CLAVE)); } catch { /* sin almacenamiento */ }
  if (!datos || !Array.isArray(datos.proyectos)) {
    const p = ejemplo();
    datos = { version: VERSION_TABLAS, actual: p.id, proyectos: [p], tablas: null };
  }
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
  const d = JSON.parse(texto);
  if (!d || !Array.isArray(d.proyectos)) throw new Error('El archivo no es un respaldo de Metrado CAPECO');
  d.tablas = fusionar(structuredClone(DEFAULTS), d.tablas || {});
  if (!d.proyectos.some((p) => p.id === d.actual)) d.actual = d.proyectos[0]?.id;
  return d;
}
