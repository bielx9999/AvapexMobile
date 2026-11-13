import { FormEvent, PointerEvent, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ClipboardCheck, MapPin, Plus, TriangleAlert, X } from 'lucide-react';
import type { AppUser, EquipmentInspectionItem, Vehicle } from '../../shared/domain/models';
import { ErrorBanner, PageSkeleton } from '../../shared/presentation/ui';
import { equipmentLabels, equipmentRepository, type EquipmentAdminData } from '../data/equipmentRepository';

type Props = { currentUser: AppUser; users: AppUser[]; vehicles: Vehicle[] };
type LocationValue = { latitude: number; longitude: number; display: string };

export function EquipmentChecklistsPage({ currentUser, users, vehicles }: Props) {
  const [data, setData] = useState<EquipmentAdminData | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    void equipmentRepository.load().then((value) => active && setData(value)).catch((reason) => active && setError(reason instanceof Error ? reason.message : 'Erro ao carregar checklists.'));
    return () => { active = false; };
  }, [reload]);
  if (!data) return <PageSkeleton />;
  return <div className="space-y-4">
    <ErrorBanner message={error} />
    <section className="ui-card">
      <div className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="font-semibold text-zinc-950">Nova conferencia de equipamentos</h2></div>
        <button className="ui-button h-10 gap-2 bg-avapex-yellow px-4 text-sm font-semibold text-avapex-black hover:bg-yellow-300" onClick={() => setOpen(true)} type="button"><Plus size={17} />Nova inspecao</button>
      </div>
    </section>
    {open ? <InspectionDialog currentUser={currentUser} data={data} users={users} vehicles={vehicles.filter((vehicle) => vehicle.status === 'active')} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); setReload((value) => value + 1); }} /> : null}
  </div>;
}

