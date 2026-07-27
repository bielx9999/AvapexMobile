import { type ReactNode, useMemo, useState } from 'react';
import { CalendarDays, ClipboardCheck, Filter, Search, UserRound, X, XCircle } from 'lucide-react';
import type { AppUser, Checklist, ChecklistType } from '../../shared/domain/models';

type ChecklistsPageProps = {
  checklists: Checklist[];
  users: AppUser[];
  loading: boolean;
};

type DriverCount = {
  driverId: string;
  name: string;
  total: number;
};

export function ChecklistsPage({ checklists, users, loading }: ChecklistsPageProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [driverId, setDriverId] = useState('');
  const [type, setType] = useState<'all' | ChecklistType>('all');
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const drivers = useMemo(
    () =>
      users
        .filter((user) => user.role === 'driver')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );

  const driverNames = useMemo(() => {
    return new Map(users.map((user) => [user.uid, user.name || user.email]));
  }, [users]);

  const filteredChecklists = useMemo(() => {
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
    const normalizedQuery = query.trim().toLowerCase();

    return checklists.filter((checklist) => {
      const createdAt = checklist.createdAt;
      if (start && (!createdAt || createdAt < start)) {
        return false;
      }
      if (end && (!createdAt || createdAt > end)) {
        return false;
      }
      if (driverId && checklist.driverId !== driverId) {
        return false;
      }
      if (type !== 'all' && checklist.type !== type) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      const searchable = [
        checklist.driverName,
        driverNames.get(checklist.driverId),
        checklist.vehiclePlate,
        checklist.vehicleId,
        checklistLabel(checklist.type),
        checklist.approvalStatus,
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [checklists, driverId, driverNames, endDate, query, startDate, type]);

  const stats = useMemo(() => {
    const total = filteredChecklists.length;
    const rejected = filteredChecklists.filter((checklist) => checklist.hasCriticalFailure).length;
    const approved = total - rejected;
    const uniqueDrivers = new Set(filteredChecklists.map((checklist) => checklist.driverId).filter(Boolean)).size;
    return { total, approved, rejected, uniqueDrivers };
  }, [filteredChecklists]);

  const byDriver = useMemo<DriverCount[]>(() => {
    const counts = new Map<string, DriverCount>();
    for (const checklist of filteredChecklists) {
      const id = checklist.driverId || 'sem-motorista';
      const current = counts.get(id);
      if (current) {
        current.total += 1;
      } else {
        counts.set(id, {
          driverId: id,
          name: checklist.driverName || driverNames.get(id) || id,
          total: 1,
        });
      }
    }
    return [...counts.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  }, [driverNames, filteredChecklists]);

  const byType = useMemo(() => {
    const counts = new Map<ChecklistType, number>();
    for (const checklist of filteredChecklists) {
      counts.set(checklist.type, (counts.get(checklist.type) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([checklistType, total]) => ({
        label: checklistLabel(checklistType),
        total,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredChecklists]);

  const maxDriverTotal = Math.max(...byDriver.map((item) => item.total), 1);
  const maxTypeTotal = Math.max(...byType.map((item) => item.total), 1);
  const activeFilterCount = [startDate, endDate, driverId, type !== 'all' ? type : '', query].filter(Boolean).length;

  function clearFilters() {
    setStartDate('');
    setEndDate('');
    setDriverId('');
    setType('all');
    setQuery('');
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          className={`ui-button flex h-10 items-center gap-2 px-4 text-sm font-semibold ${
            showFilters || activeFilterCount > 0
              ? 'bg-avapex-yellow text-avapex-black hover:bg-yellow-300'
              : 'border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50'
          }`}
          onClick={() => setShowFilters((current) => !current)}
          type="button"
        >
          <Filter size={17} />
          Filtros
          {activeFilterCount > 0 ? (
            <span className="rounded-full bg-avapex-black px-2 py-0.5 text-xs text-white">{activeFilterCount}</span>
          ) : null}
        </button>
      </div>

      {showFilters ? (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[1px]">
          <button
            aria-label="Fechar filtros"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => setShowFilters(false)}
            type="button"
          />
          <aside className="relative ml-auto flex h-full w-full max-w-sm flex-col bg-white/95 shadow-2xl backdrop-blur">
            <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-avapex-yellow text-avapex-black">
                  <Filter size={18} />
                </span>
                <h2 className="font-semibold">Filtros</h2>
              </div>
              <button
                aria-label="Fechar filtros"
                className="ui-icon-button flex h-9 w-9 items-center justify-center border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                onClick={() => setShowFilters(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Data inicial</span>
                <input className="ui-input h-10 w-full px-3 text-sm" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Data final</span>
                <input className="ui-input h-10 w-full px-3 text-sm" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Motorista</span>
                <select className="ui-input h-10 w-full px-3 text-sm" value={driverId} onChange={(event) => setDriverId(event.target.value)}>
                  <option value="">Todos</option>
                  {drivers.map((driver) => (
                    <option key={driver.uid} value={driver.uid}>
                      {driver.name || driver.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Modelo</span>
                <select className="ui-input h-10 w-full px-3 text-sm" value={type} onChange={(event) => setType(event.target.value as 'all' | ChecklistType)}>
                  <option value="all">Todos</option>
                  <option value="vehicle_daily">Checklist de Veiculo</option>
                  <option value="strap_ratchet">Cinta/Catraca</option>
                  <option value="chain_tensioner">Corrente/Tensionador</option>
                  <option value="departure">Saida</option>
                  <option value="arrival">Chegada</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Busca</span>
                <span className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input
                    className="ui-input h-10 w-full pl-10 pr-3 text-sm"
                    placeholder="Placa, motorista..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </span>
              </label>
            </div>

            <footer className="border-t border-zinc-200 px-5 py-4">
              <button className="ui-button flex h-10 w-full items-center justify-center gap-2 border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50" onClick={clearFilters} type="button">
                <XCircle size={17} />
                Limpar filtros
              </button>
            </footer>
          </aside>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<ClipboardCheck size={18} />} label="Total" value={loading ? '-' : stats.total} />
        <StatCard icon={<UserRound size={18} />} label="Motoristas" value={loading ? '-' : stats.uniqueDrivers} />
        <StatCard icon={<CalendarDays size={18} />} label="Aprovados" value={loading ? '-' : stats.approved} />
        <StatCard icon={<XCircle size={18} />} label="Reprovados" value={loading ? '-' : stats.rejected} danger={stats.rejected > 0} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Checklists por motorista">
          {byDriver.length > 0 ? (
            <div className="space-y-3">
              {byDriver.map((item) => (
                <BarRow key={item.driverId} label={item.name} value={item.total} max={maxDriverTotal} />
              ))}
            </div>
          ) : (
            <EmptyText>Nenhum checklist encontrado no filtro.</EmptyText>
          )}
        </ChartCard>

        <ChartCard title="Checklists por modelo">
          {byType.length > 0 ? (
            <div className="space-y-3">
              {byType.map((item) => (
                <BarRow key={item.label} label={item.label} value={item.total} max={maxTypeTotal} />
              ))}
            </div>
          ) : (
            <EmptyText>Nenhum checklist encontrado no filtro.</EmptyText>
          )}
        </ChartCard>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="font-semibold">Registros de checklist</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Motorista</th>
                <th className="px-4 py-3">Modelo</th>
                <th className="px-4 py-3">Veiculo</th>
                <th className="px-4 py-3">KM</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredChecklists.map((checklist) => (
                <tr className="border-t border-zinc-100" key={checklist.id}>
                  <td className="px-4 py-3">{formatDate(checklist.createdAt)}</td>
                  <td className="px-4 py-3">{checklist.driverName || driverNames.get(checklist.driverId) || checklist.driverId}</td>
                  <td className="px-4 py-3">{checklistLabel(checklist.type)}</td>
                  <td className="px-4 py-3">{checklist.vehiclePlate || checklist.vehicleId || '-'}</td>
                  <td className="px-4 py-3">{checklist.kmRegistered || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={checklist.hasCriticalFailure ? 'ui-pill bg-red-50 text-red-700' : 'ui-pill bg-emerald-50 text-emerald-700'}>
                      {checklist.hasCriticalFailure ? 'Reprovado' : 'Aprovado'}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && filteredChecklists.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-zinc-500" colSpan={6}>
                    Nenhum checklist encontrado.
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

type StatCardProps = {
  icon: ReactNode;
  label: string;
  value: number | string;
  danger?: boolean;
};

function StatCard({ icon, label, value, danger }: StatCardProps) {
  return (
    <article className="ui-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-500">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${danger ? 'bg-red-600 text-white' : 'bg-avapex-black text-white'}`}>
          {icon}
        </span>
      </div>
      <strong className="text-3xl font-semibold">{value}</strong>
    </article>
  );
}

type ChartCardProps = {
  title: string;
  children: ReactNode;
};

function ChartCard({ title, children }: ChartCardProps) {
  return (
    <section className="ui-card p-4">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

type BarRowProps = {
  label: string;
  value: number;
  max: number;
};

function BarRow({ label, value, max }: BarRowProps) {
  const width = Math.max(8, Math.round((value / max) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="truncate font-medium text-zinc-700">{label}</span>
        <span className="font-semibold text-zinc-900">{value}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-avapex-yellow" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function EmptyText({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">{children}</p>;
}

function checklistLabel(type: ChecklistType) {
  const labels: Record<ChecklistType, string> = {
    departure: 'Saida',
    arrival: 'Chegada',
    vehicle_daily: 'Checklist de Veiculo',
    chain_tensioner: 'Corrente/Tensionador',
    strap_ratchet: 'Cinta/Catraca',
  };
  return labels[type] ?? type;
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
