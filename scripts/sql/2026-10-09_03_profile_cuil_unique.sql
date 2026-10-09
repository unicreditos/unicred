-- scripts/sql/2026-10-09_03_profile_cuil_unique.sql
-- Idempotente. NO aplicado. Aplicar DESPUES de 01 y 02.
-- Evita que dos cuentas se registren con el mismo CUIL/CUIT al mismo tiempo (la comprobacion de la app
-- "ya existe?" y la escritura son pasos separados). Si hoy ya hay CUIL repetidos, NO se crea el indice
-- (para no romper el despliegue): queda un aviso y hay que depurar los duplicados a mano primero.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'profile_cuil_unique_idx') THEN
    RAISE NOTICE 'profile_cuil_unique_idx ya existe';
  ELSIF EXISTS (SELECT 1 FROM profile WHERE cuil IS NOT NULL AND cuil <> '' GROUP BY cuil HAVING count(*) > 1) THEN
    RAISE WARNING 'Hay CUIL duplicados en profile: no se crea profile_cuil_unique_idx. Depurar y volver a correr este archivo.';
  ELSE
    CREATE UNIQUE INDEX profile_cuil_unique_idx ON profile (cuil) WHERE cuil IS NOT NULL AND cuil <> '';
  END IF;
END $$;