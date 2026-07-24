import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/data/repositories/auth_repository.dart';
import '../../features/checklists/data/repositories/checklist_repository.dart';
import '../../features/checklists/data/services/device_location_service.dart';
import '../../features/incidents/data/repositories/incident_repository.dart';
import '../../features/trips/data/repositories/trip_repository.dart';
import '../../features/users/data/repositories/user_repository.dart';
import '../../features/vehicles/data/repositories/vehicle_repository.dart';

final firebaseAuthProvider = Provider<FirebaseAuth>((ref) {
  return FirebaseAuth.instance;
});

final firebaseFirestoreProvider = Provider<FirebaseFirestore>((ref) {
  return FirebaseFirestore.instance;
});

final firebaseStorageProvider = Provider<FirebaseStorage>((ref) {
  return FirebaseStorage.instance;
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(auth: ref.watch(firebaseAuthProvider));
});

final userRepositoryProvider = Provider<UserRepository>((ref) {
  return UserRepository(
    firestore: ref.watch(firebaseFirestoreProvider),
    auth: ref.watch(firebaseAuthProvider),
  );
});

final vehicleRepositoryProvider = Provider<VehicleRepository>((ref) {
  return VehicleRepository(firestore: ref.watch(firebaseFirestoreProvider));
});

final tripRepositoryProvider = Provider<TripRepository>((ref) {
  return TripRepository(
    firestore: ref.watch(firebaseFirestoreProvider),
    auth: ref.watch(firebaseAuthProvider),
  );
});

final checklistRepositoryProvider = Provider<ChecklistRepository>((ref) {
  return ChecklistRepository(
    firestore: ref.watch(firebaseFirestoreProvider),
    auth: ref.watch(firebaseAuthProvider),
  );
});

final deviceLocationServiceProvider = Provider<DeviceLocationService>((ref) {
  return DeviceLocationService();
});

final incidentRepositoryProvider = Provider<IncidentRepository>((ref) {
  return IncidentRepository(
    firestore: ref.watch(firebaseFirestoreProvider),
    auth: ref.watch(firebaseAuthProvider),
  );
});
