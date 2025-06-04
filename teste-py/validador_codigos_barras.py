#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Validador de Códigos de Barras CNAB
Analisa se os códigos extraídos estão no formato correto
"""

def validar_codigo_barras(codigo):
    """
    Valida se um código está no formato correto de código de barras
    """
    print(f"Analisando código: {codigo}")
    print(f"Tamanho: {len(codigo)} dígitos")
    
    # Código de barras bancário deve ter 44 dígitos
    if len(codigo) != 44:
        print(f"❌ ERRO: Código de barras deve ter 44 dígitos, encontrado {len(codigo)}")
        return False
    
    # Primeiro dígito deve ser o código do banco (3 dígitos)
    banco = codigo[:3]
    print(f"Banco: {banco}")
    
    # Quarto dígito é o código da moeda (geralmente 9 para Real)
    moeda = codigo[3]
    print(f"Moeda: {moeda}")
    
    # Quinto dígito é o dígito verificador
    dv = codigo[4]
    print(f"Dígito Verificador: {dv}")
    
    # Posições 5-8: Fator de vencimento
    fator_venc = codigo[5:9]
    print(f"Fator Vencimento: {fator_venc}")
    
    # Posições 9-18: Valor (10 dígitos)
    valor_codigo = codigo[9:19]
    print(f"Valor no código: {valor_codigo}")
    
    # Posições 19-44: Campo livre (25 dígitos)
    campo_livre = codigo[19:44]
    print(f"Campo Livre: {campo_livre}")
    
    return True

def analisar_todos_codigos():
    """
    Analisa todos os códigos extraídos do CNAB
    """
    print("=" * 80)
    print("VALIDAÇÃO DOS CÓDIGOS DE BARRAS EXTRAÍDOS")
    print("=" * 80)
    
    # Códigos extraídos do arquivo CNAB
    codigos = [
        "46191110300005400001110000000000314879550",  # Lucas
        "77911103000079620000011120227789903032792",  # Leandro
        "32997110000013322660001090000900513700796",  # Plugify 1
        "32991110300000121460001090000900529000796",  # Plugify 2
        "40391110400002500000000055738446013575957",  # Popu
        "77921103000075000000011120870652903018725",  # Warun
        "40399109700010154260000050236609013511441",  # AIG
        "23792109700000818643369090000000591700061",  # TRMS
    ]
    
    beneficiarios = [
        "LUCAS SEVERO AGLIARDI",
        "LEANDRO CORREA SOCIEDADE INDIV",
        "PLUGIFY TECNOLOGIA S/A",
        "PLUGIFY TECNOLOGIA S/A",
        "POPU DIGITAL LTDA",
        "WARUN GESTAO DE NEGOCIOS LTDA",
        "AIG SEGUROS BRASIL S.A.",
        "TRMS DATA LTDA"
    ]
    
    for i, (codigo, beneficiario) in enumerate(zip(codigos, beneficiarios), 1):
        print(f"\nCÓDIGO {i:02d} - {beneficiario}")
        print("-" * 60)
        validar_codigo_barras(codigo)
        
        # Verifica se pode ser linha digitável mal formatada
        if len(codigo) > 44:
            print("⚠️ ATENÇÃO: Código muito longo, pode ser linha digitável")
            
    print("\n" + "=" * 80)
    print("ANÁLISE DETALHADA DO ARQUIVO CNAB")
    print("=" * 80)
    
    # Vamos analisar o arquivo novamente para ver os dados brutos
    with open("api/cnab-examples/rem66225-3680612.txt", 'r') as file:
        lines = file.readlines()
    
    segmento_count = 0
    for i, line in enumerate(lines, 1):
        line = line.strip()
        
        if '3410001300' in line and 'J' in line:
            segmento_count += 1
            print(f"\nSEGMENTO {segmento_count} (Linha {i}):")
            print(f"Linha completa: {line}")
            print(f"Tamanho total: {len(line)}")
            
            # Procura padrões de código de barras
            print("\nPossíveis códigos na linha:")
            
            # Método 1: Procura sequências de 44 dígitos
            sequencias_44 = encontrar_sequencias_numericas(line, 44)
            for j, seq in enumerate(sequencias_44):
                print(f"  Sequência 44 dígitos #{j+1}: {seq}")
            
            # Método 2: Procura sequências de 47-48 dígitos (linha digitável)
            sequencias_47_48 = encontrar_sequencias_numericas(line, 47, 48)
            for j, seq in enumerate(sequencias_47_48):
                print(f"  Sequência 47-48 dígitos #{j+1}: {seq}")
                
            print("-" * 40)

def encontrar_sequencias_numericas(texto, min_length, max_length=None):
    """
    Encontra sequências de dígitos de um tamanho específico
    """
    if max_length is None:
        max_length = min_length
        
    sequencias = []
    i = 0
    while i < len(texto):
        if texto[i].isdigit():
            # Início de uma sequência numérica
            j = i
            while j < len(texto) and texto[j].isdigit():
                j += 1
            
            # Tamanho da sequência encontrada
            tamanho = j - i
            if min_length <= tamanho <= max_length:
                sequencias.append(texto[i:j])
            
            i = j
        else:
            i += 1
    
    return sequencias

def testar_conversao_linha_digitavel():
    """
    Testa se os códigos podem ser linhas digitáveis que precisam ser convertidas
    """
    print("\n" + "=" * 80)
    print("TESTE DE CONVERSÃO LINHA DIGITÁVEL → CÓDIGO DE BARRAS")
    print("=" * 80)
    
    # Exemplo de como seria uma linha digitável típica vs código de barras
    print("Formato típico:")
    print("  Linha Digitável:  48 dígitos em 5 grupos (AAAAA.AAAAA BBBBB.BBBBBB CCCCC.CCCCCC D EEEEEEEEEEEEEE)")
    print("  Código de Barras: 44 dígitos contínuos")
    print()
    
    # Testa o primeiro código como exemplo
    codigo_teste = "46191110300005400001110000000000314879550"
    print(f"Código analisado: {codigo_teste}")
    print(f"Tamanho: {len(codigo_teste)} dígitos")
    print()
    
    if len(codigo_teste) == 44:
        print("✅ Tamanho correto para código de barras (44 dígitos)")
        print("❓ Verificar se dígitos verificadores estão corretos")
    elif len(codigo_teste) == 47 or len(codigo_teste) == 48:
        print("⚠️ Tamanho indica linha digitável (47-48 dígitos)")
        print("❗ Precisa ser convertida para código de barras")
    else:
        print("❌ Tamanho não padrão - verificar extração")

if __name__ == "__main__":
    analisar_todos_codigos()
    testar_conversao_linha_digitavel() 