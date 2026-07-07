import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [k, v] = line.split('=');
  if (k && v) acc[k.trim()] = v.trim();
  return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const testEmail = `validemail${Date.now()}@gmail.com`;
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email: testEmail,
    password: 'password123'
  });
  
  if (signUpErr) {
    console.log('Signup failed', signUpErr);
    return;
  }

  console.log('Signed up as', signUpData.user.id);

  const workflowData = {
    user_id: signUpData.user.id,
    agent_id: null,
    name: 'Test Template Workflow',
    description: 'Test',
    prompt: null,
    nodes: [{ id: '1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }],
    edges: [],
    variables: { tags: [], is_favorite: false },
    status: 'draft',
    is_template: false
  };

  const { data: created, error: createErr } = await supabase
    .from('workflows')
    .insert(workflowData)
    .select()
    .single();

  if (createErr) {
    console.error('Create error:', createErr);
    return;
  }
  
  console.log('Created workflow ID:', created.id, created.name);

  // Fetch it
  const { data: fetched, error: fetchErr } = await supabase
    .from('workflows')
    .select('*')
    .eq('user_id', signUpData.user.id)
    .order('created_at', { ascending: false });

  if (fetchErr) {
    console.error('Fetch error:', fetchErr);
  } else {
    console.log('Fetched workflows count:', fetched.length);
    console.log('Latest workflow ID:', fetched[0]?.id);
  }
}

test();
