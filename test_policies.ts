import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://phfuneblonazhmvcxaqf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZnVuZWJsb25hemhtdmN4YXFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjc4ODMsImV4cCI6MjA4NTgwMzg4M30.Jw5iXWuKW6uZYzCdaLiaVV30GZoHprld7UxcG1u8T7A';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
  const guichetClient = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        'x-guichet-token': '123e4567-e89b-12d3-a456-426614174000'
      }
    }
  });
  
  const { data, error } = await guichetClient.rpc('get_guichet_tenant_id');
  console.log('get_guichet_tenant_id (with fake token):', error ? error.message : data);
}

checkPolicies();
