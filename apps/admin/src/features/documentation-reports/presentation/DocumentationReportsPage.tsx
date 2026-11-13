import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, File, FileText, Folder, LogIn, LogOut, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { factories, models, service } from 'powerbi-client';
import type { AccountInfo } from '@azure/msal-browser';
import { acquirePowerBiToken, isMicrosoftConfigured, listOneDriveItems, microsoftAccount, microsoftConfig, microsoftUserLabel, powerBiEmbedUrl, signInMicrosoft, signOutMicrosoft, type CloudItem } from '../data/microsoftIntegration';
import { EmptyState, ErrorBanner } from '../../shared/presentation/ui';

const powerBiService = new service.Service(factories.hpmFactory, factories.wpmpFactory, factories.routerFactory);

type View = 'onedrive' | 'powerbi';

export function DocumentationReportsPage({ view }: { view: View }) {
  const [account, setAccount] = useState<AccountInfo | undefined>(microsoftAccount());
  const [error, setError] = useState('');
  const configured = isMicrosoftConfigured();

  async function connect() {
    setError('');
    try {
      setAccount(await signInMicrosoft());
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Nao foi possivel conectar a conta Microsoft.');
    }
  }

  async function disconnect() {
    setError('');
    try {
      await signOutMicrosoft();
      setAccount(undefined);
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Nao foi possivel sair da conta Microsoft.');
    }
  }

  return (
    <div className="ui-page-stack">
      <ErrorBanner message={error} />
      <section className="ui-card flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-yellow-50 text-yellow-700"><ShieldCheck size={20} /></span>
          <div><h2 className="font-semibold text-zinc-950">Central Microsoft</h2></div>
        </div>
        {account ? <div className="flex items-center gap-2"><span className="max-w-[240px] truncate text-sm text-zinc-600" title={account.username}>{microsoftUserLabel(account)}</span><button className="ui-button h-10 gap-2 border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50" onClick={() => void disconnect()} type="button"><LogOut size={16} />Sair</button></div> : <button className="ui-button h-10 gap-2 bg-avapex-yellow px-4 text-sm font-semibold text-avapex-black hover:bg-yellow-300" disabled={!configured} onClick={() => void connect()} type="button"><LogIn size={16} />Conectar Microsoft</button>}
      </section>
      {!configured ? <section className="ui-error"><ShieldCheck className="mt-0.5 shrink-0" size={17} /><span>As integracoes ainda nao foram configuradas. Preencha as variaveis Microsoft no arquivo `.env` do painel para liberar esta area.</span></section> : null}
      {view === 'onedrive' ? <OneDrivePanel account={account} onConnect={() => void connect()} onError={setError} /> : <PowerBiPanel account={account} onConnect={() => void connect()} onError={setError} />}
    </div>
  );
}