function InspectionDialog({ currentUser, data, users, vehicles, onClose, onSaved }: Props & { data: EquipmentAdminData; onClose: () => void; onSaved: () => void }) {
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [items, setItems] = useState<EquipmentInspectionItem[]>([]);
  const [inspectionLocation] = useState('Matriz Grupo Seday');
  const [inspectionDate] = useState(() => new Date());
  const [location, setLocation] = useState<LocationValue>();
  const [signaturePoints, setSignaturePoints] = useState<Array<{ x: number; y: number }>>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const vehicle = vehicles.find((item) => item.id === vehicleId);
  const drivers = users.filter((user) => user.role === 'driver' && user.status === 'active');
  const available = data.equipment.filter((item) => item.status === 'in_stock');

  function selectVehicle(id: string) {
    setVehicleId(id);
    const selected = vehicles.find((item) => item.id === id);
    const assigned = data.equipment.filter((item) => item.currentVehicleId === id);
    setDriverId(selected?.currentDriverId || assigned.find((item) => item.currentDriverId)?.currentDriverId || '');
    setItems(assigned.map((item) => ({ equipmentId: item.id, equipmentCode: item.code, equipmentType: item.type, expected: true, result: 'ok', observation: '', photoUrl: '', disposition: '', replacementEquipmentId: '', replacementEquipmentCode: '' })));
  }
  function updateItem(index: number, update: Partial<EquipmentInspectionItem>) { setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...update } : item)); }
  function locate() { navigator.geolocation.getCurrentPosition((position) => setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude, display: `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}` }), () => setError('Nao foi possivel obter a localizacao. Verifique a permissao do navegador.')); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const driver = drivers.find((item) => item.uid === driverId);
    if (!vehicle || !driver || !items.length) return setError('Selecione um veiculo com equipamentos vinculados e o motorista.');
    if (signaturePoints.length < 2) return setError('Colete a assinatura antes de finalizar.');
    if (items.some((item) => item.result !== 'ok' && (!item.observation.trim() || !item.disposition || (item.disposition === 'replace' && !item.replacementEquipmentId)))) return setError('Complete a observacao e a tratativa de todos os itens nao conformes.');
    setSaving(true); setError(''); const now = new Date();
    try {
      await equipmentRepository.saveEquipmentChecklist({ vehicle, items, inspection: { id: '', vehicleId: vehicle.id, vehiclePlate: vehicle.plate, inspectionType: 'admin_monthly', referenceMonth: now.getMonth() + 1, referenceYear: now.getFullYear(), performedAt: null, performedByUserId: currentUser.uid, responsibleDriverId: driver.uid, responsibleDriverName: driver.name, status: 'pending', notes, inspectionLocation, location, signaturePoints, items: [], createdAt: null, updatedAt: null } });
      onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro ao salvar a inspecao.'); } finally { setSaving(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 backdrop-blur-[1px] sm:p-4"><section className="flex max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
    <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 sm:px-5"><div><h2 className="font-semibold text-zinc-950">Nova inspecao de equipamentos</h2><p className="text-xs text-zinc-500">Auditor: {currentUser.name}</p></div><button aria-label="Fechar" className="ui-icon-button h-9 w-9 border-zinc-200" onClick={onClose} type="button"><X size={18} /></button></header>
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}><div className="space-y-5 overflow-y-auto p-4 sm:p-5"><ErrorBanner message={error} />
      <section className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-2 lg:grid-cols-3">
        <ReadOnlyField label="Responsavel pela auditoria" value={currentUser.name} />
        <ReadOnlyField label="Data e hora" value={formatDate(inspectionDate)} />
        <ReadOnlyField label="Local da inspecao" value={inspectionLocation} />
        <div className="lg:col-span-3 grid gap-3 sm:grid-cols-2"><SelectField label="Veiculo / frota *" value={vehicleId} onChange={selectVehicle} options={vehicles.map((item) => [item.id, `${item.fleetNumber || 'Sem frota'} - ${item.plate}`])} placeholder="Selecione o veiculo" /><SelectField label="Motorista *" value={driverId} onChange={setDriverId} options={drivers.map((item) => [item.uid, item.name])} placeholder="Selecione o motorista" /></div>
      </section>
      {vehicleId && !items.length ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><TriangleAlert className="mr-2 inline" size={17} />Este veiculo nao possui equipamentos vinculados.</div> : null}
      {items.length ? <section><div className="mb-3 flex items-center justify-between"><div><h3 className="font-semibold text-zinc-950">Equipamentos vinculados</h3><p className="text-sm text-zinc-500">Confira todos os {items.length} itens.</p></div><button className="text-sm font-semibold text-zinc-700" onClick={() => setItems((current) => current.map((item) => ({ ...item, result: 'ok', disposition: '', replacementEquipmentId: '', replacementEquipmentCode: '' })))} type="button">Marcar todos conforme</button></div><div className="space-y-3">{items.map((item, index) => {
        const replacements = available.filter((candidate) => candidate.type === item.equipmentType && !items.some((row, rowIndex) => rowIndex !== index && row.replacementEquipmentId === candidate.id));
        return <article className="rounded-lg border border-zinc-200 p-3" key={item.equipmentId}><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><strong className="text-sm text-zinc-950">{item.equipmentCode}</strong><span className="ml-2 text-xs text-zinc-500">{equipmentLabels[item.equipmentType]}</span></div><div className="grid grid-cols-2 gap-2"><Choice active={item.result === 'ok'} label="Conforme" ok onClick={() => updateItem(index, { result: 'ok', observation: '', disposition: '', replacementEquipmentId: '', replacementEquipmentCode: '' })} /><Choice active={item.result !== 'ok'} label="Nao conforme" onClick={() => updateItem(index, { result: 'damaged' })} /></div></div>{item.result !== 'ok' ? <div className="mt-3 grid gap-3 border-t border-zinc-100 pt-3 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-zinc-600">Observacao *</span><input className="ui-input h-10 w-full px-3 text-sm" value={item.observation} onChange={(event) => updateItem(index, { observation: event.target.value })} /></label><SelectField label="Tratativa *" value={item.disposition ?? ''} onChange={(value) => updateItem(index, { disposition: value as 'replace' | 'discard', replacementEquipmentId: '', replacementEquipmentCode: '' })} options={[["replace", "Troca"], ["discard", "Descarte"]]} placeholder="Selecione" />{item.disposition === 'replace' ? <SelectField label="Equipamento substituto *" value={item.replacementEquipmentId ?? ''} onChange={(id) => updateItem(index, { replacementEquipmentId: id, replacementEquipmentCode: replacements.find((candidate) => candidate.id === id)?.code ?? '' })} options={replacements.map((candidate) => [candidate.id, `${candidate.code} - ${equipmentLabels[candidate.type]}`])} placeholder="Selecione no estoque" /> : null}</div> : null}</article>;
      })}</div></section> : null}
      <section className="grid gap-4 border-t border-zinc-200 pt-5 sm:grid-cols-2"><div className="sm:col-span-2"><span className="mb-2 block text-sm font-medium">Localizacao do dispositivo <span className="font-normal text-zinc-500">(opcional)</span></span><button className="ui-button h-11 w-full gap-2 border border-zinc-200 bg-white px-3 text-sm" onClick={locate} type="button">{location ? <CheckCircle2 className="text-emerald-600" size={17} /> : <MapPin size={17} />}{location ? `Confirmada: ${location.display}` : 'Registrar localizacao'}</button></div><label className="sm:col-span-2"><span className="mb-2 block text-sm font-medium">Observacoes gerais</span><textarea className="ui-input min-h-20 w-full p-3" value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div className="sm:col-span-2"><p className="mb-2 text-sm font-medium">Assinatura *</p><SignaturePad onChange={setSignaturePoints} /></div></section>
    </div><footer className="flex shrink-0 justify-end gap-2 border-t border-zinc-200 bg-white px-4 py-3"><button className="ui-button h-10 border border-zinc-200 bg-white px-4 text-sm" onClick={onClose} type="button">Cancelar</button><button className="ui-button h-10 gap-2 bg-avapex-yellow px-4 text-sm font-semibold disabled:opacity-60" disabled={saving} type="submit"><ClipboardCheck size={17} />{saving ? 'Salvando...' : 'Finalizar inspecao'}</button></footer></form>
  </section></div>;
}

