import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../../core/errors/firebase_failure.dart';
import '../../../../core/firebase/firestore_collections.dart';
import '../models/trip_model.dart';

final class TripRepository {
  TripRepository({FirebaseFirestore? firestore, FirebaseAuth? auth})
    : _firestore = firestore ?? FirebaseFirestore.instance,
      _auth = auth ?? FirebaseAuth.instance;

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  CollectionReference<Trip> get _trips {
    return _firestore
        .collection(FirestoreCollections.trips)
        .withConverter<Trip>(
          fromFirestore: (snapshot, _) => Trip.fromDocument(snapshot),
          toFirestore: (trip, _) => trip.toFirestore(),
        );
  }

  Stream<List<Trip>> watchCurrentDriverTrips() {
    final uid = _requireCurrentUserId();

    return _trips
        .where('driverId', isEqualTo: uid)
        .orderBy('scheduledAt', descending: true)
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

  Future<Trip?> getByIdForCurrentDriver(String tripId) async {
    try {
      final uid = _requireCurrentUserId();
      final snapshot = await _trips
          .doc(tripId)
          .get()
          .timeout(const Duration(seconds: 10));

      final trip = snapshot.data();
      if (trip == null || trip.driverId != uid) {
        return null;
      }
      return trip;
    } on Object catch (error, stackTrace) {
      throw FirebaseFailure.fromException(error, stackTrace);
    }
  }

  Future<void> updateStatusForCurrentDriver(
    String tripId,
    TripStatus status, {
    DateTime? startedAt,
    DateTime? completedAt,
  }) async {
    try {
      final uid = _requireCurrentUserId();
      final trip = await getByIdForCurrentDriver(tripId);
      if (trip == null || trip.driverId != uid) {
        throw const FirebaseFailure(
          code: FirebaseFailureCode.permissionDenied,
          message: 'Viagem inexistente ou nao pertence ao motorista atual.',
        );
      }

      final data = <String, Object?>{'status': status.value};
      if (startedAt != null) {
        data['startedAt'] = Timestamp.fromDate(startedAt);
      }
      if (completedAt != null) {
        data['completedAt'] = Timestamp.fromDate(completedAt);
      }

      await _trips
          .doc(tripId)
          .update(data)
          .timeout(const Duration(seconds: 10));
    } on Object catch (error, stackTrace) {
      throw FirebaseFailure.fromException(error, stackTrace);
    }
  }

  String _requireCurrentUserId() {
    final uid = _auth.currentUser?.uid;
    if (uid == null || uid.isEmpty) {
      throw const FirebaseFailure(
        code: FirebaseFailureCode.unauthenticated,
        message: 'Motorista nao autenticado.',
      );
    }
    return uid;
  }
}
