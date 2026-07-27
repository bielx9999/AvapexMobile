import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/firebase_providers.dart';
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
  return ref.watch(vehicleRepositoryProvider).watchAllVehicles();
});
