import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../users/application/user_providers.dart';
import '../application/trip_providers.dart';
import '../data/models/trip_model.dart';
import 'trip_detail_page.dart';

final class DriverHomePage extends ConsumerWidget {
  const DriverHomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(currentUserProfileProvider);

    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: profile.when(
              data: (user) => _DriverHeader(
                name: user?.name ?? 'Motorista',
                email: user?.email ?? '',
              ),
              error: (_, _) => const _DriverHeader(
                name: 'Motorista',
                email: 'Perfil indisponivel no momento',
              ),
              loading: () =>
                  const _DriverHeader(name: 'Carregando...', email: ''),
            ),
          ),
          const TabBar(
            tabs: [
              Tab(icon: Icon(Icons.route_outlined), text: 'Ativas'),
              Tab(icon: Icon(Icons.history_outlined), text: 'Historico'),
            ],
          ),
          const Expanded(
            child: TabBarView(children: [_ActiveTripsTab(), _TripHistoryTab()]),
          ),
        ],
      ),
    );
  }
}

final class _ActiveTripsTab extends ConsumerWidget {
  const _ActiveTripsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final trips = ref.watch(currentDriverTripsProvider);

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(currentDriverTripsProvider);
        await ref.read(currentDriverTripsProvider.future);
      },
      child: trips.when(
        data: (items) {
          final activeTrips = items
              .where(
                (trip) =>
                    trip.status == TripStatus.pending ||
                    trip.status == TripStatus.inProgress,
              )
              .toList(growable: false);

          if (activeTrips.isEmpty) {
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [SizedBox(height: 120), _EmptyTrips()],
            );
          }

          return ListView.separated(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            itemCount: activeTrips.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final trip = activeTrips[index];
              return _TripCard(
                trip: trip,
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => TripDetailPage(trip: trip),
                    ),
                  );
                },
              );
            },
          );
        },
        error: (error, _) => ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          children: [Text('Falha ao carregar viagens: $error')],
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
      ),
    );
  }
}

final class _TripHistoryTab extends ConsumerStatefulWidget {
  const _TripHistoryTab();

  @override
  ConsumerState<_TripHistoryTab> createState() => _TripHistoryTabState();
}

final class _TripHistoryTabState extends ConsumerState<_TripHistoryTab> {
  DateTime? _startDate;
  DateTime? _endDate;

  Future<void> _pickStartDate() async {
    final picked = await _pickDate(initialDate: _startDate ?? DateTime.now());
    if (picked == null) {
      return;
    }
    setState(() => _startDate = _dateOnly(picked));
  }

  Future<void> _pickEndDate() async {
    final picked = await _pickDate(initialDate: _endDate ?? DateTime.now());
    if (picked == null) {
      return;
    }
    setState(() => _endDate = _dateOnly(picked));
  }

  Future<DateTime?> _pickDate({required DateTime initialDate}) {
    return showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(2024),
      lastDate: DateTime.now(),
    );
  }

  void _clearFilters() {
    setState(() {
      _startDate = null;
      _endDate = null;
    });
  }

  List<Trip> _filterHistory(List<Trip> trips) {
    final start = _startDate;
    final endExclusive = _endDate?.add(const Duration(days: 1));

    final finishedTrips = trips.where(
      (trip) =>
          trip.status == TripStatus.completed ||
          trip.status == TripStatus.cancelled,
    );

    return finishedTrips
        .where((trip) {
          final referenceDate =
              (trip.completedAt ?? trip.startedAt ?? trip.scheduledAt)
                  .toLocal();
          if (start != null && referenceDate.isBefore(start)) {
            return false;
          }
          if (endExclusive != null && !referenceDate.isBefore(endExclusive)) {
            return false;
          }
          return true;
        })
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    final trips = ref.watch(currentDriverTripsProvider);

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(currentDriverTripsProvider);
        await ref.read(currentDriverTripsProvider.future);
      },
      child: trips.when(
        data: (items) {
          final filtered = _filterHistory(items);

          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              _TripHistoryFilters(
                startDate: _startDate,
                endDate: _endDate,
                onPickStart: _pickStartDate,
                onPickEnd: _pickEndDate,
                onClear: _clearFilters,
              ),
              const SizedBox(height: 12),
              _TripHistorySummary(count: filtered.length),
              const SizedBox(height: 12),
              if (items.isEmpty)
                const _EmptyTripHistory()
              else if (filtered.isEmpty)
                const Card(
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: Text(
                      'Nenhuma viagem encontrada para o periodo selecionado.',
                    ),
                  ),
                )
              else
                for (final trip in filtered) ...[
                  _TripCard(
                    trip: trip,
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => TripDetailPage(trip: trip),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 10),
                ],
            ],
          );
        },
        error: (error, _) => ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          children: [Text('Falha ao carregar historico: $error')],
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
      ),
    );
  }
}

final class _DriverHeader extends StatelessWidget {
  const _DriverHeader({required this.name, required this.email});

