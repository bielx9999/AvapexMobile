import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/firebase_providers.dart';
import '../data/models/driver_equipment_model.dart';
import '../data/repositories/driver_equipment_repository.dart';

final driverEquipmentRepositoryProvider = Provider<DriverEquipmentRepository>((
  ref,
) {
  return DriverEquipmentRepository(
    firestore: ref.watch(firebaseFirestoreProvider),
    auth: ref.watch(firebaseAuthProvider),
  );
});

final availableDriverEquipmentProvider =
    StreamProvider.family<List<DriverEquipment>, Set<DriverEquipmentType>>((
      ref,
      types,
    ) {
      return ref
          .watch(driverEquipmentRepositoryProvider)
          .watchAvailableForCurrentDriver(types: types);
    });
