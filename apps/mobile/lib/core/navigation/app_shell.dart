import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/checklists/presentation/checklists_page.dart';
import '../../features/trips/presentation/driver_home_page.dart';
import '../../features/users/application/user_providers.dart';
import '../providers/firebase_providers.dart';

const _sidebarBackground = Color(0xFF1F1C1C);
const _sidebarForeground = Colors.white;
const _sidebarSelected = Color(0xFFFACC15);

enum _AppSection {
  trips(
    label: 'Viagens',
    title: 'Minhas viagens',
    icon: Icons.route_outlined,
    selectedIcon: Icons.route,
  ),
  checklists(
    label: 'Checklists',
    title: 'Checklists',
    icon: Icons.fact_check_outlined,
    selectedIcon: Icons.fact_check,
  ),
  incidents(
    label: 'Ocorrencias',
    title: 'Ocorrencias',
    icon: Icons.report_problem_outlined,
    selectedIcon: Icons.report_problem,
  ),
  receipts(
    label: 'Comprovantes',
    title: 'Comprovantes',
    icon: Icons.receipt_long_outlined,
    selectedIcon: Icons.receipt_long,
  ),
  fueling(
    label: 'Registrar abastecimento',
    title: 'Registrar abastecimento',
    icon: Icons.local_gas_station_outlined,
    selectedIcon: Icons.local_gas_station,
  ),
  profile(
    label: 'Perfil',
    title: 'Perfil',
    icon: Icons.person_outline,
    selectedIcon: Icons.person,
  );

  const _AppSection({
    required this.label,
    required this.title,
    required this.icon,
    required this.selectedIcon,
  });

  final String label;
  final String title;
  final IconData icon;
  final IconData selectedIcon;
}

final class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key});

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

final class _AppShellState extends ConsumerState<AppShell> {
  var _selectedIndex = 0;
  var _isRailExpanded = true;

  _AppSection get _selectedSection => _AppSection.values[_selectedIndex];

  void _selectSection(int index) {
    setState(() => _selectedIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    final isWide = MediaQuery.sizeOf(context).width >= 760;

    if (!isWide) {
      return Scaffold(
        appBar: AppBar(title: Text(_selectedSection.title)),
        drawer: _AppDrawer(
          selectedIndex: _selectedIndex,
          onSelect: (index) {
            Navigator.of(context).pop();
            _selectSection(index);
          },
        ),
        body: _SectionBody(section: _selectedSection),
      );
    }

    return Scaffold(
      body: Row(
        children: [
          _AppNavigationRail(
            selectedIndex: _selectedIndex,
            isExpanded: _isRailExpanded,
            onToggleExpanded: () {
              setState(() => _isRailExpanded = !_isRailExpanded);
            },
            onSelect: _selectSection,
          ),
          const VerticalDivider(width: 1),
          Expanded(
            child: Scaffold(
              appBar: AppBar(title: Text(_selectedSection.title)),
              body: _SectionBody(section: _selectedSection),
            ),
          ),
        ],
      ),
    );
  }
}

final class _AppNavigationRail extends ConsumerWidget {
  const _AppNavigationRail({
    required this.selectedIndex,
    required this.isExpanded,
    required this.onToggleExpanded,
    required this.onSelect,
  });

