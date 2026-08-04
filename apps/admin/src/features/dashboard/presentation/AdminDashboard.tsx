import { useEffect, useState } from 'react';
import { Filter, LogOut, RefreshCw } from 'lucide-react';
import { logoutAdmin, type AdminSession } from '../../auth/data/authRepository';
import { ChecklistsPage } from '../../checklists/presentation/ChecklistsPage';
import { AbastecimentoPage } from '../../fueling/presentation/AbastecimentoPage';
import { ComprovantesPage } from '../../receipts/presentation/ComprovantesPage';
import { RotasPage } from '../../routes/presentation/RotasPage';
import { ProgramacaoPage } from '../../scheduling/presentation/ProgramacaoPage';
import { adminReadRepository } from '../../shared/data/firestoreCollections';
import { UsersPage } from '../../users/presentation/UsersPage';
import { VehiclesPage } from '../../vehicles/presentation/VehiclesPage';
import type { AppUser, Checklist, DeliveryReceipt, FuelingRecord, Trip, Vehicle } from '../../shared/domain/models';

type AdminData = {
  users: AppUser[];
  vehicles: Vehicle[];
  trips: Trip[];
  checklists: Checklist[];
  receipts: DeliveryReceipt[];
  fueling: FuelingRecord[];
};

const emptyData: AdminData = {
  users: [],
  vehicles: [],
  trips: [],
  checklists: [],
  receipts: [],
  fueling: [],
};

type AdminDashboardProps = {
  session: AdminSession;
};

type AdminPage = 'scheduling' | 'routes' | 'checklists' | 'receipts' | 'fueling' | 'users' | 'vehicles';

const navItems: Array<{ key: AdminPage; label: string }> = [
  { key: 'scheduling', label: 'Programacao' },
  { key: 'routes', label: 'Rotas' },
  { key: 'checklists', label: 'Checklists' },
  { key: 'receipts', label: 'Comprovantes' },
  { key: 'fueling', label: 'Abastecimento' },
  { key: 'users', label: 'Usuarios' },
  { key: 'vehicles', label: 'Veiculos' },
];

const pageTitles: Record<AdminPage, string> = {
  checklists: 'Checklists',
  fueling: 'Abastecimento',
  receipts: 'Comprovantes',
  routes: 'Rotas',
  scheduling: 'Programacao',
  users: 'Usuarios',
  vehicles: 'Veiculos',
};

export function AdminDashboard({ session }: AdminDashboardProps) {
  const [data, setData] = useState<AdminData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePage, setActivePage] = useState<AdminPage>('scheduling');
  const [checklistFilterCount, setChecklistFilterCount] = useState(0);
  const [showChecklistFilters, setShowChecklistFilters] = useState(false);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [users, vehicles, trips, checklists, receipts, fueling] = await Promise.all([
        adminReadRepository.users(),
        adminReadRepository.vehicles(),
        adminReadRepository.trips(),
        adminReadRepository.checklists(),
        adminReadRepository.deliveryReceipts(),
        adminReadRepository.fuelingRecords(),
      ]);
      setData({ users, vehicles, trips, checklists, receipts, fueling });
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
                key={item.key}
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
            <h1 className="text-2xl font-semibold tracking-normal">{pageTitles[activePage]}</h1>
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
          {activePage === 'scheduling' ? (
            <ProgramacaoPage
              loading={loading}
              onChanged={loadData}
              trips={data.trips}
              users={data.users}
              vehicles={data.vehicles}
            />
          ) : activePage === 'routes' ? (
            <RotasPage loading={loading} trips={data.trips} />
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
          ) : activePage === 'users' ? (
            <UsersPage
              currentUid={session.firebaseUser.uid}
              users={data.users}
              loading={loading}
              onChanged={loadData}
            />
          ) : (
            <VehiclesPage vehicles={data.vehicles} loading={loading} onChanged={loadData} />
          )}
        </div>
      </section>
    </main>
  );
}
