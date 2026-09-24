import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  Check,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileWarning,
  Link2,
  PackageCheck,
  PackagePlus,
  Plus,
  Printer,
  Search,
  Settings2,
  Truck,
  Upload,
  Warehouse,
  X,
} from 'lucide-react';
import { equipmentLabels, equipmentRepository, equipmentStatusLabels, type EquipmentAdminData, type EquipmentTypeValue } from '../data/equipmentRepository';
import { analyzeEquipmentWorkbook, type EquipmentImportAnalysis } from '../data/equipmentImport';
import type { AppUser, Equipment, EquipmentInspection, EquipmentInspectionItem, EquipmentInspectionResult, EquipmentStatus, StorageLocation, Vehicle } from '../../shared/domain/models';
import { ActionIconButton, EmptyState, ErrorBanner, MetricCard, PageSkeleton } from '../../shared/presentation/ui';

type EquipmentPageProps = {
  users: AppUser[];
  vehicles: Vehicle[];
};

type TabKey = 'overview' | 'equipment' | 'assignments' | 'stock' | 'inspections' | 'occurrences' | 'reports';

const tabs: Array<{ key: TabKey; label: string; icon: typeof Boxes }> = [
  { key: 'overview', label: 'Visao geral', icon: Boxes },
  { key: 'equipment', label: 'Equipamentos', icon: PackageCheck },
  { key: 'assignments', label: 'Atribuicoes', icon: Link2 },
  { key: 'stock', label: 'Estoque', icon: Warehouse },
  { key: 'inspections', label: 'Inspecoes', icon: ClipboardCheck },
  { key: 'occurrences', label: 'Ocorrencias', icon: FileWarning },
  { key: 'reports', label: 'Relatorios', icon: Download },
];

const types = Object.keys(equipmentLabels) as EquipmentTypeValue[];
const statuses = Object.keys(equipmentStatusLabels) as EquipmentStatus[];

export function EquipmentPage({ users, vehicles }: EquipmentPageProps) {
  const [data, setData] = useState<EquipmentAdminData | null>(null);
  const [tab, setTab] = useState<TabKey>('overview');
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [inspectionVehicle, setInspectionVehicle] = useState<Vehicle | null>(null);
  const [actionEquipment, setActionEquipment] = useState<Equipment | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      setError('');
      try {
        await equipmentRepository.ensureMainStorage();
        const next = await equipmentRepository.load();
        if (active) setData(next);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar equipamentos.');
      }
    })();
    return () => { active = false; };
  }, [reloadKey]);

  const refresh = () => setReloadKey((value) => value + 1);
  const activeDrivers = useMemo(() => users.filter((user) => user.role === 'driver' && user.status === 'active'), [users]);
  const activeVehicles = useMemo(() => vehicles.filter((vehicle) => vehicle.status === 'active'), [vehicles]);

  if (!data) return <PageSkeleton />;

  return (
    <div className="space-y-5">
      <ErrorBanner message={error} />
      <section className="ui-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-zinc-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-950">Controle de equipamentos de amarracao</h2>
            <p className="mt-1 text-sm text-zinc-500">Estoque, atribuicao por veiculo, rastreabilidade e conferencia mensal.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="ui-button h-10 gap-2 border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50" download href="/modelo-importacao-equipamentos.xlsx"><Download size={17} />Baixar modelo</a>
            <button className="ui-button h-10 gap-2 border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50" onClick={() => setShowImportModal(true)} type="button"><Upload size={17} />Importar planilha</button>
            <button className="ui-button h-10 gap-2 border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50" onClick={() => setShowBatchModal(true)} type="button"><PackagePlus size={17} />Cadastro em lote</button>
            <button className="ui-button h-10 gap-2 bg-avapex-yellow px-4 text-sm font-semibold text-avapex-black hover:bg-yellow-300" onClick={() => setShowEquipmentModal(true)} type="button"><Plus size={17} />Novo equipamento</button>
          </div>
        </div>
        <nav aria-label="Navegacao de equipamentos" className="flex overflow-x-auto px-3 py-2">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button className={`flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${tab === key ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'}`} key={key} onClick={() => setTab(key)} type="button"><Icon size={16} />{label}</button>
          ))}
        </nav>
      </section>

      {tab === 'overview' ? <Overview data={data} onNavigate={setTab} /> : null}
      {tab === 'equipment' ? <EquipmentTable data={data} onAction={setActionEquipment} /> : null}
      {tab === 'stock' ? <StockView data={data} onAction={setActionEquipment} onNewStorage={() => setShowStorageModal(true)} /> : null}
      {tab === 'assignments' ? <AssignmentView data={data} vehicles={activeVehicles} onAssign={() => setShowAssignmentModal(true)} onAction={setActionEquipment} /> : null}
      {tab === 'inspections' ? <InspectionView data={data} users={users} vehicles={activeVehicles} onInspect={setInspectionVehicle} /> : null}
      {tab === 'occurrences' ? <OccurrenceView data={data} onAction={setActionEquipment} /> : null}
      {tab === 'reports' ? <ReportsView data={data} /> : null}

      {showEquipmentModal ? <EquipmentModal storageLocations={data.storageLocations} onClose={() => setShowEquipmentModal(false)} onSaved={() => { setShowEquipmentModal(false); refresh(); }} /> : null}
      {showBatchModal ? <BatchModal storageLocations={data.storageLocations} onClose={() => setShowBatchModal(false)} onSaved={() => { setShowBatchModal(false); refresh(); }} /> : null}
      {showImportModal ? <EquipmentImportModal equipment={data.equipment} storageLocations={data.storageLocations} onClose={() => setShowImportModal(false)} onSaved={() => { setShowImportModal(false); refresh(); }} /> : null}
      {showAssignmentModal ? <AssignmentModal data={data} drivers={activeDrivers} vehicles={activeVehicles} onClose={() => setShowAssignmentModal(false)} onSaved={() => { setShowAssignmentModal(false); refresh(); }} /> : null}
      {showStorageModal ? <StorageLocationModal onClose={() => setShowStorageModal(false)} onSaved={() => { setShowStorageModal(false); refresh(); }} /> : null}
      {inspectionVehicle ? <InspectionModal vehicle={inspectionVehicle} data={data} onClose={() => setInspectionVehicle(null)} onSaved={() => { setInspectionVehicle(null); refresh(); }} /> : null}
      {actionEquipment ? <EquipmentActionModal equipment={actionEquipment} data={data} drivers={activeDrivers} vehicles={activeVehicles} onClose={() => setActionEquipment(null)} onSaved={() => { setActionEquipment(null); refresh(); }} /> : null}
    </div>
  );
}

