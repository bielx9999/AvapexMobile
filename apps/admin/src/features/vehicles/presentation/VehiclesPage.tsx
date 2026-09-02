import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { Ban, Download, FileSpreadsheet, LoaderCircle, Pencil, Plus, Search, Trash2, Upload, UserCheck, X } from 'lucide-react';
import {
  adminVehicleRepository,
  vehicleStatusLabel,
  vehicleTypeLabel,
} from '../data/adminVehicleRepository';
import { analyzeVehicleWorkbook, type VehicleImportAnalysis } from '../data/vehicleImport';
import type { AppUser, Vehicle, VehicleStatus, VehicleType } from '../../shared/domain/models';
import { ActionIconButton, EmptyState, ErrorBanner } from '../../shared/presentation/ui';

type VehiclesPageProps = {
  vehicles: Vehicle[];
  users: AppUser[];
  loading: boolean;
  onChanged: () => Promise<void>;
};

const initialForm = {
  plate: '',
  fleetNumber: '',
  year: '',
  type: 'truck' as VehicleType,
  status: 'active' as VehicleStatus,
  currentDriverId: '',
};

export function VehiclesPage({ vehicles, users, loading, onChanged }: VehiclesPageProps) {
  const [form, setForm] = useState(initialForm);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const activeDrivers = useMemo(
    () => users.filter((user) => user.role === 'driver' && user.status === 'active').sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );

  const filteredVehicles = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return vehicles;
    }
    return vehicles.filter((vehicle) =>
      [
        vehicle.plate,
        vehicle.fleetNumber,
        vehicle.currentDriverName ?? '',
        vehicle.year?.toString() ?? '',
        vehicleTypeLabel(vehicle.type),
        vehicleStatusLabel(vehicle.status),
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    );
  }, [query, vehicles]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await adminVehicleRepository.saveVehicle({
        ...form,
        id: editingVehicle?.id,
        currentDriverName: activeDrivers.find((driver) => driver.uid === form.currentDriverId)?.name,
      });
      closeForm();
      await onChanged();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Erro ao salvar veiculo.');
    } finally {
      setSubmitting(false);
    }
  }

  async function runVehicleAction(id: string, action: () => Promise<void>) {
    setBusyId(id);
    setError('');
    try {
      await action();
      await onChanged();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Erro ao executar acao.');
    } finally {
      setBusyId('');
    }
  }

  function openCreateForm() {
    setForm(initialForm);
    setEditingVehicle(null);
    setShowForm(true);
  }

  function openEditForm(vehicle: Vehicle) {
    setForm({
      plate: vehicle.plate,
      fleetNumber: vehicle.fleetNumber,
      year: vehicle.year?.toString() ?? '',
      type: vehicle.type,
      status: vehicle.status,
      currentDriverId: vehicle.currentDriverId ?? '',
    });
    setEditingVehicle(vehicle);
    setShowForm(true);
  }

  function closeForm() {
    if (submitting) {
      return;
    }
    setShowForm(false);
    setEditingVehicle(null);
    setForm(initialForm);
  }

  function downloadTemplate() {
    const rows = [
      ['PLACA', 'FROTA', 'TIPO DE FROTA', 'ANO'],
      ['ABC1D23', 'FROTA 001', 'Caminhao Truck', '2024'],
      ['DEF4G56', 'FROTA 002', 'Cavalo Mecanico Toco', '2023'],
      ['GHI7J89', 'FROTA 003', 'Cavalo Mecanico Trucado', '2022'],
      ['JKL0M12', 'FROTA 004', 'Veiculo leve', '2024'],
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo-importacao-veiculos.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <ErrorBanner message={error} />

      <section className="ui-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-zinc-500">{filteredVehicles.length} veiculos encontrados</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              className="ui-button flex h-10 items-center justify-center gap-2 border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              onClick={downloadTemplate}
              type="button"
            >
              <Download size={17} />
              Baixar modelo
            </button>
            <button
              className="ui-button flex h-10 items-center justify-center gap-2 border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              onClick={() => setShowImportModal(true)}
              type="button"
            >
              <Upload size={17} />
              Importar planilha
            </button>
            <button
              className="ui-button flex h-10 items-center justify-center gap-2 bg-avapex-yellow px-4 text-sm font-semibold text-avapex-black hover:bg-yellow-300"
              onClick={openCreateForm}
              type="button"
            >
              <Plus size={18} />
              Novo Veiculo
            </button>
            <label className="relative block sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                className="ui-input h-10 w-full pl-10 pr-3 text-sm"
                placeholder="Buscar veiculo"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="ui-table min-w-[940px]">
            <thead>
              <tr>
                <th className="px-4 py-3">Placa</th>
                <th className="px-4 py-3">Frota</th>
                <th className="px-4 py-3">Ano</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Motorista</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td className="px-4 py-3 font-medium">{vehicle.plate}</td>
                  <td className="px-4 py-3">{vehicle.fleetNumber || '-'}</td>
                  <td className="px-4 py-3">{vehicle.year ?? '-'}</td>
                  <td className="px-4 py-3">{vehicleTypeLabel(vehicle.type)}</td>
                  <td className="px-4 py-3">{vehicle.currentDriverName || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={statusClass(vehicle.status)}>{vehicleStatusLabel(vehicle.status)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <ActionIconButton label="Editar veiculo" disabled={busyId === vehicle.id} onClick={() => openEditForm(vehicle)}>
                        <Pencil size={17} />
                      </ActionIconButton>
                      <ActionIconButton
                        label={vehicle.status === 'active' ? 'Desativar veiculo' : 'Ativar veiculo'}
                        disabled={busyId === vehicle.id}
                        onClick={() =>
                          void runVehicleAction(
                            vehicle.id,
                            () => adminVehicleRepository.setStatus(vehicle, vehicle.status === 'active' ? 'inactive' : 'active'),
                          )
                        }
                      >
                        {vehicle.status === 'active' ? <Ban size={17} /> : <UserCheck size={17} />}
                      </ActionIconButton>
                      <ActionIconButton
                        danger
                        label="Excluir veiculo"
                        disabled={busyId === vehicle.id}
                        onClick={() => {
                          const confirmed = window.confirm('Excluir este veiculo do cadastro?');
                          if (!confirmed) {
                            return;
                          }
                          void runVehicleAction(vehicle.id, () => adminVehicleRepository.deleteVehicle(vehicle));
                        }}
                      >
                        <Trash2 size={17} />
                      </ActionIconButton>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && filteredVehicles.length === 0 ? (
                <tr>
                  <td className="p-0" colSpan={7}>
                    <EmptyState description="Nao existem veiculos correspondentes aos filtros atuais." title="Nenhum veiculo encontrado" />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-[1px]">
          <section className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
              <h2 className="text-lg font-semibold">{editingVehicle ? 'Editar Veiculo' : 'Novo Veiculo'}</h2>
              <button
                aria-label="Fechar cadastro"
                className="ui-icon-button flex h-9 w-9 shrink-0 items-center justify-center border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                onClick={closeForm}
                type="button"
              >
                <X size={18} />
              </button>
            </header>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
              <div className="space-y-5 overflow-y-auto bg-white p-5">
                <section className="border-b border-zinc-200 pb-5">
                  <h3 className="mb-4 text-sm font-semibold text-zinc-900">Identificacao</h3>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <TextField
                      label="Placa"
                      readOnly={Boolean(editingVehicle)}
                      value={form.plate}
                      onChange={(value) => setForm((current) => ({ ...current, plate: value }))}
                      required
                    />
                    <TextField
                      label="Frota"
                      value={form.fleetNumber}
                      onChange={(value) => setForm((current) => ({ ...current, fleetNumber: value }))}
                      required
                    />
                    <TextField
                      label="Ano"
                      type="number"
                      value={form.year}
                      onChange={(value) => setForm((current) => ({ ...current, year: value }))}
                      required
                    />
                  </div>
                </section>

                <section>
                  <h3 className="mb-4 text-sm font-semibold text-zinc-900">Classificacao</h3>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-zinc-700">Tipo</span>
                      <select
                        className="ui-input h-11 w-full px-3"
                        value={form.type}
                        onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as VehicleType }))}
                      >
                        <option value="light_vehicle">Veiculo leve</option>
                        <option value="mechanical_horse_trucado">Cavalo Mecanico Trucado</option>
                        <option value="mechanical_horse_toco">Cavalo Mecanico Toco</option>
                        <option value="truck">Caminhao Truck</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-zinc-700">Status</span>
                      <select
                        className="ui-input h-11 w-full px-3"
                        value={form.status}
                        onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as VehicleStatus }))}
                      >
                        <option value="active">Ativo</option>
                        <option value="inactive">Desativado</option>
                      </select>
                    </label>
                    <label className="block md:col-span-2 xl:col-span-1">
                      <span className="mb-2 block text-sm font-medium text-zinc-700">Motorista atrelado</span>
                      <select
                        className="ui-input h-11 w-full px-3"
                        value={form.currentDriverId}
                        onChange={(event) => setForm((current) => ({ ...current, currentDriverId: event.target.value }))}
                      >
                        <option value="">Sem motorista fixo</option>
                        {activeDrivers.map((driver) => (
                          <option key={driver.uid} value={driver.uid}>
                            {driver.name} - {driver.email}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </section>
              </div>

              <footer className="flex flex-col-reverse gap-2 border-t border-zinc-200 bg-white px-5 py-4 sm:flex-row sm:justify-end">
                <button
                  className="ui-button h-11 border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                  disabled={submitting}
                  onClick={closeForm}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="ui-button flex h-11 items-center justify-center gap-2 bg-avapex-yellow px-5 text-sm font-semibold text-avapex-black hover:bg-yellow-300"
                  disabled={submitting}
                  type="submit"
                >
                  <Plus size={18} />
                  {submitting ? 'Salvando...' : editingVehicle ? 'Salvar alteracoes' : 'Criar veiculo'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {showImportModal ? (
        <VehicleImportModal
          vehicles={vehicles}
          onClose={() => setShowImportModal(false)}
          onImported={async () => {
            setShowImportModal(false);
            await onChanged();
          }}
        />
      ) : null}
    </div>
  );
}

function VehicleImportModal({
  vehicles,
  onClose,
  onImported,
}: {
  vehicles: Vehicle[];
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const [analysis, setAnalysis] = useState<VehicleImportAnalysis | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const validRows = analysis?.rows.filter((row) => row.issues.length === 0 && row.type && row.year !== null) ?? [];

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    setAnalysis(null);
    try {
      setAnalysis(await analyzeVehicleWorkbook(file, vehicles));
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'Nao foi possivel ler a planilha.');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  }

  async function importRows() {
    if (!validRows.length) {
      setError('A planilha precisa ter ao menos um veiculo valido para importar.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await adminVehicleRepository.importVehicles(validRows.map((row) => ({
        plate: row.plate,
        fleetNumber: row.fleetNumber,
        type: row.type!,
        year: row.year!,
      })));
      await onImported();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Erro ao importar veiculos.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-[1px]">
      <section aria-modal="true" className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" role="dialog">
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">Importar veiculos por planilha</h2>
            <p className="text-sm text-zinc-500">Use o modelo com PLACA, FROTA, TIPO DE FROTA e ANO.</p>
          </div>
          <button aria-label="Fechar importacao" className="ui-icon-button flex h-9 w-9 shrink-0 items-center justify-center border-zinc-300 text-zinc-700 hover:bg-zinc-50" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <ErrorBanner message={error} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-600">Tipos aceitos: Veiculo leve, Caminhao Truck, Cavalo Mecanico Toco e Cavalo Mecanico Trucado.</p>
            <label className="ui-button h-11 cursor-pointer gap-2 border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              {loading ? <LoaderCircle className="animate-spin" size={17} /> : <FileSpreadsheet size={17} />}
              {loading ? 'Lendo planilha...' : analysis ? 'Escolher outro arquivo' : 'Selecionar planilha'}
              <input accept=".xlsx,.xls,.csv" className="sr-only" disabled={loading || saving} onChange={selectFile} type="file" />
            </label>
          </div>

          {!analysis ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center">
              <FileSpreadsheet className="mx-auto text-zinc-400" size={30} />
              <p className="mt-3 text-sm font-medium text-zinc-800">Selecione a planilha preenchida</p>
              <p className="mt-1 text-sm text-zinc-500">O sistema valida duplicidades, placa, frota, tipo e ano antes de gravar.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <ImportMetric label="Linhas lidas" value={analysis.totalRows} tone="neutral" />
                <ImportMetric label="Prontas para importar" value={analysis.validRows} tone="success" />
                <ImportMetric label="Com pendencia" value={analysis.invalidRows} tone={analysis.invalidRows ? 'warning' : 'neutral'} />
                <ImportMetric label="Duplicadas" value={analysis.duplicateRows} tone={analysis.duplicateRows ? 'danger' : 'neutral'} />
              </div>
              <div className="overflow-hidden rounded-xl border border-zinc-200">
                <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{analysis.fileName}</p>
                    <p className="text-xs text-zinc-500">Somente as linhas sem pendencias serao cadastradas.</p>
                  </div>
                  <span className="text-sm font-semibold text-zinc-700">{validRows.length} veiculo(s)</span>
                </div>
                <div className="max-h-72 overflow-auto">
                  <table className="ui-table min-w-[760px]">
                    <thead>
                      <tr>
                        <th>Linha</th>
                        <th>Placa</th>
                        <th>Frota</th>
                        <th>Tipo</th>
                        <th>Ano</th>
                        <th>Situacao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.rows.map((row) => (
                        <tr key={row.sourceRow}>
                          <td>{row.sourceRow}</td>
                          <td className="font-semibold">{row.plate || '-'}</td>
                          <td>{row.fleetNumber || '-'}</td>
                          <td>{row.type ? vehicleTypeLabel(row.type) : '-'}</td>
                          <td>{row.year ?? '-'}</td>
                          <td>
                            {row.issues.length ? (
                              <span className="text-sm text-red-700">{row.issues.join('; ')}</span>
                            ) : (
                              <span className="text-sm font-medium text-emerald-700">Pronto para importar</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <footer className="border-t border-zinc-200 px-5 py-4">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="ui-button h-10 border border-zinc-300 bg-white px-4 text-sm font-medium" disabled={saving} onClick={onClose} type="button">
              Cancelar
            </button>
            <button
              className="ui-button h-10 gap-2 bg-avapex-yellow px-4 text-sm font-semibold text-avapex-black disabled:opacity-50"
              disabled={!analysis || validRows.length === 0 || saving}
              onClick={() => void importRows()}
              type="button"
            >
              {saving ? <LoaderCircle className="animate-spin" size={16} /> : <Upload size={16} />}
              Importar {validRows.length} veiculo(s)
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function ImportMetric({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const colors = {
    neutral: 'border-zinc-200 bg-zinc-50 text-zinc-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-red-200 bg-red-50 text-red-800',
  };
  return (
    <div className={`rounded-lg border p-3 ${colors[tone]}`}>
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  readOnly?: boolean;
};

function TextField({ label, value, onChange, type = 'text', required, readOnly }: TextFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zinc-700">{label}</span>
      <input
        className="ui-input h-11 w-full px-3 read-only:bg-zinc-100"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        readOnly={readOnly}
      />
    </label>
  );
}

function statusClass(status: VehicleStatus) {
  const base = 'ui-pill ';
  if (status === 'inactive') {
    return `${base}bg-red-50 text-red-700`;
  }
  return `${base}bg-emerald-50 text-emerald-700`;
}
