# Análise da estrutura CNAB240 - Segmento J
linha1 = '3410001300001J0004619111030000540000111000000000003148795500149.855.267 LUCAS SEVERO AGLIAR020620250000000005400000000000000000000000000000000000206202500000000054000000000000000000010073354595'
print('Análise da estrutura CNAB240 - Segmento J:')
print('Total chars:', len(linha1))
print()

for i in range(0, len(linha1), 10):
    print(f'Posições {i:3d}-{i+10:3d}: "{linha1[i:i+10]}"')

print()
print('Campos identificados:')
print('Banco (pos 0-3):', linha1[0:3])
print('Lote (pos 3-7):', linha1[3:7])
print('Tipo registro (pos 7-8):', linha1[7:8])
print('Nº sequencial (pos 8-13):', linha1[8:13])
print('Segmento (pos 13-14):', linha1[13:14])
print('Tipo movimento (pos 14-15):', linha1[14:15])
print('Código instrução mov (pos 15-17):', linha1[15:17])
print('Câmara centralizadora (pos 17-20):', linha1[17:20])
print('Banco favorecido (pos 20-23):', linha1[20:23])
print('Agência favorecido (pos 23-28):', linha1[23:28])
print('Conta favorecido (pos 28-40):', linha1[28:40])
print('CPF/CNPJ favorecido (pos 40-54):', linha1[40:54])
print('Nome favorecido (pos 54-84):', linha1[54:84])
print('Valor (pos 119-134):', linha1[119:134])
print('Data vencimento (pos 154-162):', linha1[154:162]) 