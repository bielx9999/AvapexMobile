import { FormEvent, type ReactNode, useMemo, useState } from 'react';
import {
  CalendarClock,
  ClipboardList,
  Clock3,
  FileText,
  MapPin,
  Pencil,
  Plus,
  Route,
  Search,
  Truck,
  UserRound,
  X,
} from 'lucide-react';
import { adminWriteRepository } from '../../shared/data/firestoreCollections';
import type {
  AppUser,
  ProgrammingOperationType,
  ProgrammingOperationalStatus,
  ProgrammedVehicleType,
  ProgrammingStatus,
  Trip,
  Vehicle,
} from '../../shared/domain/models';

type ProgramacaoPageProps = {
  loading: boolean;
  onChanged: () => Promise<void>;
  trips: Trip[];
  users: AppUser[];
  vehicles: Vehicle[];
};

type DailyStatusValue = ProgrammingOperationalStatus | 'awaiting_invoice';

type DailyStatusOption = {
  label: string;
  operationType?: ProgrammingOperationType;
  operationalStatus?: ProgrammingOperationalStatus;
  programmingStatus: ProgrammingStatus;
  value: DailyStatusValue;
};

const stageCards: Array<{ status: ProgrammingStatus; label: string; tone: 'dark' | 'yellow' | 'info' | 'success' | 'neutral' }> = [
  { status: 'in_transit', label: 'Em transito', tone: 'info' },
  { status: 'loading', label: 'Carregando', tone: 'yellow' },
  { status: 'unloading', label: 'Descarregando', tone: 'neutral' },
  { status: 'awaiting_invoice', label: 'Aguardando NF', tone: 'dark' },
  { status: 'released', label: 'Liberado', tone: 'success' },
];

const dailyStatusOptions: DailyStatusOption[] = [
  { value: 'transit_to_loading', label: 'EM TRANSITO PARA CARGA', programmingStatus: 'in_transit', operationalStatus: 'transit_to_loading', operationType: 'loading' },
  { value: 'transit_to_unloading', label: 'EM TRANSITO PARA DESCARGA', programmingStatus: 'in_transit', operationalStatus: 'transit_to_unloading', operationType: 'unloading' },
  { value: 'waiting_loading', label: 'AGUARDANDO CARREGAR', programmingStatus: 'loading', operationalStatus: 'waiting_loading', operationType: 'loading' },
  { value: 'loading', label: 'CARREGANDO', programmingStatus: 'loading', operationalStatus: 'loading', operationType: 'loading' },
  { value: 'waiting_unloading', label: 'AGUARDANDO DESCARGA', programmingStatus: 'unloading', operationalStatus: 'waiting_unloading', operationType: 'unloading' },
  { value: 'unloading', label: 'DESCARREGANDO', programmingStatus: 'unloading', operationalStatus: 'unloading', operationType: 'unloading' },
  { value: 'awaiting_invoice', label: 'AGUARDANDO NF', programmingStatus: 'awaiting_invoice' },
  { value: 'released_unloading', label: 'LIBERADO DA DESCARGA', programmingStatus: 'released', operationalStatus: 'released_unloading', operationType: 'unloading' },
  { value: 'released_loading', label: 'LIBERADO DA CARGA', programmingStatus: 'released', operationalStatus: 'released_loading', operationType: 'loading' },
];

const programmedVehicleOptions: Array<{ value: ProgrammedVehicleType; label: string }> = [
  { value: 'vanderleia', label: 'Vanderleia' },
  { value: 'carreta', label: 'Carreta' },
  { value: 'truck', label: 'Truck' },
  { value: 'sprinter', label: 'Sprinter' },
  { value: 'munck', label: 'Munck' },
  { value: 'rodotrem', label: 'Rodotrem' },
  { value: 'prancha', label: 'Prancha' },
  { value: 'saveiro', label: 'Saveiro' },
  { value: 'hr', label: 'HR' },
];

const initialForm = {
  additionalInfo: '',
  customerRequestNumber: '',
  destination: '',
  driverId: '',
  expectedArrivalAt: '',
  operationType: 'loading' as ProgrammingOperationType,
  origin: '',
  programmedVehicleType: 'truck' as ProgrammedVehicleType,
  programmingStatus: 'loading' as ProgrammingStatus,
  returnTrip: false,
  scheduledAt: '',
  statusValue: 'waiting_loading' as DailyStatusValue,
  vehicleId: '',
};

