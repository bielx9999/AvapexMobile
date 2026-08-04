import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ClipboardCheck,
  Filter,
  Fuel,
  LogOut,
  PackageCheck,
  RefreshCw,
  Route,
  Truck,
  Users,
} from 'lucide-react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { logoutAdmin, type AdminSession } from '../../auth/data/authRepository';
import { ChecklistsPage } from '../../checklists/presentation/ChecklistsPage';
import { AbastecimentoPage } from '../../fueling/presentation/AbastecimentoPage';
import { ComprovantesPage } from '../../receipts/presentation/ComprovantesPage';
import { RotasPage } from '../../routes/presentation/RotasPage';
import { ProgramacaoPage } from '../../scheduling/presentation/ProgramacaoPage';
import { adminReadRepository } from '../../shared/data/firestoreCollections';
import { UsersPage } from '../../users/presentation/UsersPage';
import { VehiclesPage } from '../../vehicles/presentation/VehiclesPage';
import type {
  AppUser,
  Checklist,
  DeliveryReceipt,
  DriverEquipment,
  FuelingRecord,
  Trip,
  Vehicle,
} from '../../shared/domain/models';

type DashboardData = {
  users: AppUser[];
  vehicles: Vehicle[];
  trips: Trip[];
  checklists: Checklist[];
  receipts: DeliveryReceipt[];
  fueling: FuelingRecord[];
  equipment: DriverEquipment[];
};

const emptyData: DashboardData = {
  users: [],
  vehicles: [],
  trips: [],
  checklists: [],
  receipts: [],
  fueling: [],
  equipment: [],
};

type AdminDashboardProps = {
  session: AdminSession;
};

type AdminPage = 'dashboard' | 'users' | 'vehicles' | 'checklists' | 'receipts' | 'fueling' | 'scheduling' | 'routes';

