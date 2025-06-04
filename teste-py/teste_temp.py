def extrair_pagamentos_cnab240_corrigido(caminho_arquivo):
    pagamentos = []
    with open(caminho_arquivo, 'r', encoding='utf-8') as arquivo:
        linhas = arquivo.readlines()
    
    i = 0
    while i < len(linhas):
        linha = linhas[i]
        if linha[7:8] == '3' and linha[13:14] == 'J':
            # Campos corrigidos baseados na análise
            banco_favorecido = linha[16:19].strip()
            agencia = linha[19:24].strip()
            conta = linha[24:36].strip()
            cpf_cnpj = linha[44:58].strip()
            nome_favorecido = linha[58:88].strip()
            data_pagamento = linha[93:101]
            valor_centavos = int(linha[119:134])
            valor_reais = valor_centavos / 100
            
            # Próxima linha J-52
            if i + 1 < len(linhas):
                linha_j52 = linhas[i + 1]
                if linha_j52[7:8] == '3' and linha_j52[13:15] == 'J0':
                    cnpj_remetente = linha_j52[44:58].strip()
                    nome_remetente = linha_j52[58:88].strip()
                else:
                    cnpj_remetente = ''
                    nome_remetente = ''
            else:
                cnpj_remetente = ''
                nome_remetente = ''
                
            pagamento = {
                'favorecido_nome': nome_favorecido,
                'favorecido_cpf_cnpj': cpf_cnpj,
                'banco': banco_favorecido,
                'agencia': agencia,
                'conta': conta,
                'valor': valor_reais,
                'data_pagamento': f'{data_pagamento[6:8]}/{data_pagamento[4:6]}/{data_pagamento[0:4]}' if len(data_pagamento) >= 8 else data_pagamento,
                'remetente_cnpj': cnpj_remetente,
                'remetente_nome': nome_remetente
            }
            pagamentos.append(pagamento)
            i += 2
        else:
            i += 1
    return pagamentos

if __name__ == "__main__":
    # Executar com o arquivo
    pagamentos = extrair_pagamentos_cnab240_corrigido('api/cnab-examples/rem66225-3680612.txt')
    print(f'Total de pagamentos extraídos: {len(pagamentos)}')
    print()
    for i, p in enumerate(pagamentos, 1):
        print(f'=== PAGAMENTO {i} ===')
        for k, v in p.items():
            print(f'{k}: {v}')
        print() 