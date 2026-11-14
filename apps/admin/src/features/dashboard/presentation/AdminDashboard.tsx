import { lazy, Suspense, useEffect, useState } from 'react';
import { Filter, RefreshCw } from 'lucide-react';
import type { AdminSession } from '../../auth/data/authRepository';
import { adminReadRepository } from '../../shared/data/firestoreCollections';
import type { AppUser, Checklist, Delivery, DeliveryReceipt, FuelingRecord, Locality, RouteTemplate, Trip, Vehicle } from '../../shared/domain/models';
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
const RoutePlannerPage = lazy(async () => ({ default: (await import('../../route-planner/presentation/RoutePlannerPage')).RoutePlannerPage }));
const DeliveryManagementPage = lazy(async () => ({
  default: (await import('../../deliveries/presentation/DeliveryManagementPage')).DeliveryManagementPage,
}));
const LocalitiesPage = lazy(async () => ({ default: (await import('../../localities/presentation/LocalitiesPage')).LocalitiesPage }));
const ProgramacaoPage = lazy(async () => ({
  default: (await import('../../scheduling/presentation/ProgramacaoPage')).ProgramacaoPage,
}));
const UsersPage = lazy(async () => ({ default: (await import('../../users/presentation/UsersPage')).UsersPage }));
const VehiclesPage = lazy(async () => ({
  default: (await import('../../vehicles/presentation/VehiclesPage')).VehiclesPage,
}));
const EquipmentPage = lazy(async () => ({
  default: (await import('../../equipment/presentation/EquipmentPage')).EquipmentPage,
}));
const EquipmentChecklistsPage = lazy(async () => ({
  default: (await import('../../equipment/presentation/EquipmentChecklistsPage')).EquipmentChecklistsPage,
}));
const SecurityInspectionsPage = lazy(async () => ({
  default: (await import('../../security-inspections/presentation/SecurityInspectionsPage')).SecurityInspectionsPage,
}));
const DocumentationReportsPage = lazy(async () => ({
  default: (await import('../../documentation-reports/presentation/DocumentationReportsPage')).DocumentationReportsPage,
}));
const LightVehiclesPage = lazy(async () => ({
  default: (await import('../../light-vehicles/presentation/LightVehiclesPage')).LightVehiclesPage,
}));

type AdminData = {
  users: AppUser[];
  vehicles: Vehicle[];
  trips: Trip[];
  checklists: Checklist[];
  receipts: DeliveryReceipt[];
  deliveries: Delivery[];
  localities: Locality[];
  routeTemplates: RouteTemplate[];
  fueling: FuelingRecord[];
  securityInspections: import('../../shared/domain/models').SecurityInspection[];
  lightVehicleChecklists: import('../../shared/domain/models').LightVehicleWeeklyChecklist[];
  lightVehicleMaintenances: import('../../shared/domain/models').LightVehicleMaintenance[];
};

const emptyData: AdminData = {
  users: [],
  vehicles: [],
  trips: [],
  checklists: [],
  receipts: [],
  deliveries: [],
  localities: [],
  routeTemplates: [],
  fueling: [],
  securityInspections: [],
  lightVehicleChecklists: [],
  lightVehicleMaintenances: [],
};

type AdminDashboardProps = {
  session: AdminSession;
};

