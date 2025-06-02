/**
 * Utilitário para criar dados de teste CNAB com tamanho correto
 */

// Função para preencher linha com espaços à direita
function padLine(line, targetLength) {
  if (line.length >= targetLength) {
    return line.substring(0, targetLength);
  }
  return line + ' '.repeat(targetLength - line.length);
}

// Dados base para CNAB240
const cnab240BaseLines = [
  '00100000         200100014000005000001308015  00001000000000012345000001BANCO DO BRASIL             EMPRESA TESTE               1251220230912345605        051220231100000000000000001',
  '00100011R0100001000100014000005000001308015  00001000000000012345000001LOTE TESTE                  00000000000000012512202300010000000000000000000000000000                         051220231100000000000000001',
  '00100013000001P 00001000000000012345000001308015  000010000000012345678901234567890123456789012345670000000000000000000000120230101000000000012000000000000000000000000000000000000000',
  '00100013000002Q 00001000000000012345000001308015  00001FULANO DE TAL                         RUA DA CONSOLACAO 123       SAO PAULO      SP05001001000000000000000000000000',
  '00100015         00000030000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000051220231100000000000000001',
  '00199999         00000010000000300000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000051220231100000000000000001'
];

// Dados base para CNAB400
const cnab400BaseLines = [
  '01REMESSA01COBRANCA       001230014000005         EMPRESA TESTE                   001BANCO DO BRASIL          0512230000001000',
  '112345678000194FULANO DE TAL                              RUA DA CONSOLACAO 123              SAO PAULO   SP05001001000000012000000005122312345690123456789000001',
  '9          0000010000000000000000120000000000000000000000000000000000000000000000000000000000000000000000000000000000000001'
];

// Gerar CNAB240 com 240 caracteres por linha
const cnab240TestData = cnab240BaseLines
  .map(line => padLine(line, 240))
  .join('\n');

// Gerar CNAB400 com 400 caracteres por linha  
const cnab400TestData = cnab400BaseLines
  .map(line => padLine(line, 400))
  .join('\n');

console.log('=== CNAB240 TEST DATA ===');
console.log('Linhas:', cnab240BaseLines.length);
cnab240BaseLines.forEach((line, index) => {
  const padded = padLine(line, 240);
  console.log(`Linha ${index + 1}: ${line.length} -> ${padded.length} caracteres`);
});
console.log('\nDADOS CNAB240:');
console.log(cnab240TestData);

console.log('\n=== CNAB400 TEST DATA ===');
console.log('Linhas:', cnab400BaseLines.length);
cnab400BaseLines.forEach((line, index) => {
  const padded = padLine(line, 400);
  console.log(`Linha ${index + 1}: ${line.length} -> ${padded.length} caracteres`);
});
console.log('\nDADOS CNAB400:');
console.log(cnab400TestData);

// Exportar para uso em testes
export { cnab240TestData, cnab400TestData };
export default { cnab240TestData, cnab400TestData }; 