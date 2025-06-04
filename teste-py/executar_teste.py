from teste import extrair_pagamentos_cnab240

# Executar a extração
pagamentos = extrair_pagamentos_cnab240('api/cnab-examples/rem66225-3680612.txt')

print('=' * 60)
print('EXTRAÇÃO DE DADOS DO ARQUIVO CNAB240')
print('=' * 60)
print(f'Arquivo processado: api/cnab-examples/rem66225-3680612.txt')
print(f'Total de pagamentos encontrados: {len(pagamentos)}')
print('=' * 60)

for i, pagamento in enumerate(pagamentos, 1):
    print(f'\nPAGAMENTO {i}:')
    print(f'  Favorecido: {pagamento["favorecido_nome"]}')
    print(f'  CPF/CNPJ: {pagamento["favorecido_cpf_cnpj"]}')
    print(f'  Banco: {pagamento["banco"]}')
    print(f'  Agência: {pagamento["agencia"]}')
    print(f'  Conta: {pagamento["conta"]}')
    print(f'  Valor: R$ {pagamento["valor"]:,.2f}')
    print(f'  Data: {pagamento["data_pagamento"]}')
    print(f'  Remetente CNPJ: {pagamento["remetente_cnpj"]}')
    print(f'  Remetente Nome: {pagamento["remetente_nome"]}')
    print('-' * 40)

print(f'\nProcessamento concluído com sucesso!') 