function Overview({ data, onNavigate }: { data: EquipmentAdminData; onNavigate: (tab: TabKey) => void }) {
  const count = (status: EquipmentStatus) => data.equipment.filter((item) => item.status === status).length;
  const now = new Date();
  const inspectedVehicleIds = new Set(data.inspections.filter((item) => item.referenceMonth === now.getMonth() + 1 && item.referenceYear === now.getFullYear() && item.status !== 'pending').map((item) => item.vehicleId));
  const vehicleIds = new Set(data.equipment.filter((item) => item.currentVehicleId).map((item) => item.currentVehicleId));
  const pendingInspections = [...vehicleIds].filter((id) => !inspectedVehicleIds.has(id)).length;
  const alerts = [
    { label: `${pendingInspections} veiculo(s) com inspecao mensal pendente`, tab: 'inspections' as const, tone: pendingInspections ? 'warning' : 'neutral' },
    { label: `${count('under_review')} equipamento(s) em analise`, tab: 'occurrences' as const, tone: count('under_review') ? 'warning' : 'neutral' },
    { label: `${count('damaged')} equipamento(s) danificado(s)`, tab: 'occurrences' as const, tone: count('damaged') ? 'danger' : 'neutral' },
    { label: `${count('lost')} extravio(s) aguardando tratativa`, tab: 'occurrences' as const, tone: count('lost') ? 'danger' : 'neutral' },
  ];
  return <>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={<Boxes size={19} />} label="Total de equipamentos" tone="neutral" value={data.equipment.length} />
      <MetricCard icon={<Warehouse size={19} />} label="Em estoque" tone="accent" value={count('in_stock')} />
      <MetricCard icon={<Truck size={19} />} label="Atribuidos a veiculos" tone="info" value={count('assigned') + count('in_use')} />
      <MetricCard icon={<AlertTriangle size={19} />} label="Indisponiveis" tone="danger" value={count('damaged') + count('under_review') + count('lost')} />
    </section>
    <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <div className="ui-card overflow-hidden">
        <div className="border-b border-zinc-200 px-4 py-3"><h3 className="font-semibold text-zinc-950">Distribuicao por tipo</h3></div>
        <div className="divide-y divide-zinc-100">
          {types.map((type) => {
            const equipment = data.equipment.filter((item) => item.type === type);
            const stock = equipment.filter((item) => item.status === 'in_stock').length;
            const assigned = equipment.filter((item) => item.status === 'assigned' || item.status === 'in_use').length;
            const unavailable = equipment.length - stock - assigned;
            return <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3 text-sm" key={type}><span className="font-medium text-zinc-800">{equipmentLabels[type]}</span><span className="text-zinc-500">Estoque <strong className="ml-1 text-zinc-950">{stock}</strong></span><span className="text-zinc-500">Veiculos <strong className="ml-1 text-zinc-950">{assigned}</strong></span><span className="text-zinc-500">Indisp. <strong className="ml-1 text-zinc-950">{unavailable}</strong></span></div>;
          })}
        </div>
      </div>
      <div className="ui-card overflow-hidden">
        <div className="border-b border-zinc-200 px-4 py-3"><h3 className="font-semibold text-zinc-950">Atencao necessaria</h3></div>
        <div className="divide-y divide-zinc-100">{alerts.map((alert) => <button className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-zinc-50" key={alert.label} onClick={() => onNavigate(alert.tab)} type="button"><span className={`h-2 w-2 rounded-full ${alert.tone === 'danger' ? 'bg-red-500' : alert.tone === 'warning' ? 'bg-amber-400' : 'bg-zinc-300'}`} /><span className="min-w-0 flex-1 text-zinc-700">{alert.label}</span><ChevronRight className="text-zinc-400" size={16} /></button>)}</div>
      </div>
    </section>
  </>;
}

function EquipmentTable({ data, onAction }: { data: EquipmentAdminData; onAction: (equipment: Equipment) => void }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const rows = useMemo(() => data.equipment.filter((item) => [item.code, item.currentVehiclePlate, item.currentDriverName].join(' ').toLowerCase().includes(search.toLowerCase()) && (!type || item.type === type) && (!status || item.status === status)), [data.equipment, search, status, type]);
  return <section className="ui-card overflow-hidden"><TableToolbar count={rows.length} search={search} setSearch={setSearch} extra={<><Select value={type} onChange={setType} label="Todos os tipos" options={types.map((item) => [item, equipmentLabels[item]])} /><Select value={status} onChange={setStatus} label="Todos os status" options={statuses.map((item) => [item, equipmentStatusLabels[item]])} /></>} /><div className="overflow-x-auto"><table className="ui-table min-w-[1100px]"><thead><tr><th>Numero</th><th>Tipo</th><th>Status</th><th>Local atual</th><th>Veiculo</th><th>Responsavel</th><th>Ultima inspecao</th><th className="text-right">Acoes</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td className="font-semibold">{item.code}</td><td>{equipmentLabels[item.type]}</td><td><StatusPill status={item.status} /></td><td>{item.currentStorageName || (item.currentVehicleId ? 'Veiculo' : '-')}</td><td>{item.currentVehiclePlate || '-'}</td><td>{item.currentDriverName || '-'}</td><td>{formatDate(item.lastInspectionAt)}</td><td><div className="flex justify-end"><ActionIconButton label="Gerenciar equipamento" onClick={() => onAction(item)}><Settings2 size={16} /></ActionIconButton></div></td></tr>)}{!rows.length ? <tr><td colSpan={8}><EmptyState title="Nenhum equipamento encontrado" description="Ajuste os filtros ou cadastre novos equipamentos." /></td></tr> : null}</tbody></table></div></section>;
}

function StockView({ data, onAction, onNewStorage }: { data: EquipmentAdminData; onAction: (equipment: Equipment) => void; onNewStorage: () => void }) {
  const inStock = data.equipment.filter((item) => item.status === 'in_stock');
  return <section className="ui-card overflow-hidden"><div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3"><div><h3 className="font-semibold text-zinc-950">Estoque e armarios</h3><p className="mt-1 text-sm text-zinc-500">Cada item em estoque possui um local de armazenamento.</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-800">{inStock.length} disponivel(is)</span><button className="ui-button h-9 gap-2 border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50" onClick={onNewStorage} type="button"><Plus size={15} />Novo local</button></div></div><div className="overflow-x-auto"><table className="ui-table min-w-[760px]"><thead><tr><th>Numero</th><th>Tipo</th><th>Local</th><th>Ultima movimentacao</th><th className="text-right">Acoes</th></tr></thead><tbody>{inStock.map((item) => <tr key={item.id}><td className="font-semibold">{item.code}</td><td>{equipmentLabels[item.type]}</td><td>{item.currentStorageName || '-'}</td><td>{formatDate(item.updatedAt)}</td><td><div className="flex justify-end"><ActionIconButton label="Gerenciar equipamento" onClick={() => onAction(item)}><Settings2 size={16} /></ActionIconButton></div></td></tr>)}{!inStock.length ? <tr><td colSpan={5}><EmptyState title="Estoque vazio" description="Os equipamentos disponiveis aparecerao aqui." /></td></tr> : null}</tbody></table></div></section>;
}

