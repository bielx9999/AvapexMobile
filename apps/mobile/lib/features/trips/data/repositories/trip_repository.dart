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

  Future<void> respondToAssignment({
    required Trip trip,
    required DriverTripResponse response,
    TripRejection? rejection,
  }) async {
    try {
      final uid = _requireCurrentUserId();
      if (trip.driverId != uid) {
        throw const FirebaseFailure(
          code: FirebaseFailureCode.permissionDenied,
          message: 'Viagem inexistente ou nao pertence ao motorista atual.',
        );
      }
      if (response == DriverTripResponse.pending) {
        throw const FirebaseFailure(
          code: FirebaseFailureCode.unknown,
          message: 'Resposta de viagem invalida.',
        );
      }
      if (response == DriverTripResponse.rejected &&
          (rejection == null || rejection.reasonCode.isEmpty)) {
        throw const FirebaseFailure(
          code: FirebaseFailureCode.unknown,
          message: 'Informe o motivo da recusa.',
        );
      }

      await _firestore
          .runTransaction((transaction) async {
            final reference = _trips.doc(trip.id);
            final snapshot = await transaction.get(reference);
            final current = snapshot.data();
            if (current == null || current.driverId != uid) {
              throw const FirebaseFailure(
                code: FirebaseFailureCode.permissionDenied,
                message:
                    'Viagem inexistente ou nao pertence ao motorista atual.',
              );
            }
            if (current.driverResponse != DriverTripResponse.pending) {
              throw const FirebaseFailure(
                code: FirebaseFailureCode.permissionDenied,
                message: 'Esta viagem ja recebeu uma resposta.',
              );
            }
            if (!current.canDriverRespondAt(DateTime.now())) {
              throw const FirebaseFailure(
                code: FirebaseFailureCode.permissionDenied,
                message: 'Somente viagens pendentes podem receber resposta.',
              );
            }

            transaction.update(reference, {
              'driverResponse': response.value,
              'driverRespondedAt': FieldValue.serverTimestamp(),
              'driverResponseDriverId': uid,
              'driverRejection': response == DriverTripResponse.rejected
                  ? rejection!.toFirestore()
                  : null,
            });
          })
          .timeout(const Duration(seconds: 15));
    } on Object catch (error, stackTrace) {
      throw FirebaseFailure.fromException(error, stackTrace);
    }
  }

  Future<void> moveToNextProgressForCurrentDriver(Trip trip) async {
    try {
      final uid = _requireCurrentUserId();
      await _firestore
          .runTransaction((transaction) async {
            final reference = _trips.doc(trip.id);
            final snapshot = await transaction.get(reference);
            final current = snapshot.data();
            if (current == null || current.driverId != uid) {
              throw const FirebaseFailure(
                code: FirebaseFailureCode.permissionDenied,
                message:
                    'Viagem inexistente ou nao pertence ao motorista atual.',
              );
            }
            if (current.driverResponse != DriverTripResponse.accepted) {
              throw const FirebaseFailure(
                code: FirebaseFailureCode.permissionDenied,
                message: 'Aceite a viagem antes de atualizar o andamento.',
              );
            }
            if (current.status == TripStatus.completed ||
                current.status == TripStatus.cancelled) {
              throw const FirebaseFailure(
                code: FirebaseFailureCode.permissionDenied,
                message: 'Esta viagem ja foi encerrada.',
              );
            }

            final next = _nextProgress(current);
            if (next == null || next.isFinished) {
              throw const FirebaseFailure(
                code: FirebaseFailureCode.permissionDenied,
                message: 'Anexe o comprovante para finalizar esta viagem.',
              );
            }

            transaction.update(
              reference,
              _progressUpdate(next, markStarted: current.startedAt == null),
            );
          })
          .timeout(const Duration(seconds: 15));
    } on Object catch (error, stackTrace) {
      throw FirebaseFailure.fromException(error, stackTrace);
    }
  }

  Future<void> completeForCurrentDriver({
    required Trip trip,
    required List<String> proofPhotoUrls,
    required List<String> pendingProofPhotoLocalPaths,
  }) async {
    try {
      final uid = _requireCurrentUserId();
      if (proofPhotoUrls.isEmpty && pendingProofPhotoLocalPaths.isEmpty) {
        throw const FirebaseFailure(
          code: FirebaseFailureCode.unknown,
          message: 'Anexe ao menos uma foto do comprovante.',
        );
      }

      await _firestore
          .runTransaction((transaction) async {
            final reference = _trips.doc(trip.id);
            final snapshot = await transaction.get(reference);
            final current = snapshot.data();
            if (current == null || current.driverId != uid) {
              throw const FirebaseFailure(
                code: FirebaseFailureCode.permissionDenied,
                message:
                    'Viagem inexistente ou nao pertence ao motorista atual.',
              );
            }
            if (current.driverResponse != DriverTripResponse.accepted) {
              throw const FirebaseFailure(
                code: FirebaseFailureCode.permissionDenied,
                message: 'Aceite a viagem antes de finalizar.',
              );
            }
            if (current.status == TripStatus.completed ||
                current.status == TripStatus.cancelled) {
              throw const FirebaseFailure(
                code: FirebaseFailureCode.permissionDenied,
                message: 'Esta viagem ja foi encerrada.',
              );
            }

            final finished = current.operationType == TripOperationType.loading
                ? TripProgress.releasedLoading
                : TripProgress.releasedUnloading;
            transaction.update(reference, {
              ..._progressUpdate(finished),
              'proofPhotoUrls': proofPhotoUrls,
              'pendingProofPhotoLocalPaths': pendingProofPhotoLocalPaths,
              'proofSubmittedAt': FieldValue.serverTimestamp(),
              'proofSubmittedBy': uid,
            });
          })
          .timeout(const Duration(seconds: 15));
    } on Object catch (error, stackTrace) {
      throw FirebaseFailure.fromException(error, stackTrace);
    }
  }

  Future<void> updateGpsHeartbeatForCurrentDriver(
    String tripId,
    Map<String, dynamic> location,
  ) async {
    try {
      _requireCurrentUserId();
      await _trips.doc(tripId).update({
        'gpsLocation': location,
        'lastGpsUpdateAt': FieldValue.serverTimestamp(),
      });
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

TripProgress? _nextProgress(Trip trip) {
  final stages = TripProgress.optionsFor(trip.operationType);
  final currentIndex = stages.indexOf(trip.progress);
  if (currentIndex < 0) {
    return stages.firstWhere(
      (stage) => stage.tripStatus == TripStatus.inProgress,
      orElse: () => stages.first,
    );
  }
  if (currentIndex >= stages.length - 1) {
    return null;
  }
  return stages[currentIndex + 1];
}

Map<String, Object?> _progressUpdate(
  TripProgress progress, {
  bool markStarted = false,
}) {
  return {
    'status': progress.tripStatus.value,
    'programmingStatus': progress.programmingStatus.value,
    'operationType': progress.operationType.value,
    'operationalStatus': progress.operationalStatusValue,
    'statusUpdatedAt': FieldValue.serverTimestamp(),
    if (progress.tripStatus == TripStatus.inProgress && markStarted)
      'startedAt': FieldValue.serverTimestamp(),
    if (progress.tripStatus == TripStatus.completed)
      'completedAt': FieldValue.serverTimestamp(),
  };
}
