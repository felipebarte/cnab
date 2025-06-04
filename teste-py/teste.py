import json
import csv
import os
from datetime import datetime

def extrair_pagamentos_cnab240(caminho_arquivo):
    pagamentos = []

    with open(caminho_arquivo, 'r', encoding='utf-8') as arquivo:
        linhas = arquivo.readlines()

    i = 0
    while i < len(linhas):
        linha = linhas[i]

        if linha[7:8] == "3" and linha[13:13] == "J":
            # Segmento J - Posições corretas do padrão CNAB240
            codigo_banco = linha[0:2].strip()
            codigo_lote = linha[3:6].strip()
            tipo_registro = linha[7:7].strip()
            numero_registro = linha[8:12].strip()
            segmento = linha[13:13].strip()
            tipo_movimento = linha[14:16].strip()
            banco_favorecido = linha[17:19].strip()
            moeda = linha[21:21].strip()
            digito_verificador = linha[22:22].strip()
            vencimento = linha[23:26].strip()
            valor_centavos = linha[27:36].strip()
            campo_livre = linha[37:61].strip()
            agencia = linha[23:28].strip()
            conta = linha[28:40].strip()
            cpf_cnpj = linha[40:54].strip()
            nome_favorecido = linha[61:91].strip()
            data_vencimento = linha[91:99].strip()
            valor_titulo = linha[100:114].strip()
            descontos = linha[114:129].strip()
            acrescimos = linha[130:144].strip()
            data_pagamento = linha[145:152].strip()
            valor_pagamento = linha[153:167].strip()
            zeros = linha[168:182].strip()
            seu_numero = linha[183:202].strip()
            brancos = linha[203:215].strip()
            nosso_numero = linha[216:230].strip()
            ocorrencias = linha[231:240].strip()
            valor_reais = int(valor_centavos) / 100
            boleto = linha[18:61].strip()

            # Próxima linha J-52 para dados do remetente
            if i + 1 < len(linhas):
                linha_j52 = linhas[i + 1]
                if linha_j52[7:8] == "3" and linha_j52[13:15] == "J0":
                    cnpj_remetente = linha_j52[40:54].strip()
                    nome_remetente = linha_j52[54:84].strip()
                else:
                    cnpj_remetente = ""
                    nome_remetente = ""
            else:
                cnpj_remetente = ""
                nome_remetente = ""

            pagamento = {
                "favorecido_nome": nome_favorecido,
                "favorecido_cpf_cnpj": cpf_cnpj,
                "banco": banco_favorecido,
                "agencia": agencia,
                "conta": conta,
                "valor": valor_reais,
                "data_pagamento": data_pagamento,
                "data_vencimento": data_vencimento,
                "remetente_cnpj": cnpj_remetente,
                "remetente_nome": nome_remetente,
                "boleto": boleto,
                "codigo_banco": codigo_banco,
                "codigo_lote": codigo_lote,
                "tipo_registro": tipo_registro,
                "tipo_movimento": tipo_movimento,
                "banco_favorecido": banco_favorecido,
                "moeda": moeda,
                "digito_verificador": digito_verificador,
                "vencimento": vencimento,
                "valor_titulo": valor_titulo,
                "descontos": descontos,
                "acrescimos": acrescimos,
                "data_pagamento": data_pagamento,
                "valor_pagamento": valor_pagamento,
                "zeros": zeros,
                "seu_numero": seu_numero,
                "brancos": brancos,
                "nosso_numero": nosso_numero,
                "ocorrencias": ocorrencias,
                "valor_reais": valor_reais,
            }

            pagamentos.append(pagamento)
            i += 2  # pula Segmento J e Segmento J-52
        else:
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
    
    # Salvar em CSV
    arquivo_csv = os.path.join(pasta_destino, f"pagamentos_cnab240_{timestamp}.csv")
    if pagamentos:
        with open(arquivo_csv, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=pagamentos[0].keys())
            writer.writeheader()
            writer.writerows(pagamentos)
    
    # Criar resumo
    arquivo_resumo = os.path.join(pasta_destino, f"resumo_analise_{timestamp}.txt")
    with open(arquivo_resumo, 'w', encoding='utf-8') as f:
        f.write("=" * 60 + "\n")
        f.write("RESUMO DA ANÁLISE CNAB240\n")
        f.write("=" * 60 + "\n")
        f.write(f"Data/Hora da análise: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n")
        f.write(f"Total de pagamentos encontrados: {len(pagamentos)}\n")
        f.write(f"Arquivos gerados:\n")
        f.write(f"  - JSON: {os.path.basename(arquivo_json)}\n")
        f.write(f"  - CSV: {os.path.basename(arquivo_csv)}\n")
        f.write(f"  - Resumo: {os.path.basename(arquivo_resumo)}\n")
        f.write("=" * 60 + "\n\n")
        
        # Estatísticas
        if pagamentos:
            total_valor = sum(p['valor'] for p in pagamentos)
            f.write("ESTATÍSTICAS:\n")
            f.write(f"Valor total dos pagamentos: R$ {total_valor:2f}\n")
            f.write(f"Valor médio por pagamento: R$ {total_valor/len(pagamentos):2f}\n")
            
            # Bancos únicos
            bancos = set(p['banco'] for p in pagamentos)
            f.write(f"Bancos envolvidos: {len(bancos)} ({', '.join(sorted(bancos))})\n")
            f.write("\n")
            
            # Lista de pagamentos
            f.write("LISTA DE PAGAMENTOS:\n")
            f.write("-" * 60 + "\n")
            for i, p in enumerate(pagamentos, 1):
                f.write(f"Pagamento {i}:\n")
                f.write(f"  Favorecido: {p['favorecido_nome']}\n")
                f.write(f"  CPF/CNPJ: {p['favorecido_cpf_cnpj']}\n")
                f.write(f"  Banco: {p['banco']} | Agência: {p['agencia']} | Conta: {p['conta']}\n")
                f.write(f"  Valor: R$ {p['valor']:2f}\n")
                f.write(f"  Data: {p['data_pagamento']}\n")
                f.write(f"  Boleto: {p['boleto']}\n")
                if p['remetente_nome']:
                    f.write(f"  Remetente: {p['remetente_nome']} ({p['remetente_cnpj']})\n")
                f.write("\n")
    
    return arquivo_json, arquivo_csv, arquivo_resumo

