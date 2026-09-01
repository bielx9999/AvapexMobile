import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, firestore } from '../../../core/firebase/firebaseConfig';
import { mapFirebaseError } from '../../../core/firebase/firebaseErrors';
import {
  mapEquipment,
  mapEquipmentAssignment,
  mapEquipmentInspection,
  mapEquipmentMovement,
  mapEquipmentOccurrence,
  mapStorageLocation,
} from '../../shared/data/mappers';
import type {
  AppUser,
  Equipment,
  EquipmentInspection,
  EquipmentInspectionItem,
  EquipmentOccurrence,
  EquipmentStatus,
  StorageLocation,
  Vehicle,
} from '../../shared/domain/models';

export type EquipmentTypeValue = 'strap' | 'ratchet' | 'chain' | 'tensioner';
export type EquipmentImportInput = { type: EquipmentTypeValue; code: string };

export const equipmentLabels: Record<EquipmentTypeValue, string> = {
  strap: 'Cinta',
  ratchet: 'Catraca',
  chain: 'Corrente',
  tensioner: 'Tensionador',
};

export const equipmentStatusLabels: Record<EquipmentStatus, string> = {
  in_stock: 'Em estoque',
  assigned: 'Atribuido',
  in_use: 'Em uso',
  damaged: 'Danificado',
  under_review: 'Em analise',
  lost: 'Extraviado',
  retired: 'Baixado',
};

export type EquipmentAdminData = {
  equipment: Equipment[];
  assignments: ReturnType<typeof mapEquipmentAssignment>[];
  movements: ReturnType<typeof mapEquipmentMovement>[];
  inspections: EquipmentInspection[];
  occurrences: EquipmentOccurrence[];
  storageLocations: StorageLocation[];
};

type EquipmentDraft = Omit<Equipment, 'id' | 'createdAt' | 'updatedAt' | 'lastInspectionAt'> & { id?: string };

async function list<T>(path: string, mapper: (id: string, data: Record<string, unknown>) => T, orderField: string) {
  const snapshot = await getDocs(query(collection(firestore, path), orderBy(orderField, 'asc'), limit(2000)));
  return snapshot.docs.map((item) => mapper(item.id, item.data()));
}

function movementData(input: {
  equipment: Equipment;
  type: string;
  sourceVehicle?: Vehicle | null;
  destinationVehicle?: Vehicle | null;
  sourceStorage?: StorageLocation | null;
  destinationStorage?: StorageLocation | null;
  observation?: string;
}) {
  const ref = doc(collection(firestore, 'equipmentMovements'));
  return {
    ref,
    data: {
      id: ref.id,
      equipmentId: input.equipment.id,
      equipmentCode: input.equipment.code,
      movementType: input.type,
      sourceVehicleId: input.sourceVehicle?.id ?? input.equipment.currentVehicleId ?? '',
      sourceVehiclePlate: input.sourceVehicle?.plate ?? input.equipment.currentVehiclePlate ?? '',
      destinationVehicleId: input.destinationVehicle?.id ?? '',
      destinationVehiclePlate: input.destinationVehicle?.plate ?? '',
      sourceStorageId: input.sourceStorage?.id ?? input.equipment.currentStorageId ?? '',
      sourceStorageName: input.sourceStorage?.name ?? input.equipment.currentStorageName ?? '',
      destinationStorageId: input.destinationStorage?.id ?? '',
      destinationStorageName: input.destinationStorage?.name ?? '',
      responsibleUserId: auth.currentUser?.uid ?? '',
      observation: input.observation?.trim() ?? '',
      createdAt: serverTimestamp(),
    },
  };
}

function codeRegistryRef(code: string) {
  return doc(firestore, 'equipmentCodeRegistry', encodeURIComponent(code));
}

