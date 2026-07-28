import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { firestore } from '../../../core/firebase/firebaseConfig';
import { makeConverter } from '../../../core/firebase/firestoreConverters';
import { mapFirebaseError } from '../../../core/firebase/firebaseErrors';
import {
  mapChecklist,
  mapDeliveryReceipt,
  mapDriverEquipment,
  mapFuelingRecord,
  mapTrip,
  mapUser,
  mapVehicle,
} from './mappers';
import type {
  AppUser,
  Checklist,
  DeliveryReceipt,
  DriverEquipment,
  FuelingRecord,
  Trip,
  Vehicle,
} from '../domain/models';

const converters = {
  users: makeConverter<AppUser>(mapUser),
  vehicles: makeConverter<Vehicle>(mapVehicle),
  trips: makeConverter<Trip>(mapTrip),
  checklists: makeConverter<Checklist>(mapChecklist),
  deliveryReceipts: makeConverter<DeliveryReceipt>(mapDeliveryReceipt),
  fuelingRecords: makeConverter<FuelingRecord>(mapFuelingRecord),
  driverEquipments: makeConverter<DriverEquipment>(mapDriverEquipment),
};

function typedCollection<T>(path: keyof typeof converters) {
  return collection(firestore, path).withConverter(converters[path] as ReturnType<typeof makeConverter<T>>);
}

async function listCollection<T>(
  path: keyof typeof converters,
  constraints: QueryConstraint[],
  fallbackMessage: string,
): Promise<T[]> {
  try {
    const snapshot = await getDocs(query(typedCollection<T>(path), ...constraints));
    return snapshot.docs.map((document) => document.data());
  } catch (error) {
    throw mapFirebaseError(error, fallbackMessage);
  }
}

function tripStatusFromProgrammingStatus(programmingStatus: NonNullable<Trip['programmingStatus']>): Trip['status'] {
  if (programmingStatus === 'released') {
    return 'completed';
  }
  if (programmingStatus === 'loading') {
    return 'pending';
  }
  return 'in_progress';
}

export const adminReadRepository = {
  users: () => listCollection<AppUser>('users', [orderBy('createdAt', 'desc'), limit(200)], 'Erro ao listar usuarios.'),
  vehicles: () => listCollection<Vehicle>('vehicles', [orderBy('plate', 'asc'), limit(200)], 'Erro ao listar veiculos.'),
  trips: () => listCollection<Trip>('trips', [orderBy('scheduledAt', 'desc'), limit(200)], 'Erro ao listar viagens.'),
  checklists: () => listCollection<Checklist>('checklists', [orderBy('createdAt', 'desc'), limit(200)], 'Erro ao listar checklists.'),
  deliveryReceipts: () =>
    listCollection<DeliveryReceipt>('deliveryReceipts', [orderBy('createdAt', 'desc'), limit(200)], 'Erro ao listar comprovantes.'),
  fuelingRecords: () =>
    listCollection<FuelingRecord>('fuelingRecords', [orderBy('createdAt', 'desc'), limit(200)], 'Erro ao listar abastecimentos.'),
  driverEquipments: (driverId?: string) => {
    const constraints: QueryConstraint[] = [orderBy('tagNumber', 'asc'), limit(300)];
    if (driverId) {
      constraints.unshift(where('driverId', '==', driverId));
    }
    return listCollection<DriverEquipment>('driverEquipments', constraints, 'Erro ao listar equipamentos.');
  },
};

