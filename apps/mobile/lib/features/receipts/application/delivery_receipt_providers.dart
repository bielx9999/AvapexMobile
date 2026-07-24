import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/firebase_providers.dart';
import '../data/models/delivery_receipt_model.dart';
import '../data/repositories/delivery_receipt_repository.dart';

final deliveryReceiptRepositoryProvider = Provider<DeliveryReceiptRepository>((
  ref,
) {
  return DeliveryReceiptRepository(
    firestore: ref.watch(firebaseFirestoreProvider),
    auth: ref.watch(firebaseAuthProvider),
  );
});

final driverDeliveryReceiptsProvider = StreamProvider<List<DeliveryReceipt>>((
  ref,
) {
  return ref.watch(deliveryReceiptRepositoryProvider).watchForCurrentDriver();
});
