import { createClient } from '@supabase/supabase-js';

// -- CONFIGURATION SUPABASE ROBUSTE --

// Valeurs de secours (Projet Demo) pour garantir le démarrage de l'app 
// si les variables Vercel ne sont pas encore propagées ou mal configurées.
const FALLBACK_URL = 'https://phfuneblonazhmvcxaqf.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZnVuZWJsb25hemhtdmN4YXFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjc4ODMsImV4cCI6MjA4NTgwMzg4M30.Jw5iXWuKW6uZYzCdaLiaVV30GZoHprld7UxcG1u8T7A';

const getEnv = (key: string): string | undefined => {
  let val: string | undefined = undefined;
  
  // 1. Essai Vite (import.meta.env)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      val = import.meta.env[key];
    }
  } catch (e) {}

  // 2. Essai Process (compatibilité Vercel)
  if (!val) {
    try {
      // @ts-ignore
      if (typeof process !== 'undefined' && process.env) {
        // @ts-ignore
        val = process.env[key];
      }
    } catch (e) {}
  }

  // Nettoyage (suppression des guillemets si présents par erreur dans la config)
  return val ? val.replace(/['"]/g, '').trim() : undefined;
};

// Récupération des clés
const envUrl = getEnv('VITE_SUPABASE_URL');
const envKey = getEnv('VITE_SUPABASE_ANON_KEY');

// Sélection finale : Env ou Fallback
// Cela empêche l'erreur "Failed to fetch" causée par une URL vide ou invalide
const supabaseUrl = envUrl || FALLBACK_URL;
const supabaseKey = envKey || FALLBACK_KEY;

// Feedback console pour le développeur
if (!envUrl || !envKey) {
  console.warn(
    '%c ATTENTION: Variables d\'env manquantes. Mode DÉMO activé. ',
    'background: #f59e0b; color: #000; font-weight: bold; padding: 4px;'
  );
  console.log('URL utilisée:', supabaseUrl);
} else {
  console.log(
    '%c SUPABASE CONNECTED (PROD) ',
    'background: #10b981; color: #fff; font-weight: bold; padding: 4px;'
  );
}

// Initialisation du client
export const db = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
}) as any;

export { supabaseUrl, supabaseKey };