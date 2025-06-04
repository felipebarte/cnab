import json
import os
from datetime import datetime

def extrair_pagamentos_cnab240(caminho_arquivo):
    pagamentos = []

    with open(caminho_arquivo, 'r', encoding='utf-8') as arquivo:
        linhas = arquivo.readlines()

    i = 0
    while i < len(linhas):
        linha = linhas[i]

        # Verifica se é um Segmento J (dados principais do boleto)
        if linha[7:8] == "3" and linha[13:14] == "J":
            # Primeira linha J - dados do pagamento
            if len(linha) >= 240:
                # Extrair dados da primeira linha J (dados de valor)
                codigo_banco = linha[0:3].strip()
                codigo_lote = linha[3:7].strip()
                tipo_registro = linha[7:8].strip()
                numero_registro = linha[8:13].strip()
                segmento = linha[13:14].strip()
                codigo_barras = linha[17:61].strip()
                
                # Campos específicos desta linha (dados de valor/documento)
                codigo_movimento = linha[14:20].strip()
                codigo_banco_favorecido = linha[20:23].strip()
                codigo_camara = linha[23:26].strip()
                valor_str = linha[26:36].strip()
                documento = linha[41:61].strip()
                nome_favorecido = linha[61:91].strip()
                data_pagamento = linha[91:99].strip()
                valor_pagamento_str = linha[110:125].strip()
                descontos = linha[114:129].strip()
                acrescimos = linha[129:143].strip()
                informacoes = linha[200:220].strip()

                # Tratamento seguro para conversão de valores
                try:
                    valor_pagamento_limpo = ''.join(filter(str.isdigit, valor_str))
                    if valor_pagamento_limpo:
                        valor_reais = int(valor_pagamento_limpo) / 100
                    else:
                        valor_reais = 0.0
                except (ValueError, TypeError):
                    valor_reais = 0.0

                # Verificar se existe segunda linha J (dados do pagador)
                pagador_nome = ""
                cnpj_pagador = ""
                if i + 1 < len(linhas):
                    segunda_linha_j = linhas[i + 1]
                    if segunda_linha_j[7:8] == "3" and segunda_linha_j[13:14] == "J":
                        # Segunda linha J - dados do pagador
                        cnpj_pagador = segunda_linha_j[21:35].strip()
                        pagador_nome = segunda_linha_j[35:58].strip()
                        
                        i += 1  # Pular a segunda linha J

                # Criar objeto base do pagamento
                pagamento = {
                    "favorecido_nome": nome_favorecido.strip(),
                    "pagador_nome": pagador_nome.strip(),
                    "cnpj_pagador": cnpj_pagador,
                    "banco_favorecido": codigo_banco_favorecido,
                    "valor": valor_reais,
                    "data_pagamento": data_pagamento,
                    "documento": documento.strip(),
                    "codigo_banco": codigo_banco,
                    "codigo_lote": codigo_lote,
                    "tipo_registro": tipo_registro,
                    "numero_registro": numero_registro,
                    "segmento": segmento,
                    "codigo_movimento": codigo_movimento,
                    "codigo_camara": codigo_camara,
                    "informacoes": informacoes,
                    "descontos": descontos,
                    "acrescimos": acrescimos,
                    "codigo_barras": codigo_barras,
                    # Campos do Segmento B (serão preenchidos se existir)
                    "endereco_completo": "",
                    "logradouro": "",
                    "numero_endereco": "",
                    "complemento": "",
                    "bairro": "",
                    "cidade": "",
                    "cep": "",
                    "uf": "",
                    "email": "",
                    "cnpj_favorecido": ""
                }

                # Verificar se a próxima linha é um Segmento B (dados complementares)
                if i + 1 < len(linhas):
                    proxima_linha = linhas[i + 1]
                    if proxima_linha[7:8] == "3" and proxima_linha[13:14] == "B":
                        # Segmento B - Extrair dados complementares (endereço, email, etc.)
                        cnpj_favorecido = proxima_linha[18:32].strip()
                        logradouro = proxima_linha[32:62].strip()
                        numero_endereco = proxima_linha[62:67].strip()
                        complemento = proxima_linha[67:82].strip()
                        bairro = proxima_linha[82:97].strip()
                        cidade = proxima_linha[97:117].strip()
                        cep = proxima_linha[117:125].strip()
                        uf = proxima_linha[125:127].strip()
                        
                        # Tentar extrair email do final da linha
                        resto_linha = proxima_linha[127:].strip()
                        email = ""
                        if "@" in resto_linha:
                            # Procurar por padrão de email
                            partes = resto_linha.split()
                            for parte in partes:
                                if "@" in parte and "." in parte and len(parte) > 5:
                                    email = parte.strip()
                                    break
                        
                        # Adicionar dados do Segmento B ao pagamento
                        pagamento.update({
                            "cnpj_favorecido": cnpj_favorecido,
                            "endereco_completo": f"{logradouro.strip()}, {numero_endereco.strip()} {complemento.strip()} - {bairro.strip()} - {cidade.strip()}/{uf} - CEP: {cep.strip()}".replace("  ", " ").strip(),
                            "logradouro": logradouro.strip(),
                            "numero_endereco": numero_endereco.strip(),
                            "complemento": complemento.strip(),
                            "bairro": bairro.strip(),
                            "cidade": cidade.strip(),
                            "cep": cep.strip(),
                            "uf": uf.strip(),
                            "email": email
                        })
                        
                        # Pular a linha do Segmento B na próxima iteração
                        i += 1

                pagamentos.append(pagamento)
                
        i += 1

    return pagamentos

