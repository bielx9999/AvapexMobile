import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileSpreadsheet,
  Filter,
  LineChart,
  LoaderCircle,
  Printer,
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
  const [tableDate, setTableDate] = useState('');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'pending' | 'approved' | 'reported'>('all');
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
      if (tableDate && checklist.createdAt?.toISOString().slice(0, 10) !== tableDate) {
        return false;
      }
      if (reviewFilter !== 'all' && (checklist.adminReviewStatus ?? 'pending') !== reviewFilter) {
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
  }, [checklists, driverId, driverNames, endDate, query, reviewFilter, startDate, tableDate, type]);

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

  const activeFilterCount = [startDate, endDate, driverId, type !== 'all' ? type : '', query, tableDate, reviewFilter !== 'all' ? reviewFilter : ''].filter(Boolean).length;

  useEffect(() => {
    onActiveFilterCountChange?.(activeFilterCount);
  }, [activeFilterCount, onActiveFilterCountChange]);

  function clearFilters() {
    setStartDate('');
    setEndDate('');
    setDriverId('');
    setType('all');
    setQuery('');
    setTableDate('');
    setReviewFilter('all');
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
                <span className="mb-2 block text-sm font-medium text-zinc-700">Status da analise</span>
                <select className="ui-input h-10 w-full px-3 text-sm" value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as typeof reviewFilter)}>
                  <option value="all">Todos</option><option value="pending">Pendentes</option><option value="approved">Aprovados</option><option value="reported">Erro reportado</option>
                </select>
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
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="font-semibold">Registros de checklist</h2><p className="mt-1 text-xs text-zinc-500">Selecione uma data ou situação para localizar os registros.</p></div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <input aria-label="Data dos checklists" className="ui-input h-10 min-w-0 px-3 text-sm" title="Data dos checklists" type="date" value={tableDate} onChange={(event) => setTableDate(event.target.value)} />
            <select aria-label="Status da analise" className="ui-input h-10 min-w-0 px-3 text-sm" value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as typeof reviewFilter)}><option value="all">Todos os status</option><option value="pending">Pendentes</option><option value="approved">Aprovados</option><option value="reported">Erro reportado</option></select>
            {(tableDate || reviewFilter !== 'all') ? <button className="ui-button col-span-2 h-10 gap-2 border border-zinc-200 bg-white px-3 text-sm sm:col-span-1" onClick={() => { setTableDate(''); setReviewFilter('all'); }} type="button"><X size={15} />Limpar</button> : null}
          </div>
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
                    <div className="flex justify-end gap-2">
                      {(checklist.adminReviewStatus ?? 'pending') !== 'pending' ? <><button aria-label="Imprimir checklist" className="ui-icon-button h-9 w-9 border-zinc-200 bg-white text-zinc-700" onClick={() => printOperationalChecklist(checklist, checklist.driverName || driverNames.get(checklist.driverId) || checklist.driverId)} title="Imprimir PDF" type="button"><Printer size={15} /></button><button aria-label="Exportar checklist para Excel" className="ui-icon-button h-9 w-9 border-zinc-200 bg-white text-zinc-700" onClick={() => exportOperationalChecklistExcel(checklist, checklist.driverName || driverNames.get(checklist.driverId) || checklist.driverId)} title="Exportar Excel" type="button"><FileSpreadsheet size={15} /></button></> : null}
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

function checklistHtmlEscape(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character);
}

function operationalChecklistFileName(checklist: Checklist, extension: string) {
  const date = checklist.createdAt?.toISOString().slice(0, 10) ?? 'sem-data';
  return `checklist-${checklist.vehiclePlate || checklist.vehicleId}-${date}${extension}`.replace(/\s+/g, '-').toLowerCase();
}

