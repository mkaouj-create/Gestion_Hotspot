
import { UserRole } from '../types';

// --- LOCAL DB ENGINE ---
const DB_KEY = 'hotspot_pro_local_db';
const SESSION_KEY = 'hotspot_pro_session';

// Helper pour générer des IDs compatibles partout
const uuid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);

// Données de démarrage
const SEED_DATA = {
  users: [
    { id: 'admin-1', email: 'admin@demo.com', password: '123', full_name: 'Super Admin', role: UserRole.ADMIN_GLOBAL, tenant_id: null, is_active: true, balance: 0, created_at: new Date().toISOString() },
    { id: 'manager-1', email: 'manager@agence.com', password: '123', full_name: 'Directeur Agence', role: UserRole.GESTIONNAIRE_WIFI_ZONE, tenant_id: 'tenant-1', is_active: true, balance: 0, created_at: new Date().toISOString() },
    { id: 'reseller-1', email: 'vendeur@agence.com', password: '123', full_name: 'Aliou Vendeur', role: UserRole.REVENDEUR, tenant_id: 'tenant-1', is_active: true, balance: 50000, created_at: new Date().toISOString() }
  ],
  tenants: [
    { id: 'tenant-1', name: 'Univers WiFi Conakry', subscription_status: 'ACTIF', subscription_end_at: new Date(Date.now() + 86400000 * 30).toISOString(), created_at: new Date().toISOString() }
  ],
  tickets: [],
  ticket_profiles: [
    { id: 'prof-1', tenant_id: 'tenant-1', name: '1 Heure', price: 2000, created_at: new Date().toISOString() },
    { id: 'prof-2', tenant_id: 'tenant-1', name: '24 Heures', price: 10000, created_at: new Date().toISOString() }
  ],
  sales_history: [],
  zones: [],
  payments: []
};

// Gestionnaires d'événements pour l'authentification
type AuthListener = (event: 'SIGNED_IN' | 'SIGNED_OUT' | 'USER_UPDATED', session: any) => void;
let authListeners: AuthListener[] = [];

const notifyListeners = (event: 'SIGNED_IN' | 'SIGNED_OUT' | 'USER_UPDATED', session: any) => {
  authListeners.forEach(l => l(event, session));
};

// --- CORE FUNCTIONS ---
const getDB = () => {
  const stored = localStorage.getItem(DB_KEY);
  let dbData;

  if (!stored) {
    dbData = SEED_DATA;
    localStorage.setItem(DB_KEY, JSON.stringify(dbData));
    return dbData;
  }

  try {
    dbData = JSON.parse(stored);
    // VÉRIFICATION D'INTÉGRITÉ
    if (!dbData.users || !Array.isArray(dbData.users) || !dbData.users.find((u: any) => u.email === 'admin@demo.com')) {
        console.warn("Base de données locale obsolète ou corrompue. Réinitialisation des données de démo...");
        dbData = SEED_DATA;
        localStorage.setItem(DB_KEY, JSON.stringify(dbData));
    }
  } catch (e) {
    dbData = SEED_DATA;
    localStorage.setItem(DB_KEY, JSON.stringify(dbData));
  }
  
  return dbData;
};

const saveDB = (data: any) => localStorage.setItem(DB_KEY, JSON.stringify(data));
const delay = (ms = 200) => new Promise(r => setTimeout(r, ms));

// --- QUERY BUILDER ---
class LocalQueryBuilder {
  private filters: ((item: any) => boolean)[] = [];
  private orders: { col: string, ascending: boolean }[] = [];
  private limitVal: number | null = null;
  private operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' = 'SELECT';
  private payload: any = null;
  private db: any;

  constructor(private table: string) {
    this.db = getDB();
  }
  
  select(cols?: string) { return this; }
  
