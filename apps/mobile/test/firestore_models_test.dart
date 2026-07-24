import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:logistica_avapex_mobile/features/trips/data/models/trip_model.dart';
import 'package:logistica_avapex_mobile/features/users/data/models/app_user_model.dart';

void main() {
  test('Trip converts Firestore timestamps and nullable dates', () {
    final scheduledAt = DateTime.utc(2026, 7, 22, 12);

    final trip = Trip.fromFirestore({
      'id': 'trip-1',
      'driverId': 'driver-1',
      'vehicleId': 'ABC1D23',
      'origin': 'Sao Paulo',
      'destination': 'Campinas',
      'status': 'pending',
      'scheduledAt': Timestamp.fromDate(scheduledAt),
      'startedAt': null,
      'completedAt': null,
      'deliveryDocs': ['storage-url'],
    });

    expect(trip.status, TripStatus.pending);
    expect(
      trip.scheduledAt.millisecondsSinceEpoch,
      scheduledAt.millisecondsSinceEpoch,
    );
    expect(trip.startedAt, isNull);
    expect(trip.deliveryDocs, ['storage-url']);
  });

  test('Driver user requires CNH data', () {
    expect(
      () => AppUser.fromFirestore({
        'uid': 'driver-1',
        'name': 'Motorista',
        'email': 'driver@example.com',
        'phone': '11999999999',
        'role': 'driver',
        'status': 'active',
        'createdAt': Timestamp.fromDate(DateTime.utc(2026)),
      }),
      throwsFormatException,
    );
  });
}
