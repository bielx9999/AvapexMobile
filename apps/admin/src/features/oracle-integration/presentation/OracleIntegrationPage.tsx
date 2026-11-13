import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Database, LoaderCircle, Network, Search, ShieldCheck } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../core/firebase/firebaseConfig';

type ConnectionResult = { connected: boolean; checkedAt: string };
type OracleVehicle = { vehicle: string; prefix: string; plate: string; description: string; typeDescription: string };
type OracleDriver = { name: string; fullName: string; nickname: string; jobCode: string; code: string; license: string; licenseExpiration: string; identity: string; licenseNumber: string; licenseCategory: string; phone: string; neighborhood: string; city: string; address: string; state: string };
type ConnectionState = { kind: 'idle' } | { kind: 'success'; checkedAt: string } | { kind: 'error'; message: string; code?: string };

export function OracleIntegrationPage() {
  const [state, setState] = useState<ConnectionState>({ kind: 'idle' });
  const [checking, setChecking] = useState(false);
  const [vehicles, setVehicles] = useState<OracleVehicle[]>([]);
  const [vehiclesLoaded, setVehiclesLoaded] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [vehicleError, setVehicleError] = useState('');
  const [query, setQuery] = useState('');
  const [recordType, setRecordType] = useState<'vehicles' | 'drivers'>('vehicles');
  const [drivers, setDrivers] = useState<OracleDriver[]>([]);
  const [driversLoaded, setDriversLoaded] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [driverError, setDriverError] = useState('');
  const visibleVehicles = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return normalized ? vehicles.filter((vehicle) => [vehicle.prefix, vehicle.plate, vehicle.description, vehicle.typeDescription].join(' ').toLocaleLowerCase('pt-BR').includes(normalized)) : vehicles;
  }, [query, vehicles]);
  const visibleDrivers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return normalized ? drivers.filter((driver) => Object.values(driver).join(' ').toLocaleLowerCase('pt-BR').includes(normalized)) : drivers;
  }, [drivers, query]);

  async function checkConnection() {
    setChecking(true);
    setState({ kind: 'idle' });
    try {
      const call = httpsCallable<void, ConnectionResult>(functions, 'testOracleConnection');
      const result = await call();
      setState({ kind: 'success', checkedAt: result.data.checkedAt });
    } catch (cause) {
      const error = cause as { code?: string; message?: string; details?: { oracleCode?: string } };
      setState({ kind: 'error', message: error.message || 'Nao foi possivel verificar a conexao.', code: error.details?.oracleCode ?? error.code });
    } finally {
      setChecking(false);
    }
  }

  async function loadVehicles() {
    setLoadingVehicles(true);
    setVehicleError('');
    try {
      const call = httpsCallable<void, { vehicles: OracleVehicle[]; limited: boolean }>(functions, 'listOracleVehicles');
      const result = await call();
      setVehicles(result.data.vehicles);
      setVehiclesLoaded(true);
    } catch (cause) {
      const error = cause as { code?: string; message?: string; details?: { oracleCode?: string } };
      const code = error.details?.oracleCode ?? error.code;
      setVehicleError(`${error.message || 'Falha ao consultar veiculos.'}${code ? ` (${code})` : ''}`);
    } finally {
      setLoadingVehicles(false);
    }
  }

  async function loadDrivers() {
    setLoadingDrivers(true);
    setDriverError('');
    try {
      const call = httpsCallable<void, { drivers: OracleDriver[]; limited: boolean }>(functions, 'listOracleDrivers');
      const result = await call();
      setDrivers(result.data.drivers);
      setDriversLoaded(true);
    } catch (cause) {
      const error = cause as { code?: string; message?: string; details?: { oracleCode?: string } };
      const code = error.details?.oracleCode ?? error.code;
      setDriverError(`${error.message || 'Falha ao consultar motoristas.'}${code ? ` (${code})` : ''}`);
    } finally {
      setLoadingDrivers(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="ui-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-zinc-200 p-5 sm:flex-row sm:items-center">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-800"><Database size={22} /></div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-zinc-950">Conexao com Oracle</h2>
            <p className="mt-1 text-sm text-zinc-600">Acesso de consulta ao banco corporativo, por uma conexao segura no servidor.</p>
          </div>
          <button className="ui-button flex h-10 shrink-0 items-center justify-center gap-2 bg-avapex-yellow px-4 text-sm font-semibold text-avapex-black hover:bg-yellow-300 disabled:cursor-wait disabled:opacity-60" disabled={checking} onClick={() => void checkConnection()} type="button">
            {checking ? <LoaderCircle className="animate-spin" size={16} /> : <Network size={16} />}{checking ? 'Testando conexao' : 'Testar conexao'}
          </button>
        </div>

        {state.kind === 'success' ? <div className="flex items-start gap-3 border-b border-zinc-200 bg-emerald-50 px-5 py-4 text-emerald-800"><CheckCircle2 className="mt-0.5 shrink-0" size={19} /><div><p className="text-sm font-semibold">Conexao com Oracle confirmada</p><p className="mt-1 text-xs">Teste executado em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(state.checkedAt))}.</p></div></div> : null}
        {state.kind === 'error' ? <div className="flex items-start gap-3 border-b border-zinc-200 bg-red-50 px-5 py-4 text-red-800"><AlertCircle className="mt-0.5 shrink-0" size={19} /><div><p className="text-sm font-semibold">A conexao ainda nao foi confirmada</p><p className="mt-1 text-sm">{state.message}</p>{state.code ? <p className="mt-1 text-xs">Codigo: {state.code}</p> : null}</div></div> : null}

        <div className="grid gap-0 divide-y divide-zinc-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="p-5"><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-900"><ShieldCheck size={16} />Credenciais protegidas</div><p className="text-sm leading-6 text-zinc-600">Usuario e senha Oracle ficam armazenados como segredos do Firebase Functions e nao sao enviados ao navegador.</p></div>
          <div className="p-5"><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-900"><Database size={16} />Proxima etapa</div><p className="text-sm leading-6 text-zinc-600">Depois que o acesso de rede e validado, identificaremos as tabelas e colunas de veiculos e motoristas para ligar os cadastros ao sistema.</p></div>
        </div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2" role="tablist" aria-label="Cadastros Oracle">
            <button aria-selected={recordType === 'vehicles'} className={`ui-button h-9 px-3 text-sm ${recordType === 'vehicles' ? 'bg-zinc-900 font-semibold text-white' : 'border border-zinc-200 bg-white text-zinc-700'}`} onClick={() => { setRecordType('vehicles'); setQuery(''); }} role="tab" type="button">Veiculos</button>
            <button aria-selected={recordType === 'drivers'} className={`ui-button h-9 px-3 text-sm ${recordType === 'drivers' ? 'bg-zinc-900 font-semibold text-white' : 'border border-zinc-200 bg-white text-zinc-700'}`} onClick={() => { setRecordType('drivers'); setQuery(''); }} role="tab" type="button">Motoristas</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {recordType === 'vehicles' && vehiclesLoaded ? <span className="text-xs text-zinc-500">{visibleVehicles.length} de {vehicles.length}</span> : null}
            {recordType === 'drivers' && driversLoaded ? <span className="text-xs text-zinc-500">{visibleDrivers.length} de {drivers.length}</span> : null}
            <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} /><input aria-label={`Buscar ${recordType === 'vehicles' ? 'veiculo' : 'motorista'} Oracle`} className="ui-input h-9 w-full pl-9 pr-3 text-sm sm:w-56" placeholder={recordType === 'vehicles' ? 'Prefixo, placa, descricao' : 'Nome, codigo, CNH, cidade'} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            {recordType === 'vehicles' ? <button className="ui-button h-9 bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60" disabled={loadingVehicles} onClick={() => void loadVehicles()} type="button">{loadingVehicles ? 'Consultando...' : vehiclesLoaded ? 'Atualizar lista' : 'Consultar veiculos'}</button> : <button className="ui-button h-9 bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60" disabled={loadingDrivers} onClick={() => void loadDrivers()} type="button">{loadingDrivers ? 'Consultando...' : driversLoaded ? 'Atualizar lista' : 'Consultar motoristas'}</button>}
          </div>
        </div>
        {recordType === 'vehicles' && vehicleError ? <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle className="mt-0.5 shrink-0" size={16} />{vehicleError}</div> : null}
        {recordType === 'drivers' && driverError ? <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle className="mt-0.5 shrink-0" size={16} />{driverError}</div> : null}
        {recordType === 'vehicles' && !vehiclesLoaded && !loadingVehicles ? <p className="px-4 py-8 text-center text-sm text-zinc-500">Consulte para carregar os veiculos cadastrados no banco da empresa.</p> : null}
        {recordType === 'drivers' && !driversLoaded && !loadingDrivers ? <p className="px-4 py-8 text-center text-sm text-zinc-500">Consulte para carregar os motoristas cadastrados no banco da empresa.</p> : null}
        {(recordType === 'vehicles' ? loadingVehicles : loadingDrivers) ? <p className="px-4 py-8 text-center text-sm text-zinc-500">Consultando o Oracle...</p> : null}
        {recordType === 'vehicles' && vehiclesLoaded && !loadingVehicles ? <div className="max-h-[60vh] overflow-auto"><table className="ui-table min-w-[760px]"><thead className="sticky top-0 z-10 bg-zinc-50"><tr><th>Veiculo</th><th>Prefixo</th><th>Placa</th><th>Descricao</th><th>Tipo / descricao TF</th></tr></thead><tbody>{visibleVehicles.map((vehicle, index) => <tr key={`${vehicle.vehicle}-${vehicle.plate}-${index}`}><td>{vehicle.vehicle || '-'}</td><td className="font-medium">{vehicle.prefix || '-'}</td><td>{vehicle.plate || '-'}</td><td>{vehicle.description || '-'}</td><td>{vehicle.typeDescription || '-'}</td></tr>)}{!visibleVehicles.length ? <tr><td className="py-8 text-center text-zinc-500" colSpan={5}>{vehicles.length ? 'Nenhum veiculo corresponde a busca.' : 'Nenhum veiculo retornado pela view.'}</td></tr> : null}</tbody></table></div> : null}
        {recordType === 'drivers' && driversLoaded && !loadingDrivers ? <div className="max-h-[60vh] overflow-auto"><table className="ui-table min-w-[1500px]"><thead className="sticky top-0 z-10 bg-zinc-50"><tr><th>Codigo</th><th>Nome</th><th>Nome completo</th><th>Apelido</th><th>Funcao</th><th>Habilitacao</th><th>Validade CNH</th><th>RG</th><th>CNH</th><th>Categoria</th><th>Telefone</th><th>Bairro</th><th>Cidade</th><th>Endereco</th><th>UF</th></tr></thead><tbody>{visibleDrivers.map((driver, index) => <tr key={`${driver.code}-${index}`}><td>{driver.code || '-'}</td><td>{driver.name || '-'}</td><td>{driver.fullName || '-'}</td><td>{driver.nickname || '-'}</td><td>{driver.jobCode || '-'}</td><td>{driver.license || '-'}</td><td>{formatOracleDate(driver.licenseExpiration)}</td><td>{driver.identity || '-'}</td><td>{driver.licenseNumber || '-'}</td><td>{driver.licenseCategory || '-'}</td><td>{driver.phone || '-'}</td><td>{driver.neighborhood || '-'}</td><td>{driver.city || '-'}</td><td>{driver.address || '-'}</td><td>{driver.state || '-'}</td></tr>)}{!visibleDrivers.length ? <tr><td className="py-8 text-center text-zinc-500" colSpan={15}>{drivers.length ? 'Nenhum motorista corresponde a busca.' : 'Nenhum motorista retornado pela view.'}</td></tr> : null}</tbody></table></div> : null}
      </section>
    </div>
  );
}

function formatOracleDate(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('pt-BR').format(date);
}