  eq(col: string, val: any) { this.filters.push(i => i[col] === val); return this; }
  neq(col: string, val: any) { this.filters.push(i => i[col] !== val); return this; }
  in(col: string, vals: any[]) { this.filters.push(i => vals.includes(i[col])); return this; }
  ilike(col: string, pattern: string) { 
    const regex = new RegExp(pattern.replace(/%/g, '.*'), 'i');
    this.filters.push(i => regex.test(i[col] || '')); 
    return this; 
  }
  
  order(col: string, { ascending = true } = {}) { this.orders.push({ col, ascending }); return this; }
  limit(n: number) { this.limitVal = n; return this; }

  insert(rows: any | any[]) {
    this.operation = 'INSERT';
    this.payload = rows;
    return this;
  }

  update(updates: any) {
    this.operation = 'UPDATE';
    this.payload = updates;
    return this;
  }

  delete() {
    this.operation = 'DELETE';
    return this;
  }

  private async _execute() {
    await delay();
    this.db = getDB(); // Refresh DB

    if (this.operation === 'INSERT') {
       const arr = Array.isArray(this.payload) ? this.payload : [this.payload];
       const newItems = arr.map((r: any) => ({ ...r, id: r.id || uuid(), created_at: new Date().toISOString() }));
       
       if (!this.db[this.table]) this.db[this.table] = [];
       this.db[this.table].push(...newItems);
       saveDB(this.db);
       return { data: Array.isArray(this.payload) ? newItems : newItems[0], error: null, count: newItems.length };
    }

    if (this.operation === 'UPDATE') {
        let count = 0;
        this.db[this.table] = this.db[this.table].map((item: any) => {
          if (this.filters.every(f => f(item))) {
            count++;
            return { ...item, ...this.payload };
          }
          return item;
        });
        saveDB(this.db);
        return { data: null, error: null, count };
    }

    if (this.operation === 'DELETE') {
        const initialLen = this.db[this.table].length;
        this.db[this.table] = this.db[this.table].filter((item: any) => !this.filters.every(f => f(item)));
        saveDB(this.db);
        return { data: null, error: null, count: initialLen - this.db[this.table].length };
    }

    // SELECT
    let res = (this.db[this.table] || []).filter((item: any) => this.filters.every(f => f(item)));
    
    // Simulating Joins
    res = res.map((item: any) => {
      const enriched = { ...item };
      if (enriched.tenant_id && this.db.tenants) enriched.tenants = this.db.tenants.find((t: any) => t.id === enriched.tenant_id);
      
      if (this.table === 'tenants') enriched.users = this.db.users.filter((u: any) => u.tenant_id === enriched.id);
      
      if (this.table === 'tickets' && enriched.profile_id) enriched.ticket_profiles = this.db.ticket_profiles.find((p: any) => p.id === enriched.profile_id);
      
      if (this.table === 'sales_history') {
        if (enriched.seller_id) enriched.users = this.db.users.find((u: any) => u.id === enriched.seller_id);
        if (enriched.ticket_id) {
          const t = this.db.tickets.find((x: any) => x.id === enriched.ticket_id);
          if (t) enriched.tickets = { ...t, ticket_profiles: this.db.ticket_profiles.find((p: any) => p.id === t.profile_id) };
        }
      }
      if (this.table === 'ticket_profiles') {
         enriched.tickets = [{ count: this.db.tickets.filter((t: any) => t.profile_id === enriched.id && t.status === 'NEUF').length }];
      }
      return enriched;
    });

    for (const { col, ascending } of this.orders) {
      res.sort((a: any, b: any) => {
        const valA = a[col] || '';
        const valB = b[col] || '';
        return (valA < valB ? (ascending ? -1 : 1) : (valA > valB ? (ascending ? 1 : -1) : 0));
      });
    }

    if (this.limitVal !== null) res = res.slice(0, this.limitVal);
    
    return { data: res, error: null, count: res.length };
  }

  async then(resolve: (res: any) => void, reject: (err: any) => void) {
    try {
      const result = await this._execute();
      resolve(result);
    } catch (err) {
      if (reject) reject(err);
    }
  }