function AssignmentView({ data, vehicles, onAssign, onAction }: { data: EquipmentAdminData; vehicles: Vehicle[]; onAssign: () => void; onAction: (equipment: Equipment) => void }) {
  const [vehicleId, setVehicleId] = useState('');
  const currentVehicleId = vehicleId || vehicles[0]?.id || '';
  const vehicle = vehicles.find((item) => item.id === currentVehicleId);
  const assigned = data.equipment.filter((item) => item.currentVehicleId === currentVehicleId);
  return <div className="space-y-5"><section className="ui-card flex flex-col gap-4 p-4 lg:flex-row lg:items-end lg:justify-between"><label className="block min-w-0 flex-1"><span className="mb-2 block text-sm font-medium text-zinc-700">Veiculo</span><select className="ui-input h-11 w-full max-w-xl px-3" value={currentVehicleId} onChange={(event) => setVehicleId(event.target.value)}>{vehicles.map((item) => <option key={item.id} value={item.id}>{vehicleTitle(item)}</option>)}</select></label><button className="ui-button h-11 gap-2 bg-avapex-yellow px-4 text-sm font-semibold text-avapex-black hover:bg-yellow-300" onClick={onAssign} type="button"><Link2 size={17} />Atribuir equipamentos</button></section><section className="ui-card overflow-hidden"><div className="flex flex-wrap items-center gap-x-7 gap-y-2 border-b border-zinc-200 px-4 py-3"><div><h3 className="font-semibold text-zinc-950">{vehicle ? vehicleTitle(vehicle) : 'Selecione um veiculo'}</h3><p className="mt-1 text-sm text-zinc-500">Responsavel: {assigned[0]?.currentDriverName || 'Nao informado'}</p></div>{types.map((type) => <span className="text-sm text-zinc-600" key={type}>{equipmentLabels[type]} <strong className="ml-1 text-zinc-950">{assigned.filter((item) => item.type === type).length}</strong></span>)}</div><div className="divide-y divide-zinc-100">{assigned.map((item) => <div className="flex items-center gap-3 px-4 py-3" key={item.id}><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700"><PackageCheck size={16} /></span><div className="min-w-0 flex-1"><p className="font-semibold text-zinc-900">{item.code}</p><p className="text-xs text-zinc-500">{equipmentLabels[item.type]} - {equipmentStatusLabels[item.status]}</p></div><StatusPill status={item.status} /><ActionIconButton label="Gerenciar equipamento" onClick={() => onAction(item)}><Settings2 size={16} /></ActionIconButton></div>)}{!assigned.length ? <EmptyState title="Nenhum equipamento atribuido" description="Atribua equipamentos do estoque a este veiculo." /> : null}</div></section></div>;
}

function InspectionView({ data, users, vehicles, onInspect }: { data: EquipmentAdminData; users: AppUser[]; vehicles: Vehicle[]; onInspect: (vehicle: Vehicle) => void }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const assignedVehicles = vehicles.filter((vehicle) => data.equipment.some((item) => item.currentVehicleId === vehicle.id));
  const byVehicle = new Map(data.inspections.filter((item) => item.referenceMonth === month && item.referenceYear === year && item.inspectionType === 'admin_monthly').map((item) => [item.vehicleId, item]));
  return <section className="ui-card overflow-hidden"><div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 md:flex-row md:items-center md:justify-between"><div><h3 className="font-semibold text-zinc-950">Inspecao mensal de equipamentos</h3><p className="mt-1 text-sm text-zinc-500">Conferencia oficial por veiculo, sem substituir o checklist do motorista.</p></div><div className="flex gap-2"><select className="ui-input h-10 px-3" value={month} onChange={(event) => setMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{monthName(index + 1)}</option>)}</select><input className="ui-input h-10 w-24 px-3" min="2026" type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} /></div></div><div className="overflow-x-auto"><table className="ui-table min-w-[920px]"><thead><tr><th>Veiculo</th><th>Responsavel</th><th>Quantidade</th><th>Status</th><th className="text-right">Acoes</th></tr></thead><tbody>{assignedVehicles.map((vehicle) => { const inspection = byVehicle.get(vehicle.id); const equipment = data.equipment.filter((item) => item.currentVehicleId === vehicle.id); const auditor = users.find((user) => user.uid === inspection?.performedByUserId)?.name || ''; return <tr key={vehicle.id}><td className="font-semibold">{vehicleTitle(vehicle)}</td><td>{inspection?.responsibleDriverName || equipment[0]?.currentDriverName || '-'}</td><td>{inspection?.items.length ?? equipment.length}</td><td><InspectionPill inspection={inspection} /></td><td><div className="flex justify-end gap-2">{inspection ? <><ActionIconButton label="Imprimir checklist" onClick={() => printEquipmentInspection(inspection, auditor, vehicle)}><Printer size={16} /></ActionIconButton><ActionIconButton label="Exportar checklist para Excel" onClick={() => exportEquipmentInspectionExcel(inspection, auditor, vehicle)}><FileSpreadsheet size={16} /></ActionIconButton></> : null}<button className="ui-button h-9 gap-2 border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50" onClick={() => onInspect(vehicle)} type="button"><ClipboardCheck size={16} />{inspection ? 'Refazer' : 'Realizar inspecao'}</button></div></td></tr>; })}{!assignedVehicles.length ? <tr><td colSpan={5}><EmptyState title="Nenhum veiculo com equipamentos" description="Atribua equipamentos para iniciar a rotina mensal." /></td></tr> : null}</tbody></table></div></section>;
}

function OccurrenceView({ data, onAction }: { data: EquipmentAdminData; onAction: (equipment: Equipment) => void }) {
  const equipmentById = new Map(data.equipment.map((item) => [item.id, item]));
  const rows = data.occurrences.slice().sort((a, b) => (b.reportedAt?.getTime() ?? 0) - (a.reportedAt?.getTime() ?? 0));
  return <section className="ui-card overflow-hidden"><div className="border-b border-zinc-200 px-4 py-3"><h3 className="font-semibold text-zinc-950">Ocorrencias e pendencias</h3><p className="mt-1 text-sm text-zinc-500">Problemas informados pelo motorista ou identificados em inspecoes.</p></div><div className="overflow-x-auto"><table className="ui-table min-w-[850px]"><thead><tr><th>Equipamento</th><th>Tipo</th><th>Veiculo</th><th>Descricao</th><th>Data</th><th>Status</th><th className="text-right">Acao</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td className="font-semibold">{item.equipmentCode}</td><td>{occurrenceTypeLabel(item.type)}</td><td>{item.vehiclePlate || '-'}</td><td className="max-w-[300px] truncate">{item.description || '-'}</td><td>{formatDate(item.reportedAt)}</td><td><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{item.status === 'resolved' ? 'Resolvida' : item.status === 'under_review' ? 'Em analise' : 'Aberta'}</span></td><td><div className="flex justify-end">{equipmentById.get(item.equipmentId) ? <ActionIconButton label="Tratar equipamento" onClick={() => onAction(equipmentById.get(item.equipmentId)!)}><Settings2 size={16} /></ActionIconButton> : null}</div></td></tr>)}{!rows.length ? <tr><td colSpan={7}><EmptyState title="Nenhuma ocorrencia registrada" description="Danos, divergencias e itens nao localizados aparecerao nesta lista." /></td></tr> : null}</tbody></table></div></section>;
}

