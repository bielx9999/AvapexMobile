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
        .collection(FirestoreCollections.equipment)
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
        .where('currentDriverId', isEqualTo: uid)
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

  Future<String> saveDriverChecklist({
    required List<DriverEquipment> equipment,
    required Map<String, Map<String, String>> results,
  }) async {
    try {
      final uid = _requireCurrentUserId();
      if (equipment.isEmpty) {
        throw const FirebaseFailure(
          code: FirebaseFailureCode.unknown,
          message: 'Nao existem equipamentos vinculados ao seu veiculo.',
        );
      }
      final inspectionRef = _firestore
          .collection(FirestoreCollections.equipmentInspections)
          .doc();
      final hasIssue = results.values.any(
        (result) => result['result'] != 'ok',
      );
      final batch = _firestore.batch();
      batch.set(inspectionRef, {
        'id': inspectionRef.id,
        'vehicleId': equipment.first.vehicleId,
        'vehiclePlate': equipment.first.vehiclePlate,
        'inspectionType': 'driver_checklist',
        'referenceMonth': DateTime.now().month,
        'referenceYear': DateTime.now().year,
        'performedAt': FieldValue.serverTimestamp(),
        'performedByUserId': uid,
        'responsibleDriverId': uid,
        'responsibleDriverName': '',
        'status': hasIssue ? 'divergence' : 'completed',
        'notes': '',
        'photoUrls': <String>[],
        'items': equipment.map((item) {
          final result = results[item.id] ?? const <String, String>{};
          return {
            'equipmentId': item.id,
            'equipmentCode': item.tagNumber,
            'equipmentType': item.type.value,
            'expected': true,
            'result': result['result'] ?? 'ok',
            'observation': result['observation'] ?? '',
            'photoUrl': '',
          };
        }).toList(growable: false),
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      for (final item in equipment) {
        final result = results[item.id] ?? const <String, String>{};
        if (result['result'] == 'ok') {
          continue;
        }
        final occurrenceRef = _firestore
            .collection(FirestoreCollections.equipmentOccurrences)
            .doc();
        batch.set(occurrenceRef, {
          'id': occurrenceRef.id,
          'equipmentId': item.id,
          'equipmentCode': item.tagNumber,
          'vehicleId': item.vehicleId,
          'vehiclePlate': item.vehiclePlate,
          'type': result['result'] == 'not_found' ? 'not_found' : 'damaged',
          'reportedBy': uid,
          'reportedAt': FieldValue.serverTimestamp(),
          'description': result['observation'] ?? '',
          'status': 'open',
          'resolvedAt': null,
          'resolvedBy': '',
          'photoUrl': '',
          'sourceInspectionId': inspectionRef.id,
        });
      }
      await batch.commit().timeout(const Duration(seconds: 15));
      return inspectionRef.id;
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
