#!/usr/bin/env python3

# Ler o arquivo original linha por linha
with open('api/cnab-examples/rem58685.txt', 'r') as f:
    linhas = f.readlines()

print(f"Total de linhas no arquivo original: {len(linhas)}")

# Processar cada linha SEM usar trim(), apenas remover quebras de linha
registros_formatados = []
for i, linha in enumerate(linhas, 1):
    # Remover APENAS quebras de linha, mantendo espaços
    linha_limpa = linha.rstrip('\n\r')
    print(f"Linha {i}: {len(linha_limpa)} caracteres -> completando para 240")
    
    # Garantir que tenha exatamente 240 caracteres
    if len(linha_limpa) > 240:
        linha_formatada = linha_limpa[:240]  # Truncar se maior
    else:
        linha_formatada = linha_limpa.ljust(240, ' ')  # Completar com espaços
    
    registros_formatados.append(linha_formatada)

# Salvar o arquivo corrigido
with open('cnab_240_valido.txt', 'w') as f:
    for registro in registros_formatados:
        f.write(registro + '\n')
        
print(f'Arquivo cnab_240_valido.txt criado com {len(registros_formatados)} registros')

# Verificar o resultado - sem usar trim!
with open('cnab_240_valido.txt', 'r') as f:
    linhas_verificacao = f.readlines()
    for i, linha in enumerate(linhas_verificacao[:5], 1):
        linha_sem_quebra = linha.rstrip('\n\r')  # Remove apenas quebras de linha
        print(f"Verificação linha {i}: {len(linha_sem_quebra)} caracteres")
        
print("\nPrimeiras 3 linhas do arquivo válido:")
with open('cnab_240_valido.txt', 'r') as f:
    for i, linha in enumerate(f, 1):
        if i <= 3:
            print(f"Linha {i}: '{linha.rstrip()[:50]}...' (Total: {len(linha.rstrip())} chars)")
        else:
            break 