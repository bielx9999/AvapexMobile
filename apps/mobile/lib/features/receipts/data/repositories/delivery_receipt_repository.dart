import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../../core/errors/firebase_failure.dart';
import '../../../../core/firebase/firestore_collections.dart';
import '../../../deliveries/data/models/delivery_model.dart';
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

  Future<void> saveForCurrentDriver({
    required DeliveryReceipt receipt,
    required Delivery delivery,
  }) async {
    try {
      final uid = _requireCurrentUserId();
      if (receipt.driverId != uid || delivery.driverId != uid) {
        throw const FirebaseFailure(
          code: FirebaseFailureCode.permissionDenied,
          message: 'Comprovante nao pertence ao motorista atual.',
        );
      }

      if (receipt.deliveryId != delivery.id ||
          receipt.routeId != delivery.routeId ||
          receipt.orderNumber != delivery.orderNumber) {
        throw const FirebaseFailure(
          code: FirebaseFailureCode.permissionDenied,
          message: 'Dados do comprovante nao correspondem a entrega.',
        );
      }

      if (delivery.cteAccessKey.isNotEmpty &&
          receipt.cteAccessKey != delivery.cteAccessKey) {
        throw const FirebaseFailure(
          code: FirebaseFailureCode.permissionDenied,
          message: 'A chave CT-e nao corresponde a entrega selecionada.',
        );
      }

      if (delivery.proofStatus == DeliveryProofStatus.submitted ||
          delivery.proofStatus == DeliveryProofStatus.approved) {
        throw const FirebaseFailure(
          code: FirebaseFailureCode.permissionDenied,
          message: 'Esta entrega ja possui um comprovante em analise.',
        );
      }

      final batch = _firestore.batch();
      batch.set(_receipts.doc(receipt.id), receipt, SetOptions(merge: false));
      batch.update(
        _firestore.collection(FirestoreCollections.deliveries).doc(delivery.id),
        {
          'proofStatus': DeliveryProofStatus.submitted.value,
          'deliveryProofId': receipt.id,
          'updatedAt': FieldValue.serverTimestamp(),
          'updatedBy': uid,
        },
      );

      if (delivery.routeId.isNotEmpty) {
        final eventId = 'proof_submitted_${receipt.id}';
        batch.set(
          _firestore.collection(FirestoreCollections.routeEvents).doc(eventId),
          {
            'id': eventId,
            'routeId': delivery.routeId,
            'deliveryId': delivery.id,
            'driverId': uid,
            'vehicleId': delivery.vehicleId,
            'type': 'delivery_proof_submitted',
            'source': 'driver',
            'actorId': uid,
            'actorName': receipt.driverName,
            'fromStatus': delivery.proofStatus.value,
            'toStatus': DeliveryProofStatus.submitted.value,
            'message': 'Comprovante de entrega enviado pelo motorista.',
            'metadata': {'receiptId': receipt.id},
            'location': receipt.location,
            'occurredAt': Timestamp.fromDate(receipt.createdAt),
            'createdAt': FieldValue.serverTimestamp(),
          },
        );
      }

      await batch.commit().timeout(const Duration(seconds: 10));
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
