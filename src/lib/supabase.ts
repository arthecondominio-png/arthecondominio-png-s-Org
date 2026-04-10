import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://yitkrgilhtszwpyfvqys.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_kiJoU90W0K59gOW35S4Tmw_ZdEDDNKB";

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Supabase environment variables not found. Using default fallback values provided in the request.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type NivelLeitura = {
  id: string;
  created_at: string;
  device_id: string;
  distancia_cm: number;
  nivel_cm: number;
  percentual: number;
  faixa_percentual: number;
  status: 'CRITICO' | 'BAIXO' | 'NORMAL' | 'ALTO' | 'CHEIO';
  datahora_device: string;
};

export type Configuracao = {
  id: string;
  altura_caixa_cm: number;
  nivel_baixo_percentual: number;
  nivel_alto_percentual: number;
  wifi_ssid?: string;
  wifi_password?: string;
  updated_at: string;
};
