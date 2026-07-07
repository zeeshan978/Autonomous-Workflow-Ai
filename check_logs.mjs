import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
for (const line of envFile.split('\n')) {
  if (line.includes('=')) {
    const [key, val] = line.split('=');
    envVars[key.trim()] = val.trim();
  }
}

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data, error } = await supabase
    .from('logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
    
  console.log(JSON.stringify(data, null, 2));
}

check();
