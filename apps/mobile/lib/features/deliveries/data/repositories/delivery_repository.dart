import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../../core/errors/firebase_failure.dart';
import '../../../../core/firebase/firestore_collections.dart';
import '../models/delivery_model.dart';

final class DeliveryRepository {
  DeliveryRepository({FirebaseFirestore? firestore, FirebaseAuth? auth})
    : _firestore = firestore ?? FirebaseFirestore.instance,
      _auth = auth ?? FirebaseAuth.instance;

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  CollectionReference<Delivery> get _deliveries => _firestore
      .collection(FirestoreCollections.deliveries)
      .withConverter<Delivery>(
        fromFirestore: (snapshot, _) => Delivery.fromDocument(snapshot),
        toFirestore: (delivery, _) => delivery.toFirestore(),
      );

  Stream<List<Delivery>> watchForCurrentDriver() {
    final uid = _requireCurrentUserId();
    return _deliveries
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