  final String name;
  final String email;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              radius: 24,
              backgroundColor: Colors.black,
              child: const Icon(Icons.person_outline, color: Colors.white),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (email.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      email,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

final class _TripHistoryFilters extends StatelessWidget {
  const _TripHistoryFilters({
    required this.startDate,
    required this.endDate,
    required this.onPickStart,
    required this.onPickEnd,
    required this.onClear,
  });

  final DateTime? startDate;
  final DateTime? endDate;
  final VoidCallback onPickStart;
  final VoidCallback onPickEnd;
  final VoidCallback onClear;

  bool get hasFilters => startDate != null || endDate != null;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Filtrar historico',
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _TripDateFilterButton(
                    icon: Icons.event_outlined,
                    label: startDate == null
                        ? 'Data inicial'
                        : _formatDate(startDate!),
                    onPressed: onPickStart,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _TripDateFilterButton(
                    icon: Icons.event_available_outlined,
                    label: endDate == null
                        ? 'Data final'
                        : _formatDate(endDate!),
                    onPressed: onPickEnd,
                  ),
                ),
                if (hasFilters) ...[
                  const SizedBox(width: 8),
                  SizedBox(
                    height: 56,
                    width: 48,
                    child: IconButton.outlined(
                      tooltip: 'Limpar filtros',
                      onPressed: onClear,
                      icon: const Icon(Icons.close),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

final class _TripDateFilterButton extends StatelessWidget {
  const _TripDateFilterButton({
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 56,
      child: OutlinedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon),
        label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
        style: OutlinedButton.styleFrom(
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.symmetric(horizontal: 12),
        ),
      ),
    );
  }
}

final class _TripHistorySummary extends StatelessWidget {
  const _TripHistorySummary({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final label = count == 1 ? 'viagem no periodo' : 'viagens no periodo';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            const Icon(Icons.assessment_outlined),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                '$count $label',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

final class _TripCard extends StatelessWidget {
  const _TripCard({required this.trip, required this.onTap});

  final Trip trip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(trip.status);
    final gpsOnline = _isGpsOnline(trip);

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${trip.origin} -> ${trip.destination}',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _TripChip(
                    color: color,
                    icon: Icons.route_outlined,
                    label: trip.progress.label,
                  ),
                  if (trip.status == TripStatus.inProgress)
                    _TripChip(
                      color: gpsOnline
                          ? const Color(0xFF0A8F5B)
                          : const Color(0xFF777777),
                      icon: gpsOnline ? Icons.wifi : Icons.wifi_off,
                      label: gpsOnline ? 'GPS conectado' : 'GPS offline',
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  const Icon(Icons.event_outlined, size: 18),
                  const SizedBox(width: 8),
                  Text(_formatDateTime(trip.scheduledAt)),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  const Icon(Icons.badge_outlined, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Veiculo: ${trip.vehiclePlate.isNotEmpty ? trip.vehiclePlate : trip.vehicleId}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _statusColor(TripStatus status) {
    return switch (status) {
      TripStatus.pending => const Color(0xFF4A4A4A),
      TripStatus.inProgress => Colors.black,
      TripStatus.completed => const Color(0xFF222222),
      TripStatus.cancelled => const Color(0xFF777777),
    };
  }

  String _formatDateTime(DateTime value) {
    final date = value.toLocal();
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    final hour = date.hour.toString().padLeft(2, '0');
    final minute = date.minute.toString().padLeft(2, '0');
    return '$day/$month/${date.year} $hour:$minute';
  }
}

final class _TripChip extends StatelessWidget {
  const _TripChip({
    required this.color,
    required this.icon,
    required this.label,
  });

  final Color color;
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 15),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w700,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

bool _isGpsOnline(Trip trip) {
  final lastUpdate = trip.lastGpsUpdateAt;
  if (lastUpdate == null || trip.gpsLocation.isEmpty) {
    return false;
  }
  return DateTime.now().difference(lastUpdate.toLocal()).abs() <=
      const Duration(minutes: 3);
}

final class _EmptyTrips extends StatelessWidget {
  const _EmptyTrips();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.route_outlined, size: 48, color: Colors.black),
            const SizedBox(height: 14),
            Text(
              'Nenhuma viagem atribuida',
              textAlign: TextAlign.center,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Text(
              'Quando o administrativo despachar uma carga, ela aparecera aqui.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}

final class _EmptyTripHistory extends StatelessWidget {
  const _EmptyTripHistory();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.history_outlined, size: 48, color: Colors.black),
            const SizedBox(height: 14),
            Text(
              'Nenhuma viagem no historico',
              textAlign: TextAlign.center,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Text(
              'Viagens concluidas pelo administrativo ou pelo motorista aparecerao aqui.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}

DateTime _dateOnly(DateTime dateTime) {
  return DateTime(dateTime.year, dateTime.month, dateTime.day);
}

String _formatDate(DateTime value) {
  final local = value.toLocal();
  final day = local.day.toString().padLeft(2, '0');
  final month = local.month.toString().padLeft(2, '0');
  final year = local.year.toString();
  return '$day/$month/$year';
}
