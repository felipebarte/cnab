#!/usr/bin/env node

/**
 * Script de Validação: Uso Correto do WebhookService
 * 
 * Este script verifica se todos os controllers estão usando o método correto
 * do WebhookService (enviarParaWebhook) e não o método incorreto (enviarDados).
 * 
 * Uso: node scripts/validate-webhook-usage.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurações
const CONFIG = {
  controllersDir: path.join(__dirname, '../src/controllers'),
  metodoCorreto: 'enviarParaWebhook',
  metodosIncorretos: ['enviarDados'],
  serviceName: 'WebhookService',
  extensions: ['.js']
};

// Cores para output no terminal
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

/**
 * Busca arquivos recursivamente em um diretório
 */
function findFiles(dir, extensions) {
  const files = [];

  function searchDir(currentDir) {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        searchDir(fullPath);
      } else if (extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }

  searchDir(dir);
  return files;
}

/**
 * Analisa um arquivo em busca de uso incorreto do WebhookService
 */
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];
  const validUsages = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmedLine = line.trim();

    // Verifica uso do WebhookService
    if (trimmedLine.includes(CONFIG.serviceName)) {
      // Verifica métodos incorretos
      CONFIG.metodosIncorretos.forEach(metodoIncorreto => {
        if (trimmedLine.includes(`${CONFIG.serviceName}.${metodoIncorreto}`)) {
          issues.push({
            type: 'incorrect_method',
            line: lineNumber,
            content: trimmedLine,
            method: metodoIncorreto,
            suggestion: `Use ${CONFIG.serviceName}.${CONFIG.metodoCorreto}() em vez de ${CONFIG.serviceName}.${metodoIncorreto}()`
          });
        }
      });

      // Verifica uso correto
      if (trimmedLine.includes(`${CONFIG.serviceName}.${CONFIG.metodoCorreto}`)) {
        validUsages.push({
          line: lineNumber,
          content: trimmedLine
        });
      }
    }
  });

  return { issues, validUsages };
}

/**
 * Valida a ordem dos parâmetros em chamadas do WebhookService
 */
function validateParameterOrder(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const warnings = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmedLine = line.trim();

    // Procura por chamadas do método correto
    if (trimmedLine.includes(`${CONFIG.serviceName}.${CONFIG.metodoCorreto}`)) {
      // Verifica se parece que os parâmetros estão na ordem errada
      // (heurística: se o primeiro parâmetro parece ser uma URL)
      const match = trimmedLine.match(/enviarParaWebhook\s*\(\s*([^,]+)/);
      if (match) {
        const firstParam = match[1].trim();
        if (firstParam.includes('http') || firstParam.includes('webhook') || firstParam.includes('Url')) {
          warnings.push({
            type: 'parameter_order',
            line: lineNumber,
            content: trimmedLine,
            suggestion: 'Verifique se os parâmetros estão na ordem correta: enviarParaWebhook(dadosCnab, webhookUrl)'
          });
        }
      }
    }
  });

  return warnings;
}

/**
 * Função principal de validação
 */
