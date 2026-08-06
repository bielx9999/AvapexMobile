import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_flutter/lucide_flutter.dart';

import '../../checklists/application/checklist_providers.dart';
import '../../deliveries/application/delivery_providers.dart';
import '../../deliveries/data/models/delivery_model.dart';
import '../../trips/application/trip_providers.dart';
import '../../trips/data/models/trip_model.dart';
import '../../users/application/user_providers.dart';

enum DriverHomeAction {
  trips,
  assignedTrips,
  checklists,
  receipts,
  incidents,
  fueling,
  performance,
  alerts,
  profile,
}

final class DriverHomePage extends ConsumerWidget {
  const DriverHomePage({required this.onAction, super.key});

  final ValueChanged<DriverHomeAction> onAction;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileState = ref.watch(currentUserProfileProvider);
    final tripState = ref.watch(currentDriverTripsProvider);
    final deliveryState = ref.watch(currentDriverDeliveriesProvider);
    final checklistState = ref.watch(checklistHistoryProvider);
    final profile = profileState.asData?.value;
    final trips = tripState.asData?.value ?? const <Trip>[];
    final deliveries = deliveryState.asData?.value ?? const <Delivery>[];
    final checklists = checklistState.asData?.value ?? const [];

    final inProgress =
        trips.where((trip) => trip.status == TripStatus.inProgress).toList()
          ..sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));
    final assigned =
        trips
            .where(
              (trip) =>
                  trip.driverResponse == DriverTripResponse.pending &&
                  trip.status != TripStatus.completed &&
                  trip.status != TripStatus.cancelled,
            )
            .toList()
          ..sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));
    final acceptedUpcoming =
        trips
            .where(
              (trip) =>
                  trip.status == TripStatus.pending &&
                  trip.driverResponse == DriverTripResponse.accepted,
            )
            .toList()
          ..sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));
    final currentTrip = inProgress.firstOrNull;
    final nextTrip = acceptedUpcoming.firstOrNull ?? assigned.firstOrNull;
    final operationalTrip = currentTrip ?? nextTrip;
    final checklistPending =
        operationalTrip != null &&
        !checklists.any((item) => item.tripId == operationalTrip.id);
    final pendingProofCount = deliveries.where(_needsProofAction).length;
    final notices = <_DriverNotice>[
      if (checklistPending)
        const _DriverNotice(
          icon: LucideIcons.clipboardCheck,
          title: 'Checklist ainda nao realizado',
          action: DriverHomeAction.checklists,
        ),
      if (assigned.isNotEmpty)
        _DriverNotice(
          icon: LucideIcons.calendarCheck,
          title:
              '${assigned.length} nova${assigned.length == 1 ? '' : 's'} viagem${assigned.length == 1 ? '' : 's'} atribuida${assigned.length == 1 ? '' : 's'}',
          action: DriverHomeAction.assignedTrips,
        ),
      if (pendingProofCount > 0)
        _DriverNotice(
          icon: LucideIcons.receiptText,
          title:
              '$pendingProofCount comprovante${pendingProofCount == 1 ? '' : 's'} pendente${pendingProofCount == 1 ? '' : 's'}',
          action: DriverHomeAction.receipts,
        ),
    ];

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(currentDriverTripsProvider);
        ref.invalidate(currentDriverDeliveriesProvider);
        ref.invalidate(checklistHistoryProvider);
        await ref.read(currentDriverTripsProvider.future);
      },
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
            sliver: SliverList.list(
              children: [
                _DriverHeader(
                  name: profile?.name ?? 'Motorista',
                  photoUrl: profile?.photoUrl,
                  onAlerts: () => onAction(DriverHomeAction.alerts),
                  onProfile: () => onAction(DriverHomeAction.profile),
                  alertCount: notices.length,
                ),
                const SizedBox(height: 22),
                Text(
                  currentTrip == null
                      ? 'Sua proxima operacao'
                      : 'Viagem em andamento',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 10),
                _CurrentTripCard(
                  currentTrip: currentTrip,
                  nextTrip: nextTrip,
                  onOpen: () => onAction(
                    currentTrip == null
                        ? DriverHomeAction.assignedTrips
                        : DriverHomeAction.trips,
                  ),
                ),
                if (assigned.isNotEmpty && currentTrip != null) ...[
                  const SizedBox(height: 10),
                  _AssignedTripBanner(
                    trip: assigned.first,
                    count: assigned.length,
                    onTap: () => onAction(DriverHomeAction.assignedTrips),
                  ),
                ],
                const SizedBox(height: 24),
                Text(
                  'O que voce precisa fazer?',
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 12),
                _DriverActionGrid(
                  actions: [
                    _DriverAction(
                      icon: LucideIcons.clipboardCheck,
                      label: 'Checklist',
                      description: checklistPending
                          ? 'Pendente'
                          : 'Inspecao do veiculo',
                      badge: checklistPending ? 1 : 0,
                      highlighted: checklistPending,
                      action: DriverHomeAction.checklists,
                    ),
                    _DriverAction(
                      icon: LucideIcons.calendarCheck,
                      label: 'Viagens atribuidas',
                      description: 'Novas programacoes',
                      badge: assigned.length,
                      action: DriverHomeAction.assignedTrips,
                    ),
                    _DriverAction(
                      icon: LucideIcons.receiptText,
                      label: 'Comprovantes',
                      description: 'Envios da entrega',
                      badge: pendingProofCount,
                      highlighted: pendingProofCount > 0,
                      action: DriverHomeAction.receipts,
                    ),
                    const _DriverAction(
                      icon: LucideIcons.triangleAlert,
                      label: 'Ocorrencias',
                      description: 'Registrar problema',
                      action: DriverHomeAction.incidents,
                    ),
                    const _DriverAction(
                      icon: LucideIcons.fuel,
                      label: 'Abastecimento',
                      description: 'Registrar abastecimento',
                      action: DriverHomeAction.fueling,
                    ),
                    const _DriverAction(
                      icon: LucideIcons.route,
                      label: 'Minhas viagens',
                      description: 'Ativas e historico',
                      action: DriverHomeAction.trips,
                    ),
                    const _DriverAction(
                      icon: LucideIcons.gauge,
                      label: 'Minha Media',
                      description: 'Consumo do veiculo',
                      action: DriverHomeAction.performance,
                    ),
                  ],
                  onAction: onAction,
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Avisos',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    if (notices.isNotEmpty)
                      TextButton(
                        onPressed: () => onAction(DriverHomeAction.alerts),
                        child: const Text('Ver todos'),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                if (notices.isEmpty)
                  const _NoNotices()
                else
                  for (final notice in notices)
                    _NoticeTile(
                      notice: notice,
                      onTap: () => onAction(notice.action),
                    ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

final class _DriverHeader extends StatelessWidget {
  const _DriverHeader({
    required this.name,
    required this.photoUrl,
    required this.onAlerts,
    required this.onProfile,
    required this.alertCount,
  });

  final String name;
  final String? photoUrl;
  final VoidCallback onAlerts;
  final VoidCallback onProfile;
  final int alertCount;

  @override
  Widget build(BuildContext context) {
    final firstName =
        name.trim().split(RegExp(r'\s+')).firstOrNull ?? 'Motorista';
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${_greeting()}, $firstName',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                'Motorista',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: const Color(0xFF666666),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
        Badge(
          isLabelVisible: alertCount > 0,
          label: Text(alertCount > 9 ? '9+' : '$alertCount'),
          child: IconButton.outlined(
            tooltip: 'Avisos',
            onPressed: onAlerts,
            icon: const Icon(LucideIcons.bell),
          ),
        ),
        const SizedBox(width: 10),
        InkWell(
          borderRadius: BorderRadius.circular(24),
          onTap: onProfile,
          child: CircleAvatar(
            radius: 24,
            backgroundColor: const Color(0xFFFACC15),
            foregroundImage: photoUrl == null || photoUrl!.isEmpty
                ? null
                : NetworkImage(photoUrl!),
            child: photoUrl == null || photoUrl!.isEmpty
                ? const Icon(LucideIcons.userRound, color: Color(0xFF111111))
                : null,
          ),
        ),
      ],
    );
  }
}

final class _CurrentTripCard extends StatelessWidget {
  const _CurrentTripCard({
    required this.currentTrip,
    required this.nextTrip,
    required this.onOpen,
  });

  final Trip? currentTrip;
  final Trip? nextTrip;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final trip = currentTrip ?? nextTrip;
    if (trip == null) {
      return Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: const Color(0xFFD9D9D9)),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Row(
          children: [
            Icon(LucideIcons.route, size: 28),
            SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Nenhuma viagem em andamento',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                  SizedBox(height: 4),
                  Text('Novas programacoes aparecerao aqui.'),
                ],
              ),
            ),
          ],
        ),
      );
    }

    final active = currentTrip != null;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF1F1C1C),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: const Color(0xFFFACC15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(LucideIcons.truck, color: Color(0xFF111111)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  active ? trip.progress.label : 'Programada',
                  style: const TextStyle(
                    color: Color(0xFFFACC15),
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Text(
                _formatTime(trip.scheduledAt),
                style: const TextStyle(color: Colors.white70),
              ),
            ],
          ),
          const SizedBox(height: 18),
          _RouteLine(origin: trip.origin, destination: trip.destination),
          const SizedBox(height: 14),
          Wrap(
            spacing: 14,
            runSpacing: 8,
            children: [
              _DarkMeta(
                icon: LucideIcons.truck,
                text: trip.vehiclePlate.isEmpty
                    ? trip.vehicleId
                    : trip.vehiclePlate,
              ),
              if (trip.customerRequestNumber.isNotEmpty)
                _DarkMeta(
                  icon: LucideIcons.fileText,
                  text: trip.customerRequestNumber,
                ),
            ],
          ),
          const SizedBox(height: 18),
          FilledButton.icon(
            onPressed: onOpen,
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFFACC15),
              foregroundColor: const Color(0xFF111111),
            ),
            icon: const Icon(LucideIcons.arrowRight),
            label: Text(active ? 'Ver viagem' : 'Ver programacao'),
          ),
        ],
      ),
    );
  }
}

