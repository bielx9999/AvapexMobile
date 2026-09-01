import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputPath = process.argv[2];
if (!outputPath) {
  throw new Error('Informe o destino da planilha modelo.');
}

const workbook = Workbook.create();
const sheet = workbook.worksheets.add('Equipamentos');
sheet.showGridLines = false;
sheet.getRange('A1:B1').merge();
sheet.getRange('A1').values = [['MODELO DE IMPORTACAO - EQUIPAMENTOS DE AMARRACAO']];
sheet.getRange('A1:B1').format = {
  fill: '#1F1C1C',
  font: { bold: true, color: '#FFFFFF', size: 14 },
  horizontalAlignment: 'center',
  verticalAlignment: 'center',
};
sheet.getRange('A1:B1').format.rowHeight = 28;
sheet.getRange('A3:B3').values = [['Tipo do equipamento', 'Numero de identificacao']];
sheet.getRange('A3:B3').format = {
  fill: '#FACC15',
  font: { bold: true, color: '#111111' },
  horizontalAlignment: 'center',
  borders: { preset: 'outside', style: 'thin', color: '#D4A900' },
};
sheet.getRange('A4:B7').values = [
  ['Cinta', 'CT-001'],
  ['Catraca', 'CAT-001'],
  ['Corrente', 'COR-001'],
  ['Tensionador', 'TEN-001'],
];
sheet.getRange('A4:B7').format.borders = { preset: 'inside', style: 'thin', color: '#E4E4E7' };
sheet.getRange('A4:A200').dataValidation = {
  rule: { type: 'list', values: ['Cinta', 'Catraca', 'Corrente', 'Tensionador'] },
};
sheet.getRange('A2:B2').merge();
sheet.getRange('A2').values = [['Preencha uma linha por equipamento. Nao altere os cabecalhos.']];
sheet.getRange('A2:B2').format = { font: { italic: true, color: '#52525B' } };
sheet.getRange('A:A').format.columnWidth = 26;
sheet.getRange('B:B').format.columnWidth = 30;
sheet.freezePanes.freezeRows(3);

const file = await SpreadsheetFile.exportXlsx(workbook);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await file.save(outputPath);
const inspection = await workbook.inspect({
  kind: 'table',
  range: 'Equipamentos!A1:B7',
  include: 'values',
  tableMaxRows: 7,
  tableMaxCols: 2,
});
console.log(inspection.ndjson);
const preview = await workbook.render({
  sheetName: 'Equipamentos',
  range: 'A1:B7',
  scale: 2,
  format: 'png',
});
await fs.writeFile(`${outputPath}.png`, new Uint8Array(await preview.arrayBuffer()));
