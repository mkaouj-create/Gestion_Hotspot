import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://phfuneblonazhmvcxaqf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZnVuZWJsb25hemhtdmN4YXFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjc4ODMsImV4cCI6MjA4NTgwMzg4M30.Jw5iXWuKW6uZYzCdaLiaVV30GZoHprld7UxcG1u8T7A';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
  console.log("Please run the following SQL in the Supabase SQL Editor to check the policies:");
  console.log(`
SELECT 
    pol.polname as policy_name,
    CASE WHEN pol.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END as type,
    pol.polcmd as command,
    pg_get_expr(pol.polqual, pol.polrelid) as using_expr,
    pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_expr
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
WHERE c.relname = 'tickets';
  `);
}

checkPolicies();