function validateWebhookUsage() {
  console.log(`${colors.bold}${colors.blue}🔍 Validando uso do WebhookService...${colors.reset}\n`);

  // Verifica se o diretório de controllers existe
  if (!fs.existsSync(CONFIG.controllersDir)) {
    console.log(`${colors.red}❌ Diretório de controllers não encontrado: ${CONFIG.controllersDir}${colors.reset}`);
    process.exit(1);
  }

  // Busca todos os arquivos de controller
  const controllerFiles = findFiles(CONFIG.controllersDir, CONFIG.extensions);

  if (controllerFiles.length === 0) {
    console.log(`${colors.yellow}⚠️  Nenhum arquivo de controller encontrado${colors.reset}`);
    return;
  }

  console.log(`📁 Analisando ${controllerFiles.length} arquivo(s) de controller...\n`);

  let totalIssues = 0;
  let totalWarnings = 0;
  let totalValidUsages = 0;

  // Analisa cada arquivo
  controllerFiles.forEach(filePath => {
    const relativePath = path.relative(process.cwd(), filePath);
    const { issues, validUsages } = analyzeFile(filePath);
    const warnings = validateParameterOrder(filePath);

    if (issues.length > 0 || warnings.length > 0 || validUsages.length > 0) {
      console.log(`📄 ${colors.bold}${relativePath}${colors.reset}`);

      // Mostra usos corretos
      if (validUsages.length > 0) {
        console.log(`  ${colors.green}✅ ${validUsages.length} uso(s) correto(s) encontrado(s)${colors.reset}`);
        totalValidUsages += validUsages.length;
      }

      // Mostra problemas críticos
      if (issues.length > 0) {
        issues.forEach(issue => {
          console.log(`  ${colors.red}❌ Linha ${issue.line}: ${issue.suggestion}${colors.reset}`);
          console.log(`     ${colors.red}Código: ${issue.content}${colors.reset}`);
        });
        totalIssues += issues.length;
      }

      // Mostra avisos
      if (warnings.length > 0) {
        warnings.forEach(warning => {
          console.log(`  ${colors.yellow}⚠️  Linha ${warning.line}: ${warning.suggestion}${colors.reset}`);
          console.log(`     ${colors.yellow}Código: ${warning.content}${colors.reset}`);
        });
        totalWarnings += warnings.length;
      }

      console.log('');
    }
  });

  // Resumo final
  console.log(`${colors.bold}📊 Resumo da Validação:${colors.reset}`);
  console.log(`  ${colors.green}✅ Usos corretos: ${totalValidUsages}${colors.reset}`);
  console.log(`  ${colors.yellow}⚠️  Avisos: ${totalWarnings}${colors.reset}`);
  console.log(`  ${colors.red}❌ Problemas críticos: ${totalIssues}${colors.reset}`);

  if (totalIssues > 0) {
    console.log(`\n${colors.red}${colors.bold}💥 FALHA: Encontrados ${totalIssues} problema(s) crítico(s)!${colors.reset}`);
    console.log(`${colors.red}Por favor, corrija os problemas antes de continuar.${colors.reset}`);
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log(`\n${colors.yellow}${colors.bold}⚠️  ATENÇÃO: Encontrados ${totalWarnings} aviso(s).${colors.reset}`);
    console.log(`${colors.yellow}Recomenda-se revisar os avisos.${colors.reset}`);
  } else {
    console.log(`\n${colors.green}${colors.bold}🎉 SUCESSO: Todos os usos do WebhookService estão corretos!${colors.reset}`);
  }
}

/**
 * Mostra informações de ajuda
 */
function showHelp() {
  console.log(`${colors.bold}🔗 Validador de Uso do WebhookService${colors.reset}

${colors.bold}Uso:${colors.reset}
  node scripts/validate-webhook-usage.js

${colors.bold}Descrição:${colors.reset}
  Este script verifica se todos os controllers estão usando o método correto
  do WebhookService e detecta possíveis problemas de implementação.

${colors.bold}Verificações realizadas:${colors.reset}
  ✅ Uso do método correto: ${CONFIG.metodoCorreto}()
  ❌ Uso de métodos incorretos: ${CONFIG.metodosIncorretos.join(', ')}
  ⚠️  Ordem dos parâmetros suspeita

${colors.bold}Códigos de saída:${colors.reset}
  0 - Sucesso (sem problemas críticos)
  1 - Falha (problemas críticos encontrados)

${colors.bold}Exemplo de uso correto:${colors.reset}
  ${colors.green}await WebhookService.enviarParaWebhook(dadosCnab, webhookUrl);${colors.reset}

${colors.bold}Exemplo de uso incorreto:${colors.reset}
  ${colors.red}await WebhookService.enviarDados(webhookUrl, dadosCnab);${colors.reset}
`);
}

// Execução principal
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp();
} else {
  validateWebhookUsage();
} 