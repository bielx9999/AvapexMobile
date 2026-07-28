import { FormEvent, type ReactNode, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  MapPin,
  Pencil,
  Play,
  Plus,
  Route,
  Search,
  Truck,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import { adminWriteRepository } from '../../shared/data/firestoreCollections';
import type { AppUser, Trip, TripStatus, Vehicle } from '../../shared/domain/models';

type ProgramacaoPageProps = {
  loading: boolean;
  onChanged: () => Promise<void>;
  trips: Trip[];
  users: AppUser[];
  vehicles: Vehicle[];
};

const initialForm = {
  driverId: '',
  vehicleId: '',
  origin: '',
  destination: '',
  scheduledAt: '',
  status: 'pending' as TripStatus,
};

export function ProgramacaoPage({ loading, onChanged, trips, users, vehicles }: ProgramacaoPageProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState(initialForm);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | TripStatus>('all');
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
      if (status !== 'all' && trip.status !== status) {
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
        trip.origin,
        trip.destination,
        trip.driverName,
        driverNames.get(trip.driverId),
        trip.vehiclePlate,
        vehicleNames.get(trip.vehicleId),
        trip.status,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [driverId, driverNames, endDate, query, startDate, status, trips, vehicleNames]);

  const stats = useMemo(() => {
    const pending = trips.filter((trip) => trip.status === 'pending').length;
    const inProgress = trips.filter((trip) => trip.status === 'in_progress').length;
    const completed = trips.filter((trip) => trip.status === 'completed').length;
    const cancelled = trips.filter((trip) => trip.status === 'cancelled').length;
    return { cancelled, completed, inProgress, pending, total: trips.length };
  }, [trips]);

  function openCreateForm() {
    setForm(initialForm);
    setEditingTrip(null);
    setShowForm(true);
  }

  function openEditForm(trip: Trip) {
    setForm({
      driverId: trip.driverId,
      vehicleId: trip.vehicleId,
      origin: trip.origin,
      destination: trip.destination,
      scheduledAt: formatDateTimeInput(trip.scheduledAt),
      status: trip.status,
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
        throw new Error('Selecione motorista e veiculo validos.');
      }
      const savedTripId = await adminWriteRepository.saveTrip({
        id: editingTrip?.id,
        driverId: form.driverId,
        driverName: driver.name || driver.email,
        vehicleId: form.vehicleId,
        vehicleModel: vehicle.model,
        vehiclePlate: vehicle.plate,
        origin: form.origin,
        destination: form.destination,
        scheduledAt: new Date(form.scheduledAt),
        status: form.status,
      });
      if (editingTrip || form.status !== 'pending') {
        await adminWriteRepository.updateTripStatus(savedTripId, form.status);
      }
      closeForm();
      await onChanged();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Erro ao salvar programacao.');
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(trip: Trip, nextStatus: TripStatus) {
    setBusyTripId(trip.id);
    setError('');
    try {
      await adminWriteRepository.updateTripStatus(trip.id, nextStatus);
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatusCard icon={<Route size={20} />} label="Total" tone="dark" value={loading ? '-' : stats.total} />
        <StatusCard icon={<Clock3 size={20} />} label="Pendentes" tone="yellow" value={loading ? '-' : stats.pending} />
        <StatusCard icon={<Play size={20} />} label="Em andamento" tone="info" value={loading ? '-' : stats.inProgress} />
        <StatusCard icon={<CheckCircle2 size={20} />} label="Concluidas" tone="success" value={loading ? '-' : stats.completed} />
        <StatusCard icon={<XCircle size={20} />} label="Canceladas" tone="danger" value={loading ? '-' : stats.cancelled} />
      </section>

      <section className="ui-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="font-semibold">Gerenciar programacao</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[140px_140px_150px_190px_260px_auto]">
            <input className="ui-input h-10 px-3 text-sm" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            <input className="ui-input h-10 px-3 text-sm" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            <select className="ui-input h-10 px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as 'all' | TripStatus)}>
              <option value="all">Todos status</option>
              <option value="pending">Pendentes</option>
              <option value="in_progress">Em andamento</option>
              <option value="completed">Concluidas</option>
              <option value="cancelled">Canceladas</option>
            </select>
            <select className="ui-input h-10 px-3 text-sm" value={driverId} onChange={(event) => setDriverId(event.target.value)}>
              <option value="">Todos motoristas</option>
              {drivers.map((driver) => (
                <option key={driver.uid} value={driver.uid}>
                  {driver.name || driver.email}
                </option>
              ))}
            </select>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                className="ui-input h-10 w-full pl-10 pr-3 text-sm"
                placeholder="Buscar origem, destino, placa"
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

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Horario</th>
                <th className="px-4 py-3">Motorista</th>
                <th className="px-4 py-3">Veiculo</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Destino</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrips.map((trip) => (
                <tr className="border-t border-zinc-100" key={trip.id}>
                  <td className="px-4 py-3">{formatDate(trip.scheduledAt)}</td>
                  <td className="px-4 py-3 font-medium">{trip.driverName || driverNames.get(trip.driverId) || trip.driverId}</td>
                  <td className="px-4 py-3">{trip.vehiclePlate || vehicleNames.get(trip.vehicleId) || trip.vehicleId}</td>
                  <td className="px-4 py-3">{trip.origin || '-'}</td>
                  <td className="px-4 py-3">{trip.destination || '-'}</td>
                  <td className="px-4 py-3"><StatusPill status={trip.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <IconButton label="Editar programacao" disabled={busyTripId === trip.id} onClick={() => openEditForm(trip)}>
                        <Pencil size={17} />
                      </IconButton>
                      <IconButton label="Iniciar" disabled={busyTripId === trip.id || trip.status === 'in_progress'} onClick={() => void updateStatus(trip, 'in_progress')}>
                        <Play size={17} />
                      </IconButton>
                      <IconButton label="Concluir" disabled={busyTripId === trip.id || trip.status === 'completed'} onClick={() => void updateStatus(trip, 'completed')}>
                        <CheckCircle2 size={17} />
                      </IconButton>
                      <IconButton danger label="Cancelar" disabled={busyTripId === trip.id || trip.status === 'cancelled'} onClick={() => void updateStatus(trip, 'cancelled')}>
                        <XCircle size={17} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredTrips.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-zinc-500" colSpan={7}>
                    Nenhuma programacao encontrada.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6">
          <section className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl">
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
                  <h3 className="mb-3 text-sm font-semibold text-zinc-800">Atribuicao</h3>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <SelectField label="Motorista" value={form.driverId} onChange={(value) => setForm((current) => ({ ...current, driverId: value }))} required>
                      <option value="">Selecione</option>
                      {drivers.map((driver) => (
                        <option key={driver.uid} value={driver.uid}>
                          {driver.name || driver.email}
                        </option>
                      ))}
                    </SelectField>
                    <SelectField label="Veiculo" value={form.vehicleId} onChange={(value) => setForm((current) => ({ ...current, vehicleId: value }))} required>
                      <option value="">Selecione</option>
                      {activeVehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.plate} - {vehicle.fleetNumber || vehicle.model}
                        </option>
                      ))}
                    </SelectField>
                    <TextField label="Data e horario" type="datetime-local" value={form.scheduledAt} onChange={(value) => setForm((current) => ({ ...current, scheduledAt: value }))} required />
                  </div>
                </section>

                <section className="ui-card p-4">
                  <h3 className="mb-3 text-sm font-semibold text-zinc-800">Rota</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <TextField label="Origem" value={form.origin} onChange={(value) => setForm((current) => ({ ...current, origin: value }))} required />
                    <TextField label="Destino" value={form.destination} onChange={(value) => setForm((current) => ({ ...current, destination: value }))} required />
                  </div>
                </section>

                <section className="ui-card p-4">
                  <h3 className="mb-3 text-sm font-semibold text-zinc-800">Status</h3>
                  <SelectField label="Status da programacao" value={form.status} onChange={(value) => setForm((current) => ({ ...current, status: value as TripStatus }))}>
                    <option value="pending">Pendente</option>
                    <option value="in_progress">Em andamento</option>
                    <option value="completed">Concluida</option>
                    <option value="cancelled">Cancelada</option>
                  </SelectField>
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

type StatusCardProps = {
  icon: ReactNode;
  label: string;
  tone: 'dark' | 'yellow' | 'success' | 'danger' | 'info';
  value: number | string;
};

function StatusCard({ icon, label, tone, value }: StatusCardProps) {
  const toneClassNames = {
    danger: { accent: 'bg-red-500', icon: 'bg-red-50 text-red-700 ring-red-100', value: 'text-red-700' },
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

function TextField({ label, onChange, required, type = 'text', value }: { label: string; onChange: (value: string) => void; required?: boolean; type?: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-700">
        <MapPin size={15} />
        {label}
      </span>
      <input className="ui-input h-11 w-full px-3" required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({ children, label, onChange, required, value }: { children: ReactNode; label: string; onChange: (value: string) => void; required?: boolean; value: string }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-700">
        {label === 'Motorista' ? <UserRound size={15} /> : label === 'Veiculo' ? <Truck size={15} /> : <Route size={15} />}
        {label}
      </span>
      <select className="ui-input h-11 w-full px-3" required={required} value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function IconButton({ children, danger, disabled, label, onClick }: { children: ReactNode; danger?: boolean; disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      className={`ui-icon-button flex h-9 w-9 items-center justify-center disabled:cursor-not-allowed disabled:opacity-50 ${
        danger ? 'text-red-700 hover:bg-red-50' : 'text-zinc-700 hover:bg-zinc-50'
      }`}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function StatusPill({ status }: { status: TripStatus }) {
  const className =
    status === 'completed'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'cancelled'
        ? 'bg-red-50 text-red-700'
        : status === 'in_progress'
          ? 'bg-sky-50 text-sky-700'
          : 'bg-yellow-50 text-yellow-800';
  return <span className={`ui-pill ${className}`}>{tripStatusLabel(status)}</span>;
}

function tripStatusLabel(status: TripStatus) {
  const labels: Record<TripStatus, string> = {
    cancelled: 'Cancelada',
    completed: 'Concluida',
    in_progress: 'Em andamento',
    pending: 'Pendente',
  };
  return labels[status];
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