export function AdminDashboard({ session }: AdminDashboardProps) {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePage, setActivePage] = useState<AdminPage>('dashboard');
  const [checklistFilterCount, setChecklistFilterCount] = useState(0);
  const [showChecklistFilters, setShowChecklistFilters] = useState(false);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [users, vehicles, trips, checklists, receipts, fueling, equipment] = await Promise.all([
        adminReadRepository.users(),
        adminReadRepository.vehicles(),
        adminReadRepository.trips(),
        adminReadRepository.checklists(),
        adminReadRepository.deliveryReceipts(),
        adminReadRepository.fuelingRecords(),
        adminReadRepository.driverEquipments(),
      ]);
      setData({ users, vehicles, trips, checklists, receipts, fueling, equipment });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar painel.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const dashboard = useMemo(() => buildDashboardView(data), [data]);

  const pageTitle =
    activePage === 'users'
      ? 'Usuarios'
      : activePage === 'vehicles'
        ? 'Veiculos'
        : activePage === 'checklists'
          ? 'Checklists'
          : activePage === 'receipts'
            ? 'Comprovantes'
            : activePage === 'fueling'
              ? 'Abastecimento'
              : activePage === 'scheduling'
                ? 'Programacao'
                : activePage === 'routes'
                  ? 'Rotas'
                  : 'Dashboard';
  const navItems: Array<{ key: AdminPage; label: string }> = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'users', label: 'Usuarios' },
    { key: 'vehicles', label: 'Veiculos' },
    { key: 'scheduling', label: 'Programacao' },
    { key: 'routes', label: 'Rotas' },
    { key: 'checklists', label: 'Checklists' },
    { key: 'receipts', label: 'Comprovantes' },
    { key: 'fueling', label: 'Abastecimento' },
  ];

  return (
    <main className="min-h-screen bg-avapex-paper text-avapex-ink">
      <aside className="fixed left-0 top-0 hidden h-full w-64 flex-col bg-avapex-black px-5 py-6 text-white lg:flex">
        <div>
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-avapex-yellow font-black text-avapex-black">
              AV
            </div>
            <div>
              <p className="font-semibold">Avapex</p>
              <p className="text-xs text-zinc-400">Painel administrativo</p>
            </div>
          </div>

          <nav className="space-y-1 text-sm">
            {navItems.map((item) => (
              <button
                className={`flex h-10 w-full items-center rounded-xl px-3 text-left ${
                  activePage === item.key
                    ? 'bg-avapex-yellow font-semibold text-avapex-black'
                    : 'text-zinc-200 hover:bg-white/10'
                }`}
                key={item.label}
                onClick={() => setActivePage(item.key)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto border-t border-white/10 pt-4">
          <p className="truncate px-3 text-sm font-medium">{session.profile.name || session.firebaseUser.email}</p>
          <p className="mt-1 truncate px-3 text-xs text-zinc-400">{session.firebaseUser.email}</p>
          <button
            className="ui-button mt-4 flex h-10 w-full items-center gap-2 bg-white/10 px-3 text-sm font-medium text-white hover:bg-white/15"
            onClick={() => void logoutAdmin()}
            type="button"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      <section className="lg:pl-64">
        <header className="flex min-h-20 flex-col justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">{pageTitle}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activePage === 'checklists' ? (
              <button
                className={`ui-button flex h-10 items-center gap-2 px-4 text-sm font-semibold ${
                  showChecklistFilters || checklistFilterCount > 0
                    ? 'bg-avapex-yellow text-avapex-black hover:bg-yellow-300'
                    : 'border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50'
                }`}
                onClick={() => setShowChecklistFilters((current) => !current)}
                type="button"
              >
                <Filter size={17} />
                Filtros
                {checklistFilterCount > 0 ? (
                  <span className="rounded-full bg-avapex-black px-2 py-0.5 text-xs text-white">
                    {checklistFilterCount}
                  </span>
                ) : null}
              </button>
            ) : null}
            <button
              className="ui-button flex h-10 items-center gap-2 border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              onClick={() => void loadData()}
              type="button"
            >
              <RefreshCw size={16} />
              Atualizar
            </button>
          </div>
        </header>

        <div className="px-4 py-6 sm:px-6">
          {error ? <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

          {activePage === 'users' ? (
            <UsersPage
              currentUid={session.firebaseUser.uid}
              users={data.users}
              loading={loading}
              onChanged={loadData}
            />
          ) : activePage === 'vehicles' ? (
            <VehiclesPage vehicles={data.vehicles} loading={loading} onChanged={loadData} />
          ) : activePage === 'checklists' ? (
            <ChecklistsPage
              checklists={data.checklists}
              loading={loading}
              onActiveFilterCountChange={setChecklistFilterCount}
              onShowFiltersChange={setShowChecklistFilters}
              showFilters={showChecklistFilters}
              users={data.users}
            />
          ) : activePage === 'receipts' ? (
            <ComprovantesPage loading={loading} onChanged={loadData} receipts={data.receipts} />
          ) : activePage === 'fueling' ? (
            <AbastecimentoPage fueling={data.fueling} loading={loading} onChanged={loadData} />
          ) : activePage === 'scheduling' ? (
            <ProgramacaoPage
              loading={loading}
              onChanged={loadData}
              trips={data.trips}
              users={data.users}
              vehicles={data.vehicles}
            />
          ) : activePage === 'routes' ? (
            <RotasPage loading={loading} trips={data.trips} />
          ) : (
            <DashboardHome dashboard={dashboard} loading={loading} onNavigate={setActivePage} />
          )}
        </div>
      </section>
    </main>
  );
}

type DashboardView = ReturnType<typeof buildDashboardView>;

function DashboardHome({
  dashboard,
  loading,
  onNavigate,
}: {
  dashboard: DashboardView;
  loading: boolean;
  onNavigate: (page: AdminPage) => void;
}) {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-6">
        <KpiCard
          icon={<Truck size={20} />}
          label="Cargas hoje"
          meta={`${dashboard.tripsWithoutAssignment} sem atribuicao`}
          tone={dashboard.tripsWithoutAssignment > 0 ? 'danger' : 'success'}
          value={loading ? '-' : dashboard.tripsToday.length}
          variation="Fluxo operacional"
        />
        <KpiCard
          icon={<Route size={20} />}
          label="Rotas em andamento"
          meta={`${dashboard.routesPendingConfirmation} pendentes de envio`}
          tone={dashboard.routesInProgress > 0 ? 'info' : 'dark'}
          value={loading ? '-' : dashboard.routesInProgress}
          variation="Google Maps"
        />
        <KpiCard
          icon={<ClipboardCheck size={20} />}
          label="Checklists aprovados"
          meta={`${dashboard.vehiclesWithoutChecklist} veiculos sem checklist`}
          tone={dashboard.checklistApprovalToday < 90 ? 'yellow' : 'success'}
          value={loading ? '-' : `${dashboard.checklistApprovalToday}%`}
          variation="Meta 95%"
        />
        <KpiCard
          icon={<PackageCheck size={20} />}
          label="Comprovantes pendentes"
          meta={`${dashboard.receiptsPending} aguardando analise`}
          tone={dashboard.receiptsPending > 0 ? 'yellow' : 'success'}
          value={loading ? '-' : `${dashboard.receiptPendingPercent}%`}
          variation="Fechamento de entrega"
        />
        <KpiCard
          icon={<Fuel size={20} />}
          label="Abastecimentos no mes"
          meta="Litros/valor aguardam schema"
          tone="dark"
          value={loading ? '-' : dashboard.fuelingThisMonth.length}
          variation="Base para km/l"
        />
        <KpiCard
          icon={<AlertTriangle size={20} />}
          label="Alertas ativos"
          meta="Itens que pedem acao"
          tone={dashboard.alerts.length > 0 ? 'danger' : 'success'}
          value={loading ? '-' : dashboard.alerts.length}
          variation="Agora"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartPanel title="Cargas por status" icon={<Route size={18} />}>
            <StatusFunnelChart data={dashboard.tripStatusCounts} />
          </ChartPanel>
          <ChartPanel title="Cargas por motorista" icon={<Users size={18} />}>
            <DriverBarChart data={dashboard.deliveriesByDriver} />
          </ChartPanel>
          <ChartPanel title="Abastecimentos por dia" icon={<Fuel size={18} />}>
            <FuelingLineChart data={dashboard.fuelingByDay} />
          </ChartPanel>
          <ChartPanel title="Comprovantes por status" icon={<PackageCheck size={18} />}>
            <ReceiptDonutChart delivered={dashboard.receiptsDelivered} failed={dashboard.receiptsFailed} pending={dashboard.receiptsPending} />
          </ChartPanel>
        </div>

        <section className="ui-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-red-50 text-red-700">
              <AlertTriangle size={18} />
            </span>
            <h2 className="font-semibold">Alertas de acao</h2>
          </div>
          <div className="divide-y divide-zinc-100">
            {dashboard.alerts.map((alert) => (
              <article className="px-4 py-3" key={alert.title}>
                <span className={`ui-pill ${alert.tone === 'danger' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-800'}`}>
                  {alert.area}
                </span>
                <p className="mt-2 text-sm font-semibold text-zinc-900">{alert.title}</p>
                <p className="mt-1 text-xs text-zinc-500">{alert.description}</p>
              </article>
            ))}
            {!loading && dashboard.alerts.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-500">Nenhuma acao critica agora.</p>
            ) : null}
          </div>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <ActionTable
          actionLabel="Abrir programacao"
          headers={['Data', 'Solicitacao', 'Motorista', 'Veiculo', 'Status']}
          onAction={() => onNavigate('scheduling')}
          rows={dashboard.tripsToday.slice(0, 8).map((trip) => [
            formatDate(trip.scheduledAt),
            trip.customerRequestNumber || '-',
            trip.driverName || trip.driverId || '-',
            trip.vehiclePlate || trip.vehicleId || '-',
            tripStatusLabel(trip),
          ])}
          title="Programacoes do dia"
        />
        <ActionTable
          actionLabel="Abrir comprovantes"
          headers={['Data', 'Motorista', 'CT-e', 'Status']}
          onAction={() => onNavigate('receipts')}
          rows={dashboard.pendingReceipts.slice(0, 8).map((receipt) => [
            formatDate(receipt.createdAt),
            receipt.driverName || receipt.driverId,
            receipt.cteNumber || receipt.cteAccessKey || '-',
            receiptStatusLabel(receipt),
          ])}
          title="Comprovantes pendentes"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ActionTable
          actionLabel="Abrir abastecimento"
          headers={['Data', 'Motorista', 'Veiculo', 'KM', 'Status']}
          onAction={() => onNavigate('fueling')}
          rows={dashboard.recentFueling.slice(0, 8).map((record) => [
            formatDate(record.createdAt),
            record.driverName || record.driverId,
            record.vehiclePlate || record.vehicleId || '-',
            formatNumber(record.kmRegistered),
            fuelingStatusLabel(record.notificationStatus),
          ])}
          title="Abastecimentos recentes"
        />
        <ActionTable
          actionLabel="Abrir rotas"
          headers={['Carga', 'Origem', 'Destino', 'Motorista']}
          onAction={() => onNavigate('routes')}
          rows={dashboard.routeCandidates.slice(0, 8).map((trip) => [
            trip.customerRequestNumber || '-',
            trip.origin || '-',
            trip.destination || '-',
            trip.driverName || trip.driverId || '-',
          ])}
          title="Rotas para envio"
        />
      </section>
    </div>
  );
}

function buildDashboardView(data: DashboardData) {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const weekEnd = new Date(todayEnd);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const tripsToday = data.trips.filter((trip) => isBetween(trip.scheduledAt, todayStart, todayEnd));
  const tripsThisWeek = data.trips.filter((trip) => isBetween(trip.scheduledAt, todayStart, weekEnd));
  const fuelingThisMonth = data.fueling.filter((record) => record.createdAt && record.createdAt >= monthStart);
  const checklistsToday = data.checklists.filter((checklist) => isBetween(checklist.createdAt, todayStart, todayEnd));
  const receiptsToday = data.receipts.filter((receipt) => isBetween(receipt.createdAt, todayStart, todayEnd));
  const pendingReceipts = data.receipts.filter((receipt) => (receipt.adminStatus ?? 'pending') === 'pending');
  const receiptsDelivered = data.receipts.filter((receipt) => receipt.adminStatus === 'delivered').length;
  const receiptsFailed = data.receipts.filter((receipt) => receipt.adminStatus === 'failed').length;
  const receiptsPending = pendingReceipts.length;
  const receiptPendingPercent = data.receipts.length > 0 ? Math.round((receiptsPending / data.receipts.length) * 100) : 0;

  const rejectedToday = checklistsToday.filter((checklist) => checklist.hasCriticalFailure).length;
  const checklistApprovalToday = checklistsToday.length > 0 ? Math.round(((checklistsToday.length - rejectedToday) / checklistsToday.length) * 100) : 0;
  const tripsWithoutAssignment = tripsToday.filter((trip) => !trip.driverId || !trip.vehicleId).length;
  const routesInProgress = data.trips.filter((trip) => trip.programmingStatus === 'in_transit').length;
  const routeCandidates = data.trips.filter((trip) => trip.origin && trip.destination && trip.driverId && trip.vehicleId);
  const routesPendingConfirmation = routeCandidates.filter((trip) => trip.programmingStatus === 'loading' || trip.programmingStatus === 'unloading').length;

  const checklistVehicleIdsToday = new Set(checklistsToday.map((checklist) => checklist.vehicleId).filter(Boolean));
  const scheduledVehicleIdsToday = new Set(tripsToday.map((trip) => trip.vehicleId).filter(Boolean));
  const vehiclesWithoutChecklist = [...scheduledVehicleIdsToday].filter((vehicleId) => !checklistVehicleIdsToday.has(vehicleId)).length;

  const tripStatusCounts = [
    { label: 'Aguardando', total: data.trips.filter((trip) => trip.programmingStatus === 'loading').length },
    { label: 'Atribuido', total: data.trips.filter((trip) => trip.driverId && trip.vehicleId && trip.programmingStatus === 'loading').length },
    { label: 'Em rota', total: routesInProgress },
    { label: 'Entregue', total: data.trips.filter((trip) => trip.programmingStatus === 'released').length },
    { label: 'Pendencia', total: data.trips.filter((trip) => trip.programmingStatus === 'awaiting_invoice').length + receiptsPending },
  ];

  const deliveriesByDriver = topCounts(
    data.trips.filter((trip) => trip.programmingStatus === 'released'),
    (trip) => trip.driverName || trip.driverId || 'Sem motorista',
  );
  const fuelingByDay = countByDate(fuelingThisMonth, (record) => record.createdAt);
  const recentFueling = [...data.fueling].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

  const alerts = [
    tripsWithoutAssignment > 0
      ? {
          area: 'Programacao',
          description: 'Ha cargas no dia sem motorista ou veiculo vinculado.',
          title: `${tripsWithoutAssignment} carga(s) sem atribuicao`,
          tone: 'danger' as const,
        }
      : null,
    vehiclesWithoutChecklist > 0
      ? {
          area: 'Checklist',
          description: 'Veiculos com saida programada ainda nao possuem checklist hoje.',
          title: `${vehiclesWithoutChecklist} veiculo(s) sem checklist`,
          tone: 'danger' as const,
        }
      : null,
    rejectedToday > 0
      ? {
          area: 'Checklist',
          description: 'Checklists reprovados precisam de tratativa operacional.',
          title: `${rejectedToday} checklist(s) reprovado(s) hoje`,
          tone: 'danger' as const,
        }
      : null,
    receiptsPending > 0
      ? {
          area: 'Comprovantes',
          description: 'Comprovantes aguardando aprovacao ou falha.',
          title: `${receiptsPending} comprovante(s) pendente(s)`,
          tone: 'yellow' as const,
        }
      : null,
    routesPendingConfirmation > 0
      ? {
          area: 'Rotas',
          description: 'Cargas com origem/destino prontas para envio ao motorista.',
          title: `${routesPendingConfirmation} rota(s) para enviar`,
          tone: 'yellow' as const,
        }
      : null,
  ].filter(Boolean) as Array<{ area: string; description: string; title: string; tone: 'danger' | 'yellow' }>;

  return {
    alerts,
    checklistApprovalToday,
    deliveriesByDriver,
    fuelingByDay,
    fuelingThisMonth,
    pendingReceipts,
    receiptPendingPercent,
    receiptsDelivered,
    receiptsFailed,
    receiptsPending,
    receiptsToday,
    recentFueling,
    routeCandidates,
    routesInProgress,
    routesPendingConfirmation,
    tripsThisWeek,
    tripsToday,
    tripsWithoutAssignment,
    tripStatusCounts,
    vehiclesWithoutChecklist,
  };
}

function KpiCard({
  icon,
  label,
  meta,
  tone,
  value,
  variation,
}: {
  icon: ReactNode;
  label: string;
  meta: string;
  tone: 'dark' | 'success' | 'yellow' | 'danger' | 'info';
  value: number | string;
  variation: string;
}) {
  const toneClassNames = {
    danger: 'bg-red-50 text-red-700 ring-red-100',
    dark: 'bg-avapex-black text-white ring-zinc-200',
    info: 'bg-sky-50 text-sky-700 ring-sky-100',
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    yellow: 'bg-avapex-yellow text-avapex-black ring-yellow-100',
  }[tone];

  return (
    <article className="ui-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
          <strong className="mt-3 block text-3xl font-semibold leading-none">{value}</strong>
        </div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${toneClassNames}`}>
          {icon}
        </span>
      </div>
      <p className="mt-4 text-xs font-medium text-zinc-500">Meta: {meta}</p>
      <p className="mt-1 text-xs text-zinc-400">{variation}</p>
    </article>
  );
}

function ChartPanel({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <section className="ui-card overflow-hidden p-3">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-zinc-100 text-avapex-black ring-1 ring-zinc-200">
          {icon}
        </span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StatusFunnelChart({ data }: { data: Array<{ label: string; total: number }> }) {
  const options: ApexOptions = {
    chart: { fontFamily: 'Inter, system-ui, sans-serif', toolbar: { show: false } },
    colors: ['#1F1C1C'],
    dataLabels: { enabled: true },
    plotOptions: { bar: { borderRadius: 7, horizontal: true } },
    xaxis: { categories: data.map((item) => item.label), labels: { show: false } },
  };
  return <Chart height={245} options={options} series={[{ data: data.map((item) => item.total), name: 'Cargas' }]} type="bar" />;
}

function DriverBarChart({ data }: { data: Array<{ label: string; total: number }> }) {
  const options: ApexOptions = {
    chart: { fontFamily: 'Inter, system-ui, sans-serif', toolbar: { show: false } },
    colors: ['#FACC15'],
    dataLabels: { enabled: true, style: { colors: ['#111111'] } },
    plotOptions: { bar: { borderRadius: 7, horizontal: true } },
    xaxis: { categories: data.map((item) => item.label), labels: { show: false } },
    yaxis: { labels: { maxWidth: 150 } },
  };
  return data.length ? <Chart height={245} options={options} series={[{ data: data.map((item) => item.total), name: 'Entregas' }]} type="bar" /> : <EmptyPanel />;
}

function FuelingLineChart({ data }: { data: Array<{ date: string; total: number }> }) {
  const options: ApexOptions = {
    chart: { fontFamily: 'Inter, system-ui, sans-serif', toolbar: { show: false } },
    colors: ['#FACC15'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2.5 },
    xaxis: { labels: { format: 'dd/MM' }, type: 'datetime' },
  };
  const seriesData = data.map((item) => ({ x: new Date(`${item.date}T12:00:00`).getTime(), y: item.total }));
  return data.length ? <Chart height={245} options={options} series={[{ data: seriesData, name: 'Abastecimentos' }]} type="line" /> : <EmptyPanel />;
}

function ReceiptDonutChart({ delivered, failed, pending }: { delivered: number; failed: number; pending: number }) {
  const options: ApexOptions = {
    chart: { fontFamily: 'Inter, system-ui, sans-serif' },
    colors: ['#22C55E', '#EAB308', '#EF4444'],
    labels: ['Entregues', 'Pendentes', 'Falhas'],
    legend: { position: 'bottom' },
  };
  return delivered + pending + failed > 0 ? <Chart height={245} options={options} series={[delivered, pending, failed]} type="donut" /> : <EmptyPanel />;
}

function ActionTable({
  actionLabel,
  headers,
  onAction,
  rows,
  title,
}: {
  actionLabel: string;
  headers: string[];
  onAction: () => void;
  rows: string[][];
  title: string;
}) {
  return (
    <section className="ui-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        <button className="text-sm font-semibold text-avapex-black hover:underline" onClick={onAction} type="button">
          {actionLabel}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              {headers.map((header) => <th className="px-4 py-3" key={header}>{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr className="border-t border-zinc-100" key={`${row.join('-')}-${index}`}>
                {row.map((cell, cellIndex) => (
                  <td className="px-4 py-3" key={`${cell}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-zinc-500" colSpan={headers.length}>
                  Nenhum registro para exibir.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EmptyPanel() {
  return <p className="rounded-2xl bg-zinc-50 px-4 py-16 text-center text-sm text-zinc-500">Sem dados no periodo.</p>;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

function endOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);
}

function isBetween(value: Date | null, start: Date, end: Date) {
  return Boolean(value && value >= start && value <= end);
}

function topCounts<T>(items: T[], getKey: (item: T) => string) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total).slice(0, 8);
}

function countByDate<T>(items: T[], getDate: (item: T) => Date | null) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const date = getDate(item);
    if (!date) {
      continue;
    }
    const key = date.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date));
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

function tripStatusLabel(trip: Trip) {
  if (trip.programmingStatus === 'released') {
    return 'Entregue';
  }
  if (trip.programmingStatus === 'in_transit') {
    return 'Em rota';
  }
  if (trip.programmingStatus === 'awaiting_invoice') {
    return 'Com pendencia';
  }
  if (trip.programmingStatus === 'unloading') {
    return 'Descarga';
  }
  return 'Aguardando';
}

function receiptStatusLabel(receipt: DeliveryReceipt) {
  if (receipt.adminStatus === 'delivered') {
    return 'Entregue';
  }
  if (receipt.adminStatus === 'failed') {
    return 'Falha';
  }
  return 'Pendente';
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
