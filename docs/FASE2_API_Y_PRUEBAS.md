# Fase 2: API, idempotencia y pruebas

## Resultado
| Prueba | Dónde | Resultado |
|---|---|---|
| `npm run probar` (cuadre + instalación + 124 verificaciones) | PC (simulador) | ✅ TODO OK |
| `correrPruebasEnGoogle()`: las mismas 124 verificaciones en 21 casos | Google, libro desechable | ✅ **124/124** (16/10/2026) |
| Concurrencia REAL: 3 "cobradores" cobrando a la vez (3 ejecuciones en paralelo) | Google | ✅ 11 recibos R-000116…R-000126 intercalados entre los 3, **0 duplicados, 0 saltos**, cuadra |

Las pruebas en Google nunca tocan el libro de PRUEBAS. Cada corrida crea un libro **desechable** en `DANDINET_PRUEBAS/Pruebas automáticas`, importa `migracion.json`, prueba todo y al final lo manda a la papelera.

## Qué se construyó
| Archivo | Contenido |
|---|---|
| `backend/Api.gs` | **Puerta única** `ejecutarAccion(accion, datos, email, idSolicitud, extra)`: lectura, escritura con idempotencia, cola offline y conflictos "A revisar" |
| `backend/Clientes.gs` | Nuevo `op_editarCliente`: edita solo lo que cambia, con las mismas validaciones del alta, y deja en la Bitácora el valor anterior y el nuevo (las claves WiFi solo como "(cambiada)") |
| `backend/Transaccion.gs` | Códigos de error (`VALIDACION`, `PROHIBIDO`, `NO_AUTORIZADO`, `OCUPADO`) e `ID_SOLICITUD` y `RESULTADO` en cada línea de la Bitácora |
| `backend/Pruebas.gs` | Los 21 casos, ejecutables en la PC y en Google. También `prepararConcurrencia` / `cobrosConcurrentes` / `verificarConcurrencia` y `medirTiempos` |
| `pruebas-local/fase2.js` | Corre `Pruebas.gs` en el simulador |

## Contrato de la API (lo que usará la app)
Formato: `{ ok: true, datos }` o `{ ok: false, error, codigoError }`.

| codigoError | Cuándo | Qué hará la app |
|---|---|---|
| `VALIDACION` | Regla de negocio (mes pagado, DNI inválido…) | Mostrar el mensaje |
| `PROHIBIDO` | El rol no permite la acción (hoy no ocurre: todos son ADMIN) | Mostrar el mensaje |
| `NO_AUTORIZADO` | Correo fuera de Usuarios o `ACTIVO = No` | **Borrar datos locales** y cerrar sesión |
| `OCUPADO` | Otro cobro tenía el candado más de 30 s | Reintentar sola (2, 4, 8 s…) |
| `ACCION_DESCONOCIDA` / `INTERNO` | Error de programa | Reintentar y avisar |

| Acción | Tipo | datos |
|---|---|---|
| `perfil` | lectura | — → usuario, config pública, entorno, revisiones pendientes |
| `sincronizarDatos` | lectura | `{desde?}` → `tipo` completa/incremental, `hasta`, clientes (con resumen y claves), servicios, cargos, pagos de 60 días, PPPoE, planes, listas |
| `fichaCliente` | lectura | `{idCliente}` → todo el historial |
| `misCobros` | lectura | `{fecha?, usuario?}` → recibos, total por método, anulados y **dinero "A revisar"** (cuadre de caja) |
| `listaCorte`, `reportePPPoE`, `revisiones`, `verificarCuadre` | lectura | filtros |
| `registrarPago` | escritura | `{idCliente, idsCargos[], monto, metodo, operacion?, fechaPago?, gps?, obs?}` + `extra.origen` online/offline + `extra.fDispositivo` |
| `procesarCola` | lote | `{operaciones: [{accion, idSolicitud, datos, fDispositivo}]}` (máx. 20, en orden) |
| `resolverRevision` | escritura | `{idRevision, resolucion: APLICAR / ADELANTO / DEVOLVER, idsCargos?, motivo}` |
| `anularPago`, `cambiarEstadoServicio` (CORTE/SUSPENSION/BAJA), `reactivarServicio`, `guardarCliente` (alta o edición), `nuevoServicio`, `cambiarPlan`, `pppoe` (asignar/liberar/bloquear/desbloquear/agregar), `renovarAnio` | escritura | ver comentarios en `Api.gs` |
| `archivarAnio` | mantenimiento | `{anio}` |

**Reglas que quedaron fijas:**
- Toda escritura exige `idSolicitud`. Repetirlo devuelve **la misma respuesta** (también si fue un rechazo) con `repetido: true`, y no ejecuta nada.
- **Cobro offline en conflicto (D2 y tu regla):** el cobro **completo** va a `PagosRevisar` como "A revisar", **sin número R-**. Aparece en "Mis cobros" del cobrador y en el perfil del ADMIN.
  - Al resolverlo (APLICAR o ADELANTO), el recibo sale a nombre del cobrador que recibió el dinero y con la fecha real del cobro.
  - DEVOLVER lo cierra sin recibo.
- Un cobro offline sin `fechaPago` usa la fecha del celular, es decir, cuando realmente se cobró.
- La sincronización incremental no ve los cambios del recálculo nocturno (días de atraso). Por eso, si hubo un recálculo después de `desde`, el servidor manda una descarga **completa** sola.

## Tiempos medidos en Google (16/10/2026, 136 clientes)
| Operación | Tiempo |
|---|---|
| Un cobro (`registrarPago` completo) | **3.5 a 5.6 s** |
| Descarga completa al celular | 3.4 s · 473 KB |
| Perfil | 0.8 s |
| Recálculo nocturno + integridad | 10.4 s (límite: 6 min) |
| Motor en memoria con 500 clientes y 15,000 cargos | 57 ms |

⚠️ **A mejorar en la Fase 3:** cada cobro lee unas 10 tablas completas, de 0.2 a 0.7 s cada una. Con 3 cobradores sincronizando a la vez, uno puede esperar más de 30 s y recibir `OCUPADO`. No se pierde nada: la app reintenta y la prueba de concurrencia lo confirmó. Aun así, conviene que sea más rápido. Plan:
1. guardar en caché Config, Usuarios, Listas y Planes (cambian poco);
2. no leer las tablas que la operación no usa.

Meta: menos de 2 s por cobro.

## Cómo repetir las pruebas
```bash
npm run probar
```
En Google (cada llamada avanza unos 4 minutos; repetir hasta que diga TERMINADO):
```bash
npm run correr:pruebas -- correrPruebasEnGoogle
```
El informe completo de Google queda en `docs/FASE2_RESULTADO_PRUEBAS_GOOGLE.txt`. No se sube a GitHub porque contiene códigos PPPoE.

## Configuración nueva que quedó hecha
- Los dos scripts están vinculados al proyecto de Google Cloud `dandinet-control` (223370778430), con Apps Script API y Drive API habilitadas.
- `clasp run` funciona con el usuario `dandinet` y la credencial `D:\CLAUDE\credenciales\clasp-dandinet.json`, que está fuera del repositorio.
- Al cambiar de proyecto de Cloud, Google anuló los permisos que se habían aceptado en el editor. Se vuelven a pedir la próxima vez que algo corra desde el editor o con un activador (por ejemplo, en la Fase 3, al desplegar la Web App).
