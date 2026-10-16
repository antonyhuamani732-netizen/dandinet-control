/**
 * ESQUEMA DE LA BASE DE DATOS (DANDINET_DB)
 * --------------------------------------------------------------------------
 * Una pestaña por tabla. La fila 1 tiene los encabezados. No hay fórmulas ni
 * celdas combinadas en las tablas de datos.
 *
 * Por cada tabla se define:
 *   clave  : la columna que identifica cada fila.
 *   cols   : las columnas, en orden.
 *   texto  : columnas que SIEMPRE se guardan como texto. Así no se pierden los
 *            ceros a la izquierda (ejemplo: un DNI que empieza con 0).
 *   fecha  : columnas con fecha (formato dd/mm/aaaa).
 *   fechaHora : columnas con fecha y hora.
 *   dinero : columnas en soles, con 2 decimales.
 *   calc   : columnas que calcula el MOTOR. Nadie debe escribirlas a mano.
 *
 * ULT_MODIF (fecha y hora de la última modificación) la pone SOLA la función
 * guardarContexto() en cada fila que cambia. La app la usa para descargar solo
 * lo que cambió desde su última sincronización.
 *
 * Si se agrega una columna, se agrega aquí y se ejecuta `crearEstructura()`.
 * Esa función nunca borra datos; solo agrega lo que falte.
 */
