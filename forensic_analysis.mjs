import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPromos() {
  const { data, error } = await supabase
    .from("promociones")
    .select("id, nombre, palabra, puntos_totales, puntos_restantes, is_active")
    .eq("is_active", true);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("--- PROMOS ACTIVAS ---");
  data.forEach(p => {
    console.log(`ID: ${p.id}`);
    console.log(`Nombre: ${p.nombre}`);
    console.log(`Palabra: ${p.palabra}`);
    console.log(`Totales: ${p.puntos_totales}`);
    console.log(`Restantes: ${p.puntos_restantes}`);
    console.log(`Activa: ${p.is_active}`);
    console.log("----------------------");
  });

  const { count } = await supabase
    .from("promociones_claims")
    .select("id", { count: 'exact', head: true });
  
  console.log(`Total reclamos en DB: ${count}`);
}

checkPromos();
