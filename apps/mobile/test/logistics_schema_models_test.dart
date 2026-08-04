import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:logistica_avapex_mobile/features/deliveries/data/models/delivery_model.dart';
import 'package:logistica_avapex_mobile/features/routes/data/models/route_event_model.dart';
import 'package:logistica_avapex_mobile/features/routes/data/models/route_plan_model.dart';
import 'package:logistica_avapex_mobile/features/settings/data/models/operational_settings_model.dart';

void main() {
  final serviceDate = DateTime.utc(2026, 8, 5, 8);
  final address = {
    'formattedAddress': 'Av. Paulista, 1000 - Sao Paulo',
    'latitude': -23.5614,
    'longitude': -46.6559,
    'city': 'Sao Paulo',
    'state': 'SP',
  };

  test('RoutePlan reads operational snapshots and optimization metrics', () {
    final route = RoutePlan.fromFirestore({
      'id': 'route-1',
      'code': 'ROT-2026-001',
      'serviceDate': Timestamp.fromDate(serviceDate),
      'status': 'assigned',
      'driverId': 'driver-1',
      'driverName': 'Motorista Teste',
      'vehicleId': 'vehicle-1',
      'vehiclePlate': 'ABC1D23',
      'regionIds': ['sp-capital'],
      'startAddress': address,
      'endAddress': {...address, 'formattedAddress': 'Campinas - SP'},
      'deliveryCount': 8,
      'completedDeliveryCount': 2,
      'plannedDistanceMeters': 125000,
      'plannedDurationSeconds': 7200,
      'optimization': {
        'status': 'optimized',
        'provider': 'google_routes',
        'requestId': 'request-1',
        'optimizedAt': Timestamp.fromDate(serviceDate),
      },
      'createdAt': Timestamp.fromDate(serviceDate),
      'updatedAt': Timestamp.fromDate(serviceDate),
    });

    expect(route.status, RouteStatus.assigned);
    expect(route.deliveryCount, 8);
    expect(route.optimization.status, RouteOptimizationStatus.optimized);
    expect(route.startAddress.city, 'Sao Paulo');
    expect(route.toFirestore()['status'], 'assigned');
  });

  test('Delivery reads proof policy, check-in and failure', () {
    final delivery = Delivery.fromFirestore({
      'id': 'delivery-1',
      'routeId': 'route-1',
      'orderNumber': 'PED-1001',
      'driverId': 'driver-1',
      'vehicleId': 'vehicle-1',
      'sequence': 3,
      'status': 'not_delivered',
      'address': address,
      'scheduledAt': Timestamp.fromDate(serviceDate),
      'proofRequirements': {
        'requirePhoto': true,
        'requireReceiverName': true,
        'requireReceiverDocument': true,
        'requireSignature': false,
        'requireLocation': true,
      },
      'proofStatus': 'pending',
      'failure': {
        'reasonCode': 'CLIENT_ABSENT',
        'reasonLabel': 'Cliente ausente',
        'notes': 'Portaria fechada',
        'registeredAt': Timestamp.fromDate(serviceDate),
      },
      'createdAt': Timestamp.fromDate(serviceDate),
      'updatedAt': Timestamp.fromDate(serviceDate),
    });

    expect(delivery.status, DeliveryStatus.notDelivered);
    expect(delivery.proofRequirements.requireSignature, isFalse);
    expect(delivery.failure?.reasonCode, 'CLIENT_ABSENT');
    expect(delivery.toFirestore()['orderNumber'], 'PED-1001');
  });

  test('RouteEvent preserves append-only audit fields', () {
    final event = RouteEvent.fromFirestore({
      'id': 'event-1',
      'routeId': 'route-1',
      'deliveryId': 'delivery-1',
      'driverId': 'driver-1',
      'vehicleId': 'vehicle-1',
      'type': 'delivery_check_in',
      'source': 'driver',
      'actorId': 'driver-1',
      'actorName': 'Motorista Teste',
      'fromStatus': 'in_route',
      'toStatus': 'arrived',
      'occurredAt': Timestamp.fromDate(serviceDate),
    });

    expect(event.type, RouteEventType.deliveryCheckIn);
    expect(event.source, RouteEventSource.driver);
    expect(event.toFirestore()['toStatus'], 'arrived');
    expect(event.toFirestore()['createdAt'], isA<FieldValue>());
  });

  test('OperationalSettings selects the typed fixed document', () {
    final settings = OperationalSettings.fromFirestore({
      'id': 'delivery',
      'kind': 'delivery',
      'version': 1,
      'checkInRadiusMeters': 120,
      'defaultProofRequirements': {
        'requirePhoto': true,
        'requireReceiverName': true,
        'requireReceiverDocument': true,
        'requireSignature': false,
        'requireLocation': true,
      },
      'failureReasons': [
        {
          'code': 'CLIENT_ABSENT',
          'label': 'Cliente ausente',
          'active': true,
          'requireNotes': true,
          'requirePhoto': true,
        },
      ],
      'statusTransitions': {
        'pending': ['in_route', 'cancelled'],
      },
      'updatedAt': Timestamp.fromDate(serviceDate),
      'updatedBy': 'admin-1',
    });

    expect(settings, isA<DeliverySettings>());
    expect((settings as DeliverySettings).checkInRadiusMeters, 120);
    expect(settings.failureReasons.single.requirePhoto, isTrue);
  });
}
