import { createClient } from '@supabase/supabase-js';

// -- CONFIGURATION SUPABASE --
// Lecture sécurisée des variables d'environnement injectées par Vercel (Vite)

const getEnv = (key: string) => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env[key] || '';
    }
  } catch (e) {
    console.warn('Erreur lecture env:', e);
  }
  return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY');

// Validation au démarrage
if (!supabaseUrl || !supabaseKey) {
  console.error(
    '%c ERREUR CONFIGURATION SUPABASE ',
    'background: #ef4444; color: #fff; font-weight: bold; padding: 4px;',
    'Les variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont manquantes.',
    'Vérifiez vos réglages "Environment Variables" dans Vercel.'
  );
} else {
  console.log(
    '%c SUPABASE CONNECTED ',
    'background: #10b981; color: #fff; font-weight: bold; padding: 4px;',
    'URL:', supabaseUrl.substring(0, 20) + '...'
  );
}

// Initialisation du client
// Utilisation de valeurs placeholder si les vars sont manquantes pour éviter le crash blanc,
// mais les appels API échoueront proprement.
export const db = createClient(
  supabaseUrl || 'https://project-not-configured.supabase.co', 
  supabaseKey || 'anon-key-missing'
);

export { supabaseUrl, supabaseKey };