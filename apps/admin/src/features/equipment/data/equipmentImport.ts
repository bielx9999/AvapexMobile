import type { Equipment } from '../../shared/domain/models';
import type { EquipmentTypeValue } from './equipmentRepository';

export type ParsedEquipmentImportRow = {
  sourceRow: number;
  type: EquipmentTypeValue | null;
  code: string;
  issues: string[];
};

export type EquipmentImportAnalysis = {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  rows: ParsedEquipmentImportRow[];
};

const requiredHeaders = ['TIPO DO EQUIPAMENTO', 'NUMERO DE IDENTIFICACAO'];

const typeByLabel: Record<string, EquipmentTypeValue> = {
  CINTA: 'strap',
  CINTAS: 'strap',
  CATRACA: 'ratchet',
  CATRACAS: 'ratchet',
  CORRENTE: 'chain',
  CORRENTES: 'chain',
  TENSIONADOR: 'tensioner',
  TENSIONADORES: 'tensioner',
};

export async function analyzeEquipmentWorkbook(file: File, existingEquipment: Equipment[]): Promise<EquipmentImportAnalysis> {
  const { readSheet } = await import('read-excel-file/browser');
  const spreadsheet = await readSheet(file);
  return analyzeEquipmentRows(spreadsheet, existingEquipment, file.name);
}

export function analyzeEquipmentRows(
  spreadsheet: unknown[][],
  existingEquipment: Equipment[],
  fileName = 'modelo-importacao-equipamentos.xlsx',
): EquipmentImportAnalysis {
  const headerRowIndex = spreadsheet.findIndex((row) => requiredHeaders.every((header) => row.some((cell) => normalize(cell) === header)));
  if (headerRowIndex < 0) {
    throw new Error('Use o modelo com as colunas "Tipo do equipamento" e "Numero de identificacao".');
  }

  const header = spreadsheet[headerRowIndex].map(normalize);
  const typeColumn = header.indexOf('TIPO DO EQUIPAMENTO');
  const codeColumn = header.indexOf('NUMERO DE IDENTIFICACAO');
  const registeredCodes = new Set(existingEquipment.map((item) => normalizeCode(item.code)).filter(Boolean));
  const codesInFile = new Set<string>();
  const rows = spreadsheet
    .slice(headerRowIndex + 1)
    .map((row, index) => parseRow(row, typeColumn, codeColumn, headerRowIndex + index + 2))
    .filter((row): row is ParsedEquipmentImportRow => row !== null);

  for (const row of rows) {
    if (!row.code) continue;
    if (codesInFile.has(row.code)) row.issues.push('Numero de identificacao duplicado na planilha');
    if (registeredCodes.has(row.code)) row.issues.push('Numero de identificacao ja cadastrado');
    codesInFile.add(row.code);
  }

  return {
    fileName,
    totalRows: rows.length,
    validRows: rows.filter((row) => row.issues.length === 0).length,
    invalidRows: rows.filter((row) => row.issues.length > 0).length,
    duplicateRows: rows.filter((row) => row.issues.some((issue) => issue.includes('duplicado'))).length,
    rows,
  };
}

function parseRow(row: unknown[], typeColumn: number, codeColumn: number, sourceRow: number): ParsedEquipmentImportRow | null {
  const rawType = text(row[typeColumn]);
  const code = normalizeCode(text(row[codeColumn]));
  if (!rawType && !code) return null;

  const type = typeByLabel[normalize(rawType)] ?? null;
  const issues: string[] = [];
  if (!rawType) issues.push('Tipo do equipamento obrigatorio');
  else if (!type) issues.push('Tipo invalido. Use Cinta, Catraca, Corrente ou Tensionador');
  if (!code) issues.push('Numero de identificacao obrigatorio');
  return { sourceRow, type, code, issues };
}

function normalize(value: unknown) {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function text(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim();
}
