import type { AppUser, ProgrammingOperationType, Trip, Vehicle } from '../../shared/domain/models';
import { dailyStatusOptions, type DailyStatusValue } from '../presentation/programacaoConfig';

export type ProgramacaoImportRow = {
  sourceRow: number;
  selected: boolean;
  customerRequestNumber: string;
  operationType: ProgrammingOperationType;
  origin: string;
  destination: string;
  additionalInfo: string;
  returnTrip: boolean;
  scheduledAt: Date;
  expectedArrivalAt: Date | null;
  driver: AppUser | null;
  driverText: string;
  vehicle: Vehicle | null;
  plateText: string;
  vehicleText: string;
  statusValue: DailyStatusValue;
  warnings: string[];
  errors: string[];
  duplicate: boolean;
};

type Cell = string | number | Date | boolean | null | undefined;

const normalize = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

export function parseProgramacaoSheet(rows: Cell[][], drivers: AppUser[], vehicles: Vehicle[], existingTrips: Trip[]): ProgramacaoImportRow[] {
  const headerIndex = rows.findIndex((row) => row.some((cell) => normalize(cell).includes('CARGA DESCARGA')) && row.some((cell) => normalize(cell).includes('MOTORISTA')));
  if (headerIndex < 0) throw new Error('Nao encontrei a linha de cabecalho. Verifique as colunas CARGA / DESCARGA e MOTORISTA.');

  const headers = rows[headerIndex].map(normalize);
  const column = (...candidates: string[]) => headers.findIndex((header) => candidates.some((candidate) => header.includes(candidate)));
  const columns = {
    date: column('DATA SOL', 'DATA'),
    requestedTime: column('HORARIO SOL', 'HORA SOL', 'HORARIO'),
    arrivalTime: column('PREVISAO DE CHEGADA', 'PREVISAO CHEGADA'),
    operation: column('CARGA DESCARGA', 'OPERACAO'),
    origin: column('ORIGEM'),
    destination: column('DESTINO'),
    additional: column('INF ADICIONAL', 'INFORMACAO ADICIONAL'),
    request: column('SOLICITACAO', 'PEDIDO'),
    returnTrip: column('RETORNO'),
    vehicleType: column('VEICULO'),
    driver: column('MOTORISTA'),
    plate: column('PLACA'),
    status: column('STATUS'),
  };

  const fallbackDate = rows.slice(0, headerIndex).flat().map(parseDateOnly).find((date): date is Date => Boolean(date));
  const existingKeys = new Set(existingTrips.map(tripIdentity).filter(Boolean));
  const seenKeys = new Set<string>();
  const output: ProgramacaoImportRow[] = [];

  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row?.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '')) continue;
    const value = (key: keyof typeof columns) => columns[key] < 0 ? null : row[columns[key]];
    const operation = normalize(value('operation'));
    if (!operation && !value('driver') && !value('plate') && !value('request')) continue;

    const operationType: ProgrammingOperationType = operation.includes('DESCARGA') ? 'unloading' : 'loading';
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!operation.includes('CARGA') && !operation.includes('DESCARGA')) errors.push('Operacao deve ser CARGA ou DESCARGA.');

    const plate = normalize(value('plate'));
    const driverName = normalize(value('driver'));
    const matchingVehicles = vehicles.filter((item) => plate && normalize(item.plate).replace(/ /g, '') === plate.replace(/ /g, ''));
    const matchingDrivers = drivers.filter((item) => driverName && normalize(item.name) === driverName);
    const vehicle = matchingVehicles.length === 1 ? matchingVehicles[0] : null;
    const driver = matchingDrivers.length === 1 ? matchingDrivers[0] : null;
    if (!plate) errors.push('Placa nao informada.');
    else if (!vehicle) warnings.push('Veiculo sem vinculo com cadastro.');
    if (!driverName) errors.push('Motorista nao informado.');
    else if (!driver) warnings.push('Motorista sem vinculo; a viagem nao sera enviada ao aplicativo.');

    const rawDate = value('date');
    const rawArrival = value('arrivalTime');
    const scheduleDate = parseDateOnly(rawDate) ?? parseDateOnly(rawArrival) ?? fallbackDate;
    if (!scheduleDate) errors.push('Data nao informada e nao foi encontrada no cabecalho da planilha.');
    const scheduledAt = combineDateAndTime(scheduleDate ?? new Date(), value('requestedTime') ?? rawArrival);
    const expectedArrivalAt = rawArrival == null || rawArrival === '' ? null : combineDateAndTime(parseDateOnly(rawArrival) ?? scheduleDate ?? new Date(), rawArrival);

    const statusText = normalize(value('status'));
    const statusOption = importedStatus(statusText, operationType);
    if (!statusOption) warnings.push(`Status "${String(value('status'))}" nao reconhecido; sera usado o status inicial da operacao.`);

    const customerRequestNumber = String(value('request') ?? '').trim();
    const origin = cellText(value('origin'));
    const destination = cellText(value('destination'));
    if (!origin) errors.push('Origem nao informada.');
    if (!destination) errors.push('Destino nao informado.');

    const candidate: ProgramacaoImportRow = {
      sourceRow: rowIndex + 1,
      selected: false,
      customerRequestNumber,
      operationType,
      origin,
      destination,
      additionalInfo: cellText(value('additional')),
      returnTrip: ['SIM', 'S', 'YES', '1'].includes(normalize(value('returnTrip'))),
      scheduledAt,
      expectedArrivalAt,
      driver,
      driverText: cellText(value('driver')),
      vehicle,
      plateText: cellText(value('plate')),
      vehicleText: cellText(value('vehicleType')),
      statusValue: statusOption ?? (operationType === 'unloading' ? 'waiting_unloading' : 'waiting_loading'),
      warnings,
      errors,
      duplicate: false,
    };

    const key = importIdentity(candidate);
    candidate.duplicate = Boolean(key && (existingKeys.has(key) || seenKeys.has(key)));
    if (key) seenKeys.add(key);
    if (candidate.duplicate) warnings.push('Registro duplicado; sera ignorado na importacao.');
    candidate.selected = candidate.errors.length === 0 && !candidate.duplicate;
    output.push(candidate);
  }

  if (!output.length) throw new Error('A planilha nao possui linhas de programacao para importar.');
  return output;
}

