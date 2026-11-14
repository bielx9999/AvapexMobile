import 'dart:async';
import 'dart:io';
import 'dart:ui';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:geolocator/geolocator.dart';

import '../../../../core/config/firebase_initializer.dart';

/// Tracks the assigned trip in a dedicated Android foreground service. The
/// service is started while the app is visible and keeps running when its UI
/// is dismissed; the persistent notification makes tracking visible.
abstract final class TripBackgroundTracking {
  static bool _starting = false;

  static Future<void> configure() async {
    if (!Platform.isAndroid) return;
    await FlutterBackgroundService().configure(
      iosConfiguration: IosConfiguration(autoStart: false),
      androidConfiguration: AndroidConfiguration(
        onStart: tripTrackingServiceStart,
        autoStart: false,
        autoStartOnBoot: false,
        isForegroundMode: true,
        foregroundServiceTypes: [AndroidForegroundType.location],
        initialNotificationTitle: 'Avapex · viagem em andamento',
        initialNotificationContent: 'Compartilhando a posicao com a logistica',
      ),
    );
  }

  static Future<void> sync({required bool hasActiveTrip}) async {
    if (!Platform.isAndroid) return;
    final service = FlutterBackgroundService();
    final running = await service.isRunning();
    if (!hasActiveTrip) {
      if (running) service.invoke('stop');
      return;
    }
    if (running || _starting || !await Geolocator.isLocationServiceEnabled()) {
      return;
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse) {
      _starting = true;
      try {
        await service.startService();
      } finally {
        _starting = false;
      }
    }
  }
}

@pragma('vm:entry-point')
void tripTrackingServiceStart(ServiceInstance service) async {
  WidgetsFlutterBinding.ensureInitialized();
  DartPluginRegistrant.ensureInitialized();

  StreamSubscription<User?>? authSubscription;
  StreamSubscription<QuerySnapshot<Map<String, dynamic>>>? tripsSubscription;
  StreamSubscription<Position>? positionSubscription;
  String? trackingTripId;
  String? driverId;
  DateTime? lastHeartbeatAt;
  DateTime? lastPointAt;

  Future<void> stop() async {
    await positionSubscription?.cancel();
    await tripsSubscription?.cancel();
    await authSubscription?.cancel();
    await service.stopSelf();
  }

  service.on('stop').listen((_) => unawaited(stop()));

  void recordPosition(Position position) {
    final tripId = trackingTripId;
    final uid = driverId;
    if (tripId == null || uid == null) return;
    final now = DateTime.now();
    if (lastHeartbeatAt != null &&
        now.difference(lastHeartbeatAt!) < const Duration(minutes: 1)) {
      return;
    }
    lastHeartbeatAt = now;
    final savePoint =
        lastPointAt == null ||
        now.difference(lastPointAt!) >= const Duration(minutes: 5);
    if (savePoint) lastPointAt = now;

    final firestore = FirebaseFirestore.instance;
    final trip = firestore.collection('trips').doc(tripId);
    final batch = firestore.batch();
    batch.update(trip, {
      'gpsLocation': {
        'latitude': position.latitude,
        'longitude': position.longitude,
        'accuracy': position.accuracy,
        'display':
            '${position.latitude.toStringAsFixed(6)}, ${position.longitude.toStringAsFixed(6)}',
      },
      'lastGpsUpdateAt': FieldValue.serverTimestamp(),
    });
    if (savePoint) {
      batch.set(trip.collection('gpsPoints').doc(), {
        'driverId': uid,
        'latitude': position.latitude,
        'longitude': position.longitude,
        'accuracy': position.accuracy.isFinite
            ? position.accuracy.clamp(0, 100000)
            : 0,
        'recordedAt': FieldValue.serverTimestamp(),
      });
    }
    unawaited(
      batch.commit().catchError((Object _) {
        // Firestore keeps offline writes queued for the next connection.
      }),
    );
  }

  Future<void> watchDriverTrips(User user) async {
    await positionSubscription?.cancel();
    positionSubscription = null;
    trackingTripId = null;
    await tripsSubscription?.cancel();
    driverId = user.uid;
    tripsSubscription = FirebaseFirestore.instance
        .collection('trips')
        .where('driverId', isEqualTo: user.uid)
        .snapshots()
        .listen((snapshot) async {
          final active = snapshot.docs
              .where((trip) {
                final data = trip.data();
                return data['status'] == 'in_progress' &&
                    data['driverResponse'] == 'accepted';
              })
              .toList(growable: false);
          final nextTripId = active.isEmpty ? null : active.first.id;
          if (nextTripId == trackingTripId) return;
          await positionSubscription?.cancel();
          positionSubscription = null;
          trackingTripId = nextTripId;
          lastHeartbeatAt = null;
          lastPointAt = null;
          if (nextTripId == null) {
            if (!snapshot.metadata.isFromCache) unawaited(stop());
            return;
          }
          final permission = await Geolocator.checkPermission();
          if (permission != LocationPermission.always &&
              permission != LocationPermission.whileInUse) {
            unawaited(stop());
            return;
          }
          positionSubscription =
              Geolocator.getPositionStream(
                locationSettings: const LocationSettings(
                  accuracy: LocationAccuracy.high,
                  distanceFilter: 0,
                ),
              ).listen(
                recordPosition,
                onError: (Object _) {
                  // The panel shows an offline state until location becomes available.
                },
              );
        }, onError: (Object _) => unawaited(stop()));
  }

  try {
    await FirebaseInitializer.initialize(configurePersistence: false);
    authSubscription = FirebaseAuth.instance.authStateChanges().listen((user) {
      if (user == null) {
        unawaited(stop());
      } else {
        unawaited(watchDriverTrips(user));
      }
    });
  } on Object {
    unawaited(stop());
  }
}
