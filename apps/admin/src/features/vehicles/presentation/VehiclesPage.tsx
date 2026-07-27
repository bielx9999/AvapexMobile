import { FormEvent, type ReactNode, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, Wrench, X } from 'lucide-react';
import {
  adminVehicleRepository,
  vehicleStatusLabel,
  vehicleTypeLabel,
} from '../data/adminVehicleRepository';
import type { Vehicle, VehicleStatus, VehicleType } from '../../shared/domain/models';

type VehiclesPageProps = {
  vehicles: Vehicle[];
  loading: boolean;
  onChanged: () => Promise<void>;
};

const initialForm = {
  plate: '',
  fleetNumber: '',
  year: '',
  type: 'truck' as VehicleType,
  status: 'available' as VehicleStatus,
};

export function VehiclesPage({ vehicles, loading, onChanged }: VehiclesPageProps) {
  const [form, setForm] = useState(initialForm);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [showForm, setShowForm] = useState(false);

  const filteredVehicles = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return vehicles;
    }
    return vehicles.filter((vehicle) =>
      [
        vehicle.plate,
        vehicle.fleetNumber,
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

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <section className="ui-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <h2 className="font-semibold">Gerenciar veiculos</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Placa</th>
                <th className="px-4 py-3">Frota</th>
                <th className="px-4 py-3">Ano</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.map((vehicle) => (
                <tr className="border-t border-zinc-100" key={vehicle.id}>
                  <td className="px-4 py-3 font-medium">{vehicle.plate}</td>
                  <td className="px-4 py-3">{vehicle.fleetNumber || '-'}</td>
                  <td className="px-4 py-3">{vehicle.year ?? '-'}</td>
                  <td className="px-4 py-3">{vehicleTypeLabel(vehicle.type)}</td>
                  <td className="px-4 py-3">
                    <span className={statusClass(vehicle.status)}>{vehicleStatusLabel(vehicle.status)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <IconButton label="Editar veiculo" disabled={busyId === vehicle.id} onClick={() => openEditForm(vehicle)}>
                        <Pencil size={17} />
                      </IconButton>
                      <IconButton
                        label="Enviar para manutencao"
                        disabled={busyId === vehicle.id}
                        onClick={() =>
                          void runVehicleAction(vehicle.id, () => adminVehicleRepository.setStatus(vehicle, 'maintenance'))
                        }
                      >
                        <Wrench size={17} />
                      </IconButton>
                      <IconButton
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
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && filteredVehicles.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-zinc-500" colSpan={6}>
                    Nenhum veiculo encontrado.
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
              <div className="space-y-5 overflow-y-auto bg-zinc-50 p-5">
                <section className="ui-card p-4">
                  <h3 className="mb-3 text-sm font-semibold text-zinc-800">Identificacao</h3>
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

                <section className="ui-card p-4">
                  <h3 className="mb-3 text-sm font-semibold text-zinc-800">Classificacao</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-zinc-700">Tipo</span>
                      <select
                        className="ui-input h-11 w-full px-3"
                        value={form.type}
                        onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as VehicleType }))}
                      >
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
                        <option value="available">Disponivel</option>
                        <option value="in_transit">Em transito</option>
                        <option value="maintenance">Manutencao</option>
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

type IconButtonProps = {
  children: ReactNode;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
};

function IconButton({ children, label, disabled, danger, onClick }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={`ui-icon-button flex h-9 w-9 items-center justify-center ${
        danger
          ? 'border-red-200 text-red-700 hover:bg-red-50'
          : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50'
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

function statusClass(status: VehicleStatus) {
  const base = 'ui-pill ';
  if (status === 'maintenance') {
    return `${base}bg-red-50 text-red-700`;
  }
  if (status === 'in_transit') {
    return `${base}bg-yellow-50 text-yellow-700`;
  }
  return `${base}bg-emerald-50 text-emerald-700`;
}
