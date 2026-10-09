# Checklist previo al despliegue: rama security/hardening-2026-10

Nada de esto se aplico ni se desplego. Todo lo de abajo lo ejecuta una persona, en este orden.

## 0. Antes de tocar nada
- [ ] Revisar y fusionar la rama (ver "Alcance del diff" en unicred-implementacion).
- [ ] Respaldo de la base (snapshot de Neon / pg_dump) y anotar la hora.
- [ ] Rotar las credenciales de la base (tarea de Angel) y actualizar DATABASE_URL en Vercel.
- [ ] Rotar la clave de las 3 cuentas QA: `tsx scripts/rotate-qa-accounts.ts` (primero en simulacion).

## 1. SQL, en este orden (a mano, idempotentes; se pueden repetir sin dano)
1. `scripts/sql/2026-10-09_01_auto_approval_revert_backup.sql` (tabla de respaldo de la reversion; no cambia datos).
2. `scripts/sql/2026-10-09_02_kyc_evidence_and_admin_otp.sql` (evidencia versionada inmutable, registro de accesos de solo agregar, OTP, segundo factor).
3. `scripts/sql/2026-10-09_03_profile_cuil_unique.sql` (indice unico de CUIL). Si hay CUIL repetidos NO crea el indice y avisa con WARNING: depurar y volver a correrlo.
4. `scripts/sql/2026-10-09_04_totp_backup_codes.sql` (TOTP cifrado + codigos de respaldo; requiere el 02). Sin este SQL las pantallas de seguridad no funcionan, pero el login no se rompe (el gate trata la tabla ausente como 'sin TOTP').
Verificar luego: `\dt user_totp user_backup_code`, `\dt kyc_evidence*`, `\dt admin_*otp*`, `\di profile_cuil_unique_idx`.

## 2. Variables de entorno (Vercel)
| Variable | Valor | Nota |
|---|---|---|
| TWOFA_PEPPER | cadena aleatoria de 32+ caracteres | Obligatoria para el 2FA (si falta usa BETTER_AUTH_SECRET). Cambiarla invalida los codigos pendientes. |
| CRON_SECRET | ya existente | El cron reconcile-kyc lo exige. |
| ONBOARDING_GATE | `warn` al inicio, luego `enforce` | Por defecto `enforce`. |
| MANUAL_DECISION_ONLY | `yes` (por defecto) | `no` solo como rollback de emergencia. |
| REGISTRATION_BCRA_PREFLIGHT / REGISTRATION_ARCA_REQUIRED | `yes` (por defecto) | Si ARCA/BCRA no estan configurados el alta se bloquea (falla cerrada). `no` para rollback. |
| EVIDENCE_VERSIONING | `yes` (por defecto) | Requiere el SQL 02 aplicado. |
| ADMIN_EVIDENCE_REQUIRE_2FA | `yes` (por defecto) | Ver evidencia exige OTP por correo. |
| KYC_MAX_AGE_MONTHS | `12` (por defecto) | Vigencia de la verificacion de identidad. |
| ADMIN_2FA_LOGIN | `yes` cuando se active | Por defecto apagado. |
| CUSTOMER_2FA_LOGIN | `yes` cuando se active | Por defecto apagado. |
No cargar ninguna de estas en el repo ni en archivos .env versionados.

## 3. Orden de activacion recomendado
1. Desplegar con ONBOARDING_GATE=warn y los demas por defecto; aplicar SQL 01, 02, 03 antes.
2. Correr el backfill de evidencia: `tsx scripts/backfill-kyc-evidence.ts` (primero sin escribir, revisar conteo, luego con la opcion de escritura). Es idempotente.
3. Probar el visor de DNI/selfie con un admin real (pide OTP, deja fila en el registro de accesos).
4. Activar ADMIN_2FA_LOGIN=yes, comprobar que un admin entra con codigo. Tener un segundo admin con sesion abierta por si falla el correo (el 2FA falla cerrado).
5. Pasar ONBOARDING_GATE=enforce una vez revisado cuantos clientes quedan sin Didit vigente (consulta de conteo, solo lectura).
6. Activar CUSTOMER_2FA_LOGIN=yes al final (impacta a todos los clientes).
7. Reversion de creditos auto-aprobados: solo con aprobacion expresa de Angel, primero `tsx scripts/revert-auto-approvals.ts` en simulacion y revisar el archivo de salida en /reports.

