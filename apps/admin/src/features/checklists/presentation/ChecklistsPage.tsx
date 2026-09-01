import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Eye,
  Filter,
  LineChart,
  LoaderCircle,
  Search,
  Send,
  UsersRound,
  X,
  XCircle,
} from 'lucide-react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { adminWriteRepository } from '../../shared/data/firestoreCollections';
import type { AppUser, Checklist, ChecklistType } from '../../shared/domain/models';
import { MetricCard } from '../../shared/presentation/ui';

type ChecklistsPageProps = {
  checklists: Checklist[];
  users: AppUser[];
  loading: boolean;
  onActiveFilterCountChange?: (count: number) => void;
  onShowFiltersChange?: (show: boolean) => void;
  showFilters?: boolean;
};

type DriverCount = {
  driverId: string;
  name: string;
  total: number;
};

export function ChecklistsPage({
  checklists,
  users,
  loading,
  onActiveFilterCountChange,
  onShowFiltersChange,
  showFilters = false,
}: ChecklistsPageProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [driverId, setDriverId] = useState('');
  const [type, setType] = useState<'all' | ChecklistType>('all');
  const [query, setQuery] = useState('');
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
  const [reportMessage, setReportMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyAction, setBusyAction] = useState<'approve' | 'report' | ''>('');

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
    const approved = filteredChecklists.filter((checklist) => checklist.adminReviewStatus === 'approved').length;
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

  const byDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const checklist of filteredChecklists) {
      if (!checklist.createdAt) {
        continue;
      }
      const key = checklist.createdAt.toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredChecklists]);

  const activeFilterCount = [startDate, endDate, driverId, type !== 'all' ? type : '', query].filter(Boolean).length;

  useEffect(() => {
    onActiveFilterCountChange?.(activeFilterCount);
  }, [activeFilterCount, onActiveFilterCountChange]);

  function clearFilters() {
    setStartDate('');
    setEndDate('');
    setDriverId('');
    setType('all');
    setQuery('');
  }

  function openAnalysis(checklist: Checklist) {
    setSelectedChecklist(checklist);
    setReportMessage(checklist.adminReviewMessage ?? '');
    setActionError('');
  }

  async function approveChecklist(checklist: Checklist) {
    setBusyAction('approve');
    setActionError('');
    try {
      await adminWriteRepository.approveChecklist(checklist);
      setSelectedChecklist(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Erro ao aprovar checklist.');
    } finally {
      setBusyAction('');
    }
  }

  async function reportChecklist(checklist: Checklist) {
    setBusyAction('report');
    setActionError('');
    try {
      await adminWriteRepository.reportChecklistError(checklist, reportMessage);
      setSelectedChecklist(null);
      setReportMessage('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Erro ao reportar erro no checklist.');
    } finally {
      setBusyAction('');
    }
  }

  return (
    <div className="space-y-5">
      {showFilters ? (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[1px]">
          <button
            aria-label="Fechar filtros"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => onShowFiltersChange?.(false)}
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
                onClick={() => onShowFiltersChange?.(false)}
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

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard icon={<ClipboardList size={19} />} label="Total" value={loading ? '-' : stats.total} />
        <MetricCard icon={<UsersRound size={19} />} label="Motoristas" tone="accent" value={loading ? '-' : stats.uniqueDrivers} />
        <MetricCard icon={<CheckCircle2 size={19} />} label="Aprovados" tone="success" value={loading ? '-' : stats.approved} />
        <MetricCard icon={<AlertTriangle size={19} />} label="Reprovados" tone="danger" value={loading ? '-' : stats.rejected} />
      </section>

      <section className="grid gap-4">
        <ChartCard icon={<LineChart size={18} />} title="Evolucao de checklists">
          {byDay.length > 0 ? (
            <ApexDatetimeChart data={byDay} />
          ) : (
            <EmptyText>Nenhum checklist encontrado no filtro.</EmptyText>
          )}
        </ChartCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard icon={<UsersRound size={18} />} title="Checklists por motorista">
          {byDriver.length > 0 ? (
            <ApexBarChart
              categories={byDriver.map((item) => item.name)}
              color="#FACC15"
              data={byDriver.map((item) => item.total)}
              seriesName="Checklists"
            />
          ) : (
            <EmptyText>Nenhum checklist encontrado no filtro.</EmptyText>
          )}
        </ChartCard>
        <ChartCard icon={<BarChart3 size={18} />} title="Checklists por modelo">
          {byType.length > 0 ? (
            <ApexBarChart
              categories={byType.map((item) => item.label)}
              color="#1F1C1C"
              data={byType.map((item) => item.total)}
              seriesName="Checklists"
            />
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
          <table className="ui-table min-w-[920px]">
            <thead>
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Motorista</th>
                <th className="px-4 py-3">Modelo</th>
                <th className="px-4 py-3">Veiculo</th>
                <th className="px-4 py-3">KM</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Analise</th>
              </tr>
            </thead>
            <tbody>
              {filteredChecklists.map((checklist) => (
                <tr key={checklist.id}>
                  <td className="px-4 py-3">
                    <span className="block text-sm font-medium text-zinc-900">{formatDateOnly(checklist.createdAt)}</span>
                    <span className="text-xs text-zinc-500">{formatTimeOnly(checklist.createdAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-medium text-zinc-900">{checklist.driverName || driverNames.get(checklist.driverId) || checklist.driverId}</span>
                    <span className="text-xs text-zinc-500">{checklist.driverId}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-lg bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">{checklistLabel(checklist.type)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-medium text-zinc-900">{checklist.vehiclePlate || checklist.vehicleId || '-'}</span>
                    <span className="text-xs text-zinc-500">{checklist.photoUrls.length} foto(s)</span>
                  </td>
                  <td className="px-4 py-3">{checklist.kmRegistered || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={reviewStatusClass(checklist)}>
                      {reviewStatusLabel(checklist)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        className="ui-button h-9 gap-2 border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                        onClick={() => openAnalysis(checklist)}
                        type="button"
                      >
                        <Eye size={15} />
                        Analisar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredChecklists.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-zinc-500" colSpan={7}>
                    Nenhum checklist encontrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {selectedChecklist ? (
        <ChecklistAnalysisPanel
          actionError={actionError}
          busyAction={busyAction}
          checklist={selectedChecklist}
          driverName={selectedChecklist.driverName || driverNames.get(selectedChecklist.driverId) || selectedChecklist.driverId}
          onApprove={() => void approveChecklist(selectedChecklist)}
          onClose={() => setSelectedChecklist(null)}
          onReport={() => void reportChecklist(selectedChecklist)}
          reportMessage={reportMessage}
          setReportMessage={setReportMessage}
        />
      ) : null}
    </div>
  );
}

type ChartCardProps = {
  icon: ReactNode;
  title: string;
  children: ReactNode;
};

function ChartCard({ icon, title, children }: ChartCardProps) {
  return (
    <section className="ui-card overflow-hidden p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-avapex-black">
          {icon}
        </span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

type ApexBarChartProps = {
  categories: string[];
  data: number[];
  color: string;
  seriesName: string;
};

function ApexBarChart({ categories, data, color, seriesName }: ApexBarChartProps) {
  const options: ApexOptions = {
    chart: {
      fontFamily: 'Inter, system-ui, sans-serif',
      toolbar: { show: false },
    },
    colors: [color],
    dataLabels: {
      enabled: true,
      offsetX: 2,
      style: { colors: ['#111111'] },
    },
    grid: {
      borderColor: '#E5E7EB',
      strokeDashArray: 4,
    },
    plotOptions: {
      bar: {
        barHeight: '58%',
        borderRadius: 7,
        horizontal: true,
      },
    },
    tooltip: {
      theme: 'light',
      y: {
        formatter: (value) => `${value} checklists`,
      },
    },
    xaxis: {
      categories,
      labels: {
        show: false,
        style: { colors: '#52525B' },
      },
    },
    yaxis: {
      labels: {
        maxWidth: 180,
        style: { colors: '#52525B' },
      },
    },
  };

  return (
    <Chart height={260} options={options} series={[{ data, name: seriesName }]} type="bar" />
  );
}

type ApexDatetimeChartProps = {
  data: Array<{ date: string; total: number }>;
};

function ApexDatetimeChart({ data }: ApexDatetimeChartProps) {
  const seriesData = data.map((item) => ({
    x: new Date(`${item.date}T12:00:00`).getTime(),
    y: item.total,
  }));

  const options: ApexOptions = {
    chart: {
      id: 'checklist-datetime-xaxis',
      fontFamily: 'Inter, system-ui, sans-serif',
      toolbar: {
        show: true,
        tools: {
          download: false,
          pan: false,
          reset: true,
          selection: false,
          zoom: true,
          zoomin: true,
          zoomout: true,
        },
      },
      zoom: {
        autoScaleYaxis: true,
        enabled: true,
        type: 'x',
      },
    },
    colors: ['#FACC15'],
    dataLabels: { enabled: false },
    markers: {
      hover: { size: 6 },
      size: 3,
      strokeColors: '#FFFFFF',
      strokeWidth: 2,
    },
    noData: {
      text: 'Sem dados no periodo',
      style: {
        color: '#71717A',
      },
    },
    grid: {
      borderColor: '#E5E7EB',
      strokeDashArray: 4,
    },
    stroke: {
      curve: 'smooth',
      width: 2.5,
    },
    tooltip: {
      theme: 'light',
      x: { format: 'dd/MM/yyyy' },
      y: {
        formatter: (value) => `${Math.round(Number(value))} checklists`,
      },
    },
    xaxis: {
      axisBorder: { color: '#E5E7EB' },
      axisTicks: { color: '#E5E7EB' },
      labels: {
        datetimeUTC: false,
        format: 'dd/MM',
        style: { colors: '#52525B' },
      },
      type: 'datetime',
    },
    yaxis: {
      decimalsInFloat: 0,
      forceNiceScale: true,
      min: 0,
      labels: {
        formatter: (value) => `${Math.round(Number(value))}`,
        style: { colors: '#52525B' },
      },
    },
  };

  return (
    <Chart
      height={230}
      options={options}
      series={[
        {
          data: seriesData,
          name: 'Checklists',
        },
      ]}
      type="line"
    />
  );
}

function EmptyText({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">{children}</p>;
}

type ChecklistAnalysisPanelProps = {
  actionError: string;
  busyAction: 'approve' | 'report' | '';
  checklist: Checklist;
  driverName: string;
  onApprove: () => void;
  onClose: () => void;
  onReport: () => void;
  reportMessage: string;
  setReportMessage: (value: string) => void;
};

function ChecklistAnalysisPanel({
  actionError,
  busyAction,
  checklist,
  driverName,
  onApprove,
  onClose,
  onReport,
  reportMessage,
  setReportMessage,
}: ChecklistAnalysisPanelProps) {
  const reviewed = (checklist.adminReviewStatus ?? 'pending') !== 'pending';
  const answerRows = objectRows(checklist.answers && Object.keys(checklist.answers).length > 0 ? checklist.answers : checklist.items);

  return (
    <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[1px]">
      <button aria-label="Fechar analise" className="absolute inset-0 h-full w-full cursor-default" onClick={onClose} type="button" />
      <aside className="relative ml-auto flex h-full w-full max-w-2xl flex-col bg-zinc-50 shadow-2xl">
        <header className="border-b border-zinc-200 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-zinc-950">Analise do checklist</h2>
                <span className={reviewStatusClass(checklist)}>{reviewStatusLabel(checklist)}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">{checklistLabel(checklist.type)} - {formatDate(checklist.createdAt)}</p>
            </div>
            <button aria-label="Fechar" className="ui-icon-button h-9 w-9 border-zinc-300 text-zinc-700 hover:bg-zinc-50" onClick={onClose} type="button">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <section className="grid gap-3 sm:grid-cols-2">
            <DetailCard icon={<UsersRound size={17} />} label="Motorista" value={driverName} helper={checklist.driverId} />
            <DetailCard icon={<ClipboardList size={17} />} label="Modelo" value={checklistLabel(checklist.type)} helper={formatDate(checklist.createdAt)} />
            <DetailCard icon={<BarChart3 size={17} />} label="Veiculo" value={checklist.vehiclePlate || checklist.vehicleId || '-'} helper={checklist.vehicleId} />
            <DetailCard icon={<LineChart size={17} />} label="Quilometragem" value={checklist.kmRegistered ? `${checklist.kmRegistered.toLocaleString('pt-BR')} km` : '-'} helper={checklist.hasCriticalFailure ? 'Contem nao conformidade' : 'Sem falha critica marcada'} />
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-zinc-950">Respostas registradas</h3>
              <span className="text-xs font-medium text-zinc-500">{answerRows.length} campos</span>
            </div>
            <div className="divide-y divide-zinc-100">
              {answerRows.length > 0 ? answerRows.map(([key, value]) => (
                <div className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[210px_1fr]" key={key}>
                  <span className="font-medium text-zinc-600">{formatFieldName(key)}</span>
                  <span className={answerValueClass(value)}>{formatUnknownValue(value)}</span>
                </div>
              )) : (
                <p className="px-4 py-6 text-sm text-zinc-500">Nenhuma resposta detalhada encontrada.</p>
              )}
            </div>
          </section>

          {checklist.photoUrls.length > 0 ? (
            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-zinc-950">Fotos anexadas</h3>
                <span className="text-xs font-medium text-zinc-500">Clique para abrir</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {checklist.photoUrls.map((url, index) => (
                  <a className="group overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50" href={url} key={url} rel="noreferrer" target="_blank">
                    <img alt={`Foto ${index + 1}`} className="h-32 w-full object-cover transition-transform group-hover:scale-[1.03]" src={url} />
                    <span className="block px-2 py-1.5 text-xs font-medium text-zinc-600">Foto {index + 1}</span>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {reviewed ? (
            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-zinc-950">Resultado da analise</h3>
              <p className="mt-2 text-sm text-zinc-700">{checklist.adminReviewMessage || reviewStatusLabel(checklist)}</p>
              <p className="mt-2 text-xs text-zinc-500">Revisado em {formatDate(checklist.reviewedAt ?? null)}</p>
            </section>
          ) : (
            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-zinc-950">Erro para reportar ao motorista</span>
                <textarea
                  className="ui-input min-h-28 w-full resize-y px-3 py-2 text-sm"
                  onChange={(event) => setReportMessage(event.target.value)}
                  placeholder="Descreva o que precisa ser corrigido ou reenviado..."
                  value={reportMessage}
                />
              </label>
              {actionError ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{actionError}</p> : null}
            </section>
          )}
        </div>

        {!reviewed ? (
          <footer className="grid gap-2 border-t border-zinc-200 px-5 py-4 sm:grid-cols-2">
            <button className="ui-button h-11 gap-2 bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60" disabled={Boolean(busyAction)} onClick={onApprove} type="button">
              {busyAction === 'approve' ? <LoaderCircle className="animate-spin" size={17} /> : <CheckCircle2 size={17} />}
              Aprovar checklist
            </button>
            <button className="ui-button h-11 gap-2 border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60" disabled={Boolean(busyAction)} onClick={onReport} type="button">
              {busyAction === 'report' ? <LoaderCircle className="animate-spin" size={17} /> : <Send size={17} />}
              Reportar erro
            </button>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}

function DetailCard({ helper, icon, label, value }: { helper: string; icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-800">{icon}</span>
        <div className="min-w-0">
          <span className="block text-xs font-medium uppercase text-zinc-500">{label}</span>
          <strong className="mt-1 block truncate text-sm text-zinc-950" title={value}>{value}</strong>
          <span className="mt-1 block truncate text-xs text-zinc-500" title={helper}>{helper || '-'}</span>
        </div>
      </div>
    </div>
  );
}

function objectRows(value: Record<string, unknown> | undefined) {
  return Object.entries(value ?? {}).filter(([, item]) => item !== undefined && item !== null && item !== '');
}

function formatFieldName(value: string) {
  return value
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatUnknownValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Sim' : 'Nao';
  if (typeof value === 'number') return value.toLocaleString('pt-BR');
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(formatUnknownValue).join(', ');
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${formatFieldName(key)}: ${formatUnknownValue(item)}`)
      .join(' | ');
  }
  return '-';
}

function answerValueClass(value: unknown) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (value === true || normalized === 'c' || normalized === 'conforme' || normalized === 'sim' || normalized === 'approved') {
    return 'break-words font-semibold text-emerald-700';
  }
  if (value === false || normalized === 'nc' || normalized === 'nao conforme' || normalized === 'não conforme' || normalized === 'nao' || normalized === 'não' || normalized === 'reproved') {
    return 'break-words font-semibold text-red-700';
  }
  if (normalized === 'na' || normalized === 'n/a') {
    return 'break-words font-semibold text-zinc-500';
  }
  return 'break-words text-zinc-900';
}

function reviewStatusLabel(checklist: Checklist) {
  if (checklist.adminReviewStatus === 'approved') return 'Aprovado pelo ADM';
  if (checklist.adminReviewStatus === 'reported') return 'Erro reportado';
  return checklist.hasCriticalFailure ? 'Pendente com NC' : 'Pendente';
}

function reviewStatusClass(checklist: Checklist) {
  if (checklist.adminReviewStatus === 'approved') return 'ui-pill bg-emerald-50 text-emerald-700';
  if (checklist.adminReviewStatus === 'reported') return 'ui-pill bg-red-50 text-red-700';
  if (checklist.hasCriticalFailure) return 'ui-pill bg-amber-50 text-amber-700';
  return 'ui-pill bg-zinc-100 text-zinc-700';
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

function formatDateOnly(value: Date | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(value);
}

function formatTimeOnly(value: Date | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(value);
}