const pageConfig: Record<AdminPage, { category: string; title: string }> = {
  checklists: { category: 'CheckLists', title: 'Checklists operacionais' },
  'security-inspections': { category: 'CheckLists', title: 'Inspecoes de seguranca' },
  'equipment-checklists': { category: 'CheckLists', title: 'Checklist de equipamentos' },
  fueling: { category: 'Operacao', title: 'Abastecimento' },
  equipment: { category: 'Operacao', title: 'Equipamentos de Amarracao' },
  deliveries: { category: 'Operacao', title: 'Gestao de Entregas' },
  receipts: { category: 'Operacao', title: 'Comprovantes' },
  'route-planner': { category: 'Operacao', title: 'Roteirizador' },
  scheduling: { category: 'Operacao', title: 'Programacao' },
  users: { category: 'Cadastros', title: 'Usuarios' },
  vehicles: { category: 'Cadastros', title: 'Veiculos' },
  'light-vehicles': { category: 'Veiculos leves', title: 'Gerenciamento de veiculos leves' },
  'light-vehicle-checklists': { category: 'Veiculos leves', title: 'Checklist semanal' },
  'light-vehicle-maintenance': { category: 'Veiculos leves', title: 'Revisoes por km' },
  localities: { category: 'Cadastros', title: 'Localidades' },
  onedrive: { category: 'Documentacao', title: 'OneDrive' },
  powerbi: { category: 'Documentacao', title: 'Power BI' },
  'app-settings': { category: 'Conta', title: 'Configurações do aplicativo' },
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
      const [users, vehicles, trips, checklists, receipts, deliveries, fueling, localities, routeTemplates, securityInspections, lightVehicleChecklists, lightVehicleMaintenances] = await Promise.all([
        adminReadRepository.users(),
        adminReadRepository.vehicles(),
        adminReadRepository.trips(),
        adminReadRepository.checklists(),
        adminReadRepository.deliveryReceipts(),
        adminReadRepository.deliveries(),
        adminReadRepository.fuelingRecords(),
        adminReadRepository.localities(),
        adminReadRepository.routeTemplates(),
        adminReadRepository.securityInspections(),
        adminReadRepository.lightVehicleWeeklyChecklists(),
        adminReadRepository.lightVehicleMaintenances(),
      ]);
      setData({ users, vehicles, trips, checklists, receipts, deliveries, fueling, localities, routeTemplates, securityInspections, lightVehicleChecklists, lightVehicleMaintenances });
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

  useEffect(() => {
    return adminReadRepository.watchDeliveries(
      (deliveries) => setData((current) => ({ ...current, deliveries })),
      (watchError) => setError(watchError.message),
    );
  }, []);

  useEffect(() => {
    return adminReadRepository.watchChecklists(
      (checklists) => setData((current) => ({ ...current, checklists })),
      (watchError) => setError(watchError.message),
    );
  }, []);

  useEffect(() => adminReadRepository.watchLocalities(
    (localities) => setData((current) => ({ ...current, localities })),
    (watchError) => setError(watchError.message),
  ), []);

  useEffect(() => adminReadRepository.watchRouteTemplates(
    (routeTemplates) => setData((current) => ({ ...current, routeTemplates })),
    (watchError) => setError(watchError.message),
  ), []);

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
      headerActions={headerActions}
      onNavigate={setActivePage}
      session={session}
      title={currentPage.title}
    >
      <div className="ui-page-stack">
          <ErrorBanner message={error} />
        <Suspense fallback={<PageSkeleton />}>
          {activePage === 'app-settings' ? null : activePage === 'scheduling' ? (
            <ProgramacaoPage
              localities={data.localities}
              loading={loading}
              onChanged={loadData}
              routeTemplates={data.routeTemplates}
              trips={data.trips}
              users={data.users}
              vehicles={data.vehicles}
            />
          ) : activePage === 'route-planner' ? (
            <RoutePlannerPage loading={loading} localities={data.localities} onChanged={loadData} routeTemplates={data.routeTemplates} />
          ) : activePage === 'deliveries' ? (
            <DeliveryManagementPage deliveries={data.deliveries} loading={loading} />
          ) : activePage === 'checklists' ? (
            <ChecklistsPage
              checklists={data.checklists}
              loading={loading}
              onActiveFilterCountChange={setChecklistFilterCount}
              onShowFiltersChange={setShowChecklistFilters}
              showFilters={showChecklistFilters}
              users={data.users}
            />
          ) : activePage === 'security-inspections' ? (
            <SecurityInspectionsPage inspections={data.securityInspections} loading={loading} users={data.users} vehicles={data.vehicles} />
          ) : activePage === 'equipment-checklists' ? (
            <EquipmentChecklistsPage currentUser={session.profile} users={data.users} vehicles={data.vehicles} />
          ) : activePage === 'receipts' ? (
            <ComprovantesPage deliveries={data.deliveries} loading={loading} onChanged={loadData} receipts={data.receipts} />
          ) : activePage === 'fueling' ? (
            <AbastecimentoPage fueling={data.fueling} loading={loading} onChanged={loadData} />
          ) : activePage === 'equipment' ? (
            <EquipmentPage users={data.users} vehicles={data.vehicles} />
          ) : activePage === 'users' ? (
            <UsersPage
              currentUid={session.firebaseUser.uid}
              users={data.users}
              loading={loading}
              onChanged={loadData}
            />
          ) : activePage === 'vehicles' ? (
            <VehiclesPage vehicles={data.vehicles} users={data.users} loading={loading} onChanged={loadData} />
          ) : activePage === 'light-vehicles' || activePage === 'light-vehicle-checklists' || activePage === 'light-vehicle-maintenance' ? (
            <LightVehiclesPage checklists={data.lightVehicleChecklists} initialTab={activePage === 'light-vehicle-maintenance' ? 'maintenance' : 'checklist'} loading={loading} maintenances={data.lightVehicleMaintenances} onChanged={loadData} users={data.users} vehicles={data.vehicles} />
          ) : activePage === 'onedrive' ? (
            <DocumentationReportsPage view="onedrive" />
          ) : activePage === 'powerbi' ? (
            <DocumentationReportsPage view="powerbi" />
          ) : (
            <LocalitiesPage loading={loading} localities={data.localities} onChanged={loadData} />
          )}
        </Suspense>
      </div>
    </AdminShell>
  );
}
