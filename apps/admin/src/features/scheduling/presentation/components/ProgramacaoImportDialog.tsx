import { useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, FileSpreadsheet, LoaderCircle, Upload, X } from 'lucide-react';
import readXlsxFile from 'read-excel-file/browser';
import type { AppUser, Trip, Vehicle } from '../../../shared/domain/models';
import { parseProgramacaoSheet, type ProgramacaoImportRow } from '../../data/programacaoImport';
import { dailyStatusOptions } from '../programacaoConfig';

type ImportResult = { created: number; failures: Array<{ sourceRow: number; message: string }> };
type ProgramacaoImportDialogProps = {
  drivers: AppUser[];
  existingTrips: Trip[];
  importing: boolean;
  onClose: () => void;
  onImport: (rows: ProgramacaoImportRow[]) => Promise<ImportResult>;
  vehicles: Vehicle[];
};

export function ProgramacaoImportDialog({ drivers, existingTrips, importing, onClose, onImport, vehicles }: ProgramacaoImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ProgramacaoImportRow[]>([]);
  const [error, setError] = useState('');
  const [failures, setFailures] = useState<ImportResult['failures']>([]);
  const [created, setCreated] = useState(0);
  const [reading, setReading] = useState(false);
  const selectedCount = useMemo(() => rows.filter((row) => row.selected).length, [rows]);
  const validCount = useMemo(() => rows.filter((row) => !row.errors.length && !row.duplicate).length, [rows]);

  async function handleFile(file?: File) {
    if (!file) return;
    setError('');
    setFailures([]);
    setCreated(0);
    setReading(true);
    setFileName(file.name);
    try {
      const sheets = await readXlsxFile(file);
      const sheet = sheets.find((item) => item.data.length > 0);
      if (!sheet) throw new Error('A planilha selecionada esta vazia.');
      setRows(parseProgramacaoSheet(sheet.data as Array<Array<string | number | boolean | Date | null>>, drivers, vehicles, existingTrips));
    } catch (cause) {
      setRows([]);
      setError(cause instanceof Error ? cause.message : 'Nao foi possivel ler a planilha.');
    } finally {
      setReading(false);
    }
  }

  function toggleRow(sourceRow: number) {
    setRows((current) => current.map((row) => row.sourceRow === sourceRow ? { ...row, selected: !row.selected } : row));
  }

  async function submit() {
    const selected = rows.filter((row) => row.selected);
    if (!selected.length || importing) return;
    setError('');
    try {
      const result = await onImport(selected);
      setCreated((value) => value + result.created);
      setFailures(result.failures);
      const failedRows = new Set(result.failures.map((item) => item.sourceRow));
      setRows((current) => current.map((row) => row.selected ? { ...row, selected: failedRows.has(row.sourceRow) } : row));
      if (result.created && !result.failures.length) onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao importar a programacao.');
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/50 p-3 sm:p-6" role="presentation">
      <section aria-labelledby="programacao-import-title" aria-modal="true" className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" role="dialog">
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-950" id="programacao-import-title">Importar programacao do Excel</h2>
            <p className="mt-1 text-sm text-zinc-500">Selecione a planilha exportada do Excel Online e revise as viagens antes de gravar.</p>
          </div>
          <button aria-label="Fechar" className="ui-icon-button h-9 w-9 shrink-0" disabled={importing} onClick={onClose} type="button"><X size={18} /></button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-5">
          <div className="flex flex-wrap items-center gap-3">
            <input accept=".xlsx" className="hidden" onChange={(event) => void handleFile(event.target.files?.[0])} ref={inputRef} type="file" />
            <button className="ui-button flex h-10 items-center gap-2 bg-avapex-yellow px-4 text-sm font-semibold text-avapex-black hover:bg-yellow-300 disabled:opacity-60" disabled={reading || importing} onClick={() => inputRef.current?.click()} type="button">
              {reading ? <LoaderCircle className="animate-spin" size={16} /> : <Upload size={16} />}Selecionar arquivo .xlsx
            </button>
            {fileName ? <span className="flex min-w-0 items-center gap-2 text-sm text-zinc-600"><FileSpreadsheet className="shrink-0 text-emerald-700" size={17} /><span className="truncate">{fileName}</span></span> : null}
            {rows.length ? <span className="ml-auto text-sm text-zinc-500">{validCount} validas · {selectedCount} selecionadas · {rows.length} linhas</span> : null}
          </div>

          {error ? <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="mt-0.5 shrink-0" size={16} />{error}</div> : null}
          {created > 0 ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{created} viagem(ns) importada(s).</div> : null}
          {failures.length ? <div className="max-h-24 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{failures.map((failure) => <p key={failure.sourceRow}>Linha {failure.sourceRow}: {failure.message}</p>)}</div> : null}

          {!rows.length && !error ? <button className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-500 hover:border-zinc-400" disabled={reading} onClick={() => inputRef.current?.click()} type="button"><FileSpreadsheet className="text-emerald-700" size={28} />Escolha a planilha diaria de programacao (.xlsx)</button> : null}

          {rows.length ? <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-200">
            <table className="w-full min-w-[1050px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-zinc-100 text-zinc-600"><tr>
                <th className="w-10 px-3 py-2"><span className="sr-only">Importar</span></th><th className="px-3 py-2">Linha / data</th><th className="px-3 py-2">Solicitacao</th><th className="px-3 py-2">Operacao</th><th className="px-3 py-2">Origem / destino</th><th className="px-3 py-2">Motorista</th><th className="px-3 py-2">Veiculo</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Validacao</th>
              </tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((row) => <tr className={row.errors.length || row.duplicate ? 'bg-red-50/50' : ''} key={row.sourceRow}>
                  <td className="px-3 py-2"><input aria-label={`Selecionar linha ${row.sourceRow}`} checked={row.selected} disabled={Boolean(row.errors.length || row.duplicate) || importing} onChange={() => toggleRow(row.sourceRow)} type="checkbox" /></td>
                  <td className="whitespace-nowrap px-3 py-2">{row.sourceRow}<span className="block text-zinc-500">{formatDateTime(row.scheduledAt)}</span></td>
                  <td className="px-3 py-2">{row.customerRequestNumber || '-'}</td>
                  <td className="px-3 py-2">{row.operationType === 'loading' ? 'Carga' : 'Descarga'}</td>
                  <td className="max-w-64 px-3 py-2"><span className="block truncate">{row.origin || '-'}</span><span className="block truncate text-zinc-500">{row.destination || '-'}</span></td>
                  <td className="px-3 py-2">{row.driver?.name || row.driverText || '-'}{!row.driver && row.driverText ? <span className="block text-amber-700">Sem vinculo</span> : null}</td>
                  <td className="px-3 py-2">{row.vehicle?.plate || row.plateText || '-'}{!row.vehicle && row.plateText ? <span className="block text-amber-700">Sem vinculo</span> : null}</td>
                  <td className="max-w-48 px-3 py-2">{dailyStatusOptions.find((option) => option.value === row.statusValue)?.label}</td>
                  <td className="max-w-72 px-3 py-2">{row.errors.map((item) => <span className="block text-red-700" key={item}>{item}</span>)}{row.warnings.map((item) => <span className="block text-amber-700" key={item}>{item}</span>)}{!row.errors.length && !row.warnings.length ? <span className="inline-flex items-center gap-1 text-emerald-700"><Check size={13} />Pronta</span> : null}</td>
                </tr>)}
              </tbody>
            </table>
          </div> : null}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-5 py-4">
          <p className="text-xs text-zinc-500">Linhas com erro ou duplicadas nao podem ser selecionadas.</p>
          <div className="flex gap-2">
            <button className="ui-button h-10 border border-zinc-200 bg-white px-4 text-sm text-zinc-700 hover:bg-zinc-50" disabled={importing} onClick={onClose} type="button">Cancelar</button>
            <button className="ui-button flex h-10 items-center gap-2 bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={!selectedCount || importing || reading} onClick={() => void submit()} type="button">{importing ? <LoaderCircle className="animate-spin" size={16} /> : <Upload size={16} />}Importar {selectedCount || ''} viagens</button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(value);
}
