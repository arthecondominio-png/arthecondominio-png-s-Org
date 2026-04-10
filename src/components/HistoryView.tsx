import * as React from 'react';
import { supabase, type NivelLeitura } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts';
import { History, Filter, Download, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export const HistoryView: React.FC = () => {
  const [history, setHistory] = React.useState<NivelLeitura[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [timeRange, setTimeRange] = React.useState<'24h' | '7d' | '30d'>('24h');

  React.useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('nivel_caixa')
          .select('*')
          .order('created_at', { ascending: false });

        if (timeRange === '24h') {
          const yesterday = new Date();
          yesterday.setHours(yesterday.getHours() - 24);
          query = query.gte('created_at', yesterday.toISOString());
        } else if (timeRange === '7d') {
          const lastWeek = new Date();
          lastWeek.setDate(lastWeek.getDate() - 7);
          query = query.gte('created_at', lastWeek.toISOString());
        }

        const { data, error } = await query;

        if (error) throw error;
        setHistory(data || []);
      } catch (error) {
        console.error('Error fetching history:', error);
        toast.error('Erro ao carregar histórico');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [timeRange]);

  const chartData = React.useMemo(() => {
    // Group readings by time for the chart
    // For 24h, we can show more detail
    const sorted = [...history].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    return sorted.map(r => ({
      time: format(new Date(r.created_at), 'HH:mm'),
      fullTime: format(new Date(r.created_at), 'dd/MM HH:mm'),
      nivel: r.percentual,
      deviceId: r.device_id,
      superior: r.device_id === 'caixa_01' ? r.percentual : null,
      inferior: r.device_id === 'caixa_02' ? r.percentual : null,
    }));
  }, [history]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CRITICO': return <Badge variant="destructive">{status}</Badge>;
      case 'BAIXO': return <Badge className="bg-orange-500">{status}</Badge>;
      case 'NORMAL': return <Badge className="bg-green-500">{status}</Badge>;
      case 'ALTO': return <Badge className="bg-blue-500">{status}</Badge>;
      case 'CHEIO': return <Badge className="bg-blue-700">{status}</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Histórico de Níveis</h2>
            <p className="text-sm text-slate-500 font-medium">Análise de tendências e evolução</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg self-start sm:self-center">
          {(['24h', '7d', '30d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                timeRange === range 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <Card className="border-none shadow-lg bg-white/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-0">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-500" />
            Evolução dos Reservatórios (%)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="h-[350px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSuperior" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorInferior" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="time" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                  minTickGap={30}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                  domain={[0, 100]}
                  unit="%"
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Area 
                  name="Superior"
                  type="monotone" 
                  dataKey="superior" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorSuperior)" 
                  connectNulls
                />
                <Area 
                  name="Inferior"
                  type="monotone" 
                  dataKey="inferior" 
                  stroke="#6366f1" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorInferior)" 
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-none shadow-lg bg-white/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold">Leituras Detalhadas</CardTitle>
            <CardDescription>Lista completa de registros recentes</CardDescription>
          </div>
          <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <Download className="w-5 h-5 text-slate-400" />
          </button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Data/Hora</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Dispositivo</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Nível (cm)</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Percentual</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length > 0 ? (
                  history.slice(0, 50).map((row) => (
                    <TableRow key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="text-xs font-medium text-slate-600">
                        {format(new Date(row.created_at), 'dd/MM/yyyy HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase">
                          {row.device_id === 'caixa_01' ? 'Superior' : 'Inferior'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold">{row.nivel_cm} cm</TableCell>
                      <TableCell className="font-mono text-xs font-bold">{row.percentual}%</TableCell>
                      <TableCell>{getStatusBadge(row.status)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-400 italic">
                      Nenhum registro encontrado no período selecionado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