  final int selectedIndex;
  final bool isExpanded;
  final VoidCallback onToggleExpanded;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(currentUserProfileProvider);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
      width: isExpanded ? 256 : 92,
      color: _sidebarBackground,
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
              child: Row(
                children: [
                  IconButton(
                    tooltip: isExpanded ? 'Recolher menu' : 'Expandir menu',
                    onPressed: onToggleExpanded,
                    color: _sidebarForeground,
                    icon: Icon(
                      isExpanded
                          ? Icons.keyboard_double_arrow_left
                          : Icons.keyboard_double_arrow_right,
                    ),
                  ),
                  if (isExpanded) ...[
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Logistica Avapex',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              color: _sidebarForeground,
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (isExpanded)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
                child: profile.when(
                  data: (user) => _ProfileSummary(
                    name: user?.name ?? 'Usuario',
                    email: user?.email ?? '',
                    isOnSidebar: true,
                  ),
                  error: (_, _) => const _ProfileSummary(
                    name: 'Usuario',
                    email: 'Perfil indisponivel',
                    isOnSidebar: true,
                  ),
                  loading: () => const _ProfileSummary(
                    name: 'Carregando...',
                    email: '',
                    isOnSidebar: true,
                  ),
                ),
              ),
            Expanded(
              child: NavigationRail(
                backgroundColor: _sidebarBackground,
                indicatorColor: _sidebarSelected,
                extended: isExpanded,
                minExtendedWidth: 232,
                selectedIndex: selectedIndex,
                onDestinationSelected: onSelect,
                selectedIconTheme: const IconThemeData(
                  color: _sidebarBackground,
                ),
                unselectedIconTheme: const IconThemeData(
                  color: _sidebarForeground,
                ),
                selectedLabelTextStyle: const TextStyle(
                  color: _sidebarForeground,
                  fontWeight: FontWeight.w800,
                ),
                unselectedLabelTextStyle: const TextStyle(
                  color: _sidebarForeground,
                ),
                labelType: isExpanded
                    ? NavigationRailLabelType.none
                    : NavigationRailLabelType.all,
                destinations: [
                  for (final section in _AppSection.values)
                    NavigationRailDestination(
                      icon: Icon(section.icon),
                      selectedIcon: Icon(section.selectedIcon),
                      label: Text(section.label),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: isExpanded
                  ? OutlinedButton.icon(
                      onPressed: () =>
                          ref.read(authRepositoryProvider).signOut(),
                      icon: const Icon(Icons.logout),
                      label: const Text('Sair'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: _sidebarForeground,
                        side: const BorderSide(color: _sidebarForeground),
                      ),
                    )
                  : IconButton.outlined(
                      tooltip: 'Sair',
                      onPressed: () =>
                          ref.read(authRepositoryProvider).signOut(),
                      icon: const Icon(Icons.logout),
                      color: _sidebarForeground,
                      style: IconButton.styleFrom(
                        side: const BorderSide(color: _sidebarForeground),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

final class _AppDrawer extends ConsumerWidget {
  const _AppDrawer({required this.selectedIndex, required this.onSelect});

  final int selectedIndex;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(currentUserProfileProvider);

    return Drawer(
      backgroundColor: _sidebarBackground,
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: profile.when(
                data: (user) => _ProfileSummary(
                  name: user?.name ?? 'Usuario',
                  email: user?.email ?? '',
                  isOnSidebar: true,
                ),
                error: (_, _) => const _ProfileSummary(
                  name: 'Usuario',
                  email: 'Perfil indisponivel',
                  isOnSidebar: true,
                ),
                loading: () => const _ProfileSummary(
                  name: 'Carregando...',
                  email: '',
                  isOnSidebar: true,
                ),
              ),
            ),
            const Divider(height: 1, color: Color(0xFF3A3535)),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(vertical: 8),
                itemCount: _AppSection.values.length,
                itemBuilder: (context, index) {
                  final section = _AppSection.values[index];
                  final selected = selectedIndex == index;
                  return ListTile(
                    selected: selected,
                    selectedTileColor: _sidebarSelected,
                    iconColor: _sidebarForeground,
                    textColor: _sidebarForeground,
                    selectedColor: Colors.black,
                    leading: Icon(
                      selected ? section.selectedIcon : section.icon,
                    ),
                    title: Text(section.label),
                    onTap: () => onSelect(index),
                  );
                },
              ),
            ),
            const Divider(height: 1, color: Color(0xFF3A3535)),
            ListTile(
              iconColor: _sidebarForeground,
              textColor: _sidebarForeground,
              leading: const Icon(Icons.logout),
              title: const Text('Sair'),
              onTap: () => ref.read(authRepositoryProvider).signOut(),
            ),
          ],
        ),
      ),
    );
  }
}

final class _ProfileSummary extends StatelessWidget {
  const _ProfileSummary({
    required this.name,
    required this.email,
    this.isOnSidebar = false,
  });

  final String name;
  final String email;
  final bool isOnSidebar;

  @override
  Widget build(BuildContext context) {
    final foreground = isOnSidebar ? _sidebarForeground : null;
    final avatarBackground = isOnSidebar
        ? _sidebarSelected
        : Theme.of(context).colorScheme.primaryContainer;
    final avatarForeground = isOnSidebar
        ? _sidebarBackground
        : Theme.of(context).colorScheme.onPrimaryContainer;

    return Row(
      children: [
        CircleAvatar(
          backgroundColor: avatarBackground,
          child: Icon(Icons.person_outline, color: avatarForeground),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: foreground,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (email.isNotEmpty)
                Text(
                  email,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: foreground),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

final class _SectionBody extends StatelessWidget {
  const _SectionBody({required this.section});

  final _AppSection section;

  @override
  Widget build(BuildContext context) {
    return switch (section) {
      _AppSection.trips => const DriverHomePage(),
      _AppSection.checklists => const ChecklistsPage(),
      _AppSection.incidents => const _ComingSoonPage(
        icon: Icons.report_problem_outlined,
        title: 'Ocorrencias',
        message: 'Registros de avarias, atrasos e despesas entram nesta area.',
      ),
      _AppSection.receipts => const _ComingSoonPage(
        icon: Icons.receipt_long_outlined,
        title: 'Comprovantes',
        message:
            'Comprovantes de entrega e documentos digitalizados ficarao aqui.',
      ),
      _AppSection.fueling => const _ComingSoonPage(
        icon: Icons.local_gas_station_outlined,
        title: 'Registrar abastecimento',
        message:
            'O registro de abastecimentos da viagem sera feito nesta area.',
      ),
      _AppSection.profile => const _ProfilePage(),
    };
  }
}

final class _ComingSoonPage extends StatelessWidget {
  const _ComingSoonPage({
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 14),
            Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}

final class _ProfilePage extends ConsumerWidget {
  const _ProfilePage();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(currentUserProfileProvider);

    return profile.when(
      data: (user) => ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: _ProfileSummary(
                name: user?.name ?? 'Usuario',
                email: user?.email ?? '',
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: ListTile(
              leading: const Icon(Icons.badge_outlined),
              title: const Text('Tipo de acesso'),
              subtitle: Text(user?.role.value ?? 'indisponivel'),
            ),
          ),
          Card(
            child: ListTile(
              leading: const Icon(Icons.verified_user_outlined),
              title: const Text('Status'),
              subtitle: Text(user?.status.value ?? 'indisponivel'),
            ),
          ),
        ],
      ),
      error: (error, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text('Falha ao carregar perfil: $error'),
        ),
      ),
      loading: () => const Center(child: CircularProgressIndicator()),
    );
  }
}
