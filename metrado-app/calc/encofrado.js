import { mat, num } from './util.js';

// Área de contacto (m²) de un elemento.
export function areaEncofrado(elemento, dims) {
  const d = dims.map(num);
  switch (elemento) {
    case 'zapata': return 2 * (d[0] + d[1]) * d[2];
    case 'sobrecimiento': return 2 * d[0] * d[1];
    case 'columna': return 2 * (d[0] + d[1]) * d[2];
    case 'viga': return (d[0] + 2 * d[1]) * d[2];
    case 'placa': return 2 * d[0] * d[1];
    case 'losa_maciza':
    case 'losa_aligerada':
    case 'escalera': return d[0] * d[1];
    default: throw new Error(`Elemento desconocido: ${elemento}`);
  }
}

// p = { elemento, dims, n }
export function calcEncofrado(p, T) {
  const t = T.encofrado[p.elemento];
  if (!t) throw new Error(`Sin tabla de encofrado para ${p.elemento}`);
  const area = areaEncofrado(p.elemento, p.dims) * (num(p.n) || 1);
  return {
    cantidad: area,
    und: 'm²',
    materiales: [
      mat('madera', 'Madera tornillo', 'p²', area * t.madera),
      mat('clavos', 'Clavos para madera 3"', 'kg', area * t.clavos),
      mat('alambre8', 'Alambre negro N°8', 'kg', area * t.alambre),
    ],
    detalle: '',
    rendKey: `encofrado.${p.elemento}`,
  };
}
