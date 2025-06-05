-- ============================================================================
-- MIGRAÇÕES PARA SUPORTE À LÓGICA PYTHON NO CNAB240
-- Arquivo: 02-python-logic-migrations.sql
-- ============================================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
USE cnab_database;

-- ============================================================================
-- 1. EXTENSÃO DA TABELA cnab240_segments PARA DADOS PYTHON
-- ============================================================================

-- Verificar se a tabela cnab240_segments existe
SHOW TABLES LIKE 'cnab240_segments';

-- Adicionar campos específicos para dados extraídos com lógica Python
ALTER TABLE cnab240_segments 
-- Dados do pagador (segunda linha J do parser Python)
ADD COLUMN IF NOT EXISTS pagador_nome VARCHAR(100) COMMENT 'Nome do pagador extraído da segunda linha J' AFTER beneficiario_nome,
ADD COLUMN IF NOT EXISTS pagador_documento VARCHAR(20) COMMENT 'CNPJ/CPF do pagador da segunda linha J' AFTER pagador_nome,

-- Dados de endereço completo (segmento B formatado)
ADD COLUMN IF NOT EXISTS endereco_completo TEXT COMMENT 'Endereço completo formatado pelo parser Python' AFTER endereco_cidade,
ADD COLUMN IF NOT EXISTS email VARCHAR(255) COMMENT 'Email extraído do segmento B' AFTER endereco_completo,

-- Metadados do parser Python
ADD COLUMN IF NOT EXISTS parsing_method ENUM('traditional', 'python_logic', 'hybrid') DEFAULT 'traditional' COMMENT 'Método de parsing utilizado',
ADD COLUMN IF NOT EXISTS segment_sequence JSON COMMENT 'Sequência de segmentos relacionados (J+J, J+B)' AFTER parsing_method,
ADD COLUMN IF NOT EXISTS python_parsing_metadata JSON COMMENT 'Metadados específicos do parser Python' AFTER segment_sequence,

-- Campos adicionais do parser Python
ADD COLUMN IF NOT EXISTS codigo_movimento VARCHAR(20) COMMENT 'Código de movimento extraído' AFTER python_parsing_metadata,
ADD COLUMN IF NOT EXISTS codigo_camara VARCHAR(10) COMMENT 'Código da câmara de compensação' AFTER codigo_movimento,
ADD COLUMN IF NOT EXISTS documento VARCHAR(50) COMMENT 'Documento/referência do pagamento' AFTER codigo_camara,
ADD COLUMN IF NOT EXISTS descontos VARCHAR(20) COMMENT 'Valor de descontos' AFTER documento,
ADD COLUMN IF NOT EXISTS acrescimos VARCHAR(20) COMMENT 'Valor de acréscimos' AFTER descontos,
ADD COLUMN IF NOT EXISTS informacoes TEXT COMMENT 'Informações adicionais' AFTER acrescimos;

-- Adicionar índices para otimização de consultas Python
ALTER TABLE cnab240_segments 
ADD INDEX IF NOT EXISTS idx_pagador_nome (pagador_nome),
ADD INDEX IF NOT EXISTS idx_pagador_documento (pagador_documento),
ADD INDEX IF NOT EXISTS idx_email (email),
ADD INDEX IF NOT EXISTS idx_parsing_method (parsing_method),
ADD INDEX IF NOT EXISTS idx_codigo_movimento (codigo_movimento);

-- ============================================================================
-- 2. TABELA PARA RESULTADOS RESUMIDOS DO PARSER PYTHON
-- ============================================================================

