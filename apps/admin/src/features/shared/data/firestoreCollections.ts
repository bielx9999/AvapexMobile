import {
  addDoc,
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, firestore } from '../../../core/firebase/firebaseConfig';
import { storage } from '../../../core/firebase/firebaseConfig';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { makeConverter } from '../../../core/firebase/firestoreConverters';
import { mapFirebaseError } from '../../../core/firebase/firebaseErrors';
import {
  mapChecklist,
  mapDelivery,
  mapDeliveryReceipt,
  mapDriverEquipment,
  mapFuelingRecord,
  mapLocality,
  mapLightVehicleMaintenance,
  mapLightVehicleWeeklyChecklist,
  mapOperationalSettings,
  mapRouteEvent,
  mapRouteTemplate,
  mapRouteVersion,
  mapSecurityInspection,
  mapTrip,
  mapUser,
  mapVehicle,
} from './mappers';
import type {
  AppUser,
  Checklist,
  Delivery,
  DeliveryReceipt,
  DriverEquipment,
  FuelingRecord,
  Locality,
  LightVehicleMaintenance,
  LightVehicleWeeklyChecklist,
  OperationalSettings,
  RouteEvent,
  RouteTemplate,
  RouteVersion,
  RouteVersionDefinition,
  SecurityInspection,
  Trip,
  TripRouteSnapshot,
  Vehicle,
} from '../domain/models';

