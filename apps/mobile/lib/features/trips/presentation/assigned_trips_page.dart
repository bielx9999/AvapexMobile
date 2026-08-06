import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_flutter/lucide_flutter.dart';

import '../application/trip_providers.dart';
import '../data/models/trip_model.dart';
import 'trip_detail_page.dart';

final class AssignedTripsPage extends ConsumerWidget {
  const AssignedTripsPage({this.showHeader = true, super.key});

  final bool showHeader;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 3,
      child: Column(
        children: [
          if (showHeader) const _AssignedHeader(),
          const TabBar(
            tabs: [
              Tab(text: 'Aguardando'),
              Tab(text: 'Aceitas'),
              Tab(text: 'Recusadas'),
            ],
          ),
          const Expanded(
            child: TabBarView(
              children: [
                _AssignmentList(response: DriverTripResponse.pending),
                _AssignmentList(response: DriverTripResponse.accepted),
                _AssignmentList(response: DriverTripResponse.rejected),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

final class _AssignedHeader extends StatelessWidget {
  const _AssignedHeader();

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
            child: const Icon(LucideIcons.calendarCheck, color: Colors.white),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Viagens atribuidas',
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
            ),
          ),
        ],
      ),
    );
  }
}

final class _AssignmentList extends ConsumerWidget {
  const _AssignmentList({required this.response});

  final DriverTripResponse response;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tripsState = ref.watch(currentDriverTripsProvider);
    return tripsState.when(
      data: (items) {
        final filtered = items.where((trip) {
          if (trip.driverResponse != response) {
            return false;
          }
          if (response == DriverTripResponse.pending) {
            return trip.canDriverRespondAt(DateTime.now());
          }
          if (response == DriverTripResponse.accepted) {
            return trip.status == TripStatus.pending;
          }
          return true;
        }).toList()..sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));

        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(currentDriverTripsProvider);
            await ref.read(currentDriverTripsProvider.future);
          },
          child: filtered.isEmpty
              ? _AssignmentEmpty(response: response)
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
                  itemCount: filtered.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final trip = filtered[index];
                    return _AssignmentCard(
                      trip: trip,
                      onOpen: () => Navigator.of(context).push<void>(
                        MaterialPageRoute(
                          builder: (_) => TripDetailPage(trip: trip),
                        ),
                      ),
                    );
                  },
                ),
        );
      },
      error: (error, _) => Center(child: Text('Falha ao carregar: $error')),
      loading: () => const Center(child: CircularProgressIndicator()),
    );
  }
}

final class _AssignmentCard extends StatelessWidget {
  const _AssignmentCard({required this.trip, required this.onOpen});

  final Trip trip;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final cte = trip.cteDocuments.firstOrNull?.number;
    final waiting = trip.driverResponse == DriverTripResponse.pending;
    return Material(
      color: waiting ? const Color(0xFFFFFBEB) : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(
          color: waiting ? const Color(0xFFFACC15) : const Color(0xFFD9D9D9),
          width: waiting ? 2 : 1,
        ),
      ),
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${trip.origin} -> ${trip.destination}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  _ResponseBadge(response: trip.driverResponse),
                ],
              ),
              const SizedBox(height: 12),
              _CardInfo(
                icon: LucideIcons.calendarClock,
                value: _formatDateTime(trip.scheduledAt),
              ),
              _CardInfo(
                icon: LucideIcons.building2,
                value: trip.clientName.isEmpty
                    ? 'Cliente nao informado'
                    : trip.clientName,
              ),
              _CardInfo(
                icon: LucideIcons.truck,
                value: [
                  trip.fleetNumber,
                  trip.vehiclePlate,
                ].where((value) => value.isNotEmpty).join(' - '),
              ),
              _CardInfo(
                icon: LucideIcons.fileText,
                value: cte == null ? 'CT-e nao informado' : 'CT-e $cte',
              ),
              if (trip.driverRejection != null) ...[
                const SizedBox(height: 6),
                Text(
                  'Motivo: ${trip.driverRejection!.reasonLabel}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ],
              const SizedBox(height: 12),
              FilledButton.tonalIcon(
                onPressed: onOpen,
                icon: const Icon(LucideIcons.eye),
                label: const Text('Ver detalhes'),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(50),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

final class _ResponseBadge extends StatelessWidget {
  const _ResponseBadge({required this.response});

  final DriverTripResponse response;

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (response) {
      DriverTripResponse.pending => ('Aguardando', const Color(0xFFFACC15)),
      DriverTripResponse.accepted => ('Aceita', const Color(0xFFBBF7D0)),
      DriverTripResponse.rejected => ('Recusada', const Color(0xFFE5E5E5)),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900),
      ),
    );
  }
}

final class _CardInfo extends StatelessWidget {
  const _CardInfo({required this.icon, required this.value});

  final IconData icon;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Icon(icon, size: 17, color: const Color(0xFF555555)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value.isEmpty ? '-' : value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

final class _AssignmentEmpty extends StatelessWidget {
  const _AssignmentEmpty({required this.response});

  final DriverTripResponse response;

  @override
  Widget build(BuildContext context) {
    final message = switch (response) {
      DriverTripResponse.pending => 'Nenhuma viagem aguardando sua resposta.',
      DriverTripResponse.accepted => 'Nenhuma viagem futura aceita.',
      DriverTripResponse.rejected => 'Nenhuma viagem recusada.',
    };
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(28),
      children: [
        const SizedBox(height: 80),
        const Icon(LucideIcons.calendarCheck, size: 46),
        const SizedBox(height: 14),
        Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ],
    );
  }
}

String _formatDateTime(DateTime value) {
  final date = value.toLocal();
  final day = date.day.toString().padLeft(2, '0');
  final month = date.month.toString().padLeft(2, '0');
  final hour = date.hour.toString().padLeft(2, '0');
  final minute = date.minute.toString().padLeft(2, '0');
  return '$day/$month/${date.year} - $hour:$minute';
}