export const equipmentRepository = {
  async load(): Promise<EquipmentAdminData> {
    try {
      const [equipment, assignments, movements, inspections, occurrences, storageLocations] = await Promise.all([
        list('equipment', mapEquipment, 'code'),
        list('equipmentAssignments', mapEquipmentAssignment, 'equipmentCode'),
        list('equipmentMovements', mapEquipmentMovement, 'createdAt'),
        list('equipmentInspections', mapEquipmentInspection, 'referenceYear'),
        list('equipmentOccurrences', mapEquipmentOccurrence, 'reportedAt'),
        list('storageLocations', mapStorageLocation, 'name'),
      ]);
      return { equipment, assignments, movements, inspections, occurrences, storageLocations };
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao carregar o controle de equipamentos.');
    }
  },

  async ensureMainStorage() {
    const id = 'main-cabinet';
    await setDoc(doc(firestore, 'storageLocations', id), {
      id,
      name: 'Armario Principal',
      description: 'Local padrao para equipamentos de amarracao.',
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return id;
  },

  async saveStorageLocation(location: Omit<StorageLocation, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
    try {
      const ref = doc(firestore, 'storageLocations', location.id || doc(collection(firestore, 'storageLocations')).id);
      await setDoc(ref, {
        id: ref.id,
        name: location.name.trim(),
        description: location.description.trim(),
        active: location.active,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return ref.id;
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao salvar local de estoque.');
    }
  },

  async saveEquipment(draft: EquipmentDraft, storage: StorageLocation) {
    try {
      const code = draft.code.trim().toUpperCase();
      if (!code) throw new Error('Informe o numero do equipamento.');
      const ref = doc(firestore, 'equipment', draft.id || doc(collection(firestore, 'equipment')).id);
      const registryRef = codeRegistryRef(code);
      const data = {
        id: ref.id,
        code,
        type: draft.type,
        description: draft.description.trim(),
        brand: draft.brand.trim(),
        model: draft.model.trim(),
        capacity: draft.capacity.trim(),
        length: draft.length.trim(),
        purchaseDate: draft.purchaseDate ?? null,
        status: draft.status || 'in_stock',
        currentVehicleId: draft.currentVehicleId || '',
        currentVehiclePlate: draft.currentVehiclePlate || '',
        currentDriverId: draft.currentDriverId || '',
        currentDriverName: draft.currentDriverName || '',
        currentStorageId: draft.currentVehicleId ? '' : (draft.currentStorageId || storage.id),
        currentStorageName: draft.currentVehicleId ? '' : (draft.currentStorageName || storage.name),
        updatedAt: serverTimestamp(),
      };
      await runTransaction(firestore, async (transaction) => {
        const registry = await transaction.get(registryRef);
        if (registry.exists() && registry.data().equipmentId !== ref.id) {
          throw new Error(`O codigo ${code} ja esta em uso.`);
        }
        transaction.set(registryRef, { code, equipmentId: ref.id, createdAt: serverTimestamp() }, { merge: true });
        transaction.set(ref, { ...data, createdAt: serverTimestamp() }, { merge: true });
        if (!draft.id) {
          const registered = { ...draft, id: ref.id, code } as Equipment;
          const movement = movementData({ equipment: registered, type: 'registration', destinationStorage: storage });
          transaction.set(movement.ref, movement.data);
        }
      });
      return ref.id;
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao salvar equipamento.');
    }
  },

  async createBatch(input: { type: EquipmentTypeValue; prefix: string; start: number; end: number; storage: StorageLocation }) {
    try {
      const prefix = input.prefix.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (!prefix || input.start < 0 || input.end < input.start || input.end - input.start > 99) {
        throw new Error('Revise prefixo e intervalo do cadastro em lote.');
      }
      const width = Math.max(3, String(input.end).length);
      const codes = Array.from({ length: input.end - input.start + 1 }, (_, index) => `${prefix}-${String(input.start + index).padStart(width, '0')}`);
      await runTransaction(firestore, async (transaction) => {
        const registries = await Promise.all(codes.map((code) => transaction.get(codeRegistryRef(code))));
        const conflicts = registries
          .map((snapshot, index) => snapshot.exists() ? codes[index] : '')
          .filter(Boolean);
        if (conflicts.length) throw new Error(`Existem codigos ja cadastrados: ${conflicts.slice(0, 6).join(', ')}${conflicts.length > 6 ? '...' : ''}`);
        codes.forEach((code) => {
          const ref = doc(collection(firestore, 'equipment'));
          transaction.set(ref, {
            id: ref.id, code, type: input.type, description: '', brand: '', model: '', capacity: '', length: '', purchaseDate: null,
            status: 'in_stock', currentVehicleId: '', currentVehiclePlate: '', currentDriverId: '', currentDriverName: '',
            currentStorageId: input.storage.id, currentStorageName: input.storage.name, lastInspectionAt: null,
            createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          });
          transaction.set(codeRegistryRef(code), { code, equipmentId: ref.id, createdAt: serverTimestamp() });
          const movement = movementData({ equipment: { id: ref.id, code } as Equipment, type: 'registration', destinationStorage: input.storage });
          transaction.set(movement.ref, movement.data);
        });
      });
      return codes;
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao cadastrar equipamentos em lote.');
    }
  },

  async importEquipment(input: { rows: EquipmentImportInput[]; storage: StorageLocation }) {
    try {
      if (!input.rows.length) throw new Error('Nao ha equipamentos validos para importar.');
      if (input.rows.length > 400) throw new Error('Importe no maximo 400 equipamentos por vez.');
      const rows = input.rows.map((row) => ({ ...row, code: row.code.trim().toUpperCase() }));
      if (rows.some((row) => !row.code)) throw new Error('Existem numeros de identificacao invalidos na importacao.');
      if (new Set(rows.map((row) => row.code)).size !== rows.length) throw new Error('Existem numeros de identificacao duplicados na importacao.');
      await runTransaction(firestore, async (transaction) => {
        const registries = await Promise.all(rows.map((row) => transaction.get(codeRegistryRef(row.code))));
        const conflicts = registries
          .map((snapshot, index) => snapshot.exists() ? rows[index].code : '')
          .filter(Boolean);
        if (conflicts.length) throw new Error(`Existem codigos ja cadastrados: ${conflicts.slice(0, 6).join(', ')}${conflicts.length > 6 ? '...' : ''}`);
        rows.forEach((row) => {
          const ref = doc(collection(firestore, 'equipment'));
          const equipment = { id: ref.id, code: row.code } as Equipment;
          transaction.set(ref, {
            id: ref.id, code: row.code, type: row.type, description: '', brand: '', model: '', capacity: '', length: '', purchaseDate: null,
            status: 'in_stock', currentVehicleId: '', currentVehiclePlate: '', currentDriverId: '', currentDriverName: '',
            currentStorageId: input.storage.id, currentStorageName: input.storage.name, lastInspectionAt: null,
            createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          });
          transaction.set(codeRegistryRef(row.code), { code: row.code, equipmentId: ref.id, createdAt: serverTimestamp() });
          const movement = movementData({ equipment, type: 'registration', destinationStorage: input.storage, observation: 'Importacao por planilha' });
          transaction.set(movement.ref, movement.data);
        });
      });
      return rows.length;
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao importar equipamentos pela planilha.');
    }
  },

  async assignEquipment(input: { equipmentIds: string[]; vehicle: Vehicle; driver?: AppUser; observation?: string }) {
    try {
      if (!input.equipmentIds.length) throw new Error('Selecione ao menos um equipamento.');
      await runTransaction(firestore, async (transaction) => {
        const records = await Promise.all(input.equipmentIds.map(async (id) => {
          const ref = doc(firestore, 'equipment', id);
          const snapshot = await transaction.get(ref);
          if (!snapshot.exists()) throw new Error('Equipamento nao encontrado.');
          const equipment = mapEquipment(snapshot.id, snapshot.data());
          if (equipment.status !== 'in_stock') throw new Error(`${equipment.code} nao esta disponivel em estoque.`);
          return { ref, equipment };
        }));
        records.forEach(({ ref, equipment }) => {
          const assignmentRef = doc(collection(firestore, 'equipmentAssignments'));
          const movement = movementData({ equipment, type: 'assignment', destinationVehicle: input.vehicle, observation: input.observation });
          transaction.update(ref, {
            status: 'assigned', currentVehicleId: input.vehicle.id, currentVehiclePlate: input.vehicle.plate,
            currentDriverId: input.driver?.uid ?? '', currentDriverName: input.driver?.name ?? '',
            currentStorageId: '', currentStorageName: '', updatedAt: serverTimestamp(),
          });
          transaction.set(assignmentRef, {
            id: assignmentRef.id, equipmentId: equipment.id, equipmentCode: equipment.code, equipmentType: equipment.type,
            vehicleId: input.vehicle.id, vehiclePlate: input.vehicle.plate,
            responsibleDriverId: input.driver?.uid ?? '', responsibleDriverName: input.driver?.name ?? '',
            assignedAt: serverTimestamp(), assignedBy: auth.currentUser?.uid ?? '', returnedAt: null, returnedBy: '', status: 'active', observation: input.observation?.trim() ?? '',
          });
          transaction.set(movement.ref, movement.data);
        });
      });
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao atribuir equipamentos.');
    }
  },

  async returnToStock(input: { equipment: Equipment; storage: StorageLocation; observation?: string }) {
    try {
      const activeAssignments = await getDocs(query(collection(firestore, 'equipmentAssignments'), where('equipmentId', '==', input.equipment.id), where('status', '==', 'active')));
      const batch = writeBatch(firestore);
      const movement = movementData({ equipment: input.equipment, type: 'return', destinationStorage: input.storage, observation: input.observation });
      batch.update(doc(firestore, 'equipment', input.equipment.id), {
        status: 'in_stock', currentVehicleId: '', currentVehiclePlate: '', currentDriverId: '', currentDriverName: '',
        currentStorageId: input.storage.id, currentStorageName: input.storage.name, updatedAt: serverTimestamp(),
      });
      activeAssignments.docs.forEach((assignment) => batch.update(assignment.ref, { status: 'returned', returnedAt: serverTimestamp(), returnedBy: auth.currentUser?.uid ?? '' }));
      batch.set(movement.ref, movement.data);
      await batch.commit();
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao devolver equipamento ao estoque.');
    }
  },

  async transfer(input: { equipment: Equipment; vehicle: Vehicle; driver?: AppUser; observation?: string }) {
    try {
      if (!input.equipment.currentVehicleId) throw new Error('O equipamento nao esta atribuido a um veiculo.');
      const oldAssignment = await getDocs(query(collection(firestore, 'equipmentAssignments'), where('equipmentId', '==', input.equipment.id), where('status', '==', 'active')));
      const batch = writeBatch(firestore);
      const assignmentRef = doc(collection(firestore, 'equipmentAssignments'));
      const movement = movementData({ equipment: input.equipment, type: 'transfer', destinationVehicle: input.vehicle, observation: input.observation });
      batch.update(doc(firestore, 'equipment', input.equipment.id), {
        status: 'assigned', currentVehicleId: input.vehicle.id, currentVehiclePlate: input.vehicle.plate,
        currentDriverId: input.driver?.uid ?? '', currentDriverName: input.driver?.name ?? '', updatedAt: serverTimestamp(),
      });
      oldAssignment.docs.forEach((item) => batch.update(item.ref, { status: 'transferred', returnedAt: serverTimestamp(), returnedBy: auth.currentUser?.uid ?? '' }));
      batch.set(assignmentRef, {
        id: assignmentRef.id, equipmentId: input.equipment.id, equipmentCode: input.equipment.code, equipmentType: input.equipment.type,
        vehicleId: input.vehicle.id, vehiclePlate: input.vehicle.plate, responsibleDriverId: input.driver?.uid ?? '', responsibleDriverName: input.driver?.name ?? '',
        assignedAt: serverTimestamp(), assignedBy: auth.currentUser?.uid ?? '', returnedAt: null, returnedBy: '', status: 'active', observation: input.observation?.trim() ?? '',
      });
      batch.set(movement.ref, movement.data);
      await batch.commit();
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao transferir equipamento.');
    }
  },

  async changeStatus(input: { equipment: Equipment; status: EquipmentStatus; observation: string }) {
    try {
      const occurrenceRef = doc(collection(firestore, 'equipmentOccurrences'));
      const movement = movementData({ equipment: input.equipment, type: input.status === 'lost' ? 'lost' : input.status === 'retired' ? 'retirement' : 'found', observation: input.observation });
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'equipment', input.equipment.id), { status: input.status, updatedAt: serverTimestamp() });
      if (['damaged', 'under_review', 'lost'].includes(input.status)) {
        batch.set(occurrenceRef, {
          id: occurrenceRef.id, equipmentId: input.equipment.id, equipmentCode: input.equipment.code,
          vehicleId: input.equipment.currentVehicleId, vehiclePlate: input.equipment.currentVehiclePlate,
          type: input.status === 'damaged' ? 'damaged' : input.status === 'lost' ? 'lost' : 'other', reportedBy: auth.currentUser?.uid ?? '', reportedAt: serverTimestamp(),
          description: input.observation.trim(), status: input.status === 'lost' ? 'under_review' : 'open', resolvedAt: null, resolvedBy: '', photoUrl: '',
        });
      }
      batch.set(movement.ref, movement.data);
      await batch.commit();
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao atualizar situacao do equipamento.');
    }
  },

  async saveMonthlyInspection(input: { inspection: EquipmentInspection; items: EquipmentInspectionItem[] }) {
    try {
      const ref = doc(firestore, 'equipmentInspections', input.inspection.id || doc(collection(firestore, 'equipmentInspections')).id);
      const hasDivergence = input.items.some((item) => item.result !== 'ok');
      const batch = writeBatch(firestore);
      batch.set(ref, {
        id: ref.id, vehicleId: input.inspection.vehicleId, vehiclePlate: input.inspection.vehiclePlate, inspectionType: 'admin_monthly',
        referenceMonth: input.inspection.referenceMonth, referenceYear: input.inspection.referenceYear, performedAt: serverTimestamp(),
        performedByUserId: auth.currentUser?.uid ?? '', responsibleDriverId: input.inspection.responsibleDriverId,
        responsibleDriverName: input.inspection.responsibleDriverName, status: hasDivergence ? 'divergence' : 'completed', notes: input.inspection.notes.trim(), items: input.items,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      }, { merge: true });
      input.items.forEach((item) => {
        batch.update(doc(firestore, 'equipment', item.equipmentId), {
          lastInspectionAt: serverTimestamp(),
          ...(item.result === 'damaged' ? { status: 'damaged' } : item.result === 'not_found' ? { status: 'under_review' } : {}),
          updatedAt: serverTimestamp(),
        });
        if (item.result !== 'ok') {
          const occurrenceRef = doc(collection(firestore, 'equipmentOccurrences'));
          batch.set(occurrenceRef, {
            id: occurrenceRef.id, equipmentId: item.equipmentId, equipmentCode: item.equipmentCode,
            vehicleId: input.inspection.vehicleId, vehiclePlate: input.inspection.vehiclePlate,
            type: item.result === 'damaged' ? 'damaged' : item.result === 'not_found' ? 'not_found' : 'divergence',
            reportedBy: auth.currentUser?.uid ?? '', reportedAt: serverTimestamp(), description: item.observation,
            status: 'open', resolvedAt: null, resolvedBy: '', photoUrl: item.photoUrl,
          });
        }
      });
      await batch.commit();
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao finalizar inspecao mensal.');
    }
  },
};
