import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_flutter/lucide_flutter.dart';

import '../application/trip_providers.dart';
import '../data/models/trip_model.dart';
import 'assigned_trips_page.dart';
import 'trip_detail_page.dart';

final class DriverTripsPage extends ConsumerWidget {
  const DriverTripsPage({
    this.assignedOnly = false,
    this.showHeader = true,
    super.key,
  });

  final bool assignedOnly;
  final bool showHeader;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (assignedOnly) {
      return AssignedTripsPage(showHeader: showHeader);
    }

    return DefaultTabController(
      length: 3,
      child: Column(
        children: [
          if (showHeader) const _PageHeader(),
          const TabBar(
            tabs: [
              Tab(text: 'Em andamento'),
              Tab(text: 'Proximas'),
              Tab(text: 'Finalizadas'),
            ],
          ),
          const Expanded(
            child: TabBarView(
              children: [
                _TripsList(kind: _TripListKind.inProgress),
                _TripsList(kind: _TripListKind.upcoming),
                _FinishedTrips(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

final class _PageHeader extends StatelessWidget {
  const _PageHeader();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFF1F1C1C),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(LucideIcons.route, color: Colors.white),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Minhas viagens',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const Text('Acompanhe suas programacoes'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

enum _TripListKind { inProgress, upcoming }

final class _TripsList extends ConsumerWidget {
  const _TripsList({required this.kind});

  final _TripListKind kind;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final trips = ref.watch(currentDriverTripsProvider);
    return trips.when(
      data: (items) {
        final filtered = items.where((trip) {
          return switch (kind) {
            _TripListKind.inProgress => trip.status == TripStatus.inProgress,
            _TripListKind.upcoming =>
              trip.status == TripStatus.pending &&
                  trip.driverResponse == DriverTripResponse.accepted,
          };
        }).toList()..sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));

        return RefreshIndicator(
          onRefresh: () => _refresh(ref),
          child: filtered.isEmpty
              ? _EmptyTrips(kind: kind)
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
                  itemCount: filtered.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, index) => _TripCard(
                    trip: filtered[index],
                    onTap: () => _openTrip(context, filtered[index]),
                  ),
                ),
        );
      },
      error: (error, _) =>
          _TripsError(error: error, onRetry: () => _refresh(ref)),
      loading: () => const Center(child: CircularProgressIndicator()),
    );
  }
}

final class _FinishedTrips extends ConsumerStatefulWidget {
  const _FinishedTrips();

  @override
  ConsumerState<_FinishedTrips> createState() => _FinishedTripsState();
}

final class _FinishedTripsState extends ConsumerState<_FinishedTrips> {
  DateTimeRange? _range;

  Future<void> _pickRange() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2024),
      lastDate: now,
      initialDateRange: _range,
    );
    if (picked != null) {
      setState(() => _range = picked);
    }
  }

  @override
  Widget build(BuildContext context) {
    final trips = ref.watch(currentDriverTripsProvider);
    return trips.when(
      data: (items) {
        final range = _range;
        final filtered =
            items.where((trip) {
              if (trip.status != TripStatus.completed &&
                  trip.status != TripStatus.cancelled) {
                return false;
              }
              if (range == null) {
                return true;
              }
              final date =
                  trip.completedAt ?? trip.startedAt ?? trip.scheduledAt;
              final start = DateTime(
                range.start.year,
                range.start.month,
                range.start.day,
              );
              final end = DateTime(
                range.end.year,
                range.end.month,
                range.end.day + 1,
              );
              return !date.isBefore(start) && date.isBefore(end);
            }).toList()..sort((a, b) {
              final aDate = a.completedAt ?? a.scheduledAt;
              final bDate = b.completedAt ?? b.scheduledAt;
              return bDate.compareTo(aDate);
            });

        return RefreshIndicator(
          onRefresh: () => _refresh(ref),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
            children: [
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _pickRange,
                      icon: const Icon(LucideIcons.calendarRange),
                      label: Text(
                        range == null
                            ? 'Filtrar periodo'
                            : '${_formatDate(range.start)} - ${_formatDate(range.end)}',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                  if (range != null) ...[
                    const SizedBox(width: 8),
                    IconButton.outlined(
                      tooltip: 'Limpar periodo',
                      onPressed: () => setState(() => _range = null),
                      icon: const Icon(LucideIcons.x),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 12),
              if (filtered.isEmpty)
                const _FinishedEmpty()
              else
                for (final trip in filtered) ...[
                  _TripCard(trip: trip, onTap: () => _openTrip(context, trip)),
                  const SizedBox(height: 10),
                ],
            ],
          ),
        );
      },
      error: (error, _) =>
          _TripsError(error: error, onRetry: () => _refresh(ref)),
      loading: () => const Center(child: CircularProgressIndicator()),
    );
  }
}

final class _TripCard extends StatelessWidget {
  const _TripCard({required this.trip, required this.onTap});

