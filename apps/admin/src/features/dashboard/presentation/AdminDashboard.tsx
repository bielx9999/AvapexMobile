import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck,
  Filter,
  Fuel,
  LogOut,
  PackageCheck,
  RefreshCw,
  Route,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';
import { logoutAdmin, type AdminSession } from '../../auth/data/authRepository';
import { ChecklistsPage } from '../../checklists/presentation/ChecklistsPage';
import { AbastecimentoPage } from '../../fueling/presentation/AbastecimentoPage';
import { ComprovantesPage } from '../../receipts/presentation/ComprovantesPage';
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

type AdminPage = 'dashboard' | 'users' | 'vehicles' | 'checklists' | 'receipts' | 'fueling' | 'scheduling';

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

  const stats = useMemo(
    () => [
      { label: 'Motoristas', value: data.users.filter((user) => user.role === 'driver').length, icon: Users },
      { label: 'Veiculos', value: data.vehicles.length, icon: Truck },
      { label: 'Programacao', value: data.trips.length, icon: Route },
      { label: 'Checklists', value: data.checklists.length, icon: ClipboardCheck },
      { label: 'Comprovantes', value: data.receipts.length, icon: PackageCheck },
      { label: 'Abastecimentos', value: data.fueling.length, icon: Fuel },
      { label: 'Equipamentos', value: data.equipment.length, icon: Wrench },
    ],
    [data],
  );

  const recentChecklists = data.checklists.slice(0, 6);
  const recentFueling = data.fueling.slice(0, 5);
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
                : 'Dashboard';
  const navItems: Array<{ key: AdminPage | 'placeholder'; label: string }> = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'users', label: 'Usuarios' },
    { key: 'vehicles', label: 'Veiculos' },
    { key: 'scheduling', label: 'Programacao' },
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
                disabled={item.key === 'placeholder'}
                key={item.label}
                onClick={() => item.key !== 'placeholder' && setActivePage(item.key)}
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
          ) : (
            <>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <article className="ui-card p-4" key={stat.label}>
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-500">{stat.label}</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-avapex-black text-white">
                      <Icon size={18} />
                    </span>
                  </div>
                  <strong className="text-3xl font-semibold">{loading ? '-' : stat.value}</strong>
                </article>
              );
            })}
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <div className="ui-card">
              <div className="border-b border-zinc-200 px-4 py-3">
                <h2 className="font-semibold">Checklists recentes</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Motorista</th>
                      <th className="px-4 py-3">Modelo</th>
                      <th className="px-4 py-3">Veiculo</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentChecklists.map((checklist) => (
                      <tr className="border-t border-zinc-100" key={checklist.id}>
                        <td className="px-4 py-3">{formatDate(checklist.createdAt)}</td>
                        <td className="px-4 py-3">{checklist.driverName || checklist.driverId}</td>
                        <td className="px-4 py-3">{checklistLabel(checklist.type)}</td>
                        <td className="px-4 py-3">{checklist.vehiclePlate || checklist.vehicleId}</td>
                        <td className="px-4 py-3">
                          <span className={checklist.hasCriticalFailure ? 'text-red-700' : 'text-emerald-700'}>
                            {checklist.hasCriticalFailure ? 'Reprovado' : 'Aprovado'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!loading && recentChecklists.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-center text-zinc-500" colSpan={5}>
                          Nenhum checklist encontrado.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="ui-card">
              <div className="border-b border-zinc-200 px-4 py-3">
                <h2 className="font-semibold">Abastecimentos recentes</h2>
              </div>
              <div className="divide-y divide-zinc-100">
                {recentFueling.map((record) => (
                  <article className="px-4 py-3" key={record.id}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{record.vehiclePlate}</p>
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs uppercase text-zinc-600">
                        {record.fuelType}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      {record.driverName} - {record.kmRegistered} KM
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">{formatDate(record.createdAt)}</p>
                  </article>
                ))}
                {!loading && recentFueling.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-zinc-500">Nenhum abastecimento encontrado.</p>
                ) : null}
              </div>
            </div>
          </section>
            </>
          )}
        </div>
      </section>
    </main>
  );
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

function checklistLabel(type: Checklist['type']) {
  const labels: Record<Checklist['type'], string> = {
    departure: 'Saida',
    arrival: 'Chegada',
    vehicle_daily: 'Veiculo',
    chain_tensioner: 'Corrente/Tensionador',
    strap_ratchet: 'Cinta/Catraca',
  };
  return labels[type] ?? type;
}

