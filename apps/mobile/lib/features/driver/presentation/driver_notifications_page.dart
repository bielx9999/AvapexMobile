import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_flutter/lucide_flutter.dart';

import '../../checklists/application/checklist_providers.dart';
import '../../deliveries/application/delivery_providers.dart';
import '../../deliveries/data/models/delivery_model.dart';
import '../../trips/application/trip_providers.dart';
import '../../trips/data/models/trip_model.dart';
import 'driver_home_page.dart';

final class DriverNotificationsPage extends ConsumerWidget {
  const DriverNotificationsPage({required this.onAction, super.key});

  final ValueChanged<DriverHomeAction> onAction;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final trips =
        ref.watch(currentDriverTripsProvider).asData?.value ?? const <Trip>[];
    final deliveries =
        ref.watch(currentDriverDeliveriesProvider).asData?.value ??
        const <Delivery>[];
    final checklists =
        ref.watch(checklistHistoryProvider).asData?.value ?? const [];
    final operationalTrips =
        trips
            .where(
              (trip) =>
                  trip.status == TripStatus.inProgress ||
                  trip.status == TripStatus.pending,
            )
            .toList()
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
    final pendingProofs = deliveries.where(_needsProofAction).toList()
      ..sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));
    final checklistTrip = operationalTrips.firstOrNull;
    final checklistPending =
        checklistTrip != null &&
        !checklists.any((checklist) => checklist.tripId == checklistTrip.id);
    final alerts = <_AlertItem>[
      if (checklistPending)
        _AlertItem(
          icon: LucideIcons.clipboardCheck,
          title: 'Checklist pendente',
          description:
              '${checklistTrip.origin} -> ${checklistTrip.destination}',
          action: DriverHomeAction.checklists,
        ),
      for (final trip in assigned)
        _AlertItem(
          icon: LucideIcons.calendarCheck,
          title: 'Nova viagem atribuida',
          description:
              '${trip.origin} -> ${trip.destination} - ${_formatDateTime(trip.scheduledAt)}',
          action: DriverHomeAction.assignedTrips,
        ),
      for (final delivery in pendingProofs)
        _AlertItem(
          icon: LucideIcons.receiptText,
          title: delivery.proofStatus == DeliveryProofStatus.rejected
              ? 'Comprovante precisa de correcao'
              : 'Comprovante pendente',
          description: delivery.clientName.isEmpty
              ? 'Pedido ${delivery.orderNumber}'
              : delivery.clientName,
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
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: const Color(0xFF1F1C1C),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(LucideIcons.bell, color: Colors.white),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Avisos',
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w900),
                    ),
                    const Text('Somente o que precisa da sua atencao'),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 22),
          if (alerts.isEmpty)
            const _EmptyAlerts()
          else
            for (final alert in alerts) ...[
              _AlertCard(alert: alert, onTap: () => onAction(alert.action)),
              const SizedBox(height: 10),
            ],
        ],
      ),
    );
  }
}

final class _AlertItem {
  const _AlertItem({
    required this.icon,
    required this.title,
    required this.description,
    required this.action,
  });

  final IconData icon;
  final String title;
  final String description;
  final DriverHomeAction action;
}

final class _AlertCard extends StatelessWidget {
  const _AlertCard({required this.alert, required this.onTap});

  final _AlertItem alert;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: const BorderSide(color: Color(0xFFD9D9D9)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF2A8),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(alert.icon, color: const Color(0xFF111111)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      alert.title,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      alert.description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Color(0xFF666666)),
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

final class _EmptyAlerts extends StatelessWidget {
  const _EmptyAlerts();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 36),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFD9D9D9)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Column(
        children: [
          Icon(LucideIcons.circleCheck, size: 44),
          SizedBox(height: 14),
          Text(
            'Tudo certo por aqui',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
          ),
          SizedBox(height: 4),
          Text(
            'Nenhuma pendencia exige sua atencao agora.',
            textAlign: TextAlign.center,
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

String _formatDateTime(DateTime value) {
  final local = value.toLocal();
  final day = local.day.toString().padLeft(2, '0');
  final month = local.month.toString().padLeft(2, '0');
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '$day/$month $hour:$minute';
}
