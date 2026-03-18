# FreeBoli

Web de juego con puntos internos y BOLIS (Solana). Faucet, HI-LO, afiliados, depósitos y retiros en BOLIS.

## Configuración

1. Copia `.env.example` a `.env.local`.
2. Crea un proyecto en [Supabase](https://supabase.com) y ejecuta las migraciones en `supabase/migrations/001_initial.sql` desde el SQL Editor.
3. Rellena en `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXTAUTH_URL` (ej. `http://localhost:3000`), `NEXTAUTH_SECRET`
   - `ADMIN_EMAILS` (emails separados por coma para acceso al panel admin)
   - Opcional: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` para login con Google
   - Para depósitos/retiros BOLIS: `SOLANA_WALLET_PRIVATE_KEY_BASE58` (clave privada de la wallet del sitio en base58)

## Equivalencia

- **1000 puntos = 1 BOLIS** (configurable con `NEXT_PUBLIC_POINTS_PER_BOLIS`).
- Retiro mínimo: 10.000 puntos por defecto (`NEXT_PUBLIC_MIN_WITHDRAW_POINTS`).

## Desarrollo

Para este proyecto se recomienda usar **pnpm** por velocidad y compatibilidad.

> [!IMPORTANT]
> Algunos scripts internos requieren **yarn** instalado globalmente. Si ves errores de instalación, ejecuta: `npm install -g yarn` antes de `pnpm install`.

```bash
pnpm install
pnpm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## Solución de Problemas (RPC 401)

Si la wallet del sitio no carga o da error 401:
- Verifica que `SOLANA_RPC_URL` use el parámetro **`api-key`** (con guion medio `-`) y NO `api_key`.
- Ejemplo Helius: `https://mainnet.helius-rpc.com/?api-key=TU_KEY`

## Despliegue

Despliega en Vercel (o similar). Configura las mismas variables de entorno. No subas nunca `SOLANA_WALLET_PRIVATE_KEY_BASE58` al repositorio.
