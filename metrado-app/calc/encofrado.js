import { mat, num } from './util.js';

// Área de contacto (m²) de un elemento. Vigas: dims = [b, h, L, e] y clase.
export function areaEncofrado(elemento, dims, clase) {
  const d = dims.map(num);
  switch (elemento) {
    case 'zapata': return 2 * (d[0] + d[1]) * d[2];
    case 'sobrecimiento': return 2 * d[0] * d[1];
    case 'columna': return 2 * (d[0] + d[1]) * d[2];
    case 'viga': {
      const [b, h, L, e = 0] = d;
      if (clase === 'chata') return b * L; // los costados son la propia losa
      if (clase === 'borde') return (b + h + Math.max(0, h - e)) * L; // cara exterior completa
      if (clase === 'peraltada') return (b + 2 * Math.max(0, h - e)) * L;
      return (b + 2 * h) * L; // datos anteriores sin clase
    }
    case 'placa': return 2 * d[0] * d[1];
    case 'losa_maciza':
    case 'losa_aligerada':
    case 'escalera': return d[0] * d[1];
    default: throw new Error(`Elemento desconocido: ${elemento}`);
  }
}

// p = { elemento, dims, n, clase }
export function calcEncofrado(p, T) {
  const t = T.encofrado[p.elemento];
  if (!t) throw new Error(`Sin tabla de encofrado para ${p.elemento}`);
  const area = areaEncofrado(p.elemento, p.dims, p.clase) * (num(p.n) || 1);
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
