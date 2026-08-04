import { FormEvent, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileImage,
  MapPin,
  MessageSquareWarning,
  Search,
  X,
} from 'lucide-react';
import { adminWriteRepository } from '../../shared/data/firestoreCollections';
import type { DeliveryReceipt } from '../../shared/domain/models';
import { ActionIconButton, ErrorBanner, MetricCard } from '../../shared/presentation/ui';

type ComprovantesPageProps = {
  loading: boolean;
  onChanged: () => Promise<void>;
  receipts: DeliveryReceipt[];
};

type ReceiptStatus = NonNullable<DeliveryReceipt['adminStatus']>;

export function ComprovantesPage({ loading, onChanged, receipts }: ComprovantesPageProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | ReceiptStatus>('all');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selectedReceipt, setSelectedReceipt] = useState<DeliveryReceipt | null>(null);
  const [failureReceipt, setFailureReceipt] = useState<DeliveryReceipt | null>(null);
  const [failureReason, setFailureReason] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [busyReceiptId, setBusyReceiptId] = useState('');
  const [error, setError] = useState('');

  const filteredReceipts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

    return receipts.filter((receipt) => {
      const receiptStatus = receipt.adminStatus ?? 'pending';
      if (status !== 'all' && receiptStatus !== status) {
        return false;
      }
      if (start && (!receipt.createdAt || receipt.createdAt < start)) {
        return false;
      }
      if (end && (!receipt.createdAt || receipt.createdAt > end)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      return [
        receipt.driverName,
        receipt.cteAccessKey,
        receipt.cteNumber,
        receipt.receiverName,
        receipt.receiverDocument,
        receipt.declaration,
        receipt.failureReason,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [endDate, query, receipts, startDate, status]);

  const stats = useMemo(() => {
    const pending = receipts.filter((receipt) => (receipt.adminStatus ?? 'pending') === 'pending').length;
    const delivered = receipts.filter((receipt) => receipt.adminStatus === 'delivered').length;
    const failed = receipts.filter((receipt) => receipt.adminStatus === 'failed').length;
    return { pending, delivered, failed, total: receipts.length };
  }, [receipts]);

  async function runAction(receiptId: string, action: () => Promise<void>) {
    setBusyReceiptId(receiptId);
    setError('');
    try {
      await action();
      setSelectedReceipt(null);
      await onChanged();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Erro ao atualizar comprovante.');
    } finally {
      setBusyReceiptId('');
    }
  }

  function openFailureModal(receipt: DeliveryReceipt) {
    setFailureReceipt(receipt);
    setFailureReason(receipt.failureReason ?? '');
    setNotificationMessage(
      receipt.driverNotificationMessage ??
        `Comprovante do CT-e ${receipt.cteNumber || receipt.cteAccessKey} possui pendencia. Verifique o envio no aplicativo.`,
    );
  }

  async function handleFailureSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!failureReceipt) {
      return;
    }
    if (!failureReason.trim() || !notificationMessage.trim()) {
      setError('Informe o motivo da falha e a mensagem ao motorista.');
      return;
    }

    await runAction(failureReceipt.id, () =>
      adminWriteRepository.markDeliveryReceiptFailed(
        failureReceipt.id,
        failureReason,
        notificationMessage,
      ),
    );
    setFailureReceipt(null);
    setFailureReason('');
    setNotificationMessage('');
  }

  return (
    <div className="space-y-5">
      <ErrorBanner message={error} />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard icon={<FileImage size={19} />} label="Total" value={loading ? '-' : stats.total} />
        <MetricCard icon={<Eye size={19} />} label="Pendentes" tone="accent" value={loading ? '-' : stats.pending} />
        <MetricCard icon={<CheckCircle2 size={19} />} label="Entregues" tone="success" value={loading ? '-' : stats.delivered} />
        <MetricCard icon={<AlertTriangle size={19} />} label="Falhas" tone="danger" value={loading ? '-' : stats.failed} />
      </section>

      <section className="ui-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="font-semibold">Monitorar comprovantes</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[140px_140px_150px_280px]">
            <input className="ui-input h-10 px-3 text-sm" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            <input className="ui-input h-10 px-3 text-sm" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            <select className="ui-input h-10 px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as 'all' | ReceiptStatus)}>
              <option value="all">Todos</option>
              <option value="pending">Pendentes</option>
              <option value="delivered">Entregues</option>
              <option value="failed">Falhas</option>
            </select>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                className="ui-input h-10 w-full pl-10 pr-3 text-sm"
                placeholder="Buscar CT-e, motorista, recebedor"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="ui-table min-w-[1080px]">
            <thead>
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Motorista</th>
                <th className="px-4 py-3">CT-e</th>
                <th className="px-4 py-3">Recebedor</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Fotos</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredReceipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td className="px-4 py-3">{formatDate(receipt.createdAt)}</td>
                  <td className="px-4 py-3 font-medium">{receipt.driverName || receipt.driverId}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{receipt.cteNumber || '-'}</p>
                    <p className="max-w-56 truncate text-xs text-zinc-500">{receipt.cteAccessKey || '-'}</p>
                  </td>
                  <td className="px-4 py-3">{receipt.receiverName || '-'}</td>
                  <td className="px-4 py-3">{receipt.receiverDocument || '-'}</td>
                  <td className="px-4 py-3">{receipt.physicalProofPhotoUrls.length}</td>
                  <td className="px-4 py-3"><StatusPill status={receipt.adminStatus ?? 'pending'} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <ActionIconButton label="Visualizar comprovante" onClick={() => setSelectedReceipt(receipt)}>
                        <Eye size={17} />
                      </ActionIconButton>
                      <ActionIconButton
                        disabled={busyReceiptId === receipt.id}
                        label="Registrar como entregue"
                        onClick={() =>
                          void runAction(receipt.id, () =>
                            adminWriteRepository.markDeliveryReceiptDelivered(receipt.id),
                          )
                        }
                      >
                        <CheckCircle2 size={17} />
                      </ActionIconButton>
                      <ActionIconButton disabled={busyReceiptId === receipt.id} label="Registrar falha" onClick={() => openFailureModal(receipt)}>
                        <MessageSquareWarning size={17} />
                      </ActionIconButton>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredReceipts.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-zinc-500" colSpan={8}>
                    Nenhum comprovante encontrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {selectedReceipt ? (
        <ReceiptDetailsDrawer
          busy={busyReceiptId === selectedReceipt.id}
          onClose={() => setSelectedReceipt(null)}
          onDelivered={() =>
            void runAction(selectedReceipt.id, () =>
              adminWriteRepository.markDeliveryReceiptDelivered(selectedReceipt.id),
            )
          }
          onFailed={() => openFailureModal(selectedReceipt)}
          receipt={selectedReceipt}
        />
      ) : null}

      {failureReceipt ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 backdrop-blur-[1px]">
          <section className="w-full max-w-xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-700 ring-1 ring-red-100">
                  <MessageSquareWarning size={19} />
                </span>
                <h2 className="font-semibold">Registrar falha</h2>
              </div>
              <button className="ui-icon-button flex h-9 w-9 items-center justify-center" onClick={() => setFailureReceipt(null)} type="button">
                <X size={18} />
              </button>
            </header>
            <form className="space-y-4 p-5" onSubmit={(event) => void handleFailureSubmit(event)}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Motivo da falha</span>
                <textarea className="ui-input min-h-24 w-full px-3 py-2 text-sm" value={failureReason} onChange={(event) => setFailureReason(event.target.value)} required />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Mensagem ao motorista</span>
                <textarea className="ui-input min-h-28 w-full px-3 py-2 text-sm" value={notificationMessage} onChange={(event) => setNotificationMessage(event.target.value)} required />
              </label>
              <button className="ui-button flex h-11 w-full items-center justify-center gap-2 bg-avapex-yellow px-5 text-sm font-semibold text-avapex-black hover:bg-yellow-300" disabled={busyReceiptId === failureReceipt.id} type="submit">
                <MessageSquareWarning size={18} />
                Registrar falha e notificar
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ReceiptDetailsDrawer({
  busy,
  onClose,
  onDelivered,
  onFailed,
  receipt,
}: {
  busy: boolean;
  onClose: () => void;
  onDelivered: () => void;
  onFailed: () => void;
  receipt: DeliveryReceipt;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[1px]">
      <button aria-label="Fechar detalhes" className="absolute inset-0 h-full w-full cursor-default" onClick={onClose} type="button" />
      <aside className="relative ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="font-semibold">Detalhes do comprovante</h2>
            <p className="mt-1 text-sm text-zinc-500">CT-e {receipt.cteNumber || '-'}</p>
          </div>
          <button className="ui-icon-button flex h-9 w-9 items-center justify-center" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <section className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Motorista" value={receipt.driverName || receipt.driverId} />
            <DetailItem label="Enviado em" value={formatDate(receipt.createdAt)} />
            <DetailItem label="Chave CT-e" value={receipt.cteAccessKey || '-'} />
            <DetailItem label="Numero CT-e" value={receipt.cteNumber || '-'} />
            <DetailItem label="Recebedor" value={receipt.receiverName || '-'} />
            <DetailItem label="Documento" value={receipt.receiverDocument || '-'} />
          </section>
          <section className="rounded-2xl border border-zinc-200 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <MapPin size={17} />
              Localizacao
            </div>
            <p className="break-words text-sm text-zinc-600">{formatLocation(receipt.location)}</p>
          </section>
          <section className="rounded-2xl border border-zinc-200 p-4">
            <h3 className="mb-2 text-sm font-semibold">Declaracao</h3>
            <p className="text-sm text-zinc-600">{receipt.declaration || '-'}</p>
          </section>
          <section>
            <h3 className="mb-3 text-sm font-semibold">Fotos anexadas</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {receipt.physicalProofPhotoUrls.map((url, index) => (
                <a
                  className="group overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50"
                  download
                  href={url}
                  key={url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <img alt={`Comprovante ${index + 1}`} className="h-36 w-full object-cover transition group-hover:scale-[1.02]" src={url} />
                  <span className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-800">
                    <Download size={16} />
                    Baixar foto {index + 1}
                  </span>
                </a>
              ))}
              {receipt.physicalProofPhotoUrls.length === 0 ? (
                <p className="rounded-2xl bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 sm:col-span-2">
                  Nenhuma foto anexada.
                </p>
              ) : null}
            </div>
          </section>
          {receipt.failureReason ? (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-semibold">Falha registrada</p>
              <p className="mt-1">{receipt.failureReason}</p>
              <p className="mt-3 font-semibold">Mensagem ao motorista</p>
              <p className="mt-1">{receipt.driverNotificationMessage || '-'}</p>
            </section>
          ) : null}
        </div>
        <footer className="grid gap-2 border-t border-zinc-200 p-5 sm:grid-cols-2">
          <button className="ui-button flex h-11 items-center justify-center gap-2 bg-avapex-yellow px-4 text-sm font-semibold text-avapex-black hover:bg-yellow-300" disabled={busy} onClick={onDelivered} type="button">
            <CheckCircle2 size={18} />
            Registrar entregue
          </button>
          <button className="ui-button flex h-11 items-center justify-center gap-2 border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100" disabled={busy} onClick={onFailed} type="button">
            <MessageSquareWarning size={18} />
            Registrar falha
          </button>
        </footer>
      </aside>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-zinc-900">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: ReceiptStatus }) {
  const className =
    status === 'delivered'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'failed'
        ? 'bg-red-50 text-red-700'
        : 'bg-yellow-50 text-yellow-800';
  const label = status === 'delivered' ? 'Entregue' : status === 'failed' ? 'Falha' : 'Pendente';
  return <span className={`ui-pill ${className}`}>{label}</span>;
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

function formatLocation(location: Record<string, unknown>) {
  const address = typeof location.address === 'string' ? location.address : '';
  const latitude = typeof location.latitude === 'number' ? location.latitude : null;
  const longitude = typeof location.longitude === 'number' ? location.longitude : null;

  if (address) {
    return address;
  }
  if (latitude !== null && longitude !== null) {
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  }
  return '-';
}
