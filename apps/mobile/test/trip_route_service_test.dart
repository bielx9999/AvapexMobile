import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:logistica_avapex_mobile/features/trips/data/models/trip_model.dart';
import 'package:logistica_avapex_mobile/features/trips/data/services/trip_route_service.dart';

void main() {
  test('builds Google Maps directions with automatic intermediate stops', () {
    final trip = _trip();
    final uri = TripRouteService.googleMapsDirectionsUri(trip);

    expect(uri.host, 'www.google.com');
    expect(uri.queryParameters['origin'], 'Guarulhos - SP');
    expect(uri.queryParameters['destination'], 'Santos - SP');
    expect(uri.queryParameters['waypoints'], 'Cubatao - SP');
  });

  test('builds an in-app static map only when a key is configured', () {
    final trip = _trip();

    expect(TripRouteService.staticMapUri(trip, apiKey: ''), isNull);
    final uri = TripRouteService.staticMapUri(trip, apiKey: 'test-key');
    expect(uri, isNotNull);
    expect(uri.toString(), contains('maps.googleapis.com/maps/api/staticmap'));
    expect(uri.toString(), contains('test-key'));
  });

  test('prefers structured coordinates over typed route text', () {
    final uri = TripRouteService.googleMapsDirectionsUri(
      _trip(structured: true),
    );

    expect(uri.queryParameters['origin'], '-23.4,-46.5');
    expect(uri.queryParameters['waypoints'], '-23.9,-46.4');
    expect(uri.queryParameters['destination'], '-23.95,-46.33');
  });

  test('uses the Directions API polyline in the route preview', () async {
    final client = MockClient((request) async {
      expect(request.url.path, '/maps/api/directions/json');
      expect(request.url.queryParameters['waypoints'], 'Cubatao - SP');
      return http.Response(
        '{"status":"OK","routes":[{"overview_polyline":{"points":"encoded-route"}}]}',
        200,
      );
    });

    final polyline = await TripRouteService.fetchRoutePolyline(
      _trip(),
      apiKey: 'test-key',
      client: client,
    );
    final mapUri = TripRouteService.staticMapUri(
      _trip(),
      apiKey: 'test-key',
      encodedPolyline: polyline,
    );

    expect(polyline, 'encoded-route');
    expect(mapUri.toString(), contains('enc%3Aencoded-route'));
  });
}

Trip _trip({bool structured = false}) {
  return Trip(
    id: 'trip-1',
    driverId: 'driver-1',
    vehicleId: 'vehicle-1',
    origin: 'Guarulhos - SP',
    destination: 'Santos - SP',
    status: TripStatus.pending,
    scheduledAt: DateTime(2026, 8, 8),
    deliveryDocs: const [],
    operationType: TripOperationType.loading,
    programmingStatus: TripProgrammingStatus.loading,
    progress: TripProgress.waitingLoading,
    originLocation: structured
        ? const {'latitude': -23.4, 'longitude': -46.5}
        : const {},
    destinationLocation: structured
        ? const {'latitude': -23.95, 'longitude': -46.33}
        : const {},
    routeStops: [
      TripStop(
        name: 'Parada 1',
        address: 'Cubatao - SP',
        latitude: structured ? -23.9 : null,
        longitude: structured ? -46.4 : null,
      ),
    ],
  );
}
