-- SOLO LECTURA. NO SE EJECUTA AUTOMATICAMENTE. Para que Angel decida caso por caso.
-- Clientes ya APROBADOS que no cumplen Key 6 (DNI frente + DNI dorso + selfie/prueba de vida + sesion aprobada).
-- Regla: lib/key6.ts (solo clientes; admin/operadores/tesoreria exentos).
-- Requiere SQL 02 (tabla kyc_evidence). Si no existe, quitar el CTE "ev" y usar solo las columnas/ocrData.
-- (sin vistas temporales: el CTE se repite en cada consulta para respetar READ ONLY)
-- Aproximacion: la decision de Didit se lee de kyc_verification."ocrData" (jsonb) con jsonpath; las columnas
-- dniFrontImageUrl/dniBackImageUrl/selfieImageUrl y kyc_evidence tambien cuentan como evidencia, igual que en la app.
-- CUIL enmascarado: solo los ultimos 3 digitos. No se listan nombres ni emails.
BEGIN READ ONLY;

-- 1) Conteos
WITH ev AS (
  SELECT "userId",
         bool_or(kind = 'dni_front') AS ev_front,
         bool_or(kind = 'dni_back')  AS ev_back,
         bool_or(kind = 'selfie')    AS ev_selfie
  FROM kyc_evidence GROUP BY "userId"
),
k6 AS (SELECT
  p."userId",
  p.cuil,
  p."kycStatus" AS perfil_kyc,
  k.status      AS kyc_status,
  k.provider,
  (COALESCE(ev.ev_front,false)  OR NULLIF(btrim(k."dniFrontImageUrl"),'') IS NOT NULL
     OR jsonb_path_exists(COALESCE(k."ocrData",'{}'::jsonb), '$.**.id_verifications[*] ? (@.front_image != "" || @.full_front_image != "")')) AS tiene_frente,
  (COALESCE(ev.ev_back,false)   OR NULLIF(btrim(k."dniBackImageUrl"),'') IS NOT NULL
     OR jsonb_path_exists(COALESCE(k."ocrData",'{}'::jsonb), '$.**.id_verifications[*] ? (@.back_image != "" || @.full_back_image != "")')) AS tiene_dorso,
  (COALESCE(ev.ev_selfie,false) OR NULLIF(btrim(k."selfieImageUrl"),'') IS NOT NULL
     OR jsonb_path_exists(COALESCE(k."ocrData",'{}'::jsonb), '$.**.liveness_checks[*] ? (@.reference_image != "")')) AS tiene_selfie,
  (jsonb_path_exists(COALESCE(k."ocrData",'{}'::jsonb), '$.**.liveness_checks[*] ? (@.status == "Approved")')
     AND NOT jsonb_path_exists(COALESCE(k."ocrData",'{}'::jsonb), '$.**.liveness_checks[*] ? (@.status == "Declined")')) AS prueba_vida_ok,
  (k."ocrData"->'didit'->>'status' = 'Approved'
     OR k."ocrData"->'didit'->'decision'->>'status' = 'Approved'
     OR k."ocrData"->'didit'->'decision'->'decision'->>'status' = 'Approved') AS sesion_aprobada
FROM profile p
LEFT JOIN kyc_verification k ON k."userId" = p."userId"
LEFT JOIN ev ON ev."userId" = p."userId"
WHERE p.role = 'customer'
  AND p."kycStatus" = 'approved')
SELECT
  count(*)                                                   AS clientes_aprobados,
  count(*) FILTER (WHERE tiene_frente AND tiene_dorso AND tiene_selfie AND prueba_vida_ok AND sesion_aprobada) AS key6_completo,
  count(*) FILTER (WHERE NOT (tiene_frente AND tiene_dorso AND tiene_selfie AND prueba_vida_ok AND sesion_aprobada)) AS key6_incompleto,
  count(*) FILTER (WHERE NOT tiene_frente)    AS falta_dni_frente,
  count(*) FILTER (WHERE NOT tiene_dorso)     AS falta_dni_dorso,
  count(*) FILTER (WHERE NOT tiene_selfie)    AS falta_selfie,
  count(*) FILTER (WHERE NOT prueba_vida_ok)  AS falta_prueba_de_vida,
  count(*) FILTER (WHERE NOT sesion_aprobada) AS falta_sesion_aprobada
FROM k6;

-- 2) Lista (maximo 500). Identificador interno acortado + CUIL con ultimos 3 digitos.
WITH ev AS (
  SELECT "userId",
         bool_or(kind = 'dni_front') AS ev_front,
         bool_or(kind = 'dni_back')  AS ev_back,
         bool_or(kind = 'selfie')    AS ev_selfie
  FROM kyc_evidence GROUP BY "userId"
),
k6 AS (SELECT
  p."userId",
  p.cuil,
  p."kycStatus" AS perfil_kyc,
  k.status      AS kyc_status,
  k.provider,
  (COALESCE(ev.ev_front,false)  OR NULLIF(btrim(k."dniFrontImageUrl"),'') IS NOT NULL
     OR jsonb_path_exists(COALESCE(k."ocrData",'{}'::jsonb), '$.**.id_verifications[*] ? (@.front_image != "" || @.full_front_image != "")')) AS tiene_frente,
  (COALESCE(ev.ev_back,false)   OR NULLIF(btrim(k."dniBackImageUrl"),'') IS NOT NULL
     OR jsonb_path_exists(COALESCE(k."ocrData",'{}'::jsonb), '$.**.id_verifications[*] ? (@.back_image != "" || @.full_back_image != "")')) AS tiene_dorso,
  (COALESCE(ev.ev_selfie,false) OR NULLIF(btrim(k."selfieImageUrl"),'') IS NOT NULL
     OR jsonb_path_exists(COALESCE(k."ocrData",'{}'::jsonb), '$.**.liveness_checks[*] ? (@.reference_image != "")')) AS tiene_selfie,
  (jsonb_path_exists(COALESCE(k."ocrData",'{}'::jsonb), '$.**.liveness_checks[*] ? (@.status == "Approved")')
     AND NOT jsonb_path_exists(COALESCE(k."ocrData",'{}'::jsonb), '$.**.liveness_checks[*] ? (@.status == "Declined")')) AS prueba_vida_ok,
  (k."ocrData"->'didit'->>'status' = 'Approved'
     OR k."ocrData"->'didit'->'decision'->>'status' = 'Approved'
     OR k."ocrData"->'didit'->'decision'->'decision'->>'status' = 'Approved') AS sesion_aprobada
FROM profile p
LEFT JOIN kyc_verification k ON k."userId" = p."userId"
LEFT JOIN ev ON ev."userId" = p."userId"
WHERE p.role = 'customer'
  AND p."kycStatus" = 'approved')
SELECT
  left(k6."userId", 8) AS cliente,
  CASE WHEN k6.cuil IS NULL THEN NULL
       ELSE '**-*****-' || right(regexp_replace(k6.cuil, '\D', '', 'g'), 3) END AS cuil_ult3,
  k6.kyc_status, k6.provider,
  k6.tiene_frente, k6.tiene_dorso, k6.tiene_selfie, k6.prueba_vida_ok, k6.sesion_aprobada,
  (SELECT count(*) FROM loan l WHERE l."userId" = k6."userId" AND l.status IN ('pending','approved','active')) AS creditos_abiertos
FROM k6
WHERE NOT (tiene_frente AND tiene_dorso AND tiene_selfie AND prueba_vida_ok AND sesion_aprobada)
ORDER BY creditos_abiertos DESC
LIMIT 500;

ROLLBACK;