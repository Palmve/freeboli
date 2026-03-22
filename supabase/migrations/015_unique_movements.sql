-- 015_unique_movements.sql
-- Evita el "double-claiming" de bonos de referidos verificado.
-- Esto protege contra condiciones de carrera (Race Conditions).

-- Primero, eliminamos posibles duplicados existentes antes de aplicar la restricción (opcional pero recomendado)
-- En este caso, como el usuario ya los reclamó, el admin los limpiará manualmente si es necesario, 
-- pero la restricción evitará que ocurra de nuevo.

-- Añadimos un índice único filtrado para el tipo de bono por referido.
-- No lo hacemos global porque algunos tipos (como faucet) pueden tener reference NULL y ser legítimos múltiples veces.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_bonus_referido ON public.movements (user_id, type, reference) 
WHERE (type = 'bonus_referido_verificado');

-- También para misiones/logros si usaran reference
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_logro ON public.movements (user_id, type, reference)
WHERE (type = 'logro');