function ReportsView({ data }: { data: EquipmentAdminData }) {
  const download = (kind: 'inventory' | 'inspections') => {
    const headers = kind === 'inventory' ? ['Numero', 'Tipo', 'Status', 'Local', 'Veiculo', 'Responsavel', 'Ultima inspecao'] : ['Veiculo', 'Mes', 'Status', 'Esperados', 'Conformes', 'Danificados', 'Nao localizados'];
    const rows = kind === 'inventory' ? data.equipment.map((item) => [item.code, equipmentLabels[item.type], equipmentStatusLabels[item.status], item.currentStorageName, item.currentVehiclePlate, item.currentDriverName, formatDate(item.lastInspectionAt)]) : data.inspections.filter((item) => item.inspectionType === 'admin_monthly').map((item) => [item.vehiclePlate, `${item.referenceMonth}/${item.referenceYear}`, item.status, item.items.length, item.items.filter((row) => row.result === 'ok').length, item.items.filter((row) => row.result === 'damaged').length, item.items.filter((row) => row.result === 'not_found').length]);
    const content = [headers, ...rows].map((row) => row.map(csv).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = kind === 'inventory' ? 'inventario-equipamentos.csv' : 'inspecoes-mensais.csv'; link.click(); URL.revokeObjectURL(url);
  };
  return <div className="grid gap-5 lg:grid-cols-2"><ReportCard icon={<Boxes size={20} />} title="Inventario geral" description="Numero, tipo, status, local, veiculo, responsavel e ultima inspecao." onDownload={() => download('inventory')} /><ReportCard icon={<ClipboardCheck size={20} />} title="Inspecao mensal" description="Conferencia por veiculo, mes, responsavel e divergencias encontradas." onDownload={() => download('inspections')} /></div>;
}

function ReportCard({ icon, title, description, onDownload }: { icon: React.ReactNode; title: string; description: string; onDownload: () => void }) { return <section className="ui-card p-5"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">{icon}</span><h3 className="mt-4 font-semibold text-zinc-950">{title}</h3><p className="mt-2 text-sm text-zinc-500">{description}</p><button className="ui-button mt-5 h-10 gap-2 border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50" onClick={onDownload} type="button"><Download size={16} />Exportar CSV</button></section>; }

function EquipmentModal({ storageLocations, onClose, onSaved }: { storageLocations: StorageLocation[]; onClose: () => void; onSaved: () => void }) {
  const storage = storageLocations.find((item) => item.active) ?? storageLocations[0];
  const [form, setForm] = useState({ code: '', type: 'strap' as EquipmentTypeValue, description: '', brand: '', model: '', capacity: '', length: '', purchaseDate: '' });
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); if (!storage) { setError('Cadastre um local de estoque antes de continuar.'); return; } setSaving(true); setError(''); try { await equipmentRepository.saveEquipment({ ...form, purchaseDate: form.purchaseDate ? new Date(`${form.purchaseDate}T12:00:00`) : null, status: 'in_stock', currentVehicleId: '', currentVehiclePlate: '', currentDriverId: '', currentDriverName: '', currentStorageId: storage.id, currentStorageName: storage.name }, storage); onSaved(); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Erro ao salvar equipamento.'); } finally { setSaving(false); } }
  return <Modal title="Novo equipamento" onClose={onClose}><form className="space-y-5" onSubmit={submit}><ErrorBanner message={error} /><div className="grid gap-4 sm:grid-cols-2"><Field label="Numero / identificacao" value={form.code} required onChange={(value) => setForm({ ...form, code: value })} /><SelectField label="Tipo" value={form.type} onChange={(value) => setForm({ ...form, type: value as EquipmentTypeValue })} options={types.map((item) => [item, equipmentLabels[item]])} /><Field label="Marca" value={form.brand} onChange={(value) => setForm({ ...form, brand: value })} /><Field label="Modelo" value={form.model} onChange={(value) => setForm({ ...form, model: value })} /><Field label="Capacidade" value={form.capacity} onChange={(value) => setForm({ ...form, capacity: value })} /><Field label="Tamanho / comprimento" value={form.length} onChange={(value) => setForm({ ...form, length: value })} /><Field label="Data de aquisicao" type="date" value={form.purchaseDate} onChange={(value) => setForm({ ...form, purchaseDate: value })} /><SelectField label="Local inicial" value={storage?.id ?? ''} disabled options={storage ? [[storage.id, storage.name]] : []} onChange={() => undefined} /></div><TextArea label="Descricao / observacao" value={form.description} onChange={(value) => setForm({ ...form, description: value })} /><ModalFooter onClose={onClose} saving={saving} label="Cadastrar equipamento" /></form></Modal>;
}

function BatchModal({ storageLocations, onClose, onSaved }: { storageLocations: StorageLocation[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ type: 'strap' as EquipmentTypeValue, prefix: 'CT', start: '1', end: '10', storageId: storageLocations.find((item) => item.active)?.id ?? '' }); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const storage = storageLocations.find((item) => item.id === form.storageId); const preview = makeBatchPreview(form.prefix, Number(form.start), Number(form.end));
  async function submit(event: FormEvent) { event.preventDefault(); if (!storage) { setError('Selecione um local de estoque.'); return; } setSaving(true); setError(''); try { await equipmentRepository.createBatch({ type: form.type, prefix: form.prefix, start: Number(form.start), end: Number(form.end), storage }); onSaved(); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Erro no cadastro em lote.'); } finally { setSaving(false); } }
  return <Modal title="Cadastro em lote" onClose={onClose}><form className="space-y-5" onSubmit={submit}><ErrorBanner message={error} /><div className="grid gap-4 sm:grid-cols-2"><SelectField label="Tipo" value={form.type} onChange={(value) => setForm({ ...form, type: value as EquipmentTypeValue })} options={types.map((item) => [item, equipmentLabels[item]])} /><Field label="Prefixo" value={form.prefix} required onChange={(value) => setForm({ ...form, prefix: value.toUpperCase() })} /><Field label="Numero inicial" type="number" value={form.start} required onChange={(value) => setForm({ ...form, start: value })} /><Field label="Numero final" type="number" value={form.end} required onChange={(value) => setForm({ ...form, end: value })} /><SelectField label="Destino" value={form.storageId} onChange={(value) => setForm({ ...form, storageId: value })} options={storageLocations.filter((item) => item.active).map((item) => [item.id, item.name])} /></div><div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3"><p className="text-xs font-semibold uppercase text-zinc-500">Previa</p><p className="mt-2 text-sm font-medium text-zinc-800">{preview.length ? preview.join(', ') : 'Informe um intervalo valido.'}</p></div><ModalFooter onClose={onClose} saving={saving} label="Confirmar cadastro em lote" /></form></Modal>;
}

function EquipmentImportModal({ equipment, storageLocations, onClose, onSaved }: { equipment: Equipment[]; storageLocations: StorageLocation[]; onClose: () => void; onSaved: () => void }) {
  const [analysis, setAnalysis] = useState<EquipmentImportAnalysis | null>(null);
  const [storageId, setStorageId] = useState(storageLocations.find((item) => item.active)?.id ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const storage = storageLocations.find((item) => item.id === storageId);
  const validRows = analysis?.rows.filter((row) => row.issues.length === 0 && row.type) ?? [];

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true); setError(''); setAnalysis(null);
    try {
      setAnalysis(await analyzeEquipmentWorkbook(file, equipment));
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'Nao foi possivel ler a planilha.');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!storage) { setError('Selecione o local de estoque de destino.'); return; }
    if (!validRows.length) { setError('Corrija a planilha para ter ao menos um equipamento valido.'); return; }
    setSaving(true); setError('');
    try {
      await equipmentRepository.importEquipment({ rows: validRows.map((row) => ({ type: row.type!, code: row.code })), storage });
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Erro ao importar equipamentos.');
    } finally {
      setSaving(false);
    }
  }

  return <Modal title="Importar equipamentos por planilha" onClose={onClose} wide><form className="space-y-5" onSubmit={submit}><ErrorBanner message={error} />
    <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"><SelectField label="Destino no estoque" value={storageId} onChange={setStorageId} options={storageLocations.filter((item) => item.active).map((item) => [item.id, item.name])} />
      <label className="ui-button h-11 cursor-pointer gap-2 border border-zinc-200 bg-white px-4 text-sm text-zinc-700 hover:bg-zinc-50"><FileSpreadsheet size={17} />{loading ? 'Lendo planilha...' : 'Selecionar planilha'}<input accept=".xlsx,.xls" className="sr-only" disabled={loading} onChange={selectFile} type="file" /></label>
    </div>
    {!analysis ? <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center"><FileSpreadsheet className="mx-auto text-zinc-400" size={30} /><p className="mt-3 text-sm font-medium text-zinc-800">Selecione a planilha preenchida</p><p className="mt-1 text-sm text-zinc-500">O modelo possui apenas tipo do equipamento e numero de identificacao.</p></div> : <>
      <div className="grid gap-3 sm:grid-cols-4"><ImportMetric label="Linhas lidas" value={analysis.totalRows} tone="neutral" /><ImportMetric label="Prontas para importar" value={analysis.validRows} tone="success" /><ImportMetric label="Com pendencia" value={analysis.invalidRows} tone={analysis.invalidRows ? 'warning' : 'neutral'} /><ImportMetric label="Duplicadas" value={analysis.duplicateRows} tone={analysis.duplicateRows ? 'danger' : 'neutral'} /></div>
      <div className="overflow-hidden rounded-xl border border-zinc-200"><div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3"><div><p className="text-sm font-semibold text-zinc-900">{analysis.fileName}</p><p className="text-xs text-zinc-500">Somente as linhas sem pendencias serao cadastradas.</p></div><span className="text-sm font-semibold text-zinc-700">{validRows.length} item(ns)</span></div><div className="max-h-64 overflow-auto"><table className="ui-table min-w-[620px]"><thead><tr><th>Linha</th><th>Tipo</th><th>Numero</th><th>Situacao</th></tr></thead><tbody>{analysis.rows.map((row) => <tr key={row.sourceRow}><td>{row.sourceRow}</td><td>{row.type ? equipmentLabels[row.type] : '-'}</td><td className="font-semibold">{row.code || '-'}</td><td>{row.issues.length ? <span className="text-sm text-red-700">{row.issues.join('; ')}</span> : <span className="text-sm font-medium text-emerald-700">Pronto para importar</span>}</td></tr>)}</tbody></table></div></div>
    </>}
    <ModalFooter onClose={onClose} saving={saving} label={`Importar ${validRows.length} equipamento(s)`} />
  </form></Modal>;
}

function ImportMetric({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const colors = { neutral: 'border-zinc-200 bg-zinc-50 text-zinc-800', success: 'border-emerald-200 bg-emerald-50 text-emerald-800', warning: 'border-amber-200 bg-amber-50 text-amber-800', danger: 'border-red-200 bg-red-50 text-red-800' };
  return <div className={`rounded-lg border p-3 ${colors[tone]}`}><p className="text-xs font-medium">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>;
}

function StorageLocationModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await equipmentRepository.saveStorageLocation({ name, description, active: true }); onSaved(); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Erro ao salvar local.'); } finally { setSaving(false); } }
  return <Modal title="Novo local de estoque" onClose={onClose}><form className="space-y-5" onSubmit={submit}><ErrorBanner message={error} /><Field label="Nome do local" value={name} required onChange={setName} /><TextArea label="Descricao" value={description} onChange={setDescription} /><ModalFooter onClose={onClose} saving={saving} label="Cadastrar local" /></form></Modal>;
}

function AssignmentModal({ data, drivers, vehicles, onClose, onSaved }: { data: EquipmentAdminData; drivers: AppUser[]; vehicles: Vehicle[]; onClose: () => void; onSaved: () => void }) {
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? ''); const [driverId, setDriverId] = useState(''); const [selected, setSelected] = useState<Set<string>>(new Set()); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const available = data.equipment.filter((item) => item.status === 'in_stock'); const vehicle = vehicles.find((item) => item.id === vehicleId); const driver = drivers.find((item) => item.uid === driverId);
  async function submit(event: FormEvent) { event.preventDefault(); if (!vehicle) { setError('Selecione um veiculo.'); return; } setSaving(true); setError(''); try { await equipmentRepository.assignEquipment({ equipmentIds: [...selected], vehicle, driver }); onSaved(); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Erro ao atribuir equipamentos.'); } finally { setSaving(false); } }
  return <Modal title="Atribuir equipamentos" onClose={onClose} wide><form className="space-y-5" onSubmit={submit}><ErrorBanner message={error} /><div className="grid gap-4 sm:grid-cols-2"><SelectField label="Veiculo" value={vehicleId} onChange={setVehicleId} options={vehicles.map((item) => [item.id, vehicleTitle(item)])} /><SelectField label="Responsavel pelo veiculo" value={driverId} onChange={setDriverId} optionalLabel="Nao informado" options={drivers.map((item) => [item.uid, item.name])} /></div><div className="rounded-lg border border-zinc-200"><div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3"><div><h3 className="font-semibold text-zinc-900">Disponiveis no estoque</h3><p className="text-sm text-zinc-500">{selected.size} equipamento(s) selecionado(s)</p></div></div><div className="grid max-h-[42vh] grid-cols-1 divide-y divide-zinc-100 overflow-y-auto sm:grid-cols-2 sm:divide-x">{available.map((item) => <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-zinc-50" key={item.id}><input checked={selected.has(item.id)} className="h-4 w-4 accent-zinc-900" onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) { next.add(item.id); } else { next.delete(item.id); } return next; })} type="checkbox" /><span className="min-w-0 flex-1"><strong className="block text-sm text-zinc-900">{item.code}</strong><small className="text-zinc-500">{equipmentLabels[item.type]} - {item.currentStorageName}</small></span></label>)}{!available.length ? <EmptyState title="Sem equipamentos disponiveis" description="Devolva itens ao estoque para realizar uma nova atribuicao." /> : null}</div></div><ModalFooter onClose={onClose} saving={saving} label={`Confirmar atribuicao (${selected.size})`} /></form></Modal>;
}

