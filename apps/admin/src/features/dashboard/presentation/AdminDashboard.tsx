import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ClipboardCheck,
  Database,
  FileCheck2,
  Filter,
  Fuel,
  LogOut,
  MapPinned,
  RefreshCw,
  Route,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';
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

const navSections: Array<{
  icon: LucideIcon;
  items: Array<{ icon: LucideIcon; key: AdminPage; label: string }>;
  label: string;
}> = [
  {
    icon: Route,
    label: 'Operacao',
    items: [
      { icon: Route, key: 'scheduling', label: 'Programacao' },
      { icon: MapPinned, key: 'routes', label: 'Rotas' },
      { icon: ClipboardCheck, key: 'checklists', label: 'Checklists' },
      { icon: FileCheck2, key: 'receipts', label: 'Comprovantes' },
      { icon: Fuel, key: 'fueling', label: 'Abastecimento' },
    ],
  },
  {
    icon: Database,
    label: 'Cadastros',
    items: [
      { icon: Users, key: 'users', label: 'Usuarios' },
      { icon: Truck, key: 'vehicles', label: 'Veiculos' },
    ],
  },
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
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

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
      <aside className="fixed left-0 top-0 hidden h-full w-72 flex-col bg-avapex-black px-5 py-6 text-white lg:flex">
        <div>
          <div className="mb-8 flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-avapex-yellow font-black text-avapex-black">
              AV
            </div>
            <div>
              <p className="font-semibold">Avapex</p>
              <p className="text-xs text-zinc-400">Gestao logistica</p>
            </div>
          </div>

          <nav className="space-y-3 text-sm">
            {navSections.map((section) => {
              const SectionIcon = section.icon;
              const isCollapsed = collapsedSections[section.label] ?? false;
              const hasActiveItem = section.items.some((item) => item.key === activePage);
              return (
                <div
                  className={`rounded-3xl border p-2 transition ${
                    hasActiveItem ? 'border-white/12 bg-white/[0.055]' : 'border-white/8 bg-white/[0.025]'
                  }`}
                  key={section.label}
                >
                  <button
                    className="flex h-11 w-full items-center justify-between rounded-2xl px-3 text-left font-semibold text-zinc-100 transition hover:bg-white/10"
                    onClick={() =>
                      setCollapsedSections((current) => ({
                        ...current,
                        [section.label]: !isCollapsed,
                      }))
                    }
                    type="button"
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                          hasActiveItem ? 'bg-avapex-yellow text-avapex-black' : 'bg-white/10 text-zinc-300'
                        }`}
                      >
                        <SectionIcon size={16} />
                      </span>
                      <span>{section.label}</span>
                    </span>
                    <ChevronDown
                      className={`text-zinc-400 transition-transform ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
                      size={17}
                    />
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-200 ${
                      isCollapsed ? 'max-h-0 opacity-0' : 'mt-2 max-h-96 opacity-100'
                    }`}
                  >
                    <div className="space-y-1 border-l border-white/10 pl-3">
                    {section.items.map((item) => {
                      const ItemIcon = item.icon;
                      const isActive = activePage === item.key;
                      return (
                        <button
                          className={`group relative flex h-10 w-full items-center gap-3 rounded-2xl px-3 text-left transition ${
                            isActive
                              ? 'bg-[#2B2828] font-semibold text-white shadow-inner'
                              : 'text-zinc-300 hover:bg-white/8 hover:text-white'
                          }`}
                          key={item.key}
                          onClick={() => setActivePage(item.key)}
                          type="button"
                        >
                          {isActive ? <span className="absolute left-0 h-5 w-1 rounded-full bg-avapex-yellow" /> : null}
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                              isActive ? 'bg-white/10 text-avapex-yellow' : 'text-zinc-400 group-hover:text-white'
                            }`}
                          >
                            <ItemIcon size={16} />
                          </span>
                          <span className="flex-1">{item.label}</span>
                        </button>
                      );
                    })}
                    </div>
                  </div>
                </div>
              );
            })}
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

      <section className="lg:pl-72">
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
