import {
  ArrowDown,
  ArrowUp,
  Calculator,
  Copy,
  Eye,
  LoaderCircle,
  MapPin,
  Navigation,
  Pencil,
  Plus,
  Power,
  Route,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { type DragEvent, useMemo, useRef, useState } from 'react';
import { adminWriteRepository } from '../../shared/data/firestoreCollections';
import type { Locality, RouteTemplate, RouteTemplatePoint, RouteVersionDefinition } from '../../shared/domain/models';
import { ActionIconButton, EmptyState, MetricCard, TableSkeleton } from '../../shared/presentation/ui';
import { SearchableCombobox, type ComboboxOption } from '../../scheduling/presentation/components/SearchableCombobox';
import { calculateRoadRoute } from '../data/routeCalculationService';
import { RoutePlannerMap } from './RoutePlannerMap';

type RoutePlannerPageProps = {
  loading: boolean;
  localities: Locality[];
  onChanged: () => Promise<void>;
  routeTemplates: RouteTemplate[];
};

type PlannerMode = 'new' | 'edit' | 'view';

export function RoutePlannerPage({ loading, localities, onChanged, routeTemplates }: RoutePlannerPageProps) {
  const plannerRef = useRef<HTMLDivElement>(null);
  const [routeId, setRouteId] = useState('');
  const [mode, setMode] = useState<PlannerMode>('new');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<RouteTemplate['status']>('active');
  const [points, setPoints] = useState<RouteTemplatePoint[]>([]);
  const [calculated, setCalculated] = useState<Omit<RouteVersionDefinition, 'version'> | null>(null);
  const [addingVia, setAddingVia] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [showIntermediateEditor, setShowIntermediateEditor] = useState(false);

  const selectableLocalities = useMemo(
    () => localities.filter(validLocality).sort((a, b) => a.city.localeCompare(b.city) || a.reference.localeCompare(b.reference)),
    [localities],
  );
  const filteredRoutes = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR');
    return routeTemplates.filter((routeTemplate) => !term
      || `${routeTemplate.name} ${routeTemplate.description}`.toLocaleLowerCase('pt-BR').includes(term));
  }, [query, routeTemplates]);
  const origin = points.find((point) => point.type === 'origin');
  const destination = points.find((point) => point.type === 'destination');
  const intermediates = points.filter((point) => point.type === 'stop' || point.type === 'via');
  const displayedPath = calculated?.path ?? (mode !== 'new' ? points.map(({ latitude, longitude }) => ({ latitude, longitude })) : []);
  const canEdit = mode !== 'view';

  function replacePoints(nextPoints: RouteTemplatePoint[]) {
    setPoints(normalizePointOrder(nextPoints));
    setCalculated(null);
    setError('');
  }

  function selectEndpoint(type: 'origin' | 'destination', localityId: string) {
    const locality = selectableLocalities.find((item) => item.id === localityId);
    const withoutCurrent = points.filter((point) => point.type !== type);
    replacePoints(locality ? [...withoutCurrent, localityPoint(locality, type)] : withoutCurrent);
  }

  function addStop(localityId: string) {
    const locality = selectableLocalities.find((item) => item.id === localityId);
    if (!locality) return;
    if (points.some((point) => point.type !== 'via' && point.locationId === locality.id)) {
      setError('Esta localidade ja faz parte da rota.');
      return;
    }
    replacePoints([...points, localityPoint(locality, 'stop')]);
    setShowIntermediateEditor(true);
  }

  function addVia(latitude: number, longitude: number) {
    if (!addingVia || !canEdit) return;
    replacePoints([...points, {
      id: crypto.randomUUID(),
      type: 'via',
      sequence: points.length,
      locationId: '',
      reference: 'Ponto VIA',
      city: '',
      uf: '',
      address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      latitude,
      longitude,
    }]);
    setAddingVia(false);
  }

  function applyDraggedRoute(viaPoints: Array<{ latitude: number; longitude: number }>) {
    if (!canEdit) return;
    const routeViaPoints = viaPoints.map((point, index) => {
      const coordinates = `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
      return {
        address: coordinates,
        city: '',
        id: crypto.randomUUID(),
        latitude: point.latitude,
        locationId: '',
        longitude: point.longitude,
        reference: `Desvio do percurso ${index + 1}`,
        sequence: 0,
        type: 'via' as const,
        uf: '',
      };
    });
    replacePoints([...points.filter((point) => point.type !== 'via'), ...routeViaPoints]);
    setShowIntermediateEditor(true);
  }

  function moveIntermediate(from: number, to: number) {
    if (to < 0 || to >= intermediates.length || from === to) return;
    const reordered = [...intermediates];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    replacePoints([...(origin ? [origin] : []), ...reordered, ...(destination ? [destination] : [])]);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, targetIndex: number) {
    event.preventDefault();
    const sourceIndex = Number(event.dataTransfer.getData('text/plain'));
    if (Number.isInteger(sourceIndex)) moveIntermediate(sourceIndex, targetIndex);
  }

  async function calculate() {
    setCalculating(true);
    setError('');
    try {
      const result = await calculateRoadRoute(normalizePointOrder(points));
      setCalculated(result);
      if (!name.trim() && origin && destination) setName(`${origin.reference} - ${destination.reference}`);
    } catch (calculationError) {
      setError(calculationError instanceof Error ? calculationError.message : 'Erro ao calcular a rota.');
    } finally {
      setCalculating(false);
    }
  }

  async function save() {
    const routeName = routeDisplayName(name, origin, destination);
    if (!routeName) {
      setError('Informe origem e destino para salvar a rota.');
      return;
    }
    if (!calculated) {
      setError('Calcule a rota novamente antes de salvar.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await adminWriteRepository.saveRouteTemplate({
        id: routeId || undefined,
        name: routeName,
        description,
        notes,
        status,
        definition: calculated,
      });
      await onChanged();
      resetPlanner();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Erro ao salvar a rota.');
    } finally {
      setSaving(false);
    }
  }

  function loadRoute(routeTemplate: RouteTemplate, nextMode: PlannerMode) {
    setRouteId(nextMode === 'new' ? '' : routeTemplate.id);
    setMode(nextMode);
    setName(nextMode === 'new' ? `${routeTemplate.name} - Copia` : routeTemplate.name);
    setDescription(routeTemplate.description);
    setNotes(routeTemplate.notes);
    setStatus(nextMode === 'new' ? 'active' : routeTemplate.status);
    setPoints(routeTemplate.currentVersion.points);
    setCalculated({
      points: routeTemplate.currentVersion.points,
      locationIds: routeTemplate.currentVersion.locationIds,
      distanceMeters: routeTemplate.currentVersion.distanceMeters,
      durationSeconds: routeTemplate.currentVersion.durationSeconds,
      encodedPolyline: routeTemplate.currentVersion.encodedPolyline,
      path: routeTemplate.currentVersion.path,
    });
    setAddingVia(false);
    setShowIntermediateEditor(nextMode !== 'new' && routeTemplate.currentVersion.points.some((point) => point.type === 'stop' || point.type === 'via'));
    setError('');
    plannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetPlanner() {
    setRouteId('');
    setMode('new');
    setName('');
    setDescription('');
    setNotes('');
    setStatus('active');
    setPoints([]);
    setCalculated(null);
    setAddingVia(false);
    setShowIntermediateEditor(false);
    setError('');
  }

  async function toggleStatus(routeTemplate: RouteTemplate) {
    setBusyId(routeTemplate.id);
    setError('');
    try {
      await adminWriteRepository.setRouteTemplateStatus(routeTemplate.id, routeTemplate.status === 'active' ? 'inactive' : 'active');
      await onChanged();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Erro ao alterar o status da rota.');
    } finally {
      setBusyId('');
    }
  }

  async function removeRoute(routeTemplate: RouteTemplate) {
    if (!window.confirm(`Excluir definitivamente a rota ${routeTemplate.name}?`)) return;
    setBusyId(routeTemplate.id);
    setError('');
    try {
      await adminWriteRepository.deleteRouteTemplate(routeTemplate.id);
      if (routeId === routeTemplate.id) resetPlanner();
      await onChanged();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Erro ao excluir a rota.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={<Route size={18} />} label="Rotas cadastradas" value={routeTemplates.length} />
        <MetricCard icon={<Navigation size={18} />} label="Rotas ativas" tone="success" value={routeTemplates.filter((routeTemplate) => routeTemplate.status === 'active').length} />
        <MetricCard icon={<MapPin size={18} />} label="Localidades disponiveis" value={selectableLocalities.length} />
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm" ref={plannerRef}>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2"><h2 className="font-semibold text-zinc-950">{mode === 'view' ? 'Visualizar rota' : routeId ? 'Editar rota' : 'Nova rota'}</h2>{routeId ? <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">Nova versao ao salvar</span> : null}</div>
            <p className="mt-0.5 text-sm text-zinc-500">Defina os pontos na ordem operacional e calcule o trajeto rodoviario.</p>
          </div>
          <div className="flex gap-2">
            {canEdit ? (
              <button
                className={`ui-button h-9 gap-2 px-3 text-sm font-medium ${
                  addingVia
                    ? 'bg-zinc-950 text-white hover:bg-zinc-800'
                    : 'border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50'
                }`}
                onClick={() => setAddingVia((current) => !current)}
                type="button"
              >
                <MapPin size={16} />
                {addingVia ? 'Cancelar VIA' : 'VIA no mapa'}
              </button>
            ) : null}
            {canEdit ? (
              <button
                className={`ui-button h-9 gap-2 px-3 text-sm font-medium ${
                  showIntermediateEditor
                    ? 'bg-zinc-950 text-white hover:bg-zinc-800'
                    : 'border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50'
                }`}
                onClick={() => setShowIntermediateEditor((current) => !current)}
                type="button"
              >
                <Plus size={16} />
                Ponto intermediario
              </button>
            ) : null}
            {mode === 'view' ? <button className="ui-button h-9 gap-2 border border-zinc-300 bg-white px-3 text-sm font-medium" onClick={() => setMode('edit')} type="button"><Pencil size={16} />Editar</button> : null}
            {(routeId || points.length > 0) ? <button className="ui-button h-9 gap-2 border border-zinc-300 bg-white px-3 text-sm font-medium" onClick={resetPlanner} type="button"><X size={16} />Limpar</button> : null}
          </div>
        </header>

        <div className="grid min-h-[680px] lg:grid-cols-[minmax(380px,420px)_minmax(0,1fr)]">
          <aside className="border-b border-zinc-200 bg-zinc-50/60 p-4 lg:border-b-0 lg:border-r">
            <div className="space-y-4">
              <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-950">Cadastro da rota</h3>
                    <p className="mt-0.5 text-xs text-zinc-500">Selecione as localidades cadastradas.</p>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
                    {points.length} pontos
                  </span>
                </div>
                <div className="space-y-4">
                  <EndpointSelector disabled={!canEdit} label="Origem" localities={selectableLocalities} onChange={(value) => selectEndpoint('origin', value)} value={origin?.locationId ?? ''} />
                  <EndpointSelector disabled={!canEdit} label="Destino" localities={selectableLocalities} onChange={(value) => selectEndpoint('destination', value)} value={destination?.locationId ?? ''} />
                </div>
              </section>

              {showIntermediateEditor || intermediates.length > 0 ? (
                <IntermediateEditor disabled={!canEdit} intermediates={intermediates} localities={selectableLocalities} onAddStop={addStop} />
              ) : null}

              <RoutePointList
                disabled={!canEdit}
                intermediates={intermediates}
                onDragStart={(event, index) => event.dataTransfer.setData('text/plain', String(index))}
                onDrop={handleDrop}
                onMove={moveIntermediate}
                onRemove={(id) => replacePoints(points.filter((point) => point.id !== id))}
                points={points}
              />

              <div className="grid gap-2">
                <button className="ui-button h-11 w-full gap-2 bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50" disabled={!canEdit || calculating || !origin || !destination} onClick={() => void calculate()} type="button">{calculating ? <LoaderCircle className="animate-spin" size={17} /> : <Calculator size={17} />}Calcular rota</button>
                {canEdit ? <button className="ui-button h-11 w-full gap-2 bg-avapex-yellow px-4 text-sm font-semibold text-avapex-black hover:bg-yellow-300 disabled:opacity-50" disabled={saving || !calculated} onClick={() => void save()} type="button">{saving ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}{routeId ? 'Salvar nova versao' : 'Salvar rota'}</button> : null}
              </div>
              {calculated ? <RouteFacts definition={calculated} /> : null}
              {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">{error}</p> : null}
            </div>
          </aside>
          <section className="min-h-[560px] bg-white">
            <RoutePlannerMap
              addingVia={addingVia}
              canEdit={canEdit}
              onMapClick={addVia}
              onRouteDrag={applyDraggedRoute}
              path={displayedPath}
              points={points}
            />
          </section>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div><h2 className="font-semibold text-zinc-950">Rotas salvas</h2><p className="text-sm text-zinc-500">Versoes utilizadas em programacoes permanecem preservadas.</p></div>
          <input aria-label="Buscar rota" className="ui-input h-10 w-full px-3 text-sm sm:w-72" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou descricao" value={query} />
        </div>
        {loading ? <TableSkeleton columns={6} rows={5} /> : filteredRoutes.length === 0 ? <EmptyState description="Monte o primeiro trajeto usando as localidades cadastradas." title="Nenhuma rota encontrada" /> : (
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr><th className="px-4 py-3">Rota</th><th className="px-4 py-3">Trajeto</th><th className="px-4 py-3">Paradas</th><th className="px-4 py-3">Distancia</th><th className="px-4 py-3">Tempo</th><th className="px-4 py-3">Atualizacao</th><th className="px-4 py-3">Versao</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Acoes</th></tr></thead>
              <tbody className="divide-y divide-zinc-100">{filteredRoutes.map((routeTemplate) => {
                const routeOrigin = routeTemplate.currentVersion.points[0];
                const routeDestination = routeTemplate.currentVersion.points.at(-1);
                const stopCount = routeTemplate.currentVersion.points.filter((point) => point.type === 'stop').length;
                return <tr className="hover:bg-zinc-50/70" key={routeTemplate.id}><td className="px-4 py-3"><strong className="block text-zinc-950">{routeTemplate.name}</strong><span className="text-xs text-zinc-500">{routeTemplate.description || 'Sem descricao'}</span></td><td className="px-4 py-3 text-zinc-700">{routeOrigin?.reference ?? '-'} <span className="text-zinc-400">para</span> {routeDestination?.reference ?? '-'}</td><td className="px-4 py-3 text-zinc-700">{stopCount}</td><td className="px-4 py-3 text-zinc-700">{formatDistance(routeTemplate.currentVersion.distanceMeters)}</td><td className="px-4 py-3 text-zinc-700">{formatDuration(routeTemplate.currentVersion.durationSeconds)}</td><td className="px-4 py-3 text-xs text-zinc-600">{formatDate(routeTemplate.updatedAt)}</td><td className="px-4 py-3"><span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">v{routeTemplate.currentVersion.version}</span></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${routeTemplate.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-700'}`}>{routeTemplate.status === 'active' ? 'Ativa' : 'Inativa'}</span></td><td className="px-4 py-3"><div className="flex justify-end gap-1.5"><ActionIconButton label="Visualizar rota" onClick={() => loadRoute(routeTemplate, 'view')}><Eye size={16} /></ActionIconButton><ActionIconButton label="Editar rota" onClick={() => loadRoute(routeTemplate, 'edit')}><Pencil size={16} /></ActionIconButton><ActionIconButton label="Duplicar rota" onClick={() => loadRoute(routeTemplate, 'new')}><Copy size={16} /></ActionIconButton><ActionIconButton label={routeTemplate.status === 'active' ? 'Inativar rota' : 'Ativar rota'} onClick={() => void toggleStatus(routeTemplate)}><Power className={busyId === routeTemplate.id ? 'animate-pulse' : ''} size={16} /></ActionIconButton><ActionIconButton danger label="Excluir rota" onClick={() => void removeRoute(routeTemplate)}><Trash2 size={16} /></ActionIconButton></div></td></tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function EndpointSelector({ disabled, label, localities, onChange, value }: { disabled: boolean; label: string; localities: Locality[]; onChange: (value: string) => void; value: string }) {
  const selected = localities.find((locality) => locality.id === value);
  const [draftCityKey, setDraftCityKey] = useState('');
  const cityKey = selected ? cityValue(selected) : draftCityKey;
  const cities = uniqueCities(localities);
  const available = cityKey ? localities.filter((locality) => cityValue(locality) === cityKey) : [];
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-2 text-sm font-semibold text-zinc-950">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
        <SearchableCombobox
          disabled={disabled}
          label="Cidade"
          onChange={(nextValue) => {
            setDraftCityKey(nextValue);
            if (selected) onChange('');
          }}
          options={cities}
          placeholder="Buscar cidade..."
          value={cityKey}
        />
        <SearchableCombobox
          disabled={disabled || !cityKey}
          label="Localidade"
          onChange={onChange}
          options={localityOptions(available)}
          placeholder="Buscar referencia..."
          value={value}
        />
      </div>
      {selected ? <p className="mt-2 line-clamp-2 text-xs text-zinc-500">{selected.address}</p> : null}
    </fieldset>
  );
}

function IntermediateEditor({
  disabled,
  intermediates,
  localities,
  onAddStop,
}: {
  disabled: boolean;
  intermediates: RouteTemplatePoint[];
  localities: Locality[];
  onAddStop: (id: string) => void;
}) {
  const [cityKey, setCityKey] = useState('');
  const [localityId, setLocalityId] = useState('');
  const available = cityKey ? localities.filter((locality) => cityValue(locality) === cityKey) : [];
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-950">Inserir ponto</h3>
          <p className="mt-0.5 text-xs text-zinc-500">Adicione uma entrega intermediaria.</p>
        </div>
        <span className="text-xs font-medium text-zinc-500">{intermediates.length}/25</span>
      </div>
      {!disabled ? (
        <div className="grid gap-3">
          <SearchableCombobox
            label="Cidade do ponto"
            onChange={(nextValue) => {
              setCityKey(nextValue);
              setLocalityId('');
            }}
            options={uniqueCities(localities)}
            placeholder="Buscar cidade..."
            value={cityKey}
          />
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <SearchableCombobox
                disabled={!cityKey}
                label="Localidade do ponto"
                onChange={setLocalityId}
                options={localityOptions(available)}
                placeholder="Buscar referencia..."
                value={localityId}
              />
            </div>
            <button
              aria-label="Adicionar ponto"
              className="ui-icon-button mb-0 h-11 w-11 shrink-0 border-zinc-300 bg-zinc-950 text-white hover:bg-zinc-800"
              disabled={!localityId || intermediates.length >= 25}
              onClick={() => {
                onAddStop(localityId);
                setLocalityId('');
              }}
              title="Adicionar ponto"
              type="button"
            >
              <Plus size={17} />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RoutePointList({
  disabled,
  intermediates,
  onDragStart,
  onDrop,
  onMove,
  onRemove,
  points,
}: {
  disabled: boolean;
  intermediates: RouteTemplatePoint[];
  onDragStart: (event: DragEvent<HTMLDivElement>, index: number) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, index: number) => void;
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  points: RouteTemplatePoint[];
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-950">Sequencia da rota</h3>
          <p className="mt-0.5 text-xs text-zinc-500">Reordene ou remova pontos antes de calcular.</p>
        </div>
        <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">{points.length}</span>
      </div>
      {points.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
          Nenhum ponto selecionado.
        </div>
      ) : (
        <div className="space-y-2">
          {points.map((point, index) => {
            const intermediateIndex = point.type === 'origin' || point.type === 'destination'
              ? -1
              : intermediates.findIndex((item) => item.id === point.id);
            const movable = intermediateIndex >= 0;
            return (
              <div
                className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2"
                draggable={!disabled && movable}
                key={point.id}
                onDragOver={(event) => {
                  if (movable) event.preventDefault();
                }}
                onDragStart={(event) => {
                  if (movable) onDragStart(event, intermediateIndex);
                }}
                onDrop={(event) => {
                  if (movable) onDrop(event, intermediateIndex);
                }}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${pointBadgeClass(point.type)}`}>
                  {pointBadgeLabel(point.type, index)}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-xs text-zinc-900">{point.reference}</strong>
                  <span className="block truncate text-[11px] text-zinc-500">{point.city ? `${point.city}/${point.uf} - ` : ''}{point.address}</span>
                </span>
                {!disabled ? (
                  <>
                    {movable ? (
                      <>
                        <button aria-label="Mover para cima" className="ui-icon-button h-7 w-7" disabled={intermediateIndex === 0} onClick={() => onMove(intermediateIndex, intermediateIndex - 1)} title="Mover para cima" type="button"><ArrowUp size={14} /></button>
                        <button aria-label="Mover para baixo" className="ui-icon-button h-7 w-7" disabled={intermediateIndex === intermediates.length - 1} onClick={() => onMove(intermediateIndex, intermediateIndex + 1)} title="Mover para baixo" type="button"><ArrowDown size={14} /></button>
                      </>
                    ) : null}
                    <button aria-label="Remover ponto" className="ui-icon-button h-7 w-7 text-red-700 hover:bg-red-50" onClick={() => onRemove(point.id)} title="Remover ponto" type="button"><Trash2 size={14} /></button>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function pointBadgeLabel(type: RouteTemplatePoint['type'], index: number) {
  if (type === 'origin') return 'ORI';
  if (type === 'destination') return 'DES';
  if (type === 'via') return 'VIA';
  return String(index + 1);
}

function pointBadgeClass(type: RouteTemplatePoint['type']) {
  if (type === 'origin') return 'bg-avapex-yellow text-avapex-black';
  if (type === 'destination') return 'bg-zinc-950 text-white';
  if (type === 'via') return 'border border-zinc-300 bg-white text-zinc-700';
  return 'bg-zinc-800 text-white';
}

function RouteFacts({ definition }: { definition: Omit<RouteVersionDefinition, 'version'> }) {
  return <div className="grid grid-cols-3 divide-x divide-zinc-200 rounded-lg border border-zinc-200 bg-zinc-50"><Fact label="Distancia" value={formatDistance(definition.distanceMeters)} /><Fact label="Duracao" value={formatDuration(definition.durationSeconds)} /><Fact label="Pontos" value={String(definition.points.length)} /></div>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="px-3 py-2.5"><span className="block text-[10px] font-semibold uppercase text-zinc-500">{label}</span><strong className="mt-0.5 block text-sm text-zinc-950">{value}</strong></div>;
}

function validLocality(locality: Locality): locality is Locality & { latitude: number; longitude: number } {
  return locality.status === 'active' && !locality.needsReview && locality.latitude !== null && locality.longitude !== null;
}

function localityPoint(locality: Locality & { latitude: number; longitude: number }, type: RouteTemplatePoint['type']): RouteTemplatePoint {
  return { id: crypto.randomUUID(), type, sequence: 0, locationId: locality.id, reference: locality.reference, city: locality.city, uf: locality.uf, address: locality.address, latitude: locality.latitude, longitude: locality.longitude };
}

function normalizePointOrder(points: RouteTemplatePoint[]) {
  const origin = points.find((point) => point.type === 'origin');
  const destination = points.find((point) => point.type === 'destination');
  const middle = points.filter((point) => point.type === 'stop' || point.type === 'via');
  return [...(origin ? [origin] : []), ...middle, ...(destination ? [destination] : [])].map((point, sequence) => ({ ...point, sequence }));
}

function uniqueCities(localities: Locality[]): ComboboxOption[] {
  const values = new Map<string, string>();
  localities.forEach((locality) => values.set(cityValue(locality), `${locality.city} - ${locality.uf}`));
  return [...values].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}

function localityOptions(localities: Locality[]): ComboboxOption[] {
  return localities.map((locality) => ({
    value: locality.id,
    label: locality.reference,
    description: `${locality.city}/${locality.uf} - ${locality.address}`,
    searchText: `${locality.reference} ${locality.city} ${locality.uf} ${locality.address}`,
  }));
}

function cityValue(locality: Locality) {
  return `${locality.normalizedCity}|${locality.uf}`;
}

function routeDisplayName(name: string, origin?: RouteTemplatePoint, destination?: RouteTemplatePoint) {
  const trimmedName = name.trim();
  if (trimmedName) {
    return trimmedName;
  }
  if (!origin || !destination) {
    return '';
  }
  return `${origin.city}/${origin.uf} - ${destination.city}/${destination.uf}`;
}

function formatDistance(meters: number) {
  return `${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}min` : `${minutes}min`;
}

function formatDate(value: Date | null) {
  return value ? value.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
}