function InspectionModal({ vehicle, data, onClose, onSaved }: { vehicle: Vehicle; data: EquipmentAdminData; onClose: () => void; onSaved: () => void }) {
  const equipment = data.equipment.filter((item) => item.currentVehicleId === vehicle.id); const current = new Date(); const existing = data.inspections.find((item) => item.vehicleId === vehicle.id && item.referenceMonth === current.getMonth() + 1 && item.referenceYear === current.getFullYear() && item.inspectionType === 'admin_monthly');
  const [items, setItems] = useState<EquipmentInspectionItem[]>(() => equipment.map((item) => existing?.items.find((row) => row.equipmentId === item.id) ?? { equipmentId: item.id, equipmentCode: item.code, equipmentType: item.type, expected: true, result: 'ok', observation: '', photoUrl: '' })); const [notes, setNotes] = useState(existing?.notes ?? ''); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const responsible = equipment[0]; const summary = { ok: items.filter((item) => item.result === 'ok').length, damaged: items.filter((item) => item.result === 'damaged').length, missing: items.filter((item) => item.result === 'not_found').length };
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await equipmentRepository.saveMonthlyInspection({ inspection: { id: existing?.id ?? '', vehicleId: vehicle.id, vehiclePlate: vehicle.plate, inspectionType: 'admin_monthly', referenceMonth: current.getMonth() + 1, referenceYear: current.getFullYear(), performedAt: null, performedByUserId: '', responsibleDriverId: responsible?.currentDriverId ?? '', responsibleDriverName: responsible?.currentDriverName ?? '', status: 'pending', notes, items: [], createdAt: null, updatedAt: null }, items }); onSaved(); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Erro ao finalizar inspecao.'); } finally { setSaving(false); } }
  return <Modal title={`Inspecao mensal - ${vehicleTitle(vehicle)}`} onClose={onClose} wide><form className="space-y-5" onSubmit={submit}><ErrorBanner message={error} /><div className="grid gap-3 rounded-lg bg-zinc-50 p-3 text-sm sm:grid-cols-3"><div><span className="block text-zinc-500">Mes</span><strong>{monthName(current.getMonth() + 1)}/{current.getFullYear()}</strong></div><div><span className="block text-zinc-500">Responsavel</span><strong>{responsible?.currentDriverName || 'Nao informado'}</strong></div><div><span className="block text-zinc-500">Resumo</span><strong>{items.length} esperados, {summary.ok} conformes</strong></div></div><button className="ui-button h-10 gap-2 border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50" onClick={() => setItems((currentItems) => currentItems.map((item) => ({ ...item, result: 'ok', observation: '' })))} type="button"><Check size={16} />Marcar todos como Conforme</button><div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">{items.map((item, index) => <div className="space-y-3 px-4 py-3" key={item.equipmentId}><div className="flex flex-wrap items-center justify-between gap-3"><div><strong className="text-sm text-zinc-900">{item.equipmentCode}</strong><span className="ml-2 text-xs text-zinc-500">{equipmentLabels[item.equipmentType]}</span></div><select className="ui-input h-9 min-w-44 px-2 text-sm" value={item.result} onChange={(event) => setItems((currentItems) => currentItems.map((row, itemIndex) => itemIndex === index ? { ...row, result: event.target.value as EquipmentInspectionResult } : row))}>{[['ok', 'Conforme'], ['damaged', 'Danificado'], ['not_found', 'Nao localizado'], ['divergence', 'Divergencia']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>{item.result !== 'ok' ? <input className="ui-input h-10 w-full px-3 text-sm" placeholder="Descreva a divergencia" value={item.observation} onChange={(event) => setItems((currentItems) => currentItems.map((row, itemIndex) => itemIndex === index ? { ...row, observation: event.target.value } : row))} /> : null}</div>)}</div><TextArea label="Observacoes gerais" value={notes} onChange={setNotes} /><ModalFooter onClose={onClose} saving={saving} label="Finalizar inspecao" /></form></Modal>;
}

