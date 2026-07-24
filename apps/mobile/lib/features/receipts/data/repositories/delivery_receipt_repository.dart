import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../../core/errors/firebase_failure.dart';
import '../../../../core/firebase/firestore_collections.dart';
import '../models/delivery_receipt_model.dart';

final class DeliveryReceiptRepository {
  DeliveryReceiptRepository({FirebaseFirestore? firestore, FirebaseAuth? auth})
    : _firestore = firestore ?? FirebaseFirestore.instance,
      _auth = auth ?? FirebaseAuth.instance;

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  CollectionReference<DeliveryReceipt> get _receipts {
    return _firestore
        .collection(FirestoreCollections.deliveryReceipts)
        .withConverter<DeliveryReceipt>(
          fromFirestore: (snapshot, _) =>
              DeliveryReceipt.fromDocument(snapshot),
          toFirestore: (receipt, _) => receipt.toFirestore(),
        );
  }

  Future<void> saveForCurrentDriver(DeliveryReceipt receipt) async {
    try {
      final uid = _requireCurrentUserId();
      if (receipt.driverId != uid) {
        throw const FirebaseFailure(
          code: FirebaseFailureCode.permissionDenied,
          message: 'Comprovante nao pertence ao motorista atual.',
        );
      }

      await _receipts
          .doc(receipt.id)
          .set(receipt, SetOptions(merge: true))
          .timeout(const Duration(seconds: 10));
    } on Object catch (error, stackTrace) {
      throw FirebaseFailure.fromException(error, stackTrace);
    }
  }

  Stream<List<DeliveryReceipt>> watchForCurrentDriver() {
    final uid = _requireCurrentUserId();

    return _receipts
        .where('driverId', isEqualTo: uid)
        .snapshots()
        .map((snapshot) {
          final receipts = snapshot.docs
              .map((document) => document.data())
              .toList(growable: false);
          receipts.sort((a, b) => b.createdAt.compareTo(a.createdAt));
          return receipts;
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
