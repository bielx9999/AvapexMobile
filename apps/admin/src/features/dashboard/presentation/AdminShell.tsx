import { useEffect, useState, type ReactNode } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { firestore } from '../../../core/firebase/firebaseConfig';
import {
  Bell,
  ChevronDown,
  ClipboardCheck,
  Boxes,
  Database,
  ListChecks,
  FileCheck2,
  FolderOpen,
  ShieldCheck,
  BarChart3,
  Fuel,
  Gauge,
  LogOut,
  MapPin,
  Menu,
  Navigation,
  PanelLeftClose,
  PanelLeftOpen,
  PackageCheck,
  Route,
  Settings2,
  Truck,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import avapexLogo from '../../../assets/images/avapex_transportes_logo.png';
import avapexMinimalLogo from '../../../assets/images/avapex_minimal_logo.png';
import { logoutAdmin, type AdminSession } from '../../auth/data/authRepository';
import { AppSettingsPage } from '../../settings/presentation/AppSettingsPage';
import { fontFamilies, fontScales, type AppFontFamily, type AppFontScale } from '../../settings/appAppearance';

export type AdminPage =
  | 'scheduling'
  | 'route-planner'
  | 'deliveries'
  | 'checklists'
  | 'security-inspections'
  | 'equipment-checklists'
  | 'receipts'
  | 'fueling'
  | 'equipment'
  | 'users'
  | 'vehicles'
  | 'light-vehicles'
  | 'light-vehicle-checklists'
  | 'light-vehicle-maintenance'
  | 'localities'
  | 'onedrive'
  | 'powerbi'
  | 'app-settings';

type NavSection = {
  icon: LucideIcon;
  items: Array<{ icon: LucideIcon; key: AdminPage; label: string }>;
  label: string;
};

const navSections: NavSection[] = [
  {
    icon: Route,
    label: 'Operacao',
    items: [
      { icon: Route, key: 'scheduling', label: 'Programacao' },
      { icon: Navigation, key: 'route-planner', label: 'Roteirizador' },
      { icon: ListChecks, key: 'deliveries', label: 'Gestao de Entregas' },
      { icon: FileCheck2, key: 'receipts', label: 'Comprovantes' },
      { icon: Fuel, key: 'fueling', label: 'Abastecimento' },
      { icon: Boxes, key: 'equipment', label: 'Equipamentos' },
    ],
  },
  {
    icon: ClipboardCheck,
    label: 'CheckLists',
    items: [
      { icon: ClipboardCheck, key: 'checklists', label: 'Checklists operacionais' },
      { icon: ShieldCheck, key: 'security-inspections', label: 'Inspecoes de seguranca' },
      { icon: PackageCheck, key: 'equipment-checklists', label: 'Checklist de equipamentos' },
    ],
  },
  {
    icon: Database,
    label: 'Cadastros',
    items: [
      { icon: Users, key: 'users', label: 'Usuarios' },
      { icon: Truck, key: 'vehicles', label: 'Veiculos' },
      { icon: MapPin, key: 'localities', label: 'Localidades' },
    ],
  },
  {
    icon: FolderOpen,
    label: 'Documentacao',
    items: [
      { icon: FolderOpen, key: 'onedrive', label: 'OneDrive' },
      { icon: BarChart3, key: 'powerbi', label: 'Power BI' },
    ],
  },
  {
    icon: Gauge,
    label: 'Veiculos leves',
    items: [
      { icon: ClipboardCheck, key: 'light-vehicle-checklists', label: 'Checklist semanal' },
      { icon: Wrench, key: 'light-vehicle-maintenance', label: 'Revisoes por km' },
    ],
  },
];

type AdminShellProps = {
  activePage: AdminPage;
  category: string;
  children: ReactNode;
  headerActions?: ReactNode;
  onNavigate: (page: AdminPage) => void;
  session: AdminSession;
  title: string;
};

export function AdminShell({
  activePage,
  category,
  children,
  headerActions,
  onNavigate,
  session,
  title,
}: AdminShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [hiddenPages, setHiddenPages] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState(session.profile.photoUrl || session.firebaseUser.photoURL || '');
  const [fontFamily, setFontFamily] = useState<AppFontFamily>('inter');
  const [fontScale, setFontScale] = useState<AppFontScale>(100);
  const [settingsError, setSettingsError] = useState('');
  const [savingMenu, setSavingMenu] = useState(false);
  const [savingAppearance, setSavingAppearance] = useState(false);

  useEffect(() => onSnapshot(doc(firestore, 'users', session.firebaseUser.uid), (snapshot) => {
    const data = snapshot.data();
    const value: unknown = data?.hiddenAdminPages;
    setHiddenPages(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
    setPhotoUrl(typeof data?.photoUrl === 'string' ? data.photoUrl : session.profile.photoUrl || session.firebaseUser.photoURL || '');
    setFontFamily(fontFamilies.some((item) => item.value === data?.adminFontFamily) ? data?.adminFontFamily as AppFontFamily : 'inter');
    setFontScale(fontScales.includes(data?.adminFontScale as AppFontScale) ? data?.adminFontScale as AppFontScale : 100);
  }, () => setSettingsError('Nao foi possivel carregar as configuracoes do aplicativo.')), [session.firebaseUser.uid, session.profile.photoUrl, session.firebaseUser.photoURL]);

  useEffect(() => {
    document.documentElement.dataset.adminFont = fontFamily;
    document.documentElement.style.fontSize = `${fontScale}%`;
    return () => {
      delete document.documentElement.dataset.adminFont;
      document.documentElement.style.removeProperty('font-size');
    };
  }, [fontFamily, fontScale]);

  async function togglePage(page: AdminPage) {
    const next = hiddenPages.includes(page) ? hiddenPages.filter((item) => item !== page) : [...hiddenPages, page];
    setSavingMenu(true);
    setSettingsError('');
    try {
      await updateDoc(doc(firestore, 'users', session.firebaseUser.uid), { hiddenAdminPages: next });
    } catch {
      setSettingsError('Nao foi possivel salvar as preferencias do menu.');
    } finally {
      setSavingMenu(false);
    }
  }

  async function saveAppearance(nextFont: AppFontFamily, nextScale: AppFontScale) {
    setSavingAppearance(true);
    setSettingsError('');
    try {
      await updateDoc(doc(firestore, 'users', session.firebaseUser.uid), {
        adminFontFamily: nextFont,
        adminFontScale: nextScale,
      });
      setFontFamily(nextFont);
      setFontScale(nextScale);
    } catch {
      setSettingsError('Nao foi possivel salvar a fonte.');
    } finally {
      setSavingAppearance(false);
    }
  }

  const initials = getInitials(session.profile.name || session.firebaseUser.email || 'A');

  function handleNavigate(page: AdminPage) {
    onNavigate(page);
    setMobileMenuOpen(false);
  }

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col">
      <div className={`flex h-20 shrink-0 items-center border-b border-white/10 ${sidebarCollapsed ? 'justify-center px-3' : 'justify-center px-6'}`}>
        {sidebarCollapsed ? (
          <img
            alt="Avapex"
            className="h-11 w-11 rounded-xl object-cover"
            src={avapexMinimalLogo}
          />
        ) : (
          <img
            alt="Avapex Transportes"
            className="h-12 w-auto max-w-[180px] object-contain"
            src={avapexLogo}
          />
        )}
      </div>

      <nav aria-label="Navegacao principal" className={`ui-scrollbar-dark min-h-0 flex-1 overflow-y-auto py-4 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
        <div className="space-y-5">
          {navSections.map((originalSection) => {
            const section = { ...originalSection, items: originalSection.items.filter((item) => !hiddenPages.includes(item.key)) };
            if (!section.items.length) return null;
            const SectionIcon = section.icon;
            const isSectionCollapsed = collapsedSections[section.label] ?? false;
            const hasActiveItem = section.items.some((item) => item.key === activePage);

            if (sidebarCollapsed) {
              return (
                <div className="space-y-1 border-b border-white/10 pb-4 last:border-0" key={section.label}>
                  {section.items.map((item) => (
                    <NavItem
                      active={item.key === activePage}
                      collapsed
                      icon={item.icon}
                      key={item.key}
                      label={item.label}
                      onClick={() => handleNavigate(item.key)}
                    />
                  ))}
                </div>
              );
            }

            return (
              <section key={section.label}>
                <button
                  aria-expanded={!isSectionCollapsed}
                  className="mb-1 flex h-8 w-full items-center justify-between rounded-md px-2 text-xs font-semibold uppercase text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-zinc-200"
                  onClick={() =>
                    setCollapsedSections((current) => ({
                      ...current,
                      [section.label]: !isSectionCollapsed,
                    }))
                  }
                  type="button"
                >
                  <span className="flex items-center gap-2">
                    <SectionIcon className={hasActiveItem ? 'text-avapex-yellow' : ''} size={14} />
                    {section.label}
                  </span>
                  <ChevronDown className={`transition-transform ${isSectionCollapsed ? '-rotate-90' : ''}`} size={14} />
                </button>

                <div className={`grid transition-[grid-template-rows,opacity] duration-200 ${isSectionCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}>
                  <div className="min-h-0 overflow-hidden">
                    <div className="space-y-1">
                      {section.items.map((item) => (
                        <NavItem
                          active={item.key === activePage}
                          icon={item.icon}
                          key={item.key}
                          label={item.label}
                          onClick={() => handleNavigate(item.key)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </nav>

      <div className={`shrink-0 border-t border-white/10 py-3 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
        <div className={`mb-2 flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3 px-2 py-2'}`} title={session.firebaseUser.email ?? undefined}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-avapex-yellow text-xs font-bold text-avapex-black">
            {photoUrl ? <img alt="" className="h-full w-full rounded-lg object-cover" src={photoUrl} /> : initials}
          </span>
          {!sidebarCollapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{session.profile.name || 'Administrador'}</p>
              <p className="truncate text-xs text-zinc-500">{session.firebaseUser.email}</p>
            </div>
          ) : null}
        </div>
        <NavItem
          active={activePage === 'app-settings'}
          collapsed={sidebarCollapsed}
          icon={Settings2}
          label="Configurações"
          onClick={() => handleNavigate('app-settings')}
        />
        <button
          aria-label="Sair"
          className={`ui-button h-10 text-sm text-zinc-300 hover:bg-white/[0.08] hover:text-white ${sidebarCollapsed ? 'w-full px-0' : 'w-full justify-start gap-3 px-3'}`}
          onClick={() => void logoutAdmin()}
          title="Sair"
          type="button"
        >
          <LogOut size={17} />
          {!sidebarCollapsed ? 'Sair' : null}
        </button>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-canvas text-avapex-ink">
      <aside className={`fixed inset-y-0 left-0 z-40 hidden border-r border-white/10 bg-avapex-black text-white transition-[width] duration-200 lg:block ${sidebarCollapsed ? 'w-[76px]' : 'w-64'}`}>
        {sidebar}
        <button
          aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          className="ui-icon-button absolute -right-4 top-20 h-8 w-8 border-zinc-200 bg-white text-zinc-600 shadow-sm hover:bg-zinc-50 hover:text-zinc-950"
          onClick={() => setSidebarCollapsed((current) => !current)}
          title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          type="button"
        >
          {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </aside>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Fechar menu" className="absolute inset-0 bg-black/45" onClick={() => setMobileMenuOpen(false)} type="button" />
          <aside className="relative h-full w-[min(88vw,280px)] bg-avapex-black text-white shadow-2xl">
            {sidebar}
            <button aria-label="Fechar menu" className="ui-icon-button absolute right-3 top-3 h-9 w-9 border-white/10 bg-white/[0.06] text-white hover:bg-white/10" onClick={() => setMobileMenuOpen(false)} type="button">
              <X size={18} />
            </button>
          </aside>
        </div>
      ) : null}

      <section className={`min-w-0 transition-[padding] duration-200 ${sidebarCollapsed ? 'lg:pl-[76px]' : 'lg:pl-64'}`}>
        <header className="sticky top-0 z-30 border-b border-zinc-200/90 bg-white/95 backdrop-blur">
          <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
            <button aria-label="Abrir menu" className="ui-icon-button h-9 w-9 shrink-0 border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 lg:hidden" onClick={() => setMobileMenuOpen(true)} type="button">
              <Menu size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="hidden text-xs font-medium text-zinc-500 sm:block">{category} / {title}</p>
              <div className="flex items-baseline gap-3">
                <h1 className="truncate text-xl font-semibold text-zinc-950">{title}</h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerActions}
              <button aria-label="Notificacoes" className="ui-icon-button h-9 w-9 border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950" title="Notificacoes" type="button">
                <Bell size={17} />
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1920px] px-4 py-5 sm:px-6 sm:py-6">
          {activePage === 'app-settings' ? (
            <AppSettingsPage
              email={session.firebaseUser.email || ''}
              error={settingsError}
              fontFamily={fontFamily}
              fontScale={fontScale}
              hiddenPages={hiddenPages}
              menuSections={navSections}
              name={session.profile.name}
              onAppearanceChange={(family, scale) => void saveAppearance(family, scale)}
              onPhotoChange={setPhotoUrl}
              onSettingsError={setSettingsError}
              onTogglePage={(page) => void togglePage(page)}
              photoUrl={photoUrl}
              savingAppearance={savingAppearance}
              savingMenu={savingMenu}
              uid={session.firebaseUser.uid}
            />
          ) : children}
        </div>
      </section>
    </main>
  );
}

function NavItem({
  active,
  collapsed = false,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  collapsed?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-current={active ? 'page' : undefined}
      className={`group relative flex h-10 w-full items-center text-sm transition-colors ${
        collapsed ? 'justify-center rounded-lg px-0' : 'gap-3 rounded-lg px-3'
      } ${active ? 'bg-white/[0.09] font-medium text-white' : 'text-zinc-400 hover:bg-white/[0.05] hover:text-white'}`}
      onClick={onClick}
      title={collapsed ? label : undefined}
      type="button"
    >
      {active ? <span className="absolute left-0 h-5 w-0.5 rounded-r bg-avapex-yellow" /> : null}
      <Icon className={active ? 'text-avapex-yellow' : 'text-zinc-500 group-hover:text-zinc-300'} size={17} />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </button>
  );
}

function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'AV';
}
