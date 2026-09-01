import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/errors/firebase_failure.dart';
import '../../../../core/firebase/firestore_collections.dart';
import '../models/vehicle_model.dart';

final class VehicleRepository {
  VehicleRepository({FirebaseFirestore? firestore})
    : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Vehicle> get _vehicles {
    return _firestore
        .collection(FirestoreCollections.vehicles)
        .withConverter<Vehicle>(
          fromFirestore: (snapshot, _) => Vehicle.fromDocument(snapshot),
          toFirestore: (vehicle, _) => vehicle.toFirestore(),
        );
  }

  Stream<List<Vehicle>> watchAllVehicles() {
    return _vehicles
        .snapshots()
        .map((snapshot) {
          final vehicles = snapshot.docs
              .map((document) => document.data())
              .toList(growable: false);
          vehicles.sort((a, b) => a.plate.compareTo(b.plate));
          return vehicles;
        })
        .handleError((Object error, StackTrace stackTrace) {
          throw FirebaseFailure.fromException(error, stackTrace);
        });
  }

  Stream<List<Vehicle>> watchAvailableVehicles() {
    return _vehicles
        .where(
          'status',
          whereIn: [VehicleStatus.active.value, VehicleStatus.available.value],
        )
        .snapshots()
        .map(
          (snapshot) => snapshot.docs
              .map((document) => document.data())
              .toList(growable: false),
        )
        .handleError((Object error, StackTrace stackTrace) {
          throw FirebaseFailure.fromException(error, stackTrace);
        });
  }

  Stream<List<Vehicle>> watchVehiclesForDriver(
    String uid, {
    Set<String> extraVehicleIds = const {},
  }) {
    return watchAvailableVehicles().map((vehicles) {
      return vehicles
          .where(
            (vehicle) =>
                vehicle.currentDriverId == uid ||
                vehicle.currentDriverId == null ||
                vehicle.currentDriverId!.isEmpty ||
                extraVehicleIds.contains(vehicle.id),
          )
          .toList(growable: false);
    });
  }

  Future<Vehicle?> getById(String vehicleId) async {
    try {
      final snapshot = await _vehicles
          .doc(vehicleId)
          .get()
          .timeout(const Duration(seconds: 10));
      return snapshot.data();
    } on Object catch (error, stackTrace) {
      throw FirebaseFailure.fromException(error, stackTrace);
    }
  }
}
