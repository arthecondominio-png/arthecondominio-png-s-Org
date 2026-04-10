import * as React from 'react';
import { supabase, type NivelLeitura, type Configuracao } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { Droplets, AlertTriangle, CheckCircle2, Info, ArrowUp, ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface TankCardProps {
  title: string;
  deviceId: string;
  config: Configuracao | null;
  latestReading: NivelLeitura | null;
}

const TankCard: React.FC<TankCardProps> = ({ title, deviceId, config, latestReading }) => {
  const percent = latestReading?.percentual ?? 0;
  const status = latestReading?.status ?? 'DESCONHECIDO';
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CRITICO': return 'bg-red-500 text-white';
      case 'BAIXO': return 'bg-orange-500 text-white';
      case 'NORMAL': return 'bg-green-500 text-white';
      case 'ALTO': return 'bg-blue-500 text-white';
      case 'CHEIO': return 'bg-blue-700 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getWaterColor = (percent: number) => {
    if (percent <= 5) return 'bg-red-400';
    if (percent <= 25) return 'bg-orange-400';
    if (percent <= 75) return 'bg-blue-400';
    return 'bg-blue-600';
  };

  return (
    <Card className="overflow-hidden border-none shadow-lg bg-white/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl font-bold text-slate-800">{title}</CardTitle>
            <CardDescription className="text-xs font-mono uppercase tracking-wider opacity-60">
              ID: {deviceId}
            </CardDescription>
          </div>
          <Badge className={getStatusColor(status)}>
            {status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-6 items-center">
          {/* Tank Visualization */}
          <div className="relative w-24 h-48 bg-slate-100 rounded-xl border-4 border-slate-200 overflow-hidden shadow-inner">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${percent}%` }}
              transition={{ type: 'spring', stiffness: 50, damping: 20 }}
              className={`absolute bottom-0 left-0 right-0 ${getWaterColor(percent)} transition-colors duration-500`}
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-white/20 animate-pulse" />
            </motion.div>
            
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none opacity-20">
              {[100, 75, 50, 25, 0].map((val) => (
                <div key={val} className="w-full border-t border-slate-400 flex items-center px-1">
                  <span className="text-[8px] font-bold">{val}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Nível</p>
                <p className="text-2xl font-black text-slate-800">{latestReading?.nivel_cm ?? '--'}<span className="text-xs font-normal ml-1">cm</span></p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Percentual</p>
                <p className="text-2xl font-black text-slate-800">{percent.toFixed(1)}<span className="text-xs font-normal ml-1">%</span></p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                <span>Distância Sensor</span>
                <span>{latestReading?.distancia_cm ?? '--'} cm</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                <span>Última Atualização</span>
                <span>{latestReading ? new Date(latestReading.created_at).toLocaleTimeString() : '--'}</span>
              </div>
            </div>

            {status === 'CRITICO' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-2 bg-red-50 text-red-700 rounded-md border border-red-100 text-xs font-medium"
              >
                <AlertTriangle className="w-4 h-4" />
                Nível Crítico! Abastecimento urgente.
              </motion.div>
            )}
            
            {status === 'ALTO' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-2 bg-blue-50 text-blue-700 rounded-md border border-blue-100 text-xs font-medium"
              >
                <Info className="w-4 h-4" />
                Reservatório quase cheio.
              </motion.div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const Dashboard: React.FC = () => {
  const [readings, setReadings] = React.useState<NivelLeitura[]>([]);
  const [configs, setConfigs] = React.useState<Configuracao[]>([]);
  const [loading, setLoading] = React.useState(true);

  const superiorReading = readings.find(r => r.device_id === 'caixa_01') || null;
  const inferiorReading = readings.find(r => r.device_id === 'caixa_02') || null;
  const superiorConfig = configs.find(c => c.id === 'superior') || null;
  const inferiorConfig = configs.find(c => c.id === 'inferior') || null;

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch latest readings for each device
        const { data: latestReadings, error: readingsError } = await supabase
          .from('nivel_caixa')
          .select('*')
          .order('created_at', { ascending: false });

        if (readingsError) throw readingsError;

        // Group by device_id and take the first one
        const uniqueReadings = latestReadings?.reduce((acc: NivelLeitura[], current) => {
          const x = acc.find(item => item.device_id === current.device_id);
          if (!x) return acc.concat([current]);
          else return acc;
        }, []) || [];

        setReadings(uniqueReadings);

        // Fetch configs
        const { data: configData, error: configError } = await supabase
          .from('configuracoes')
          .select('*');

        if (configError) throw configError;
        setConfigs(configData || []);

      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Erro ao carregar dados do dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'nivel_caixa'
        },
        (payload) => {
          const newReading = payload.new as NivelLeitura;
          setReadings(prev => {
            const filtered = prev.filter(r => r.device_id !== newReading.device_id);
            return [newReading, ...filtered];
          });
          
          // Show alert if status is critical or high
          if (newReading.status === 'CRITICO') {
            toast.error(`ALERTA CRÍTICO: Reservatório ${newReading.device_id === 'caixa_01' ? 'Superior' : 'Inferior'} está com nível crítico!`, {
              duration: 5000,
            });
          } else if (newReading.status === 'CHEIO') {
            toast.success(`INFO: Reservatório ${newReading.device_id === 'caixa_01' ? 'Superior' : 'Inferior'} está cheio.`, {
              duration: 3000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
          <Droplets className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Monitoramento em Tempo Real</h2>
          <p className="text-sm text-slate-500 font-medium">Status atual dos reservatórios de água</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TankCard 
          title="Reservatório Superior" 
          deviceId="caixa_01" 
          config={superiorConfig}
          latestReading={superiorReading}
        />
        <TankCard 
          title="Reservatório Inferior" 
          deviceId="caixa_02" 
          config={inferiorConfig}
          latestReading={inferiorReading}
        />
      </div>

      {/* Quick Summary / Alerts */}
      <Card className="border-none shadow-md bg-white/50 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Sistema Online</span>
              </div>
              <div className="h-4 w-[1px] bg-slate-200" />
              <div className="text-xs font-medium text-slate-500">
                Total de leituras hoje: <span className="font-bold text-slate-800">--</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white text-[10px] font-bold">
                CUIABÁ: UTC-4
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
