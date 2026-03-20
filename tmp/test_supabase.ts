import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  console.log("Testing Supabase connection...");
  const supabase = createClient(url!, key!);
  
  const start = Date.now();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .limit(1);
  
  console.log(`Query took ${Date.now() - start}ms`);
  if (error) console.error("Error:", error);
  else console.log("Success: found", data.length, "profiles");
}

test();