  final Trip trip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final active = trip.status == TripStatus.inProgress;
    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(
          color: active ? const Color(0xFFF0C800) : const Color(0xFFD9D9D9),
          width: active ? 1.5 : 1,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  _StatusPill(trip: trip),
                  const Spacer(),
                  Text(
                    _formatDateTime(trip.scheduledAt),
                    style: const TextStyle(
                      color: Color(0xFF666666),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                trip.origin,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 6),
                child: Icon(
                  LucideIcons.arrowDown,
                  size: 18,
                  color: Color(0xFF777777),
                ),
              ),
              Text(
                trip.destination,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 12,
                runSpacing: 8,
                children: [
                  _TripMeta(
                    icon: LucideIcons.truck,
                    text: trip.vehiclePlate.isEmpty
                        ? trip.vehicleId
                        : trip.vehiclePlate,
                  ),
                  if (trip.customerRequestNumber.isNotEmpty)
                    _TripMeta(
                      icon: LucideIcons.fileText,
                      text: trip.customerRequestNumber,
                    ),
                  if (active)
                    _TripMeta(
                      icon: _isGpsOnline(trip)
                          ? LucideIcons.wifi
                          : LucideIcons.wifiOff,
                      text: _isGpsOnline(trip) ? 'GPS online' : 'GPS offline',
                    ),
                ],
              ),
              const SizedBox(height: 14),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: onTap,
                  iconAlignment: IconAlignment.end,
                  icon: const Icon(LucideIcons.arrowRight, size: 18),
                  label: const Text('Ver detalhes'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

final class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.trip});

  final Trip trip;

  @override
  Widget build(BuildContext context) {
    final background = trip.status == TripStatus.cancelled
        ? const Color(0xFFE8E8E8)
        : trip.status == TripStatus.inProgress
        ? const Color(0xFFFFF2A8)
        : const Color(0xFFF1F1F1);
    return Container(
      constraints: const BoxConstraints(maxWidth: 190),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        trip.progress.label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
      ),
    );
  }
}

final class _TripMeta extends StatelessWidget {
  const _TripMeta({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: const Color(0xFF555555)),
        const SizedBox(width: 6),
        Text(text, style: const TextStyle(color: Color(0xFF555555))),
      ],
    );
  }
}

final class _EmptyTrips extends StatelessWidget {
  const _EmptyTrips({required this.kind});

  final _TripListKind kind;

  @override
  Widget build(BuildContext context) {
    final upcoming = kind == _TripListKind.upcoming;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(32),
      children: [
        const SizedBox(height: 60),
        Icon(
          upcoming ? LucideIcons.calendarCheck : LucideIcons.route,
          size: 44,
        ),
        const SizedBox(height: 14),
        Text(
          upcoming ? 'Nenhuma viagem atribuida' : 'Nenhuma viagem em andamento',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        Text(
          upcoming
              ? 'Novas programacoes do administrativo aparecerao aqui.'
              : 'Quando uma viagem for iniciada, acompanhe-a nesta tela.',
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

final class _FinishedEmpty extends StatelessWidget {
  const _FinishedEmpty();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 50),
      child: Column(
        children: [
          Icon(LucideIcons.history, size: 44),
          SizedBox(height: 14),
          Text(
            'Nenhuma viagem finalizada no periodo',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

final class _TripsError extends StatelessWidget {
  const _TripsError({required this.error, required this.onRetry});

  final Object error;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(LucideIcons.wifiOff, size: 38),
            const SizedBox(height: 12),
            const Text(
              'Nao foi possivel carregar as viagens.',
              textAlign: TextAlign.center,
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(LucideIcons.refreshCw),
              label: const Text('Tentar novamente'),
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> _refresh(WidgetRef ref) async {
  ref.invalidate(currentDriverTripsProvider);
  await ref.read(currentDriverTripsProvider.future);
}

void _openTrip(BuildContext context, Trip trip) {
  Navigator.of(
    context,
  ).push(MaterialPageRoute<void>(builder: (_) => TripDetailPage(trip: trip)));
}

bool _isGpsOnline(Trip trip) {
  final lastUpdate = trip.lastGpsUpdateAt;
  return lastUpdate != null &&
      trip.gpsLocation.isNotEmpty &&
      DateTime.now().difference(lastUpdate.toLocal()).abs() <=
          const Duration(minutes: 3);
}

String _formatDateTime(DateTime value) {
  final local = value.toLocal();
  final day = local.day.toString().padLeft(2, '0');
  final month = local.month.toString().padLeft(2, '0');
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '$day/$month $hour:$minute';
}

String _formatDate(DateTime value) {
  final local = value.toLocal();
  final day = local.day.toString().padLeft(2, '0');
  final month = local.month.toString().padLeft(2, '0');
  return '$day/$month/${local.year}';
}