function EquipmentActionModal({ equipment, data, drivers, vehicles, onClose, onSaved }: { equipment: Equipment; data: EquipmentAdminData; drivers: AppUser[]; vehicles: Vehicle[]; onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<'history' | 'return' | 'transfer' | 'status'>('history'); const [storageId, setStorageId] = useState(data.storageLocations.find((item) => item.active)?.id ?? ''); const [vehicleId, setVehicleId] = useState(vehicles.find((item) => item.id !== equipment.currentVehicleId)?.id ?? ''); const [driverId, setDriverId] = useState(''); const [status, setStatus] = useState<EquipmentStatus>(equipment.status); const [observation, setObservation] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const storage = data.storageLocations.find((item) => item.id === storageId); const vehicle = vehicles.find((item) => item.id === vehicleId); const driver = drivers.find((item) => item.uid === driverId); const history = data.movements.filter((item) => item.equipmentId === equipment.id).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { if (mode === 'return') { if (!storage) throw new Error('Selecione o destino no estoque.'); await equipmentRepository.returnToStock({ equipment, storage, observation }); } else if (mode === 'transfer') { if (!vehicle) throw new Error('Selecione o veiculo de destino.'); await equipmentRepository.transfer({ equipment, vehicle, driver, observation }); } else if (mode === 'status') { await equipmentRepository.changeStatus({ equipment, status, observation }); } onSaved(); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Erro ao atualizar equipamento.'); } finally { setSaving(false); } }
  return <Modal title={`${equipment.code} - ${equipmentLabels[equipment.type]}`} onClose={onClose}><div className="mb-5 flex flex-wrap gap-2"><ModeButton active={mode === 'history'} onClick={() => setMode('history')} label="Historico" /><ModeButton active={mode === 'return'} onClick={() => setMode('return')} label="Devolver" disabled={!equipment.currentVehicleId} /><ModeButton active={mode === 'transfer'} onClick={() => setMode('transfer')} label="Transferir" disabled={!equipment.currentVehicleId} /><ModeButton active={mode === 'status'} onClick={() => setMode('status')} label="Situacao" /></div>{mode === 'history' ? <div className="space-y-3">{history.map((item) => <div className="flex gap-3 border-l-2 border-zinc-200 pl-3" key={item.id}><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100"><ArrowLeftRight size={13} /></span><div><p className="text-sm font-semibold text-zinc-800">{movementLabel(item.movementType)}</p><p className="text-sm text-zinc-500">{formatDateTime(item.createdAt)} {item.observation ? `- ${item.observation}` : ''}</p></div></div>)}{!history.length ? <EmptyState title="Sem movimentacoes" /> : null}</div> : <form className="space-y-4" onSubmit={submit}><ErrorBanner message={error} />{mode === 'return' ? <SelectField label="Destino no estoque" value={storageId} onChange={setStorageId} options={data.storageLocations.filter((item) => item.active).map((item) => [item.id, item.name])} /> : null}{mode === 'transfer' ? <><SelectField label="Veiculo destino" value={vehicleId} onChange={setVehicleId} options={vehicles.filter((item) => item.id !== equipment.currentVehicleId).map((item) => [item.id, vehicleTitle(item)])} /><SelectField label="Responsavel" value={driverId} onChange={setDriverId} optionalLabel="Nao informado" options={drivers.map((item) => [item.uid, item.name])} /></> : null}{mode === 'status' ? <SelectField label="Nova situacao" value={status} onChange={(value) => setStatus(value as EquipmentStatus)} options={statuses.filter((value) => value !== 'assigned' && value !== 'in_stock').map((value) => [value, equipmentStatusLabels[value]])} /> : null}<TextArea label="Observacao" required={mode === 'status' && ['damaged', 'lost', 'retired'].includes(status)} value={observation} onChange={setObservation} /><ModalFooter onClose={onClose} saving={saving} label={mode === 'return' ? 'Devolver ao estoque' : mode === 'transfer' ? 'Confirmar transferencia' : 'Atualizar situacao'} /></form>}</Modal>;
}

function Modal({ children, title, onClose, wide = false }: { children: React.ReactNode; title: string; onClose: () => void; wide?: boolean }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"><section className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl ${wide ? 'max-w-4xl' : 'max-w-2xl'}`}><header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4"><h2 className="text-lg font-semibold text-zinc-950">{title}</h2><button aria-label="Fechar" className="ui-icon-button h-9 w-9 border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50" onClick={onClose} type="button"><X size={17} /></button></header><div className="overflow-y-auto p-5">{children}</div></section></div>; }
function ModalFooter({ onClose, saving, label }: { onClose: () => void; saving: boolean; label: string }) { return <div className="flex justify-end gap-2 border-t border-zinc-100 pt-5"><button className="ui-button h-10 border border-zinc-200 bg-white px-4 text-sm text-zinc-700 hover:bg-zinc-50" onClick={onClose} type="button">Cancelar</button><button className="ui-button h-10 gap-2 bg-avapex-yellow px-4 text-sm font-semibold text-avapex-black hover:bg-yellow-300 disabled:opacity-60" disabled={saving} type="submit">{saving ? 'Salvando...' : label}</button></div>; }
function Field({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="block"><span className="mb-2 block text-sm font-medium text-zinc-700">{label}</span><input className="ui-input h-11 w-full px-3" required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function TextArea({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) { return <label className="block"><span className="mb-2 block text-sm font-medium text-zinc-700">{label}</span><textarea className="ui-input min-h-24 w-full px-3 py-2" required={required} value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function SelectField({ label, value, onChange, options, optionalLabel, disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: Array<string[]>; optionalLabel?: string; disabled?: boolean }) { return <label className="block"><span className="mb-2 block text-sm font-medium text-zinc-700">{label}</span><select className="ui-input h-11 w-full px-3" disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>{optionalLabel ? <option value="">{optionalLabel}</option> : null}{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>; }
function TableToolbar({ count, search, setSearch, extra }: { count: number; search: string; setSearch: (value: string) => void; extra: React.ReactNode }) { return <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"><p className="text-sm text-zinc-500">{count} equipamento(s) encontrado(s)</p><div className="flex flex-col gap-2 sm:flex-row"><label className="relative sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={17} /><input className="ui-input h-10 w-full pl-10 pr-3 text-sm" placeholder="Buscar numero, placa ou responsavel" value={search} onChange={(event) => setSearch(event.target.value)} /></label>{extra}</div></div>; }
function Select({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: Array<string[]> }) { return <select aria-label={label} className="ui-input h-10 px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{label}</option>{options.map(([valueOption, labelOption]) => <option key={valueOption} value={valueOption}>{labelOption}</option>)}</select>; }
function StatusPill({ status }: { status: EquipmentStatus }) { const colors: Record<EquipmentStatus, string> = { in_stock: 'bg-yellow-100 text-yellow-800', assigned: 'bg-sky-100 text-sky-800', in_use: 'bg-blue-100 text-blue-800', damaged: 'bg-red-100 text-red-800', under_review: 'bg-amber-100 text-amber-800', lost: 'bg-rose-100 text-rose-800', retired: 'bg-zinc-200 text-zinc-700' }; return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors[status]}`}>{equipmentStatusLabels[status]}</span>; }
function InspectionPill({ inspection }: { inspection?: EquipmentInspection }) { const label = !inspection ? 'Pendente' : inspection.status === 'completed' ? 'Realizada' : inspection.status === 'divergence' ? 'Com divergencia' : inspection.status === 'not_applicable' ? 'Nao aplicavel' : 'Pendente'; const style = !inspection ? 'bg-amber-100 text-amber-800' : inspection.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : inspection.status === 'divergence' ? 'bg-red-100 text-red-800' : 'bg-zinc-100 text-zinc-700'; return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{label}</span>; }
function ModeButton({ active, label, onClick, disabled = false }: { active: boolean; label: string; onClick: () => void; disabled?: boolean }) { return <button className={`ui-button h-9 px-3 text-sm ${active ? 'bg-zinc-900 text-white' : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'}`} disabled={disabled} onClick={onClick} type="button">{label}</button>; }
function vehicleTitle(vehicle: Vehicle) { return `${vehicle.fleetNumber || 'Sem frota'} - ${vehicle.plate}`; }
function formatDate(value: Date | null) { return value ? new Intl.DateTimeFormat('pt-BR').format(value) : '-'; }
function formatDateTime(value: Date | null) { return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(value) : '-'; }
function inspectionResultLabel(result: EquipmentInspectionResult) { return result === 'ok' ? 'Conforme' : result === 'damaged' ? 'Nao conforme' : result === 'not_found' ? 'Nao localizado' : 'Divergencia'; }
function inspectionDispositionLabel(item: EquipmentInspectionItem) { return item.disposition === 'replace' ? `Troca por ${item.replacementEquipmentCode || '-'}` : item.disposition === 'discard' ? 'Descarte' : '-'; }
function htmlEscape(value: unknown) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character); }
function inspectionFileName(inspection: EquipmentInspection, extension: string) { return `checklist-equipamentos-${inspection.vehiclePlate}-${inspection.referenceYear}-${String(inspection.referenceMonth).padStart(2, '0')}${extension}`.replace(/\s+/g, '-').toLowerCase(); }
function signatureSvg(points: Array<{ x: number; y: number }> = []) { if (points.length < 2) return '<div class="signature-space"></div>'; const coordinates = points.map((point) => `${Number(point.x).toFixed(1)},${Number(point.y).toFixed(1)}`).join(' '); return `<svg class="signature" viewBox="0 0 900 144" preserveAspectRatio="xMidYMid meet"><polyline points="${coordinates}" fill="none" stroke="#18181b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg>`; }
function printEquipmentInspection(inspection: EquipmentInspection, auditorName: string, vehicle: Vehicle) {
  const rows = inspection.items.map((item, index) => `<tr><td>${index + 1}</td><td><strong>${htmlEscape(item.equipmentCode)}</strong></td><td>${htmlEscape(equipmentLabels[item.equipmentType])}</td><td>${htmlEscape(inspectionResultLabel(item.result))}</td><td>${htmlEscape(item.observation || '-')}</td><td>${htmlEscape(inspectionDispositionLabel(item))}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Checklist de equipamentos - ${htmlEscape(inspection.vehiclePlate)}</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#18181b;font-family:Arial,sans-serif;font-size:11px}.page{position:relative;min-height:270mm;padding:10mm;overflow:hidden}.page:before{content:"";position:absolute;inset:0;background:url('/checklist-pdf-background.png') right 10mm bottom 10mm/55% auto no-repeat;opacity:.10;z-index:0}.content{position:relative;z-index:1}.brand{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f3c400;padding-bottom:10px}.brand img{width:165px}.title{text-align:right}.title h1{margin:0;font-size:21px}.title p{margin:5px 0 0;color:#52525b}.info{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.box{border:1px solid #d4d4d8;border-radius:6px;background:rgba(255,255,255,.92);padding:8px}.label{display:block;color:#71717a;font-size:9px;text-transform:uppercase}.value{display:block;margin-top:3px;font-weight:700}.summary{display:flex;gap:8px;margin-bottom:10px}.summary .box{flex:1;text-align:center}.summary .value{font-size:16px}table{width:100%;border-collapse:collapse;background:rgba(255,255,255,.94)}th,td{border:1px solid #d4d4d8;padding:6px;text-align:left;vertical-align:top}th{background:#f4f4f5;font-size:9px;text-transform:uppercase}.notes{margin-top:12px;border:1px solid #d4d4d8;border-radius:6px;padding:9px;background:rgba(255,255,255,.92)}.notes strong{display:block;margin-bottom:5px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:28px;break-inside:avoid}.signature-wrap{height:92px;display:flex;align-items:flex-end;justify-content:center;border-bottom:1px solid #18181b}.signature{width:100%;height:86px}.signature-space{height:86px}.signature-label{text-align:center;padding-top:5px;font-size:10px}.footer{margin-top:16px;text-align:right;color:#71717a;font-size:9px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{padding:0}}</style></head><body><main class="page"><div class="content"><header class="brand"><img src="/checklist-pdf-logo.png" alt="AVAPEX Transportes"><div class="title"><h1>Checklist de equipamentos</h1><p>Inspecao mensal de equipamentos de amarracao</p></div></header><section class="info"><div class="box"><span class="label">Veiculo / placa</span><span class="value">${htmlEscape(vehicleTitle(vehicle))}</span></div><div class="box"><span class="label">Motorista</span><span class="value">${htmlEscape(inspection.responsibleDriverName || '-')}</span></div><div class="box"><span class="label">Responsavel pela auditoria</span><span class="value">${htmlEscape(auditorName || '-')}</span></div><div class="box"><span class="label">Data e hora</span><span class="value">${htmlEscape(formatDateTime(inspection.performedAt))}</span></div><div class="box"><span class="label">Local da inspecao</span><span class="value">${htmlEscape(inspection.inspectionLocation || '-')}</span></div><div class="box"><span class="label">Localizacao registrada</span><span class="value">${htmlEscape(inspection.location?.display || '-')}</span></div></section><section class="summary"><div class="box"><span class="label">Quantidade de itens</span><span class="value">${inspection.items.length}</span></div><div class="box"><span class="label">Conformes</span><span class="value">${inspection.items.filter((item) => item.result === 'ok').length}</span></div><div class="box"><span class="label">Nao conformes</span><span class="value">${inspection.items.filter((item) => item.result !== 'ok').length}</span></div></section><table><thead><tr><th>#</th><th>Numero da tag</th><th>Tipo</th><th>Resultado</th><th>Observacao</th><th>Tratativa</th></tr></thead><tbody>${rows}</tbody></table><section class="notes"><strong>Observacoes gerais</strong>${htmlEscape(inspection.notes || 'Nenhuma observacao registrada.')}</section><section class="signatures"><div><div class="signature-wrap">${signatureSvg(inspection.signaturePoints)}</div><div class="signature-label">Assinatura do motorista<br>${htmlEscape(inspection.responsibleDriverName || '')}</div></div><div><div class="signature-wrap"><div class="signature-space"></div></div><div class="signature-label">Assinatura do responsavel pela auditoria<br>${htmlEscape(auditorName || '')}</div></div></section><div class="footer">Documento gerado em ${htmlEscape(formatDateTime(new Date()))}</div></div></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300));</script></body></html>`;
  const printWindow = window.open('', '_blank', 'width=1000,height=1200'); if (!printWindow) return; printWindow.document.open(); printWindow.document.write(html); printWindow.document.close();
}
function exportEquipmentInspectionExcel(inspection: EquipmentInspection, auditorName: string, vehicle: Vehicle) {
  const rows = inspection.items.map((item, index) => `<tr><td>${index + 1}</td><td>${htmlEscape(item.equipmentCode)}</td><td>${htmlEscape(equipmentLabels[item.equipmentType])}</td><td>${htmlEscape(inspectionResultLabel(item.result))}</td><td>${htmlEscape(item.observation || '')}</td><td>${htmlEscape(inspectionDispositionLabel(item))}</td></tr>`).join('');
  const content = `<!doctype html><html><head><meta charset="utf-8"></head><body><table border="1"><tr><th colspan="6" style="font-size:18px;background:#f3c400">CHECKLIST DE EQUIPAMENTOS</th></tr><tr><th>Veiculo</th><td>${htmlEscape(vehicleTitle(vehicle))}</td><th>Motorista</th><td>${htmlEscape(inspection.responsibleDriverName)}</td><th>Quantidade</th><td>${inspection.items.length}</td></tr><tr><th>Responsavel pela auditoria</th><td>${htmlEscape(auditorName)}</td><th>Data e hora</th><td>${htmlEscape(formatDateTime(inspection.performedAt))}</td><th>Local</th><td>${htmlEscape(inspection.inspectionLocation || inspection.location?.display || '')}</td></tr><tr></tr><tr><th>#</th><th>Numero da tag</th><th>Tipo</th><th>Resultado</th><th>Observacao</th><th>Tratativa</th></tr>${rows}<tr></tr><tr><th>Observacoes gerais</th><td colspan="5">${htmlEscape(inspection.notes)}</td></tr><tr></tr><tr><th>Assinatura do motorista</th><td colspan="2"></td><th>Assinatura do responsavel</th><td colspan="2"></td></tr></table></body></html>`;
  const url = URL.createObjectURL(new Blob(['\ufeff', content], { type: 'application/vnd.ms-excel;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = inspectionFileName(inspection, '.xls'); link.click(); URL.revokeObjectURL(url);
}
function monthName(month: number) { return new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2026, month - 1, 1)); }
function occurrenceTypeLabel(type: string) { return ({ damaged: 'Danificado', not_found: 'Nao localizado', lost: 'Extravio', divergence: 'Divergencia', other: 'Outro' } as Record<string, string>)[type] ?? type; }
function movementLabel(type: string) { return ({ registration: 'Cadastrado', stock_entry: 'Entrada no estoque', assignment: 'Atribuido ao veiculo', transfer: 'Transferido de veiculo', return: 'Devolvido ao estoque', lost: 'Extravio registrado', found: 'Equipamento localizado', retirement: 'Baixa registrada' } as Record<string, string>)[type] ?? type; }
function makeBatchPreview(prefix: string, start: number, end: number) { if (!prefix || !Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start > 100) return []; const width = Math.max(3, String(end).length); const codes = Array.from({ length: end - start + 1 }, (_, index) => `${prefix.toUpperCase()}-${String(start + index).padStart(width, '0')}`); return codes.length > 10 ? [...codes.slice(0, 9), `+ ${codes.length - 9} outros`] : codes; }
function csv(value: unknown) { const text = String(value ?? ''); return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
