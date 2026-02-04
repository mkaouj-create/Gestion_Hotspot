
import React, { useState, useEffect } from 'react';
import { Users, Wallet, Plus, Search, Loader2, TrendingUp, TrendingDown, ArrowRight, History, Ticket, DollarSign, X, Building2, CheckCircle2, AlertCircle, Smartphone } from 'lucide-react';
import { db } from '../services/db';
import { UserRole, User, TicketStatus } from '../types';

const Resellers: React.FC = () => {
  const [resellers, setResellers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState<User | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [ticketProfiles, setTicketProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [quantity, setQuantity] = useState('50');
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<any>(null);

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await db.auth.getUser();
      if (!user) return;
      const { data: profile } = await db.from('users').select('*').eq('id', user.id).single();
      setCurrentUser(profile);
      const { data: rData } = await db.from('users').select('*').eq('tenant_id', profile.tenant_id).eq('role', UserRole.REVENDEUR).eq('is_active', true);
      setResellers(rData || []);
      
      // Correction: Filtrer strictement par tenant_id comme dans la section Forfaits
      const { data: pData } = await db.from('ticket_profiles')
        .select('id, name, price, tickets(count)')
        .eq('tenant_id', profile.tenant_id);
        
      // On ne garde que ceux qui ont du stock positif pour l'assignation
      const availableProfiles = (pData || []).filter((p: any) => (p.tickets?.[0]?.count || 0) > 0);
      setTicketProfiles(availableProfiles);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selectedReseller || !amount || processing) return;
    
    // Validation du téléphone si méthode mobile
    if ((method === 'MOMO' || method === 'OM')) {
        const rawDigits = paymentPhone.replace(/\D/g, '');
        if (!/^6\d{8}$/.test(rawDigits)) {
            setToast({ type: 'error', message: "Numéro invalide. Le format doit être 9 chiffres commençant par 6 (Ex: 622 xx xx xx)." });
            setTimeout(() => setToast(null), 3000);
            return;
        }
    }

    setProcessing(true);
    try {
      const rawDigits = (method === 'MOMO' || method === 'OM') ? paymentPhone.replace(/\D/g, '') : null;
      const { error } = await db.from('payments').insert({ 
          tenant_id: currentUser.tenant_id, 
          reseller_id: selectedReseller.id, 
          amount: Number(amount), 
          payment_method: method, 
          phone_number: rawDigits,
          created_by: currentUser.id 
      });
      
      if (error) throw error;
      
      // Mise à jour du solde du revendeur
      const newBalance = (Number(selectedReseller.balance) || 0) + Number(amount);
      await db.from('users').update({ balance: newBalance }).eq('id', selectedReseller.id);

      setToast({ type: 'success', message: `Compte rechargé de ${Number(amount).toLocaleString()} GNF` }); 
      setShowPaymentModal(false); 
      setAmount('');
      setPaymentPhone('');
      setMethod('CASH');
      fetchInitialData();
    } catch (err: any) { setToast({ type: 'error', message: err.message }); } finally { setProcessing(false); }
  };

  const handleAssignStock = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selectedReseller || !selectedProfileId || !quantity || processing) return;
    setProcessing(true);
    try {
      const { data: availableTickets } = await db.from('tickets').select('id').eq('profile_id', selectedProfileId).eq('status', TicketStatus.NEUF).limit(Number(quantity));
      if (!availableTickets || availableTickets.length < Number(quantity)) throw new Error("Pas assez de tickets disponibles en stock agence.");
      const ticketIds = availableTickets.map(t => t.id);
      const { error } = await db.from('tickets').update({ status: TicketStatus.ASSIGNE, assigned_to: selectedReseller.id }).in('id', ticketIds);
      if (error) throw error;
      setToast({ type: 'success', message: `${quantity} tickets ont été assignés à ${selectedReseller.full_name}` }); setShowAssignModal(false); fetchInitialData();
    } catch (err: any) { setToast({ type: 'error', message: err.message }); } finally { setProcessing(false); }
  };

  return (
    <div className="space-y-10 font-sans pb-40 relative">
      {toast && (<div className={`fixed top-6 right-6 z-[100] p-6 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'} text-white`}>{toast.type === 'success' ? <CheckCircle2 /> : <AlertCircle />}<p className="font-black uppercase text-[10px] tracking-widest">{toast.message}</p></div>)}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm"><div><h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestion Revendeurs</h1><p className="text-slate-400 font-medium mt-1">Gérez les soldes et les attributions de stock.</p></div><div className="relative group max-w-md w-full"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" /><input type="text" placeholder="Rechercher un revendeur..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white outline-none transition-all" /></div></header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{resellers.filter(r => r.full_name.toLowerCase().includes(searchTerm.toLowerCase())).map(reseller => (<div key={reseller.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm group hover:shadow-2xl transition-all duration-300"><div className="flex justify-between items-start mb-6"><div className="flex items-center gap-4"><div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl">{reseller.full_name.charAt(0)}</div><div><h3 className="font-black text-lg text-slate-900 leading-tight">{reseller.full_name}</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{reseller.email}</p></div></div></div><div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center justify-between mb-8"><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Solde Actuel</p><p className={`text-2xl font-black ${Number(reseller.balance || 0) < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{Number(reseller.balance || 0).toLocaleString()} <span className="text-xs">GNF</span></p></div><div className={`w-10 h-10 rounded-full flex items-center justify-center ${Number(reseller.balance || 0) < 0 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>{Number(reseller.balance || 0) < 0 ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}</div></div><div className="grid grid-cols-2 gap-3"><button onClick={() => { setSelectedReseller(reseller); setShowPaymentModal(true); setMethod('CASH'); setPaymentPhone(''); }} className="py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"><DollarSign className="w-4 h-4" /> RECHARGER</button><button onClick={() => { setSelectedReseller(reseller); setShowAssignModal(true); }} className="py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"><Ticket className="w-4 h-4" /> ASSIGNER</button></div></div>))}</div>
      
      {showPaymentModal && selectedReseller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowPaymentModal(false)} />
          <form onSubmit={handlePayment} className="bg-white w-full max-w-sm rounded-[3rem] p-10 relative z-10 animate-in zoom-in-95">
            <button type="button" onClick={() => setShowPaymentModal(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900"><X className="w-6 h-6" /></button>
            <h2 className="text-2xl font-black mb-8 uppercase text-center">Encaisser Paiement</h2>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Montant Reçu (GNF)</label>
                <input type="number" required placeholder="ex: 50000" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xl outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Méthode</label>
                <select value={method} onChange={e => setMethod(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black outline-none appearance-none">
                  <option value="CASH">Espèces (Cash)</option>
                  <option value="MOMO">MTN Mobile Money</option>
                  <option value="OM">Orange Money</option>
                </select>
              </div>
              
              {(method === 'MOMO' || method === 'OM') && (
                <div className="animate-in slide-in-from-top-2 fade-in">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Numéro de Téléphone</label>
                  <div className="relative group">
                    <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-emerald-600 transition-colors" />
                    <input type="tel" required placeholder="6xx xx xx xx" value={paymentPhone} onChange={e => setPaymentPhone(e.target.value)} className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-lg outline-none focus:bg-white focus:ring-4 focus:ring-emerald-50 transition-all" />
                  </div>
                </div>
              )}
            </div>
            <button type="submit" disabled={processing} className="w-full mt-10 py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all">
              {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : "CRÉDITER LE SOLDE"}
            </button>
          </form>
        </div>
      )}

      {showAssignModal && selectedReseller && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowAssignModal(false)} /><form onSubmit={handleAssignStock} className="bg-white w-full max-w-md rounded-[3rem] p-10 relative z-10 animate-in zoom-in-95"><button type="button" onClick={() => setShowAssignModal(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900"><X className="w-6 h-6" /></button><h2 className="text-2xl font-black mb-2 uppercase text-center">Assigner du Stock</h2><p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-10">Transférer du stock agence vers {selectedReseller.full_name}</p><div className="space-y-6"><div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Choisir un forfait</label><select required value={selectedProfileId} onChange={e => setSelectedProfileId(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black outline-none appearance-none"><option value="">Sélectionner...</option>{ticketProfiles.map(p => (<option key={p.id} value={p.id}>{p.name} ({p.tickets?.[0]?.count || 0} en stock)</option>))}</select></div><div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantité à assigner</label><input type="number" required placeholder="ex: 100" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xl outline-none" /></div></div><button type="submit" disabled={processing} className="w-full mt-10 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-indigo-100">{processing ? <Loader2 className="w-5 h-5 animate-spin" /> : "VALIDER L'ATTRIBUTION"}</button></form></div>)}
    </div>
  );
};
export default Resellers;