var ESQUEMA = {
  Clientes: {
    clave: 'ID_CLIENTE',
    cols: ['ID_CLIENTE', 'DNI_RUC', 'NOMBRES', 'TELEFONO', 'TELEFONO2', 'DIRECCION', 'REFERENCIA', 'ZONA',
           'COORDENADAS', 'FECHA_ALTA', 'DIA_VENC', 'OBSERVACIONES', 'ULT_MODIF', 'USR_MODIF'],
    texto: ['ID_CLIENTE', 'DNI_RUC', 'TELEFONO', 'TELEFONO2', 'COORDENADAS'],
    fecha: ['FECHA_ALTA'], fechaHora: ['ULT_MODIF'], dinero: [], calc: []
  },
  // Claves WiFi/router en tabla aparte: así una edición de los datos de contacto no las toca.
  // La API las entrega junto con el cliente (todos los usuarios tienen acceso total).
  ClientesPriv: {
    clave: 'ID_CLIENTE',
    cols: ['ID_CLIENTE', 'USUARIO_WIFI', 'CLAVE_WIFI', 'USUARIO_ROUTER', 'CLAVE_ROUTER', 'ULT_MODIF'],
    texto: ['ID_CLIENTE', 'USUARIO_WIFI', 'CLAVE_WIFI', 'USUARIO_ROUTER', 'CLAVE_ROUTER'],
    fecha: [], fechaHora: ['ULT_MODIF'], dinero: [], calc: []
  },
  // Resumen calculado 1:1 con Clientes (todo lo escribe el motor).
  ResumenCliente: {
    clave: 'ID_CLIENTE',
    cols: ['ID_CLIENTE', 'NOMBRES', 'ZONA', 'PLAN', 'TARIFA_MENSUAL', 'PPPOE', 'SERV_ACTIVOS', 'MESES_ADEUDA',
           'DEUDA_VENCIDA', 'DEUDA_TOTAL', 'ULT_PAGO', 'DIAS_ATRASO', 'ESTADO', 'ALERTA', 'F_CALCULO', 'ULT_MODIF'],
    texto: ['ID_CLIENTE', 'PPPOE'],
    fecha: ['ULT_PAGO'], fechaHora: ['F_CALCULO', 'ULT_MODIF'], dinero: ['TARIFA_MENSUAL', 'DEUDA_VENCIDA', 'DEUDA_TOTAL'],
    calc: ['NOMBRES', 'ZONA', 'PLAN', 'TARIFA_MENSUAL', 'PPPOE', 'SERV_ACTIVOS', 'MESES_ADEUDA', 'DEUDA_VENCIDA',
           'DEUDA_TOTAL', 'ULT_PAGO', 'DIAS_ATRASO', 'ESTADO', 'ALERTA', 'F_CALCULO']
  },
  Servicios: {
    clave: 'ID_SERV',
    cols: ['ID_SERV', 'ID_CLIENTE', 'CLIENTE', 'ZONA', 'PLAN', 'MODO', 'TARIFA', 'PPPOE', 'PPPOE_ANT',
           'FECHA_INICIO', 'ESTADO', 'F_ESTADO', 'MOTIVO_ESTADO', 'FECHA_FIN', 'OBS', 'ULT_MODIF'],
    texto: ['ID_SERV', 'ID_CLIENTE', 'PPPOE', 'PPPOE_ANT'],
    fecha: ['FECHA_INICIO', 'F_ESTADO', 'FECHA_FIN'], fechaHora: ['ULT_MODIF'], dinero: ['TARIFA'],
    calc: ['CLIENTE', 'ZONA']
  },
  Cargos: {
    clave: 'ID_CARGO',
    cols: ['ID_CARGO', 'CLAVE', 'ID_SERV', 'ID_CLIENTE', 'CLIENTE', 'PERIODO', 'CONCEPTO', 'MONTO', 'PAGADO',
           'SALDO', 'VENCE', 'DIAS_ATRASO', 'ESTADO', 'ANULADO', 'ZONA', 'PLAN', 'OBS', 'VENCE_FIJO', 'ULT_MODIF'],
    texto: ['ID_CARGO', 'CLAVE', 'ID_SERV', 'ID_CLIENTE'],
    // VENCE_FIJO: vencimiento especial de un cargo (primer mes prorrateado e instalación: vencen el día del alta)
    fecha: ['PERIODO', 'VENCE', 'VENCE_FIJO'], fechaHora: ['ULT_MODIF'], dinero: ['MONTO', 'PAGADO', 'SALDO'],
    calc: ['CLIENTE', 'PAGADO', 'SALDO', 'VENCE', 'DIAS_ATRASO', 'ESTADO', 'ZONA', 'PLAN']
  },
  // ORIGEN: online | offline | MIGRACION.  F_DISPOSITIVO: fecha y hora del celular al cobrar.
  Pagos: {
    clave: 'N_RECIBO',
    cols: ['N_RECIBO', 'FECHA', 'ID_CLIENTE', 'CLIENTE', 'DNI_RUC', 'PERIODOS', 'MONTO', 'METODO', 'OPERACION',
           'USUARIO', 'F_REGISTRO', 'SALDO_RESTANTE', 'ESTADO', 'MOTIVO_ANULACION', 'F_ANULACION', 'OBS',
           'URL_VOUCHER', 'GPS_COBRO', 'ID_SOLICITUD', 'ORIGEN', 'ZONA', 'F_DISPOSITIVO'],
    texto: ['N_RECIBO', 'ID_CLIENTE', 'DNI_RUC', 'OPERACION', 'GPS_COBRO', 'ID_SOLICITUD'],
    fecha: ['FECHA'], fechaHora: ['F_REGISTRO', 'F_ANULACION', 'F_DISPOSITIVO'], dinero: ['MONTO', 'SALDO_RESTANTE'], calc: []
  },
  PagosDet: {
    clave: 'ID_DET',
    cols: ['ID_DET', 'N_RECIBO', 'ID_CARGO', 'ID_SERV', 'ID_CLIENTE', 'PERIODO', 'CONCEPTO', 'MONTO_APLICADO',
           'FECHA_PAGO', 'METODO', 'ZONA', 'PLAN', 'ANULADO'],
    texto: ['ID_DET', 'N_RECIBO', 'ID_CARGO', 'ID_SERV', 'ID_CLIENTE'],
    fecha: ['PERIODO', 'FECHA_PAGO'], fechaHora: [], dinero: ['MONTO_APLICADO'], calc: []
  },
  // ESTADO: Válido | Anulado | PDF_PENDIENTE (el PDF se genera fuera del candado y se reintenta)
  Comprobantes: {
    clave: 'N_RECIBO',
    cols: ['N_RECIBO', 'FECHA_EMISION', 'ID_CLIENTE', 'CLIENTE', 'TOTAL', 'SALDO_PENDIENTE', 'METODO', 'URL_PDF',
           'ID_ARCHIVO', 'ESTADO', 'IMPRESIONES', 'ULT_IMPRESION'],
    texto: ['N_RECIBO', 'ID_CLIENTE', 'ID_ARCHIVO'],
    fecha: [], fechaHora: ['FECHA_EMISION', 'ULT_IMPRESION'], dinero: ['TOTAL', 'SALDO_PENDIENTE'], calc: []
  },
  HistorialEstados: {
    clave: 'ID_HIST',
    cols: ['ID_HIST', 'FECHA', 'ID_CLIENTE', 'CLIENTE', 'ID_SERV', 'ESTADO_ANT', 'ESTADO_NUEVO', 'MOTIVO',
           'USUARIO', 'F_REGISTRO'],
    texto: ['ID_HIST', 'ID_CLIENTE', 'ID_SERV'],
    fecha: ['FECHA'], fechaHora: ['F_REGISTRO'], dinero: [], calc: []
  },
  PPPoE: {
    clave: 'CODIGO',
    cols: ['CODIGO', 'TITULAR', 'ESTADO', 'ID_SERV', 'ID_CLIENTE', 'CLIENTE', 'F_ASIGNACION', 'OBS', 'ULT_MODIF'],
    texto: ['CODIGO', 'ID_SERV', 'ID_CLIENTE'],
    fecha: ['F_ASIGNACION'], fechaHora: ['ULT_MODIF'], dinero: [], calc: ['CLIENTE']
  },
  HistPPPoE: {
    clave: 'ID_HPPP',
    cols: ['ID_HPPP', 'CODIGO', 'ID_CLIENTE', 'CLIENTE', 'ID_SERV', 'F_DESDE', 'F_HASTA', 'MOTIVO_FIN', 'OBS'],
    texto: ['ID_HPPP', 'CODIGO', 'ID_CLIENTE', 'ID_SERV'],
    fecha: ['F_DESDE', 'F_HASTA'], fechaHora: [], dinero: [], calc: []
  },
  Planes: {
    clave: 'PLAN',
    cols: ['PLAN', 'CODIGO', 'TARIFA', 'ACTIVO'],
    texto: [], fecha: [], fechaHora: [], dinero: ['TARIFA'], calc: []
  },
  // Catálogos simples: TIPO = MODO | ZONA | METODO | CONCEPTO | ...
  Listas: {
    clave: 'ID',
    cols: ['ID', 'TIPO', 'VALOR', 'ORDEN', 'ACTIVO'],
    texto: ['ID'], fecha: [], fechaHora: [], dinero: [], calc: []
  },
  // ROL: hoy todos son ADMIN (decisión del dueño). La columna queda para roles futuros.
  // ZONAS: "*" = todas, o una lista separada por comas.
  // INICIALES: para el recibo provisional sin señal (PEND-<INICIALES>-<n>).
  Usuarios: {
    clave: 'EMAIL',
    cols: ['EMAIL', 'NOMBRE', 'ROL', 'ZONAS', 'INICIALES', 'ACTIVO'],
    texto: ['EMAIL', 'INICIALES'], fecha: [], fechaHora: [], dinero: [], calc: []
  },
  Config: {
    clave: 'CLAVE',
    cols: ['CLAVE', 'VALOR', 'DESCRIPCION'],
    texto: ['CLAVE', 'VALOR'], fecha: [], fechaHora: [], dinero: [], calc: []
  },
  // Idempotencia: cada operación de escritura que llega de la app se anota aquí con su resultado.
  // Si la misma ID_SOLICITUD llega otra vez (reintento), se devuelve el resultado guardado sin repetir nada.
  Solicitudes: {
    clave: 'ID_SOLICITUD',
    cols: ['ID_SOLICITUD', 'USUARIO', 'ACCION', 'F_RECIBIDA', 'F_DISPOSITIVO', 'ORIGEN', 'RESULTADO_JSON'],
    texto: ['ID_SOLICITUD', 'RESULTADO_JSON'], fecha: [], fechaHora: ['F_RECIBIDA', 'F_DISPOSITIVO'], dinero: [], calc: []
  },
  // Cobros hechos sin señal que al sincronizar chocan con otro pago (mes ya pagado, monto mayor al saldo).
  // El dinero NO se rechaza: queda aquí, SIN número de recibo, hasta que el ADMIN decide:
  //   APLICAR (a otros meses) · ADELANTO (a meses futuros) · DEVOLVER (se cierra sin recibo).
  // ESTADO: A revisar | Resuelto
  PagosRevisar: {
    clave: 'ID_SOLICITUD',
    cols: ['ID_SOLICITUD', 'F_COBRO', 'F_RECIBIDA', 'USUARIO', 'ID_CLIENTE', 'CLIENTE', 'IDS_CARGOS', 'MONTO', 'METODO',
           'OPERACION', 'URL_VOUCHER', 'GPS', 'OBS', 'MOTIVO_CONFLICTO', 'ESTADO', 'RESOLUCION', 'N_RECIBO_FINAL',
           'RESUELTO_POR', 'F_RESOLUCION', 'MOTIVO_RESOLUCION'],
    texto: ['ID_SOLICITUD', 'ID_CLIENTE', 'IDS_CARGOS', 'OPERACION', 'GPS', 'N_RECIBO_FINAL'],
    fecha: ['F_COBRO'], fechaHora: ['F_RECIBIDA', 'F_RESOLUCION'], dinero: ['MONTO'], calc: []
  },
  // Auditoría: toda operación (aceptada o rechazada) con su usuario e ID_SOLICITUD.
  Bitacora: {
    clave: 'ID',
    cols: ['ID', 'FECHA_HORA', 'USUARIO', 'ACCION', 'ENTIDAD', 'ID_ENTIDAD', 'DETALLE', 'ID_SOLICITUD', 'RESULTADO'],
    texto: ['ID', 'ID_ENTIDAD', 'ID_SOLICITUD'], fecha: [], fechaHora: ['FECHA_HORA'], dinero: [], calc: []
  }
};

/** Orden en que se crean las pestañas. */
var ORDEN_TABLAS = ['Clientes', 'ClientesPriv', 'ResumenCliente', 'Servicios', 'Cargos', 'Pagos', 'PagosDet',
  'Comprobantes', 'HistorialEstados', 'PPPoE', 'HistPPPoE', 'Planes', 'Listas', 'Usuarios', 'Config',
  'Solicitudes', 'PagosRevisar', 'Bitacora'];
