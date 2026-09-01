import type { AppUser, UserRole } from '../../shared/domain/models';
import { formatCpf, normalizeCpf } from '../../shared/utils/cpf';

export type ParsedUserImportRow = {
  sourceRow: number;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  role: UserRole | null;
  password: string;
  cnhNumber: string;
  cnhCategory: string;
  cnhExpirationDate: string;
  issues: string[];
};

export type UserImportAnalysis = {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  rows: ParsedUserImportRow[];
};

const requiredHeaders = ['NOME', 'EMAIL', 'CPF', 'TELEFONE', 'PERFIL', 'SENHA'];

export async function analyzeUserWorkbook(file: File, existingUsers: AppUser[]): Promise<UserImportAnalysis> {
  const spreadsheet = file.name.toLowerCase().endsWith('.csv')
    ? parseCsv(await file.text())
    : await readWorkbook(file);
  return analyzeUserRows(spreadsheet, existingUsers, file.name);
}

export function analyzeUserRows(
  spreadsheet: unknown[][],
  existingUsers: AppUser[],
  fileName = 'modelo-importacao-usuarios.csv',
): UserImportAnalysis {
  const headerRowIndex = spreadsheet.findIndex((row) => requiredHeaders.every((header) => row.some((cell) => normalize(cell) === header)));
  if (headerRowIndex < 0) {
    throw new Error('Use o modelo com as colunas "NOME", "EMAIL", "CPF", "TELEFONE", "PERFIL" e "SENHA".');
  }

  const header = spreadsheet[headerRowIndex].map(normalize);
  const indexes = {
    name: header.indexOf('NOME'),
    email: header.indexOf('EMAIL'),
    cpf: header.indexOf('CPF'),
    phone: header.indexOf('TELEFONE'),
    role: header.indexOf('PERFIL'),
    password: header.indexOf('SENHA'),
    cnhNumber: header.indexOf('CNH NUMERO'),
    cnhCategory: header.indexOf('CNH CATEGORIA'),
    cnhExpirationDate: header.indexOf('CNH VALIDADE'),
  };

  const registeredEmails = new Set(existingUsers.map((user) => user.email.toLowerCase()).filter(Boolean));
  const registeredCpfs = new Set(existingUsers.map((user) => normalizeCpf(user.cpf ?? '')).filter(Boolean));
  const emailsInFile = new Set<string>();
  const cpfsInFile = new Set<string>();

  const rows = spreadsheet
    .slice(headerRowIndex + 1)
    .map((row, index) => parseRow(row, indexes, headerRowIndex + index + 2))
    .filter((row): row is ParsedUserImportRow => row !== null);

  for (const row of rows) {
    if (row.email) {
      if (emailsInFile.has(row.email)) row.issues.push('E-mail duplicado na planilha');
      if (registeredEmails.has(row.email)) row.issues.push('E-mail ja cadastrado');
      emailsInFile.add(row.email);
    }
    if (row.cpf) {
      if (cpfsInFile.has(row.cpf)) row.issues.push('CPF duplicado na planilha');
      if (registeredCpfs.has(row.cpf)) row.issues.push('CPF ja cadastrado');
      cpfsInFile.add(row.cpf);
    }
  }

  return {
    fileName,
    totalRows: rows.length,
    validRows: rows.filter((row) => row.issues.length === 0).length,
    invalidRows: rows.filter((row) => row.issues.length > 0).length,
    duplicateRows: rows.filter((row) => row.issues.some((issue) => issue.toLowerCase().includes('duplicado'))).length,
    rows,
  };
}

async function readWorkbook(file: File) {
  const { readSheet } = await import('read-excel-file/browser');
  return readSheet(file);
}

function parseRow(
  row: unknown[],
  indexes: Record<'name' | 'email' | 'cpf' | 'phone' | 'role' | 'password' | 'cnhNumber' | 'cnhCategory' | 'cnhExpirationDate', number>,
  sourceRow: number,
): ParsedUserImportRow | null {
  const name = text(row[indexes.name]);
  const email = text(row[indexes.email]).toLowerCase();
  const cpf = normalizeCpf(text(row[indexes.cpf]));
  const phone = text(row[indexes.phone]);
  const role = parseRole(text(row[indexes.role]));
  const password = text(row[indexes.password]);
  const cnhNumber = indexes.cnhNumber >= 0 ? text(row[indexes.cnhNumber]) : '';
  const cnhCategory = indexes.cnhCategory >= 0 ? text(row[indexes.cnhCategory]).toUpperCase() : '';
  const cnhExpirationDate = indexes.cnhExpirationDate >= 0 ? parseDateInput(row[indexes.cnhExpirationDate]) : '';

  if (!name && !email && !cpf && !phone && !role && !password && !cnhNumber && !cnhCategory && !cnhExpirationDate) {
    return null;
  }

  const issues: string[] = [];
  if (!name) issues.push('Nome obrigatorio');
  if (!email || !email.includes('@')) issues.push('E-mail invalido');
  if (!cpf) issues.push('CPF invalido');
  if (!role) issues.push('Perfil invalido. Use Motorista ou Administrativo');
  if (password.length < 6) issues.push('Senha obrigatoria com minimo de 6 caracteres');
  if (role === 'driver') {
    if (!cnhNumber) issues.push('CNH numero obrigatoria para motorista');
    if (!cnhCategory) issues.push('CNH categoria obrigatoria para motorista');
    if (!cnhExpirationDate) issues.push('CNH validade obrigatoria para motorista');
  }

  return {
    sourceRow,
    name,
    email,
    cpf,
    phone,
    role,
    password,
    cnhNumber,
    cnhCategory,
    cnhExpirationDate,
    issues,
  };
}

function parseRole(value: string): UserRole | null {
  const normalized = normalize(value);
  if (normalized === 'MOTORISTA' || normalized === 'DRIVER') {
    return 'driver';
  }
  if (normalized === 'ADMINISTRATIVO' || normalized === 'ADMIN' || normalized === 'ADMINISTRADOR') {
    return 'admin';
  }
  return null;
}

function parseDateInput(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = text(value);
  if (!raw) return '';
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    return `${br[3]}-${br[2]}-${br[1]}`;
  }
  return '';
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
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function text(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim();
}

export function displayImportCpf(cpf: string) {
  return cpf ? formatCpf(cpf) : '-';
}
