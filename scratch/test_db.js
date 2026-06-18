import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Parse .env file
const envText = fs.readFileSync('.env', 'utf-8');
const env = {};
envText.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];

console.log('Connecting to:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

const { data, error } = await supabase
  .from('transacciones')
  .select('id, concepto')
  .limit(5);

if (error) {
  console.error('Error fetching:', error);
} else {
  console.log('Successfully fetched transactions:', data);
}
