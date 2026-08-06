import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/firebase_providers.dart';
import '../data/models/incident_model.dart';

final driverIncidentsProvider = StreamProvider<List<Incident>>((ref) {
  return ref.watch(incidentRepositoryProvider).watchCurrentDriverIncidents();
});
