import {
  CalendarClock,
  ClipboardList,
  FileText,
  Info,
  LoaderCircle,
  MapPin,
  Navigation,
  Plus,
  Route,
  Truck,
  UserRound,
  X,
} from 'lucide-react';
import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { adminWriteRepository } from '../../../shared/data/firestoreCollections';
import type {
  AddressSnapshot,
  AppUser,
  Delivery,
  ProgrammingOperationType,
  ProgrammedVehicleType,
  RoutePlan,
  Trip,
  TripCteDocument,
  TripRouteStop,
  Vehicle,
} from '../../../shared/domain/models';
import {
  deleteTripCtePdf,
  uploadTripCtePdf,
} from '../../data/tripDocumentStorage';
import { dailyStatusOptions, findDailyStatusOption, type DailyStatusValue } from '../programacaoConfig';
import { CteDocumentSection } from './CteDocumentSection';
import { emptyCteDraft, type CteDocumentDraft } from './cteDocumentDraft';
import { SearchableCombobox, type ComboboxOption } from './SearchableCombobox';

type ProgramacaoFormProps = {
  clientNames: string[];
  deliveries: Delivery[];
  drivers: AppUser[];
  editingTrip: Trip | null;
  onCancel: () => void;
  onSaved: (result: { created: boolean; operationType: ProgrammingOperationType; returnTrip: boolean; scheduledAt: Date }) => Promise<void>;
  routes: RoutePlan[];
  vehicles: Vehicle[];
};

type ProgramacaoFormState = {
  additionalInfo: string;
  clientName: string;
  cteDocuments: CteDocumentDraft[];
  customerRequestNumber: string;
  destination: string;
  destinationLocation?: AddressSnapshot;
  driverId: string;
  expectedArrivalAt: string;
  operationType: ProgrammingOperationType;
  origin: string;
  originLocation?: AddressSnapshot;
  returnTrip: boolean;
  routeId: string;
  routeName: string;
  routeStops: TripRouteStop[];
  scheduledAt: string;
  statusValue: DailyStatusValue;
  vehicleId: string;
};

