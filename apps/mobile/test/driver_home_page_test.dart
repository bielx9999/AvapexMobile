import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:logistica_avapex_mobile/core/theme/app_theme.dart';
import 'package:logistica_avapex_mobile/features/checklists/application/checklist_providers.dart';
import 'package:logistica_avapex_mobile/features/deliveries/application/delivery_providers.dart';
import 'package:logistica_avapex_mobile/features/driver/presentation/driver_home_page.dart';
import 'package:logistica_avapex_mobile/features/trips/application/trip_providers.dart';
import 'package:logistica_avapex_mobile/features/trips/data/models/trip_model.dart';
import 'package:logistica_avapex_mobile/features/users/application/user_providers.dart';
import 'package:logistica_avapex_mobile/features/users/data/models/app_user_model.dart';

void main() {
  for (final device in <({String name, Size size})>[
    (name: 'phone', size: const Size(390, 844)),
    (name: 'tablet', size: const Size(800, 1000)),
  ]) {
    testWidgets('driver Home keeps actions accessible on a ${device.name}', (
      tester,
    ) async {
      tester.view.physicalSize = device.size;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final scheduledAt = DateTime(2026, 8, 7, 7, 30);
      final trip = Trip(
        id: 'trip-1',
        driverId: 'driver-1',
        vehicleId: 'vehicle-1',
        origin: 'Guarulhos - SP',
        destination: 'Campinas - SP',
        status: TripStatus.pending,
        scheduledAt: scheduledAt,
        deliveryDocs: const [],
        operationType: TripOperationType.loading,
        programmingStatus: TripProgrammingStatus.loading,
        progress: TripProgress.waitingLoading,
        vehiclePlate: 'ABC1D23',
      );
      final user = AppUser(
        uid: 'driver-1',
        name: 'Joao Silva',
        email: 'joao@avapex.com.br',
        phone: '11999999999',
        role: UserRole.driver,
        status: UserStatus.active,
        createdAt: DateTime(2026),
        cnh: DriverLicense(
          number: '12345678900',
          category: 'E',
          expirationDate: DateTime(2028),
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentUserProfileProvider.overrideWith(
              (ref) => Stream.value(user),
            ),
            currentDriverTripsProvider.overrideWith(
              (ref) => Stream.value([trip]),
            ),
            currentDriverDeliveriesProvider.overrideWith(
              (ref) => Stream.value(const []),
            ),
            checklistHistoryProvider.overrideWith(
              (ref) => Stream.value(const []),
            ),
          ],
          child: MaterialApp(
            theme: AppTheme.light(),
            home: Scaffold(body: DriverHomePage(onAction: (_) {})),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Joao'), findsOneWidget);
      expect(find.text('Checklist'), findsOneWidget);
      expect(find.text('Viagens atribuidas'), findsAtLeastNWidgets(1));
      expect(find.text('Comprovantes'), findsOneWidget);
      expect(find.text('Ocorrencias'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
