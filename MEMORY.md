# MEMORIA DEL PROYECTO - FreeBoli

Este archivo sirve como **Fuente de Verdad** para los agentes de IA que retomen este proyecto. Contiene información crítica sobre la arquitectura, el flujo de trabajo y los requisitos de despliegue.

---

## 🚀 Flujo de Trabajo Crítico (GIT)
Para cualquier cambio, sigue estrictamente este orden:
1. **Desarrollo:** Realizar cambios en `src/`.
2. **Validación:** Ejecutar `npm run lint` para asegurar que el build no falle en Vercel.
3. **Commit:** `git add . && git commit -m "Tipo: Descripción en español"`.
4. **Push:** `git push origin main`. Vercel desplegará automáticamente.

---

## 🛠️ Infraestructura Actual

### 1. Sistema Multi-idioma (i18n)
- **Localización:** `src/i18n/*.json`.
- **Contexto:** `LangContext.tsx` y `useLang` hook.
- **SSR Requisito:** El `LangProvider` debe envolver a todos los componentes que usen el hook para evitar que `t()` devuelva null durante el prerenderizado.
- **Traducciones:** Soporte para arrays y objetos complejos.

### 2. Analíticas y Visitas
- **Seguimiento:** Componente `AnalyticsTracker` en `RootLayout`.
- **API:** `/api/analytics/track` registra eventos en Supabase (`analytics_events`).
- **Admin:** Panel detallado en `/admin/visitas`.

### 3. Build y Estándares
- **Linter:** Configuración estricta en `.eslintrc.json`.
- **Imágenes:** Usar siempre `<Image>` de Next.js (con `unoptimized` para QR externos).
- **Hooks:** Todo efecto (`useEffect`) debe tener sus dependencias completas y memoizadas (`useCallback`).

---

## 🔑 Datos Necesarios (Env Vars)
Asegúrate de que estas variables estén en Vercel:
- `SOLANA_RPC_URL`: URL de Helius o similar.
- `RESEND_API_KEY`: Para correos de verificación.
- `ADMIN_EMAILS`: Lista de correos con permisos admin.
- `REWARD_ACHIEVEMENTS_ENABLED`: `true` para activar logros.

---

## 📌 Estado del Proyecto (Marzo 2026)
- **Producción:** [https://freeboli.win](https://freeboli.win)
- **Estado:** Estable. Multi-idioma completado. Footer informativo activo. Analíticas registradas.

---
*Nota para el agente: No crees archivos de respaldo (_copia, _v2). Confía en Git.*
