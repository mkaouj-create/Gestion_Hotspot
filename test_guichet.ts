import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://phfuneblonazhmvcxaqf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZnVuZWJsb25hemhtdmN4YXFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjc4ODMsImV4cCI6MjA4NTgwMzg4M30.Jw5iXWuKW6uZYzCdaLiaVV30GZoHprld7UxcG1u8T7A';

async function testGuichet() {
  // 1. Authenticate as the user to get a tenant_id and create a guichet code
  const adminClient = createClient(supabaseUrl, supabaseKey);
  const { data: authData, error: authError } = await adminClient.auth.signInWithPassword({
    email: 'mkaouj@gmail.com',
    password: 'password123' // Assuming this is the password, or I can just use the anon client if I have a token
  });
  
  console.log('Auth:', authError ? authError.message : 'Success');
}

testGuichet();