final class _RouteLine extends StatelessWidget {
  const _RouteLine({required this.origin, required this.destination});

  final String origin;
  final String destination;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 2),
          child: Icon(LucideIcons.mapPin, color: Color(0xFFFACC15), size: 20),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                origin,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 6),
                child: Icon(
                  LucideIcons.arrowDown,
                  color: Colors.white54,
                  size: 18,
                ),
              ),
              Text(
                destination,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

final class _DarkMeta extends StatelessWidget {
  const _DarkMeta({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: Colors.white70, size: 16),
        const SizedBox(width: 6),
        Text(text, style: const TextStyle(color: Colors.white70)),
      ],
    );
  }
}

final class _AssignedTripBanner extends StatelessWidget {
  const _AssignedTripBanner({
    required this.trip,
    required this.count,
    required this.onTap,
  });

  final Trip trip;
  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFFFF7CC),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: const BorderSide(color: Color(0xFFF0C800)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              const Icon(LucideIcons.calendarCheck),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$count viagem${count == 1 ? '' : 's'} atribuida${count == 1 ? '' : 's'}',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${trip.origin} -> ${trip.destination}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const Icon(LucideIcons.chevronRight),
            ],
          ),
        ),
      ),
    );
  }
}

final class _DriverActionGrid extends StatelessWidget {
  const _DriverActionGrid({required this.actions, required this.onAction});

