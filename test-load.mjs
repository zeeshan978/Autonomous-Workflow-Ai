import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [k, v] = line.split('=');
  if (k && v) acc[k.trim()] = v.trim();
  return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data: { user }, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'password123'
  });
  
  if (authErr || !user) {
    console.log('Login failed, using anon fetch');
  }

  // Create dummy workflow
  const { data: created, error: createErr } = await supabase
    .from('workflows')
    .insert({
      user_id: user ? user.id : '00000000-0000-0000-0000-000000000000',
      name: 'Test Fetch',
      nodes: [],
      edges: [],
      variables: {},
      status: 'draft'
    })
    .select()
    .single();

  if (createErr) {
    console.error('Create error:', createErr);
    return;
  }
  
  console.log('Created workflow ID:', created.id);

  // Fetch it
  const { data: fetched, error: fetchErr } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', created.id)
    .single();

  if (fetchErr) {
    console.error('Fetch error:', fetchErr);
  } else {
    console.log('Fetched successfully:', fetched.id);
  }
}

test();
