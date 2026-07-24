import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/firebase_providers.dart';
import '../data/models/checklist_model.dart';

final tripChecklistsProvider = StreamProvider.family<List<Checklist>, String>((
  ref,
  tripId,
) {
  return ref
      .watch(checklistRepositoryProvider)
      .watchByTripForCurrentDriver(tripId);
});

final checklistHistoryProvider = StreamProvider<List<Checklist>>((ref) {
  return ref.watch(checklistRepositoryProvider).watchHistoryForCurrentDriver();
});
