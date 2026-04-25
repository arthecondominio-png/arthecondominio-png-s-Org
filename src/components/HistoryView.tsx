import * as React from 'react';
import { supabase, type NivelLeitura } from '../lib/supabase.ts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table.tsx';
import { Badge } from './ui/badge.tsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts';
import { History, Filter, Download, Calendar, Zap, Clock, Activity, TrendingUp } from 'lucide-react';
import { format, differenceInMinutes, startOfDay, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export const HistoryView: React.FC = () => {
  const [history, setHistory] = React.useState<NivelLeitura[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [timeRange, setTimeRange] = React.useState<'24h' | '7d' | '30d'>('24h');
  const [deviceFilter, setDeviceFilter] = React.useState<'todos' | 'superior' | 'inferior'>('todos');

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
    const filteredHistory = history.filter(r => {
      if (deviceFilter === 'todos') return true;
      if (deviceFilter === 'superior') return r.device_id === 'caixa_01';
      if (deviceFilter === 'inferior') return r.device_id === 'caixa_02';
      return true;
    });

    const sorted = [...filteredHistory].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    return sorted.map(r => ({
      time: format(new Date(r.created_at), 'HH:mm'),
      fullTime: format(new Date(r.created_at), 'dd/MM HH:mm'),
      nivel: r.percentual,
      deviceId: r.device_id,
      superior: r.device_id === 'caixa_01' ? r.percentual : null,
      inferior: r.device_id === 'caixa_02' ? r.percentual : null,
    }));
  }, [history, deviceFilter]);

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

  const pumpAnalysis = React.useMemo(() => {
    if (history.length < 2) return null;

    // Sort ascending for analysis
    const sorted = [...history].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    // Analyze based on filter or both
    const readings = sorted.filter(r => {
      if (deviceFilter === 'todos') return r.device_id === 'caixa_01'; // Default to superior for general analysis
      if (deviceFilter === 'superior') return r.device_id === 'caixa_01';
      if (deviceFilter === 'inferior') return r.device_id === 'caixa_02';
      return false;
    });
    
    const events: { start: Date, end: Date, startLevel: number, endLevel: number, duration: number }[] = [];
    let currentEvent: any = null;

    for (let i = 1; i < readings.length; i++) {
      const prev = readings[i-1];
      const curr = readings[i];
      const levelDiff = curr.percentual - prev.percentual;
      const timeDiff = differenceInMinutes(new Date(curr.created_at), new Date(prev.created_at));

      // If level increased significantly (more than 2% between readings)
      // and time between readings is reasonable (less than 60 mins to avoid gaps)
      if (levelDiff > 1 && timeDiff < 60) {
        if (!currentEvent) {
          currentEvent = {
            start: new Date(prev.created_at),
            startLevel: prev.percentual,
            end: new Date(curr.created_at),
            endLevel: curr.percentual
          };
        } else {
          currentEvent.end = new Date(curr.created_at);
          currentEvent.endLevel = curr.percentual;
        }
      } else {
        if (currentEvent) {
          // Only count as a pump event if total increase was > 10%
          if (currentEvent.endLevel - currentEvent.startLevel > 10) {
            currentEvent.duration = differenceInMinutes(currentEvent.end, currentEvent.start);
            events.push(currentEvent);
          }
          currentEvent = null;
        }
      }
    }

    // Handle last event if it was still rising
    if (currentEvent && currentEvent.endLevel - currentEvent.startLevel > 10) {
      currentEvent.duration = differenceInMinutes(currentEvent.end, currentEvent.start);
      events.push(currentEvent);
    }

    const totalActivations = events.length;
    const avgDuration = totalActivations > 0 
      ? events.reduce((acc, e) => acc + e.duration, 0) / totalActivations 
      : 0;

    // Group by day to find pattern
    const days: { [key: string]: number } = {};
    events.forEach(e => {
      const dayKey = format(e.start, 'yyyy-MM-dd');
      days[dayKey] = (days[dayKey] || 0) + 1;
    });

    const dayCount = Object.keys(days).length || 1;
    const avgPerDay = totalActivations / dayCount;

    return {
      events: events.reverse(), // Show newest first
      totalActivations,
      avgDuration: Math.round(avgDuration),
      avgPerDay: avgPerDay.toFixed(1)
    };
  }, [history]);

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

        <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1 rounded-lg self-start sm:self-center">
          <div className="flex items-center gap-1 mr-2 px-2 border-r border-slate-200">
            {(['todos', 'superior', 'inferior'] as const).map((dev) => (
              <button
                key={dev}
                onClick={() => setDeviceFilter(dev)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                  deviceFilter === dev 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {dev === 'todos' ? 'Todos' : dev === 'superior' ? 'Superior' : 'Inferior'}
              </button>
            ))}
          </div>
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
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
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
                  stroke="#10b981" 
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

      {/* Pump Analysis Section */}
      {pumpAnalysis && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-md bg-white/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Acionamentos</p>
                  <h3 className="text-2xl font-black text-slate-800 mt-1">{pumpAnalysis.totalActivations}</h3>
                </div>
                <div className="p-3 bg-blue-100 rounded-2xl text-blue-600">
                  <Zap className="w-6 h-6" />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-medium">Total no período selecionado</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md bg-white/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tempo Médio</p>
                  <h3 className="text-2xl font-black text-slate-800 mt-1">{pumpAnalysis.avgDuration} min</h3>
                </div>
                <div className="p-3 bg-indigo-100 rounded-2xl text-indigo-600">
                  <Clock className="w-6 h-6" />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-medium">Duração média de enchimento</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md bg-white/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Frequência</p>
                  <h3 className="text-2xl font-black text-slate-800 mt-1">{pumpAnalysis.avgPerDay} / dia</h3>
                </div>
                <div className="p-3 bg-emerald-100 rounded-2xl text-emerald-600">
                  <Activity className="w-6 h-6" />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-medium">Média de acionamentos diários</p>
            </CardContent>
          </Card>
        </div>
      )}

      {pumpAnalysis && pumpAnalysis.events.length > 0 && (
        <Card className="border-none shadow-lg bg-white/50 backdrop-blur-sm overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              Padrões de Enchimento Detectados
            </CardTitle>
            <CardDescription>Identificação automática de ciclos da bomba</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Início</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Fim</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Duração</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Variação</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Eficiência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pumpAnalysis.events.slice(0, 10).map((event, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="text-xs font-medium text-slate-600">
                        {format(event.start, 'dd/MM HH:mm')}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-600">
                        {format(event.end, 'dd/MM HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] font-bold">
                          {event.duration} min
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-blue-600">
                        +{Math.round(event.endLevel - event.startLevel)}%
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-500">
                        {((event.endLevel - event.startLevel) / (event.duration || 1)).toFixed(1)}% / min
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

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
                  history
                    .filter(r => {
                      if (deviceFilter === 'todos') return true;
                      if (deviceFilter === 'superior') return r.device_id === 'caixa_01';
                      if (deviceFilter === 'inferior') return r.device_id === 'caixa_02';
                      return true;
                    })
                    .slice(0, 50).map((row) => (
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
