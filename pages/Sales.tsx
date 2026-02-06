import React, { useState, useEffect } from 'react';
import { Ticket as TicketIcon, Wallet, Search, Zap, Tag, ArrowRight, X, AlertCircle, Smartphone, Loader2, Check, CheckCircle2, Copy, Share2 } from 'lucide-react';
import { db } from '../services/db';
import { UserRole, TicketStatus } from '../types';

const Sales: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [lastSoldTicket, setLastSoldTicket] = useState<any>(null);

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await db.auth.getUser();
      if (!user) return;
      const { data: profile } = await db.from('users').select('*').eq('id', user.id).single();
      setUserProfile(profile);
      
      const isReseller = profile.role === UserRole.REVENDEUR;
      
      // Construction de la requête pour récupérer les profils ET le nombre de tickets dispos
      // Pour un revendeur, on ne compte que ceux qui lui sont assignés
      let query = db.from('ticket_profiles').select(`id, name, price, tickets!inner(count)`)
          .eq('tenant_id', profile.tenant_id);

      if (isReseller) {
          // Inner join + filtres pour que profiles ne retourne QUE si tickets existent pour ce reseller
          query = query.eq('tickets.assigned_to', user.id).eq('tickets.status', TicketStatus.ASSIGNE);
      } else {
          query = query.eq('tickets.status', TicketStatus.NEUF);
      }

      const { data: pData, error } = await query;
      if (error) throw error;

      // Transformation des données pour l'UI
      const formattedProfiles = (pData || []).map((p: any) => ({
          ...p,
          tickets: p.tickets // Le count est déjà dans l'objet tickets[0] grâce à Supabase
      }));
      
      setProfiles(formattedProfiles);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const generateQRCodeURL = (code: string) => `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(code)}`;

  const handleConfirmSale = async () => {
    const rawDigits = phoneNumber.replace(/\D/g, '');
    
    // Validation stricte : 9 chiffres commençant par 6
    if (rawDigits.length > 0) {
        if (!/^6\d{8}$/.test(rawDigits)) { 
            setError("Numéro invalide. Format requis : 9 chiffres commençant par 6 (Ex: 622 xx xx xx)."); 
            return; 
        }
    }
    
    if (!selectedProfile || !userProfile) return;
    if (userProfile.role === UserRole.REVENDEUR && (userProfile.balance || 0) < selectedProfile.price) { setError(`Solde insuffisant (${userProfile.balance.toLocaleString()} GNF).`); return; }

    setIsProcessingSale(true); setError(null);
    try {
      const isReseller = userProfile.role === UserRole.REVENDEUR;
      let query = db.from('tickets').select('id, username, password').eq('profile_id', selectedProfile.id).limit(1);
      
      if (isReseller) {
          query = query.eq('status', TicketStatus.ASSIGNE).eq('assigned_to', userProfile.id);
      } else {
          query = query.eq('status', TicketStatus.NEUF);
      }

      const { data: ticket, error: tError } = await query.maybeSingle();
      if (tError || !ticket) throw new Error("Rupture de stock pour ce forfait.");

      const { error: updateError } = await db.from('tickets').update({ status: TicketStatus.VENDU, sold_at: new Date().toISOString(), sold_by: userProfile.id }).eq('id', ticket.id);
      if (updateError) throw updateError;

      await db.from('sales_history').insert({ tenant_id: userProfile.tenant_id, ticket_id: ticket.id, seller_id: userProfile.id, amount_paid: selectedProfile.price, metadata: { customer_phone: rawDigits || 'Client Anonyme' } });
      if (isReseller) await db.from('users').update({ balance: (userProfile.balance || 0) - selectedProfile.price }).eq('id', userProfile.id);

      setLastSoldTicket({ ...ticket, profile_name: selectedProfile.name, price: selectedProfile.price });
      setShowPhoneModal(false); setShowSuccessModal(true); setPhoneNumber(''); fetchInitialData(); 
    } catch (err: any) { setError(err.message); } finally { setIsProcessingSale(false); }
  };

  const handleWhatsAppShare = () => { if (!lastSoldTicket) return; window.open(`https://wa.me/?text=${encodeURIComponent(`*WIFI ZONE*\n🎟️ CODE : *${lastSoldTicket.username}*\n📦 FORFAIT : ${lastSoldTicket.profile_name}\n💰 PRIX : ${Number(lastSoldTicket.price).toLocaleString()} GNF\n\n_Merci pour votre achat !_`)}`, '_blank'); };
  const copyCode = () => { if (lastSoldTicket) navigator.clipboard.writeText(lastSoldTicket.username); };
  const filteredProfiles = profiles.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-12 pb-32 max-w-7xl mx-auto animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row items-center justify-between gap-8 bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500 rounded-full blur-[120px] opacity-10 -mr-20 -mt-20"></div>
        <div className="relative z-10 space-y-2"><div className="flex items-center gap-2 text-brand-600 mb-2"><TicketIcon className="w-5 h-5" /><span className="text-[10px] font-black uppercase tracking-[0.2em]">Console de Distribution</span></div><h1 className="text-4xl font-black text-slate-900 tracking-tight">Vendre un Ticket</h1><p className="text-slate-400 font-medium text-lg">Sélectionnez l'offre adaptée au besoin du client.</p></div>
        {userProfile?.role === UserRole.REVENDEUR && (<div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative z-10 flex items-center gap-6 border border-white/10 group overflow-hidden"><div className="absolute inset-0 bg-brand-600 opacity-0 group-hover:opacity-10 transition-opacity"></div><div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-500/30 group-hover:scale-110 transition-transform"><Wallet className="w-7 h-7" /></div><div><p className="text-[10px] font-black text-brand-400 uppercase tracking-widest leading-none mb-1.5">Mon Solde Actuel</p><p className="text-3xl font-black tracking-tight">{(userProfile.balance || 0).toLocaleString()} <span className="text-[10px] text-brand-400 ml-1">GNF</span></p></div></div>)}
      </header>
      <div className="relative max-w-2xl mx-auto group"><div className="absolute inset-0 bg-brand-500/5 blur-3xl rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity"></div><Search className="absolute left-8 top-1/2 -translate-y-1/2 w-7 h-7 text-slate-300 group-focus-within:text-brand-600 transition-colors" /><input type="text" placeholder="Rechercher un forfait (24H, 1GB...)" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-20 pr-8 py-8 rounded-[2.5rem] border border-slate-100 bg-white shadow-sm focus:ring-[12px] focus:ring-brand-50 outline-none font-bold text-slate-700 transition-all text-xl" /></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-2">
        {loading ? (<div className="col-span-full py-40 flex flex-col items-center gap-4"><Loader2 className="w-12 h-12 animate-spin text-brand-600" /><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Accès au stock...</p></div>) : filteredProfiles.length > 0 ? filteredProfiles.map(p => (
          <div key={p.id} className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 flex flex-col justify-between h-[22rem] group relative overflow-hidden">
             <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-10 transition-all scale-150 rotate-12 group-hover:rotate-0"><Zap className="w-48 h-48 text-brand-600 fill-current" /></div>
             <div><div className="flex justify-between items-start mb-8"><div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-[1.5rem] flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-all shadow-sm"><Tag className="w-8 h-8" /></div><div className="text-right"><p className="text-3xl font-black text-slate-900 tracking-tight">{p.price.toLocaleString()} <span className="text-[10px] uppercase font-bold text-slate-400">GNF</span></p><p className="text-[9px] font-black text-brand-500 uppercase tracking-widest mt-1">Prix de vente</p></div></div><h3 className="text-2xl font-black mb-1.5 text-slate-900 group-hover:text-brand-600 transition-colors tracking-tight">{p.name}</h3><div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${p.tickets?.[0]?.count < 20 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></div><p className={`text-[10px] font-black uppercase tracking-widest ${p.tickets?.[0]?.count < 20 ? 'text-red-500' : 'text-slate-400'}`}>{p.tickets?.[0]?.count || 0} Tickets {userProfile?.role === UserRole.REVENDEUR ? '(Vous)' : '(Agence)'}</p></div></div>
             <button onClick={() => { setSelectedProfile(p); setShowPhoneModal(true); }} disabled={!p.tickets?.[0]?.count} className={`w-full py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-xl ${!p.tickets?.[0]?.count ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-slate-900 hover:bg-black text-white hover:shadow-slate-200'}`}>VENDRE <ArrowRight className="w-5 h-5" /></button>
          </div>
        )) : (<div className="col-span-full py-40 text-center"><div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto mb-6"><Search className="w-10 h-10" /></div><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Aucun ticket disponible pour votre compte</p></div>)}
      </div>
      {showPhoneModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowPhoneModal(false)} />
          <div className="bg-white w-full max-w-md rounded-[4rem] p-12 relative z-10 shadow-2xl overflow-hidden border border-slate-100"><div className="absolute top-0 left-0 w-full h-2 bg-brand-600"></div><button onClick={() => setShowPhoneModal(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 transition-colors"><X className="w-7 h-7" /></button><h2 className="text-3xl font-black mb-2 text-slate-900 tracking-tight text-center">Finaliser la vente</h2><p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-12">Numéro Client (Optionnel)</p>{error && (<div className="p-6 mb-8 bg-red-50 border border-red-100 text-red-600 rounded-[2rem] flex items-start gap-4 text-sm font-bold animate-in slide-in-from-top-4"><AlertCircle className="w-6 h-6 shrink-0 mt-0.5" /><p>{error}</p></div>)}<div className="space-y-10"><div className="relative group"><Smartphone className="absolute left-7 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300 group-focus-within:text-brand-600 transition-colors" /><input type="tel" autoFocus placeholder="6xx xx xx xx" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))} className="w-full pl-16 pr-8 py-8 bg-slate-50 border border-slate-100 rounded-[2rem] font-black text-center text-3xl outline-none focus:bg-white focus:ring-[12px] focus:ring-brand-50 transition-all placeholder:text-slate-200" /></div><button onClick={handleConfirmSale} disabled={isProcessingSale} className="w-full py-8 bg-brand-600 text-white rounded-[2rem] font-black uppercase text-[11px] tracking-[0.3em] flex items-center justify-center gap-4 shadow-2xl shadow-brand-100 hover:bg-brand-700 transition-all transform active:scale-95 disabled:opacity-50">{isProcessingSale ? <Loader2 className="w-6 h-6 animate-spin" /> : <>ENCAISSER & GÉNÉRER <Check className="w-5 h-5" /></>}</button></div></div>
        </div>
      )}
      {showSuccessModal && lastSoldTicket && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 animate-in fade-in">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl" onClick={() => setShowSuccessModal(false)} />
          <div className="bg-white w-full max-w-md rounded-[5rem] p-12 relative z-10 text-center shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
             <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-inner group-hover:scale-110 transition-all"><CheckCircle2 className="w-12 h-12" /></div>
             <h2 className="text-4xl font-black mb-3 text-slate-900 tracking-tighter">Paiement Validé !</h2><p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-12">Donnez le code suivant au client</p>
             
             {/* DESIGN REDUIT ET COMPACT DU TICKET */}
             <div className="bg-slate-50 p-6 rounded-[2.5rem] mb-8 border-2 border-dashed border-slate-200 relative group">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-1 bg-brand-500 h-1.5 w-12 rounded-full"></div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">VOUCHER CODE</p>
                <div className="flex items-center justify-center gap-3 mb-6">
                    <p className="text-4xl font-black text-slate-900 tracking-[0.15em] leading-none">{lastSoldTicket.username}</p>
                    <button onClick={copyCode} className="p-2 bg-white text-slate-400 hover:text-brand-600 rounded-lg shadow-sm border border-slate-100 transition-all active:scale-90"><Copy className="w-4 h-4" /></button>
                </div>
                <div className="bg-white p-4 rounded-[2rem] inline-block shadow-xl border border-slate-50 mb-2 group-hover:scale-[1.02] transition-transform">
                    <img src={generateQRCodeURL(lastSoldTicket.username)} alt="Ticket QR" className="w-24 h-24 mx-auto" />
                </div>
                <p className="mt-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">Scanner pour se connecter</p>
             </div>
             
             <div className="grid grid-cols-1 gap-4"><button onClick={handleWhatsAppShare} className="w-full py-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] flex items-center justify-center gap-4 transition-all transform active:scale-95 shadow-xl"><Share2 className="w-5 h-5" /> ENVOYER SUR WHATSAPP</button><button onClick={() => setShowSuccessModal(false)} className="w-full py-6 bg-slate-900 hover:bg-black text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] transition-all transform active:scale-95">CONTINUER LES VENTES</button></div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Sales;