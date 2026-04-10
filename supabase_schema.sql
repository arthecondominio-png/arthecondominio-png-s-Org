-- Tabela para armazenar as leituras de nível
CREATE TABLE IF NOT EXISTS nivel_caixa (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    device_id TEXT NOT NULL,
    distancia_cm NUMERIC NOT NULL,
    nivel_cm NUMERIC NOT NULL,
    percentual NUMERIC NOT NULL,
    faixa_percentual INTEGER NOT NULL,
    status TEXT NOT NULL,
    datahora_device TIMESTAMPTZ
);

-- Tabela para configurações dos reservatórios
CREATE TABLE IF NOT EXISTS configuracoes (
    id TEXT PRIMARY KEY, -- 'superior' ou 'inferior'
    altura_caixa_cm NUMERIC DEFAULT 120,
    nivel_baixo_percentual NUMERIC DEFAULT 25,
    nivel_alto_percentual NUMERIC DEFAULT 85,
    wifi_ssid TEXT,
    wifi_password TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar Realtime para a tabela nivel_caixa
ALTER PUBLICATION supabase_realtime ADD TABLE nivel_caixa;

-- Políticas de Segurança (RLS)
-- Como o ESP32 usa a chave anon para POST, precisamos permitir inserção anônima
-- E leitura anônima para o dashboard

ALTER TABLE nivel_caixa ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

-- Política para nivel_caixa: Todos podem ler e inserir
CREATE POLICY "Permitir leitura pública de nivel_caixa" ON nivel_caixa FOR SELECT USING (true);
CREATE POLICY "Permitir inserção pública de nivel_caixa" ON nivel_caixa FOR INSERT WITH CHECK (true);

-- Política para configuracoes: Todos podem ler, apenas autenticados podem atualizar (ou todos para simplificar neste exemplo)
CREATE POLICY "Permitir leitura pública de configuracoes" ON configuracoes FOR SELECT USING (true);
CREATE POLICY "Permitir atualização pública de configuracoes" ON configuracoes FOR UPDATE USING (true);
CREATE POLICY "Permitir inserção pública de configuracoes" ON configuracoes FOR INSERT WITH CHECK (true);

-- Inserir configurações iniciais se não existirem
INSERT INTO configuracoes (id, altura_caixa_cm, nivel_baixo_percentual, nivel_alto_percentual)
VALUES ('superior', 120, 25, 85)
ON CONFLICT (id) DO NOTHING;

INSERT INTO configuracoes (id, altura_caixa_cm, nivel_baixo_percentual, nivel_alto_percentual)
VALUES ('inferior', 120, 25, 85)
ON CONFLICT (id) DO NOTHING;
