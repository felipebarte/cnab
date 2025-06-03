-- Configurações iniciais do banco CNAB
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Usar o banco criado automaticamente
USE cnab_database;

-- ============================================================================
-- TABELAS PRINCIPAIS DO SISTEMA CNAB
-- Schema baseado nas APIs existentes e estrutura de retorno
-- ============================================================================

-- Tabela de operações/processamentos (auditoria de todas as operações)
CREATE TABLE operations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    operation_id VARCHAR(50) NOT NULL UNIQUE COMMENT 'ID único da operação (UUID)',
    operation_type ENUM('cnab400', 'cnab240', 'validation', 'webhook') NOT NULL COMMENT 'Tipo de operação',
    status ENUM('started', 'processing', 'success', 'error') NOT NULL DEFAULT 'started',
    request_data JSON COMMENT 'Dados da requisição (metadata)',
    response_data JSON COMMENT 'Dados da resposta',
    error_details JSON COMMENT 'Detalhes de erro se houver',
    processing_time_ms INT COMMENT 'Tempo de processamento em millisegundos',
    user_agent TEXT COMMENT 'User agent da requisição',
    ip_address VARCHAR(45) COMMENT 'IP da requisição',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_operation_id (operation_id),
    INDEX idx_operation_type (operation_type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de arquivos processados (genérica)
CREATE TABLE files (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    operation_id VARCHAR(50) NOT NULL COMMENT 'Referência à operação',
    file_hash VARCHAR(64) NOT NULL COMMENT 'Hash SHA-256 do conteúdo',
    file_name VARCHAR(255) COMMENT 'Nome original do arquivo',
    file_size BIGINT COMMENT 'Tamanho do arquivo em bytes',
    file_type ENUM('cnab400', 'cnab240') NOT NULL COMMENT 'Tipo do arquivo',
    content_preview TEXT COMMENT 'Primeiras linhas do arquivo',
    validation_status ENUM('valid', 'invalid', 'warning') DEFAULT 'valid',
    validation_details JSON COMMENT 'Detalhes da validação',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_file_hash (file_hash),
    INDEX idx_operation_id (operation_id),
    INDEX idx_file_type (file_type),
    INDEX idx_validation_status (validation_status),
    FOREIGN KEY (operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABELAS ESPECÍFICAS CNAB 400 (Itaú)
-- ============================================================================

-- Tabela de cabeçalhos CNAB 400
CREATE TABLE cnab_headers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    file_id BIGINT NOT NULL COMMENT 'Referência ao arquivo',
    operation_id VARCHAR(50) NOT NULL,
    banco_codigo VARCHAR(10) COMMENT 'Código do banco',
    banco_nome VARCHAR(100) COMMENT 'Nome do banco',
    empresa_codigo VARCHAR(20) COMMENT 'Código da empresa',
    empresa_nome VARCHAR(100) COMMENT 'Nome da empresa',
    arquivo_sequencia INT COMMENT 'Sequência do arquivo',
    data_arquivo DATE COMMENT 'Data do arquivo',
    versao_layout VARCHAR(10) COMMENT 'Versão do layout',
    registro_tipo CHAR(1) DEFAULT '0' COMMENT 'Tipo do registro (0=cabeçalho)',
    dados_completos JSON COMMENT 'Todos os dados do cabeçalho',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_file_id (file_id),
    INDEX idx_operation_id (operation_id),
    INDEX idx_banco_codigo (banco_codigo),
    INDEX idx_data_arquivo (data_arquivo),
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de registros CNAB 400
CREATE TABLE cnab_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    file_id BIGINT NOT NULL COMMENT 'Referência ao arquivo',
    operation_id VARCHAR(50) NOT NULL,
    header_id BIGINT NOT NULL COMMENT 'Referência ao cabeçalho',
    registro_sequencia INT COMMENT 'Sequência do registro',
    registro_tipo CHAR(1) COMMENT 'Tipo do registro (1=detalhe, 9=trailer)',
    
    -- Dados principais do boleto/pagamento
    nosso_numero VARCHAR(50) COMMENT 'Nosso número',
    seu_numero VARCHAR(50) COMMENT 'Número do documento',
    codigo_barras VARCHAR(60) COMMENT 'Código de barras',
    linha_digitavel VARCHAR(60) COMMENT 'Linha digitável',
    valor_titulo DECIMAL(15,2) COMMENT 'Valor do título',
    valor_pago DECIMAL(15,2) COMMENT 'Valor pago',
    data_vencimento DATE COMMENT 'Data de vencimento',
    data_pagamento DATE COMMENT 'Data do pagamento',
    
    -- Dados do pagador
    pagador_nome VARCHAR(100) COMMENT 'Nome do pagador',
    pagador_documento VARCHAR(20) COMMENT 'CPF/CNPJ do pagador',
    
    -- Status e códigos
    codigo_ocorrencia VARCHAR(10) COMMENT 'Código da ocorrência',
    descricao_ocorrencia VARCHAR(200) COMMENT 'Descrição da ocorrência',
    codigo_banco VARCHAR(10) COMMENT 'Código do banco',
    agencia VARCHAR(10) COMMENT 'Agência',
    conta VARCHAR(20) COMMENT 'Conta',
    
    -- Dados completos em JSON
    dados_completos JSON COMMENT 'Todos os dados do registro',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_file_id (file_id),
    INDEX idx_operation_id (operation_id),
    INDEX idx_header_id (header_id),
    INDEX idx_nosso_numero (nosso_numero),
    INDEX idx_seu_numero (seu_numero),
    INDEX idx_codigo_barras (codigo_barras),
    INDEX idx_data_vencimento (data_vencimento),
    INDEX idx_data_pagamento (data_pagamento),
    INDEX idx_codigo_ocorrencia (codigo_ocorrencia),
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE,
    FOREIGN KEY (header_id) REFERENCES cnab_headers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABELAS ESPECÍFICAS CNAB 240
-- ============================================================================

-- Tabela de arquivos CNAB 240
CREATE TABLE cnab240_files (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    file_id BIGINT NOT NULL COMMENT 'Referência ao arquivo base',
    operation_id VARCHAR(50) NOT NULL,
    
    -- Dados do header do arquivo
    banco_codigo VARCHAR(10) COMMENT 'Código do banco (341, 001, etc.)',
    banco_nome VARCHAR(100) COMMENT 'Nome do banco',
    arquivo_sequencia INT COMMENT 'Sequência do arquivo',
    data_geracao DATE COMMENT 'Data de geração',
    hora_geracao TIME COMMENT 'Hora de geração',
    versao_layout VARCHAR(10) COMMENT 'Versão do layout',
    densidade VARCHAR(20) COMMENT 'Densidade do arquivo',
    
    -- Dados da empresa
    empresa_tipo_pessoa CHAR(1) COMMENT '1=Pessoa Física, 2=Pessoa Jurídica',
    empresa_documento VARCHAR(20) COMMENT 'CPF/CNPJ da empresa',
    empresa_nome VARCHAR(100) COMMENT 'Nome da empresa',
    empresa_codigo VARCHAR(20) COMMENT 'Código da empresa no banco',
    
    -- Totalizadores e resumos
    total_lotes INT DEFAULT 0 COMMENT 'Total de lotes',
    total_registros INT DEFAULT 0 COMMENT 'Total de registros',
    valor_total DECIMAL(15,2) DEFAULT 0.00 COMMENT 'Valor total do arquivo',
    
    -- Dados completos do header e trailer
    header_dados JSON COMMENT 'Dados completos do header',
    trailer_dados JSON COMMENT 'Dados completos do trailer',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_file_id (file_id),
    INDEX idx_operation_id (operation_id),
    INDEX idx_banco_codigo (banco_codigo),
    INDEX idx_empresa_documento (empresa_documento),
    INDEX idx_data_geracao (data_geracao),
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de lotes CNAB 240
CREATE TABLE cnab240_batches (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    cnab240_file_id BIGINT NOT NULL COMMENT 'Referência ao arquivo CNAB 240',
    operation_id VARCHAR(50) NOT NULL,
    
    -- Identificação do lote
    lote_numero INT COMMENT 'Número do lote',
    lote_tipo VARCHAR(10) COMMENT 'Tipo do lote (PIX, TED, etc.)',
    forma_lancamento VARCHAR(10) COMMENT 'Forma de lançamento',
    
    -- Dados da empresa para este lote
    empresa_tipo_pessoa CHAR(1) COMMENT '1=PF, 2=PJ',
    empresa_documento VARCHAR(20) COMMENT 'CPF/CNPJ',
    empresa_nome VARCHAR(100) COMMENT 'Nome/Razão Social',
    
    -- Dados bancários
    agencia VARCHAR(10) COMMENT 'Agência',
    agencia_dv CHAR(1) COMMENT 'DV da agência',
    conta VARCHAR(20) COMMENT 'Conta',
    conta_dv CHAR(1) COMMENT 'DV da conta',
    
    -- Totalizadores do lote
    quantidade_registros INT DEFAULT 0 COMMENT 'Quantidade de registros no lote',
    valor_total DECIMAL(15,2) DEFAULT 0.00 COMMENT 'Valor total do lote',
    quantidade_moedas BIGINT DEFAULT 0 COMMENT 'Quantidade de moedas',
    
    -- Status e datas
    data_operacao DATE COMMENT 'Data da operação',
    data_credito DATE COMMENT 'Data de crédito',
    
    -- Dados completos do header e trailer do lote
    header_lote_dados JSON COMMENT 'Dados do header do lote',
    trailer_lote_dados JSON COMMENT 'Dados do trailer do lote',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_cnab240_file_id (cnab240_file_id),
    INDEX idx_operation_id (operation_id),
    INDEX idx_lote_numero (lote_numero),
    INDEX idx_lote_tipo (lote_tipo),
    INDEX idx_empresa_documento (empresa_documento),
    INDEX idx_data_operacao (data_operacao),
    FOREIGN KEY (cnab240_file_id) REFERENCES cnab240_files(id) ON DELETE CASCADE,
    FOREIGN KEY (operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de segmentos CNAB 240
CREATE TABLE cnab240_segments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    batch_id BIGINT NOT NULL COMMENT 'Referência ao lote',
    operation_id VARCHAR(50) NOT NULL,
    
    -- Identificação do segmento
    segmento_tipo CHAR(1) COMMENT 'A, B, C, J, etc.',
    segmento_sequencia INT COMMENT 'Sequência do segmento',
    registro_numero INT COMMENT 'Número do registro no lote',
    
    -- Dados do pagamento/transferência
    codigo_movimento VARCHAR(10) COMMENT 'Código do movimento',
    codigo_instrucao VARCHAR(10) COMMENT 'Código da instrução',
    
    -- Dados do favorecido/destinatário
    favorecido_banco VARCHAR(10) COMMENT 'Código do banco do favorecido',
    favorecido_agencia VARCHAR(10) COMMENT 'Agência do favorecido',
    favorecido_agencia_dv CHAR(1) COMMENT 'DV da agência',
    favorecido_conta VARCHAR(20) COMMENT 'Conta do favorecido',
    favorecido_conta_dv CHAR(1) COMMENT 'DV da conta',
    favorecido_nome VARCHAR(100) COMMENT 'Nome do favorecido',
    favorecido_documento VARCHAR(20) COMMENT 'CPF/CNPJ do favorecido',
    
    -- Valores e datas
    valor_operacao DECIMAL(15,2) COMMENT 'Valor da operação',
    data_operacao DATE COMMENT 'Data da operação',
    data_efetivacao DATE COMMENT 'Data de efetivação',
    
    -- PIX específico (quando aplicável)
    chave_pix VARCHAR(100) COMMENT 'Chave PIX (quando for PIX)',
    tipo_chave_pix VARCHAR(20) COMMENT 'Tipo da chave PIX',
    
    -- Informações adicionais
    finalidade_ted VARCHAR(10) COMMENT 'Finalidade TED',
    numero_documento VARCHAR(50) COMMENT 'Número do documento',
    codigo_barras VARCHAR(60) COMMENT 'Código de barras (quando aplicável)',
    
    -- Dados completos do segmento
    dados_completos JSON COMMENT 'Todos os dados do segmento',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_batch_id (batch_id),
    INDEX idx_operation_id (operation_id),
    INDEX idx_segmento_tipo (segmento_tipo),
    INDEX idx_favorecido_documento (favorecido_documento),
    INDEX idx_chave_pix (chave_pix),
    INDEX idx_valor_operacao (valor_operacao),
    INDEX idx_data_operacao (data_operacao),
    INDEX idx_codigo_barras (codigo_barras),
    FOREIGN KEY (batch_id) REFERENCES cnab240_batches(id) ON DELETE CASCADE,
    FOREIGN KEY (operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABELAS DE AUDITORIA E LOGS
-- ============================================================================

-- Tabela de logs de auditoria
CREATE TABLE audit_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    table_name VARCHAR(50) NOT NULL COMMENT 'Nome da tabela afetada',
    record_id BIGINT COMMENT 'ID do registro afetado',
    operation_type ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    old_values JSON COMMENT 'Valores anteriores (UPDATE/DELETE)',
    new_values JSON COMMENT 'Valores novos (INSERT/UPDATE)',
    user_id VARCHAR(50) COMMENT 'ID do usuário (quando disponível)',
    operation_id VARCHAR(50) COMMENT 'ID da operação relacionada',
    ip_address VARCHAR(45) COMMENT 'IP de origem',
    user_agent TEXT COMMENT 'User agent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_table_name (table_name),
    INDEX idx_record_id (record_id),
    INDEX idx_operation_type (operation_type),
    INDEX idx_operation_id (operation_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TRIGGERS PARA AUDITORIA AUTOMÁTICA
-- ============================================================================

-- Procedure para log de auditoria
DELIMITER $$
CREATE PROCEDURE log_audit(
    IN p_table_name VARCHAR(50),
    IN p_record_id BIGINT,
    IN p_operation_type VARCHAR(10),
    IN p_old_values JSON,
    IN p_new_values JSON,
    IN p_operation_id VARCHAR(50)
)
BEGIN
    INSERT INTO audit_logs (
        table_name, record_id, operation_type, 
        old_values, new_values, operation_id
    ) VALUES (
        p_table_name, p_record_id, p_operation_type,
        p_old_values, p_new_values, p_operation_id
    );
END$$
DELIMITER ;

-- ============================================================================
-- CONFIGURAÇÕES FINAIS
-- ============================================================================

-- Inserir dados iniciais se necessário
INSERT INTO operations (operation_id, operation_type, status, request_data) 
VALUES ('SYSTEM_INIT', 'validation', 'success', '{"message": "Database initialized successfully"}');

-- Mostrar estrutura criada
SELECT 'Database tables created successfully!' as status;
SHOW TABLES; 