export const adminWriteRepository = {
  async markDeliveryReceiptDelivered(receiptId: string) {
    try {
      await updateDoc(doc(firestore, 'deliveryReceipts', receiptId), {
        adminStatus: 'delivered',
        failureReason: '',
        driverNotificationMessage: '',
        driverNotificationStatus: 'not_sent',
        reviewedAt: serverTimestamp(),
      });
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao registrar comprovante como entregue.');
    }
  },

  async markDeliveryReceiptFailed(receiptId: string, reason: string, notificationMessage: string) {
    try {
      await updateDoc(doc(firestore, 'deliveryReceipts', receiptId), {
        adminStatus: 'failed',
        failureReason: reason.trim(),
        driverNotificationMessage: notificationMessage.trim(),
        driverNotificationStatus: notificationMessage.trim() ? 'queued' : 'not_sent',
        reviewedAt: serverTimestamp(),
      });
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao registrar falha no comprovante.');
    }
  },

  async updateFuelingNotificationStatus(recordId: string, status: string) {
    try {
      await updateDoc(doc(firestore, 'fuelingRecords', recordId), {
        notificationStatus: status,
        reviewedAt: serverTimestamp(),
      });
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao atualizar abastecimento.');
    }
  },

  async saveTrip(trip: Omit<Trip, 'id' | 'startedAt' | 'completedAt' | 'deliveryDocs'> & { id?: string }) {
    try {
      const data: DocumentData = {
        driverId: trip.driverId,
        vehicleId: trip.vehicleId,
        origin: trip.origin.trim(),
        destination: trip.destination.trim(),
        status: tripStatusFromProgrammingStatus(trip.programmingStatus ?? 'loading'),
        scheduledAt: trip.scheduledAt,
        driverName: trip.driverName ?? '',
        vehiclePlate: trip.vehiclePlate ?? '',
        vehicleModel: trip.vehicleModel ?? '',
        programmingStatus: trip.programmingStatus ?? 'loading',
        returnTrip: trip.returnTrip ?? false,
        customerRequestNumber: trip.customerRequestNumber?.trim() ?? '',
        programmedVehicleType: trip.programmedVehicleType ?? 'truck',
      };

      if (trip.id) {
        await updateDoc(doc(firestore, 'trips', trip.id), data);
        return trip.id;
      }

      const created = await addDoc(collection(firestore, 'trips'), {
        ...data,
        startedAt: null,
        completedAt: null,
        deliveryDocs: [],
      });
      await updateDoc(created, { id: created.id });
      return created.id;
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao salvar programacao.');
    }
  },

  async updateTripStatus(tripId: string, status: Trip['status']) {
    try {
      const data: DocumentData = { status };
      if (status === 'in_progress') {
        data.startedAt = serverTimestamp();
        data.completedAt = null;
      }
      if (status === 'completed' || status === 'cancelled') {
        data.completedAt = serverTimestamp();
      }
      if (status === 'pending') {
        data.startedAt = null;
        data.completedAt = null;
      }
      await updateDoc(doc(firestore, 'trips', tripId), data);
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao atualizar status da programacao.');
    }
  },

  async updateTripProgrammingStatus(tripId: string, programmingStatus: NonNullable<Trip['programmingStatus']>) {
    try {
      const status = tripStatusFromProgrammingStatus(programmingStatus);
      const data: DocumentData = { programmingStatus, status };
      if (status === 'in_progress') {
        data.startedAt = serverTimestamp();
        data.completedAt = null;
      }
      if (status === 'completed') {
        data.completedAt = serverTimestamp();
      }
      await updateDoc(doc(firestore, 'trips', tripId), data);
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao atualizar etapa da programacao.');
    }
  },

  async saveVehicle(vehicle: Omit<Vehicle, 'id'> & { id?: string }) {
    try {
      const id = vehicle.id?.trim() || vehicle.plate.trim().toUpperCase();
      const ref = doc(firestore, 'vehicles', id);
      await setDoc(ref, { ...vehicle, id, plate: vehicle.plate.trim().toUpperCase() }, { merge: true });
      return id;
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao salvar veiculo.');
    }
  },

  async saveDriverEquipment(equipment: Omit<DriverEquipment, 'id'> & { id?: string }) {
    try {
      const data: DocumentData = {
        driverId: equipment.driverId,
        type: equipment.type,
        tagNumber: equipment.tagNumber,
        status: equipment.status,
        description: equipment.description ?? '',
      };
      if (equipment.id) {
        await updateDoc(doc(firestore, 'driverEquipments', equipment.id), data);
        return equipment.id;
      }
      const created = await addDoc(collection(firestore, 'driverEquipments'), {
        ...data,
        createdAt: serverTimestamp(),
      });
      await updateDoc(created, { id: created.id });
      return created.id;
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao salvar equipamento.');
    }
  },
};
