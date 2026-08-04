import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/firebase_providers.dart';
import '../data/models/trip_model.dart';

final currentDriverTripsProvider = StreamProvider<List<Trip>>((ref) {
  return ref.watch(tripRepositoryProvider).watchCurrentDriverTrips();
});

final tripGpsHeartbeatControllerProvider = Provider<void>((ref) {
  var heartbeatInFlight = false;

  Future<void> sendHeartbeat() async {
    if (heartbeatInFlight) {
      return;
    }
    heartbeatInFlight = true;
    try {
      final trips = await ref.read(currentDriverTripsProvider.future);
      final trackingTrip = _selectTrackingTrip(trips);
      if (trackingTrip == null) {
        return;
      }

      final location = await ref
          .read(deviceLocationServiceProvider)
          .getCurrentLocation();
      if (location == null) {
        return;
      }
      await ref
          .read(tripRepositoryProvider)
          .updateGpsHeartbeatForCurrentDriver(
            trackingTrip.id,
            location.toFirestore(),
          );
    } on Object {
      // A ausencia de heartbeat faz o painel marcar o GPS como offline.
    } finally {
      heartbeatInFlight = false;
    }
  }

  final timer = Timer.periodic(
    const Duration(minutes: 1),
    (_) => unawaited(sendHeartbeat()),
  );
  ref.onDispose(timer.cancel);
  unawaited(Future<void>.delayed(const Duration(seconds: 1), sendHeartbeat));
});

Trip? _selectTrackingTrip(List<Trip> trips) {
  final activeTrips = trips
      .where((trip) => trip.status == TripStatus.inProgress)
      .toList();
  if (activeTrips.isEmpty) {
    return null;
  }

  final startedTrips =
      activeTrips.where((trip) => trip.startedAt != null).toList()
        ..sort((a, b) => b.startedAt!.compareTo(a.startedAt!));
  if (startedTrips.isNotEmpty) {
    return startedTrips.first;
  }

  final now = DateTime.now();
  final dueTrips =
      activeTrips.where((trip) => !trip.scheduledAt.isAfter(now)).toList()
        ..sort((a, b) => b.scheduledAt.compareTo(a.scheduledAt));
  if (dueTrips.isNotEmpty) {
    return dueTrips.first;
  }

  activeTrips.sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));
  return activeTrips.first;
}
