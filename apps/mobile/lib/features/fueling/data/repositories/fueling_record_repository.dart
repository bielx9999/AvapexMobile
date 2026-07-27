import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../../core/errors/firebase_failure.dart';
import '../../../../core/firebase/firestore_collections.dart';
import '../models/fueling_record_model.dart';

final class FuelingRecordRepository {
  FuelingRecordRepository({FirebaseFirestore? firestore, FirebaseAuth? auth})
    : _firestore = firestore ?? FirebaseFirestore.instance,
      _auth = auth ?? FirebaseAuth.instance;

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  CollectionReference<FuelingRecord> get _records {
    return _firestore
        .collection(FirestoreCollections.fuelingRecords)
        .withConverter<FuelingRecord>(
          fromFirestore: (snapshot, _) => FuelingRecord.fromDocument(snapshot),
          toFirestore: (record, _) => record.toFirestore(),
        );
  }

  Future<void> saveForCurrentDriver(FuelingRecord record) async {
    try {
      final uid = _requireCurrentUserId();
      if (record.driverId != uid) {
        throw const FirebaseFailure(
          code: FirebaseFailureCode.permissionDenied,
          message: 'Abastecimento nao pertence ao motorista atual.',
        );
      }

      await _records
          .doc(record.id)
          .set(record, SetOptions(merge: true))
          .timeout(const Duration(seconds: 10));
    } on Object catch (error, stackTrace) {
      throw FirebaseFailure.fromException(error, stackTrace);
    }
  }

  Stream<List<FuelingRecord>> watchForCurrentDriver() {
    final uid = _requireCurrentUserId();

    return _records
        .where('driverId', isEqualTo: uid)
        .snapshots()
        .map((snapshot) {
          final records = snapshot.docs
              .map((document) => document.data())
              .toList(growable: false);
          records.sort((a, b) => b.createdAt.compareTo(a.createdAt));
          return records;
        })
        .handleError((Object error, StackTrace stackTrace) {
          throw FirebaseFailure.fromException(error, stackTrace);
        });
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
