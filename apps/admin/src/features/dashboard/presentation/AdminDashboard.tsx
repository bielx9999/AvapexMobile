import { lazy, Suspense, useEffect, useState } from 'react';
import { Filter, RefreshCw } from 'lucide-react';
import type { AdminSession } from '../../auth/data/authRepository';
import { adminReadRepository } from '../../shared/data/firestoreCollections';
import type { AppUser, Checklist, Delivery, DeliveryReceipt, FuelingRecord, Trip, Vehicle } from '../../shared/domain/models';
import { ErrorBanner, PageSkeleton } from '../../shared/presentation/ui';
import { AdminShell, type AdminPage } from './AdminShell';

const ChecklistsPage = lazy(async () => ({
  default: (await import('../../checklists/presentation/ChecklistsPage')).ChecklistsPage,
}));
const AbastecimentoPage = lazy(async () => ({
  default: (await import('../../fueling/presentation/AbastecimentoPage')).AbastecimentoPage,
}));
const ComprovantesPage = lazy(async () => ({
  default: (await import('../../receipts/presentation/ComprovantesPage')).ComprovantesPage,
}));
const RotasPage = lazy(async () => ({ default: (await import('../../routes/presentation/RotasPage')).RotasPage }));
const ProgramacaoPage = lazy(async () => ({
  default: (await import('../../scheduling/presentation/ProgramacaoPage')).ProgramacaoPage,
}));
const UsersPage = lazy(async () => ({ default: (await import('../../users/presentation/UsersPage')).UsersPage }));
const VehiclesPage = lazy(async () => ({
  default: (await import('../../vehicles/presentation/VehiclesPage')).VehiclesPage,
}));

type AdminData = {
  users: AppUser[];
  vehicles: Vehicle[];
  trips: Trip[];
  checklists: Checklist[];
  receipts: DeliveryReceipt[];
  deliveries: Delivery[];
  fueling: FuelingRecord[];
};

const emptyData: AdminData = {
  users: [],
  vehicles: [],
  trips: [],
  checklists: [],
  receipts: [],
  deliveries: [],
  fueling: [],
};

type AdminDashboardProps = {
  session: AdminSession;
};

const pageConfig: Record<AdminPage, { category: string; description: string; title: string }> = {
  checklists: { category: 'Operacao', description: 'Acompanhe conformidade e volume de inspecoes.', title: 'Checklists' },
  fueling: { category: 'Operacao', description: 'Monitore registros e comprovantes de abastecimento.', title: 'Abastecimento' },
  receipts: { category: 'Operacao', description: 'Valide comprovantes enviados pelos motoristas.', title: 'Comprovantes' },
  routes: { category: 'Operacao', description: 'Visualize trajetos e compartilhe orientacoes de rota.', title: 'Rotas' },
  scheduling: { category: 'Operacao', description: 'Planeje e acompanhe cargas e descargas.', title: 'Programacao' },
  users: { category: 'Cadastros', description: 'Gerencie acessos e dados dos usuarios.', title: 'Usuarios' },
  vehicles: { category: 'Cadastros', description: 'Gerencie e acompanhe os veiculos da frota.', title: 'Veiculos' },
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
      const [users, vehicles, trips, checklists, receipts, deliveries, fueling] = await Promise.all([
        adminReadRepository.users(),
        adminReadRepository.vehicles(),
        adminReadRepository.trips(),
        adminReadRepository.checklists(),
        adminReadRepository.deliveryReceipts(),
        adminReadRepository.deliveries(),
        adminReadRepository.fuelingRecords(),
      ]);
      setData({ users, vehicles, trips, checklists, receipts, deliveries, fueling });
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

  useEffect(() => {
    return adminReadRepository.watchTrips(
      (trips) => setData((current) => ({ ...current, trips })),
      (watchError) => setError(watchError.message),
    );
  }, []);

  const currentPage = pageConfig[activePage];
  const headerActions = (
    <>
            {activePage === 'checklists' ? (
              <button
          className={`ui-button h-9 gap-2 px-3 text-sm ${
                  showChecklistFilters || checklistFilterCount > 0
                ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                }`}
                onClick={() => setShowChecklistFilters((current) => !current)}
                type="button"
              >
                <Filter size={17} />
                Filtros
                {checklistFilterCount > 0 ? (
              <span className="rounded-full bg-avapex-yellow px-1.5 py-0.5 text-[10px] font-bold text-avapex-black">
                    {checklistFilterCount}
                  </span>
                ) : null}
              </button>
            ) : null}
            <button
        className="ui-button h-9 gap-2 border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950"
              onClick={() => void loadData()}
              type="button"
            >
              <RefreshCw size={16} />
        <span className="hidden sm:inline">Atualizar</span>
            </button>
    </>
  );

  return (
    <AdminShell
      activePage={activePage}
      category={currentPage.category}
      description={currentPage.description}
      headerActions={headerActions}
      onNavigate={setActivePage}
      session={session}
      title={currentPage.title}
    >
      <div className="ui-page-stack">
          <ErrorBanner message={error} />
        <Suspense fallback={<PageSkeleton />}>
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
            <ComprovantesPage deliveries={data.deliveries} loading={loading} onChanged={loadData} receipts={data.receipts} />
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
        </Suspense>
      </div>
    </AdminShell>
  );
}