export function ProgramacaoForm({
  clientNames,
  deliveries,
  drivers,
  editingTrip,
  onCancel,
  onSaved,
  routes,
  vehicles,
}: ProgramacaoFormProps) {
  const [form, setForm] = useState<ProgramacaoFormState>(() => initialForm(editingTrip));
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === form.vehicleId);
  const selectedRoute = routes.find((route) => route.id === form.routeId);
  const locationSnapshots = useMemo(() => collectLocationSnapshots(routes), [routes]);
  const clientOptions = useMemo<ComboboxOption[]>(
    () => clientNames.map((name) => ({ label: name, value: name })),
    [clientNames],
  );
  const driverOptions = useMemo<ComboboxOption[]>(
    () => drivers.map((driver) => ({
      value: driver.uid,
      label: driver.name || driver.email,
      description: driver.email,
      searchText: driver.email,
    })),
    [drivers],
  );
  const vehicleOptions = useMemo<ComboboxOption[]>(
    () => vehicles.map((vehicle) => ({
      value: vehicle.id,
      label: [vehicle.fleetNumber, vehicle.plate, vehicleTypeLabel(vehicle)].filter(Boolean).join(' - '),
      description: [vehicle.model, vehicle.year].filter(Boolean).join(' - '),
      searchText: `${vehicle.plate} ${vehicle.fleetNumber} ${vehicle.model}`,
    })),
    [vehicles],
  );
  const routeOptions = useMemo<ComboboxOption[]>(
    () => routes.map((routePlan) => ({
      value: routePlan.id,
      label: routePlan.code || `${routePlan.startAddress.formattedAddress} - ${routePlan.endAddress.formattedAddress}`,
      description: `${routePlan.startAddress.formattedAddress} -> ${routePlan.endAddress.formattedAddress}`,
      searchText: `${routePlan.code} ${routePlan.startAddress.formattedAddress} ${routePlan.endAddress.formattedAddress}`,
    })),
    [routes],
  );
  const locationOptions = useMemo<ComboboxOption[]>(
    () => locationSnapshots.map((location) => ({
      value: location.formattedAddress,
      label: location.formattedAddress,
      searchText: `${location.city ?? ''} ${location.state ?? ''} ${location.postalCode ?? ''}`,
    })),
    [locationSnapshots],
  );

  function updateField<K extends keyof ProgramacaoFormState>(field: K, value: ProgramacaoFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  }

  function updateOperationType(value: ProgrammingOperationType) {
    const fallback = value === 'unloading' ? dailyStatusOptions[4] : dailyStatusOptions[2];
    setForm((current) => ({
      ...current,
      operationType: value,
      statusValue: fallback.value,
    }));
  }

  function updateStatus(value: DailyStatusValue) {
    const selected = dailyStatusOptions.find((option) => option.value === value) ?? dailyStatusOptions[2];
    setForm((current) => ({
      ...current,
      operationType: selected.operationType ?? current.operationType,
      statusValue: selected.value,
    }));
  }

  function selectRoute(routeId: string) {
    if (!routeId) {
      setForm((current) => ({ ...current, routeId: '', routeName: '', routeStops: [] }));
      return;
    }
    const routePlan = routes.find((route) => route.id === routeId);
    if (!routePlan) {
      return;
    }
    const routeStops = deliveries
      .filter((delivery) => delivery.routeId === routeId)
      .sort((a, b) => a.sequence - b.sequence)
      .map<TripRouteStop>((delivery, index) => ({
        name: delivery.clientName || `Parada ${index + 1}`,
        address: delivery.address.formattedAddress,
        latitude: delivery.address.latitude,
        longitude: delivery.address.longitude,
        locationId: '',
        order: index + 1,
      }))
      .filter((stop) => stop.address !== routePlan.startAddress.formattedAddress && stop.address !== routePlan.endAddress.formattedAddress);

    setForm((current) => ({
      ...current,
      routeId,
      routeName: routePlan.code,
      origin: routePlan.startAddress.formattedAddress,
      destination: routePlan.endAddress.formattedAddress,
      originLocation: routePlan.startAddress,
      destinationLocation: routePlan.endAddress,
      routeStops,
    }));
    setErrors((current) => ({ ...current, routeId: '', origin: '', destination: '' }));
  }

  function selectLocation(field: 'origin' | 'destination', value: string) {
    const snapshot = locationSnapshots.find((location) => location.formattedAddress === value);
    setForm((current) => ({
      ...current,
      [field]: value,
      [field === 'origin' ? 'originLocation' : 'destinationLocation']: snapshot,
    }));
    setErrors((current) => ({ ...current, [field]: '' }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const nextErrors = validateForm(form, drivers, vehicles);
    setErrors(nextErrors);
    setSubmitError('');
    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setSubmitting(true);
    const uploadedPaths: string[] = [];
    try {
      const driver = drivers.find((item) => item.uid === form.driverId)!;
      const vehicle = vehicles.find((item) => item.id === form.vehicleId)!;
      const selectedStatus = dailyStatusOptions.find((option) => option.value === form.statusValue) ?? dailyStatusOptions[2];
      const scheduledAt = new Date(form.scheduledAt);
      const tripId = editingTrip?.id ?? adminWriteRepository.createTripId();
      const activeDocuments = form.cteDocuments.filter((document) => document.number.trim() || document.file || document.existing);
      const cteDocuments: TripCteDocument[] = [];

      for (const document of activeDocuments) {
        if (document.file) {
          const uploaded = await uploadTripCtePdf({
            documentId: `${document.key}-${Date.now()}`,
            file: document.file,
            number: document.number,
            tripId,
          });
          uploadedPaths.push(uploaded.storagePath);
          cteDocuments.push({ ...uploaded, id: document.key });
        } else if (document.existing) {
          cteDocuments.push({ ...document.existing, id: document.key, number: document.number.trim() });
        } else {
          cteDocuments.push(emptyStoredDocument(document));
        }
      }

      const assignmentChanged = !editingTrip || editingTrip.driverId !== form.driverId;
      await adminWriteRepository.saveTrip({
        additionalInfo: form.additionalInfo,
        assignedAt: assignmentChanged ? null : editingTrip?.assignedAt,
        clientId: editingTrip?.clientId ?? '',
        clientName: form.clientName,
        cteDocuments,
        customerRequestNumber: form.customerRequestNumber,
        destination: form.destination,
        destinationLocation: form.destinationLocation,
        destinationLocationId: editingTrip?.destinationLocationId ?? '',
        driverId: form.driverId,
        driverName: driver.name || driver.email,
        driverRejection: assignmentChanged ? null : editingTrip?.driverRejection,
        driverRespondedAt: assignmentChanged ? null : editingTrip?.driverRespondedAt,
        driverResponse: assignmentChanged ? 'pending' : editingTrip?.driverResponse ?? 'pending',
        driverResponseDriverId: assignmentChanged ? '' : editingTrip?.driverResponseDriverId,
        expectedArrivalAt: form.expectedArrivalAt ? new Date(form.expectedArrivalAt) : null,
        fleetNumber: vehicle.fleetNumber,
        id: tripId,
        operationType: form.operationType,
        operationalStatus: selectedStatus.operationalStatus,
        origin: form.origin,
        originLocation: form.originLocation,
        originLocationId: editingTrip?.originLocationId ?? '',
        programmedVehicleType: inferProgrammedVehicleType(vehicle, editingTrip?.programmedVehicleType),
        programmingStatus: selectedStatus.programmingStatus,
        returnTrip: form.returnTrip,
        routeId: form.routeId,
        routeName: form.routeName,
        routeStops: form.routeStops,
        scheduledAt,
        status: selectedStatus.programmingStatus === 'released' ? 'completed' : selectedStatus.programmingStatus === 'loading' ? 'pending' : 'in_progress',
        vehicleId: form.vehicleId,
        vehicleModel: vehicle.model,
        vehiclePlate: vehicle.plate,
      }, { create: !editingTrip });

      const retainedPaths = new Set(cteDocuments.map((document) => document.storagePath).filter(Boolean));
      const obsoletePaths = (editingTrip?.cteDocuments ?? [])
        .map((document) => document.storagePath)
        .filter((path) => path && !retainedPaths.has(path));
      await Promise.allSettled(obsoletePaths.map(deleteTripCtePdf));
      await onSaved({ created: !editingTrip, operationType: form.operationType, returnTrip: form.returnTrip, scheduledAt });
    } catch (error) {
      await Promise.allSettled(uploadedPaths.map(deleteTripCtePdf));
      setSubmitError(error instanceof Error ? error.message : 'Erro ao salvar programacao.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-3 py-4 backdrop-blur-[2px] sm:px-5">
      <section aria-modal="true" className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl" role="dialog">
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 bg-white px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">{editingTrip ? 'Editar Programacao' : 'Nova Programacao'}</h2>
            <p className="mt-0.5 text-sm text-zinc-500">Cadastre uma programacao de transporte.</p>
          </div>
          <button aria-label="Fechar" className="ui-icon-button flex h-9 w-9 shrink-0 items-center justify-center text-zinc-600 hover:bg-zinc-100" disabled={submitting} onClick={onCancel} type="button">
            <X size={18} />
          </button>
        </header>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void handleSubmit(event)}>
          <div className="min-h-0 flex-1 overflow-y-auto bg-white">
            <FormSection description="Identificacao, datas e etapa administrativa." icon={<ClipboardList size={18} />} title="Dados da programacao">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <TextField error={errors.customerRequestNumber} icon={<FileText size={15} />} label="Numero da solicitacao do cliente" onChange={(value) => updateField('customerRequestNumber', value)} placeholder="Ex.: SOL-45875" required value={form.customerRequestNumber} />
                <SearchableCombobox allowCustom error={errors.clientName} icon={<UserRound size={15} />} label="Cliente" onChange={(value) => updateField('clientName', value)} options={clientOptions} placeholder="Buscar cliente..." required value={form.clientName} />
                <TextField error={errors.scheduledAt} icon={<CalendarClock size={15} />} label="Data e horario da solicitacao" onChange={(value) => updateField('scheduledAt', value)} required type="datetime-local" value={form.scheduledAt} />
                <TextField icon={<CalendarClock size={15} />} label="Previsao de chegada" onChange={(value) => updateField('expectedArrivalAt', value)} type="datetime-local" value={form.expectedArrivalAt} />
                <SelectField icon={<Route size={15} />} label="Operacao" onChange={(value) => updateOperationType(value as ProgrammingOperationType)} value={form.operationType}>
                  <option value="loading">Carga</option>
                  <option value="unloading">Descarga</option>
                </SelectField>
                <SelectField icon={<ClipboardList size={15} />} label="Status" onChange={(value) => updateStatus(value as DailyStatusValue)} value={form.statusValue}>
                  {dailyStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </SelectField>
                <SelectField icon={<Navigation size={15} />} label="Retorno" onChange={(value) => updateField('returnTrip', value === 'yes')} value={form.returnTrip ? 'yes' : 'no'}>
                  <option value="no">Nao</option>
                  <option value="yes">Sim</option>
                </SelectField>
              </div>
            </FormSection>

            <FormSection description="Motorista elegivel e veiculo ativo da frota." icon={<Truck size={18} />} title="Atribuicao">
              <div className="grid gap-4 md:grid-cols-2">
                <SearchableCombobox error={errors.driverId} icon={<UserRound size={15} />} label="Motorista" onChange={(value) => updateField('driverId', value)} options={driverOptions} placeholder="Buscar motorista..." required value={form.driverId} />
                <SearchableCombobox error={errors.vehicleId} icon={<Truck size={15} />} label="Veiculo" onChange={(value) => updateField('vehicleId', value)} options={vehicleOptions} placeholder="Buscar frota, placa ou modelo..." required value={form.vehicleId} />
              </div>
              {selectedVehicle ? (
                <div className="mt-4 grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 sm:grid-cols-4">
                  <VehicleFact label="Frota" value={selectedVehicle.fleetNumber || '-'} />
                  <VehicleFact label="Placa" value={selectedVehicle.plate} />
                  <VehicleFact label="Tipo" value={vehicleTypeLabel(selectedVehicle)} />
                  <VehicleFact label="Modelo" value={selectedVehicle.model || '-'} />
                </div>
              ) : null}
            </FormSection>

            <FormSection description="Selecione uma rota existente ou use localidades ja conhecidas pelo sistema." icon={<Route size={18} />} title="Rota da viagem">
              <SearchableCombobox icon={<Route size={15} />} label="Rota cadastrada" onChange={selectRoute} options={routeOptions} placeholder="Selecione uma rota" value={form.routeId} />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <SearchableCombobox allowCustom disabled={Boolean(form.routeId)} error={errors.origin} icon={<MapPin size={15} />} label="Origem" onChange={(value) => selectLocation('origin', value)} options={locationOptions} placeholder="Selecione uma localidade" required value={form.origin} />
                <SearchableCombobox allowCustom disabled={Boolean(form.routeId)} error={errors.destination} icon={<MapPin size={15} />} label="Destino" onChange={(value) => selectLocation('destination', value)} options={locationOptions} placeholder="Selecione uma localidade" required value={form.destination} />
              </div>
              {selectedRoute ? <RoutePreview route={selectedRoute} stops={form.routeStops} /> : null}
            </FormSection>

            <CteDocumentSection documents={form.cteDocuments} errors={errors} onChange={(documents) => updateField('cteDocuments', documents)} />

            <FormSection description="Use este campo somente para observacoes livres." icon={<Info size={18} />} title="Informacoes adicionais">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Observacoes da programacao</span>
                <textarea className="ui-input min-h-24 w-full resize-y px-3 py-2" onChange={(event) => updateField('additionalInfo', event.target.value)} value={form.additionalInfo} />
              </label>
            </FormSection>
          </div>

          <footer className="border-t border-zinc-200 bg-white px-5 py-4 sm:px-6">
            {submitError ? <p className="mb-3 text-sm font-medium text-red-700">{submitError}</p> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="ui-button h-11 border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-800 hover:bg-zinc-50" disabled={submitting} onClick={onCancel} type="button">Cancelar</button>
              <button className="ui-button flex h-11 items-center justify-center gap-2 bg-avapex-yellow px-5 text-sm font-semibold text-avapex-black hover:bg-yellow-300 disabled:cursor-wait disabled:opacity-70" disabled={submitting} type="submit">
                {submitting ? <LoaderCircle className="animate-spin" size={18} /> : <Plus size={18} />}
                {submitting
                  ? editingTrip ? 'Salvando alteracoes...' : 'Criando programacao...'
                  : editingTrip ? 'Salvar alteracoes' : 'Criar programacao'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}

function initialForm(trip: Trip | null): ProgramacaoFormState {
  const currentStatus = trip ? findDailyStatusOption(trip) : dailyStatusOptions[2];
  return {
    additionalInfo: trip?.additionalInfo ?? '',
    clientName: trip?.clientName ?? '',
    cteDocuments: trip?.cteDocuments?.length ? trip.cteDocuments.map(emptyCteDraft) : [emptyCteDraft()],
    customerRequestNumber: trip?.customerRequestNumber ?? '',
    destination: trip?.destination ?? '',
    destinationLocation: trip?.destinationLocation,
    driverId: trip?.driverId ?? '',
    expectedArrivalAt: formatDateTimeInput(trip?.expectedArrivalAt ?? null),
    operationType: trip?.operationType ?? currentStatus.operationType ?? 'loading',
    origin: trip?.origin ?? '',
    originLocation: trip?.originLocation,
    returnTrip: trip?.returnTrip ?? false,
    routeId: trip?.routeId ?? '',
    routeName: trip?.routeName ?? '',
    routeStops: trip?.routeStops ?? [],
    scheduledAt: formatDateTimeInput(trip?.scheduledAt ?? new Date()),
    statusValue: currentStatus.value,
    vehicleId: trip?.vehicleId ?? '',
  };
}

function validateForm(form: ProgramacaoFormState, drivers: AppUser[], vehicles: Vehicle[]) {
  const errors: Record<string, string> = {};
  if (!form.customerRequestNumber.trim()) errors.customerRequestNumber = 'Informe o numero da solicitacao.';
  if (!form.clientName.trim()) errors.clientName = 'Informe o cliente.';
  if (!form.scheduledAt || Number.isNaN(new Date(form.scheduledAt).getTime())) errors.scheduledAt = 'Informe uma data valida.';
  if (!drivers.some((driver) => driver.uid === form.driverId)) errors.driverId = 'Selecione um motorista ativo.';
  if (!vehicles.some((vehicle) => vehicle.id === form.vehicleId)) errors.vehicleId = 'Selecione um veiculo ativo.';
  if (!form.origin.trim()) errors.origin = 'Informe a origem.';
  if (!form.destination.trim()) errors.destination = 'Informe o destino.';
  for (const document of form.cteDocuments) {
    if ((document.file || document.existing) && !document.number.trim()) {
      errors[`cte-${document.key}`] = 'Informe o numero deste CT-e.';
    }
  }
  return errors;
}

function emptyStoredDocument(document: CteDocumentDraft): TripCteDocument {
  return {
    id: document.key,
    number: document.number.trim(),
    series: '',
    branch: '',
    issuedAt: null,
    sender: '',
    storagePath: '',
    fileName: '',
    contentType: '',
    sizeBytes: 0,
    uploadedAt: null,
    uploadedBy: '',
  };
}

function FormSection({ children, description, icon, title }: { children: ReactNode; description: string; icon: ReactNode; title: string }) {
  return (
    <section className="border-t border-zinc-200 px-5 py-5 first:border-t-0 sm:px-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-900 text-white">{icon}</span>
        <div>
          <h3 className="text-sm font-semibold text-zinc-950">{title}</h3>
          <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TextField({ error, icon, label, onChange, placeholder, required, type = 'text', value }: { error?: string; icon: ReactNode; label: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; type?: string; value: string }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-700">{icon}{label}{required ? <span className="text-red-600">*</span> : null}</span>
      <input aria-invalid={Boolean(error)} className={`ui-input h-11 w-full px-3 text-sm ${error ? 'border-red-500' : ''}`} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} type={type} value={value} />
      {error ? <span className="mt-1.5 block text-xs font-medium text-red-600">{error}</span> : null}
    </label>
  );
}

function SelectField({ children, icon, label, onChange, value }: { children: ReactNode; icon: ReactNode; label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-700">{icon}{label}</span>
      <select className="ui-input h-11 w-full px-3 text-sm" onChange={(event) => onChange(event.target.value)} value={value}>{children}</select>
    </label>
  );
}

function RoutePreview({ route, stops }: { route: RoutePlan; stops: TripRouteStop[] }) {
  const points = [route.startAddress.formattedAddress, ...stops.map((stop) => stop.address), route.endAddress.formattedAddress];
  return (
    <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-sm text-zinc-900">Rota selecionada</strong>
        <span className="text-xs font-medium text-zinc-500">
          {points.length} pontos
          {route.plannedDistanceMeters > 0 ? ` - ${Math.round(route.plannedDistanceMeters / 1000)} km` : ''}
          {route.plannedDurationSeconds > 0 ? ` - ${formatDuration(route.plannedDurationSeconds)}` : ''}
        </span>
      </div>
      <ol className="mt-3 space-y-0">
        {points.map((point, index) => (
          <li className="grid grid-cols-[18px_1fr] gap-2 text-sm" key={`${point}-${index}`}>
            <span className="flex flex-col items-center">
              <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${index === 0 || index === points.length - 1 ? 'bg-zinc-900' : 'border-2 border-zinc-500 bg-white'}`} />
              {index < points.length - 1 ? <span className="h-7 w-px bg-zinc-300" /> : null}
            </span>
            <span className="pb-3 font-medium text-zinc-700">{point}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function VehicleFact({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-[11px] font-medium uppercase text-zinc-500">{label}</span><strong className="mt-0.5 block text-sm text-zinc-900">{value}</strong></div>;
}

function collectLocationSnapshots(routes: RoutePlan[]) {
  const unique = new Map<string, AddressSnapshot>();
  for (const route of routes) {
    unique.set(route.startAddress.formattedAddress.trim().toLocaleLowerCase('pt-BR'), route.startAddress);
    unique.set(route.endAddress.formattedAddress.trim().toLocaleLowerCase('pt-BR'), route.endAddress);
  }
  return [...unique.values()].filter((location) => location.formattedAddress.trim()).sort((a, b) => a.formattedAddress.localeCompare(b.formattedAddress));
}

function inferProgrammedVehicleType(vehicle: Vehicle, fallback?: ProgrammedVehicleType): ProgrammedVehicleType {
  const searchable = `${vehicle.model} ${vehicle.type}`.toLowerCase();
  const match = (['vanderleia', 'sprinter', 'munck', 'rodotrem', 'prancha', 'saveiro', 'hr'] as ProgrammedVehicleType[])
    .find((type) => searchable.includes(type));
  if (match) return match;
  if (vehicle.type === 'truck') return 'truck';
  return fallback ?? 'carreta';
}

function vehicleTypeLabel(vehicle: Vehicle) {
  if (vehicle.type === 'mechanical_horse_trucado') return 'Cavalo mecanico trucado';
  if (vehicle.type === 'mechanical_horse_toco') return 'Cavalo mecanico toco';
  return 'Caminhao Truck';
}

function formatDateTimeInput(value: Date | null) {
  if (!value) return '';
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
}
