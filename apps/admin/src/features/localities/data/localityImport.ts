import type { Locality } from '../../shared/domain/models';

export type ParsedLocality = Omit<
  Locality,
  'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'
> & {
  id?: string;
  issues: string[];
  alreadyImported: boolean;
};

export type LocalityImportAnalysis = {
  fileName: string;
  totalRows: number;
  newRows: number;
  existingRows: number;
  duplicateRows: number;
  invalidCoordinateRows: number;
  reviewRows: number;
  rows: ParsedLocality[];
};

const expectedHeaders = ['ORIGEM', 'CIDADE ORIGEM', 'ESTADO', 'ENDERECO', 'COORDENADAS'];
const validStates = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
]);

export async function analyzeLocalityWorkbook(
  file: File,
  existingLocalities: Locality[],
): Promise<LocalityImportAnalysis> {
  const { readSheet } = await import('read-excel-file/browser');
  const spreadsheet = await readSheet(file);
  return analyzeLocalityRows(spreadsheet, existingLocalities, file.name);
}

export function analyzeLocalityRows(
  spreadsheet: unknown[][],
  existingLocalities: Locality[],
  fileName = 'Localidades.xlsx',
): LocalityImportAnalysis {
  if (spreadsheet.length < 2) {
    throw new Error('A planilha nao possui registros para importar.');
  }

  const header = spreadsheet[0].map((value) => normalizeSearchText(toText(value)));
  const indexes = Object.fromEntries(expectedHeaders.map((name) => [name, header.indexOf(name)]));
  const missingHeaders = expectedHeaders.filter((name) => indexes[name] < 0);
  if (missingHeaders.length > 0) {
    throw new Error(`Colunas obrigatorias ausentes: ${missingHeaders.join(', ')}.`);
  }

  const existingFingerprints = new Set(existingLocalities.map((locality) => locality.fingerprint).filter(Boolean));
  const parsedRows = spreadsheet
    .slice(1)
    .map((row, index) => parseLocalityRow(row, indexes, index + 2))
    .filter((row): row is ParsedLocality => row !== null);

  const fingerprints = new Set<string>();
  for (const row of parsedRows) {
    const duplicatedInFile = fingerprints.has(row.fingerprint);
    if (duplicatedInFile) {
      row.issues.push('Duplicidade exata dentro da planilha');
      row.needsReview = true;
    }
    row.alreadyImported = duplicatedInFile || existingFingerprints.has(row.fingerprint);
    if (!duplicatedInFile && row.alreadyImported) {
      row.issues.push('Registro identico ja cadastrado');
    }
    fingerprints.add(row.fingerprint);
  }

  return {
    fileName,
    totalRows: parsedRows.length,
    newRows: parsedRows.filter((row) => !row.alreadyImported).length,
    existingRows: parsedRows.filter((row) => row.alreadyImported).length,
    duplicateRows: parsedRows.filter((row) => row.issues.some((issue) => issue.toLocaleLowerCase('pt-BR').includes('duplicidade'))).length,
    invalidCoordinateRows: parsedRows.filter((row) => row.latitude === null || row.longitude === null).length,
    reviewRows: parsedRows.filter((row) => row.needsReview).length,
    rows: parsedRows,
  };
}

function parseLocalityRow(
  row: unknown[],
  indexes: Record<string, number>,
  sourceRow: number,
): ParsedLocality | null {
  const reference = toText(row[indexes.ORIGEM]);
  const city = toText(row[indexes['CIDADE ORIGEM']]);
  const uf = toText(row[indexes.ESTADO]).toUpperCase();
  const address = toText(row[indexes.ENDERECO]);
  const originalCoordinates = toText(row[indexes.COORDENADAS]);
  if (![reference, city, uf, address, originalCoordinates].some(Boolean)) {
    return null;
  }

  const issues: string[] = [];
  const parsedCoordinate = parseCoordinate(originalCoordinates);
  if (!parsedCoordinate.valid) {
    issues.push('Coordenada ausente ou invalida');
  }
  if (!reference || !city || !uf || !address) {
    issues.push('Campo obrigatorio ausente');
  }
  if (!validStates.has(uf)) {
    issues.push('UF invalida');
  } else if (addressConflictsWithUf(address, uf)) {
    issues.push('UF diverge do endereco');
  }

  return {
    reference,
    normalizedReference: normalizeSearchText(reference),
    city,
    normalizedCity: normalizeSearchText(city),
    uf,
    address,
    normalizedAddress: normalizeSearchText(address),
    latitude: parsedCoordinate.valid ? parsedCoordinate.latitude : null,
    longitude: parsedCoordinate.valid ? parsedCoordinate.longitude : null,
    originalCoordinates,
    status: 'active',
    needsReview: issues.length > 0,
    source: 'import',
    sourceRow,
    fingerprint: buildFingerprint({ reference, city, uf, address, ...parsedCoordinate }),
    issues,
    alreadyImported: false,
  };
}

export function parseCoordinate(value: string) {
  const raw = value.trim();
  if (!raw || raw === '0') {
    return { latitude: null, longitude: null, valid: false } as const;
  }

  const decimalMatches = [...raw.matchAll(/(-?\d{1,2}[.,]\d{4,})\s*[,;]\s*(-?\d{1,3}[.,]\d{4,})/g)];
  const decimal = decimalMatches.at(-1);
  if (decimal) {
    return validateCoordinate(
      Number(decimal[1].replace(',', '.')),
      Number(decimal[2].replace(',', '.')),
    );
  }

  const dms = raw.match(/(\d{1,2})\s*[\u00b0\u00ba]\s*(\d{1,2})\s*['\u2019]\s*(\d{1,2}(?:[.,]\d+)?)\s*["\u201d]?\s*([NS])\s+(\d{1,3})\s*[\u00b0\u00ba]\s*(\d{1,2})\s*['\u2019]\s*(\d{1,2}(?:[.,]\d+)?)\s*["\u201d]?\s*([EWO])/i);
  if (!dms) {
    return { latitude: null, longitude: null, valid: false } as const;
  }
  return validateCoordinate(
    dmsToDecimal(dms[1], dms[2], dms[3], dms[4]),
    dmsToDecimal(dms[5], dms[6], dms[7], dms[8]),
  );
}

function validateCoordinate(latitude: number, longitude: number) {
  const valid = Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180
    && !(latitude === 0 && longitude === 0);
  return valid
    ? { latitude, longitude, valid: true } as const
    : { latitude: null, longitude: null, valid: false } as const;
}

function dmsToDecimal(degrees: string, minutes: string, seconds: string, direction: string) {
  const value = Number(degrees) + Number(minutes) / 60 + Number(seconds.replace(',', '.')) / 3600;
  return ['S', 'W', 'O'].includes(direction.toUpperCase()) ? -value : value;
}

function addressConflictsWithUf(address: string, uf: string) {
  const statesInAddress = normalizeSearchText(address)
    .split(' ')
    .filter((token) => validStates.has(token));
  return statesInAddress.length > 0 && !statesInAddress.includes(uf);
}

export function normalizeSearchText(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function buildFingerprint(value: {
  reference: string;
  city: string;
  uf: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}) {
  return [
    normalizeSearchText(value.reference),
    normalizeSearchText(value.city),
    value.uf,
    normalizeSearchText(value.address),
    value.latitude?.toFixed(5) ?? '',
    value.longitude?.toFixed(5) ?? '',
  ].join('|');
}

function toText(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}
