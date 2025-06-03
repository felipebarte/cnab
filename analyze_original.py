#!/usr/bin/env python3

with open('api/cnab-examples/rem58685.txt', 'r') as f:
    linhas = f.readlines()

print('Análise linha por linha do arquivo original:')
for i, linha in enumerate(linhas[:5], 1):
    linha_sem_quebra = linha.rstrip('\n\r')
    linha_trimmed = linha_sem_quebra.strip()
    print(f'Linha {i}:')
    print(f'  Sem quebra: {len(linha_sem_quebra)} chars')
    print(f'  Com trim(): {len(linha_trimmed)} chars')
    print(f'  Espaços no final: {len(linha_sem_quebra) - len(linha_trimmed)}')
    print(f'  Conteúdo: "{linha_sem_quebra[:50]}..."')
    print()

print("\nResumo geral:")
total_chars_sem_quebra = [len(linha.rstrip('\n\r')) for linha in linhas]
total_chars_trimmed = [len(linha.strip()) for linha in linhas]
print(f"Linhas totais: {len(linhas)}")
print(f"Chars sem quebra - min: {min(total_chars_sem_quebra)}, max: {max(total_chars_sem_quebra)}")
print(f"Chars com trim - min: {min(total_chars_trimmed)}, max: {max(total_chars_trimmed)}")
print(f"Linhas que perdem chars com trim: {sum(1 for i in range(len(linhas)) if total_chars_sem_quebra[i] != total_chars_trimmed[i])}")

# Verificar se realmente todas as linhas originais têm 240 caracteres
print(f"\nLinhas com exatamente 240 chars (sem quebra): {sum(1 for x in total_chars_sem_quebra if x == 240)}")
print(f"Linhas com menos de 240 chars (sem quebra): {sum(1 for x in total_chars_sem_quebra if x < 240)}")
print(f"Linhas com mais de 240 chars (sem quebra): {sum(1 for x in total_chars_sem_quebra if x > 240)}") 