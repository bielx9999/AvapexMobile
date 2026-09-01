import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/firebase_providers.dart';
import '../../trips/application/trip_providers.dart';
import '../../vehicles/data/models/vehicle_model.dart';
import '../data/models/fueling_record_model.dart';
import '../data/repositories/fueling_record_repository.dart';

final fuelingRecordRepositoryProvider = Provider<FuelingRecordRepository>((
  ref,
) {
  return FuelingRecordRepository(
    firestore: ref.watch(firebaseFirestoreProvider),
    auth: ref.watch(firebaseAuthProvider),
  );
});

final driverFuelingRecordsProvider = StreamProvider<List<FuelingRecord>>((ref) {
  return ref.watch(fuelingRecordRepositoryProvider).watchForCurrentDriver();
});

final fuelingVehiclesProvider = StreamProvider<List<Vehicle>>((ref) {
  final uid = ref.watch(firebaseAuthProvider).currentUser?.uid;
  if (uid == null || uid.isEmpty) {
    return const Stream<List<Vehicle>>.empty();
  }
  final tripVehicleIds =
      ref
          .watch(currentDriverTripsProvider)
          .asData
          ?.value
          .map((trip) => trip.vehicleId)
          .where((vehicleId) => vehicleId.isNotEmpty)
          .toSet() ??
      const <String>{};
  return ref
      .watch(vehicleRepositoryProvider)
      .watchVehiclesForDriver(uid, extraVehicleIds: tripVehicleIds);
});
