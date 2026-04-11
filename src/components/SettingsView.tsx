import * as React from 'react';
import { supabase, type Configuracao } from '../lib/supabase.ts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './ui/card.tsx';
import { Input } from './ui/input.tsx';
import { Label } from './ui/label.tsx';
import { Button } from './ui/button.tsx';
import { Slider } from './ui/slider.tsx';
import { Settings, Save, Wifi, Database, Info, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export const SettingsView: React.FC = () => {
  const [configs, setConfigs] = React.useState<Configuracao[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [showWifiPass, setShowWifiPass] = React.useState(false);

  React.useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const { data, error } = await supabase
          .from('configuracoes')
          .select('*');

        if (error) throw error;
        setConfigs(data || []);
      } catch (error) {
        console.error('Error fetching configs:', error);
        toast.error('Erro ao carregar configurações');
      } finally {
        setLoading(false);
      }
    };

    fetchConfigs();
  }, []);

  const handleUpdateConfig = (id: string, field: keyof Configuracao, value: any) => {
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const saveConfigs = async () => {
    setSaving(true);
    try {
      for (const config of configs) {
        const { error } = await supabase
          .from('configuracoes')
          .upsert({
            ...config,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;
      }
      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving configs:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Configurações do Sistema</h2>
          <p className="text-sm text-slate-500 font-medium">Ajuste os parâmetros dos reservatórios e Wi-Fi</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {configs.map((config) => (
          <Card key={config.id} className="border-none shadow-lg bg-white/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold capitalize">Reservatório {config.id === 'superior' ? 'Superior' : 'Inferior'}</CardTitle>
              <CardDescription>Ajuste as dimensões e limites de alerta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Altura Total da Caixa (cm)</Label>
                <div className="flex items-center gap-4">
                  <Input 
                    type="number" 
                    value={config.altura_caixa_cm} 
                    onChange={(e) => handleUpdateConfig(config.id, 'altura_caixa_cm', parseFloat(e.target.value))}
                    className="font-mono font-bold"
                  />
                  <span className="text-sm font-bold text-slate-400">cm</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold uppercase text-slate-500">Nível Baixo Alerta (%)</Label>
                  <span className="text-sm font-black text-orange-600">{config.nivel_baixo_percentual}%</span>
                </div>
                <Slider 
                  value={[config.nivel_baixo_percentual]} 
                  min={0} 
                  max={50} 
                  step={1}
                  onValueChange={(val) => handleUpdateConfig(config.id, 'nivel_baixo_percentual', val[0])}
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold uppercase text-slate-500">Nível Alto Alerta (%)</Label>
                  <span className="text-sm font-black text-blue-600">{config.nivel_alto_percentual}%</span>
                </div>
                <Slider 
                  value={[config.nivel_alto_percentual]} 
                  min={50} 
                  max={100} 
                  step={1}
                  onValueChange={(val) => handleUpdateConfig(config.id, 'nivel_alto_percentual', val[0])}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* WiFi Config */}
      <Card className="border-none shadow-lg bg-white/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-blue-500" />
            <CardTitle className="text-lg font-bold">Credenciais Wi-Fi</CardTitle>
          </div>
          <CardDescription>Informações para conexão das placas ESP32</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-slate-500">SSID (Nome da Rede)</Label>
            <Input 
              placeholder="Ex: MinhaRede_WiFi" 
              value={configs[0]?.wifi_ssid || ''}
              onChange={(e) => {
                const val = e.target.value;
                setConfigs(prev => prev.map(c => ({ ...c, wifi_ssid: val })));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-slate-500">Senha do Wi-Fi</Label>
            <div className="relative">
              <Input 
                type={showWifiPass ? "text" : "password"} 
                placeholder="••••••••" 
                value={configs[0]?.wifi_password || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setConfigs(prev => prev.map(c => ({ ...c, wifi_password: val })));
                }}
              />
              <button 
                type="button"
                onClick={() => setShowWifiPass(!showWifiPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showWifiPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-blue-50/50 p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 leading-relaxed">
            <strong>Nota:</strong> Estas informações são salvas no banco de dados para consulta. 
            Certifique-se de que o script da sua placa ESP32 esteja configurado para ler estas informações 
            ou que elas correspondam ao que foi gravado fisicamente na placa.
          </p>
        </CardFooter>
      </Card>

      <div className="flex justify-end pt-4">
        <Button 
          onClick={saveConfigs} 
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-6 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Salvando...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Save className="w-5 h-5" />
              Salvar Todas as Configurações
            </span>
          )}
        </Button>
      </div>
    </div>
  );
};
