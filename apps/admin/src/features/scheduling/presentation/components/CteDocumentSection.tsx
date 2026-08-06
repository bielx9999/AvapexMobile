import { Eye, FilePlus2, FileText, Plus, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { openTripCtePdf, validateCtePdf } from '../../data/tripDocumentStorage';
import { emptyCteDraft, type CteDocumentDraft } from './cteDocumentDraft';

type CteDocumentSectionProps = {
  documents: CteDocumentDraft[];
  errors: Record<string, string>;
  onChange: (documents: CteDocumentDraft[]) => void;
};

export function CteDocumentSection({ documents, errors, onChange }: CteDocumentSectionProps) {
  const [fileError, setFileError] = useState('');

  function addDocument() {
    onChange([...documents, emptyCteDraft()]);
  }

  function updateDocument(key: string, update: Partial<CteDocumentDraft>) {
    onChange(documents.map((document) => document.key === key ? { ...document, ...update } : document));
  }

  function selectFile(document: CteDocumentDraft, file?: File) {
    if (!file) {
      return;
    }
    try {
      validateCtePdf(file);
      setFileError('');
      updateDocument(document.key, { file });
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'PDF invalido.');
    }
  }

  async function previewDocument(storagePath: string) {
    try {
      setFileError('');
      await openTripCtePdf(storagePath);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Nao foi possivel abrir o PDF.');
    }
  }

  return (
    <section aria-labelledby="cte-section-title" className="border-t border-zinc-200 px-5 py-5 sm:px-6">
      <SectionHeading
        description="Associe cada numero ao respectivo arquivo PDF."
        icon={<FileText size={18} />}
        title="Documento da viagem"
      />
      <div className="mt-4 space-y-3">
        {documents.map((document, index) => {
          const currentFileName = document.file?.name || document.existing?.fileName || '';
          const currentSize = document.file?.size || document.existing?.sizeBytes || 0;
          return (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4" key={document.key}>
              <div className="flex items-center justify-between gap-3">
                <strong className="text-sm text-zinc-900">CT-e {index + 1}</strong>
                <button
                  aria-label={`Remover CT-e ${index + 1}`}
                  className="ui-icon-button flex h-8 w-8 items-center justify-center text-zinc-500 hover:bg-white hover:text-red-600"
                  onClick={() => onChange(documents.filter((item) => item.key !== document.key))}
                  type="button"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(220px,0.7fr)_minmax(320px,1.3fr)]">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">Numero do CT-e</span>
                  <input
                    aria-invalid={Boolean(errors[`cte-${document.key}`])}
                    className={`ui-input h-11 w-full px-3 ${errors[`cte-${document.key}`] ? 'border-red-500' : ''}`}
                    onChange={(event) => updateDocument(document.key, { number: event.target.value })}
                    placeholder="Ex.: 123456"
                    value={document.number}
                  />
                  {errors[`cte-${document.key}`] ? (
                    <span className="mt-1.5 block text-xs font-medium text-red-600">{errors[`cte-${document.key}`]}</span>
                  ) : null}
                </label>

                {currentFileName ? (
                  <div className="flex min-h-20 items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-700">
                      <FileText size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-900">{currentFileName}</span>
                      <span className="block text-xs text-zinc-500">PDF {currentSize ? `- ${formatBytes(currentSize)}` : ''}</span>
                    </span>
                    {document.existing?.storagePath && !document.file ? (
                      <button
                        className="ui-icon-button flex h-9 w-9 shrink-0 items-center justify-center text-zinc-700 hover:bg-zinc-100"
                        onClick={() => void previewDocument(document.existing!.storagePath)}
                        title="Visualizar documento"
                        type="button"
                      >
                        <Eye size={17} />
                      </button>
                    ) : null}
                    <label className="ui-icon-button flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center text-zinc-700 hover:bg-zinc-100" title="Substituir PDF">
                      <Upload size={17} />
                      <input accept="application/pdf,.pdf" className="sr-only" onChange={(event) => selectFile(document, event.target.files?.[0])} type="file" />
                    </label>
                    <button
                      aria-label="Remover PDF"
                      className="ui-icon-button flex h-9 w-9 shrink-0 items-center justify-center text-zinc-500 hover:bg-red-50 hover:text-red-600"
                      onClick={() => updateDocument(document.key, { existing: document.existing ? { ...document.existing, storagePath: '', fileName: '', contentType: '', sizeBytes: 0 } : null, file: null })}
                      type="button"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ) : (
                  <label
                    className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-4 text-center transition hover:border-zinc-500 hover:bg-zinc-50"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      selectFile(document, event.dataTransfer.files[0]);
                    }}
                  >
                    <FilePlus2 className="text-zinc-500" size={24} />
                    <span className="mt-2 text-sm font-semibold text-zinc-800">Anexar CT-e em PDF</span>
                    <span className="text-xs text-zinc-500">Arraste ou clique aqui - maximo 10 MB</span>
                    <input accept="application/pdf,.pdf" className="sr-only" onChange={(event) => selectFile(document, event.target.files?.[0])} type="file" />
                  </label>
                )}
              </div>
            </div>
          );
        })}
        {fileError ? <p className="text-xs font-medium text-red-600">{fileError}</p> : null}
        <button className="ui-button h-10 gap-2 border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50" onClick={addDocument} type="button">
          <Plus size={16} />
          Adicionar CT-e
        </button>
      </div>
    </section>
  );
}

function SectionHeading({ description, icon, title }: { description: string; icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-900 text-white">{icon}</span>
      <div>
        <h3 className="text-sm font-semibold text-zinc-950" id="cte-section-title">{title}</h3>
        <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
      </div>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
