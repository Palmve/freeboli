# Pendientes – FreeBoli

Este archivo lista tareas pendientes para que el agente (o un desarrollador) sepa qué falta por hacer. Revisar cuando pregunten "qué hay pendiente" o "qué falta".

---

## Infraestructura / DevOps

- **Configurar un cron job para procesar depósitos BOLIS**
  - El endpoint `POST /api/deposit/process-incoming` escanea la **dirección exclusiva de cada usuario** en busca de BOLIS recibidos y acredita puntos (ya no se usa memo).
  - Mientras no haya cron, un admin puede usar el botón "Procesar depósitos ahora" en el panel Admin.
  - Para automatizarlo: ejecutar cada 2–5 minutos una petición `POST https://<dominio>/api/deposit/process-incoming` con header `Authorization: Bearer <CRON_SECRET>`.
  - Definir `CRON_SECRET` en las variables de entorno del servidor y configurar el cron (VPS con crontab, Vercel Cron, cron.org, etc.).

- **Variable de entorno para depósitos por usuario**
  - `DEPOSIT_WALLET_ENCRYPTION_KEY`: clave de al menos 16 caracteres para cifrar la clave privada de cada wallet de depósito. Sin ella no se pueden crear nuevas direcciones de depósito.
  - Ejecutar la migración `003_deposit_wallet_per_user.sql` en Supabase (tabla `deposit_wallets`, columna `profiles.deposit_address`).

- **RPC de Solana para detectar depósitos**
  - El RPC público (`api.mainnet-beta.solana.com`) suele devolver **0 firmas** en `getSignaturesForAddress`, por eso "Procesar depósitos" puede mostrar "Firmas: 0" aunque en Solscan sí haya movimientos.
  - Configurar **`SOLANA_RPC_URL`** con un RPC que devuelva historial (p. ej. [Helius](https://helius.dev), [QuickNode](https://quicknode.com), [Alchemy](https://alchemy.com)). En local: añadir en `.env.local`; en producción: variable de entorno del servidor (Vercel, etc.).

---

## Funcionalidad / Producto

- **(Opcional) Aceptar SOL y convertir a BOLIS**  
  Analizar e implementar depósitos en SOL que se conviertan automáticamente a BOLIS (p. ej. vía Jupiter u otro DEX) y luego a puntos.

- **(Opcional) Sonidos en HI-LO**  
  Opción "Habilitar sonidos" en el juego (como en la referencia FreeBitco.in).

---

## Seguridad / Configuración

- En producción, usar `REQUIRE_AUTH=true` y `NEXT_PUBLIC_REQUIRE_AUTH=true`.
- No commitear `.env.local` (ya está en `.gitignore`); en el servidor configurar las variables de entorno necesarias.

---

*Última actualización: lista inicial de pendientes.*
