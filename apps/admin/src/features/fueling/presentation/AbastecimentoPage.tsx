import { type ReactNode, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  Fuel,
  Gauge,
  ReceiptText,
  Search,
  Send,
  Truck,
  X,
} from 'lucide-react';
import { adminWriteRepository } from '../../shared/data/firestoreCollections';
import type { FuelType, FuelingRecord } from '../../shared/domain/models';

type AbastecimentoPageProps = {
  fueling: FuelingRecord[];
  loading: boolean;
  onChanged: () => Promise<void>;
};

type FuelingStatus = 'pending_whatsapp' | 'sent_whatsapp' | 'failed_whatsapp';

export function AbastecimentoPage({ fueling, loading, onChanged }: AbastecimentoPageProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [query, setQuery] = useState('');
  const [fuelType, setFuelType] = useState<'all' | FuelType>('all');
  const [status, setStatus] = useState<'all' | FuelingStatus>('all');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selectedRecord, setSelectedRecord] = useState<FuelingRecord | null>(null);
  const [busyRecordId, setBusyRecordId] = useState('');
  const [error, setError] = useState('');

  const filteredFueling = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

    return fueling.filter((record) => {
      if (fuelType !== 'all' && record.fuelType !== fuelType) {
        return false;
      }
      if (status !== 'all' && record.notificationStatus !== status) {
        return false;
      }
      if (start && (!record.createdAt || record.createdAt < start)) {
        return false;
      }
      if (end && (!record.createdAt || record.createdAt > end)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      return [
        record.driverName,
        record.vehiclePlate,
        record.vehicleModel,
        record.vehicleId,
        record.fuelType,
        record.notificationStatus,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [endDate, fuelType, fueling, query, startDate, status]);

  const stats = useMemo(() => {
    const pending = fueling.filter((record) => record.notificationStatus === 'pending_whatsapp').length;
    const sent = fueling.filter((record) => record.notificationStatus === 'sent_whatsapp').length;
    const failed = fueling.filter((record) => record.notificationStatus === 'failed_whatsapp').length;
    return { failed, pending, sent, total: fueling.length };
  }, [fueling]);

  async function updateStatus(record: FuelingRecord, nextStatus: FuelingStatus) {
    setBusyRecordId(record.id);
    setError('');
    try {
      await adminWriteRepository.updateFuelingNotificationStatus(record.id, nextStatus);
      setSelectedRecord(null);
      await onChanged();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Erro ao atualizar abastecimento.');
    } finally {
      setBusyRecordId('');
    }
  }

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard icon={<Fuel size={20} />} label="Total" tone="dark" value={loading ? '-' : stats.total} />
        <StatusCard icon={<Send size={20} />} label="Pendentes" tone="yellow" value={loading ? '-' : stats.pending} />
        <StatusCard icon={<CheckCircle2 size={20} />} label="Enviados" tone="success" value={loading ? '-' : stats.sent} />
        <StatusCard icon={<AlertTriangle size={20} />} label="Falhas" tone="danger" value={loading ? '-' : stats.failed} />
      </section>

      <section className="ui-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="font-semibold">Monitorar abastecimentos</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[140px_140px_130px_170px_260px]">
            <input className="ui-input h-10 px-3 text-sm" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            <input className="ui-input h-10 px-3 text-sm" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            <select className="ui-input h-10 px-3 text-sm" value={fuelType} onChange={(event) => setFuelType(event.target.value as 'all' | FuelType)}>
              <option value="all">Todos</option>
              <option value="diesel">Diesel</option>
              <option value="arla">Arla</option>
            </select>
            <select className="ui-input h-10 px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as 'all' | FuelingStatus)}>
              <option value="all">Todos status</option>
              <option value="pending_whatsapp">Pendentes</option>
              <option value="sent_whatsapp">Enviados</option>
              <option value="failed_whatsapp">Falhas</option>
            </select>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                className="ui-input h-10 w-full pl-10 pr-3 text-sm"
                placeholder="Buscar placa, motorista"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Motorista</th>
                <th className="px-4 py-3">Veiculo</th>
                <th className="px-4 py-3">KM</th>
                <th className="px-4 py-3">Combustivel</th>
                <th className="px-4 py-3">Fotos</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredFueling.map((record) => (
                <tr className="border-t border-zinc-100" key={record.id}>
                  <td className="px-4 py-3">{formatDate(record.createdAt)}</td>
                  <td className="px-4 py-3 font-medium">{record.driverName || record.driverId}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{record.vehiclePlate || '-'}</p>
                    <p className="text-xs text-zinc-500">{record.vehicleModel || record.vehicleId || '-'}</p>
                  </td>
                  <td className="px-4 py-3">{formatNumber(record.kmRegistered)}</td>
                  <td className="px-4 py-3">{fuelTypeLabel(record.fuelType)}</td>
                  <td className="px-4 py-3">{record.receiptPhotoUrls.length + record.odometerPhotoUrls.length}</td>
                  <td className="px-4 py-3"><StatusPill status={record.notificationStatus as FuelingStatus} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <IconButton label="Visualizar abastecimento" onClick={() => setSelectedRecord(record)}>
                        <Eye size={17} />
                      </IconButton>
                      <IconButton
                        disabled={busyRecordId === record.id}
                        label="Registrar enviado"
                        onClick={() => void updateStatus(record, 'sent_whatsapp')}
                      >
                        <CheckCircle2 size={17} />
                      </IconButton>
                      <IconButton
                        disabled={busyRecordId === record.id}
                        label="Registrar falha"
                        onClick={() => void updateStatus(record, 'failed_whatsapp')}
                      >
                        <AlertTriangle size={17} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredFueling.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-zinc-500" colSpan={8}>
                    Nenhum abastecimento encontrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {selectedRecord ? (
        <FuelingDetailsDrawer
          busy={busyRecordId === selectedRecord.id}
          onClose={() => setSelectedRecord(null)}
          onFailed={() => void updateStatus(selectedRecord, 'failed_whatsapp')}
          onSent={() => void updateStatus(selectedRecord, 'sent_whatsapp')}
          record={selectedRecord}
        />
      ) : null}
    </div>
  );
}

type StatusCardProps = {
  icon: ReactNode;
  label: string;
  tone: 'dark' | 'yellow' | 'success' | 'danger';
  value: number | string;
};

function StatusCard({ icon, label, tone, value }: StatusCardProps) {
  const toneClassNames = {
    danger: {
      accent: 'bg-red-500',
      icon: 'bg-red-50 text-red-700 ring-red-100',
      value: 'text-red-700',
    },
    dark: {
      accent: 'bg-avapex-black',
      icon: 'bg-avapex-black text-white ring-zinc-200',
      value: 'text-avapex-black',
    },
    success: {
      accent: 'bg-emerald-500',
      icon: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
      value: 'text-emerald-700',
    },
    yellow: {
      accent: 'bg-avapex-yellow',
      icon: 'bg-avapex-yellow text-avapex-black ring-yellow-100',
      value: 'text-avapex-black',
    },
  }[tone];

  return (
    <article className="ui-card relative overflow-hidden p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <span className={`absolute inset-x-0 top-0 h-1 ${toneClassNames.accent}`} />
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${toneClassNames.icon}`}>
          {icon}
        </span>
      </div>
      <strong className={`block text-3xl font-semibold leading-none ${toneClassNames.value}`}>{value}</strong>
    </article>
  );
}

function FuelingDetailsDrawer({
  busy,
  onClose,
  onFailed,
  onSent,
  record,
}: {
  busy: boolean;
  onClose: () => void;
  onFailed: () => void;
  onSent: () => void;
  record: FuelingRecord;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[1px]">
      <button aria-label="Fechar detalhes" className="absolute inset-0 h-full w-full cursor-default" onClick={onClose} type="button" />
      <aside className="relative ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="font-semibold">Detalhes do abastecimento</h2>
            <p className="mt-1 text-sm text-zinc-500">{record.vehiclePlate || '-'}</p>
          </div>
          <button className="ui-icon-button flex h-9 w-9 items-center justify-center" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <section className="grid gap-3 sm:grid-cols-2">
            <DetailItem icon={<Truck size={16} />} label="Veiculo" value={`${record.vehiclePlate || '-'} - ${record.vehicleModel || record.vehicleId || '-'}`} />
            <DetailItem icon={<Gauge size={16} />} label="KM abastecido" value={formatNumber(record.kmRegistered)} />
            <DetailItem icon={<Fuel size={16} />} label="Combustivel" value={fuelTypeLabel(record.fuelType)} />
            <DetailItem icon={<Send size={16} />} label="Status" value={fuelingStatusLabel(record.notificationStatus)} />
            <DetailItem icon={<ReceiptText size={16} />} label="Motorista" value={record.driverName || record.driverId} />
            <DetailItem icon={<ReceiptText size={16} />} label="Enviado em" value={formatDate(record.createdAt)} />
          </section>
          <PhotoSection title="Fotos das notinhas" urls={record.receiptPhotoUrls} />
          <PhotoSection title="Fotos do contador de KM" urls={record.odometerPhotoUrls} />
        </div>
        <footer className="grid gap-2 border-t border-zinc-200 p-5 sm:grid-cols-2">
          <button className="ui-button flex h-11 items-center justify-center gap-2 bg-avapex-yellow px-4 text-sm font-semibold text-avapex-black hover:bg-yellow-300" disabled={busy} onClick={onSent} type="button">
            <CheckCircle2 size={18} />
            Registrar enviado
          </button>
          <button className="ui-button flex h-11 items-center justify-center gap-2 border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100" disabled={busy} onClick={onFailed} type="button">
            <AlertTriangle size={18} />
            Registrar falha
          </button>
        </footer>
      </aside>
    </div>
  );
}

function PhotoSection({ title, urls }: { title: string; urls: string[] }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {urls.map((url, index) => (
          <a
            className="group overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50"
            download
            href={url}
            key={url}
            rel="noreferrer"
            target="_blank"
          >
            <img alt={`${title} ${index + 1}`} className="h-36 w-full object-cover transition group-hover:scale-[1.02]" src={url} />
            <span className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-800">
              <Download size={16} />
              Baixar foto {index + 1}
            </span>
          </a>
        ))}
        {urls.length === 0 ? (
          <p className="rounded-2xl bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 sm:col-span-2">
            Nenhuma foto anexada.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function DetailItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-3">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {icon}
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-medium text-zinc-900">{value}</p>
    </div>
  );
}

function IconButton({ children, disabled, label, onClick }: { children: ReactNode; disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      className="ui-icon-button flex h-9 w-9 items-center justify-center text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function StatusPill({ status }: { status: FuelingStatus }) {
  const className =
    status === 'sent_whatsapp'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'failed_whatsapp'
        ? 'bg-red-50 text-red-700'
        : 'bg-yellow-50 text-yellow-800';
  return <span className={`ui-pill ${className}`}>{fuelingStatusLabel(status)}</span>;
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

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function fuelTypeLabel(type: FuelType) {
  return type === 'arla' ? 'Arla' : 'Diesel';
}

function fuelingStatusLabel(status: string) {
  if (status === 'sent_whatsapp') {
    return 'Enviado';
  }
  if (status === 'failed_whatsapp') {
    return 'Falha';
  }
  return 'Pendente';
}
