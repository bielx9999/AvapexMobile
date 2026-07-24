import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/firebase_providers.dart';
import '../data/models/app_user_model.dart';

final currentUserProfileProvider = StreamProvider<AppUser?>((ref) {
  return ref.watch(userRepositoryProvider).watchCurrentUserProfile();
});
