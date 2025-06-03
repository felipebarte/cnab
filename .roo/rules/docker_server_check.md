---
description:
globs:
alwaysApply: false
---
# Roo Code Rules - Verificação de Servidores Docker Ativos

## 🐳 REGRA CRÍTICA: VERIFICAR CONTAINERS DOCKER ANTES DE AÇÕES

## 📝 REGRA OBRIGATÓRIA: USAR "docker compose" NÃO "docker-compose"

**SEMPRE** use `docker compose` (com espaço) em vez de `docker-compose` (com hífen):

- ✅ **CORRETO:** `docker compose up`, `docker compose down`, `docker compose ps`
- ❌ **INCORRETO:** `docker-compose up`, `docker-compose down`, `docker-compose ps`

### Justificativa
- `docker compose` é o comando nativo moderno do Docker CLI
- `docker-compose` é o comando legado que requer instalação separada
- Melhor integração com outras funcionalidades do Docker
- Padrão recomendado pela documentação oficial do Docker

### Verificação Obrigatória Antes de Comandos Docker

**SEMPRE** execute estas verificações antes de sugerir qualquer comando Docker:

1. **Verificar containers em execução:**
   ```bash
   docker ps
   ```

2. **Verificar containers específicos do projeto:**
   ```bash
   docker compose ps
   ```

3. **Verificar portas Docker em uso:**
   ```bash
   docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
   ```

4. **Verificar uso de recursos:**
   ```bash
   docker stats --no-stream
   ```

### Comportamento Obrigatório

- ❌ **NUNCA** execute `docker compose up` se containers já estiverem rodando
- ❌ **NUNCA** sugira recriar containers sem verificar estado atual
- ❌ **NUNCA** force restart sem avisar sobre perda de dados temporários
- ❌ **NUNCA** use `docker-compose` (com hífen) - sempre use `docker compose`
- ✅ **SEMPRE** informe sobre containers ativos encontrados
- ✅ **SEMPRE** pergunte se o usuário deseja parar containers antes de novos comandos
- ✅ **SEMPRE** ofereça comandos específicos para gerenciar containers ativos
- ✅ **SEMPRE** use `docker compose` (com espaço) em todos os comandos

### Comandos de Verificação Essenciais

```bash
# Verificar todos os containers
docker ps -a

# Verificar containers do projeto atual
docker compose ps -a

# Verificar logs de containers específicos
docker compose logs [service_name]

# Verificar portas em uso por containers
docker port [container_name]

# Verificar redes Docker
docker network ls
```

### Comandos de Gerenciamento Seguro

```bash
# Parar containers graciosamente
docker compose down

# Parar containers mantendo volumes
docker compose stop

# Reiniciar containers específicos
docker compose restart [service_name]

# Parar container específico
docker stop [container_id]

# Remover containers parados
docker container prune
```

### Verificações de Estado Específicas

- **Containers com banco de dados:** Verificar se há dados não persistidos
- **Containers de desenvolvimento:** Verificar se há alterações não salvas
- **Containers com volumes:** Verificar mapeamento de volumes antes de parar
- **Containers em rede:** Verificar dependências entre serviços

### Exemplo de Verificação Completa

```bash
# Script de verificação completa
echo "🐳 Verificando estado do Docker..."
echo "Containers em execução:"
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

echo -e "\n📊 Uso de recursos:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo -e "\n🔧 Status do docker compose:"
if [ -f docker-compose.yml ]; then
    docker compose ps
else
    echo "Nenhum docker-compose.yml encontrado"
fi
```

### Mensagem Padrão ao Detectar Containers Ativos

"🐳 **CONTAINERS DOCKER ATIVOS DETECTADOS!**
Encontrei containers em execução neste projeto:

[Lista dos containers]

Para evitar conflitos e perda de dados:
1. Revise o estado atual dos containers
2. Salve dados importantes se necessário  
3. Pare containers com: `docker compose down`
4. Ou gerencie containers específicos: `docker stop [container]`

Deseja que eu ajude a gerenciar os containers ativos?"

### Cenários Especiais

- **Banco de dados em container:** Sempre alertar sobre backup antes de parar
- **Aplicação com hot-reload:** Verificar se desenvolvimento está em andamento
- **Containers com volumes:** Verificar mapeamento antes de remover
- **Multi-stage builds:** Verificar dependências entre containers

### Comandos Proibidos sem Verificação

```bash
# ❌ Comandos perigosos sem verificação
docker compose up --force-recreate
docker compose down -v  # Remove volumes
docker system prune -f  # Remove tudo forçadamente
docker rm -f $(docker ps -aq)  # Remove todos containers

# ❌ Comandos com sintaxe incorreta
docker-compose up    # Use: docker compose up
docker-compose down  # Use: docker compose down
docker-compose ps    # Use: docker compose ps
```

### Migração de Comandos Legados

Se encontrar `docker-compose` em scripts ou documentação, sempre sugerir a atualização:

```bash
# ❌ Sintaxe antiga
docker-compose up -d
docker-compose logs app
docker-compose exec app bash

# ✅ Sintaxe moderna
docker compose up -d
docker compose logs app
docker compose exec app bash
```

### Integração com Regras Existentes

Esta regra complementa as [regras de gerenciamento de servidor ativo](mdc:.roo/rules/cursor_rules.md) para o ambiente Docker, seguindo os mesmos princípios de verificação prévia e gestão segura de recursos.
