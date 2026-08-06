import {
  AlertTriangle,
  Crosshair,
  FileUp,
  Eye,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { type FormEvent, type ReactNode, useMemo, useRef, useState } from 'react';
import { adminWriteRepository } from '../../shared/data/firestoreCollections';
import type { Locality } from '../../shared/domain/models';
import { ActionIconButton, EmptyState, MetricCard, TableSkeleton } from '../../shared/presentation/ui';
import { analyzeLocalityWorkbook, normalizeSearchText, type LocalityImportAnalysis, type ParsedLocality } from '../data/localityImport';
import { geocodeLocalityAddress } from '../data/localityMapService';
import { LocalityMap } from './LocalityMap';

type LocalitiesPageProps = {
  loading: boolean;
  localities: Locality[];
  onChanged: () => Promise<void>;
};

type LocalityFormState = {
  id?: string;
  reference: string;
  city: string;
  uf: string;
  address: string;
  latitude: string;
  longitude: string;
  originalCoordinates: string;
  status: Locality['status'];
  needsReview: boolean;
  source: Locality['source'];
  sourceRow: number | null;
  fingerprint: string;
};

const emptyForm: LocalityFormState = {
  reference: '',
  city: '',
  uf: '',
  address: '',
  latitude: '',
  longitude: '',
  originalCoordinates: '',
  status: 'active',
  needsReview: false,
  source: 'manual',
  sourceRow: null,
  fingerprint: '',
};

export function LocalitiesPage({ loading, localities, onChanged }: LocalitiesPageProps) {
  const [query, setQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [ufFilter, setUfFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewOnly, setReviewOnly] = useState(false);
  const [editing, setEditing] = useState<LocalityFormState | null>(null);
  const [viewing, setViewing] = useState<LocalityFormState | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [error, setError] = useState('');

  const cities = useMemo(
    () => [...new Set(localities.map((item) => `${item.city}|${item.uf}`))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [localities],
  );
  const states = useMemo(
    () => [...new Set(localities.map((item) => item.uf))].filter(Boolean).sort(),
    [localities],
  );
  const filtered = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    return localities.filter((locality) => {
      const matchesQuery = !normalizedQuery || [
        locality.normalizedReference,
        locality.normalizedCity,
        locality.uf,
        locality.normalizedAddress,
      ].some((value) => value.includes(normalizedQuery));
      return matchesQuery
        && (cityFilter === 'all' || `${locality.city}|${locality.uf}` === cityFilter)
        && (ufFilter === 'all' || locality.uf === ufFilter)
        && (statusFilter === 'all' || locality.status === statusFilter)
        && (!reviewOnly || locality.needsReview);
    });
  }, [cityFilter, localities, query, reviewOnly, statusFilter, ufFilter]);

  async function toggleStatus(locality: Locality) {
    setError('');
    try {
      await adminWriteRepository.setLocalityStatus(locality.id, locality.status === 'active' ? 'inactive' : 'active');
      await onChanged();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Erro ao atualizar localidade.');
    }
  }

  async function removeLocality(locality: Locality) {
    if (!window.confirm(`Excluir definitivamente a localidade ${locality.reference}?`)) {
      return;
    }
    setError('');
    try {
      await adminWriteRepository.deleteLocality(locality.id);
      await onChanged();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Erro ao excluir localidade.');
    }
  }

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<MapPin size={18} />} label="Localidades" value={localities.length} />
        <MetricCard icon={<MapPin size={18} />} label="Ativas" tone="success" value={localities.filter((item) => item.status === 'active').length} />
        <MetricCard icon={<AlertTriangle size={18} />} label="Para revisar" tone="warning" value={localities.filter((item) => item.needsReview).length} />
        <MetricCard icon={<Crosshair size={18} />} label="Sem coordenada" tone="danger" value={localities.filter((item) => item.latitude === null || item.longitude === null).length} />
      </section>

      {error ? <div className="ui-error" role="alert">{error}</div> : null}

      <section className="ui-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 xl:flex-row xl:items-end">
          <label className="min-w-56 flex-1">
            <span className="mb-1.5 block text-xs font-medium text-zinc-600">Pesquisar localidade</span>
            <span className="relative block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input className="ui-input h-10 w-full pl-9 pr-3 text-sm" onChange={(event) => setQuery(event.target.value)} placeholder="Referencia, cidade, UF ou endereco" value={query} />
            </span>
          </label>
          <FilterSelect label="Cidade" onChange={setCityFilter} value={cityFilter}>
            <option value="all">Todas</option>
            {cities.map((value) => {
              const [city, uf] = value.split('|');
              return <option key={value} value={value}>{city} - {uf}</option>;
            })}
          </FilterSelect>
          <FilterSelect label="UF" onChange={setUfFilter} value={ufFilter}>
            <option value="all">Todas</option>
            {states.map((state) => <option key={state} value={state}>{state}</option>)}
          </FilterSelect>
          <FilterSelect label="Status" onChange={setStatusFilter} value={statusFilter}>
            <option value="all">Todos</option>
            <option value="active">Ativa</option>
            <option value="inactive">Inativa</option>
          </FilterSelect>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-700">
            <input checked={reviewOnly} onChange={(event) => setReviewOnly(event.target.checked)} type="checkbox" />
            Com pendencia
          </label>
          <div className="flex gap-2">
            <button className="ui-button h-10 gap-2 border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50" onClick={() => setImportOpen(true)} type="button">
              <FileUp size={16} /> Importar
            </button>
            <button className="ui-button h-10 gap-2 bg-avapex-yellow px-3 text-sm font-semibold text-avapex-black hover:bg-yellow-300" onClick={() => setEditing(emptyForm)} type="button">
              <Plus size={16} /> Nova localidade
            </button>
          </div>
        </div>

        {loading ? <TableSkeleton columns={7} rows={7} /> : filtered.length === 0 ? (
          <EmptyState description="Ajuste os filtros ou cadastre um novo ponto operacional." title="Nenhuma localidade encontrada" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1000px] w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Referencia</th>
                  <th className="px-4 py-3 font-semibold">Cidade</th>
                  <th className="px-4 py-3 font-semibold">UF</th>
                  <th className="px-4 py-3 font-semibold">Endereco</th>
                  <th className="px-4 py-3 font-semibold">Coordenadas</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((locality) => (
                  <tr className="hover:bg-zinc-50/70" key={locality.id}>
                    <td className="px-4 py-3 font-semibold text-zinc-950">{locality.reference}</td>
                    <td className="px-4 py-3 text-zinc-700">{locality.city}</td>
                    <td className="px-4 py-3 text-zinc-700">{locality.uf}</td>
                    <td className="max-w-md px-4 py-3 text-zinc-600"><span className="line-clamp-2">{locality.address}</span></td>
                    <td className="px-4 py-3 text-xs text-zinc-600">
                      {locality.latitude !== null && locality.longitude !== null
                        ? `${locality.latitude.toFixed(6)}, ${locality.longitude.toFixed(6)}`
                        : <span className="font-medium text-red-700">Sem coordenada</span>}
                    </td>
                    <td className="px-4 py-3"><LocalityStatus locality={locality} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <ActionIconButton label="Visualizar localidade" onClick={() => setViewing(toForm(locality))}><Eye size={16} /></ActionIconButton>
                        <ActionIconButton label="Editar localidade" onClick={() => setEditing(toForm(locality))}><Pencil size={16} /></ActionIconButton>
                        <ActionIconButton label={locality.status === 'active' ? 'Inativar localidade' : 'Ativar localidade'} onClick={() => void toggleStatus(locality)}><Power size={16} /></ActionIconButton>
                        <ActionIconButton danger label="Excluir localidade" onClick={() => void removeLocality(locality)}><Trash2 size={16} /></ActionIconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing ? <LocalityEditor form={editing} onClose={() => setEditing(null)} onSaved={onChanged} /> : null}
      {viewing ? <LocalityEditor form={viewing} onClose={() => setViewing(null)} onSaved={onChanged} readOnly /> : null}
      {importOpen ? <LocalityImportModal localities={localities} onClose={() => setImportOpen(false)} onImported={onChanged} /> : null}
    </>
  );
}

function LocalityEditor({ form: initialForm, onClose, onSaved, readOnly = false }: { form: LocalityFormState; onClose: () => void; onSaved: () => Promise<void>; readOnly?: boolean }) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [suggestedAddress, setSuggestedAddress] = useState('');
  const [error, setError] = useState('');
  const latitude = numberOrNull(form.latitude);
  const longitude = numberOrNull(form.longitude);

  function update<K extends keyof LocalityFormState>(field: K, value: LocalityFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function geocode() {
    setGeocoding(true);
    setError('');
    try {
      const result = await geocodeLocalityAddress(`${form.address}, ${form.city} - ${form.uf}, Brasil`);
      setSuggestedAddress(result.formattedAddress);
      setForm((current) => ({
        ...current,
        latitude: result.latitude.toFixed(7),
        longitude: result.longitude.toFixed(7),
      }));
    } catch (geocodeError) {
      setError(geocodeError instanceof Error ? geocodeError.message : 'Erro ao buscar coordenadas.');
    } finally {
      setGeocoding(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!form.reference.trim() || !form.city.trim() || !form.uf.trim() || !form.address.trim()) {
      setError('Preencha referencia, cidade, UF e endereco.');
      return;
    }
    const coordinateValid = latitude !== null && longitude !== null
      && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
    setSaving(true);
    try {
      await adminWriteRepository.saveLocality({
        ...form,
        latitude: coordinateValid ? latitude : null,
        longitude: coordinateValid ? longitude : null,
        needsReview: form.needsReview || !coordinateValid,
        normalizedReference: normalizeSearchText(form.reference),
        normalizedCity: normalizeSearchText(form.city),
        normalizedAddress: normalizeSearchText(form.address),
      });
      await onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Erro ao salvar localidade.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-[2px]">
      <section aria-modal="true" className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" role="dialog">
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div><h2 className="text-lg font-semibold">{readOnly ? 'Visualizar localidade' : form.id ? 'Editar localidade' : 'Nova localidade'}</h2><p className="text-sm text-zinc-500">Identificacao, endereco e posicionamento geografico.</p></div>
          <button aria-label="Fechar" className="ui-icon-button h-9 w-9" onClick={onClose} type="button"><X size={18} /></button>
        </header>
        <form className="min-h-0 flex-1 overflow-y-auto" onSubmit={(event) => void submit(event)}>
          <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="space-y-4">
              <Input disabled={readOnly} label="Referencia da localidade" onChange={(value) => update('reference', value)} required value={form.reference} />
              <div className="grid grid-cols-[1fr_92px] gap-3">
                <Input disabled={readOnly} label="Cidade" onChange={(value) => update('city', value)} required value={form.city} />
                <Input disabled={readOnly} label="UF" maxLength={2} onChange={(value) => update('uf', value.toUpperCase())} required value={form.uf} />
              </div>
              <label className="block"><span className="mb-1.5 block text-sm font-medium text-zinc-700">Endereco *</span><textarea className="ui-input min-h-24 w-full resize-y px-3 py-2 text-sm" disabled={readOnly} onChange={(event) => update('address', event.target.value)} required value={form.address} /></label>
              <div className="grid grid-cols-2 gap-3">
                <Input disabled={readOnly} label="Latitude" onChange={(value) => update('latitude', value)} type="number" value={form.latitude} />
                <Input disabled={readOnly} label="Longitude" onChange={(value) => update('longitude', value)} type="number" value={form.longitude} />
              </div>
              <button className="ui-button h-10 w-full gap-2 border border-zinc-300 bg-white text-sm font-medium hover:bg-zinc-50" disabled={geocoding || readOnly} onClick={() => void geocode()} type="button">
                {geocoding ? <LoaderCircle className="animate-spin" size={16} /> : <Crosshair size={16} />} Buscar coordenadas
              </button>
              {suggestedAddress ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900"><strong>Resultado no mapa:</strong> {suggestedAddress}</div> : null}
              <div className="grid grid-cols-2 gap-3">
                <label><span className="mb-1.5 block text-sm font-medium text-zinc-700">Status</span><select className="ui-input h-10 w-full px-3 text-sm" disabled={readOnly} onChange={(event) => update('status', event.target.value as Locality['status'])} value={form.status}><option value="active">Ativa</option><option value="inactive">Inativa</option></select></label>
                <label className="flex items-end"><span className="flex h-10 w-full items-center gap-2 rounded-lg border border-zinc-200 px-3 text-sm"><input checked={form.needsReview} disabled={readOnly} onChange={(event) => update('needsReview', event.target.checked)} type="checkbox" />Revisao pendente</span></label>
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between"><span className="text-sm font-medium text-zinc-700">Selecionar ponto no mapa</span><span className="text-xs text-zinc-500">Clique ou arraste o marcador</span></div>
              <LocalityMap latitude={latitude} longitude={longitude} onPositionChange={(nextLatitude, nextLongitude) => setForm((current) => ({ ...current, latitude: nextLatitude.toFixed(7), longitude: nextLongitude.toFixed(7) }))} />
              <p className="mt-2 text-xs text-zinc-500">A busca apenas sugere a posicao. Confirme visualmente antes de salvar.</p>
            </div>
          </div>
          <footer className="sticky bottom-0 border-t border-zinc-200 bg-white px-5 py-4">
            {error ? <p className="mb-3 text-sm font-medium text-red-700" role="alert">{error}</p> : null}
            <div className="flex justify-end gap-2"><button className="ui-button h-10 border border-zinc-300 bg-white px-4 text-sm" onClick={onClose} type="button">{readOnly ? 'Fechar' : 'Cancelar'}</button>{!readOnly ? <button className="ui-button h-10 gap-2 bg-avapex-yellow px-4 text-sm font-semibold" disabled={saving} type="submit">{saving ? <LoaderCircle className="animate-spin" size={16} /> : <MapPin size={16} />}Salvar localidade</button> : null}</div>
          </footer>
        </form>
      </section>
    </div>
  );
}

function LocalityImportModal({ localities, onClose, onImported }: { localities: Locality[]; onClose: () => void; onImported: () => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [analysis, setAnalysis] = useState<LocalityImportAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  async function selectFile(file?: File) {
    if (!file) return;
    setAnalyzing(true);
    setError('');
    try {
      setAnalysis(await analyzeLocalityWorkbook(file, localities));
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : 'Erro ao analisar planilha.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function importRows() {
    if (!analysis) return;
    setImporting(true);
    setError('');
    try {
      const rows = analysis.rows.filter((row) => !row.alreadyImported).map(stripImportMetadata);
      await adminWriteRepository.importLocalities(rows);
      await onImported();
      onClose();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Erro ao importar localidades.');
    } finally {
      setImporting(false);
    }
  }

  const problemRows = analysis?.rows.filter((row) => row.issues.length > 0).slice(0, 120) ?? [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-[2px]">
      <section aria-modal="true" className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" role="dialog">
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4"><div><h2 className="text-lg font-semibold">Importar Localidades</h2><p className="text-sm text-zinc-500">Revise duplicidades e inconsistencias antes da gravacao.</p></div><button aria-label="Fechar" className="ui-icon-button h-9 w-9" onClick={onClose} type="button"><X size={18} /></button></header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <input accept=".xlsx" className="hidden" onChange={(event) => void selectFile(event.target.files?.[0])} ref={inputRef} type="file" />
          <button className="ui-button h-11 gap-2 border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-50" disabled={analyzing} onClick={() => inputRef.current?.click()} type="button">{analyzing ? <LoaderCircle className="animate-spin" size={17} /> : <FileUp size={17} />}{analysis ? 'Escolher outro arquivo' : 'Selecionar planilha XLSX'}</button>
          {analysis ? (
            <>
              <div className="mt-5 grid divide-y divide-zinc-200 rounded-lg border border-zinc-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:grid-cols-6">
                <ImportFact label="Registros" value={analysis.totalRows} />
                <ImportFact label="Novos" value={analysis.newRows} />
                <ImportFact label="Ja cadastrados" value={analysis.existingRows} />
                <ImportFact label="Duplicidades" value={analysis.duplicateRows} />
                <ImportFact label="Coord. invalidas" value={analysis.invalidCoordinateRows} />
                <ImportFact label="Para revisar" value={analysis.reviewRows} />
              </div>
              <div className="mt-5 overflow-hidden rounded-lg border border-zinc-200">
                <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3"><strong className="text-sm">Problemas encontrados</strong><p className="text-xs text-zinc-500">Exibindo ate 120 linhas. Registros identicos ja cadastrados nao serao importados novamente.</p></div>
                {problemRows.length === 0 ? <p className="px-4 py-6 text-center text-sm text-zinc-500">Nenhuma pendencia encontrada.</p> : (
                  <div className="max-h-80 overflow-auto"><table className="min-w-[850px] w-full text-left text-xs"><thead className="sticky top-0 bg-white text-zinc-500"><tr><th className="px-3 py-2">Linha</th><th className="px-3 py-2">Referencia</th><th className="px-3 py-2">Cidade/UF</th><th className="px-3 py-2">Endereco</th><th className="px-3 py-2">Pendencias</th></tr></thead><tbody className="divide-y divide-zinc-100">{problemRows.map((row) => <tr key={`${row.sourceRow}-${row.fingerprint}`}><td className="px-3 py-2">{row.sourceRow}</td><td className="px-3 py-2 font-semibold">{row.reference}</td><td className="px-3 py-2">{row.city}/{row.uf}</td><td className="max-w-sm px-3 py-2">{row.address}</td><td className="px-3 py-2 text-amber-800">{row.issues.join('; ')}</td></tr>)}</tbody></table></div>
                )}
              </div>
            </>
          ) : null}
        </div>
        <footer className="border-t border-zinc-200 px-5 py-4">{error ? <p className="mb-3 text-sm font-medium text-red-700" role="alert">{error}</p> : null}<div className="flex justify-end gap-2"><button className="ui-button h-10 border border-zinc-300 bg-white px-4 text-sm" onClick={onClose} type="button">Cancelar</button><button className="ui-button h-10 gap-2 bg-avapex-yellow px-4 text-sm font-semibold disabled:opacity-50" disabled={!analysis || analysis.newRows === 0 || importing} onClick={() => void importRows()} type="button">{importing ? <LoaderCircle className="animate-spin" size={16} /> : <FileUp size={16} />}Importar {analysis?.newRows ?? 0} localidades</button></div></footer>
      </section>
    </div>
  );
}

function FilterSelect({ children, label, onChange, value }: { children: ReactNode; label: string; onChange: (value: string) => void; value: string }) {
  return <label className="min-w-36"><span className="mb-1.5 block text-xs font-medium text-zinc-600">{label}</span><select className="ui-input h-10 w-full px-3 text-sm" onChange={(event) => onChange(event.target.value)} value={value}>{children}</select></label>;
}

function Input({ disabled, label, maxLength, onChange, required, type = 'text', value }: { disabled?: boolean; label: string; maxLength?: number; onChange: (value: string) => void; required?: boolean; type?: string; value: string }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium text-zinc-700">{label}{required ? ' *' : ''}</span><input className="ui-input h-10 w-full px-3 text-sm" disabled={disabled} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} required={required} step={type === 'number' ? 'any' : undefined} type={type} value={value} /></label>;
}

function LocalityStatus({ locality }: { locality: Locality }) {
  if (locality.needsReview) return <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Revisar</span>;
  return locality.status === 'active'
    ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">Ativa</span>
    : <span className="rounded-full bg-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700">Inativa</span>;
}

function ImportFact({ label, value }: { label: string; value: number }) {
  return <div className="px-4 py-3"><span className="block text-[11px] font-medium uppercase text-zinc-500">{label}</span><strong className="mt-1 block text-xl text-zinc-950">{value}</strong></div>;
}

function toForm(locality: Locality): LocalityFormState {
  return {
    id: locality.id,
    reference: locality.reference,
    city: locality.city,
    uf: locality.uf,
    address: locality.address,
    latitude: locality.latitude?.toString() ?? '',
    longitude: locality.longitude?.toString() ?? '',
    originalCoordinates: locality.originalCoordinates,
    status: locality.status,
    needsReview: locality.needsReview,
    source: locality.source,
    sourceRow: locality.sourceRow,
    fingerprint: locality.fingerprint,
  };
}

function stripImportMetadata(row: ParsedLocality) {
  const { issues, alreadyImported, ...locality } = row;
  void issues;
  void alreadyImported;
  return locality;
}

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}
