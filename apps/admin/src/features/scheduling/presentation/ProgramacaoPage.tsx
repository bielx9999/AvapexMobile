import { FormEvent, type ReactNode, useMemo, useState } from 'react';
import {
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

const kanbanColumns: Array<{ status: ProgrammingStatus; label: string; tone: 'dark' | 'yellow' | 'info' | 'success' }> = [
  { status: 'loading', label: 'Carregando', tone: 'yellow' },
  { status: 'unloading_in_transit', label: 'Descarregando em transito', tone: 'info' },
  { status: 'awaiting_invoice', label: 'Aguardando NF', tone: 'dark' },
  { status: 'released', label: 'Liberado', tone: 'success' },
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
  customerRequestNumber: '',
  destination: '',
  driverId: '',
  origin: '',
  programmedVehicleType: 'truck' as ProgrammedVehicleType,
  programmingStatus: 'loading' as ProgrammingStatus,
  returnTrip: false,
  scheduledAt: '',
  vehicleId: '',
};

export function ProgramacaoPage({ loading, onChanged, trips, users, vehicles }: ProgramacaoPageProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState(initialForm);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | ProgrammingStatus>('all');
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

    return trips.filter((trip) => {
      const tripProgrammingStatus = trip.programmingStatus ?? 'loading';
      if (status !== 'all' && tripProgrammingStatus !== status) {
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
        trip.customerRequestNumber,
        trip.origin,
        trip.destination,
        trip.driverName,
        driverNames.get(trip.driverId),
        trip.vehiclePlate,
        vehicleNames.get(trip.vehicleId),
        programmedVehicleTypeLabel(trip.programmedVehicleType),
        programmingStatusLabel(tripProgrammingStatus),
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [driverId, driverNames, endDate, query, startDate, status, trips, vehicleNames]);

  const stats = useMemo(() => {
    return kanbanColumns.map((column) => ({
      ...column,
      total: trips.filter((trip) => (trip.programmingStatus ?? 'loading') === column.status).length,
    }));
  }, [trips]);

  function openCreateForm() {
    setForm(initialForm);
    setEditingTrip(null);
    setShowForm(true);
  }

  function openEditForm(trip: Trip) {
    setForm({
      customerRequestNumber: trip.customerRequestNumber ?? '',
      destination: trip.destination,
      driverId: trip.driverId,
      origin: trip.origin,
      programmedVehicleType: trip.programmedVehicleType ?? 'truck',
      programmingStatus: trip.programmingStatus ?? 'loading',
      returnTrip: trip.returnTrip ?? false,
      scheduledAt: formatDateTimeInput(trip.scheduledAt),
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const driver = drivers.find((item) => item.uid === form.driverId);
      const vehicle = vehicles.find((item) => item.id === form.vehicleId);
      if (!driver || !vehicle) {
        throw new Error('Selecione motorista e placa cadastrada validos.');
      }
      await adminWriteRepository.saveTrip({
        customerRequestNumber: form.customerRequestNumber,
        destination: form.destination,
        driverId: form.driverId,
        driverName: driver.name || driver.email,
        id: editingTrip?.id,
        origin: form.origin,
        programmedVehicleType: form.programmedVehicleType,
        programmingStatus: form.programmingStatus,
        returnTrip: form.returnTrip,
        scheduledAt: new Date(form.scheduledAt),
        status: form.programmingStatus === 'released' ? 'completed' : form.programmingStatus === 'loading' ? 'pending' : 'in_progress',
        vehicleId: form.vehicleId,
        vehicleModel: vehicle.model,
        vehiclePlate: vehicle.plate,
      });
      closeForm();
      await onChanged();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Erro ao salvar programacao.');
    } finally {
      setSubmitting(false);
    }
  }

  async function updateProgrammingStatus(trip: Trip, nextStatus: ProgrammingStatus) {
    setBusyTripId(trip.id);
    setError('');
    try {
      await adminWriteRepository.updateTripProgrammingStatus(trip.id, nextStatus);
      await onChanged();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Erro ao atualizar programacao.');
    } finally {
      setBusyTripId('');
    }
  }

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 xl:flex-row xl:items-end xl:justify-between">
          <h2 className="font-semibold">Kanban de programacao</h2>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[140px_140px_190px_190px_260px_auto]">
            <input className="ui-input h-10 px-3 text-sm" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            <input className="ui-input h-10 px-3 text-sm" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            <select className="ui-input h-10 px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as 'all' | ProgrammingStatus)}>
              <option value="all">Todas etapas</option>
              {kanbanColumns.map((column) => (
                <option key={column.status} value={column.status}>{column.label}</option>
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

        <div className="grid gap-3 overflow-x-auto bg-zinc-50 p-3 xl:grid-cols-4">
          {kanbanColumns.map((column) => {
            const columnTrips = filteredTrips.filter((trip) => (trip.programmingStatus ?? 'loading') === column.status);
            return (
              <section className="min-h-[420px] min-w-[280px] rounded-2xl border border-zinc-200 bg-white" key={column.status}>
                <header className="flex items-center justify-between border-b border-zinc-200 px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ring-1 ${columnIconClass(column.tone)}`}>
                      {statusIcon(column.status)}
                    </span>
                    <h3 className="text-sm font-semibold">{column.label}</h3>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">{columnTrips.length}</span>
                </header>
                <div className="space-y-3 p-3">
                  {columnTrips.map((trip) => (
                    <KanbanCard
                      busy={busyTripId === trip.id}
                      driverName={trip.driverName || driverNames.get(trip.driverId) || trip.driverId}
                      key={trip.id}
                      onEdit={() => openEditForm(trip)}
                      onMove={(nextStatus) => void updateProgrammingStatus(trip, nextStatus)}
                      trip={trip}
                      vehicleName={trip.vehiclePlate || vehicleNames.get(trip.vehicleId) || trip.vehicleId}
                    />
                  ))}
                  {!loading && columnTrips.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-zinc-200 px-3 py-8 text-center text-sm text-zinc-500">
                      Nenhuma programacao nesta etapa.
                    </p>
                  ) : null}
                </div>
              </section>
            );
          })}
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
                      label="N° solicitacao do cliente"
                      onChange={(value) => setForm((current) => ({ ...current, customerRequestNumber: value }))}
                      required
                      value={form.customerRequestNumber}
                    />
                    <TextField
                      icon={<Clock3 size={15} />}
                      label="Data e horario"
                      onChange={(value) => setForm((current) => ({ ...current, scheduledAt: value }))}
                      required
                      type="datetime-local"
                      value={form.scheduledAt}
                    />
                    <SelectField
                      icon={<Route size={15} />}
                      label="Etapa"
                      onChange={(value) => setForm((current) => ({ ...current, programmingStatus: value as ProgrammingStatus }))}
                      value={form.programmingStatus}
                    >
                      {kanbanColumns.map((column) => (
                        <option key={column.status} value={column.status}>{column.label}</option>
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

function KanbanCard({
  busy,
  driverName,
  onEdit,
  onMove,
  trip,
  vehicleName,
}: {
  busy: boolean;
  driverName: string;
  onEdit: () => void;
  onMove: (status: ProgrammingStatus) => void;
  trip: Trip;
  vehicleName: string;
}) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Solicitacao</p>
          <h4 className="mt-1 font-semibold">{trip.customerRequestNumber || '-'}</h4>
        </div>
        <button className="ui-icon-button flex h-9 w-9 items-center justify-center text-zinc-700 hover:bg-zinc-50" disabled={busy} onClick={onEdit} title="Editar programacao" type="button">
          <Pencil size={17} />
        </button>
      </div>
      <div className="space-y-2 text-sm">
        <InfoLine icon={<UserRound size={15} />} text={driverName} />
        <InfoLine icon={<Truck size={15} />} text={`${programmedVehicleTypeLabel(trip.programmedVehicleType)} - ${vehicleName}`} />
        <InfoLine icon={<MapPin size={15} />} text={`${trip.origin || '-'} -> ${trip.destination || '-'}`} />
        <InfoLine icon={<Clock3 size={15} />} text={formatDate(trip.scheduledAt)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="ui-pill bg-zinc-100 text-zinc-700">{trip.returnTrip ? 'Retorno: Sim' : 'Retorno: Nao'}</span>
      </div>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Mover para</span>
        <select
          className="ui-input h-9 w-full px-2 text-sm"
          disabled={busy}
          value={trip.programmingStatus ?? 'loading'}
          onChange={(event) => onMove(event.target.value as ProgrammingStatus)}
        >
          {kanbanColumns.map((column) => (
            <option key={column.status} value={column.status}>{column.label}</option>
          ))}
        </select>
      </label>
    </article>
  );
}

function StatusCard({ icon, label, tone, value }: { icon: ReactNode; label: string; tone: 'dark' | 'yellow' | 'success' | 'info'; value: number | string }) {
  const toneClassNames = {
    dark: { accent: 'bg-avapex-black', icon: 'bg-avapex-black text-white ring-zinc-200', value: 'text-avapex-black' },
    info: { accent: 'bg-sky-500', icon: 'bg-sky-50 text-sky-700 ring-sky-100', value: 'text-sky-700' },
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

function InfoLine({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <p className="flex items-center gap-2 text-zinc-700">
      <span className="text-zinc-400">{icon}</span>
      <span className="truncate">{text}</span>
    </p>
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
  if (status === 'unloading_in_transit') {
    return <Truck size={20} />;
  }
  return <ClipboardList size={20} />;
}

function columnIconClass(tone: 'dark' | 'yellow' | 'info' | 'success') {
  const classes = {
    dark: 'bg-avapex-black text-white ring-zinc-200',
    info: 'bg-sky-50 text-sky-700 ring-sky-100',
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    yellow: 'bg-avapex-yellow text-avapex-black ring-yellow-100',
  };
  return classes[tone];
}

function programmingStatusLabel(status: ProgrammingStatus) {
  return kanbanColumns.find((column) => column.status === status)?.label ?? status;
}

function programmedVehicleTypeLabel(type?: ProgrammedVehicleType) {
  return programmedVehicleOptions.find((option) => option.value === type)?.label ?? '-';
}

function formatDate(value: Date | null) {
  if (!value) {
    return '-';
  }
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value);
}

function formatDateTimeInput(value: Date | null) {
  if (!value) {
    return '';
  }
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}
