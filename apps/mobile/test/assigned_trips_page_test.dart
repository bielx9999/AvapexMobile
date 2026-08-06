import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:logistica_avapex_mobile/core/theme/app_theme.dart';
import 'package:logistica_avapex_mobile/features/trips/application/trip_providers.dart';
import 'package:logistica_avapex_mobile/features/trips/data/models/trip_model.dart';
import 'package:logistica_avapex_mobile/features/trips/presentation/assigned_trips_page.dart';

void main() {
  for (final device in <({String name, Size size})>[
    (name: 'phone', size: const Size(390, 844)),
    (name: 'tablet', size: const Size(800, 1000)),
  ]) {
    testWidgets('assigned trips are responsive on a ${device.name}', (
      tester,
    ) async {
      tester.view.physicalSize = device.size;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentDriverTripsProvider.overrideWith(
              (ref) => Stream.value(_trips()),
            ),
          ],
          child: MaterialApp(
            theme: AppTheme.light(),
            home: const Scaffold(body: AssignedTripsPage()),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('CT-e nao informado'), findsOneWidget);
      expect(find.text('Aguardando'), findsAtLeastNWidgets(1));

      await tester.tap(find.text('Aceitas'));
      await tester.pumpAndSettle();
      expect(find.text('CT-e 1001'), findsOneWidget);

      await tester.tap(find.text('Recusadas'));
      await tester.pumpAndSettle();
      expect(find.text('Motivo: Conflito de horario'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}

List<Trip> _trips() {
  final scheduledAt = DateTime.now().add(const Duration(days: 2));
  Trip trip({
    required String id,
    required DriverTripResponse response,
    List<TripDocument> documents = const [],
    TripRejection? rejection,
  }) {
    return Trip(
      id: id,
      driverId: 'driver-1',
      vehicleId: 'vehicle-1',
      origin: 'Guarulhos - SP',
      destination: 'Santos - SP',
      status: TripStatus.pending,
      scheduledAt: scheduledAt,
      deliveryDocs: const [],
      operationType: TripOperationType.loading,
      programmingStatus: TripProgrammingStatus.loading,
      progress: TripProgress.waitingLoading,
      driverResponse: response,
      clientName: 'Cliente Teste',
      vehiclePlate: 'ABC1D23',
      cteDocuments: documents,
      driverRejection: rejection,
    );
  }

  return [
    trip(id: 'pending', response: DriverTripResponse.pending),
    trip(
      id: 'accepted',
      response: DriverTripResponse.accepted,
      documents: const [
        TripDocument(number: '1001'),
        TripDocument(number: '1002'),
      ],
    ),
    trip(
      id: 'rejected',
      response: DriverTripResponse.rejected,
      rejection: const TripRejection(
        reasonCode: 'schedule_conflict',
        reasonLabel: 'Conflito de horario',
      ),
    ),
  ];
}
