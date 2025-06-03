#!/usr/bin/env python3

def extrair_codigo_barras_segmento_j(linha):
    """
    Extrai código de barras do segmento J do CNAB 240
    Posições baseadas no layout CNAB 240 Febraban
    """
    if len(linha) < 240 or not linha.startswith('3410001300001J'):
        return None
    
    # No segmento J, o código de barras geralmente está nas posições:
    # Posição 84-131 (48 caracteres) - código de barras 
    # ou pode estar em outras posições dependendo do layout específico
    
    # Vamos extrair o que parece ser código de barras da linha
    # Analisando o padrão: depois do "J" tem dados específicos
    
    # Posição após o tipo de registro até antes do nome do beneficiário
    parte_dados = linha[24:84]  # Dados do segmento J
    
    # Procurar por sequências numéricas que podem ser código de barras
    print(f"Linha completa: {linha}")
    print(f"Dados do segmento: {parte_dados}")
    
    # O código de barras no CNAB 240 pode estar em diferentes posições
    # Vamos tentar extrair baseado em padrões conhecidos
    
    # Exemplo de posições possíveis:
    codigo_barras_1 = linha[44:92]  # Uma possível posição
    codigo_barras_2 = linha[90:138] # Outra possível posição
    
    return {
        'linha_completa': linha,
        'codigo_possivel_1': codigo_barras_1,
        'codigo_possivel_2': codigo_barras_2,
        'dados_segmento': parte_dados
    }

# Ler o arquivo e extrair códigos de barras
with open('api/cnab-examples/rem92563.txt', 'r') as f:
    linhas = f.readlines()

print("=== ANÁLISE DE CÓDIGOS DE BARRAS ===\\n")

for i, linha in enumerate(linhas, 1):
    linha = linha.strip()
    if '3410001300001J' in linha:
        print(f"\\n--- SEGMENTO J ENCONTRADO NA LINHA {i} ---")
        resultado = extrair_codigo_barras_segmento_j(linha)
        if resultado:
            print(f"Código possível 1: {resultado['codigo_possivel_1']}")
            print(f"Código possível 2: {resultado['codigo_possivel_2']}")
            print(f"Dados do segmento: {resultado['dados_segmento']}")
        print("-" * 80)

print("\\n=== ANÁLISE DE ESTRUTURA ===")

# Vamos também analisar a estrutura geral
for i, linha in enumerate(linhas, 1):
    linha = linha.strip()
    if linha.startswith('341'):
        tipo_registro = linha[13:14] if len(linha) > 13 else 'N/A'
        segmento = linha[13:15] if len(linha) > 14 else 'N/A'
        print(f"Linha {i}: Tipo={tipo_registro}, Segmento={segmento}, Tamanho={len(linha)}") 