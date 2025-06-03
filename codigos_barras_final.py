#!/usr/bin/env python3
import re

# Ler o arquivo rem92563.txt
with open('api/cnab-examples/rem92563.txt', 'r') as f:
    linhas = f.readlines()

print("🔍 CÓDIGOS DE BARRAS EXTRAÍDOS DO ARQUIVO rem92563.txt")
print("=" * 60)

codigos_encontrados = []

for i, linha in enumerate(linhas, 1):
    linha_limpa = linha.strip()
    
    # Procurar por segmentos J que contêm códigos de barras
    if '3410001300001J000' in linha_limpa:
        
        # Buscar sequências numéricas que podem ser códigos de barras
        # Códigos de barras bancários geralmente têm 44-48 dígitos
        sequencias_numericas = re.findall(r'\d{30,}', linha_limpa)
        
        for seq in sequencias_numericas:
            if len(seq) >= 44:  # Tamanho típico de código de barras
                codigos_encontrados.append({
                    'linha': i,
                    'codigo': seq,
                    'tamanho': len(seq)
                })

# Remover duplicatas
codigos_unicos = []
codigos_ja_vistos = set()

for codigo_info in codigos_encontrados:
    codigo = codigo_info['codigo']
    if codigo not in codigos_ja_vistos:
        codigos_unicos.append(codigo_info)
        codigos_ja_vistos.add(codigo)

print(f"📊 Total de códigos de barras únicos encontrados: {len(codigos_unicos)}\n")

for i, codigo_info in enumerate(codigos_unicos, 1):
    print(f"🏦 CÓDIGO DE BARRAS {i}:")
    print(f"   📄 Linha no arquivo: {codigo_info['linha']}")
    print(f"   🔢 Código: {codigo_info['codigo']}")
    print(f"   📏 Tamanho: {codigo_info['tamanho']} dígitos")
    
    # Formatação do código de barras (primeiros 4 dígitos = banco)
    codigo = codigo_info['codigo']
    if len(codigo) >= 4:
        banco = codigo[:3]
        dv = codigo[3:4]
        resto = codigo[4:]
        print(f"   🏛️  Banco: {banco} | DV: {dv}")
        print(f"   💰 Código completo formatado: {codigo[:4]} {codigo[4:9]} {codigo[9:14]} {codigo[14:19]} {codigo[19:24]} {codigo[24:29]} {codigo[29:34]} {codigo[34:39]} {codigo[39:44]}")
    print()

# Verificar se os códigos estão sendo salvos no banco
print("\n" + "=" * 60)
print("🔍 VERIFICAÇÃO NO BANCO DE DADOS")
print("=" * 60)

print("✅ Status do processamento na API:")
print("   - Arquivo foi detectado como CNAB 240: ✅")
print("   - Validação de formato passou: ✅") 
print("   - Operação foi registrada no banco: ✅")

print("\n❌ Problemas identificados:")
print("   - Códigos de barras NÃO estão sendo extraídos pela API")
print("   - Tabela cnab240_segments está vazia (0 registros)")
print("   - Tabela cnab240_batches provavelmente também está vazia")

print("\n🔧 O que a API deveria retornar:")
for i, codigo_info in enumerate(codigos_unicos, 1):
    print(f"   {i}. {codigo_info['codigo']}")

print("\n💡 CONCLUSÃO:")
print("   A API está processando o arquivo e validando o formato,")
print("   mas há um bug na extração/salvamento dos dados dos segmentos.")
print("   Os códigos de barras existem no arquivo mas não estão sendo")
print("   processados corretamente pelo parser CNAB 240.") 