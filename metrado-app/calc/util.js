// Convierte un valor a número. Acepta expresiones simples como en Excel: "25.283/2",
// "2.28+0.3*2-2*0.04", "=14+8", "(1.2+0.3)*2". Si no se puede leer, devuelve 0.
export function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v ?? '').trim();
  if (!s) return 0;
  if (/^[-+]?\d*[.,]?\d+$/.test(s)) return parseFloat(s.replace(',', '.'));
  const r = evaluar(s);
  return Number.isFinite(r) ? r : 0;
}

// ¿El texto es una fórmula (no un número simple)?
export const esExpresion = (v) => typeof v === 'string' && /[-+*/x×÷()]/.test(v.trim().replace(/^[-+]/, '')) && Number.isFinite(evaluar(v));

// Evaluador propio: solo números, + − × ÷ y paréntesis (nunca ejecuta código).
export function evaluar(texto) {
  const s = String(texto).trim().replace(/^=/, '').replace(/,/g, '.').replace(/[x×]/g, '*').replace(/÷/g, '/').replace(/\s+/g, '');
  let i = 0;
  const numero = () => {
    const m = /^\d*\.?\d+(e[-+]?\d+)?/i.exec(s.slice(i));
    if (!m) throw new Error('número');
    i += m[0].length;
    return parseFloat(m[0]);
  };
  const factor = () => {
    if (s[i] === '+') { i++; return factor(); }
    if (s[i] === '-') { i++; return -factor(); }
    if (s[i] === '(') {
      i++;
      const v = suma();
      if (s[i] !== ')') throw new Error('paréntesis');
      i++;
      return v;
    }
    return numero();
  };
  const producto = () => {
    let v = factor();
    while (s[i] === '*' || s[i] === '/') {
      const op = s[i++];
      const w = factor();
      v = op === '*' ? v * w : v / w;
    }
    return v;
  };
  function suma() {
    let v = producto();
    while (s[i] === '+' || s[i] === '-') {
      const op = s[i++];
      const w = producto();
      v = op === '+' ? v + w : v - w;
    }
    return v;
  }
  try {
    const v = suma();
    return i === s.length ? v : NaN;
  } catch {
    return NaN;
  }
}

export function mat(clave, nombre, und, cantidad) {
  return { clave, nombre, und, cantidad };
}