function printOperationalChecklist(checklist: Checklist, driverName: string) {
  if ((checklist.adminReviewStatus ?? 'pending') === 'pending') return;
  const answers = objectRows(checklist.answers && Object.keys(checklist.answers).length ? checklist.answers : checklist.items);
  const rows = answers.map(([key, value], index) => `<tr><td>${index + 1}</td><td>${checklistHtmlEscape(formatFieldName(key))}</td><td>${checklistHtmlEscape(formatUnknownValue(value))}</td></tr>`).join('');
  const photos = checklist.photoUrls.length ? `<section class="photos"><h2>Registros fotograficos</h2><div class="photo-grid">${checklist.photoUrls.map((url, index) => `<figure><img src="${checklistHtmlEscape(url)}" alt="Foto ${index + 1}"><figcaption>Foto ${index + 1}</figcaption></figure>`).join('')}</div></section>` : '';
  const signature = checklist.signatureUrl ? `<img class="signature-image" src="${checklistHtmlEscape(checklist.signatureUrl)}" alt="Assinatura do motorista">` : '<div class="signature-space"></div>';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${checklistHtmlEscape(checklistLabel(checklist.type))}</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#18181b;font-family:Arial,sans-serif;font-size:11px}.page{position:relative;min-height:270mm;padding:10mm;overflow:hidden}.page:before{content:"";position:absolute;inset:0;background:url('/checklist-pdf-background.png') right 10mm bottom 10mm/55% auto no-repeat;opacity:.1;z-index:0}.content{position:relative;z-index:1}.brand{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:3px solid #f3c400;padding-bottom:10px}.brand img{width:165px}.title{text-align:right}.title h1{margin:0;font-size:21px}.title p{margin:5px 0 0;color:#52525b}.info{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.box{border:1px solid #d4d4d8;border-radius:6px;background:rgba(255,255,255,.94);padding:8px}.label{display:block;color:#71717a;font-size:9px;text-transform:uppercase}.value{display:block;margin-top:3px;font-weight:700}table{width:100%;border-collapse:collapse;background:rgba(255,255,255,.94)}th,td{border:1px solid #d4d4d8;padding:7px;text-align:left;vertical-align:top}th{background:#f4f4f5;font-size:9px;text-transform:uppercase}.review{margin-top:12px;border:1px solid #d4d4d8;border-left:4px solid #f3c400;border-radius:6px;padding:9px;background:#fff}.review strong{display:block;margin-bottom:4px}.photos{margin-top:12px;break-inside:avoid}.photos h2{font-size:12px}.photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.photo-grid figure{margin:0}.photo-grid img{width:100%;height:105px;object-fit:cover;border:1px solid #d4d4d8}.photo-grid figcaption{text-align:center;font-size:9px;color:#71717a}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:28px;break-inside:avoid}.signature-wrap{height:86px;display:flex;align-items:flex-end;justify-content:center;border-bottom:1px solid #18181b}.signature-image{max-width:100%;max-height:80px;object-fit:contain}.signature-space{height:80px}.signature-label{text-align:center;padding-top:5px;font-size:10px}.footer{margin-top:14px;text-align:right;color:#71717a;font-size:9px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{padding:0}}</style></head><body><main class="page"><div class="content"><header class="brand"><img src="/checklist-pdf-logo.png" alt="AVAPEX Transportes"><div class="title"><h1>Checklist operacional</h1><p>${checklistHtmlEscape(checklistLabel(checklist.type))}</p></div></header><section class="info"><div class="box"><span class="label">Data e hora</span><span class="value">${checklistHtmlEscape(formatDate(checklist.createdAt))}</span></div><div class="box"><span class="label">Motorista</span><span class="value">${checklistHtmlEscape(driverName)}</span></div><div class="box"><span class="label">Veiculo</span><span class="value">${checklistHtmlEscape(checklist.vehiclePlate || checklist.vehicleId || '-')}</span></div><div class="box"><span class="label">Quilometragem</span><span class="value">${checklist.kmRegistered ? checklist.kmRegistered.toLocaleString('pt-BR') + ' km' : '-'}</span></div><div class="box"><span class="label">Resultado</span><span class="value">${checklist.hasCriticalFailure ? 'Com nao conformidade' : 'Sem falha critica'}</span></div><div class="box"><span class="label">Analise administrativa</span><span class="value">${checklistHtmlEscape(reviewStatusLabel(checklist))}</span></div></section><table><thead><tr><th>#</th><th>Item verificado</th><th>Resposta</th></tr></thead><tbody>${rows}</tbody></table><section class="review"><strong>Resultado da analise administrativa</strong>${checklistHtmlEscape(checklist.adminReviewMessage || reviewStatusLabel(checklist))}<br><small>Revisado em ${checklistHtmlEscape(formatDate(checklist.reviewedAt ?? null))}</small></section>${photos}<section class="signatures"><div><div class="signature-wrap">${signature}</div><div class="signature-label">Assinatura do motorista<br>${checklistHtmlEscape(driverName)}</div></div><div><div class="signature-wrap"><div class="signature-space"></div></div><div class="signature-label">Assinatura do responsavel pela analise</div></div></section><div class="footer">Documento gerado em ${checklistHtmlEscape(formatDate(new Date()))}</div></div></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400));</script></body></html>`;
  const printWindow = window.open('', '_blank', 'width=1000,height=1200'); if (!printWindow) return; printWindow.document.open(); printWindow.document.write(html); printWindow.document.close();
}

function exportOperationalChecklistExcel(checklist: Checklist, driverName: string) {
  if ((checklist.adminReviewStatus ?? 'pending') === 'pending') return;
  const answers = objectRows(checklist.answers && Object.keys(checklist.answers).length ? checklist.answers : checklist.items);
  const rows = answers.map(([key, value], index) => `<tr><td>${index + 1}</td><td>${checklistHtmlEscape(formatFieldName(key))}</td><td>${checklistHtmlEscape(formatUnknownValue(value))}</td></tr>`).join('');
  const content = `<!doctype html><html><head><meta charset="utf-8"></head><body><table border="1"><tr><th colspan="3" style="font-size:18px;background:#f3c400">CHECKLIST OPERACIONAL</th></tr><tr><th>Modelo</th><td colspan="2">${checklistHtmlEscape(checklistLabel(checklist.type))}</td></tr><tr><th>Data e hora</th><td colspan="2">${checklistHtmlEscape(formatDate(checklist.createdAt))}</td></tr><tr><th>Motorista</th><td colspan="2">${checklistHtmlEscape(driverName)}</td></tr><tr><th>Veiculo</th><td colspan="2">${checklistHtmlEscape(checklist.vehiclePlate || checklist.vehicleId)}</td></tr><tr><th>KM</th><td colspan="2">${checklist.kmRegistered || ''}</td></tr><tr><th>Status administrativo</th><td colspan="2">${checklistHtmlEscape(reviewStatusLabel(checklist))}</td></tr><tr><th>Mensagem da analise</th><td colspan="2">${checklistHtmlEscape(checklist.adminReviewMessage || '')}</td></tr><tr></tr><tr><th>#</th><th>Item verificado</th><th>Resposta</th></tr>${rows}</table></body></html>`;
  const url = URL.createObjectURL(new Blob(['\ufeff', content], { type: 'application/vnd.ms-excel;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = operationalChecklistFileName(checklist, '.xls'); link.click(); URL.revokeObjectURL(url);
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
