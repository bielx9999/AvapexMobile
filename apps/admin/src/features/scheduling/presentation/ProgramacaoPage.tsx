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

const kanbanColumns: Array<{ status: ProgrammingStatus; label: string; tone: 'dark' | 'yellow' | 'info' | 'success' | 'neutral' }> = [
  { status: 'in_transit', label: 'Em transito', tone: 'info' },
  { status: 'loading', label: 'Carregando', tone: 'yellow' },
  { status: 'unloading', label: 'Descarregando', tone: 'neutral' },
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
      const savedTripId = await adminWriteRepository.saveTrip({
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
      if (form.programmingStatus === 'released') {
        const result = await adminWriteRepository.updateTripProgrammingStatus(
          {
            completedAt: editingTrip?.completedAt ?? null,
            customerRequestNumber: form.customerRequestNumber,
            deliveryDocs: editingTrip?.deliveryDocs ?? [],
            destination: form.destination,
            driverId: form.driverId,
            driverName: driver.name || driver.email,
            id: savedTripId,
            origin: form.origin,
            operationalStatus: undefined,
            programmedVehicleType: form.programmedVehicleType,
            programmingStatus: form.programmingStatus,
            returnGeneratedTripId: editingTrip?.returnGeneratedTripId,
            returnSourceTripId: editingTrip?.returnSourceTripId,
            returnTrip: form.returnTrip,
            scheduledAt: new Date(form.scheduledAt),
            startedAt: editingTrip?.startedAt ?? null,
            status: 'completed',
            unloadingGeneratedTripId: editingTrip?.unloadingGeneratedTripId,
            unloadingSourceTripId: editingTrip?.unloadingSourceTripId,
            vehicleId: form.vehicleId,
            vehicleModel: vehicle.model,
            vehiclePlate: vehicle.plate,
          },
          'released',
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

  async function updateProgrammingStatus(trip: Trip, nextStatus: ProgrammingStatus) {
    if ((trip.programmingStatus ?? 'loading') === nextStatus) {
      return;
    }
    setBusyTripId(trip.id);
    setError('');
    try {
      const result = await adminWriteRepository.updateTripProgrammingStatus(trip, nextStatus);
      revealGeneratedScheduling(result);
      await onChanged();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Erro ao atualizar programacao.');
    } finally {
      setBusyTripId('');
    }
  }

  async function updateOperationalStatus(trip: Trip, nextStatus: ProgrammingOperationalStatus) {
    setBusyTripId(trip.id);
    setError('');
    try {
      await adminWriteRepository.updateTripOperationalStatus(trip.id, nextStatus);
      await onChanged();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Erro ao atualizar status operacional.');
    } finally {
      setBusyTripId('');
    }
  }

  function revealGeneratedScheduling(result: Awaited<ReturnType<typeof adminWriteRepository.updateTripProgrammingStatus>>) {
    if (!result) {
      return;
    }
    const generatedDate = formatDateInput(result.generatedDate);
    setStatus('all');
    setEndDate((current) => (!current || current < generatedDate ? generatedDate : current));
  }

  return (
    <div className="space-y-5">
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
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 xl:flex-row xl:items-end xl:justify-between">
          <h2 className="font-semibold">Planilha de programacao</h2>
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

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1500px] border-separate border-spacing-0 text-left text-xs">
            <thead className="sticky top-0 z-10 bg-zinc-50 text-[11px] uppercase text-zinc-500">
              <tr>
                <th className="border-b border-zinc-200 px-3 py-3">Data</th>
                <th className="border-b border-zinc-200 px-3 py-3">Solicitacao</th>
                <th className="border-b border-zinc-200 px-3 py-3">Motorista</th>
                <th className="border-b border-zinc-200 px-3 py-3">Placa</th>
                <th className="border-b border-zinc-200 px-3 py-3">Veiculo</th>
                <th className="border-b border-zinc-200 px-3 py-3">Origem</th>
                <th className="border-b border-zinc-200 px-3 py-3">Destino</th>
                <th className="border-b border-zinc-200 px-3 py-3">Retorno</th>
                <th className="border-b border-zinc-200 px-3 py-3">Etapa</th>
                <th className="border-b border-zinc-200 px-3 py-3">Status</th>
                <th className="border-b border-zinc-200 px-3 py-3">Observacao</th>
                <th className="border-b border-zinc-200 px-3 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrips.map((trip) => (
                <tr className="group" key={trip.id}>
                  <td className="border-b border-zinc-100 px-3 py-2 align-middle">{formatDate(trip.scheduledAt)}</td>
                  <td className="border-b border-zinc-100 px-3 py-2 align-middle font-semibold">{trip.customerRequestNumber || '-'}</td>
                  <td className="border-b border-zinc-100 px-3 py-2 align-middle">{trip.driverName || driverNames.get(trip.driverId) || trip.driverId}</td>
                  <td className="border-b border-zinc-100 px-3 py-2 align-middle">{trip.vehiclePlate || vehicleNames.get(trip.vehicleId) || trip.vehicleId}</td>
                  <td className="border-b border-zinc-100 px-3 py-2 align-middle">{programmedVehicleTypeLabel(trip.programmedVehicleType)}</td>
                  <td className="border-b border-zinc-100 px-3 py-2 align-middle">{trip.origin || '-'}</td>
                  <td className="border-b border-zinc-100 px-3 py-2 align-middle">{trip.destination || '-'}</td>
                  <td className="border-b border-zinc-100 px-3 py-2 align-middle">
                    <span className="ui-pill bg-zinc-100 text-zinc-700">{trip.returnTrip ? 'Sim' : 'Nao'}</span>
                  </td>
                  <td className="border-b border-zinc-100 px-3 py-2 align-middle">
                    <select
                      className="ui-input h-8 w-44 px-2 text-xs"
                      disabled={busyTripId === trip.id}
                      value={trip.programmingStatus ?? 'loading'}
                      onChange={(event) => void updateProgrammingStatus(trip, event.target.value as ProgrammingStatus)}
                    >
                      {kanbanColumns.map((column) => (
                        <option key={column.status} value={column.status}>{column.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="border-b border-zinc-100 px-3 py-2 align-middle">
                    <SpreadsheetOperationalStatusField
                      busy={busyTripId === trip.id}
                      onChange={(nextStatus) => void updateOperationalStatus(trip, nextStatus)}
                      trip={trip}
                    />
                  </td>
                  <td className="border-b border-zinc-100 px-3 py-2 align-middle">
                    <GeneratedBadges trip={trip} />
                  </td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-right align-middle">
                    <button className="ui-icon-button inline-flex h-8 w-8 items-center justify-center text-zinc-700 hover:bg-zinc-50" disabled={busyTripId === trip.id} onClick={() => openEditForm(trip)} title="Editar programacao" type="button">
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filteredTrips.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-zinc-500" colSpan={12}>
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

function SpreadsheetOperationalStatusField({
  busy,
  onChange,
  trip,
}: {
  busy: boolean;
  onChange: (status: ProgrammingOperationalStatus) => void;
  trip: Trip;
}) {
  const options = operationalStatusOptions(trip.programmingStatus ?? 'loading');
  if (options.length === 0) {
    return <span className="rounded-xl bg-zinc-50 px-2 py-2 text-xs text-zinc-500">Sem status</span>;
  }

  const currentStatus = trip.operationalStatus && options.some((option) => option.value === trip.operationalStatus)
    ? trip.operationalStatus
    : options[0].value;

  return (
    <label className="block">
      <select
        className="ui-input h-8 w-48 px-2 text-xs"
        disabled={busy}
        value={currentStatus}
        onChange={(event) => onChange(event.target.value as ProgrammingOperationalStatus)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function GeneratedBadges({ trip }: { trip: Trip }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {trip.returnGeneratedTripId ? <span className="ui-pill bg-emerald-50 text-emerald-700">Retorno gerado</span> : null}
      {trip.returnSourceTripId ? <span className="ui-pill bg-sky-50 text-sky-700">Retorno</span> : null}
      {trip.unloadingGeneratedTripId ? <span className="ui-pill bg-emerald-50 text-emerald-700">Descarga gerada</span> : null}
      {trip.unloadingSourceTripId ? <span className="ui-pill bg-zinc-100 text-zinc-700">Descarga</span> : null}
      {!trip.returnGeneratedTripId && !trip.returnSourceTripId && !trip.unloadingGeneratedTripId && !trip.unloadingSourceTripId ? '-' : null}
    </div>
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

function programmingStatusLabel(status: ProgrammingStatus) {
  return kanbanColumns.find((column) => column.status === status)?.label ?? status;
}

function operationalStatusOptions(programmingStatus: ProgrammingStatus) {
  const options: Partial<Record<ProgrammingStatus, Array<{ value: ProgrammingOperationalStatus; label: string }>>> = {
    in_transit: [
      { value: 'transit_to_loading', label: 'Transito para Carga' },
      { value: 'transit_to_unloading', label: 'Transito para descarga' },
    ],
    loading: [
      { value: 'waiting_loading', label: 'Aguardando Carregar' },
      { value: 'loading', label: 'Carregando' },
    ],
    released: [
      { value: 'released_unloading', label: 'Liberado da descarga' },
      { value: 'released_loading', label: 'Liberado da carga' },
    ],
    unloading: [
      { value: 'waiting_unloading', label: 'Aguardando descarga' },
      { value: 'unloading', label: 'Descarregando' },
    ],
  };
  return options[programmingStatus] ?? [];
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

function formatDateInput(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}
