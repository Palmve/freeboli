-- Migración 031: Sistema de Itinerario de Viaje Privado
-- Provee una tabla para que el usuario y su esposa vean y modifiquen el plan de Alemania.

CREATE TABLE IF NOT EXISTS travel_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_number INT NOT NULL,
    date_str TEXT NOT NULL, -- Ej: '26 Mar'
    title TEXT NOT NULL,
    location TEXT,
    description TEXT,
    icon TEXT DEFAULT 'landmark', 
    lat FLOAT,
    lng FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seguridad: Solo accesible vía service_role desde la API protegida por código
ALTER TABLE travel_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only_travel" ON travel_activities;
CREATE POLICY "service_only_travel" ON travel_activities FOR ALL USING (false) WITH CHECK (false);

-- Datos Iniciales
DELETE FROM travel_activities;
INSERT INTO travel_activities (day_number, date_str, title, location, description, icon, lat, lng) VALUES
(1, '26 Mar', 'Llegada a Alemania ✈️', 'Aireopuerto Hannover (HAJ)', 'Llegada en vuelo KL1787. Traslado a la base en Wunstorf (Sahlenkamp 3).', 'flight', 52.4611, 9.6844),
(2, '27 Mar', 'Hannover & Hilo Rojo 🔴', 'Hannover Zentrum', 'Turismo siguiendo el Roter Faden y bus Hop-on Hop-off.', 'landmark', 52.3759, 9.7320),
(3, '28 Mar', 'Steinhuder Meer 🌊', 'Steinhude', 'Día de naturaleza en el malecón del lago.', 'landmark', 52.4553, 9.3551),
(4, '29 Mar', 'Leipzig (Base Carlos) 🚄', 'Leipzig Hbf', 'Traslado en tren ICE. Visita a Iglesia de Santo Tomás.', 'landmark', 51.3397, 12.3731),
(5, '30 Mar', 'Historia en Leipzig 🏛️', 'Monumento Batalla Naciones', 'Día completo con Carlos. Monumento y bus turístico.', 'landmark', 51.3124, 12.4133),
(6, '31 Mar', 'Cumpleaños en Berlín! 🎂', 'Fernsehturm (Torre TV)', 'Check-in en Potsdamer Platz. Cena de gala en la Torre de TV.', 'party', 52.5208, 13.4094),
(7, '01 Abr', 'Berlín & Isla Museos 🎨', 'Museumsinsel', 'Mañana de cultura y regreso nocturno a Wunstorf.', 'landmark', 52.5186, 13.3976),
(8, '02 Abr', 'Relax o Visita Celle 🏰', 'Celle (medieval)', 'Día de relax con Catiana o visita al pueblo de Celle.', 'hotel', 52.6256, 10.0825);