  final List<_DriverAction> actions;
  final ValueChanged<DriverHomeAction> onAction;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 900
            ? 4
            : constraints.maxWidth >= 600
            ? 3
            : 2;
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: actions.length,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            mainAxisExtent: 148,
          ),
          itemBuilder: (context, index) {
            final action = actions[index];
            return _DriverActionCard(
              action: action,
              onTap: () => onAction(action.action),
            );
          },
        );
      },
    );
  }
}

final class _DriverAction {
  const _DriverAction({
    required this.icon,
    required this.label,
    required this.description,
    required this.action,
    this.badge = 0,
    this.highlighted = false,
  });

  final IconData icon;
  final String label;
  final String description;
  final DriverHomeAction action;
  final int badge;
  final bool highlighted;
}

final class _DriverActionCard extends StatelessWidget {
  const _DriverActionCard({required this.action, required this.onTap});

  final _DriverAction action;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final background = action.highlighted
        ? const Color(0xFFFFF7CC)
        : Colors.white;
    return Material(
      color: background,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(
          color: action.highlighted
              ? const Color(0xFFF0C800)
              : const Color(0xFFD9D9D9),
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: const Color(0xFF1F1C1C),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(action.icon, color: Colors.white, size: 24),
                  ),
                  const Spacer(),
                  if (action.badge > 0)
                    Badge(
                      largeSize: 26,
                      label: Text(
                        action.badge > 99 ? '99+' : '${action.badge}',
                      ),
                    ),
                ],
              ),
              const Spacer(),
              Text(
                action.label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                action.description,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Color(0xFF666666), fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

final class _DriverNotice {
  const _DriverNotice({
    required this.icon,
    required this.title,
    required this.action,
  });

  final IconData icon;
  final String title;
  final DriverHomeAction action;
}

final class _NoticeTile extends StatelessWidget {
  const _NoticeTile({required this.notice, required this.onTap});

  final _DriverNotice notice;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: const BorderSide(color: Color(0xFFD9D9D9)),
        ),
        child: ListTile(
          minTileHeight: 64,
          onTap: onTap,
          leading: Icon(notice.icon),
          title: Text(
            notice.title,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          trailing: const Icon(LucideIcons.chevronRight),
        ),
      ),
    );
  }
}

final class _NoNotices extends StatelessWidget {
  const _NoNotices();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFD9D9D9)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Row(
        children: [
          Icon(LucideIcons.circleCheck),
          SizedBox(width: 12),
          Expanded(
            child: Text(
              'Nenhuma pendencia para voce agora.',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

bool _needsProofAction(Delivery delivery) {
  if (delivery.status == DeliveryStatus.cancelled) {
    return false;
  }
  return delivery.proofStatus == DeliveryProofStatus.rejected ||
      (delivery.status == DeliveryStatus.arrived &&
          delivery.proofStatus == DeliveryProofStatus.pending);
}

String _greeting() {
  final hour = DateTime.now().hour;
  if (hour < 12) {
    return 'Bom dia';
  }
  if (hour < 18) {
    return 'Boa tarde';
  }
  return 'Boa noite';
}

String _formatTime(DateTime value) {
  final local = value.toLocal();
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '$hour:$minute';
}
