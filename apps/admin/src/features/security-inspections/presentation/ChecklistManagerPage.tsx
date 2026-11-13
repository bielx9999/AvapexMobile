import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { inspectionSections as defaultSections, inspectionModelStorageKey, loadInspectionSections, type InspectionSections } from '../data/inspectionChecklistConfig';


export function ChecklistManagerPage({ hideHeaderActions = false }: { hideHeaderActions?: boolean }) {
  const [sections, setSections] = useState<InspectionSections>(() => loadInspectionSections());
  const [activeSection, setActiveSection] = useState(Object.keys(sections)[0] ?? '');
  const [newItem, setNewItem] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [saved, setSaved] = useState(false);
  const items = useMemo(() => sections[activeSection] ?? [], [activeSection, sections]);

  useEffect(() => {
    const reset = () => resetModel();
    const save = () => saveModel();
    const addCategory = () => {
      setShowCategoryForm(true);
      window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-checklist-new-category]')?.focus(), 0);
    };
    window.addEventListener('avapex:reset-checklist', reset);
    window.addEventListener('avapex:save-checklist', save);
    window.addEventListener('avapex:new-checklist-category', addCategory);
    return () => { window.removeEventListener('avapex:reset-checklist', reset); window.removeEventListener('avapex:save-checklist', save); window.removeEventListener('avapex:new-checklist-category', addCategory); };
  });

  function updateItems(nextItems: string[]) { setSections((current) => ({ ...current, [activeSection]: nextItems })); setSaved(false); }
  function addItem() { const item = newItem.trim(); if (!item || items.includes(item)) return; updateItems([...items, item]); setNewItem(''); }
  function renameItem(index: number, value: string) { updateItems(items.map((item, itemIndex) => itemIndex === index ? value : item)); }
  function removeItem(index: number) { updateItems(items.filter((_, itemIndex) => itemIndex !== index)); }
  function addCategory() { const category = newCategory.trim(); if (!category || sections[category]) return; const next = { ...sections, [category]: [] }; setSections(next); setActiveSection(category); setNewCategory(''); setShowCategoryForm(false); setSaved(false); }
  function saveModel() { window.localStorage.setItem(inspectionModelStorageKey, JSON.stringify(sections)); window.dispatchEvent(new StorageEvent('storage', { key: inspectionModelStorageKey, newValue: JSON.stringify(sections) })); setSaved(true); }
  function resetModel() { const defaults = JSON.parse(JSON.stringify(defaultSections)) as InspectionSections; setSections(defaults); setActiveSection(Object.keys(defaults)[0] ?? ''); setSaved(false); }

  return <div className="space-y-5">
    <section className="ui-card overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-zinc-500">Configuração</p>
          <h2 className="mt-1 text-base font-semibold text-zinc-950">Modelo da inspeção de segurança</h2>
        </div>
        {!hideHeaderActions ? <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:shrink-0"><button className="ui-button h-10 flex-1 gap-2 border border-zinc-200 bg-white px-3 text-sm text-zinc-700 sm:flex-none" onClick={resetModel} type="button"><RotateCcw size={16} />Restaurar padrão</button><button className="ui-button h-10 flex-1 gap-2 bg-avapex-yellow px-3 text-sm font-semibold text-avapex-black sm:flex-none" onClick={saveModel} type="button">{saved ? <Check size={16} /> : <Save size={16} />}{saved ? 'Modelo salvo' : 'Salvar modelo'}</button></div> : null}
      </div>
      <div className="border-t border-zinc-200 bg-zinc-50/60">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div><p className="text-sm font-semibold text-zinc-900">Categorias do checklist</p></div>
          {!hideHeaderActions ? <button className="ui-button h-10 w-full gap-2 bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 sm:w-auto" onClick={() => setShowCategoryForm((visible) => !visible)} type="button"><Plus size={16} />Nova categoria</button> : null}
        </div>
        {showCategoryForm ? <div className="flex flex-col gap-2 border-t border-zinc-200 px-4 py-3 sm:flex-row sm:px-5"><input autoFocus data-checklist-new-category className="ui-input h-10 min-w-0 flex-1 px-3 text-sm" onChange={(event) => setNewCategory(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addCategory(); }} placeholder="Nome da categoria" value={newCategory} /><button className="ui-button h-10 gap-2 bg-avapex-yellow px-4 text-sm font-semibold text-avapex-black" onClick={addCategory} type="button"><Check size={16} />Adicionar</button><button className="ui-button h-10 border border-zinc-200 bg-white px-4 text-sm text-zinc-700" onClick={() => { setShowCategoryForm(false); setNewCategory(''); }} type="button">Cancelar</button></div> : null}
        <nav aria-label="Categorias do checklist" className="flex gap-2 overflow-x-auto px-4 pb-4 sm:px-5">{Object.keys(sections).map((section) => <button className={`min-h-10 shrink-0 rounded-md border px-3 text-left text-sm font-medium transition-colors ${section === activeSection ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400'}`} key={section} onClick={() => setActiveSection(section)} type="button">{section}</button>)}</nav>
      </div>
    </section>
    <section className="ui-card p-4 sm:p-5">
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-normal text-zinc-500">Categoria selecionada</p><h3 className="mt-1 text-base font-semibold text-zinc-950">{activeSection || 'Nenhuma categoria'}</h3></div><span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">{items.length} {items.length === 1 ? 'item' : 'itens'}</span></div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row"><input className="ui-input h-11 min-w-0 flex-1 px-3 text-sm" onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addItem(); }} placeholder="Adicionar novo item à categoria" value={newItem} /><button aria-label="Adicionar item" className="ui-button h-11 w-full gap-2 bg-avapex-yellow text-avapex-black sm:w-auto sm:px-4" onClick={addItem} title="Adicionar item" type="button"><Plus size={18} /><span>Adicionar item</span></button></div>
      <div className="mt-4 space-y-2">{items.map((item, index) => <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-2" key={`${item}-${index}`}><input aria-label={`Editar item ${index + 1}`} className="ui-input h-10 min-w-0 flex-1 border-transparent px-2 text-sm focus:border-zinc-400" onChange={(event) => renameItem(index, event.target.value)} value={item} /><button aria-label={`Remover item ${item}`} className="ui-icon-button h-10 w-10 shrink-0 border-transparent text-zinc-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600" onClick={() => removeItem(index)} title="Remover item" type="button"><Trash2 size={17} /></button></div>)}{!items.length ? <p className="rounded-lg border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500">Nenhum item nesta categoria.</p> : null}</div>
    </section>
  </div>;
}