  async single() {
    this.limit(1);
    const result = await this._execute();
    return { data: (result.data && result.data.length > 0) ? result.data[0] : null, error: null };
  }
  
  async maybeSingle() { return this.single(); }
}

// --- DB CLIENT ---
export const db = {
  from: (table: string) => new LocalQueryBuilder(table),
  
  auth: {
    async signUp({ email, password, options }: any) {
      await delay(500);
      const dbData = getDB();
      if (dbData.users.find((u: any) => u.email === email)) return { data: { user: null }, error: { message: 'Email déjà utilisé', status: 422 } };
      
      const newUser = {
        id: uuid(),
        email, password,
        full_name: options?.data?.full_name || 'Nouveau',
        role: options?.data?.role || UserRole.CLIENT,
        tenant_id: options?.data?.tenant_id || null,
        is_active: true, balance: 0,
        created_at: new Date().toISOString()
      };
      dbData.users.push(newUser);
      saveDB(dbData);
      localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
      notifyListeners('SIGNED_IN', { user: newUser });
      return { data: { user: newUser }, error: null };
    },
    
    async signInWithPassword({ email, password }: any) {
      await delay(500);
      const user = getDB().users.find((u: any) => u.email === email && u.password === password);
      if (!user) return { data: { user: null }, error: { message: 'Identifiants incorrects' } };
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      notifyListeners('SIGNED_IN', { user });
      return { data: { user }, error: null };
    },
    
    async signOut() { 
        localStorage.removeItem(SESSION_KEY); 
        notifyListeners('SIGNED_OUT', null);
        return { error: null }; 
    },
    
    async getUser() {
      const u = localStorage.getItem(SESSION_KEY);
      return { data: { user: u ? JSON.parse(u) : null }, error: null };
    },

    async updateUser(updates: any) { 
        const u = localStorage.getItem(SESSION_KEY);
        if(u) {
            const user = JSON.parse(u);
            const merged = { ...user, ...updates };
            localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
            const dbData = getDB();
            const idx = dbData.users.findIndex((x:any) => x.id === user.id);
            if(idx >= 0) {
                dbData.users[idx] = { ...dbData.users[idx], ...updates };
                saveDB(dbData);
            }
            notifyListeners('USER_UPDATED', { user: merged });
        }
        return { error: null }; 
    },

    onAuthStateChange(callback: AuthListener) {
        authListeners.push(callback);
        return {
            data: {
                subscription: {
                    unsubscribe: () => {
                        authListeners = authListeners.filter(l => l !== callback);
                    }
                }
            }
        };
    }
  },

  rpc: async (fn: string, params: any) => {
    await delay();
    const dbData = getDB();
    const currentUser = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
    
    if (fn === 'create_new_agency') {
      const newTenant = { id: uuid(), name: params.p_agency_name, subscription_status: 'EN_ATTENTE', created_at: new Date().toISOString() };
      dbData.tenants.push(newTenant);
      const uIdx = dbData.users.findIndex((u: any) => u.id === currentUser.id);
      if (uIdx > -1) {
        dbData.users[uIdx].tenant_id = newTenant.id;
        dbData.users[uIdx].role = UserRole.GESTIONNAIRE_WIFI_ZONE;
        const updatedUser = dbData.users[uIdx];
        localStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));
        notifyListeners('USER_UPDATED', { user: updatedUser });
      }
      saveDB(dbData);
    }
    
    if (fn === 'delete_tenant_fully') {
      dbData.users = dbData.users.filter((u: any) => u.tenant_id !== params.target_tenant_id);
      dbData.tenants = dbData.tenants.filter((t: any) => t.id !== params.target_tenant_id);
      dbData.tickets = dbData.tickets.filter((t: any) => t.tenant_id !== params.target_tenant_id);
      saveDB(dbData);
    }

    if (fn === 'delete_user_fully') {
        dbData.users = dbData.users.filter((u: any) => u.id !== params.target_user_id);
        saveDB(dbData);
    }
    
    return { data: null, error: null };
  }
};
