import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp, Timestamp, type Unsubscribe } from 'firebase/firestore';
import { auth, firestore } from '../../../core/firebase/firebaseConfig';

export type TripMessage = {
  id: string;
  senderId: string;
  senderRole: 'admin' | 'driver';
  text: string;
  createdAt: Date | null;
};

export type TripGpsPoint = {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  recordedAt: Date | null;
};

export function watchTripMessages(tripId: string, onData: (messages: TripMessage[]) => void, onError: (error: Error) => void): Unsubscribe {
  const messages = query(collection(firestore, 'trips', tripId, 'messages'), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(messages, (snapshot) => {
    onData(snapshot.docs.map((item): TripMessage => {
      const data = item.data();
      return {
        id: item.id,
        senderId: String(data.senderId ?? ''),
        senderRole: data.senderRole === 'driver' ? 'driver' : 'admin',
        text: String(data.text ?? ''),
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
      };
    }).reverse());
  }, onError);
}

export function watchTripGpsPoints(tripId: string, onData: (points: TripGpsPoint[]) => void, onError: (error: Error) => void): Unsubscribe {
  const points = query(collection(firestore, 'trips', tripId, 'gpsPoints'), orderBy('recordedAt', 'desc'), limit(100));
  return onSnapshot(points, (snapshot) => {
    onData(snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        accuracy: Number(data.accuracy),
        recordedAt: data.recordedAt instanceof Timestamp ? data.recordedAt.toDate() : null,
      };
    }).filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)));
  }, onError);
}

export async function sendAdminTripMessage(tripId: string, text: string): Promise<void> {
  const senderId = auth.currentUser?.uid;
  const message = text.trim();
  if (!senderId) throw new Error('Entre novamente para enviar a mensagem.');
  if (!message || message.length > 1000) throw new Error('A mensagem deve ter entre 1 e 1000 caracteres.');
  await addDoc(collection(firestore, 'trips', tripId, 'messages'), {
    senderId,
    senderRole: 'admin',
    text: message,
    createdAt: serverTimestamp(),
  });
}
