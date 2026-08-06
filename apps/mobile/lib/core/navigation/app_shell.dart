import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_flutter/lucide_flutter.dart';

import '../../features/checklists/application/checklist_providers.dart';
import '../../features/checklists/presentation/checklists_page.dart';
import '../../features/deliveries/application/delivery_providers.dart';
import '../../features/deliveries/data/models/delivery_model.dart';
import '../../features/driver/presentation/driver_home_page.dart';
import '../../features/driver/presentation/driver_notifications_page.dart';
import '../../features/fueling/presentation/driver_performance_page.dart';
import '../../features/fueling/presentation/fueling_page.dart';
import '../../features/incidents/presentation/incidents_page.dart';
import '../../features/media/application/media_providers.dart';
import '../../features/profile/presentation/profile_page.dart';
import '../../features/receipts/presentation/delivery_receipts_page.dart';
import '../../features/trips/application/trip_providers.dart';
import '../../features/trips/data/models/trip_model.dart';
import '../../features/trips/presentation/driver_trips_page.dart';

enum _DriverRootSection { home, trips, alerts, profile }

final class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key});

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

final class _AppShellState extends ConsumerState<AppShell>
    with WidgetsBindingObserver {
  var _selectedIndex = _DriverRootSection.home.index;
  Timer? _mediaSyncTimer;
  var _isSyncingMedia = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_syncPendingMedia());
    _mediaSyncTimer = Timer.periodic(
      const Duration(minutes: 1),
      (_) => unawaited(_syncPendingMedia()),
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(_syncPendingMedia());
    }
  }

  Future<void> _syncPendingMedia() async {
    if (_isSyncingMedia) {
      return;
    }
    _isSyncingMedia = true;
    try {
      await ref.read(mediaUploadServiceProvider).flushPendingUploads();
    } on Object {
      // The queue keeps failed items for the next connectivity window.
    } finally {
      _isSyncingMedia = false;
    }
  }

  @override
  void dispose() {
    _mediaSyncTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _selectRoot(_DriverRootSection section) {
    setState(() => _selectedIndex = section.index);
  }

  void _handleHomeAction(DriverHomeAction action) {
    switch (action) {
      case DriverHomeAction.trips:
        _selectRoot(_DriverRootSection.trips);
      case DriverHomeAction.alerts:
        _selectRoot(_DriverRootSection.alerts);
      case DriverHomeAction.profile:
        _selectRoot(_DriverRootSection.profile);
      case DriverHomeAction.assignedTrips:
        _openFeature(
          title: 'Viagens atribuidas',
          child: const DriverTripsPage(assignedOnly: true, showHeader: false),
        );
      case DriverHomeAction.checklists:
        _openFeature(title: 'Checklist', child: const ChecklistsPage());
      case DriverHomeAction.receipts:
        _openFeature(
          title: 'Comprovantes',
          child: const DeliveryReceiptsPage(),
        );
      case DriverHomeAction.incidents:
        _openFeature(title: 'Ocorrencias', child: const IncidentsPage());
      case DriverHomeAction.fueling:
        _openFeature(
          title: 'Registrar abastecimento',
          child: const FuelingPage(),
        );
      case DriverHomeAction.performance:
        _openFeature(
          title: 'Minha Media',
          child: const DriverPerformancePage(),
        );
    }
  }

  Future<void> _openFeature({required String title, required Widget child}) {
    return Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => Scaffold(
          appBar: AppBar(title: Text(title)),
          body: SafeArea(top: false, child: child),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(tripGpsHeartbeatControllerProvider);
    final alertCount = _driverAlertCount(ref);

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: IndexedStack(
          index: _selectedIndex,
          children: [
            DriverHomePage(onAction: _handleHomeAction),
            const DriverTripsPage(),
            DriverNotificationsPage(onAction: _handleHomeAction),
            const ProfilePage(),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (index) {
          setState(() => _selectedIndex = index);
        },
        destinations: [
          const NavigationDestination(
            icon: Icon(LucideIcons.house),
            selectedIcon: Icon(LucideIcons.house, fill: 1),
            label: 'Inicio',
          ),
          const NavigationDestination(
            icon: Icon(LucideIcons.route),
            selectedIcon: Icon(LucideIcons.route, fill: 1),
            label: 'Viagens',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: alertCount > 0,
              label: Text(alertCount > 9 ? '9+' : '$alertCount'),
              child: const Icon(LucideIcons.bell),
            ),
            selectedIcon: Badge(
              isLabelVisible: alertCount > 0,
              label: Text(alertCount > 9 ? '9+' : '$alertCount'),
              child: const Icon(LucideIcons.bellRing),
            ),
            label: 'Avisos',
          ),
          const NavigationDestination(
            icon: Icon(LucideIcons.userRound),
            selectedIcon: Icon(LucideIcons.userRoundCheck),
            label: 'Perfil',
          ),
        ],
      ),
    );
  }
}

int _driverAlertCount(WidgetRef ref) {
  final trips = ref.watch(currentDriverTripsProvider).value ?? const <Trip>[];
  final deliveries =
      ref.watch(currentDriverDeliveriesProvider).value ?? const [];
  final checklists = ref.watch(checklistHistoryProvider).value ?? const [];
  final activeOrNext = trips.where(
    (trip) =>
        trip.status == TripStatus.inProgress ||
        trip.status == TripStatus.pending,
  );
  final assignedCount = trips
      .where(
        (trip) =>
            trip.driverResponse == DriverTripResponse.pending &&
            trip.status != TripStatus.completed &&
            trip.status != TripStatus.cancelled,
      )
      .length;
  final pendingProofCount = deliveries.where((delivery) {
    return delivery.status != DeliveryStatus.cancelled &&
        (delivery.proofStatus == DeliveryProofStatus.rejected ||
            (delivery.status == DeliveryStatus.arrived &&
                delivery.proofStatus == DeliveryProofStatus.pending));
  }).length;
  final checklistPending =
      activeOrNext.isNotEmpty &&
      !checklists.any((checklist) => checklist.tripId == activeOrNext.first.id);
  return assignedCount + pendingProofCount + (checklistPending ? 1 : 0);
}
