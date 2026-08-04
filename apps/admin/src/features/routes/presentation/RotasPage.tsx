import { useMemo, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, MapPinned, Route, Search, Send, Truck } from 'lucide-react';
import type { Delivery, RoutePlan, Trip } from '../../shared/domain/models';
import { EmptyState, MetricCard } from '../../shared/presentation/ui';
import { OperationalMap } from './OperationalMap';

type RotasPageProps = {
  deliveries: Delivery[];
  loading: boolean;
  routes: RoutePlan[];
  trips: Trip[];
};

type RouteStatus = 'all' | 'ready' | 'in_transit' | 'released';

const statusOptions: Array<{ label: string; value: RouteStatus }> = [
  { label: 'Todos', value: 'all' },
  { label: 'Prontas para envio', value: 'ready' },
  { label: 'Em transito', value: 'in_transit' },
  { label: 'Liberadas', value: 'released' },
];

export function RotasPage({ deliveries, loading, routes, trips }: RotasPageProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState<RouteStatus>('all');
  const [copiedTripId, setCopiedTripId] = useState('');

  const routeTrips = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);
    const normalizedQuery = query.trim().toLowerCase();

    return trips
      .filter((trip) => trip.origin && trip.destination)
      .filter((trip) => {
        const scheduledAt = trip.scheduledAt?.getTime();
        if (!scheduledAt) {
          return false;
        }
        return scheduledAt >= start.getTime() && scheduledAt <= end.getTime();
      })
      .filter((trip) => {
        if (statusFilter === 'ready') {
          return Boolean(trip.driverId && trip.vehicleId && trip.programmingStatus !== 'released');
        }
        if (statusFilter === 'in_transit') {
          return trip.programmingStatus === 'in_transit';
        }
        if (statusFilter === 'released') {
          return trip.programmingStatus === 'released';
        }
        return true;
      })
      .filter((trip) => {
        if (!normalizedQuery) {
          return true;
        }
        return [
          trip.customerRequestNumber,
          trip.driverName,
          trip.vehiclePlate,
          trip.origin,
          trip.destination,
        ].some((value) => value?.toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => (a.scheduledAt?.getTime() ?? 0) - (b.scheduledAt?.getTime() ?? 0));
  }, [endDate, query, startDate, statusFilter, trips]);

  const routeStats = useMemo(() => {
    const ready = routeTrips.filter((trip) => trip.driverId && trip.vehicleId && trip.programmingStatus !== 'released').length;
    const inTransit = routeTrips.filter((trip) => trip.programmingStatus === 'in_transit').length;
    const released = routeTrips.filter((trip) => trip.programmingStatus === 'released').length;
    return { inTransit, ready, released, total: routeTrips.length };
  }, [routeTrips]);

  const routePlans = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00`).getTime();
    const end = new Date(`${endDate}T23:59:59`).getTime();
    const normalizedQuery = query.trim().toLowerCase();
    return routes
      .filter((route) => {
        const serviceDate = route.serviceDate?.getTime();
        return Boolean(serviceDate && serviceDate >= start && serviceDate <= end);
      })
      .filter((route) => {
        if (statusFilter === 'ready') {
          return route.status === 'planned' || route.status === 'assigned';
        }
        if (statusFilter === 'in_transit') {
          return route.status === 'in_progress';
        }
        if (statusFilter === 'released') {
          return route.status === 'completed';
        }
        return true;
      })
      .filter((route) => {
        if (!normalizedQuery) {
          return true;
        }
        return [route.code, route.driverName, route.vehiclePlate, route.startAddress.formattedAddress, route.endAddress.formattedAddress]
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => (a.serviceDate?.getTime() ?? 0) - (b.serviceDate?.getTime() ?? 0));
  }, [endDate, query, routes, startDate, statusFilter]);

  async function copyRoute(trip: Trip) {
    try {
      await navigator.clipboard.writeText(buildMapsUrl(trip.origin, trip.destination));
      setCopiedTripId(trip.id);
      window.setTimeout(() => setCopiedTripId(''), 1800);
    } catch {
      setCopiedTripId('');
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard icon={<Route size={19} />} label="Rotas no periodo" value={loading ? '-' : routeStats.total} />
        <MetricCard icon={<Send size={19} />} label="Prontas para envio" tone="accent" value={loading ? '-' : routeStats.ready} />
        <MetricCard icon={<Truck size={19} />} label="Em transito" tone="info" value={loading ? '-' : routeStats.inTransit} />
        <MetricCard icon={<CheckCircle2 size={19} />} label="Liberadas" tone="success" value={loading ? '-' : routeStats.released} />
      </section>

      <section className="ui-card p-4">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_160px_160px_190px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input
              className="ui-input h-10 w-full pl-10 pr-3 text-sm"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar solicitacao, motorista, veiculo ou rota"
              value={query}
            />
          </label>
          <input aria-label="Data inicial" className="ui-input h-10 px-3 text-sm" onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
          <input aria-label="Data final" className="ui-input h-10 px-3 text-sm" onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
          <select aria-label="Status" className="ui-input h-10 px-3 text-sm" onChange={(event) => setStatusFilter(event.target.value as RouteStatus)} value={statusFilter}>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <OperationalMap deliveries={deliveries} routes={routePlans} trips={routeTrips} />

      <section className="ui-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <MapPinned size={19} />
            </span>
            <h2 className="font-semibold">Rotas programadas</h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="ui-table min-w-[980px]">
            <thead>
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Solicitacao</th>
                <th className="px-4 py-3">Motorista</th>
                <th className="px-4 py-3">Veiculo</th>
                <th className="px-4 py-3">Origem / Destino</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {routeTrips.map((trip) => (
                <tr className="align-top" key={trip.id}>
                  <td className="px-4 py-3">{formatDate(trip.scheduledAt)}</td>
                  <td className="px-4 py-3 font-semibold">{trip.customerRequestNumber || '-'}</td>
                  <td className="px-4 py-3">{trip.driverName || trip.driverId || '-'}</td>
                  <td className="px-4 py-3">{trip.vehiclePlate || trip.vehicleId || '-'}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900">{trip.origin}</p>
                    <p className="mt-1 text-xs text-zinc-500">{trip.destination}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`ui-pill ${statusClassName(trip.programmingStatus)}`}>{statusLabel(trip)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <a
                        aria-label="Abrir rota no Google Maps"
                        className="ui-icon-button h-9 w-9 border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
                        href={buildMapsUrl(trip.origin, trip.destination)}
                        rel="noreferrer"
                        target="_blank"
                        title="Abrir rota no Google Maps"
                      >
                        <ExternalLink size={18} />
                      </a>
                      <a
                        aria-label="Enviar rota ao motorista"
                        className="ui-icon-button h-9 w-9 border-yellow-300 bg-avapex-yellow text-avapex-black hover:bg-yellow-300"
                        href={buildWhatsappUrl(trip)}
                        rel="noreferrer"
                        target="_blank"
                        title="Enviar rota ao motorista"
                      >
                        <Send size={18} />
                      </a>
                      <button
                        aria-label={copiedTripId === trip.id ? 'Link copiado' : 'Copiar link da rota'}
                        className="ui-icon-button h-9 w-9 border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                        onClick={() => void copyRoute(trip)}
                        title={copiedTripId === trip.id ? 'Copiado' : 'Copiar link da rota'}
                        type="button"
                      >
                        <Copy size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && routeTrips.length === 0 ? (
                <tr>
                  <td className="p-0" colSpan={7}>
                    <EmptyState description="Ajuste o periodo ou os filtros para visualizar outras programacoes." title="Nenhuma rota encontrada" />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function buildMapsUrl(origin: string, destination: string) {
  const params = new URLSearchParams({
    api: '1',
    destination,
    origin,
    travelmode: 'driving',
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function buildWhatsappUrl(trip: Trip) {
  const request = trip.customerRequestNumber ? `Solicitacao: ${trip.customerRequestNumber}\n` : '';
  const message = [
    'Rota Avapex Transportes',
    request.trim(),
    `Origem: ${trip.origin}`,
    `Destino: ${trip.destination}`,
    `Veiculo: ${trip.vehiclePlate || trip.vehicleId || '-'}`,
    `Link: ${buildMapsUrl(trip.origin, trip.destination)}`,
  ].filter(Boolean).join('\n');

  return `https://wa.me/?text=${encodeURIComponent(message)}`;
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

function statusLabel(trip: Trip) {
  if (trip.programmingStatus === 'in_transit') {
    return 'Em transito';
  }
  if (trip.programmingStatus === 'unloading') {
    return 'Descarregando';
  }
  if (trip.programmingStatus === 'awaiting_invoice') {
    return 'Aguardando NF';
  }
  if (trip.programmingStatus === 'released') {
    return 'Liberado';
  }
  return 'Carregando';
}

function statusClassName(status = 'loading') {
  if (status === 'released') {
    return 'bg-emerald-50 text-emerald-700';
  }
  if (status === 'in_transit') {
    return 'bg-sky-50 text-sky-700';
  }
  if (status === 'awaiting_invoice') {
    return 'bg-zinc-900 text-white';
  }
  if (status === 'unloading') {
    return 'bg-zinc-100 text-zinc-700';
  }
  return 'bg-avapex-yellow text-avapex-black';
}