CREATE TABLE IF NOT EXISTS cnab240_python_results (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    
    -- Referências
    cnab240_file_id BIGINT NOT NULL COMMENT 'Referência ao arquivo CNAB240',
    operation_id VARCHAR(50) NOT NULL COMMENT 'ID da operação que gerou este resultado',
    
    -- Estatísticas do processamento Python
    total_pagamentos INT DEFAULT 0 COMMENT 'Total de pagamentos extraídos com lógica Python',
    valor_total DECIMAL(15,2) DEFAULT 0.00 COMMENT 'Valor total de todos os pagamentos',
    valor_medio DECIMAL(15,2) DEFAULT 0.00 COMMENT 'Valor médio por pagamento',
    
    -- Metadados do processamento
    metodologia VARCHAR(50) DEFAULT 'Python Sequential Logic' COMMENT 'Metodologia de parsing utilizada',
    linhas_processadas INT DEFAULT 0 COMMENT 'Total de linhas processadas',
    segmentos_j_processados INT DEFAULT 0 COMMENT 'Total de segmentos J processados',
    segmentos_b_processados INT DEFAULT 0 COMMENT 'Total de segmentos B processados',
    python_logic_enabled BOOLEAN DEFAULT TRUE COMMENT 'Se a lógica Python estava habilitada',
    
    -- Detalhes do processamento
    processing_summary JSON COMMENT 'Resumo completo do processamento Python',
    validation_results JSON COMMENT 'Resultados de validação específicos',
    extraction_metadata JSON COMMENT 'Metadados da extração (posições, sequências)',
    
    -- Controle de qualidade
    success_rate DECIMAL(5,2) DEFAULT 100.00 COMMENT 'Taxa de sucesso na extração (%)',
    warnings_count INT DEFAULT 0 COMMENT 'Número de avisos durante o processamento',
    errors_count INT DEFAULT 0 COMMENT 'Número de erros durante o processamento',
    
    -- Timestamps
    processing_started_at TIMESTAMP NULL COMMENT 'Início do processamento Python',
    processing_completed_at TIMESTAMP NULL COMMENT 'Fim do processamento Python',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Constraints e índices
    INDEX idx_cnab240_file_id (cnab240_file_id),
    INDEX idx_operation_id (operation_id),
    INDEX idx_python_logic_enabled (python_logic_enabled),
    INDEX idx_metodologia (metodologia),
    INDEX idx_valor_total (valor_total),
    INDEX idx_total_pagamentos (total_pagamentos),
    INDEX idx_created_at (created_at),
    
    -- Foreign keys
    FOREIGN KEY (cnab240_file_id) REFERENCES cnab240_files(id) ON DELETE CASCADE,
    FOREIGN KEY (operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Resultados resumidos do processamento CNAB240 com lógica Python';

-- ============================================================================
-- 3. TABELA PARA CÓDIGOS DE BARRAS EXTRAÍDOS COM LÓGICA PYTHON
-- ============================================================================

CREATE TABLE IF NOT EXISTS cnab240_python_codes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    
    -- Referências
    python_result_id BIGINT NOT NULL COMMENT 'Referência ao resultado Python',
    cnab240_segment_id BIGINT NULL COMMENT 'Referência ao segmento original (se aplicável)',
    operation_id VARCHAR(50) NOT NULL COMMENT 'ID da operação',
    
    -- Dados do código de barras
    codigo_barras VARCHAR(60) NOT NULL COMMENT 'Código de barras extraído',
    tipo_codigo ENUM('titulo', 'tributo', 'pix', 'outro') DEFAULT 'titulo' COMMENT 'Tipo do código',
    segmento_origem CHAR(1) DEFAULT 'J' COMMENT 'Segmento de origem (J, O, etc.)',
    
    -- Dados do pagamento
    favorecido VARCHAR(100) COMMENT 'Nome do favorecido',
    pagador VARCHAR(100) COMMENT 'Nome do pagador',
    valor DECIMAL(15,2) DEFAULT 0.00 COMMENT 'Valor do pagamento',
    data_vencimento VARCHAR(8) COMMENT 'Data de vencimento (DDMMAAAA)',
    data_pagamento VARCHAR(8) COMMENT 'Data de pagamento (DDMMAAAA)',
    
    -- Metadados da extração Python
    linha_origem INT COMMENT 'Linha de origem no arquivo CNAB',
    posicao_inicio INT COMMENT 'Posição inicial do código na linha',
    posicao_fim INT COMMENT 'Posição final do código na linha',
    extraction_method VARCHAR(50) DEFAULT 'python_position_based' COMMENT 'Método de extração',
    
    -- Status e validação
    status ENUM('extracted', 'validated', 'processed', 'sent', 'error') DEFAULT 'extracted',
    validation_status ENUM('valid', 'invalid', 'warning') DEFAULT 'valid',
    validation_details JSON COMMENT 'Detalhes da validação do código',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Índices
    INDEX idx_python_result_id (python_result_id),
    INDEX idx_cnab240_segment_id (cnab240_segment_id),
    INDEX idx_operation_id (operation_id),
    INDEX idx_codigo_barras (codigo_barras),
    INDEX idx_tipo_codigo (tipo_codigo),
    INDEX idx_favorecido (favorecido),
    INDEX idx_valor (valor),
    INDEX idx_status (status),
    INDEX idx_validation_status (validation_status),
    
    -- Foreign keys
    FOREIGN KEY (python_result_id) REFERENCES cnab240_python_results(id) ON DELETE CASCADE,
    FOREIGN KEY (cnab240_segment_id) REFERENCES cnab240_segments(id) ON DELETE SET NULL,
    FOREIGN KEY (operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Códigos de barras extraídos com lógica Python posicional';

-- ============================================================================
-- 4. TABELA PARA LOG DE PROCESSAMENTO PYTHON (AUDITORIA)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cnab240_python_processing_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    
    -- Referências
    operation_id VARCHAR(50) NOT NULL COMMENT 'ID da operação',
    python_result_id BIGINT NULL COMMENT 'Referência ao resultado (se criado)',
    
    -- Dados do processamento
    step_name VARCHAR(100) NOT NULL COMMENT 'Nome da etapa do processamento',
    step_order INT NOT NULL COMMENT 'Ordem da etapa',
    step_status ENUM('started', 'completed', 'skipped', 'error') NOT NULL,
    
    -- Detalhes da etapa
    input_data JSON COMMENT 'Dados de entrada da etapa',
    output_data JSON COMMENT 'Dados de saída da etapa',
    error_details JSON COMMENT 'Detalhes de erro (se houver)',
    processing_time_ms INT COMMENT 'Tempo de processamento da etapa',
    
    -- Metadados
    line_number INT COMMENT 'Número da linha sendo processada (se aplicável)',
    segment_type CHAR(1) COMMENT 'Tipo de segmento sendo processado',
    extraction_positions JSON COMMENT 'Posições específicas extraídas',
    
    -- Timestamps
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    
    -- Índices
    INDEX idx_operation_id (operation_id),
    INDEX idx_python_result_id (python_result_id),
    INDEX idx_step_name (step_name),
    INDEX idx_step_status (step_status),
    INDEX idx_step_order (step_order),
    INDEX idx_started_at (started_at),
    
    -- Foreign keys
    FOREIGN KEY (operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE,
    FOREIGN KEY (python_result_id) REFERENCES cnab240_python_results(id) ON DELETE CASCADE
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Log detalhado do processamento Python para auditoria e debugging';

-- ============================================================================
-- 5. VIEWS PARA CONSULTAS OTIMIZADAS
-- ============================================================================

-- View para resumo completo dos arquivos Python
CREATE OR REPLACE VIEW v_cnab240_python_summary AS
SELECT 
    cf.id AS file_id,
    cf.operation_id,
    cf.empresa_nome,
    cf.empresa_documento,
    cf.banco_nome,
    cf.banco_codigo,
    cf.arquivo_sequencia,
    cf.data_geracao,
    cf.total_lotes,
    cf.total_registros,
    cf.valor_total AS valor_total_arquivo,
    
    -- Dados do processamento Python
    pr.id AS python_result_id,
    pr.total_pagamentos,
    pr.valor_total AS valor_total_python,
    pr.valor_medio,
    pr.metodologia,
    pr.python_logic_enabled,
    pr.success_rate,
    pr.warnings_count,
    pr.errors_count,
    
    -- Status e datas
    o.status AS operation_status,
    cf.created_at,
    pr.processing_completed_at,
    
    -- Contadores
    (SELECT COUNT(*) FROM cnab240_segments cs WHERE cs.cnab240_file_id = cf.id AND cs.parsing_method = 'python_logic') AS segments_python_count,
    (SELECT COUNT(*) FROM cnab240_python_codes pc WHERE pc.python_result_id = pr.id) AS codes_extracted_count
    
FROM cnab240_files cf
LEFT JOIN cnab240_python_results pr ON cf.id = pr.cnab240_file_id
LEFT JOIN operations o ON cf.operation_id = o.operation_id
WHERE pr.id IS NOT NULL -- Apenas arquivos processados com Python
ORDER BY cf.created_at DESC;

-- View para pagamentos detalhados com dados Python
CREATE OR REPLACE VIEW v_cnab240_python_payments AS
SELECT 
    cs.id AS segment_id,
    cs.cnab240_file_id,
    cs.operation_id,
    
    -- Dados básicos do segmento
    cs.numero_sequencial,
    cs.segmento_codigo,
    cs.valor_pagamento,
    cs.data_pagamento,
    
    -- Dados do beneficiário
    cs.beneficiario_nome AS favorecido_nome,
    cs.beneficiario_banco AS banco_favorecido,
    cs.beneficiario_documento AS cnpj_favorecido,
    
    -- Dados Python específicos
    cs.pagador_nome,
    cs.pagador_documento AS cnpj_pagador,
    cs.endereco_completo,
    cs.email,
    cs.codigo_movimento,
    cs.codigo_camara,
    cs.documento,
    cs.descontos,
    cs.acrescimos,
    cs.informacoes,
    
    -- Metadados
    cs.parsing_method,
    cs.segment_sequence,
    cs.python_parsing_metadata,
    
    -- Dados do arquivo
    cf.empresa_nome,
    cf.banco_nome,
    cf.data_geracao,
    
    -- Códigos de barras relacionados
    cb.codigo_barras,
    
    cs.created_at
    
FROM cnab240_segments cs
JOIN cnab240_files cf ON cs.cnab240_file_id = cf.id
LEFT JOIN cnab240_codigo_barras cb ON cs.codigo_barras = cb.codigo_barras
WHERE cs.parsing_method IN ('python_logic', 'hybrid')
ORDER BY cf.created_at DESC, cs.numero_sequencial ASC;

-- ============================================================================
-- 6. TRIGGERS PARA MANUTENÇÃO AUTOMÁTICA
-- ============================================================================

-- Trigger para atualizar automaticamente estatísticas do resultado Python
DELIMITER $$

CREATE TRIGGER IF NOT EXISTS update_python_result_stats
    AFTER INSERT ON cnab240_segments
    FOR EACH ROW
BEGIN
    IF NEW.parsing_method IN ('python_logic', 'hybrid') THEN
        UPDATE cnab240_python_results pr
        SET 
            total_pagamentos = (
                SELECT COUNT(*) 
                FROM cnab240_segments cs 
                WHERE cs.cnab240_file_id = pr.cnab240_file_id 
                AND cs.parsing_method IN ('python_logic', 'hybrid')
            ),
            valor_total = (
                SELECT COALESCE(SUM(cs.valor_pagamento), 0) 
                FROM cnab240_segments cs 
                WHERE cs.cnab240_file_id = pr.cnab240_file_id 
                AND cs.parsing_method IN ('python_logic', 'hybrid')
            ),
            updated_at = CURRENT_TIMESTAMP
        WHERE pr.cnab240_file_id = NEW.cnab240_file_id;
        
        -- Atualizar valor médio
        UPDATE cnab240_python_results pr
        SET valor_medio = CASE 
            WHEN pr.total_pagamentos > 0 THEN pr.valor_total / pr.total_pagamentos 
            ELSE 0 
        END
        WHERE pr.cnab240_file_id = NEW.cnab240_file_id;
    END IF;
END$$

DELIMITER ;

-- ============================================================================
-- 7. DADOS DE TESTE E VALIDAÇÃO
-- ============================================================================

-- Inserir dados de teste para validar a estrutura
INSERT IGNORE INTO operations (operation_id, operation_type, status) 
VALUES ('test_python_001', 'cnab240', 'success');

-- Comentário final
SELECT 'Migração para lógica Python concluída com sucesso!' AS status;