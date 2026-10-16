# Migración desde el Excel v2

## De dónde salen los datos
`D:\CLAUDE\MACROS EXCEL\CONTROL 2026 v2 - fuentes\build\`:
- `migracion.json`: tablas limpias del Excel v2 (clientes, servicios, cargos, pagos, detalle, PPPoE, historiales y catálogos).
- `esperado.json`: cifras de control calculadas por el Excel al **04/08/2026** (con día de vencimiento = 1).

Estos archivos **no se suben a GitHub** (datos personales). El `.gitignore` los bloquea.

## Cómo se cargan
La carga la hace Apps Script, no Node: `backend/Migracion.gs` lee `migracion.json` desde Google Drive y escribe cada tabla en un solo bloque, **conservando los IDs** (CLI-, SRV-, CRG-, MIG-). Luego `verificarCuadre()` compara contra `esperado.json` y escribe la pestaña **Cuadre**.

Los pasos están en [../docs/FASE1_INSTALACION.md](../docs/FASE1_INSTALACION.md).

## Controles del cuadre (deben dar todos OK)
| Control | Esperado |
|---|---|
| Clientes / Servicios / Cargos / Recibos / Detalle | 136 / 132 / 2,855 / 1,076 / 2,040 |
| Total pagado | S/ 98,326.50 |
| Facturado no anulado | S/ 131,562.00 |
| Saldo pendiente | S/ 33,235.50 |
| Deuda vencida al 04/08/2026 | S/ 18,975.50, con 0 diferencias por cliente |
| Saldo por cliente | 0 diferencias |
| PPPoE | 35 códigos, 26 asignados |

## Pendientes heredados (se migran tal cual y se muestran al dueño)
Quedan en la pestaña **AvisosMigracion**: 6 teléfonos inválidos (uno es CLI-0136), el recibo MIG-00265 con fecha futura (14/12/2026) y 3 PPPoE asignados a servicios cortados (los códigos se ven en la pestaña, no aquí: pueden ser DNI). Además: 5 instalaciones por S/ 355 "ANULADO – POR REVISAR" y el RUC del negocio inválido.

## Migración real (antes de producción)
Necesita los datos al día (pagos posteriores al 04/08/2026, decisión D7). Se hará en la Fase 9 sobre el libro de PRODUCCIÓN, con un informe de diferencias del saldo por cliente contra el Excel.
