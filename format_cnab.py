#!/usr/bin/env python3

# Ler o arquivo original
with open('api/cnab-examples/rem58685.txt', 'r') as f:
    content = f.read().replace('\n', '').replace('\r', '')

print(f"Tamanho total do conteúdo: {len(content)} caracteres")

# Identificar início de registros baseado nos códigos CNAB 240
registros = []
i = 0
while i < len(content):
    if i + 8 <= len(content) and content[i:i+8] in ['34100000', '34100011', '34100013', '34100015', '34100021', '34100023', '34100025', '34100031', '34100033', '34100035', '34100041', '34100043', '34100045', '34199999']:
        # Pegar até 240 caracteres para este registro
        fim = min(i + 240, len(content))
        registro = content[i:fim]
        
        # Se o registro tem menos de 240 caracteres, completar com espaços
        if len(registro) < 240:
            registro = registro.ljust(240)
        
        registros.append(registro)
        print(f"Registro {len(registros)}: {content[i:i+8]} - {len(registro)} caracteres")
        i += 240
    else:
        i += 1

# Salvar o arquivo corrigido
with open('cnab_240_formatado.txt', 'w') as f:
    for registro in registros:
        f.write(registro + '\n')
        
print(f'Criados {len(registros)} registros formatados')

# Verificar cada linha
with open('cnab_240_formatado.txt', 'r') as f:
    linhas = f.readlines()
    for i, linha in enumerate(linhas, 1):
        print(f"Linha {i}: {len(linha.rstrip())} caracteres") 