## 4. Despues de desplegar, verificar
- [ ] Solicitar un credito: queda "en revision", sin aprobacion automatica; aprobar/rechazar exige nota.
- [ ] Alta de prueba: BCRA y ARCA se consultan antes de crear datos; nombre distinto de ARCA queda en revision manual.
- [ ] /admin/originacion: webhooks Didit (reprocesar), historial BCRA, padron ARCA cargan y los botones funcionan.
- [ ] Firmar un contrato de prueba: se guarda contentHash y signatureHash; el pie dice "firma electronica".
- [ ] Webhook de Mercado Pago con data.id alfanumerico (ORD...) valida la firma.
- [ ] Cron reconcile-kyc visible en Vercel y corre con CRON_SECRET.
- [ ] Olvide mi clave: responde igual exista o no la cuenta y el correo llega.
- [ ] `kyc_evidence_access_log` registra cada visualizacion (quien, que, cuando, IP).

## 5. Rollback
- Codigo: revertir el merge o redeploy del commit anterior.
- Flags: ADMIN_2FA_LOGIN/CUSTOMER_2FA_LOGIN=no, ONBOARDING_GATE=off o warn, MANUAL_DECISION_ONLY=no, REGISTRATION_*=no, EVIDENCE_VERSIONING=no. Sin redeploy de codigo (solo variables).
- SQL: las tablas nuevas pueden quedar sin uso. `profile_cuil_unique_idx`: `DROP INDEX IF EXISTS profile_cuil_unique_idx;`. La evidencia y su registro son inmutables a proposito (para borrarlos hay que desactivar el trigger a mano, decision legal).
- Reversion de creditos: usa la tabla loan_autoapproval_revert_backup (script con opcion de rollback).

## 6. Tests contra Postgres real (solo local)
`TEST_DATABASE_URL=postgres://...@127.0.0.1:PUERTO/algo_test` y `npx tsx --test scripts/tests/*.test.ts`. Se niegan a correr si el host no es local o la base no termina en _test; sin la variable se omiten.
## 7. TOTP, codigos de respaldo, sesiones activas y 2FA dentro del login
- Pagina: `/cuenta/seguridad` (activar/desactivar app autenticadora, regenerar codigos, ver y cerrar sesiones). Enlace en el menu Sistema del admin.
- Activar exige clave actual; desactivar/regenerar exigen clave actual + un codigo vigente (app o respaldo). Todo queda en la auditoria (TOTP_*, BACKUP_CODE_*, SESSION_REVOKED*).
- Quien activa la app autenticadora es desafiado SIEMPRE (aunque ADMIN_2FA_LOGIN/CUSTOMER_2FA_LOGIN sigan en `no`); el correo sigue sirviendo como alternativa. Si pierde el celular y los codigos, un admin con acceso a la base debe borrar su fila de `user_totp` (decision de soporte, queda pendiente un flujo de recuperacion asistida).
- Usa `TWOFA_PEPPER` tambien para cifrar los secretos TOTP: **cambiarla invalida los secretos TOTP ya guardados** (los usuarios tendrian que reactivar). Fijarla una vez y no rotarla sin plan.
- El paso de codigo aparece dentro del formulario de ingreso cuando el servidor lo exige; igual se hace cumplir en cada pantalla/API protegida.
- Cierre remoto de sesiones: inmediato para admin; en clientes puede tardar hasta 5 min por la cache de cookie de better-auth.
- Orden de activacion: aplicar SQL 04, desplegar, probar con un admin (activar TOTP, cerrar sesion, volver a entrar con app y con correo, usar un codigo de respaldo), recien despues encender ADMIN_2FA_LOGIN / CUSTOMER_2FA_LOGIN.
- Rollback: no hace falta tocar variables; `DROP TABLE user_totp, user_backup_code` deja a todos sin TOTP (el gate lo tolera si la tabla no existe).