import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_flutter/lucide_flutter.dart';

import '../application/fueling_providers.dart';
import '../data/models/fueling_record_model.dart';

final class DriverPerformancePage extends ConsumerWidget {
  const DriverPerformancePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final records = ref.watch(driverFuelingRecordsProvider);
    return records.when(
      data: (items) {
        final summary = _ConsumptionSummary.fromRecords(items);
        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(driverFuelingRecordsProvider);
            await ref.read(driverFuelingRecordsProvider.future);
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
            children: [
              Text(
                'Minha Media',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 4),
              const Text('Consumo calculado pelos abastecimentos registrados'),
              const SizedBox(height: 18),
              _AverageCard(summary: summary),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _MetricCard(
                      icon: LucideIcons.route,
                      label: 'Km rodados',
                      value: summary.distanceKm == null
                          ? '--'
                          : '${summary.distanceKm!.toStringAsFixed(0)} km',
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _MetricCard(
                      icon: LucideIcons.fuel,
                      label: 'Litros',
                      value: summary.liters == null
                          ? '--'
                          : '${summary.liters!.toStringAsFixed(1)} L',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _LastFuelingCard(record: summary.latest),
              const SizedBox(height: 20),
              Text(
                'Ultimos periodos',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 10),
              if (summary.periods.isEmpty)
                const _NotEnoughData()
              else
                for (final period in summary.periods.reversed) ...[
                  _PeriodTile(period: period),
                  const SizedBox(height: 8),
                ],
            ],
          ),
        );
      },
      error: (error, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(LucideIcons.wifiOff, size: 40),
              const SizedBox(height: 12),
              const Text(
                'Nao foi possivel calcular sua media.',
                textAlign: TextAlign.center,
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () => ref.invalidate(driverFuelingRecordsProvider),
                icon: const Icon(LucideIcons.refreshCw),
                label: const Text('Tentar novamente'),
              ),
            ],
          ),
        ),
      ),
      loading: () => const Center(child: CircularProgressIndicator()),
    );
  }
}

final class _AverageCard extends StatelessWidget {
  const _AverageCard({required this.summary});

  final _ConsumptionSummary summary;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1F1C1C),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(LucideIcons.gauge, color: Color(0xFFFACC15)),
              SizedBox(width: 10),
              Text(
                'Media atual',
                style: TextStyle(
                  color: Colors.white70,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            summary.averageKmPerLiter == null
                ? '-- km/L'
                : '${summary.averageKmPerLiter!.toStringAsFixed(2)} km/L',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 34,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            summary.vehiclePlate.isEmpty
                ? 'Registre dois abastecimentos completos para calcular.'
                : 'Veiculo ${summary.vehiclePlate}',
            style: const TextStyle(color: Colors.white70),
          ),
        ],
      ),
    );
  }
}

final class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 112),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFD9D9D9)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 22),
          const Spacer(),
          Text(
            value,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(color: Color(0xFF666666))),
        ],
      ),
    );
  }
}

final class _LastFuelingCard extends StatelessWidget {
  const _LastFuelingCard({required this.record});

  final FuelingRecord? record;

  @override
  Widget build(BuildContext context) {
    final value = record;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFD9D9D9)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          const Icon(LucideIcons.calendarClock),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Ultimo abastecimento',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 3),
                Text(
                  value == null
                      ? 'Nenhum registro completo'
                      : '${_formatDate(value.fueledAt)} - ${value.liters.toStringAsFixed(1)} L - KM ${value.kmRegistered}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

final class _PeriodTile extends StatelessWidget {
  const _PeriodTile({required this.period});

  final _ConsumptionPeriod period;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFD9D9D9)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          const Icon(LucideIcons.gauge),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              '${period.distanceKm.toStringAsFixed(0)} km em ${_formatDate(period.date)}',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          Text(
            '${period.kmPerLiter.toStringAsFixed(2)} km/L',
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }
}

final class _NotEnoughData extends StatelessWidget {
  const _NotEnoughData();

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
          Icon(LucideIcons.circleAlert),
          SizedBox(width: 12),
          Expanded(
            child: Text(
              'A media aparecera depois de dois abastecimentos Diesel com litros e KM informados.',
            ),
          ),
        ],
      ),
    );
  }
}

final class _ConsumptionPeriod {
  const _ConsumptionPeriod({
    required this.date,
    required this.distanceKm,
    required this.kmPerLiter,
    required this.liters,
  });

  final DateTime date;
  final double distanceKm;
  final double kmPerLiter;
  final double liters;
}

final class _ConsumptionSummary {
  const _ConsumptionSummary({
    required this.vehiclePlate,
    required this.latest,
    required this.periods,
    required this.averageKmPerLiter,
    required this.distanceKm,
    required this.liters,
  });

  final String vehiclePlate;
  final FuelingRecord? latest;
  final List<_ConsumptionPeriod> periods;
  final double? averageKmPerLiter;
  final double? distanceKm;
  final double? liters;

  factory _ConsumptionSummary.fromRecords(List<FuelingRecord> records) {
    final complete =
        records
            .where(
              (record) =>
                  record.fuelType == FuelType.diesel &&
                  record.liters > 0 &&
                  record.kmRegistered > 0,
            )
            .toList()
          ..sort((a, b) => a.fueledAt.compareTo(b.fueledAt));
    final latest = complete.lastOrNull;
    if (latest == null) {
      return const _ConsumptionSummary(
        vehiclePlate: '',
        latest: null,
        periods: [],
        averageKmPerLiter: null,
        distanceKm: null,
        liters: null,
      );
    }

    final vehicleRecords =
        complete
            .where((record) => record.vehicleId == latest.vehicleId)
            .toList()
          ..sort((a, b) => a.fueledAt.compareTo(b.fueledAt));
    final periods = <_ConsumptionPeriod>[];
    for (var index = 1; index < vehicleRecords.length; index++) {
      final previous = vehicleRecords[index - 1];
      final current = vehicleRecords[index];
      final distance =
          current.kmRegistered.toDouble() - previous.kmRegistered.toDouble();
      final liters = current.liters.toDouble();
      if (distance <= 0 || liters <= 0) {
        continue;
      }
      periods.add(
        _ConsumptionPeriod(
          date: current.fueledAt,
          distanceKm: distance,
          kmPerLiter: distance / liters,
          liters: liters,
        ),
      );
    }
    final recentPeriods = periods.length <= 4
        ? periods
        : periods.sublist(periods.length - 4);
    final totalDistance = periods.fold<double>(
      0,
      (total, period) => total + period.distanceKm,
    );
    final totalLiters = periods.fold<double>(
      0,
      (total, period) => total + period.liters,
    );
    return _ConsumptionSummary(
      vehiclePlate: latest.vehiclePlate,
      latest: latest,
      periods: recentPeriods,
      averageKmPerLiter: totalLiters == 0 ? null : totalDistance / totalLiters,
      distanceKm: totalDistance == 0 ? null : totalDistance,
      liters: totalLiters == 0 ? null : totalLiters,
    );
  }
}

String _formatDate(DateTime value) {
  final local = value.toLocal();
  final day = local.day.toString().padLeft(2, '0');
  final month = local.month.toString().padLeft(2, '0');
  return '$day/$month/${local.year}';
}
