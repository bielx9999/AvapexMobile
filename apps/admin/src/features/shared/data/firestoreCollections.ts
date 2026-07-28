import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
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

function nextDaySameTime(value: Date | null) {
  const nextDate = value ? new Date(value) : new Date();
  nextDate.setDate(nextDate.getDate() + 1);
  return nextDate;
}

function defaultOperationalStatus(programmingStatus: NonNullable<Trip['programmingStatus']>): Trip['operationalStatus'] {
  if (programmingStatus === 'in_transit') {
    return 'transit_to_loading';
  }
  if (programmingStatus === 'loading') {
    return 'waiting_loading';
  }
  if (programmingStatus === 'unloading') {
    return 'waiting_unloading';
  }
  if (programmingStatus === 'released') {
    return 'released_unloading';
  }
  return undefined;
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
        operationalStatus: trip.operationalStatus ?? defaultOperationalStatus(trip.programmingStatus ?? 'loading') ?? null,
        returnTrip: trip.returnTrip ?? false,
        customerRequestNumber: trip.customerRequestNumber?.trim() ?? '',
        programmedVehicleType: trip.programmedVehicleType ?? 'truck',
        operationType: trip.operationType ?? 'loading',
        expectedArrivalAt: trip.expectedArrivalAt ?? null,
        additionalInfo: trip.additionalInfo?.trim() ?? '',
      };

      if (trip.id) {
        await updateDoc(doc(firestore, 'trips', trip.id), data);
        return trip.id;
      }

      if ((trip.operationType ?? 'loading') === 'loading') {
        const tripRef = doc(collection(firestore, 'trips'));
        const unloadingRef = doc(collection(firestore, 'trips'));
        const returnRef = trip.returnTrip === true ? doc(collection(firestore, 'trips')) : null;
        const scheduledGeneratedAt = nextDaySameTime(trip.scheduledAt);
        const batch = writeBatch(firestore);

        batch.set(tripRef, {
          ...data,
          id: tripRef.id,
          unloadingGeneratedTripId: unloadingRef.id,
          ...(returnRef ? { returnGeneratedTripId: returnRef.id } : {}),
          startedAt: null,
          completedAt: null,
          deliveryDocs: [],
        });
        batch.set(unloadingRef, {
          ...data,
          id: unloadingRef.id,
          status: 'in_progress',
          scheduledAt: scheduledGeneratedAt,
          startedAt: null,
          completedAt: null,
          deliveryDocs: [],
          programmingStatus: 'unloading',
          operationalStatus: 'waiting_unloading',
          operationType: 'unloading',
          returnTrip: false,
          expectedArrivalAt: null,
          unloadingSourceTripId: tripRef.id,
        });
        if (returnRef) {
          batch.set(returnRef, {
            ...data,
            id: returnRef.id,
            origin: data.destination,
            destination: data.origin,
            status: 'pending',
            scheduledAt: scheduledGeneratedAt,
            startedAt: null,
            completedAt: null,
            deliveryDocs: [],
            programmingStatus: 'loading',
            operationalStatus: 'waiting_loading',
            operationType: 'loading',
            returnTrip: false,
            expectedArrivalAt: null,
            returnSourceTripId: tripRef.id,
          });
        }
        await batch.commit();
        return tripRef.id;
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

  async updateTripProgrammingStatus(
    trip: Trip,
    programmingStatus: NonNullable<Trip['programmingStatus']>,
    operationalStatus?: Trip['operationalStatus'],
    operationType?: Trip['operationType'],
  ) {
    try {
      const status = tripStatusFromProgrammingStatus(programmingStatus);
      const data: DocumentData = {
        operationalStatus: operationalStatus ?? defaultOperationalStatus(programmingStatus) ?? null,
        operationType: operationType ?? trip.operationType ?? 'loading',
        programmingStatus,
        status,
      };
      if (status === 'in_progress') {
        data.startedAt = serverTimestamp();
        data.completedAt = null;
      }
      if (status === 'completed') {
        data.completedAt = serverTimestamp();
      }

      await updateDoc(doc(firestore, 'trips', trip.id), data);
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao atualizar etapa da programacao.');
    }
  },

  async deleteTrip(trip: Trip) {
    try {
      const batch = writeBatch(firestore);
      batch.delete(doc(firestore, 'trips', trip.id));

      if (trip.unloadingGeneratedTripId) {
        batch.update(doc(firestore, 'trips', trip.unloadingGeneratedTripId), {
          unloadingSourceTripId: deleteField(),
        });
      }
      if (trip.unloadingSourceTripId) {
        batch.update(doc(firestore, 'trips', trip.unloadingSourceTripId), {
          unloadingGeneratedTripId: deleteField(),
        });
      }

      await batch.commit();
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao excluir programacao.');
    }
  },

  async updateTripOperationalStatus(tripId: string, operationalStatus: NonNullable<Trip['operationalStatus']>) {
    try {
      await updateDoc(doc(firestore, 'trips', tripId), { operationalStatus });
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao atualizar status operacional.');
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
