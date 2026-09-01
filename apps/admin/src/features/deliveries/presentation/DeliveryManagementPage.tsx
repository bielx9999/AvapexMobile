import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MapPin,
  Navigation,
  PackageCheck,
  Route,
  Search,
  Truck,
} from 'lucide-react';
import type { Delivery, DeliveryStatus } from '../../shared/domain/models';
import { EmptyState, MetricCard, TableSkeleton } from '../../shared/presentation/ui';

type DeliveryManagementPageProps = {
  deliveries: Delivery[];
  loading: boolean;
};

type StatusFilter = 'all' | DeliveryStatus;

const statusOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: 'Todos status', value: 'all' },
  { label: 'Pendente', value: 'pending' },
  { label: 'Em rota', value: 'in_route' },
  { label: 'No cliente', value: 'arrived' },
  { label: 'Entregue', value: 'delivered' },
  { label: 'Nao entregue', value: 'not_delivered' },
  { label: 'Cancelada', value: 'cancelled' },
];

export function DeliveryManagementPage({ deliveries, loading }: DeliveryManagementPageProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const filteredDeliveries = useMemo(() => {
    const normalizedQuery = normalize(query);
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

    return deliveries
      .filter((delivery) => {
        if (status !== 'all' && delivery.status !== status) {
          return false;
        }
        if (start && (!delivery.scheduledAt || delivery.scheduledAt < start)) {
          return false;
        }
        if (end && (!delivery.scheduledAt || delivery.scheduledAt > end)) {
          return false;
        }
        if (!normalizedQuery) {
          return true;
        }

        return [
          delivery.orderNumber,
          delivery.cteNumber,
          delivery.cteAccessKey,
          delivery.clientName,
          delivery.driverName,
          delivery.vehiclePlate,
          delivery.carrierName,
          delivery.regionName,
          delivery.address.formattedAddress,
          delivery.notes,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => {
        const leftDate = left.scheduledAt?.getTime() ?? 0;
        const rightDate = right.scheduledAt?.getTime() ?? 0;
        if (leftDate !== rightDate) {
          return leftDate - rightDate;
        }
        return left.sequence - right.sequence;
      });
  }, [deliveries, endDate, query, startDate, status]);

  const stats = useMemo(() => {
    const delivered = filteredDeliveries.filter((delivery) => delivery.status === 'delivered').length;
    const inProgress = filteredDeliveries.filter((delivery) => delivery.status === 'in_route' || delivery.status === 'arrived').length;
    const issues = filteredDeliveries.filter((delivery) => delivery.status === 'not_delivered' || delivery.status === 'cancelled').length;
    const pendingProof = filteredDeliveries.filter((delivery) => delivery.proofStatus === 'pending' || delivery.proofStatus === 'rejected').length;

    return {
      delivered,
      inProgress,
      issues,
      pendingProof,
      total: filteredDeliveries.length,
    };
  }, [filteredDeliveries]);

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <MetricCard icon={<PackageCheck size={19} />} label="Entregas filtradas" value={loading ? '-' : stats.total} />
        <MetricCard icon={<Truck size={19} />} label="Em andamento" tone="info" value={loading ? '-' : stats.inProgress} />
        <MetricCard icon={<CheckCircle2 size={19} />} label="Entregues" tone="success" value={loading ? '-' : stats.delivered} />
        <MetricCard icon={<AlertTriangle size={19} />} label="Ocorrencias" tone="danger" value={loading ? '-' : stats.issues} />
        <MetricCard icon={<Clock3 size={19} />} label="Comprovante pendente" tone="warning" value={loading ? '-' : stats.pendingProof} />
      </section>

      <section className="ui-card overflow-hidden">
        <div className="ui-panel-header">
          <div>
            <h2 className="font-semibold text-zinc-950">Gestao de entregas</h2>
            <p className="mt-1 text-sm text-zinc-500">Acompanhe pedidos, motoristas, status, comprovantes e janelas de atendimento.</p>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-[140px_140px_170px_320px]">
            <input aria-label="Data inicial" className="ui-input h-10 px-3 text-sm" onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
            <input aria-label="Data final" className="ui-input h-10 px-3 text-sm" onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
            <select aria-label="Status da entrega" className="ui-input h-10 px-3 text-sm" onChange={(event) => setStatus(event.target.value as StatusFilter)} value={status}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                className="ui-input h-10 w-full pl-10 pr-3 text-sm"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar pedido, cliente, motorista"
                value={query}
              />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <TableSkeleton columns={9} rows={6} />
          ) : (
            <table className="ui-table min-w-[1180px]">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Motorista</th>
                  <th>Veiculo</th>
                  <th>Regiao</th>
                  <th>Janela</th>
                  <th>Volumes</th>
                  <th>Status</th>
                  <th className="text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeliveries.map((delivery) => (
                  <tr className="align-top" key={delivery.id}>
                    <td>
                      <p className="font-semibold text-zinc-950">{delivery.orderNumber || '-'}</p>
                      <p className="mt-1 max-w-44 truncate text-xs text-zinc-500">CT-e {delivery.cteNumber || delivery.cteAccessKey || '-'}</p>
                    </td>
                    <td>
                      <p className="font-medium text-zinc-900">{delivery.clientName || '-'}</p>
                      <p className="mt-1 max-w-64 truncate text-xs text-zinc-500">{delivery.address.formattedAddress || '-'}</p>
                    </td>
                    <td>{delivery.driverName || delivery.driverId || '-'}</td>
                    <td>
                      <p className="font-medium text-zinc-900">{delivery.vehiclePlate || '-'}</p>
                      <p className="mt-1 text-xs text-zinc-500">{delivery.carrierName || 'Transportadora nao informada'}</p>
                    </td>
                    <td>{delivery.regionName || '-'}</td>
                    <td>
                      <p>{formatDateTime(delivery.scheduledAt)}</p>
                      <p className="mt-1 text-xs text-zinc-500">{formatWindow(delivery.timeWindowStart, delivery.timeWindowEnd)}</p>
                    </td>
                    <td>
                      <p>{delivery.packageCount} vol.</p>
                      <p className="mt-1 text-xs text-zinc-500">{formatNumber(delivery.weightKg)} kg | {formatNumber(delivery.volumeM3)} m3</p>
                    </td>
                    <td>
                      <div className="space-y-1.5">
                        <StatusPill status={delivery.status} />
                        <ProofPill status={delivery.proofStatus} />
                      </div>
                    </td>
                    <td>
                      <div className="flex justify-end gap-2">
                        {mapsUrl(delivery) ? (
                          <a
                            aria-label="Abrir endereco no Google Maps"
                            className="ui-icon-button h-9 w-9 border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                            href={mapsUrl(delivery)}
                            rel="noreferrer"
                            target="_blank"
                            title="Abrir endereco no Google Maps"
                          >
                            <MapPin size={17} />
                          </a>
                        ) : null}
                        {delivery.routeId ? (
                          <a
                            aria-label="Abrir rota"
                            className="ui-icon-button h-9 w-9 border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
                            href={`#route-${delivery.routeId}`}
                            title="Abrir rota"
                          >
                            <Route size={17} />
                          </a>
                        ) : null}
                        {delivery.driverId ? (
                          <a
                            aria-label="Enviar mensagem ao motorista"
                            className="ui-icon-button h-9 w-9 border-yellow-300 bg-avapex-yellow text-avapex-black hover:bg-yellow-300"
                            href={driverMessageUrl(delivery)}
                            rel="noreferrer"
                            target="_blank"
                            title="Enviar mensagem ao motorista"
                          >
                            <Navigation size={17} />
                          </a>
                        ) : null}
                        {delivery.deliveryProofId ? (
                          <a
                            aria-label="Abrir comprovante vinculado"
                            className="ui-icon-button h-9 w-9 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            href={`#receipt-${delivery.deliveryProofId}`}
                            title="Abrir comprovante vinculado"
                          >
                            <ExternalLink size={17} />
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredDeliveries.length === 0 ? (
                  <tr>
                    <td className="p-0" colSpan={9}>
                      <EmptyState
                        description="Ajuste o periodo, status ou termo de busca para consultar outras entregas."
                        title="Nenhuma entrega encontrada"
                      />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: DeliveryStatus }) {
  const labels: Record<DeliveryStatus, string> = {
    arrived: 'No cliente',
    cancelled: 'Cancelada',
    delivered: 'Entregue',
    in_route: 'Em rota',
    not_delivered: 'Nao entregue',
    pending: 'Pendente',
  };
  const classes: Record<DeliveryStatus, string> = {
    arrived: 'bg-sky-50 text-sky-700',
    cancelled: 'bg-zinc-100 text-zinc-700',
    delivered: 'bg-emerald-50 text-emerald-700',
    in_route: 'bg-blue-50 text-blue-700',
    not_delivered: 'bg-red-50 text-red-700',
    pending: 'bg-yellow-50 text-yellow-800',
  };
  return <span className={`ui-pill ${classes[status]}`}>{labels[status]}</span>;
}

function ProofPill({ status }: { status: Delivery['proofStatus'] }) {
  const labels: Record<Delivery['proofStatus'], string> = {
    approved: 'Comprovante aprovado',
    pending: 'Comprovante pendente',
    rejected: 'Comprovante rejeitado',
    submitted: 'Comprovante enviado',
  };
  const classes: Record<Delivery['proofStatus'], string> = {
    approved: 'bg-emerald-50 text-emerald-700',
    pending: 'bg-zinc-100 text-zinc-700',
    rejected: 'bg-red-50 text-red-700',
    submitted: 'bg-yellow-50 text-yellow-800',
  };
  return <span className={`ui-pill ${classes[status]}`}>{labels[status]}</span>;
}

function formatDateTime(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(value)
    : '-';
}

function formatWindow(start: Date | null, end: Date | null) {
  if (!start && !end) {
    return 'Sem janela';
  }
  return `${formatTime(start)} - ${formatTime(end)}`;
}

function formatTime(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(value)
    : '--:--';
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

function mapsUrl(delivery: Delivery) {
  const address = delivery.address.formattedAddress;
  const coordinates = Number.isFinite(delivery.address.latitude) && Number.isFinite(delivery.address.longitude)
    ? `${delivery.address.latitude},${delivery.address.longitude}`
    : '';
  const query = coordinates || address;
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : '';
}

function driverMessageUrl(delivery: Delivery) {
  const message = [
    `Entrega ${delivery.orderNumber || delivery.id}`,
    `Cliente: ${delivery.clientName || '-'}`,
    `Endereco: ${delivery.address.formattedAddress || '-'}`,
    `Status atual: ${delivery.status}`,
  ].join('\n');
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
