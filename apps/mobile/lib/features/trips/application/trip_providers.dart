import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/firebase_providers.dart';
import '../data/models/trip_model.dart';

final currentDriverTripsProvider = StreamProvider<List<Trip>>((ref) {
  return ref.watch(tripRepositoryProvider).watchCurrentDriverTrips();
});
