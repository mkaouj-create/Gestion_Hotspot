
import React from 'react';

export enum UserRole {
  ADMIN_GLOBAL = 'ADMIN_GLOBAL',
  GESTIONNAIRE_WIFI_ZONE = 'GESTIONNAIRE_WIFI_ZONE',
  ADMIN = 'ADMIN',
  REVENDEUR = 'REVENDEUR',
  AGENT = 'AGENT',
  ASSOCIE = 'ASSOCIE',
  CLIENT = 'CLIENT'
}

export enum TicketStatus {
  NEUF = 'NEUF',
  VENDU = 'VENDU',
  UTILISE = 'UTILISÉ',
  EXPIRE = 'EXPIRÉ',
  ASSIGNE = 'ASSIGNÉ'
}

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  tenant_id?: string;
  balance?: number;
  profile_completed?: boolean;
  is_active?: boolean;
  total_revenue?: number;
}

export interface Tenant {
  id: string;
  name: string;
  subscription_status?: string;
  subscription_end_at?: string;
  created_at: string;
}

export interface Zone {
  id: string;
  name: string;
  location: string;
  tenant_id: string;
  is_active?: boolean;
  created_at: string;
}

export interface Ticket {
  id: string;
  tenant_id: string;
  profile_id: string;
  username: string;
  password?: string;
  status: TicketStatus | string;
  imported_at: string;
  sold_at?: string;
  sold_by?: string;
  assigned_to?: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: 'VENTE' | 'VERSEMENT';
  amount: number;
  description: string;
  party_name: string;
  method?: string;
  status?: string;
  tenant_id: string;
  reference?: string;
}

export interface DashboardStats {
  revenue: number;
  soldCount: number;
  userCount: number;
  stockCount: number;
}

export interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

export interface Sale {
  id: string;
  amount_paid: number;
  sold_at: string;
  metadata?: {
    customer_phone?: string;
    [key: string]: any;
  };
  ticket_id?: string;
  tenant_id: string;
  seller_id: string;
  tenants?: { name: string };
  tickets?: {
    id: string;
    username: string;
    password?: string;
    status: string;
    ticket_profiles?: { name: string };
  };
  users?: { full_name: string };
}
