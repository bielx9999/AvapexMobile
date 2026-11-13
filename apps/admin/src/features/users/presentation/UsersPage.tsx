import { ChangeEvent, FormEvent, type ReactNode, useMemo, useState } from 'react';
import { Ban, Download, FileSpreadsheet, KeyRound, LoaderCircle, Pencil, Plus, Search, Trash2, Upload, UserCheck, X } from 'lucide-react';
import { adminUserRepository } from '../data/adminUserRepository';
import { analyzeUserWorkbook, displayImportCpf, type UserImportAnalysis } from '../data/userImport';
import type { AppUser, UserRole, UserStatus } from '../../shared/domain/models';
import { ActionIconButton, EmptyState, ErrorBanner } from '../../shared/presentation/ui';
import { formatCpf, isValidCpf } from '../../shared/utils/cpf';

type UsersPageProps = {
  users: AppUser[];
  loading: boolean;
  currentUid: string;
  onChanged: () => Promise<void>;
};

const initialForm = {
  name: '',
  email: '',
  cpf: '',
  phone: '',
  password: '',
  role: 'driver' as UserRole,
  status: 'active' as UserStatus,
  cnhNumber: '',
  cnhCategory: '',
  cnhExpirationDate: '',
};

export function UsersPage({ users, loading, currentUid, onChanged }: UsersPageProps) {
  const [form, setForm] = useState(initialForm);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyUid, setBusyUid] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users.filter((user) =>
      (roleFilter === 'all' || user.role === roleFilter) && (!normalized || [user.name, user.email, user.cpf, user.phone, user.role, user.status]
        .join(' ')
        .toLowerCase()
        .includes(normalized)),
    );
  }, [query, roleFilter, users]);

  async function handleSubmitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (editingUser) {
        await adminUserRepository.updateUser({
          uid: editingUser.uid,
          name: form.name,
          cpf: form.cpf,
          phone: form.phone,
          role: form.role,
          status: form.status,
          cnhNumber: form.cnhNumber,
          cnhCategory: form.cnhCategory,
          cnhExpirationDate: form.cnhExpirationDate,
        });
      } else {
        await adminUserRepository.createUser(form);
      }
      setForm(initialForm);
      setShowCreateForm(false);
      setEditingUser(null);
      await onChanged();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Erro ao salvar usuario.');
    } finally {
      setSubmitting(false);
    }
  }

  async function runUserAction(uid: string, action: () => Promise<void>) {
    setBusyUid(uid);
    setError('');

    try {
      await action();
      await onChanged();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Erro ao executar acao.');
    } finally {
      setBusyUid('');
    }
  }

  function closeCreateForm() {
    if (submitting) {
      return;
    }
    setShowCreateForm(false);
    setEditingUser(null);
    setForm(initialForm);
  }

  function openCreateForm() {
    setForm(initialForm);
    setEditingUser(null);
    setShowCreateForm(true);
  }

  function downloadTemplate() {
    const rows = [
      ['NOME', 'EMAIL', 'CPF', 'TELEFONE', 'PERFIL', 'SENHA', 'CNH NUMERO', 'CNH CATEGORIA', 'CNH VALIDADE'],
      ['Joao Motorista', 'joao@avapex.com.br', '390.533.447-05', '11999990000', 'Motorista', 'Senha123', '12345678900', 'E', '31/12/2028'],
      ['Maria Operacional', 'maria@avapex.com.br', '529.982.247-25', '11988880000', 'Administrativo', 'Senha123', '', '', ''],
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo-importacao-usuarios.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function openEditForm(user: AppUser) {
    setForm({
      name: user.name,
      email: user.email,
      cpf: formatCpf(user.cpf ?? ''),
      phone: user.phone,
      password: '',
      role: user.role,
      status: user.status,
      cnhNumber: user.cnh?.number ?? '',
      cnhCategory: user.cnh?.category ?? '',
      cnhExpirationDate: formatDateInput(user.cnh?.expirationDate ?? null),
    });
    setEditingUser(user);
    setShowCreateForm(true);
  }

  return (
    <div className="space-y-5">
      <ErrorBanner message={error} />

      <section className="ui-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-zinc-500">{filteredUsers.length} usuarios encontrados</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              className="ui-button flex h-10 items-center justify-center gap-2 border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              onClick={downloadTemplate}
              type="button"
            >
              <Download size={17} />
              Baixar modelo
            </button>
            <button
              className="ui-button flex h-10 items-center justify-center gap-2 border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              onClick={() => setShowImportModal(true)}
              type="button"
            >
              <Upload size={17} />
              Importar planilha
            </button>
            <button
              className="ui-button flex h-10 items-center justify-center gap-2 bg-avapex-yellow px-4 text-sm font-semibold text-avapex-black hover:bg-yellow-300"
              onClick={openCreateForm}
              type="button"
            >
              <Plus size={18} />
              Novo Usuario
            </button>
            <select aria-label="Filtrar por perfil" className="ui-input h-10 px-3 text-sm" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as 'all' | UserRole)}>
              <option value="all">Todos os perfis</option>
              <option value="admin">Administrativo</option>
              <option value="driver">Motorista</option>
            </select>
            <label className="relative block sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                className="ui-input h-10 w-full pl-10 pr-3 text-sm"
                placeholder="Buscar usuario"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="ui-table min-w-[900px]">
            <thead>
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">CPF</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Criado em</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.uid}>
                  <td className="px-4 py-3 font-medium">{user.name || '-'}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">{user.cpf ? formatCpf(user.cpf) : '-'}</td>
                  <td className="px-4 py-3">{user.phone || '-'}</td>
                  <td className="px-4 py-3">{user.role === 'admin' ? 'Administrativo' : 'Motorista'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`ui-pill ${
                        user.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {user.status === 'active' ? 'Ativo' : 'Bloqueado'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {user.uid === currentUid ? (
                        <span className="ui-pill bg-zinc-100 text-zinc-600">Voce</span>
                      ) : null}
                      <ActionIconButton
                        label="Editar usuario"
                        disabled={busyUid === user.uid}
                        onClick={() => openEditForm(user)}
                      >
                        <Pencil size={17} />
                      </ActionIconButton>
                      <ActionIconButton
                        label="Enviar redefinicao de senha"
                        disabled={busyUid === user.uid}
                        onClick={() =>
                          void runUserAction(
                            user.uid,
                            () => adminUserRepository.sendPasswordReset(user),
                          )
                        }
                      >
                        <KeyRound size={17} />
                      </ActionIconButton>
                      <ActionIconButton
                        label={user.status === 'active' ? 'Bloquear usuario' : 'Ativar usuario'}
                        disabled={busyUid === user.uid || user.uid === currentUid}
                        onClick={() =>
                          void runUserAction(
                            user.uid,
                            () => adminUserRepository.setStatus(user.uid, user.status === 'active' ? 'inactive' : 'active'),
                          )
                        }
                      >
                        {user.status === 'active' ? <Ban size={17} /> : <UserCheck size={17} />}
                      </ActionIconButton>
                      <ActionIconButton
                        danger
                        label="Excluir cadastro"
                        disabled={busyUid === user.uid || user.uid === currentUid}
                        onClick={() => {
                          const confirmed = window.confirm(
                            'Excluir o cadastro do Firestore? A conta no Firebase Auth so sera removida quando configurarmos Cloud Functions.',
                          );
                          if (!confirmed) {
                            return;
                          }
                          void runUserAction(
                            user.uid,
                            () => adminUserRepository.deleteProfile(user.uid),
                          );
                        }}
                      >
                        <Trash2 size={17} />
                      </ActionIconButton>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && filteredUsers.length === 0 ? (
                <tr>
                  <td className="p-0" colSpan={8}>
                    <EmptyState description="Nao existem usuarios correspondentes aos filtros atuais." title="Nenhum usuario encontrado" />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {showCreateForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-[1px]">
          <section className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">{editingUser ? 'Editar Usuario' : 'Novo Usuario'}</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {editingUser ? 'Atualize dados operacionais do cadastro.' : 'Cadastro por email e senha, sem acesso Google obrigatorio.'}
                </p>
              </div>
              <button
                aria-label="Fechar cadastro"
                className="ui-icon-button flex h-9 w-9 shrink-0 items-center justify-center border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                onClick={closeCreateForm}
                type="button"
              >
                <X size={18} />
              </button>
            </header>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmitUser}>
              <div className="space-y-5 overflow-y-auto bg-white p-5">
                <FormTopic title="Dados pessoais">
                  <TextField
                    label="Nome e sobrenome"
                    value={form.name}
                    onChange={(value) => setForm((current) => ({ ...current, name: value }))}
                    required
                  />
                  <TextField
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={(value) => setForm((current) => ({ ...current, email: value }))}
                    readOnly={Boolean(editingUser)}
                    required
                  />
                  <TextField
                    label="CPF"
                    value={form.cpf}
                    onChange={(value) => setForm((current) => ({ ...current, cpf: formatCpf(value) }))}
                    required
                    error={form.cpf && !isValidCpf(form.cpf) ? 'CPF invalido.' : ''}
                  />
                  <TextField
                    label="Telefone"
                    value={form.phone}
                    onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
                  />
                </FormTopic>

                <FormTopic title="Acesso">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-zinc-700">Tipo de usuario</span>
                    <select
                      className="ui-input h-11 w-full px-3"
                      value={form.role}
                      onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))}
                    >
                      <option value="driver">Motorista</option>
                      <option value="admin">Administrativo</option>
                    </select>
                  </label>
                  {!editingUser ? (
                    <TextField
                      label="Senha provisoria"
                      type="password"
                      minLength={6}
                      value={form.password}
                      onChange={(value) => setForm((current) => ({ ...current, password: value }))}
                      required
                    />
                  ) : null}
                  {editingUser ? (
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-zinc-700">Status</span>
                      <select
                        className="ui-input h-11 w-full px-3"
                        disabled={editingUser.uid === currentUid}
                        value={form.status}
                        onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as UserStatus }))}
                      >
                        <option value="active">Ativo</option>
                        <option value="inactive">Bloqueado</option>
                      </select>
                    </label>
                  ) : null}
                </FormTopic>

                {form.role === 'driver' ? (
                  <FormTopic title="CNH">
                    <TextField
                      label="Numero CNH"
                      value={form.cnhNumber}
                      onChange={(value) => setForm((current) => ({ ...current, cnhNumber: value }))}
                      required
                    />
                    <TextField
                      label="Categoria CNH"
                      value={form.cnhCategory}
                      onChange={(value) => setForm((current) => ({ ...current, cnhCategory: value }))}
                      required
                    />
                    <TextField
                      label="Validade CNH"
                      type="date"
                      value={form.cnhExpirationDate}
                      onChange={(value) => setForm((current) => ({ ...current, cnhExpirationDate: value }))}
                      required
                    />
                  </FormTopic>
                ) : null}
              </div>

              <footer className="flex flex-col-reverse gap-2 border-t border-zinc-200 bg-white px-5 py-4 sm:flex-row sm:justify-end">
                <button
                  className="ui-button h-11 border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                  disabled={submitting}
                  onClick={closeCreateForm}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="ui-button flex h-11 items-center justify-center gap-2 bg-avapex-yellow px-5 text-sm font-semibold text-avapex-black hover:bg-yellow-300"
                  disabled={submitting}
                  type="submit"
                >
                  <Plus size={18} />
                  {submitting ? 'Salvando...' : editingUser ? 'Salvar alteracoes' : 'Criar usuario'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {showImportModal ? (
        <UserImportModal
          users={users}
          onClose={() => setShowImportModal(false)}
          onImported={async () => {
            setShowImportModal(false);
            await onChanged();
          }}
        />
      ) : null}
    </div>
  );
}

function UserImportModal({
  users,
  onClose,
  onImported,
}: {
  users: AppUser[];
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const [analysis, setAnalysis] = useState<UserImportAnalysis | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const validRows = analysis?.rows.filter((row) => row.issues.length === 0 && row.role) ?? [];

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    setAnalysis(null);
    try {
      setAnalysis(await analyzeUserWorkbook(file, users));
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'Nao foi possivel ler a planilha.');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  }

  async function importRows() {
    if (!validRows.length) {
      setError('A planilha precisa ter ao menos um usuario valido para importar.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await adminUserRepository.importUsers(validRows.map((row) => ({
        name: row.name,
        email: row.email,
        cpf: row.cpf,
        phone: row.phone,
        password: row.password,
        role: row.role!,
        cnhNumber: row.cnhNumber,
        cnhCategory: row.cnhCategory,
        cnhExpirationDate: row.cnhExpirationDate,
      })));
      await onImported();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Erro ao importar usuarios.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-[1px]">
      <section aria-modal="true" className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" role="dialog">
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">Importar usuarios por planilha</h2>
          </div>
          <button aria-label="Fechar importacao" className="ui-icon-button flex h-9 w-9 shrink-0 items-center justify-center border-zinc-300 text-zinc-700 hover:bg-zinc-50" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <ErrorBanner message={error} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-600">Perfis aceitos: Motorista ou Administrativo. CPF e e-mail nao podem repetir.</p>
            <label className="ui-button h-11 cursor-pointer gap-2 border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              {loading ? <LoaderCircle className="animate-spin" size={17} /> : <FileSpreadsheet size={17} />}
              {loading ? 'Lendo planilha...' : analysis ? 'Escolher outro arquivo' : 'Selecionar planilha'}
              <input accept=".xlsx,.xls,.csv" className="sr-only" disabled={loading || saving} onChange={selectFile} type="file" />
            </label>
          </div>

          {!analysis ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center">
              <FileSpreadsheet className="mx-auto text-zinc-400" size={30} />
              <p className="mt-3 text-sm font-medium text-zinc-800">Selecione a planilha preenchida</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <ImportMetric label="Linhas lidas" value={analysis.totalRows} tone="neutral" />
                <ImportMetric label="Prontas para importar" value={analysis.validRows} tone="success" />
                <ImportMetric label="Com pendencia" value={analysis.invalidRows} tone={analysis.invalidRows ? 'warning' : 'neutral'} />
                <ImportMetric label="Duplicadas" value={analysis.duplicateRows} tone={analysis.duplicateRows ? 'danger' : 'neutral'} />
              </div>
              <div className="overflow-hidden rounded-xl border border-zinc-200">
                <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{analysis.fileName}</p>
                  </div>
                  <span className="text-sm font-semibold text-zinc-700">{validRows.length} usuario(s)</span>
                </div>
                <div className="max-h-72 overflow-auto">
                  <table className="ui-table min-w-[980px]">
                    <thead>
                      <tr>
                        <th>Linha</th>
                        <th>Nome</th>
                        <th>Email</th>
                        <th>CPF</th>
                        <th>Perfil</th>
                        <th>CNH</th>
                        <th>Situacao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.rows.map((row) => (
                        <tr key={row.sourceRow}>
                          <td>{row.sourceRow}</td>
                          <td className="font-semibold">{row.name || '-'}</td>
                          <td>{row.email || '-'}</td>
                          <td>{displayImportCpf(row.cpf)}</td>
                          <td>{row.role === 'admin' ? 'Administrativo' : row.role === 'driver' ? 'Motorista' : '-'}</td>
                          <td>{row.role === 'driver' ? [row.cnhNumber, row.cnhCategory, row.cnhExpirationDate].filter(Boolean).join(' | ') || '-' : '-'}</td>
                          <td>
                            {row.issues.length ? (
                              <span className="text-sm text-red-700">{row.issues.join('; ')}</span>
                            ) : (
                              <span className="text-sm font-medium text-emerald-700">Pronto para importar</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <footer className="border-t border-zinc-200 px-5 py-4">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="ui-button h-10 border border-zinc-300 bg-white px-4 text-sm font-medium" disabled={saving} onClick={onClose} type="button">
              Cancelar
            </button>
            <button
              className="ui-button h-10 gap-2 bg-avapex-yellow px-4 text-sm font-semibold text-avapex-black disabled:opacity-50"
              disabled={!analysis || validRows.length === 0 || saving}
              onClick={() => void importRows()}
              type="button"
            >
              {saving ? <LoaderCircle className="animate-spin" size={16} /> : <Upload size={16} />}
              Importar {validRows.length} usuario(s)
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function ImportMetric({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const colors = {
    neutral: 'border-zinc-200 bg-zinc-50 text-zinc-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-red-200 bg-red-50 text-red-800',
  };
  return (
    <div className={`rounded-lg border p-3 ${colors[tone]}`}>
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
  readOnly?: boolean;
  error?: string;
};

function TextField({ label, value, onChange, type = 'text', required, minLength, readOnly, error }: TextFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zinc-700">{label}</span>
      <input
        className={`ui-input h-11 w-full px-3 ${error ? 'border-red-500' : ''}`}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        minLength={minLength}
        readOnly={readOnly}
      />
      {error ? <span className="mt-1.5 block text-xs font-medium text-red-600">{error}</span> : null}
    </label>
  );
}

type FormTopicProps = {
  title: string;
  children: ReactNode;
};

function FormTopic({ title, children }: FormTopicProps) {
  return (
    <section className="border-b border-zinc-200 pb-5 last:border-0 last:pb-0">
      <h3 className="mb-4 text-sm font-semibold text-zinc-900">{title}</h3>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function formatDate(value: Date | null) {
  if (!value) {
    return '-';
  }
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value);
}

function formatDateInput(value: Date | null) {
  if (!value) {
    return '';
  }
  return value.toISOString().slice(0, 10);
}
