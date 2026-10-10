-- SOLO LECTURA. NO se ejecutó. Para que Angel lo autorice o lo corra.
-- Lista clientes sin KYC completo (Didit aprobado y vigente + consentimiento BCRA), con CUIL enmascarado.
-- Corre en una transacción de solo lectura: cualquier escritura falla.
BEGIN READ ONLY;

-- 1) Resumen por motivo
WITH base AS (
  SELECT p."userId",
         p.cuil,
         p."kycStatus"  AS perfil_kyc,
         p."bcraConsentAt",
         k.status       AS kyc_status,
         k.provider,
         k."reviewedAt",
         k."expiresAt",
         k."updatedAt",
         (k.provider = 'didit' AND k.status = 'approved'
            AND (k."expiresAt" IS NULL OR k."expiresAt" > now())
            AND COALESCE(k."reviewedAt", k."updatedAt") > now() - interval '12 months'
            AND p."kycStatus" = 'approved') AS didit_vigente
  FROM profile p
  LEFT JOIN kyc_verification k ON k."userId" = p."userId"
  WHERE p.role = 'customer'
)
SELECT
  count(*)                                                        AS clientes,
  count(*) FILTER (WHERE didit_vigente)                           AS con_didit_vigente,
  count(*) FILTER (WHERE kyc_status IS NULL)                      AS sin_registro_kyc,
  count(*) FILTER (WHERE kyc_status IS NOT NULL AND NOT didit_vigente) AS kyc_no_vigente_o_incompleto,
  count(*) FILTER (WHERE "bcraConsentAt" IS NULL)                 AS sin_consentimiento_bcra,
  count(*) FILTER (WHERE perfil_kyc = 'approved' AND NOT COALESCE(didit_vigente,false)) AS perfil_aprobado_sin_didit_vigente
FROM base;

-- 2) Detalle (CUIL enmascarado: solo últimos 3 dígitos) + si tiene créditos abiertos
SELECT
  left(u.id, 8)                                       AS cliente,
  CASE WHEN p.cuil IS NULL THEN NULL
       ELSE '**-*****' || right(regexp_replace(p.cuil, '\D', '', 'g'), 3) END AS cuil_masc,
  p."kycStatus"                                       AS perfil_kyc,
  k.status                                            AS kyc_status,
  k.provider,
  k."reviewedAt"                                      AS kyc_revisado,
  (p."bcraConsentAt" IS NOT NULL)                     AS consentimiento_bcra,
  (SELECT count(*) FROM loan l WHERE l."userId" = p."userId" AND l.status IN ('pending','approved','active')) AS creditos_abiertos,
  (SELECT count(*) FROM loan l WHERE l."userId" = p."userId" AND l."createdAt" >= date_trunc('day', now())) AS creditos_hoy
FROM profile p
JOIN "user" u ON u.id = p."userId"
LEFT JOIN kyc_verification k ON k."userId" = p."userId"
WHERE p.role = 'customer'
  AND NOT (k.provider = 'didit' AND k.status = 'approved'
           AND (k."expiresAt" IS NULL OR k."expiresAt" > now())
           AND COALESCE(k."reviewedAt", k."updatedAt") > now() - interval '12 months'
           AND p."kycStatus" = 'approved')
ORDER BY creditos_abiertos DESC, k."updatedAt" DESC NULLS LAST
LIMIT 500;

ROLLBACK;