def main():
    """
    Função principal para executar a análise e salvar os resultados
    """
    # Arquivo CNAB240 para processar
    #arquivo_cnab = '../api/cnab-examples/rem66225-3680612.txt'
    arquivo_cnab = '../api/cnab-examples/rem66225.txt'
    
    print("=" * 60)
    print("ANÁLISE DE ARQUIVO CNAB240")
    print("=" * 60)
    print(f"Processando arquivo: {arquivo_cnab}")
    
    try:
        # Extrair dados
        pagamentos = extrair_pagamentos_cnab240(arquivo_cnab)
        print(f"✅ Extração concluída: {len(pagamentos)} pagamentos encontrados")
        
        # Salvar resultados
        arquivo_json, arquivo_csv, arquivo_resumo = salvar_resultados(pagamentos)
        
        print("✅ Arquivos salvos com sucesso:")
        print(f"   📄 JSON: {arquivo_json}")
        print(f"   📊 CSV: {arquivo_csv}")
        print(f"   📋 Resumo: {arquivo_resumo}")
        
        # Mostrar estatísticas
        if pagamentos:
            total_valor = sum(p['valor'] for p in pagamentos)
            print(f"\n📈 ESTATÍSTICAS:")
            print(f"   💰 Valor total: R$ {total_valor:.2f}")
            print(f"   📊 Valor médio: R$ {total_valor/len(pagamentos):.2f}")
            print(f"   📊 Boleto: {pagamentos[0]['boleto']}")
            bancos = set(p['banco'] for p in pagamentos)
            print(f"   🏦 Bancos envolvidos: {len(bancos)}")
            
        
        print("=" * 60)
        print("✅ Análise concluída com sucesso!")
        
    except FileNotFoundError:
        print(f"❌ Erro: Arquivo não encontrado: {arquivo_cnab}")
    except Exception as e:
        print(f"❌ Erro durante o processamento: {str(e)}")

if __name__ == "__main__":
    main()
