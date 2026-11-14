import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

final class TripMessage {
  const TripMessage({
    required this.id,
    required this.senderRole,
    required this.text,
    required this.createdAt,
  });

  final String id;
  final String senderRole;
  final String text;
  final DateTime? createdAt;

  factory TripMessage.fromDocument(
    DocumentSnapshot<Map<String, dynamic>> document,
  ) {
    final data = document.data() ?? const <String, dynamic>{};
    return TripMessage(
      id: document.id,
      senderRole: data['senderRole'] == 'admin' ? 'admin' : 'driver',
      text: (data['text'] as String?) ?? '',
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
    );
  }
}

final class TripMessageRepository {
  TripMessageRepository({FirebaseFirestore? firestore, FirebaseAuth? auth})
    : _firestore = firestore ?? FirebaseFirestore.instance,
      _auth = auth ?? FirebaseAuth.instance;

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  Stream<List<TripMessage>> watchForTrip(String tripId) {
    return _firestore
        .collection('trips')
        .doc(tripId)
        .collection('messages')
        .orderBy('createdAt', descending: true)
        .limit(50)
        .snapshots()
        .map(
          (snapshot) => snapshot.docs
              .map(TripMessage.fromDocument)
              .toList(growable: false)
              .reversed
              .toList(growable: false),
        );
  }

  Future<void> send(String tripId, String text) async {
    final uid = _auth.currentUser?.uid;
    final message = text.trim();
    if (uid == null || uid.isEmpty) {
      throw StateError('Motorista nao autenticado.');
    }
    if (message.isEmpty || message.length > 1000) {
      throw ArgumentError('A mensagem deve ter entre 1 e 1000 caracteres.');
    }
    await _firestore
        .collection('trips')
        .doc(tripId)
        .collection('messages')
        .add({
          'senderId': uid,
          'senderRole': 'driver',
          'text': message,
          'createdAt': FieldValue.serverTimestamp(),
        });
  }
}
