import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../../core/errors/firebase_failure.dart';
import '../../../../core/firebase/firestore_collections.dart';
import '../models/driver_equipment_model.dart';

final class DriverEquipmentRepository {
  DriverEquipmentRepository({FirebaseFirestore? firestore, FirebaseAuth? auth})
    : _firestore = firestore ?? FirebaseFirestore.instance,
      _auth = auth ?? FirebaseAuth.instance;

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  CollectionReference<DriverEquipment> get _equipment {
    return _firestore
        .collection(FirestoreCollections.driverEquipments)
        .withConverter<DriverEquipment>(
          fromFirestore: (snapshot, _) =>
              DriverEquipment.fromDocument(snapshot),
          toFirestore: (_, _) => throw UnsupportedError(
            'Driver equipment is managed by the administrative panel.',
          ),
        );
  }

  Stream<List<DriverEquipment>> watchAvailableForCurrentDriver({
    required Set<DriverEquipmentType> types,
  }) {
    final uid = _requireCurrentUserId();

    return _equipment
        .where('driverId', isEqualTo: uid)
        .snapshots()
        .map((snapshot) {
          final equipment = snapshot.docs
              .map((document) => document.data())
              .where((item) => types.contains(item.type) && item.isAvailable)
              .toList(growable: false);
          equipment.sort((a, b) {
            final typeCompare = a.type.index.compareTo(b.type.index);
            if (typeCompare != 0) {
              return typeCompare;
            }
            return a.tagNumber.compareTo(b.tagNumber);
          });
          return equipment;
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
