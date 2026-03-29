import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, AlertCircle, Zap } from 'lucide-react';
import { db } from '../services/db';

export default function GuichetLogin() {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenant_id');
  const navigate = useNavigate();

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tenantName, setTenantName] = useState('Univers WiFi');

  useEffect(() => {
    if (!tenantId) {
      setError("Lien invalide. Aucun identifiant de zone trouvé.");
      return;
    }

    // Check if already logged in
    const existingToken = localStorage.getItem('guichet_token');
    const existingTenant = localStorage.getItem('guichet_tenant');
    if (existingToken && existingTenant === tenantId) {
      navigate(`/guichet/sales?tenant_id=${tenantId}`);
      return;
    }

    // Fetch tenant name
    const fetchTenant = async () => {
      try {
        const { data, error } = await db
          .from('tenants')
          .select('name')
          .eq('id', tenantId)
          .single();
        
        if (data) {
          setTenantName(data.name);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchTenant();
  }, [tenantId, navigate]);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    if (pin.length !== 4) {
      setError("Le code PIN doit contenir 4 chiffres.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: token, error: rpcError } = await db.rpc('verify_guichet_pin', {
        p_tenant_id: tenantId,
        p_pin: pin
      });

      if (rpcError) throw rpcError;
      if (!token) throw new Error("Code PIN invalide.");

      // Save session
      localStorage.setItem('guichet_token', token);
      localStorage.setItem('guichet_tenant', tenantId);

      // Redirect to sales interface
      navigate(`/guichet/sales?tenant_id=${tenantId}`);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || "Code PIN incorrect ou accès refusé.");
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleNumberClick = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  if (!tenantId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-slate-900 mb-2">Lien invalide</h1>
          <p className="text-slate-500">Veuillez demander un nouveau lien d'accès à votre administrateur.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-500/30">
            <Zap className="w-8 h-8 text-white fill-current" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Guichet Vente</h1>
          <p className="text-slate-500 font-medium">{tenantName}</p>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-xl p-8 border border-slate-100">
          <div className="flex justify-center mb-8">
            <div className="flex gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div 
                  key={i}
                  className={`w-14 h-16 rounded-2xl flex items-center justify-center text-3xl font-black transition-all ${
                    pin.length > i 
                      ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30 scale-110' 
                      : 'bg-slate-100 text-slate-300'
                  }`}
                >
                  {pin.length > i ? '•' : ''}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 mb-8">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num.toString())}
                className="h-16 rounded-2xl bg-slate-50 text-2xl font-black text-slate-700 hover:bg-slate-100 hover:scale-105 active:scale-95 transition-all"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleDelete}
              className="h-16 rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-red-500 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
            >
              Effacer
            </button>
            <button
              onClick={() => handleNumberClick('0')}
              className="h-16 rounded-2xl bg-slate-50 text-2xl font-black text-slate-700 hover:bg-slate-100 hover:scale-105 active:scale-95 transition-all"
            >
              0
            </button>
            <button
              onClick={handlePinSubmit}
              disabled={pin.length !== 4 || loading}
              className="h-16 rounded-2xl bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 disabled:hover:bg-brand-500 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Lock className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
