/**
 * SIMULADOR MÍNIMO DE GOOGLE (SpreadsheetApp, DriveApp, LockService…) PARA PRUEBAS LOCALES
 * --------------------------------------------------------------------------
 * Imita el comportamiento que importa para detectar errores reales:
 *  - getRange fuera de la hoja o con 0 filas → error (igual que Google).
 *  - Un texto con forma de número en una columna SIN formato texto (@) se convierte
 *    en número (Google pierde los ceros iniciales). Con formato @ se conserva.
 *  - setValues exige que las dimensiones coincidan.
 *  - El candado no se puede tomar dos veces (detecta transacciones anidadas).
 */
const crypto = require('crypto');

function crearGoogle(opts = {}) {
  let usuario = opts.usuario || 'admin@dandinet.pe';
  const libros = {}, archivos = {}, props = {}, correos = [];
  let activo = null, sec = 0;
  const stats = { lecturas: 0, escrituras: 0 };

  const esNumTxt = (v) => typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim());
  const copia = (v) => (v instanceof Date ? new Date(v.getTime()) : v);

  class Rango {
    constructor(h, r, c, nr, nc) {
      if (nr < 1 || nc < 1) throw new Error(`The number of rows/columns in the range must be at least 1 (${h.nombre})`);
      if (r < 1 || c < 1 || r + nr - 1 > h.maxRows || c + nc - 1 > h.maxCols)
        throw new Error(`The coordinates of the range are outside the dimensions of the sheet (${h.nombre} r${r}+${nr} > ${h.maxRows})`);
      Object.assign(this, { h, r, c, nr, nc });
    }
    getValues() {
      stats.lecturas++;
      const out = [];
      for (let i = 0; i < this.nr; i++) {
        const fila = this.h.celdas[this.r - 1 + i] || [];
        const o = [];
        for (let j = 0; j < this.nc; j++) { const v = fila[this.c - 1 + j]; o.push(v === undefined || v === null ? '' : copia(v)); }
        out.push(o);
      }
      return out;
    }
    getValue() { return this.getValues()[0][0]; }
    setValues(v) {
      stats.escrituras++;
      if (v.length !== this.nr || v.some((f) => f.length !== this.nc))
        throw new Error(`The number of rows/columns in the data does not match the range (${this.h.nombre}: ${v.length}x${v[0] && v[0].length} vs ${this.nr}x${this.nc})`);
      for (let i = 0; i < this.nr; i++) {
        const ri = this.r - 1 + i;
        this.h.celdas[ri] = this.h.celdas[ri] || [];
        for (let j = 0; j < this.nc; j++) {
          const cj = this.c - 1 + j;
          let x = v[i][j];
          if (x === undefined || x === null) x = '';
          const fmt = this.h.formato[cj + 1];
          if (fmt === '@') { if (typeof x === 'number') x = String(x); }
          else if (esNumTxt(x)) x = Number(x);
          this.h.celdas[ri][cj] = copia(x);
        }
      }
      return this;
    }
    setValue(x) { return this.setValues([[x]]); }
    clearContent() { for (let i = 0; i < this.nr; i++) { const f = this.h.celdas[this.r - 1 + i]; if (f) for (let j = 0; j < this.nc; j++) f[this.c - 1 + j] = ''; } return this; }
    setNumberFormat(f) { if (this.r <= 2) for (let j = 0; j < this.nc; j++) this.h.formato[this.c + j] = f; return this; }
    getColumn() { return this.c; }
    getRow() { return this.r; }
    getNumRows() { return this.nr; }
  }
  ['setFontWeight', 'setBackground', 'setFontColor', 'setFontSize'].forEach((m) => { Rango.prototype[m] = function () { return this; }; });

  class Hoja {
    constructor(nombre) { Object.assign(this, { nombre, celdas: [], maxRows: 1000, maxCols: 26, formato: {}, cf: [] }); }
    getName() { return this.nombre; }
    getLastRow() { for (let i = this.celdas.length - 1; i >= 0; i--) if ((this.celdas[i] || []).some((v) => v !== '' && v !== undefined && v !== null)) return i + 1; return 0; }
    getLastColumn() { let m = 0; this.celdas.forEach((f) => { (f || []).forEach((v, j) => { if (v !== '' && v !== undefined && v !== null) m = Math.max(m, j + 1); }); }); return m; }
    getMaxRows() { return this.maxRows; }
    insertRowsAfter(_, n) { this.maxRows += n; }
    getRange(r, c, nr = 1, nc = 1) { return new Rango(this, r, c, nr, nc); }
    appendRow(a) { const r = this.getLastRow() + 1; if (r > this.maxRows) this.maxRows = r; this.getRange(r, 1, 1, a.length).setValues([a]); }
    clear() { this.celdas = []; this.formato = {}; return this; }
    setFrozenRows() {}
    getConditionalFormatRules() { return this.cf; }
    setConditionalFormatRules(r) { this.cf = r; }
  }

  class Libro {
    constructor(nombre) { this.nombre = nombre; this.id = 'SS' + (++sec); this.hojas = [new Hoja('Hoja 1')]; libros[this.id] = this; }
    getName() { return this.nombre; }
    getId() { return this.id; }
    getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id + '/edit'; }
    getSheetByName(n) { return this.hojas.find((h) => h.nombre === n) || null; }
    insertSheet(n) { const h = new Hoja(n); this.hojas.push(h); return h; }
    getSheets() { return this.hojas.slice(); }
    deleteSheet(h) { this.hojas = this.hojas.filter((x) => x !== h); }
    setSpreadsheetTimeZone() {}
    setSpreadsheetLocale() {}
  }

  const iter = (arr) => { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; };
  const carpetas = {};
  const nuevaCarpeta = (nombre) => {
    const c = { id: 'FD' + (++sec), nombre, hijos: [], files: [] };
    Object.assign(c, {
      getId: () => c.id, getName: () => nombre,
      getFoldersByName: (n) => iter(c.hijos.filter((h) => h.nombre === n)),
      createFolder: (n) => { const h = nuevaCarpeta(n); c.hijos.push(h); return h; },
      getFiles: () => iter(c.files),
      setTrashed: (v) => { c.papelera = v; },
    });
    carpetas[c.id] = c;
    return c;
  };
  const raiz = nuevaCarpeta('Mi unidad');
  const archivo = (id) => ({
    getId: () => id, getName: () => (archivos[id] || {}).nombre || (libros[id] || {}).nombre,
    getBlob: () => ({ getDataAsString: () => archivos[id].contenido }),
    getParents: () => iter([]),
    makeCopy: (nombre, carpeta) => { const f = { getName: () => nombre, getDateCreated: () => new Date(), setTrashed: () => {} }; if (carpeta) carpeta.files.push(f); return f; },
    moveTo: () => {},
    setTrashed: () => {},
  });

  let lockTomado = false;
  const G = {
    SpreadsheetApp: {
      getActive: () => activo,
      openById: (id) => { if (!libros[id]) throw new Error('No existe el libro ' + id); return libros[id]; },
      create: (n) => new Libro(n),
      flush: () => {},
      newConditionalFormatRule: () => { const b = { whenTextEqualTo: () => b, setBackground: () => b, setRanges: (r) => { b.r = r; return b; }, build: () => ({ getRanges: () => b.r }) }; return b; },
    },
    DriveApp: {
      getFileById: (id) => { if (!archivos[id] && !libros[id]) throw new Error('No existe el archivo ' + id); return archivo(id); },
      getFolderById: (id) => { if (!carpetas[id]) throw new Error('No existe la carpeta'); return carpetas[id]; },
      getRootFolder: () => raiz,
      createFolder: (n) => raiz.createFolder(n),
      getFilesByName: (n) => iter(Object.keys(archivos).filter((id) => archivos[id].nombre === n).map((id) => archivo(id))),
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => { if (lockTomado) throw new Error('CANDADO ANIDADO: una transacción dentro de otra'); lockTomado = true; return true; },
        waitLock: () => { if (lockTomado) throw new Error('CANDADO ANIDADO'); lockTomado = true; },
        releaseLock: () => { lockTomado = false; },
        hasLock: () => lockTomado,
      }),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: (k) => { delete props[k]; } }) },
    Session: { getActiveUser: () => ({ getEmail: () => usuario }), getEffectiveUser: () => ({ getEmail: () => usuario }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate: (d, tz, f) => {
        const p = (n) => String(n).padStart(2, '0');
        return f.replace('yyyy', d.getFullYear()).replace('MM', p(d.getMonth() + 1)).replace('dd', p(d.getDate()))
          .replace('HH', p(d.getHours())).replace('mm', p(d.getMinutes()));
      },
    },
    MailApp: { sendEmail: (...a) => correos.push(a) },
    Logger: { log: () => {} },
  };
  return {
    G, libros, stats, correos,
    nuevoLibro: (n) => { const l = new Libro(n); activo = activo || l; return l; },
    subirArchivo: (nombre, contenido) => { const id = 'FL' + (++sec); archivos[id] = { nombre, contenido }; return id; },
    setUsuario: (u) => { usuario = u; },
    candadoLibre: () => !lockTomado,
  };
}

module.exports = { crearGoogle };
