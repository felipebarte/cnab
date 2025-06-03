#!/usr/bin/env python3

# Ler o arquivo linha por linha
with open('api/cnab-examples/rem92563.txt', 'r') as f:
    linhas = f.readlines()

print("=== ANÁLISE DETALHADA DOS SEGMENTOS J ===\n")

# Procurar especificamente por linhas que contêm segmento J
segmentos_j = []
for i, linha in enumerate(linhas, 1):
    linha_limpa = linha.strip()
    if 'J000' in linha_limpa:  # Identificador do segmento J
        segmentos_j.append((i, linha_limpa))

print(f"Encontrados {len(segmentos_j)} segmentos J:\n")

for linha_num, linha in segmentos_j:
    print(f"Linha {linha_num}: {linha}")
    print(f"Tamanho: {len(linha)} caracteres")
    
    # Analisando a estrutura específica dos segmentos J
    # No CNAB 240, os códigos de barras estão em posições específicas
    if len(linha) >= 100:  # Verificar se tem tamanho mínimo
        
        # Extrair partes específicas que podem conter código de barras
        # Baseado no layout CNAB 240 do Itaú
        
        # Possíveis códigos de barras em diferentes posições:
        codigo1 = linha[27:75] if len(linha) > 75 else ""  # Posição comum para código de barras
        codigo2 = linha[75:123] if len(linha) > 123 else ""  # Outra posição possível
        
        print(f"  Código possível 1: '{codigo1}'")
        print(f"  Código possível 2: '{codigo2}'")
        
        # Procurar por sequências numéricas longas que podem ser códigos de barras
        import re
        codigos_numericos = re.findall(r'\d{10,}', linha)
        print(f"  Sequências numéricas longas: {codigos_numericos}")
        
    print("-" * 80)

print("\n=== EXTRAÇÃO ESPECÍFICA DE CÓDIGOS DE BARRAS ===")

# Baseado na análise das linhas, vamos extrair os códigos específicos
for linha_num, linha in segmentos_j:
    if "3410001300001J000" in linha:
        print(f"\nLinha {linha_num} - Segmento J Principal:")
        
        # No layout CNAB 240 Itaú, vamos tentar extrair o código de barras
        # Posições podem variar, mas geralmente estão após identificadores específicos
        
        # Verificar se tem padrão de código de barras
        import re
        
        # Procurar por código de barras padrão (sequência de 44-48 dígitos)
        padrao_codigo_barras = re.search(r'\d{44,48}', linha)
        if padrao_codigo_barras:
            codigo_encontrado = padrao_codigo_barras.group()
            print(f"  ✅ CÓDIGO DE BARRAS ENCONTRADO: {codigo_encontrado}")
            print(f"  📍 Posição: {padrao_codigo_barras.start()}-{padrao_codigo_barras.end()}")
        else:
            print("  ❌ Código de barras padrão não encontrado")
            
        # Procurar outras sequências relevantes
        sequencias = re.findall(r'\d{10,}', linha)
        for seq in sequencias:
            if len(seq) >= 20:  # Códigos de barras geralmente têm 44+ dígitos
                print(f"  🔍 Sequência candidata: {seq} (tamanho: {len(seq)})")

print("\n=== RESUMO DOS CÓDIGOS DE BARRAS EXTRAÍDOS ===")

codigos_extraidos = []
for linha_num, linha in segmentos_j:
    if "3410001300001J000" in linha:
        import re
        padrao_codigo_barras = re.search(r'\d{44,48}', linha)
        if padrao_codigo_barras:
            codigo = padrao_codigo_barras.group()
            codigos_extraidos.append({
                'linha': linha_num,
                'codigo': codigo,
                'tamanho': len(codigo)
            })

print(f"Total de códigos de barras extraídos: {len(codigos_extraidos)}")
for i, codigo_info in enumerate(codigos_extraidos, 1):
    print(f"{i}. Linha {codigo_info['linha']}: {codigo_info['codigo']} ({codigo_info['tamanho']} dígitos)") 