function Choice({ active, label, ok = false, onClick }: { active: boolean; label: string; ok?: boolean; onClick: () => void }) { return <button className={`ui-button h-10 px-3 text-sm font-semibold ${active ? ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white' : 'border border-zinc-200 bg-white text-zinc-600'}`} onClick={onClick} type="button">{label}</button>; }
function SelectField({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (value: string) => void; options: string[][]; placeholder: string }) { return <label><span className="mb-1 block text-xs font-semibold text-zinc-600">{label}</span><select className="ui-input h-11 w-full px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{placeholder}</option>{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>; }
function ReadOnlyField({ label, value }: { label: string; value: string }) { return <label><span className="mb-1 block text-xs font-semibold text-zinc-600">{label}</span><input className="ui-input h-11 w-full bg-zinc-100 px-3 text-sm text-zinc-700" readOnly value={value} /></label>; }
function SignaturePad({ onChange }: { onChange: (points: Array<{ x: number; y: number }>) => void }) { const canvasRef = useRef<HTMLCanvasElement>(null); const [points, setPoints] = useState<Array<{ x: number; y: number }>>([]); function draw(event: PointerEvent<HTMLCanvasElement>) { const canvas = canvasRef.current; if (!canvas) return; const rect = canvas.getBoundingClientRect(); const point = { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) }; const previous = points.at(-1); const context = canvas.getContext('2d'); if (context && previous) { context.beginPath(); context.strokeStyle = '#18181b'; context.lineWidth = 2; context.lineCap = 'round'; context.moveTo(previous.x, previous.y); context.lineTo(point.x, point.y); context.stroke(); } const next = [...points, point]; setPoints(next); onChange(next); } function clear() { const canvas = canvasRef.current; canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height); setPoints([]); onChange([]); } return <div><canvas className="h-36 w-full touch-none rounded-lg border border-zinc-300 bg-white" height={144} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); draw(event); }} onPointerMove={(event) => event.currentTarget.hasPointerCapture(event.pointerId) && draw(event)} onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)} ref={canvasRef} width={900} /><button className="mt-1 text-xs font-semibold text-zinc-600 underline" onClick={clear} type="button">Limpar assinatura</button></div>; }
function formatDate(value: Date | null) { return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(value) : '-'; }
