import { FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CalendarClock,
  ClipboardList,
  Clock3,
  FileText,
  MapPin,
  Pencil,
  Plus,
  Route,
  Search,
  Trash2,
  Truck,
  UserRound,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { adminWriteRepository } from '../../shared/data/firestoreCollections';
import { EmptyState, ErrorBanner } from '../../shared/presentation/ui';
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

const stageCards: Array<{ status: ProgrammingStatus; label: string }> = [
  { status: 'in_transit', label: 'Em transito' },
  { status: 'loading', label: 'Carregando' },
  { status: 'unloading', label: 'Descarregando' },
  { status: 'awaiting_invoice', label: 'Aguardando NF' },
  { status: 'released', label: 'Liberado' },
];

const dailyStatusOptions: DailyStatusOption[] = [
  { value: 'transit_to_loading', label: 'EM TRANSITO PARA CARGA', programmingStatus: 'in_transit', operationalStatus: 'transit_to_loading', operationType: 'loading' },
  { value: 'transit_to_unloading', label: 'EM TRANSITO PARA DESCARGA', programmingStatus: 'in_transit', operationalStatus: 'transit_to_unloading', operationType: 'unloading' },
  { value: 'waiting_loading', label: 'AGUARDANDO CARREGAR', programmingStatus: 'loading', operationalStatus: 'waiting_loading', operationType: 'loading' },
  { value: 'loading', label: 'CARREGANDO', programmingStatus: 'loading', operationalStatus: 'loading', operationType: 'loading' },
  { value: 'waiting_unloading', label: 'AGUARDANDO DESCARGA', programmingStatus: 'unloading', operationalStatus: 'waiting_unloading', operationType: 'unloading' },
  { value: 'unloading', label: 'DESCARREGANDO', programmingStatus: 'unloading', operationalStatus: 'unloading', operationType: 'unloading' },
  { value: 'awaiting_invoice', label: 'AGUARDANDO NF', programmingStatus: 'awaiting_invoice', operationType: 'unloading' },
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
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

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
    const normalizedQuery = query.trim().toLowerCase();
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
    const scopedTrips = trips.filter((trip) => {
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

      const currentDailyStatus = findDailyStatusOption(trip);
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
    });

    return stageCards.map((column) => ({
      ...column,
      total: scopedTrips.filter((trip) => (trip.programmingStatus ?? 'loading') === column.status).length,
    }));
  }, [driverId, driverNames, endDate, query, startDate, trips, vehicleNames]);

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
      const shouldRevealGeneratedUnloading = !editingTrip && form.operationType === 'loading';
      await adminWriteRepository.saveTrip({
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
      if (shouldRevealGeneratedUnloading) {
        const daysToReveal = form.returnTrip ? 2 : 1;
        const generatedDate = formatDateInput(addDays(scheduledAt, daysToReveal));
        setEndDate((current) => (!current || current < generatedDate ? generatedDate : current));
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
      await adminWriteRepository.updateTripProgrammingStatus(
        trip,
        selected.programmingStatus,
        selected.operationalStatus,
        selected.operationType ?? trip.operationType,
      );
      await onChanged();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Erro ao atualizar programacao.');
    } finally {
      setBusyTripId('');
    }
  }

  async function deleteTrip(trip: Trip) {
    const confirmed = window.confirm('Excluir esta programacao? Esta acao nao pode ser desfeita.');
    if (!confirmed) {
      return;
    }

    setBusyTripId(trip.id);
    setError('');
    try {
      await adminWriteRepository.deleteTrip(trip);
      await onChanged();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Erro ao excluir programacao.');
    } finally {
      setBusyTripId('');
    }
  }

  const totalProgrammingCount = stats.reduce((total, item) => total + item.total, 0);

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {stats.map((item) => (
          <ProgrammingMetric
            icon={statusIcon(item.status)}
            key={item.status}
            label={item.label}
            percentage={totalProgrammingCount > 0 ? Math.round((item.total / totalProgrammingCount) * 100) : 0}
            status={item.status}
            value={loading ? '-' : item.total}
          />
        ))}
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-200 bg-white px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-zinc-950">Programacao diaria</h2>
            <button
              className="ui-button h-10 shrink-0 gap-2 bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
              onClick={openCreateForm}
              type="button"
            >
              <Plus size={18} />
              Nova Programacao
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[140px_140px_minmax(180px,1fr)_minmax(170px,1fr)_minmax(220px,1.4fr)]">
              <input aria-label="Data inicial" className="ui-input h-10 px-3 text-sm" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              <input aria-label="Data final" className="ui-input h-10 px-3 text-sm" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              <select aria-label="Status" className="ui-input h-10 px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | DailyStatusValue)}>
                <option value="all">Todos status</option>
                {dailyStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select aria-label="Motorista" className="ui-input h-10 px-3 text-sm" value={driverId} onChange={(event) => setDriverId(event.target.value)}>
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
          </div>
        </div>

        <div className="bg-zinc-50/70 p-3">
          {loading ? (
            <div className="grid gap-2">
              <ProgrammingCardSkeleton />
              <ProgrammingCardSkeleton />
            </div>
          ) : filteredTrips.length > 0 ? (
            <div className="grid gap-2">
              {filteredTrips.map((trip) => (
                <ProgrammingCard
                  busy={busyTripId === trip.id}
                  currentTime={currentTime}
                  driverName={trip.driverName || driverNames.get(trip.driverId) || trip.driverId}
                  key={trip.id}
                  onDelete={() => void deleteTrip(trip)}
                  onEdit={() => openEditForm(trip)}
                  onStatusChange={(value) => void updateDailyStatus(trip, value)}
                  trip={trip}
                  vehicleLabel={trip.vehiclePlate || vehicleNames.get(trip.vehicleId) || trip.vehicleId}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-200 bg-white">
              <EmptyState
                description="Ajuste o periodo ou os filtros para consultar outras cargas."
                title="Nenhuma programacao encontrada"
              />
            </div>
          )}
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

type ProgrammingCardProps = {
  busy: boolean;
  currentTime: number;
  driverName: string;
  onDelete: () => void;
  onEdit: () => void;
  onStatusChange: (value: DailyStatusValue) => void;
  trip: Trip;
  vehicleLabel: string;
};

function ProgrammingCard({
  busy,
  currentTime,
  driverName,
  onDelete,
  onEdit,
  onStatusChange,
  trip,
  vehicleLabel,
}: ProgrammingCardProps) {
  const currentStatus = findDailyStatusOption(trip);
  const operationType = trip.operationType ?? 'loading';
  const statusOptions = dailyStatusOptions.filter((option) => option.operationType === operationType);
  const gps = getGpsConnection(trip, currentTime);

  return (
    <article className={`w-full overflow-hidden rounded-md border border-zinc-200 border-l-4 bg-white shadow-sm ${statusBorderClass(trip.programmingStatus ?? 'loading')}`}>
      <div className="grid xl:grid-cols-[minmax(220px,1.05fr)_150px_minmax(290px,1.4fr)_minmax(300px,1.3fr)]">
        <section className="min-w-0 border-b border-zinc-200 px-3 py-3 xl:border-b-0 xl:border-r">
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 flex-1 text-[11px] font-bold uppercase leading-tight text-zinc-900">Programacao - {trip.customerRequestNumber || 'Sem numero'}</h3>
            <span className={operationTypeChipClass(operationType)}>{operationTypeLabel(operationType)}</span>
          </div>
          <p className="mt-1 truncate text-[11px] text-zinc-500" title={`${vehicleLabel} | ${programmedVehicleTypeLabel(trip.programmedVehicleType)} | ${driverName}`}>
            {vehicleLabel || 'Sem veiculo'} | {programmedVehicleTypeLabel(trip.programmedVehicleType)} | {driverName || 'Sem motorista'}
          </p>
          <p className="mt-1.5 truncate text-xs font-semibold text-zinc-800" title={`${trip.origin || '-'} -> ${trip.destination || '-'}`}>
            {trip.origin || '-'} <span className="px-1 text-zinc-400">-&gt;</span> {trip.destination || '-'}
          </p>
          <p className="mt-1 truncate text-[11px] text-zinc-500" title={trip.additionalInfo || ''}>
            {trip.additionalInfo || (trip.returnTrip ? 'Programacao com retorno' : 'Sem informacoes adicionais')}
          </p>
        </section>

        <section className="min-w-0 border-b border-zinc-200 px-3 py-3 xl:border-b-0 xl:border-r">
          <strong className="block text-[10px] font-bold uppercase leading-tight text-zinc-800" title={currentStatus.label}>{currentStatus.label}</strong>
          <p className={`mt-1 flex items-center gap-1 text-xs font-semibold ${gps.online ? 'text-emerald-600' : 'text-red-600'}`}>
            {gps.online ? <Wifi size={13} /> : <WifiOff size={13} />}
            {gps.online ? 'ONLINE' : 'OFFLINE'}
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">{gps.lastUpdateLabel}</p>
          {gps.mapUrl ? (
            <a className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-zinc-600 hover:text-zinc-950" href={gps.mapUrl} rel="noreferrer" target="_blank">
              <MapPin size={11} /> Ultima posicao
            </a>
          ) : null}
        </section>

        <section className="min-w-0 border-b border-zinc-200 px-3 py-3 xl:border-b-0 xl:border-r">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
            <CardInfo icon={<CalendarDays size={15} />} label="Programada" value={`${formatDateOnly(trip.scheduledAt)} ${formatTimeOnly(trip.scheduledAt)}`} />
            <CardInfo icon={<CalendarClock size={15} />} label="Previsao" value={formatDateTimeShort(trip.expectedArrivalAt ?? null)} />
            <CardInfo icon={<Truck size={15} />} label="Veiculo" value={`${vehicleLabel || '-'} - ${programmedVehicleTypeLabel(trip.programmedVehicleType)}`} />
            <CardInfo icon={<Clock3 size={15} />} label="Atualizada" value={formatRelativeDate(trip.statusUpdatedAt, currentTime)} />
          </div>
        </section>

        <section className="flex min-w-0 flex-col justify-between gap-2 bg-zinc-50/40 px-3 py-3">
          <DeliveryProgress currentValue={currentStatus.value} operationType={operationType} />
          <div className="flex items-center gap-2">
            <select aria-label="Etapa da entrega" className="ui-input h-8 min-w-0 flex-1 px-2 text-[11px] font-semibold" disabled={busy} onChange={(event) => onStatusChange(event.target.value as DailyStatusValue)} value={currentStatus.value}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button aria-label="Editar programacao" className="ui-icon-button h-8 w-8 shrink-0 border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100" disabled={busy} onClick={onEdit} title="Editar programacao" type="button"><Pencil size={14} /></button>
            <button aria-label="Excluir programacao" className="ui-icon-button h-8 w-8 shrink-0 border-red-200 bg-white text-red-600 hover:bg-red-50" disabled={busy} onClick={onDelete} title="Excluir programacao" type="button"><Trash2 size={14} /></button>
          </div>
        </section>
      </div>
    </article>
  );
}

function CardInfo({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">{icon}{label}</p>
      <p className="mt-0.5 truncate text-[11px] font-semibold text-zinc-900" title={value}>{value}</p>
    </div>
  );
}

function DeliveryProgress({ currentValue, operationType }: { currentValue: DailyStatusValue; operationType: ProgrammingOperationType }) {
  const stages = dailyStatusOptions.filter((option) => option.operationType === operationType);
  const currentIndex = Math.max(0, stages.findIndex((stage) => stage.value === currentValue));

  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="text-[10px] font-medium text-zinc-500">Andamento</p>
        <strong className="truncate text-[10px] text-zinc-800">{stages[currentIndex]?.label}</strong>
      </div>
      <ol className="grid gap-1" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
        {stages.map((stage, index) => {
          const completed = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li className="min-w-0 text-center" key={stage.value} title={stage.label}>
              <span className={`flex h-5 w-full items-center justify-center rounded-sm border text-[9px] font-bold ${
                completed
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : active
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-zinc-200 text-zinc-500'
              }`}>
                {index + 1}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ProgrammingCardSkeleton() {
  return (
    <div aria-label="Carregando programacao" className="grid animate-pulse gap-3 rounded-md border border-zinc-200 border-l-4 border-l-zinc-300 bg-white p-3 xl:grid-cols-[1fr_150px_1.4fr_1.3fr]" role="status">
      <span className="h-16 rounded bg-zinc-100" />
      <span className="h-16 rounded bg-zinc-100" />
      <div className="grid grid-cols-4 gap-2">{Array.from({ length: 4 }).map((_, index) => <span className="h-12 rounded bg-zinc-100" key={index} />)}</div>
      <span className="h-16 rounded bg-zinc-100" />
    </div>
  );
}

function ProgrammingMetric({ icon, label, percentage, status, value }: { icon: ReactNode; label: string; percentage: number; status: ProgrammingStatus; value: number | string }) {
  return (
    <div className="flex min-h-20 items-center gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${metricIconClass(status)}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium text-zinc-500">{label}</span>
        <div className="mt-0.5 flex items-baseline justify-between gap-2">
          <strong className="text-xl font-semibold text-zinc-950">{value}</strong>
          <span className="text-xs font-medium text-zinc-500">{percentage}%</span>
        </div>
      </div>
    </div>
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

function statusBorderClass(status: ProgrammingStatus) {
  if (status === 'in_transit') return 'border-l-cyan-400';
  if (status === 'unloading') return 'border-l-lime-500';
  if (status === 'awaiting_invoice') return 'border-l-amber-400';
  if (status === 'released') return 'border-l-emerald-500';
  return 'border-l-yellow-400';
}

function metricIconClass(status: ProgrammingStatus) {
  if (status === 'in_transit') return 'bg-cyan-50 text-cyan-700';
  if (status === 'unloading') return 'bg-lime-50 text-lime-700';
  if (status === 'awaiting_invoice') return 'bg-amber-50 text-amber-700';
  if (status === 'released') return 'bg-emerald-50 text-emerald-700';
  return 'bg-yellow-50 text-yellow-700';
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

function operationTypeChipClass(type?: ProgrammingOperationType) {
  return type === 'unloading'
    ? 'rounded-full bg-zinc-900 px-2 py-0.5 text-[9px] font-semibold text-white'
    : 'rounded-full bg-avapex-yellow px-2 py-0.5 text-[9px] font-semibold text-avapex-black';
}

function programmedVehicleTypeLabel(type?: ProgrammedVehicleType) {
  return programmedVehicleOptions.find((option) => option.value === type)?.label ?? '-';
}

function getGpsConnection(trip: Trip, currentTime: number) {
  const latitude = typeof trip.gpsLocation?.latitude === 'number' ? trip.gpsLocation.latitude : null;
  const longitude = typeof trip.gpsLocation?.longitude === 'number' ? trip.gpsLocation.longitude : null;
  const hasCoordinates = latitude !== null && longitude !== null;
  const elapsed = trip.lastGpsUpdateAt ? currentTime - trip.lastGpsUpdateAt.getTime() : Number.POSITIVE_INFINITY;
  const online = hasCoordinates && elapsed >= 0 && elapsed <= 3 * 60_000;
  const mapUrl = hasCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
    : '';

  return {
    lastUpdateLabel: trip.lastGpsUpdateAt
      ? formatRelativeDate(trip.lastGpsUpdateAt, currentTime)
      : 'Sem sinal registrado',
    mapUrl,
    online,
  };
}

function formatRelativeDate(value: Date | null | undefined, currentTime: number) {
  if (!value) {
    return '-';
  }
  const elapsedMinutes = Math.max(0, Math.floor((currentTime - value.getTime()) / 60_000));
  if (elapsedMinutes < 1) {
    return 'Atualizado agora';
  }
  if (elapsedMinutes < 60) {
    return `Ha ${elapsedMinutes} min`;
  }
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `Ha ${elapsedHours} h`;
  }
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value);
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

function addDays(value: Date, days: number) {
  const nextDate = new Date(value);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function formatDateInput(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}
