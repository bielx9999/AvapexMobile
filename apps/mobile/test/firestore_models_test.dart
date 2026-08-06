import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:logistica_avapex_mobile/features/fueling/data/models/fueling_record_model.dart';
import 'package:logistica_avapex_mobile/features/incidents/data/models/incident_model.dart';
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

  test('Trip converts delivery progress and GPS heartbeat', () {
    final heartbeatAt = DateTime.utc(2026, 8, 4, 15, 30);

    final trip = Trip.fromFirestore({
      'id': 'trip-2',
      'driverId': 'driver-1',
      'vehicleId': 'ABC1D23',
      'origin': 'Campinas',
      'destination': 'Sao Paulo',
      'status': 'in_progress',
      'operationType': 'unloading',
      'programmingStatus': 'unloading',
      'operationalStatus': 'waiting_unloading',
      'scheduledAt': Timestamp.fromDate(DateTime.utc(2026, 8, 4)),
      'gpsLocation': {'latitude': -23.55, 'longitude': -46.63},
      'lastGpsUpdateAt': Timestamp.fromDate(heartbeatAt),
    });

    expect(trip.operationType, TripOperationType.unloading);
    expect(trip.progress, TripProgress.waitingUnloading);
    expect(trip.programmingStatus, TripProgrammingStatus.unloading);
    expect(trip.gpsLocation['latitude'], -23.55);
    expect(
      trip.lastGpsUpdateAt?.millisecondsSinceEpoch,
      heartbeatAt.millisecondsSinceEpoch,
    );
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

  test('Fueling record converts Firestore timestamps and media lists', () {
    final createdAt = DateTime.utc(2026, 7, 27, 14, 30);

    final record = FuelingRecord.fromFirestore({
      'id': 'fueling-1',
      'driverId': 'driver-1',
      'driverName': 'Motorista',
      'vehicleId': 'vehicle-1',
      'vehiclePlate': 'ABC1D23',
      'vehicleModel': 'Truck',
      'kmRegistered': 123456,
      'fuelType': 'diesel',
      'receiptPhotoUrls': ['receipt-url'],
      'odometerPhotoUrls': ['odometer-url'],
      'pendingReceiptPhotoLocalPaths': ['receipt-local'],
      'pendingOdometerPhotoLocalPaths': ['odometer-local'],
      'notificationStatus': 'pending_whatsapp',
      'createdAt': Timestamp.fromDate(createdAt),
    });

    expect(record.fuelType, FuelType.diesel);
    expect(
      record.notificationStatus,
      FuelingNotificationStatus.pendingWhatsapp,
    );
    expect(record.receiptPhotoUrls, ['receipt-url']);
    expect(record.pendingOdometerPhotoLocalPaths, ['odometer-local']);
    expect(record.stationName, isEmpty);
    expect(record.liters, 0);
    expect(record.totalValue, 0);
    expect(
      record.fueledAt.millisecondsSinceEpoch,
      createdAt.millisecondsSinceEpoch,
    );
    expect(
      record.createdAt.millisecondsSinceEpoch,
      createdAt.millisecondsSinceEpoch,
    );
  });

  test('Fueling record preserves complete consumption data', () {
    final fueledAt = DateTime.utc(2026, 8, 6, 9, 15);
    final record = FuelingRecord.fromFirestore({
      'id': 'fueling-2',
      'driverId': 'driver-1',
      'driverName': 'Motorista',
      'vehicleId': 'vehicle-1',
      'vehiclePlate': 'ABC1D23',
      'vehicleModel': 'Truck',
      'kmRegistered': 124000,
      'fuelType': 'diesel',
      'stationName': 'Posto Central',
      'liters': 120.5,
      'totalValue': 742.30,
      'fueledAt': Timestamp.fromDate(fueledAt),
      'receiptPhotoUrls': const <String>[],
      'odometerPhotoUrls': const <String>[],
      'pendingReceiptPhotoLocalPaths': const <String>[],
      'pendingOdometerPhotoLocalPaths': const <String>[],
      'notificationStatus': 'pending_whatsapp',
      'createdAt': Timestamp.fromDate(fueledAt),
    });

    expect(record.stationName, 'Posto Central');
    expect(record.liters, 120.5);
    expect(record.totalValue, 742.30);
    expect(record.toFirestore()['fueledAt'], isA<Timestamp>());
  });

  test('Incident supports new driver categories and queued photo path', () {
    final createdAt = DateTime.utc(2026, 8, 6, 10);
    final incident = Incident.fromFirestore({
      'id': 'incident-1',
      'tripId': 'trip-1',
      'driverId': 'driver-1',
      'type': 'cargo',
      'description': 'Cinta deslocada durante a operacao.',
      'status': 'reported',
      'pendingPhotoLocalPath': 'local/photo.jpg',
      'createdAt': Timestamp.fromDate(createdAt),
    });

    expect(incident.type, IncidentType.cargo);
    expect(incident.pendingPhotoLocalPath, 'local/photo.jpg');
    expect(incident.toFirestore()['type'], 'cargo');
  });
}
