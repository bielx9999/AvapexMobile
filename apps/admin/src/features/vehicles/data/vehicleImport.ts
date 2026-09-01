import type { Vehicle, VehicleType } from '../../shared/domain/models';

export type ParsedVehicleImportRow = {
  sourceRow: number;
  plate: string;
  fleetNumber: string;
  type: VehicleType | null;
  year: number | null;
  issues: string[];
};

export type VehicleImportAnalysis = {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  rows: ParsedVehicleImportRow[];
};

const requiredHeaders = ['PLACA', 'FROTA', 'TIPO DE FROTA', 'ANO'];

const typeByLabel: Record<string, VehicleType> = {
  CAMINHAO: 'truck',
  'CAMINHAO TRUCK': 'truck',
  TRUCK: 'truck',
  'CAVALO MECANICO TOCO': 'mechanical_horse_toco',
  TOCO: 'mechanical_horse_toco',
  'CAVALO TOCO': 'mechanical_horse_toco',
  'CAVALO MECANICO TRUCADO': 'mechanical_horse_trucado',
  TRUCADO: 'mechanical_horse_trucado',
  'CAVALO TRUCADO': 'mechanical_horse_trucado',
};

export async function analyzeVehicleWorkbook(file: File, existingVehicles: Vehicle[]): Promise<VehicleImportAnalysis> {
  const spreadsheet = file.name.toLowerCase().endsWith('.csv')
    ? parseCsv(await file.text())
    : await readWorkbook(file);
  return analyzeVehicleRows(spreadsheet, existingVehicles, file.name);
}

export function analyzeVehicleRows(
  spreadsheet: unknown[][],
  existingVehicles: Vehicle[],
  fileName = 'modelo-importacao-veiculos.csv',
): VehicleImportAnalysis {
  const headerRowIndex = spreadsheet.findIndex((row) => requiredHeaders.every((header) => row.some((cell) => normalize(cell) === header)));
  if (headerRowIndex < 0) {
    throw new Error('Use o modelo com as colunas "PLACA", "FROTA", "TIPO DE FROTA" e "ANO".');
  }

  const header = spreadsheet[headerRowIndex].map(normalize);
  const indexes = {
    plate: header.indexOf('PLACA'),
    fleetNumber: header.indexOf('FROTA'),
    type: header.indexOf('TIPO DE FROTA'),
    year: header.indexOf('ANO'),
  };
  const registeredPlates = new Set(existingVehicles.map((vehicle) => normalizePlate(vehicle.plate)).filter(Boolean));
  const registeredFleets = new Set(existingVehicles.map((vehicle) => normalizeText(vehicle.fleetNumber)).filter(Boolean));
  const platesInFile = new Set<string>();
  const fleetsInFile = new Set<string>();

  const rows = spreadsheet
    .slice(headerRowIndex + 1)
    .map((row, index) => parseRow(row, indexes, headerRowIndex + index + 2))
    .filter((row): row is ParsedVehicleImportRow => row !== null);

  for (const row of rows) {
    if (row.plate) {
      if (platesInFile.has(row.plate)) row.issues.push('Placa duplicada na planilha');
      if (registeredPlates.has(row.plate)) row.issues.push('Placa ja cadastrada');
      platesInFile.add(row.plate);
    }
    const fleetKey = normalizeText(row.fleetNumber);
    if (fleetKey) {
      if (fleetsInFile.has(fleetKey)) row.issues.push('Frota duplicada na planilha');
      if (registeredFleets.has(fleetKey)) row.issues.push('Frota ja cadastrada');
      fleetsInFile.add(fleetKey);
    }
  }

  return {
    fileName,
    totalRows: rows.length,
    validRows: rows.filter((row) => row.issues.length === 0).length,
    invalidRows: rows.filter((row) => row.issues.length > 0).length,
    duplicateRows: rows.filter((row) => row.issues.some((issue) => issue.toLowerCase().includes('duplicada'))).length,
    rows,
  };
}

async function readWorkbook(file: File) {
  const { readSheet } = await import('read-excel-file/browser');
  return readSheet(file);
}

function parseRow(
  row: unknown[],
  indexes: Record<'plate' | 'fleetNumber' | 'type' | 'year', number>,
  sourceRow: number,
): ParsedVehicleImportRow | null {
  const plate = normalizePlate(text(row[indexes.plate]));
  const fleetNumber = text(row[indexes.fleetNumber]).toUpperCase();
  const rawType = text(row[indexes.type]);
  const year = parseYear(row[indexes.year]);
  if (!plate && !fleetNumber && !rawType && year === null) return null;

  const type = typeByLabel[normalize(rawType)] ?? null;
  const issues: string[] = [];
  if (!plate) issues.push('Placa obrigatoria');
  if (plate && !isValidPlate(plate)) issues.push('Placa invalida');
  if (!fleetNumber) issues.push('Frota obrigatoria');
  if (!rawType) issues.push('Tipo de frota obrigatorio');
  else if (!type) issues.push('Tipo invalido. Use Caminhao Truck, Cavalo Mecanico Toco ou Cavalo Mecanico Trucado');
  if (year === null) issues.push('Ano obrigatorio ou invalido');

  return { sourceRow, plate, fleetNumber, type, year, issues };
}

function parseCsv(value: string) {
  return value
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => splitCsvLine(line));
}

function splitCsvLine(line: string) {
  const delimiter = line.includes(';') ? ';' : ',';
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function normalize(value: unknown) {
  return normalizeText(text(value));
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function normalizePlate(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isValidPlate(value: string) {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(value);
}

function parseYear(value: unknown) {
  const year = Number(text(value));
  const currentYear = new Date().getFullYear() + 1;
  return Number.isInteger(year) && year >= 1950 && year <= currentYear ? year : null;
}

function text(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim();
}
