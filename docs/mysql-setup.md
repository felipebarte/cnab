# Configuração MySQL para Sistema CNAB

## Variáveis de Ambiente Necessárias

Adicione estas variáveis ao arquivo `.env` na raiz da pasta `api`:

```bash
# ============================================================================
# CONFIGURAÇÕES DO BANCO DE DADOS MYSQL
# ============================================================================

# Configurações de conexão MySQL
DB_HOST=database
DB_PORT=3306
DB_NAME=cnab_database
DB_USER=cnab_user
DB_PASSWORD=cnab_pass_2024
DB_CHARSET=utf8mb4
DB_TIMEZONE=+00:00

# Configurações do pool de conexões
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_POOL_ACQUIRE=30000
DB_POOL_IDLE=10000

# Sequelize logging (true para ver queries SQL em desenvolvimento)
DB_LOGGING=true
```

## Como Inicializar o Sistema

1. **Parar containers existentes:**
   ```bash
   docker-compose down
   ```

2. **Construir e iniciar com MySQL:**
   ```bash
   docker-compose up --build -d
   ```

3. **Verificar se o MySQL está rodando:**
   ```bash
   docker logs cnab-mysql
   ```

4. **Verificar se as tabelas foram criadas:**
   ```bash
   docker exec -it cnab-mysql mysql -u cnab_user -pcnab_pass_2024 cnab_database -e "SHOW TABLES;"
   ```

## Estrutura do Banco de Dados

### Tabelas Criadas:
- `operations` - Auditoria de operações
- `files` - Arquivos processados
- `cnab_headers` - Cabeçalhos CNAB 400
- `cnab_records` - Registros CNAB 400
- `cnab240_files` - Arquivos CNAB 240 completos
- `audit_logs` - Logs de auditoria automática

### Relacionamentos:
- Uma `operation` pode ter vários `files`
- Um `file` pode ter um `cnab_header` e vários `cnab_records`
- Um `file` pode ter um `cnab240_file`
- Um `cnab_header` pode ter vários `cnab_records`

## Modelos Sequelize Disponíveis

### Principais:
- `Operation.js` - Gerenciamento de operações
- `File.js` - Gestão de arquivos com validação de hash
- `CnabHeader.js` - Cabeçalhos CNAB 400
- `CnabRecord.js` - Registros CNAB 400 com dados de boletos
- `Cnab240File.js` - Arquivos CNAB 240 completos

### Funcionalidades dos Modelos:
- Validações robustas
- Métodos de busca especializados
- Hooks para auditoria
- Parsing automático de dados CNAB
- Formatação de retorno para APIs

## Comandos Úteis

### Acessar MySQL diretamente:
```bash
docker exec -it cnab-mysql mysql -u cnab_user -pcnab_pass_2024 cnab_database
```

### Ver logs do MySQL:
```bash
docker logs -f cnab-mysql
```

### Backup do banco:
```bash
docker exec cnab-mysql mysqldump -u cnab_user -pcnab_pass_2024 cnab_database > backup.sql
```

### Restaurar backup:
```bash
docker exec -i cnab-mysql mysql -u cnab_user -pcnab_pass_2024 cnab_database < backup.sql
```

## Resolução de Problemas

### MySQL não inicia:
1. Verificar logs: `docker logs cnab-mysql`
2. Verificar se a porta 3306 não está ocupada: `netstat -tlnp | grep 3306`
3. Remover volumes e recriar: `docker-compose down -v && docker-compose up --build`

### Conexão da API falha:
1. Verificar se o service `database` está no `depends_on` da API
2. Verificar variáveis de ambiente no container da API
3. Verificar se o MySQL está pronto para aceitar conexões 