const converters = {
  users: makeConverter<AppUser>(mapUser),
  vehicles: makeConverter<Vehicle>(mapVehicle),
  trips: makeConverter<Trip>(mapTrip),
  deliveries: makeConverter<Delivery>(mapDelivery),
  routeEvents: makeConverter<RouteEvent>(mapRouteEvent),
  settings: makeConverter<OperationalSettings>(mapOperationalSettings),
  checklists: makeConverter<Checklist>(mapChecklist),
  deliveryReceipts: makeConverter<DeliveryReceipt>(mapDeliveryReceipt),
  fuelingRecords: makeConverter<FuelingRecord>(mapFuelingRecord),
  driverEquipments: makeConverter<DriverEquipment>(mapDriverEquipment),
  localities: makeConverter<Locality>(mapLocality),
  routeTemplates: makeConverter<RouteTemplate>(mapRouteTemplate),
  routeVersions: makeConverter<RouteVersion>(mapRouteVersion),
  securityInspections: makeConverter<SecurityInspection>(mapSecurityInspection),
  lightVehicleWeeklyChecklists: makeConverter<LightVehicleWeeklyChecklist>(mapLightVehicleWeeklyChecklist),
  lightVehicleMaintenances: makeConverter<LightVehicleMaintenance>(mapLightVehicleMaintenance),
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

type LocalityWrite = Omit<Locality, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> & { id?: string };

type RouteTemplateWrite = {
  id?: string;
  name: string;
  description: string;
  notes: string;
  status: RouteTemplate['status'];
  definition: Omit<RouteVersionDefinition, 'version'>;
};

type LightVehicleWeeklyChecklistWrite = Omit<LightVehicleWeeklyChecklist, 'id' | 'createdAt' | 'photoUrls'> & { id?: string; photoFiles?: File[] };
type SecurityInspectionWrite = Omit<SecurityInspection, 'id' | 'createdAt' | 'photoUrls'> & { id?: string; photoFiles?: File[] };

export const adminReadRepository = {
  users: () => listCollection<AppUser>('users', [orderBy('createdAt', 'desc'), limit(200)], 'Erro ao listar usuarios.'),
  vehicles: () => listCollection<Vehicle>('vehicles', [orderBy('plate', 'asc'), limit(200)], 'Erro ao listar veiculos.'),
  trips: () => listCollection<Trip>('trips', [orderBy('scheduledAt', 'desc'), limit(200)], 'Erro ao listar viagens.'),
  deliveries: () => listCollection<Delivery>('deliveries', [orderBy('scheduledAt', 'desc'), limit(500)], 'Erro ao listar entregas.'),
  routeEvents: () => listCollection<RouteEvent>('routeEvents', [orderBy('occurredAt', 'desc'), limit(500)], 'Erro ao listar eventos de rota.'),
  settings: () => listCollection<OperationalSettings>('settings', [], 'Erro ao listar configuracoes operacionais.'),
  checklists: () => listCollection<Checklist>('checklists', [orderBy('createdAt', 'desc'), limit(200)], 'Erro ao listar checklists.'),
  securityInspections: () => listCollection<SecurityInspection>('securityInspections', [orderBy('createdAt', 'desc'), limit(500)], 'Erro ao listar inspecoes de seguranca.'),
  lightVehicleWeeklyChecklists: () => listCollection<LightVehicleWeeklyChecklist>('lightVehicleWeeklyChecklists', [orderBy('createdAt', 'desc'), limit(1000)], 'Erro ao listar checklists de veiculos leves.'),
  lightVehicleMaintenances: () => listCollection<LightVehicleMaintenance>('lightVehicleMaintenances', [orderBy('updatedAt', 'desc'), limit(500)], 'Erro ao listar revisoes de veiculos leves.'),
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
  localities: () => listCollection<Locality>('localities', [orderBy('normalizedCity', 'asc'), limit(2000)], 'Erro ao listar localidades.'),
  routeTemplates: () => listCollection<RouteTemplate>('routeTemplates', [orderBy('updatedAt', 'desc'), limit(500)], 'Erro ao listar rotas cadastradas.'),
  routeVersions: (routeTemplateId: string) => listCollection<RouteVersion>(
    'routeVersions',
    [where('routeTemplateId', '==', routeTemplateId), orderBy('version', 'desc'), limit(100)],
    'Erro ao listar versoes da rota.',
  ),
  watchTrips(onData: (trips: Trip[]) => void, onError: (error: Error) => void): Unsubscribe {
    const tripsQuery = query(typedCollection<Trip>('trips'), orderBy('scheduledAt', 'desc'), limit(200));
    return onSnapshot(
      tripsQuery,
      (snapshot) => onData(snapshot.docs.map((document) => document.data())),
      (error) => onError(mapFirebaseError(error, 'Erro ao acompanhar viagens em tempo real.')),
    );
  },
  watchChecklists(onData: (checklists: Checklist[]) => void, onError: (error: Error) => void): Unsubscribe {
    const checklistsQuery = query(typedCollection<Checklist>('checklists'), orderBy('createdAt', 'desc'), limit(200));
    return onSnapshot(
      checklistsQuery,
      (snapshot) => onData(snapshot.docs.map((document) => document.data())),
      (error) => onError(mapFirebaseError(error, 'Erro ao acompanhar checklists em tempo real.')),
    );
  },
  watchDeliveries(onData: (deliveries: Delivery[]) => void, onError: (error: Error) => void): Unsubscribe {
    const deliveriesQuery = query(typedCollection<Delivery>('deliveries'), orderBy('scheduledAt', 'desc'), limit(500));
    return onSnapshot(
      deliveriesQuery,
      (snapshot) => onData(snapshot.docs.map((document) => document.data())),
      (error) => onError(mapFirebaseError(error, 'Erro ao acompanhar entregas em tempo real.')),
    );
  },
  watchLocalities(onData: (localities: Locality[]) => void, onError: (error: Error) => void): Unsubscribe {
    const localitiesQuery = query(typedCollection<Locality>('localities'), orderBy('normalizedCity', 'asc'), limit(2000));
    return onSnapshot(
      localitiesQuery,
      (snapshot) => onData(snapshot.docs.map((document) => document.data())),
      (error) => onError(mapFirebaseError(error, 'Erro ao acompanhar localidades.')),
    );
  },
  watchRouteTemplates(onData: (routes: RouteTemplate[]) => void, onError: (error: Error) => void): Unsubscribe {
    const routesQuery = query(typedCollection<RouteTemplate>('routeTemplates'), orderBy('updatedAt', 'desc'), limit(500));
    return onSnapshot(
      routesQuery,
      (snapshot) => onData(snapshot.docs.map((document) => document.data())),
      (error) => onError(mapFirebaseError(error, 'Erro ao acompanhar rotas cadastradas.')),
    );
  },
};

export const adminWriteRepository = {
  async deleteOperationalChecklist(id: string) {
    try {
      await deleteDoc(doc(firestore, 'checklists', id));
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao excluir checklist operacional.');
    }
  },
  async saveLightVehicleWeeklyChecklist(input: LightVehicleWeeklyChecklistWrite) {
    try {
      const id = input.id ?? `light_checklist_${Date.now()}`;
      const photoUrls: string[] = [];
      for (const file of input.photoFiles ?? []) {
        const fileRef = ref(storage, `light-vehicle-checklists/${id}/${crypto.randomUUID()}-${file.name}`);
        const uploaded = await uploadBytes(fileRef, file);
        photoUrls.push(await getDownloadURL(uploaded.ref));
      }
      const checklistFields = { ...input };
      delete checklistFields.photoFiles;
      await setDoc(doc(firestore, 'lightVehicleWeeklyChecklists', id), { ...checklistFields, id, photoUrls, createdAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao salvar checklist semanal.');
    }
  },
  async deleteLightVehicleWeeklyChecklist(id: string) {
    try {
      await deleteDoc(doc(firestore, 'lightVehicleWeeklyChecklists', id));
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao excluir checklist semanal.');
    }
  },
  async saveLightVehicleMaintenance(input: Omit<LightVehicleMaintenance, 'updatedAt'>) {
    try {
      await setDoc(doc(firestore, 'lightVehicleMaintenances', input.id), { ...input, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao salvar revisao do veiculo leve.');
    }
  },
  async saveSecurityInspection(input: SecurityInspectionWrite) {
    try {
      const id = input.id ?? `security_${Date.now()}`;
      const photoUrls: string[] = [];
      for (const file of input.photoFiles ?? []) {
        const fileRef = ref(storage, `security-inspections/${id}/${crypto.randomUUID()}-${file.name}`);
        const uploaded = await uploadBytes(fileRef, file);
        photoUrls.push(await getDownloadURL(uploaded.ref));
      }
      const inspectionFields = { ...input };
      const location = inspectionFields.location;
      delete inspectionFields.photoFiles;
      delete inspectionFields.location;
      const inspectionData = {
        ...inspectionFields,
        id,
        photoUrls,
        createdAt: serverTimestamp(),
        ...(location ? { location } : {}),
      };
      await setDoc(doc(firestore, 'securityInspections', id), inspectionData);
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao salvar inspecao de seguranca.');
    }
  },
  createTripId() {
    return doc(collection(firestore, 'trips')).id;
  },

  createLocalityId() {
    return doc(collection(firestore, 'localities')).id;
  },

  async saveLocality(locality: LocalityWrite) {
    try {
      const actorId = auth.currentUser?.uid ?? '';
      const reference = locality.reference.trim();
      const city = locality.city.trim();
      const uf = locality.uf.trim().toUpperCase();
      const address = locality.address.trim();
      const id = locality.id?.trim() || this.createLocalityId();
      const referenceDoc = doc(firestore, 'localities', id);
      const data: DocumentData = {
        id,
        reference,
        normalizedReference: normalizeSearchText(reference),
        city,
        normalizedCity: normalizeSearchText(city),
        uf,
        address,
        normalizedAddress: normalizeSearchText(address),
        latitude: locality.latitude,
        longitude: locality.longitude,
        originalCoordinates: locality.originalCoordinates.trim(),
        status: locality.status,
        needsReview: locality.needsReview,
        source: locality.source,
        sourceRow: locality.sourceRow,
        fingerprint: buildLocalityFingerprint({
          reference,
          city,
          uf,
          address,
          latitude: locality.latitude,
          longitude: locality.longitude,
        }),
        updatedAt: serverTimestamp(),
        updatedBy: actorId,
      };
      if (!locality.id) {
        data.createdAt = serverTimestamp();
        data.createdBy = actorId;
      }
      await setDoc(referenceDoc, data, { merge: true });
      return id;
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao salvar localidade.');
    }
  },

  async importLocalities(localities: LocalityWrite[]) {
    try {
      const actorId = auth.currentUser?.uid ?? '';
      const chunks = chunk(localities, 450);
      for (const items of chunks) {
        const batch = writeBatch(firestore);
        for (const locality of items) {
          const id = locality.id?.trim() || doc(collection(firestore, 'localities')).id;
          const reference = locality.reference.trim();
          const city = locality.city.trim();
          const uf = locality.uf.trim().toUpperCase();
          const address = locality.address.trim();
          batch.set(doc(firestore, 'localities', id), {
            id,
            reference,
            normalizedReference: normalizeSearchText(reference),
            city,
            normalizedCity: normalizeSearchText(city),
            uf,
            address,
            normalizedAddress: normalizeSearchText(address),
            latitude: locality.latitude,
            longitude: locality.longitude,
            originalCoordinates: locality.originalCoordinates.trim(),
            status: locality.status,
            needsReview: locality.needsReview,
            source: 'import',
            sourceRow: locality.sourceRow,
            fingerprint: buildLocalityFingerprint({ reference, city, uf, address, latitude: locality.latitude, longitude: locality.longitude }),
            createdAt: serverTimestamp(),
            createdBy: actorId,
            updatedAt: serverTimestamp(),
            updatedBy: actorId,
          });
        }
        await batch.commit();
      }
      return localities.length;
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao importar localidades.');
    }
  },

  async setLocalityStatus(localityId: string, status: Locality['status']) {
    try {
      await updateDoc(doc(firestore, 'localities', localityId), {
        status,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid ?? '',
      });
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao atualizar localidade.');
    }
  },

  async deleteLocality(localityId: string) {
    try {
      const [routeUse, tripUse] = await Promise.all([
        getDocs(query(collection(firestore, 'routeVersions'), where('locationIds', 'array-contains', localityId), limit(1))),
        getDocs(query(collection(firestore, 'trips'), where('routeLocationIds', 'array-contains', localityId), limit(1))),
      ]);
      if (!routeUse.empty || !tripUse.empty) {
        throw new Error('A localidade possui historico. Inative o cadastro em vez de excluir.');
      }
      await deleteDoc(doc(firestore, 'localities', localityId));
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao excluir localidade.');
    }
  },

  async saveRouteTemplate(route: RouteTemplateWrite) {
    try {
      const actorId = auth.currentUser?.uid ?? '';
      const templateRef = route.id
        ? doc(firestore, 'routeTemplates', route.id)
        : doc(collection(firestore, 'routeTemplates'));
      return await runTransaction(firestore, async (transaction) => {
        const existing = route.id ? await transaction.get(templateRef) : null;
        const currentVersion = existing?.exists() && typeof existing.data().currentVersion?.version === 'number'
          ? existing.data().currentVersion.version
          : 0;
        const version = currentVersion + 1;
        const versionRef = doc(collection(firestore, 'routeVersions'));
        const definition = serializeRouteDefinition({ ...route.definition, version });
        transaction.set(versionRef, {
          id: versionRef.id,
          routeTemplateId: templateRef.id,
          ...definition,
          createdAt: serverTimestamp(),
          createdBy: actorId,
        });
        transaction.set(templateRef, {
          id: templateRef.id,
          name: route.name.trim(),
          normalizedName: normalizeSearchText(route.name),
          description: route.description.trim(),
          notes: route.notes.trim(),
          status: route.status,
          currentVersionId: versionRef.id,
          currentVersion: definition,
          usedCount: existing?.exists() && typeof existing.data().usedCount === 'number' ? existing.data().usedCount : 0,
          createdAt: existing?.exists() ? existing.data().createdAt : serverTimestamp(),
          createdBy: existing?.exists() ? existing.data().createdBy : actorId,
          updatedAt: serverTimestamp(),
          updatedBy: actorId,
        });
        return { id: templateRef.id, versionId: versionRef.id, version };
      });
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao salvar rota cadastrada.');
    }
  },

  async setRouteTemplateStatus(routeId: string, status: RouteTemplate['status']) {
    try {
      await updateDoc(doc(firestore, 'routeTemplates', routeId), {
        status,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid ?? '',
      });
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao atualizar rota cadastrada.');
    }
  },

  async deleteRouteTemplate(routeId: string) {
    try {
      const usedTrips = await getDocs(query(collection(firestore, 'trips'), where('routeTemplateId', '==', routeId), limit(1)));
      if (!usedTrips.empty) {
        throw new Error('A rota ja foi utilizada. Inative o cadastro para preservar o historico.');
      }
      const versions = await getDocs(query(collection(firestore, 'routeVersions'), where('routeTemplateId', '==', routeId), limit(450)));
      const batch = writeBatch(firestore);
      for (const version of versions.docs) {
        batch.delete(version.ref);
      }
      batch.delete(doc(firestore, 'routeTemplates', routeId));
      await batch.commit();
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao excluir rota cadastrada.');
    }
  },

  async approveChecklist(checklist: Checklist) {
    try {
      if ((checklist.adminReviewStatus ?? 'pending') !== 'pending') {
        throw new Error('Este checklist ja foi analisado.');
      }
      await updateDoc(doc(firestore, 'checklists', checklist.id), {
        adminReviewStatus: 'approved',
        adminReviewMessage: '',
        driverNotificationStatus: 'not_sent',
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser?.uid ?? '',
      });
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao aprovar checklist.');
    }
  },

  async reportChecklistError(checklist: Checklist, message: string) {
    try {
      if ((checklist.adminReviewStatus ?? 'pending') !== 'pending') {
        throw new Error('Este checklist ja foi analisado.');
      }
      const trimmedMessage = message.trim();
      if (!trimmedMessage) {
        throw new Error('Informe o erro que deve ser enviado ao motorista.');
      }
      await updateDoc(doc(firestore, 'checklists', checklist.id), {
        adminReviewStatus: 'reported',
        adminReviewMessage: trimmedMessage,
        driverNotificationStatus: 'queued',
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser?.uid ?? '',
      });
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao reportar erro no checklist.');
    }
  },

  async markDeliveryReceiptDelivered(receipt: DeliveryReceipt) {
    try {
      if ((receipt.adminStatus ?? 'pending') !== 'pending') {
        throw new Error('Este comprovante ja foi revisado.');
      }
      const reviewer = auth.currentUser;
      const reviewerId = reviewer?.uid ?? '';
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'deliveryReceipts', receipt.id), {
        adminStatus: 'delivered',
        failureReason: '',
        driverNotificationMessage: '',
        driverNotificationStatus: 'not_sent',
        reviewedAt: serverTimestamp(),
        reviewedBy: reviewerId,
      });

      if (receipt.deliveryId) {
        batch.update(doc(firestore, 'deliveries', receipt.deliveryId), {
          proofStatus: 'approved',
          deliveryProofId: receipt.id,
          status: 'delivered',
          deliveredAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: reviewerId,
        });
        addDeliveryProofEvent(batch, receipt, 'delivery_proof_approved', 'approved');
      }

      await batch.commit();
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao registrar comprovante como entregue.');
    }
  },

  async markDeliveryReceiptFailed(receipt: DeliveryReceipt, reason: string, notificationMessage: string) {
    try {
      if ((receipt.adminStatus ?? 'pending') !== 'pending') {
        throw new Error('Este comprovante ja foi revisado.');
      }
      const reviewerId = auth.currentUser?.uid ?? '';
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'deliveryReceipts', receipt.id), {
        adminStatus: 'failed',
        failureReason: reason.trim(),
        driverNotificationMessage: notificationMessage.trim(),
        driverNotificationStatus: notificationMessage.trim() ? 'queued' : 'not_sent',
        reviewedAt: serverTimestamp(),
        reviewedBy: reviewerId,
      });

      if (receipt.deliveryId) {
        batch.update(doc(firestore, 'deliveries', receipt.deliveryId), {
          proofStatus: 'rejected',
          deliveryProofId: receipt.id,
          updatedAt: serverTimestamp(),
          updatedBy: reviewerId,
        });
        addDeliveryProofEvent(batch, receipt, 'delivery_proof_rejected', 'rejected', reason.trim());
      }

      await batch.commit();
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

  async saveTrip(
    trip: Omit<Trip, 'id' | 'startedAt' | 'completedAt' | 'deliveryDocs'> & { id?: string },
    options: { create?: boolean } = {},
  ) {
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
        cargoDescription: trip.cargoDescription?.trim() ?? '',
        driverResponse: trip.driverResponse ?? 'pending',
        driverRespondedAt: trip.driverRespondedAt ?? null,
        driverResponseDriverId: trip.driverResponseDriverId ?? '',
        driverRejection: trip.driverRejection ?? null,
        assignedAt: trip.assignedAt ?? serverTimestamp(),
        clientId: trip.clientId?.trim() ?? '',
        clientName: trip.clientName?.trim() ?? '',
        fleetNumber: trip.fleetNumber?.trim() ?? '',
        cteDocuments: (trip.cteDocuments ?? []).map((document) => ({
          id: document.id.trim(),
          number: document.number.trim(),
          series: document.series.trim(),
          branch: document.branch.trim(),
          issuedAt: document.issuedAt ?? null,
          sender: document.sender.trim(),
          storagePath: document.storagePath.trim(),
          fileName: document.fileName.trim(),
          contentType: document.contentType.trim(),
          sizeBytes: document.sizeBytes,
          uploadedAt: document.uploadedAt ?? null,
          uploadedBy: document.uploadedBy.trim(),
        })),
        routeId: trip.routeId?.trim() ?? '',
        routeName: trip.routeName?.trim() ?? '',
        routeTemplateId: trip.routeTemplateId?.trim() ?? '',
        routeVersionId: trip.routeVersionId?.trim() ?? '',
        routeSnapshot: trip.routeSnapshot ? serializeTripRouteSnapshot(trip.routeSnapshot) : null,
        routeLocationIds: trip.routeSnapshot?.locationIds ?? [],
        originLocationId: trip.originLocationId?.trim() ?? '',
        destinationLocationId: trip.destinationLocationId?.trim() ?? '',
        originLocation: trip.originLocation ?? null,
        destinationLocation: trip.destinationLocation ?? null,
        routeStops: (trip.routeStops ?? []).map((stop) => ({
          name: stop.name.trim(),
          address: stop.address.trim(),
          ...(typeof stop.latitude === 'number' ? { latitude: stop.latitude } : {}),
          ...(typeof stop.longitude === 'number' ? { longitude: stop.longitude } : {}),
          ...(stop.locationId ? { locationId: stop.locationId.trim() } : {}),
          ...(typeof stop.order === 'number' ? { order: stop.order } : {}),
        })),
        statusUpdatedAt: serverTimestamp(),
      };

      if (trip.id && !options.create) {
        await updateDoc(doc(firestore, 'trips', trip.id), data);
        return trip.id;
      }

      if (trip.id) {
        await setDoc(doc(firestore, 'trips', trip.id), {
          ...data,
          id: trip.id,
          startedAt: null,
          completedAt: null,
          deliveryDocs: [],
        });
        if (trip.routeTemplateId) {
          await updateDoc(doc(firestore, 'routeTemplates', trip.routeTemplateId), { usedCount: increment(1) });
        }
        return trip.id;
      }

      const created = await addDoc(collection(firestore, 'trips'), {
        ...data,
        startedAt: null,
        completedAt: null,
        deliveryDocs: [],
      });
      await updateDoc(created, { id: created.id });
      if (trip.routeTemplateId) {
        await updateDoc(doc(firestore, 'routeTemplates', trip.routeTemplateId), { usedCount: increment(1) });
      }
      return created.id;
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao salvar programacao.');
    }
  },

  async createUnloadingTripFromLoading(sourceTrip: Trip) {
    if (sourceTrip.operationType === 'unloading') {
      throw new Error('Esta programacao ja e uma descarga.');
    }
    if (sourceTrip.unloadingGeneratedTripId) {
      throw new Error('Esta carga ja possui descarga gerada.');
    }

    try {
      const sourceRef = doc(firestore, 'trips', sourceTrip.id);
      const unloadingRef = doc(collection(firestore, 'trips'));
      const scheduledAt = nextDaySameTime(sourceTrip.scheduledAt);
      const batch = writeBatch(firestore);

      batch.update(sourceRef, {
        unloadingGeneratedTripId: unloadingRef.id,
        statusUpdatedAt: serverTimestamp(),
      });
      batch.set(unloadingRef, {
        id: unloadingRef.id,
        driverId: sourceTrip.driverId,
        vehicleId: sourceTrip.vehicleId,
        origin: sourceTrip.origin,
        destination: sourceTrip.destination,
        status: 'pending',
        scheduledAt,
        startedAt: null,
        completedAt: null,
        deliveryDocs: [],
        driverName: sourceTrip.driverName ?? '',
        vehiclePlate: sourceTrip.vehiclePlate ?? '',
        vehicleModel: sourceTrip.vehicleModel ?? '',
        programmingStatus: 'unloading',
        operationalStatus: 'waiting_unloading',
        returnTrip: false,
        customerRequestNumber: sourceTrip.customerRequestNumber ?? '',
        programmedVehicleType: sourceTrip.programmedVehicleType ?? 'truck',
        operationType: 'unloading',
        expectedArrivalAt: null,
        additionalInfo: sourceTrip.additionalInfo ?? '',
        cargoDescription: sourceTrip.cargoDescription ?? '',
        driverResponse: 'pending',
        driverRespondedAt: null,
        driverResponseDriverId: '',
        driverRejection: null,
        assignedAt: serverTimestamp(),
        clientId: sourceTrip.clientId ?? '',
        clientName: sourceTrip.clientName ?? '',
        fleetNumber: sourceTrip.fleetNumber ?? '',
        cteDocuments: (sourceTrip.cteDocuments ?? []).map((document) => ({
          id: document.id,
          number: document.number,
          series: document.series,
          branch: document.branch,
          issuedAt: document.issuedAt ?? null,
          sender: document.sender,
          storagePath: document.storagePath,
          fileName: document.fileName,
          contentType: document.contentType,
          sizeBytes: document.sizeBytes,
          uploadedAt: document.uploadedAt ?? null,
          uploadedBy: document.uploadedBy,
        })),
        routeId: sourceTrip.routeId ?? '',
        routeName: sourceTrip.routeName ?? '',
        routeTemplateId: sourceTrip.routeTemplateId ?? '',
        routeVersionId: sourceTrip.routeVersionId ?? '',
        routeSnapshot: sourceTrip.routeSnapshot ? serializeTripRouteSnapshot(sourceTrip.routeSnapshot) : null,
        routeLocationIds: sourceTrip.routeSnapshot?.locationIds ?? [],
        originLocationId: sourceTrip.originLocationId ?? '',
        destinationLocationId: sourceTrip.destinationLocationId ?? '',
        originLocation: sourceTrip.originLocation ?? null,
        destinationLocation: sourceTrip.destinationLocation ?? null,
        routeStops: (sourceTrip.routeStops ?? []).map((stop) => ({
          name: stop.name,
          address: stop.address,
          ...(typeof stop.latitude === 'number' ? { latitude: stop.latitude } : {}),
          ...(typeof stop.longitude === 'number' ? { longitude: stop.longitude } : {}),
          ...(stop.locationId ? { locationId: stop.locationId } : {}),
          ...(typeof stop.order === 'number' ? { order: stop.order } : {}),
        })),
        unloadingSourceTripId: sourceTrip.id,
        statusUpdatedAt: serverTimestamp(),
      });

      await batch.commit();
      return unloadingRef.id;
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao gerar descarga.');
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

  async updateTripCargoDescription(tripId: string, description: string) {
    try {
      await updateDoc(doc(firestore, 'trips', tripId), {
        cargoDescription: description.trim(),
      });
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao salvar a observacao da carga.');
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
        statusUpdatedAt: serverTimestamp(),
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

function serializeRouteDefinition(definition: RouteVersionDefinition) {
  return {
    version: Math.max(1, Math.trunc(definition.version)),
    points: definition.points.map((point, index) => ({
      id: point.id,
      type: point.type,
      sequence: index,
      locationId: point.locationId,
      reference: point.reference,
      city: point.city,
      uf: point.uf,
      address: point.address,
      latitude: point.latitude,
      longitude: point.longitude,
    })),
    locationIds: [...new Set(definition.locationIds.filter(Boolean))],
    distanceMeters: Math.max(0, Math.round(definition.distanceMeters)),
    durationSeconds: Math.max(0, Math.round(definition.durationSeconds)),
    encodedPolyline: definition.encodedPolyline,
    path: definition.path.map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
  };
}

function serializeTripRouteSnapshot(snapshot: TripRouteSnapshot) {
  return {
    routeTemplateId: snapshot.routeTemplateId,
    routeVersionId: snapshot.routeVersionId,
    name: snapshot.name,
    ...serializeRouteDefinition(snapshot),
  };
}

function normalizeSearchText(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function buildLocalityFingerprint(value: {
  reference: string;
  city: string;
  uf: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}) {
  return [
    normalizeSearchText(value.reference),
    normalizeSearchText(value.city),
    value.uf.toUpperCase(),
    normalizeSearchText(value.address),
    value.latitude?.toFixed(5) ?? '',
    value.longitude?.toFixed(5) ?? '',
  ].join('|');
}

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function addDeliveryProofEvent(
  batch: ReturnType<typeof writeBatch>,
  receipt: DeliveryReceipt,
  type: 'delivery_proof_approved' | 'delivery_proof_rejected',
  toStatus: 'approved' | 'rejected',
  message = '',
) {
  if (!receipt.routeId) {
    return;
  }
  const actor = auth.currentUser;
  const eventRef = doc(collection(firestore, 'routeEvents'));
  batch.set(eventRef, {
    id: eventRef.id,
    routeId: receipt.routeId,
    deliveryId: receipt.deliveryId,
    driverId: receipt.driverId,
    vehicleId: receipt.vehicleId,
    type,
    source: 'admin',
    actorId: actor?.uid ?? '',
    actorName: actor?.displayName ?? actor?.email ?? '',
    fromStatus: 'submitted',
    toStatus,
    message: message || (toStatus === 'approved' ? 'Comprovante aprovado pelo administrativo.' : 'Comprovante rejeitado pelo administrativo.'),
    metadata: { receiptId: receipt.id },
    occurredAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
}