export function ProgramacaoPage({ loading, onChanged, trips, users, vehicles }: ProgramacaoPageProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState(initialForm);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DailyStatusValue>('all');
  const [driverId, setDriverId] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [showForm, setShowForm] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyTripId, setBusyTripId] = useState('');
  const [error, setError] = useState('');

  const drivers = useMemo(
    () => users.filter((user) => user.role === 'driver' && user.status === 'active').sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );
  const activeVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.status === 'active').sort((a, b) => a.plate.localeCompare(b.plate)),
    [vehicles],
  );
  const driverNames = useMemo(() => new Map(users.map((user) => [user.uid, user.name || user.email])), [users]);
  const vehicleNames = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.plate || vehicle.id])), [vehicles]);

  const filteredTrips = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

    return trips
      .filter((trip) => {
        const currentDailyStatus = findDailyStatusOption(trip);
        if (statusFilter !== 'all' && currentDailyStatus.value !== statusFilter) {
          return false;
        }
        if (driverId && trip.driverId !== driverId) {
          return false;
        }
        if (start && (!trip.scheduledAt || trip.scheduledAt < start)) {
          return false;
        }
        if (end && (!trip.scheduledAt || trip.scheduledAt > end)) {
          return false;
        }
        if (!normalizedQuery) {
          return true;
        }

        return [
          trip.additionalInfo,
          trip.customerRequestNumber,
          trip.origin,
          trip.destination,
          trip.driverName,
          driverNames.get(trip.driverId),
          trip.vehiclePlate,
          vehicleNames.get(trip.vehicleId),
          operationTypeLabel(trip.operationType),
          programmedVehicleTypeLabel(trip.programmedVehicleType),
          currentDailyStatus.label,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => (a.scheduledAt?.getTime() ?? 0) - (b.scheduledAt?.getTime() ?? 0));
  }, [driverId, driverNames, endDate, query, startDate, statusFilter, trips, vehicleNames]);

  const stats = useMemo(() => {
    return stageCards.map((column) => ({
      ...column,
      total: trips.filter((trip) => (trip.programmingStatus ?? 'loading') === column.status).length,
    }));
  }, [trips]);

  function openCreateForm() {
    setForm({ ...initialForm, scheduledAt: formatDateTimeInput(new Date()) });
    setEditingTrip(null);
    setShowForm(true);
  }

  function openEditForm(trip: Trip) {
    const currentStatus = findDailyStatusOption(trip);
    setForm({
      additionalInfo: trip.additionalInfo ?? '',
      customerRequestNumber: trip.customerRequestNumber ?? '',
      destination: trip.destination,
      driverId: trip.driverId,
      expectedArrivalAt: formatDateTimeInput(trip.expectedArrivalAt ?? null),
      operationType: trip.operationType ?? currentStatus.operationType ?? 'loading',
      origin: trip.origin,
      programmedVehicleType: trip.programmedVehicleType ?? 'truck',
      programmingStatus: currentStatus.programmingStatus,
      returnTrip: trip.returnTrip ?? false,
      scheduledAt: formatDateTimeInput(trip.scheduledAt),
      statusValue: currentStatus.value,
      vehicleId: trip.vehicleId,
    });
    setEditingTrip(trip);
    setShowForm(true);
  }

  function closeForm() {
    if (submitting) {
      return;
    }
    setForm(initialForm);
    setEditingTrip(null);
    setShowForm(false);
  }

  function updateFormStatus(value: DailyStatusValue) {
    const selected = dailyStatusOptions.find((option) => option.value === value) ?? dailyStatusOptions[2];
    setForm((current) => ({
      ...current,
      operationType: selected.operationType ?? current.operationType,
      programmingStatus: selected.programmingStatus,
      statusValue: selected.value,
    }));
  }

  function updateFormOperationType(value: ProgrammingOperationType) {
    const fallback = value === 'unloading' ? dailyStatusOptions[4] : dailyStatusOptions[2];
    setForm((current) => ({
      ...current,
      operationType: value,
      programmingStatus: fallback.programmingStatus,
      statusValue: fallback.value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const driver = drivers.find((item) => item.uid === form.driverId);
      const vehicle = vehicles.find((item) => item.id === form.vehicleId);
      const selectedStatus = dailyStatusOptions.find((option) => option.value === form.statusValue) ?? dailyStatusOptions[2];
      if (!driver || !vehicle) {
        throw new Error('Selecione motorista e placa cadastrada validos.');
      }
      const scheduledAt = new Date(form.scheduledAt);
      const expectedArrivalAt = form.expectedArrivalAt ? new Date(form.expectedArrivalAt) : null;
      const savedTripId = await adminWriteRepository.saveTrip({
        additionalInfo: form.additionalInfo,
        customerRequestNumber: form.customerRequestNumber,
        destination: form.destination,
        driverId: form.driverId,
        driverName: driver.name || driver.email,
        expectedArrivalAt,
        id: editingTrip?.id,
        operationType: form.operationType,
        operationalStatus: selectedStatus.operationalStatus,
        origin: form.origin,
        programmedVehicleType: form.programmedVehicleType,
        programmingStatus: selectedStatus.programmingStatus,
        returnTrip: form.returnTrip,
        scheduledAt,
        status: selectedStatus.programmingStatus === 'released' ? 'completed' : selectedStatus.programmingStatus === 'loading' ? 'pending' : 'in_progress',
        vehicleId: form.vehicleId,
        vehicleModel: vehicle.model,
        vehiclePlate: vehicle.plate,
      });
      if (selectedStatus.programmingStatus === 'released') {
        const result = await adminWriteRepository.updateTripProgrammingStatus(
          {
            additionalInfo: form.additionalInfo,
            completedAt: editingTrip?.completedAt ?? null,
            customerRequestNumber: form.customerRequestNumber,
            deliveryDocs: editingTrip?.deliveryDocs ?? [],
            destination: form.destination,
            driverId: form.driverId,
            driverName: driver.name || driver.email,
            expectedArrivalAt,
            id: savedTripId,
            operationType: form.operationType,
            operationalStatus: selectedStatus.operationalStatus,
            origin: form.origin,
            programmedVehicleType: form.programmedVehicleType,
            programmingStatus: selectedStatus.programmingStatus,
            returnGeneratedTripId: editingTrip?.returnGeneratedTripId,
            returnSourceTripId: editingTrip?.returnSourceTripId,
            returnTrip: form.returnTrip,
            scheduledAt,
            startedAt: editingTrip?.startedAt ?? null,
            status: 'completed',
            unloadingGeneratedTripId: editingTrip?.unloadingGeneratedTripId,
            unloadingSourceTripId: editingTrip?.unloadingSourceTripId,
            vehicleId: form.vehicleId,
            vehicleModel: vehicle.model,
            vehiclePlate: vehicle.plate,
          },
          selectedStatus.programmingStatus,
          selectedStatus.operationalStatus,
          form.operationType,
        );
        revealGeneratedScheduling(result);
      }
      closeForm();
      await onChanged();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Erro ao salvar programacao.');
    } finally {
      setSubmitting(false);
    }
  }

  async function updateDailyStatus(trip: Trip, value: DailyStatusValue) {
    const selected = dailyStatusOptions.find((option) => option.value === value);
    if (!selected || findDailyStatusOption(trip).value === value) {
      return;
    }
    setBusyTripId(trip.id);
    setError('');
    try {
      const result = await adminWriteRepository.updateTripProgrammingStatus(
        trip,
        selected.programmingStatus,
        selected.operationalStatus,
        selected.operationType ?? trip.operationType,
      );
      revealGeneratedScheduling(result);
      await onChanged();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Erro ao atualizar programacao.');
    } finally {
      setBusyTripId('');
    }
  }

  function revealGeneratedScheduling(result: Awaited<ReturnType<typeof adminWriteRepository.updateTripProgrammingStatus>>) {
    if (!result) {
      return;
    }
    const generatedDate = formatDateInput(result.generatedDate);
    setStatusFilter('all');
    setEndDate((current) => (!current || current < generatedDate ? generatedDate : current));
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((item) => (
          <StatusCard
            icon={statusIcon(item.status)}
            key={item.status}
            label={item.label}
            tone={item.tone}
            value={loading ? '-' : item.total}
          />
        ))}
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-200 bg-white px-4 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="font-semibold">Programacao diaria</h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[140px_140px_230px_190px_260px_auto]">
              <input className="ui-input h-10 px-3 text-sm" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              <input className="ui-input h-10 px-3 text-sm" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              <select className="ui-input h-10 px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | DailyStatusValue)}>
                <option value="all">Todos status</option>
                {dailyStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select className="ui-input h-10 px-3 text-sm" value={driverId} onChange={(event) => setDriverId(event.target.value)}>
                <option value="">Todos motoristas</option>
                {drivers.map((driver) => (
                  <option key={driver.uid} value={driver.uid}>{driver.name || driver.email}</option>
                ))}
              </select>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input
                  className="ui-input h-10 w-full pl-10 pr-3 text-sm"
                  placeholder="Buscar solicitacao, rota, placa"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <button
                className="ui-button flex h-10 items-center justify-center gap-2 bg-avapex-yellow px-4 text-sm font-semibold text-avapex-black hover:bg-yellow-300"
                onClick={openCreateForm}
                type="button"
              >
                <Plus size={18} />
                Nova Programacao
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto bg-white">
          <div className="min-w-[1680px]">
            <div className="grid grid-cols-[120px_120px_150px_150px_220px_240px_110px_135px_95px_150px_220px_140px_240px_72px] border-b-2 border-avapex-black text-center text-sm font-semibold">
              <div className="border-r border-zinc-400 bg-zinc-900 px-3 py-3 text-white">{formatDateOnly(new Date())}</div>
              <div className="border-r border-zinc-400 bg-white px-3 py-3">{filteredTrips.length} linhas</div>
              <div className="col-span-2 border-r border-zinc-400 bg-zinc-900 px-3 py-3 text-white">PROGRAMACAO</div>
              <div className="col-span-9 border-r border-zinc-400 bg-white px-3 py-3 text-avapex-black">AVAPEX - CARGA/DESCARGA</div>
              <div className="bg-avapex-yellow px-3 py-3 text-avapex-black">ADM</div>
            </div>

            <table className="w-full border-separate border-spacing-0 text-left text-xs">
              <thead className="sticky top-0 z-10 text-[11px] uppercase text-avapex-black">
                <tr>
                  <SpreadsheetHeader className="w-[120px] bg-white">Data - sol</SpreadsheetHeader>
                  <SpreadsheetHeader className="w-[120px] bg-white">Horario sol</SpreadsheetHeader>
                  <SpreadsheetHeader className="w-[150px] bg-zinc-900 text-white">Previsao de chegada</SpreadsheetHeader>
                  <SpreadsheetHeader className="w-[150px] bg-white">Carga / descarga</SpreadsheetHeader>
                  <SpreadsheetHeader className="w-[220px] bg-avapex-yellow">Origem</SpreadsheetHeader>
                  <SpreadsheetHeader className="w-[240px] bg-avapex-yellow">Destino</SpreadsheetHeader>
                  <SpreadsheetHeader className="w-[110px] bg-zinc-800 text-white">Inf. adicional</SpreadsheetHeader>
                  <SpreadsheetHeader className="w-[135px] bg-avapex-yellow">Solicitacao</SpreadsheetHeader>
                  <SpreadsheetHeader className="w-[95px] bg-avapex-yellow">Retorno</SpreadsheetHeader>
                  <SpreadsheetHeader className="w-[150px] bg-zinc-900 text-white">Veiculo</SpreadsheetHeader>
                  <SpreadsheetHeader className="w-[220px] bg-zinc-900 text-white">Motorista</SpreadsheetHeader>
                  <SpreadsheetHeader className="w-[140px] bg-zinc-900 text-white">Placa</SpreadsheetHeader>
                  <SpreadsheetHeader className="w-[240px] bg-avapex-yellow">Status</SpreadsheetHeader>
                  <SpreadsheetHeader className="w-[72px] bg-zinc-100 text-right">Acoes</SpreadsheetHeader>
                </tr>
              </thead>
              <tbody>
                {filteredTrips.map((trip, index) => {
                  const currentStatus = findDailyStatusOption(trip);
                  return (
                    <tr className={index % 2 === 0 ? 'bg-white' : 'bg-zinc-50/70'} key={trip.id}>
                      <SpreadsheetCell>{formatDateOnly(trip.scheduledAt)}</SpreadsheetCell>
                      <SpreadsheetCell>{formatTimeOnly(trip.scheduledAt)}</SpreadsheetCell>
                      <SpreadsheetCell>{formatDateTimeShort(trip.expectedArrivalAt ?? null)}</SpreadsheetCell>
                      <SpreadsheetCell>
                        <span className="rounded-lg bg-zinc-100 px-2 py-1 font-semibold text-zinc-800">{operationTypeLabel(trip.operationType)}</span>
                      </SpreadsheetCell>
                      <SpreadsheetCell className="font-medium">{trip.origin || '-'}</SpreadsheetCell>
                      <SpreadsheetCell className="font-medium">{trip.destination || '-'}</SpreadsheetCell>
                      <SpreadsheetCell>
                        <div className="flex flex-col gap-1">
                          <span>{trip.additionalInfo || '-'}</span>
                          <GeneratedBadges trip={trip} />
                        </div>
                      </SpreadsheetCell>
                      <SpreadsheetCell className="font-semibold">{trip.customerRequestNumber || '-'}</SpreadsheetCell>
                      <SpreadsheetCell>
                        <span className={`rounded-lg px-2 py-1 font-semibold ${trip.returnTrip ? 'bg-avapex-yellow text-avapex-black' : 'bg-zinc-100 text-zinc-700'}`}>
                          {trip.returnTrip ? 'SIM' : 'NAO'}
                        </span>
                      </SpreadsheetCell>
                      <SpreadsheetCell>{programmedVehicleTypeLabel(trip.programmedVehicleType).toUpperCase()}</SpreadsheetCell>
                      <SpreadsheetCell>{trip.driverName || driverNames.get(trip.driverId) || trip.driverId}</SpreadsheetCell>
                      <SpreadsheetCell className="font-semibold">{trip.vehiclePlate || vehicleNames.get(trip.vehicleId) || trip.vehicleId}</SpreadsheetCell>
                      <SpreadsheetCell>
                        <select
                          className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 text-xs font-semibold uppercase outline-none focus:border-avapex-yellow focus:ring-2 focus:ring-avapex-yellow/30"
                          disabled={busyTripId === trip.id}
                          value={currentStatus.value}
                          onChange={(event) => void updateDailyStatus(trip, event.target.value as DailyStatusValue)}
                        >
                          {dailyStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </SpreadsheetCell>
                      <SpreadsheetCell className="text-right">
                        <button className="ui-icon-button inline-flex h-8 w-8 items-center justify-center border-zinc-300 text-zinc-700 hover:bg-white" disabled={busyTripId === trip.id} onClick={() => openEditForm(trip)} title="Editar programacao" type="button">
                          <Pencil size={15} />
                        </button>
                      </SpreadsheetCell>
                    </tr>
                  );
                })}
                {!loading && filteredTrips.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-zinc-500" colSpan={14}>
                      Nenhuma programacao encontrada.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6">
          <section className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
              <h2 className="text-lg font-semibold">{editingTrip ? 'Editar Programacao' : 'Nova Programacao'}</h2>
              <button
                aria-label="Fechar programacao"
                className="ui-icon-button flex h-9 w-9 shrink-0 items-center justify-center border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                onClick={closeForm}
                type="button"
              >
                <X size={18} />
              </button>
            </header>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void handleSubmit(event)}>
              <div className="space-y-5 overflow-y-auto bg-zinc-50 p-5">
                <section className="ui-card p-4">
                  <h3 className="mb-3 text-sm font-semibold text-zinc-800">Dados da programacao</h3>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <TextField
                      icon={<FileText size={15} />}
                      label="Numero da solicitacao do cliente"
                      onChange={(value) => setForm((current) => ({ ...current, customerRequestNumber: value }))}
                      required
                      value={form.customerRequestNumber}
                    />
                    <TextField
                      icon={<Clock3 size={15} />}
                      label="Data e horario da solicitacao"
                      onChange={(value) => setForm((current) => ({ ...current, scheduledAt: value }))}
                      required
                      type="datetime-local"
                      value={form.scheduledAt}
                    />
                    <TextField
                      icon={<CalendarClock size={15} />}
                      label="Previsao de chegada"
                      onChange={(value) => setForm((current) => ({ ...current, expectedArrivalAt: value }))}
                      type="datetime-local"
                      value={form.expectedArrivalAt}
                    />
                    <SelectField
                      icon={<Route size={15} />}
                      label="Carga / descarga"
                      onChange={(value) => updateFormOperationType(value as ProgrammingOperationType)}
                      value={form.operationType}
                    >
                      <option value="loading">Carga</option>
                      <option value="unloading">Descarga</option>
                    </SelectField>
                    <SelectField
                      icon={<ClipboardList size={15} />}
                      label="Status"
                      onChange={(value) => updateFormStatus(value as DailyStatusValue)}
                      value={form.statusValue}
                    >
                      {dailyStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </SelectField>
                    <SelectField
                      icon={<Route size={15} />}
                      label="Retorno"
                      onChange={(value) => setForm((current) => ({ ...current, returnTrip: value === 'yes' }))}
                      value={form.returnTrip ? 'yes' : 'no'}
                    >
                      <option value="no">Nao</option>
                      <option value="yes">Sim</option>
                    </SelectField>
                  </div>
                </section>

                <section className="ui-card p-4">
                  <h3 className="mb-3 text-sm font-semibold text-zinc-800">Atribuicao</h3>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <SelectField icon={<UserRound size={15} />} label="Motorista" value={form.driverId} onChange={(value) => setForm((current) => ({ ...current, driverId: value }))} required>
                      <option value="">Selecione</option>
                      {drivers.map((driver) => (
                        <option key={driver.uid} value={driver.uid}>{driver.name || driver.email}</option>
                      ))}
                    </SelectField>
                    <SelectField icon={<Truck size={15} />} label="Placa cadastrada" value={form.vehicleId} onChange={(value) => setForm((current) => ({ ...current, vehicleId: value }))} required>
                      <option value="">Selecione</option>
                      {activeVehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} - {vehicle.fleetNumber || vehicle.model}</option>
                      ))}
                    </SelectField>
                    <SelectField icon={<Truck size={15} />} label="Veiculo" value={form.programmedVehicleType} onChange={(value) => setForm((current) => ({ ...current, programmedVehicleType: value as ProgrammedVehicleType }))}>
                      {programmedVehicleOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </SelectField>
                  </div>
                </section>

                <section className="ui-card p-4">
                  <h3 className="mb-3 text-sm font-semibold text-zinc-800">Rota</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <TextField icon={<MapPin size={15} />} label="Origem" value={form.origin} onChange={(value) => setForm((current) => ({ ...current, origin: value }))} required />
                    <TextField icon={<MapPin size={15} />} label="Destino" value={form.destination} onChange={(value) => setForm((current) => ({ ...current, destination: value }))} required />
                  </div>
                </section>

                <section className="ui-card p-4">
                  <h3 className="mb-3 text-sm font-semibold text-zinc-800">Informacao adicional</h3>
                  <TextAreaField
                    label="Observacoes da programacao"
                    onChange={(value) => setForm((current) => ({ ...current, additionalInfo: value }))}
                    value={form.additionalInfo}
                  />
                </section>
              </div>

              <footer className="flex flex-col-reverse gap-2 border-t border-zinc-200 bg-white px-5 py-4 sm:flex-row sm:justify-end">
                <button className="ui-button h-11 border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50" disabled={submitting} onClick={closeForm} type="button">
                  Cancelar
                </button>
                <button className="ui-button flex h-11 items-center justify-center gap-2 bg-avapex-yellow px-5 text-sm font-semibold text-avapex-black hover:bg-yellow-300" disabled={submitting} type="submit">
                  <Plus size={18} />
                  {submitting ? 'Salvando...' : editingTrip ? 'Salvar alteracoes' : 'Criar programacao'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function GeneratedBadges({ trip }: { trip: Trip }) {
  return (
    <div className="flex flex-wrap gap-1">
      {trip.returnGeneratedTripId ? <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Retorno gerado</span> : null}
      {trip.returnSourceTripId ? <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">Retorno</span> : null}
      {trip.unloadingGeneratedTripId ? <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Descarga gerada</span> : null}
      {trip.unloadingSourceTripId ? <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700">Descarga</span> : null}
    </div>
  );
}

function SpreadsheetHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <th className={`border-b-2 border-r border-avapex-black px-3 py-3 text-center font-semibold ${className}`}>
      {children}
    </th>
  );
}

function SpreadsheetCell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <td className={`border-b border-r border-zinc-300 px-3 py-2 align-middle text-zinc-800 ${className}`}>
      {children}
    </td>
  );
}

function StatusCard({ icon, label, tone, value }: { icon: ReactNode; label: string; tone: 'dark' | 'yellow' | 'success' | 'info' | 'neutral'; value: number | string }) {
  const toneClassNames = {
    dark: { accent: 'bg-avapex-black', icon: 'bg-avapex-black text-white ring-zinc-200', value: 'text-avapex-black' },
    info: { accent: 'bg-sky-500', icon: 'bg-sky-50 text-sky-700 ring-sky-100', value: 'text-sky-700' },
    neutral: { accent: 'bg-zinc-400', icon: 'bg-zinc-100 text-zinc-700 ring-zinc-200', value: 'text-zinc-800' },
    success: { accent: 'bg-emerald-500', icon: 'bg-emerald-50 text-emerald-700 ring-emerald-100', value: 'text-emerald-700' },
    yellow: { accent: 'bg-avapex-yellow', icon: 'bg-avapex-yellow text-avapex-black ring-yellow-100', value: 'text-avapex-black' },
  }[tone];

  return (
    <article className="ui-card relative overflow-hidden p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <span className={`absolute inset-x-0 top-0 h-1 ${toneClassNames.accent}`} />
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${toneClassNames.icon}`}>{icon}</span>
      </div>
      <strong className={`block text-3xl font-semibold leading-none ${toneClassNames.value}`}>{value}</strong>
    </article>
  );
}

function TextField({ icon, label, onChange, required, type = 'text', value }: { icon: ReactNode; label: string; onChange: (value: string) => void; required?: boolean; type?: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-700">
        {icon}
        {label}
      </span>
      <input className="ui-input h-11 w-full px-3" required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextAreaField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zinc-700">{label}</span>
      <textarea className="ui-input min-h-24 w-full resize-y px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({ children, icon, label, onChange, required, value }: { children: ReactNode; icon: ReactNode; label: string; onChange: (value: string) => void; required?: boolean; value: string }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-700">
        {icon}
        {label}
      </span>
      <select className="ui-input h-11 w-full px-3" required={required} value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function statusIcon(status: ProgrammingStatus) {
  if (status === 'released') {
    return <Route size={20} />;
  }
  if (status === 'awaiting_invoice') {
    return <FileText size={20} />;
  }
  if (status === 'unloading') {
    return <Truck size={20} />;
  }
  if (status === 'in_transit') {
    return <Route size={20} />;
  }
  return <ClipboardList size={20} />;
}

function findDailyStatusOption(trip: Trip) {
  if ((trip.programmingStatus ?? 'loading') === 'awaiting_invoice') {
    return dailyStatusOptions.find((option) => option.value === 'awaiting_invoice') ?? dailyStatusOptions[6];
  }
  if (trip.operationalStatus) {
    const byOperationalStatus = dailyStatusOptions.find((option) => option.operationalStatus === trip.operationalStatus);
    if (byOperationalStatus) {
      return byOperationalStatus;
    }
  }
  if ((trip.programmingStatus ?? 'loading') === 'released') {
    return trip.operationType === 'loading' ? dailyStatusOptions[8] : dailyStatusOptions[7];
  }
  if ((trip.programmingStatus ?? 'loading') === 'unloading') {
    return dailyStatusOptions[4];
  }
  if ((trip.programmingStatus ?? 'loading') === 'in_transit') {
    return trip.operationType === 'unloading' ? dailyStatusOptions[1] : dailyStatusOptions[0];
  }
  return dailyStatusOptions[2];
}

function operationTypeLabel(type?: ProgrammingOperationType) {
  return type === 'unloading' ? 'DESCARGA' : 'CARGA';
}

function programmedVehicleTypeLabel(type?: ProgrammedVehicleType) {
  return programmedVehicleOptions.find((option) => option.value === type)?.label ?? '-';
}

function formatDateOnly(value: Date | null) {
  if (!value) {
    return '-';
  }
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
  }).format(value);
}

function formatTimeOnly(value: Date | null) {
  if (!value) {
    return '-';
  }
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function formatDateTimeShort(value: Date | null) {
  if (!value) {
    return '-';
  }
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(value);
}

function formatDateTimeInput(value: Date | null) {
  if (!value) {
    return '';
  }
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function formatDateInput(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}