function OneDrivePanel({ account, onConnect, onError }: { account?: AccountInfo; onConnect: () => void; onError: (message: string) => void }) {
  const [items, setItems] = useState<CloudItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const filteredItems = useMemo(() => items.filter((item) => item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [items, search]);

  const loadItems = useCallback(async () => {
    setLoading(true); onError('');
    try { setItems(await listOneDriveItems()); } catch (loadError) { onError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar os documentos.'); } finally { setLoading(false); }
  }, [onError]);
  useEffect(() => {
    if (!account) return;
    const timeoutId = window.setTimeout(() => void loadItems(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [account, loadItems]);

  if (!account) return <section className="ui-card"><EmptyState title="Conecte sua conta Microsoft" description="A pasta compartilhada da equipe sera exibida aqui apos a autenticacao." action={<button className="ui-button h-10 gap-2 bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800" onClick={onConnect} type="button"><LogIn size={16} />Entrar para acessar</button>} /></section>;
  return <section className="ui-card overflow-hidden"><div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 md:flex-row md:items-center md:justify-between"><div><h2 className="font-semibold text-zinc-950">Pasta da equipe</h2><p className="mt-1 text-sm text-zinc-500">{microsoftConfig.oneDriveRootFolderId ? 'Conteudo da pasta configurada no OneDrive.' : 'Arquivos recentes do seu OneDrive.'}</p></div><div className="flex gap-2"><label className="relative"><Search className="absolute left-3 top-2.5 text-zinc-400" size={16} /><input aria-label="Buscar documento" className="ui-input h-10 w-full pl-9 pr-3 text-sm sm:w-64" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar documento" value={search} /></label><button aria-label="Atualizar documentos" className="ui-icon-button h-10 w-10 border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50" onClick={() => void loadItems()} title="Atualizar documentos" type="button"><RefreshCw className={loading ? 'animate-spin' : ''} size={16} /></button></div></div><div className="divide-y divide-zinc-100">{filteredItems.map((item) => <a className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50" href={item.webUrl} key={item.id} rel="noreferrer" target="_blank"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">{item.isFolder ? <Folder size={17} /> : item.name.toLocaleLowerCase().endsWith('.pdf') ? <FileText size={17} /> : <File size={17} />}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-zinc-900">{item.name}</strong><span className="text-xs text-zinc-500">{item.isFolder ? 'Pasta' : `${formatBytes(item.size)} - atualizado ${formatDate(item.lastModifiedDateTime)}`}</span></span><ExternalLink className="shrink-0 text-zinc-400" size={16} /></a>)}{!loading && !filteredItems.length ? <EmptyState title="Nenhum arquivo encontrado" description="Ajuste a busca ou verifique o conteudo da pasta no OneDrive." /> : null}</div></section>;
}

function PowerBiPanel({ account, onConnect, onError }: { account?: AccountInfo; onConnect: () => void; onError: (message: string) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const container = hostRef.current;
    let active = true;
    async function embed() {
      if (!account || !powerBiEmbedUrl() || !microsoftConfig.powerBiReportId || !container) return;
      setLoading(true); onError('');
      try {
        const token = await acquirePowerBiToken();
        if (!active) return;
        powerBiService.reset(container);
        powerBiService.embed(container, { type: 'report', id: microsoftConfig.powerBiReportId, embedUrl: powerBiEmbedUrl(), accessToken: token, tokenType: models.TokenType.Aad, permissions: models.Permissions.Read, settings: { panes: { filters: { visible: false }, pageNavigation: { visible: true } }, navContentPaneEnabled: true, filterPaneEnabled: false } });
      } catch (embedError) { onError(embedError instanceof Error ? embedError.message : 'Nao foi possivel carregar o painel Power BI.'); } finally { if (active) setLoading(false); }
    }
    void embed();
    return () => { active = false; if (container) powerBiService.reset(container); };
  }, [account, onError]);

  if (!microsoftConfig.powerBiReportId || !powerBiEmbedUrl()) return <section className="ui-card"><EmptyState title="Power BI ainda nao configurado" description="Informe o ID do relatorio e, opcionalmente, o workspace no arquivo `.env` do painel." /></section>;
  if (!account) return <section className="ui-card"><EmptyState title="Conecte sua conta Microsoft" description="O relatorio sera aberto com o acesso que sua conta possui no Power BI." action={<button className="ui-button h-10 gap-2 bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800" onClick={onConnect} type="button"><LogIn size={16} />Entrar para acessar</button>} /></section>;
  return <section className="ui-card overflow-hidden"><div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3"><div><h2 className="font-semibold text-zinc-950">Painel Power BI</h2></div>{loading ? <span className="text-sm text-zinc-500">Carregando...</span> : null}</div><div className="h-[min(72vh,820px)] min-h-[520px] bg-zinc-50" ref={hostRef} /></section>;
}

function formatBytes(value?: number) { if (value === undefined) return 'Tamanho nao informado'; if (value < 1024) return `${value} B`; if (value < 1024 ** 2) return `${Math.round(value / 1024)} KB`; return `${(value / 1024 ** 2).toFixed(1)} MB`; }
function formatDate(value?: string) { return value ? new Intl.DateTimeFormat('pt-BR').format(new Date(value)) : 'data nao informada'; }
