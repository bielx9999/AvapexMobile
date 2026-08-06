import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/trip_model.dart';

abstract final class TripRouteService {
  static List<String> routePoints(Trip trip) {
    final snapshotPoints = trip.routeSnapshot?.points;
    if (snapshotPoints != null && snapshotPoints.length >= 2) {
      return snapshotPoints
          .map((point) => '${point.latitude},${point.longitude}')
          .toList(growable: false);
    }
    return [
      _locationPoint(trip.originLocation, trip.origin),
      ...trip.routeStops.map(
        (stop) => stop.latitude != null && stop.longitude != null
            ? '${stop.latitude},${stop.longitude}'
            : stop.address,
      ),
      _locationPoint(trip.destinationLocation, trip.destination),
    ].where((point) => point.trim().isNotEmpty).toList(growable: false);
  }

  static Uri googleMapsDirectionsUri(Trip trip) {
    final points = routePoints(trip);
    final origin = points.isEmpty ? trip.origin : points.first;
    final destination = points.length < 2 ? trip.destination : points.last;
    final waypoints = points.length > 2
        ? points.sublist(1, points.length - 1).join('|')
        : '';

    return Uri.https('www.google.com', '/maps/dir/', {
      'api': '1',
      'origin': origin,
      'destination': destination,
      if (waypoints.isNotEmpty) 'waypoints': waypoints,
      'travelmode': 'driving',
    });
  }

  static Uri? staticMapUri(
    Trip trip, {
    String? apiKey,
    String? encodedPolyline,
  }) {
    final key = (apiKey ?? _configuredApiKey()).trim();
    final points = routePoints(trip);
    if (key.isEmpty || points.length < 2) {
      return null;
    }

    final savedPolyline =
        encodedPolyline ?? trip.routeSnapshot?.encodedPolyline;
    final query = <String>[
      'size=640x360',
      'scale=2',
      'maptype=roadmap',
      'markers=${Uri.encodeQueryComponent('color:green|label:O|${points.first}')}',
      for (var index = 1; index < points.length - 1; index++)
        'markers=${Uri.encodeQueryComponent('color:yellow|label:${index.clamp(1, 9)}|${points[index]}')}',
      'markers=${Uri.encodeQueryComponent('color:red|label:D|${points.last}')}',
      'path=${Uri.encodeQueryComponent(savedPolyline == null || savedPolyline.isEmpty ? 'color:0x1f1c1cff|weight:5|${points.join('|')}' : 'color:0x1f1c1cff|weight:5|enc:$savedPolyline')}',
      'key=${Uri.encodeQueryComponent(key)}',
    ].join('&');
    return Uri.parse('https://maps.googleapis.com/maps/api/staticmap?$query');
  }

  static Future<Uri?> routePreviewUri(Trip trip) async {
    return staticMapUri(
      trip,
      encodedPolyline: trip.routeSnapshot?.encodedPolyline,
    );
  }

  static Future<bool> openInGoogleMaps(Trip trip) {
    return launchUrl(
      googleMapsDirectionsUri(trip),
      mode: LaunchMode.externalApplication,
    );
  }

  static String _configuredApiKey() {
    try {
      return dotenv.env['GOOGLE_MAPS_API_KEY'] ?? '';
    } on Object {
      return '';
    }
  }

  static String _locationPoint(Map<String, dynamic> location, String fallback) {
    final latitude = location['latitude'];
    final longitude = location['longitude'];
    if (latitude is num && longitude is num) {
      return '$latitude,$longitude';
    }
    return fallback;
  }
}
