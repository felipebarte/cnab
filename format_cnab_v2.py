#!/usr/bin/env python3

# Ler o arquivo original linha por linha
with open('api/cnab-examples/rem58685.txt', 'r') as f:
    linhas = f.readlines()

print(f"Total de linhas no arquivo original: {len(linhas)}")

# Processar cada linha e completar para 240 caracteres
registros_formatados = []
for i, linha in enumerate(linhas, 1):
    linha_limpa = linha.rstrip('\n\r')
    print(f"Linha {i}: {len(linha_limpa)} caracteres -> '{linha_limpa[:20]}...'")
    
    # Completar para 240 caracteres com espaços
    linha_formatada = linha_limpa.ljust(240)
    registros_formatados.append(linha_formatada)

# Salvar o arquivo corrigido
with open('cnab_240_final.txt', 'w') as f:
    for registro in registros_formatados:
        f.write(registro + '\n')
        
print(f'Arquivo cnab_240_final.txt criado com {len(registros_formatados)} registros de 240 caracteres cada')

# Verificar o resultado
with open('cnab_240_final.txt', 'r') as f:
    linhas_verificacao = f.readlines()
    for i, linha in enumerate(linhas_verificacao[:5], 1):
        print(f"Verificação linha {i}: {len(linha.rstrip())} caracteres") 