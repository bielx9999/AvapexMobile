import { useState, type ReactNode } from 'react';
import {
  Bell,
  ChevronDown,
  ClipboardCheck,
  Database,
  FileCheck2,
  Fuel,
  LogOut,
  MapPinned,
  MapPin,
  Menu,
  Navigation,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
  Truck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import avapexLogo from '../../../assets/images/avapex_transportes_logo.png';
import { logoutAdmin, type AdminSession } from '../../auth/data/authRepository';

export type AdminPage = 'scheduling' | 'route-planner' | 'routes' | 'checklists' | 'receipts' | 'fueling' | 'users' | 'vehicles' | 'localities';

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
      { icon: MapPinned, key: 'routes', label: 'Rotas' },
      { icon: ClipboardCheck, key: 'checklists', label: 'Checklists' },
      { icon: FileCheck2, key: 'receipts', label: 'Comprovantes' },
      { icon: Fuel, key: 'fueling', label: 'Abastecimento' },
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
];

type AdminShellProps = {
  activePage: AdminPage;
  category: string;
  children: ReactNode;
  description: string;
  headerActions?: ReactNode;
  onNavigate: (page: AdminPage) => void;
  session: AdminSession;
  title: string;
};

export function AdminShell({
  activePage,
  category,
  children,
  description,
  headerActions,
  onNavigate,
  session,
  title,
}: AdminShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const initials = getInitials(session.profile.name || session.firebaseUser.email || 'A');

  function handleNavigate(page: AdminPage) {
    onNavigate(page);
    setMobileMenuOpen(false);
  }

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col">
      <div className={`flex h-16 shrink-0 items-center border-b border-white/10 ${sidebarCollapsed ? 'justify-center px-3' : 'px-5'}`}>
        {sidebarCollapsed ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-avapex-yellow text-xs font-black text-avapex-black">
            AV
          </span>
        ) : (
          <img alt="Avapex Transportes" className="h-8 w-auto object-contain" src={avapexLogo} />
        )}
      </div>

      <nav aria-label="Navegacao principal" className={`min-h-0 flex-1 overflow-y-auto py-4 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
        <div className="space-y-5">
          {navSections.map((section) => {
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
            {initials}
          </span>
          {!sidebarCollapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{session.profile.name || 'Administrador'}</p>
              <p className="truncate text-xs text-zinc-500">{session.firebaseUser.email}</p>
            </div>
          ) : null}
        </div>
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
                <p className="hidden truncate text-sm text-zinc-500 xl:block">{description}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerActions}
              <button aria-label="Notificacoes" className="ui-icon-button h-9 w-9 border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950" title="Notificacoes" type="button">
                <Bell size={17} />
              </button>
              <span className="hidden h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white sm:flex" title={session.profile.name || session.firebaseUser.email || 'Administrador'}>
                {initials}
              </span>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1920px] px-4 py-5 sm:px-6 sm:py-6">
          {children}
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
