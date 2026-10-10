-- docs/sql-propuestas/2026-10-09_fechas_argentina_PROPUESTA.sql
-- PROPUESTA. NO SE APLICA SOLO y NO esta en scripts/sql (nada la ejecuta). La corre Angel a mano, por pasos.
--
-- Contexto: todas las columnas de fecha son timestamptz (instante correcto). El problema era de LECTURA/CALCULO en
-- el servidor (UTC). Por eso la mayoria de los datos NO necesita correccion; esto revisa los pocos casos que si.
-- Zona: America/Argentina/Buenos_Aires.

-- =====================================================================================
-- PASO 0 (solo lectura): el credito de Arias Nicolas Nahuel. Ver el instante real y como se ve en cada huso.
-- =====================================================================================
SELECT l.id, u.name, l.principal, l.term, l.status,
       l."createdAt",
       l."createdAt" AT TIME ZONE 'UTC'                              AS creado_utc,
       l."createdAt" AT TIME ZONE 'America/Argentina/Buenos_Aires'   AS creado_ar,
       (l."createdAt" AT TIME ZONE 'UTC')::date                      AS dia_utc,
       (l."createdAt" AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS dia_ar,
       l."disbursedAt"
FROM loan l JOIN "user" u ON u.id = l."userId"
WHERE u.name ILIKE '%arias%' AND u.name ILIKE '%nicol%'
ORDER BY l."createdAt" DESC;
-- Lectura: si dia_utc = 2026-10-10 y dia_ar = 2026-10-09, el dato guardado es CORRECTO (instante real 9/10 ~21:xx AR)
-- y lo que estaba mal era mostrarlo/contarlo por dia UTC. Si dia_ar = 2026-10-10, el instante mismo esta mal (no esperado).

-- =====================================================================================
-- PASO 1 (solo lectura): todos los creditos/solicitudes cuyo dia UTC difiere del dia AR (ingresados entre 21:00 y 23:59 AR).
-- Son los que el codigo viejo mostraba o agrupaba un dia adelantado. NO hace falta modificarlos.
-- =====================================================================================
SELECT l.id, u.name, l.principal, l.term, l.status, l."createdAt",
       (l."createdAt" AT TIME ZONE 'UTC')::date AS dia_utc,
       (l."createdAt" AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS dia_ar
FROM loan l JOIN "user" u ON u.id = l."userId"
WHERE (l."createdAt" AT TIME ZONE 'UTC')::date <> (l."createdAt" AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
ORDER BY l."createdAt" DESC;

-- =====================================================================================
-- PASO 2 (solo lectura): vencimientos de cuotas que quedaron en OTRO dia que el esperado.
-- El codigo viejo hacia setMonth() sobre el instante de acreditacion: un credito acreditado el 29/30/31 se corria
-- (31/01 + 1 mes = 03/03). Esperado = dia AR de disbursedAt + n meses (Postgres recorta a fin de mes).
-- OJO: cronogramas reconstruidos o refinanciados parten de otra fecha base; revisar a mano antes de corregir.
-- =====================================================================================
CREATE TEMP VIEW v_cuotas_fecha AS
SELECT i.id AS installment_id, i."loanId", i.number, i.status, i."dueDate",
       (i."dueDate" AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS dia_guardado_ar,
       ((l."disbursedAt" AT TIME ZONE 'America/Argentina/Buenos_Aires')::date + (i.number || ' months')::interval)::date AS dia_esperado
FROM installment i JOIN loan l ON l.id = i."loanId"
WHERE l."disbursedAt" IS NOT NULL;

SELECT * FROM v_cuotas_fecha
WHERE dia_guardado_ar <> dia_esperado
ORDER BY "loanId", number;

-- =====================================================================================
-- PASO 3 (correccion, SOLO si el PASO 2 mostro filas y Angel las reviso): corregir cuotas NO pagas.
-- Con backup y vista previa. Corre todo en una transaccion que termina en ROLLBACK; cambiar a COMMIT recien al validar.
-- =====================================================================================
-- 3a) Backup (queda en la base; no toca datos)
CREATE TABLE IF NOT EXISTS installment_duedate_backup_20261009 AS
SELECT now() AS respaldado_en, i.* FROM installment i WHERE false;

BEGIN;
  INSERT INTO installment_duedate_backup_20261009
  SELECT now(), i.* FROM installment i
  WHERE i.id IN (SELECT installment_id FROM v_cuotas_fecha WHERE dia_guardado_ar <> dia_esperado AND status IN ('pending','overdue'));

  -- 3b) Vista previa del cambio
  SELECT installment_id, "loanId", number, dia_guardado_ar AS antes, dia_esperado AS despues
  FROM v_cuotas_fecha
  WHERE dia_guardado_ar <> dia_esperado AND status IN ('pending','overdue');

  -- 3c) Correccion: vencimiento = 00:00 AR del dia esperado
  UPDATE installment i
  SET "dueDate" = (v.dia_esperado::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
  FROM v_cuotas_fecha v
  WHERE v.installment_id = i.id AND v.dia_guardado_ar <> v.dia_esperado AND v.status IN ('pending','overdue');

  -- 3d) Verificar: no deberia quedar ninguna distinta
  SELECT count(*) AS siguen_distintas FROM v_cuotas_fecha WHERE dia_guardado_ar <> dia_esperado AND status IN ('pending','overdue');
ROLLBACK;  -- cambiar por COMMIT solo despues de revisar 3b y 3d
-- Restaurar si hiciera falta: UPDATE installment i SET "dueDate" = b."dueDate" FROM installment_duedate_backup_20261009 b WHERE b.id = i.id;
-- Las cuotas pagadas (status = 'paid') NO se tocan.

-- =====================================================================================
-- PASO 4 (solo lectura): fechas "solo fecha" cargadas a mano que se guardaron a las 00:00 UTC (= 21:00 AR del dia anterior).
-- Pasaba con new Date('AAAA-MM-DD') en admin (acreditacion manual, variables BCRA). Son CANDIDATAS: revisar una a una.
-- El codigo nuevo lee estos valores con dateOnlyKey() (00:00Z exacto = fecha UTC), asi que NO hay que corregirlos para desplegar.
-- =====================================================================================
SELECT 'loan.disbursedAt' AS campo, l.id, l."disbursedAt" AS valor
FROM loan l
WHERE l."disbursedAt" IS NOT NULL AND (l."disbursedAt" AT TIME ZONE 'UTC')::time = '00:00:00'
UNION ALL
SELECT 'bcra_variable.effectiveDate', b.id, b."effectiveDate"
FROM bcra_variable b
WHERE b."effectiveDate" IS NOT NULL AND (b."effectiveDate" AT TIME ZONE 'UTC')::time = '00:00:00';
-- Si se quisiera normalizarlas a 00:00 AR (opcional, con backup previo): valor + interval '3 hours'.

-- =====================================================================================
-- PASO 5 (solo lectura): numeros de comprobante DES-AAAAMMDD generados entre 21:00 y 23:59 AR (llevan el dia siguiente).
-- NO se reescriben: son identificadores unicos ya emitidos. Solo para saber cuales son.
-- =====================================================================================
SELECT d.id, d."receiptNumber", d."creditedAt",
       to_char(d."creditedAt" AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYYMMDD') AS dia_ar
FROM disbursement d
WHERE d."creditedAt" IS NOT NULL
  AND substring(d."receiptNumber" from '^DES-(\d{8})-') IS NOT NULL
  AND substring(d."receiptNumber" from '^DES-(\d{8})-') <> to_char(d."creditedAt" AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYYMMDD');