
import { createClient } from '@supabase/supabase-js';

// Configuration de la connexion Supabase
const supabaseUrl = 'https://phfuneblonazhmvcxaqf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZnVuZWJsb25hemhtdmN4YXFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjc4ODMsImV4cCI6MjA4NTgwMzg4M30.Jw5iXWuKW6uZYzCdaLiaVV30GZoHprld7UxcG1u8T7A';

// Initialisation du client
export const db = createClient(supabaseUrl, supabaseKey);

// Note : Pour que l'application fonctionne, vous devez exécuter le script SQL 
// fourni dans le fichier schema.sql via l'interface Supabase (SQL Editor).