def salvar_resultados(pagamentos, pasta_destino="results"):
    """
    Salva os dados extraídos em diferentes formatos na pasta especificada
    """
    # Criar pasta results se não existir
    os.makedirs(pasta_destino, exist_ok=True)
    
    # Timestamp para nomear os arquivos
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Salvar em JSON
    arquivo_json = os.path.join(pasta_destino, f"pagamentos_cnab240_{timestamp}.json")
    with open(arquivo_json, 'w', encoding='utf-8') as f:
        json.dump(pagamentos, f, indent=2, ensure_ascii=False)
    
    return arquivo_json

def calcular_total_pagamentos(pagamentos):
    """
    Calcula o valor total de todos os pagamentos
    """
    total = sum(pagamento['valor'] for pagamento in pagamentos)
    return total

def formatar_valor_brl(valor):
    """
    Formata valor para o padrão brasileiro (BRL)
    """
    return f"R$ {valor:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')

def main():
    """
    Função principal para executar a análise e salvar os resultados
    """
    # Arquivo CNAB240 para processar
    #arquivo_cnab = '../api/cnab-examples/rem66225-3680612.txt'
    arquivo_cnab = '../api/cnab-examples/rem80945.txt'
    
    print("=" * 60)
    print("ANÁLISE DE ARQUIVO CNAB240")
    print("=" * 60)
    print(f"Processando arquivo: {arquivo_cnab}")
    
    try:
        # Extrair dados
        pagamentos = extrair_pagamentos_cnab240(arquivo_cnab)
        print(f"✅ Extração concluída: {len(pagamentos)} pagamentos encontrados")
        
        # Salvar resultados
        arquivo_json = salvar_resultados(pagamentos)
        
        print("✅ Arquivos salvos com sucesso:")
        print(f"   📄 JSON: {arquivo_json}")
        
        # Mostrar exemplo dos dados extraídos
        if pagamentos:
            print("\n" + "=" * 60)
            print("EXEMPLO DOS DADOS EXTRAÍDOS:")
            print("=" * 60)
            primeiro_pagamento = pagamentos[0]
            print(f"Favorecido: {primeiro_pagamento['favorecido_nome']}")
            print(f"Pagador: {primeiro_pagamento['pagador_nome']}")
            print(f"Valor: R$ {primeiro_pagamento['valor']:.2f}")
            print(f"Endereço: {primeiro_pagamento['endereco_completo']}")
            print(f"Email: {primeiro_pagamento['email']}")
            print(f"Data Pagamento: {primeiro_pagamento['data_pagamento']}")
            
            # Calcular e exibir total dos pagamentos
            total_geral = calcular_total_pagamentos(pagamentos)
            print("\n" + "=" * 60)
            print("RESUMO FINANCEIRO:")
            print("=" * 60)
            print(f"💰 VALOR TOTAL DOS PAGAMENTOS: {formatar_valor_brl(total_geral)}")
            print(f"📊 Quantidade de pagamentos: {len(pagamentos)}")
            print(f"💵 Valor médio por pagamento: {formatar_valor_brl(total_geral/len(pagamentos))}")
        
        print("=" * 60)
        print("✅ Análise concluída com sucesso!")
        
    except FileNotFoundError:
        print(f"❌ Erro: Arquivo não encontrado: {arquivo_cnab}")
    except Exception as e:
        print(f"❌ Erro durante o processamento: {str(e)}")

if __name__ == "__main__":
    main()