function importedStatus(status: string, operation: ProgrammingOperationType): DailyStatusValue | null {
  if (!status) return null;
  const target = status.includes('TRANSITO') ? (operation === 'unloading' ? 'transit_to_unloading' : 'transit_to_loading')
    : status.includes('AGUARDANDO NF') ? 'awaiting_invoice'
      : status.includes('AGUARDANDO CARREGAR') || status.includes('AGUARDANDO CARGA') ? 'waiting_loading'
        : status.includes('AGUARDANDO DESCARGA') ? 'waiting_unloading'
          : status === 'CARREGANDO' ? 'loading'
            : status === 'DESCARREGANDO' ? 'unloading'
              : status.includes('LIBERADO') ? (operation === 'unloading' ? 'released_unloading' : 'released_loading')
                : null;
  return target && dailyStatusOptions.some((item) => item.value === target) ? target as DailyStatusValue : null;
}

function parseDateOnly(value: Cell): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime()) && value.getFullYear() > 1900) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const brDate = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (brDate) return new Date(Number(brDate[3]), Number(brDate[2]) - 1, Number(brDate[1]));
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
  return null;
}

function combineDateAndTime(date: Date, time: Cell): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (time instanceof Date && time.getFullYear() <= 1900) result.setHours(time.getHours(), time.getMinutes(), 0, 0);
  else if (typeof time === 'string') {
    const match = time.trim().match(/(?:T|^)(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (match) result.setHours(Number(match[1]), Number(match[2]), 0, 0);
  }
  return result;
}

function cellText(value: Cell) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
  if (value instanceof Date) return value.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return String(value).trim();
}

function tripIdentity(trip: Trip) {
  return identity(trip.customerRequestNumber, trip.operationType, trip.vehiclePlate, trip.origin, trip.destination, trip.scheduledAt);
}

function importIdentity(row: ProgramacaoImportRow) {
  return identity(row.customerRequestNumber, row.operationType, row.vehicle?.plate || row.plateText, row.origin, row.destination, row.scheduledAt);
}

function identity(request: string | undefined, operation: ProgrammingOperationType | undefined, plate: string | undefined, origin: string, destination: string, date: Date | null) {
  if (!request || !operation || !plate || !date) return '';
  return [normalize(request), normalize(operation), normalize(plate).replace(/ /g, ''), normalize(origin), normalize(destination), `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`].join('|');
}
