// Iconos SVG propios (trazo 2 px, 24×24, color del texto). Sin red.
const P = {
  partidas: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  planilla: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
  resumen: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  obra: '<path d="M2 20h20M6 20V10l6-5 6 5v10"/><path d="M10 20v-5h4v5"/>',
  tablas: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  proyectos: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  concreto: '<path d="M3 17l9 4 9-4M3 12l9 4 9-4M12 3l9 4-9 4-9-4z"/>',
  encofrado: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 3v18M16 3v18M4 9h4M16 15h4"/>',
  acero: '<path d="M4 20L20 4M4 14l6 6M14 4l6 6"/><circle cx="12" cy="12" r="1.5"/>',
  muro: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M3 15h18M9 4v5M15 9v6M9 15v5"/>',
  manual: '<path d="M9 4h10v16H5V8z"/><path d="M9 4v4H5M9 13h6M9 17h4"/>',
  medida: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  calculadora: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h2M14 11h2M8 15h2M14 15h2M8 19h2M14 19h2"/>',
  ayuda: '<circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01"/>',
  abajo: '<path d="M6 9l6 6 6-6"/>',
  arriba: '<path d="M6 15l6-6 6 6"/>',
  expandir: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  costado: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>',
  exportar: '<path d="M12 3v12M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  importar: '<path d="M12 15V3M7 10l5 5 5-5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  excel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8l8 8M16 8l-8 8"/>',
  pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 15h8M8 18h5"/>',
  compartir: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  luna: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  editar: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  duplicar: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  ocultar: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/>',
  borrar: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
  aviso: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  ok: '<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  flecha: '<path d="M9 6l6 6-6 6"/>',
  cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
  guia: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
  zapata: '<path d="M3 16h18v4H3zM9 4h6v12H9z"/>',
  columna: '<path d="M8 3h8v18H8zM8 8h8M8 13h8M8 18h8"/>',
  viga: '<path d="M2 8h20v6H2zM5 14v6M19 14v6"/>',
  losa: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M2 13l10 5 10-5"/>',
  escalera: '<path d="M3 21h4v-4h4v-4h4V9h4V5h2"/>',
  cimiento: '<path d="M2 14h20M4 14v6h16v-6M8 14V9h8v5"/>',
  placa: '<path d="M6 3h12v18H6zM6 9h12M6 15h12"/>',
  menu: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  rayo: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  gota: '<path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z"/>',
  pala: '<path d="M14 4l6 6M17 7l-8 8"/><path d="M9 15l-4 4a2 2 0 0 1-3-3l4-4z"/>',
  rodillo: '<rect x="4" y="3" width="14" height="6" rx="1"/><path d="M18 6h2v5h-8v3M11 14h2v7h-2z"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  estrella: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
};

export const ICONO_TIPO = {
  cimiento: 'cimiento', sobrecimiento: 'cimiento', zapata: 'zapata', columna: 'columna', viga: 'viga',
  placa: 'placa', losa_maciza: 'losa', losa_aligerada: 'losa', escalera: 'escalera', muro: 'muro', manual: 'manual',
  libre_est: 'pala', libre_arq: 'rodillo', libre_san: 'gota', libre_ele: 'rayo',
};

// Icono de cada especialidad (cabeceras y selector).
export const ICONO_ESP = { estructuras: 'columna', arquitectura: 'muro', sanitarias: 'gota', electricas: 'rayo', otras: 'manual' };

export function icono(nombre, clase = '') {
  return `<svg class="ico ${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[nombre] || P.info}</svg>`;
}
