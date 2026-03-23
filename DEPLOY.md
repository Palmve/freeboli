# Reglas de Despliegue (DEPLOY.md)

Para mantener un seguimiento correcto de los cambios en producción y evitar problemas de caché:

1. **Incremento de Versión**: 
   - En cada modificación o conjunto de cambios que se suban al repositorio, se **DEBE** incrementar la versión en `src/lib/version.ts` en una décima (ej: de 1.064 a 1.065).
   - Esto asegura que los componentes que muestran la versión reflejen siempre el estado más reciente del código.

2. **Verificación de Traducciones**:
   - Antes de subir cambios en la UI, verificar que todas las nuevas etiquetas `t("seccion.clave")` existan en `src/i18n/es.json` y `src/i18n/en.json`.

3. **Flujo de Git**:
   - `git status` -> `git add .` -> `git commit` -> `git push`.
