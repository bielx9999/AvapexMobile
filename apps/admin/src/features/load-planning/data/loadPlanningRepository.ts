import { collection, deleteField, doc, getDoc, getDocs, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, firestore } from '../../../core/firebase/firebaseConfig';
import { mapFirebaseError } from '../../../core/firebase/firebaseErrors';
import { analyzeLoad, MODEL_VERSION, validateCargo, validateVehicle } from '../domain/engine';
import type { LoadCargo, LoadPlan, LoadVehicle } from '../domain/models';
import { snapshotPlan } from '../domain/snapshot';

type StoredDate = { toDate?: () => Date } | Date | null;
const date = (value: unknown): Date | null => value && typeof value === 'object' && 'toDate' in value ? (value as StoredDate & { toDate: () => Date }).toDate() : value instanceof Date ? value : null;
const vehicle = (id: string, data: Record<string, unknown>): LoadVehicle => ({ ...data, id, createdAt: date(data.createdAt), updatedAt: date(data.updatedAt) } as LoadVehicle);
const cargo = (id: string, data: Record<string, unknown>): LoadCargo => ({ ...data, id, createdAt: date(data.createdAt), updatedAt: date(data.updatedAt) } as LoadCargo);
const plan = (id: string, data: Record<string, unknown>): LoadPlan => ({ ...data, id, createdAt: date(data.createdAt), updatedAt: date(data.updatedAt) } as LoadPlan);
const ensureAdmin = () => { if (!auth.currentUser) throw new Error('Sessao encerrada. Entre novamente.'); };

export const loadPlanningRepository = {
  async load() {
    try {
      ensureAdmin();
      const [vehicles, cargos, plans] = await Promise.all(['loadVehicles', 'loadCargos', 'loadPlans'].map((name) => getDocs(collection(firestore, name))));
      return {
        vehicles: vehicles.docs.map((item) => vehicle(item.id, item.data())),
        cargos: cargos.docs.map((item) => cargo(item.id, item.data())),
        plans: plans.docs.map((item) => plan(item.id, item.data())),
      };
    } catch (error) { throw mapFirebaseError(error, 'Erro ao carregar planejamento de carga.'); }
  },
  async saveVehicle(input: LoadVehicle) {
    const errors = validateVehicle(input);
    if (errors.length) throw new Error(errors.join(' '));
    ensureAdmin();
    const ref = input.id ? doc(firestore, 'loadVehicles', input.id) : doc(collection(firestore, 'loadVehicles'));
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...fields } = input;
    void _createdAt; void _updatedAt;
    await setDoc(ref, { ...fields, ...(input.id ? { fleetVehicleId: deleteField(), plate: deleteField(), fleet: deleteField() } : {}), id: ref.id, updatedAt: serverTimestamp(), ...(!input.id ? { createdAt: serverTimestamp() } : {}) }, { merge: true });
    return ref.id;
  },
  async setVehicleActive(id: string, active: boolean) { ensureAdmin(); await updateDoc(doc(firestore, 'loadVehicles', id), { active, updatedAt: serverTimestamp() }); },
  async saveCargo(input: LoadCargo) {
    const errors = validateCargo(input);
    if (errors.length) throw new Error(errors.join(' '));
    ensureAdmin();
    const ref = input.id ? doc(firestore, 'loadCargos', input.id) : doc(collection(firestore, 'loadCargos'));
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...fields } = input;
    void _createdAt; void _updatedAt;
    await setDoc(ref, { ...fields, id: ref.id, updatedAt: serverTimestamp(), ...(!input.id ? { createdAt: serverTimestamp() } : {}) }, { merge: true });
    return ref.id;
  },
  async savePlan(input: LoadPlan) {
    ensureAdmin();
    if (!input.name.trim()) throw new Error('Informe o nome do plano.');
    if (!input.vehicleId) throw new Error('Selecione uma carroceria.');
    const analysis = analyzeLoad(input.vehicle, input.items, input.tractor);
    if (analysis.issues.length || analysis.overCapacity || analysis.overGross || analysis.reactions?.some((reaction) => reaction.limitKg !== null && reaction.loadKg > reaction.limitKg)) throw new Error('Corrija os alertas de posicionamento e peso antes de salvar.');
    const ref = input.id ? doc(firestore, 'loadPlans', input.id) : doc(collection(firestore, 'loadPlans'));
    await runTransaction(firestore, async (transaction) => {
      const existing = input.id ? await transaction.get(ref) : null;
      if (existing?.exists() && existing.data().revision !== input.revision) throw new Error('Este plano foi alterado em outra sessao. Reabra-o antes de salvar.');
      transaction.set(ref, { id: ref.id, ...snapshotPlan(input), authorId: existing?.data()?.authorId ?? auth.currentUser!.uid, modelVersion: MODEL_VERSION, revision: input.revision + 1, createdAt: existing?.data()?.createdAt ?? serverTimestamp(), updatedAt: serverTimestamp() });
    });
    const saved = await getDoc(ref);
    return plan(ref.id, saved.data() ?? {});
  },
};
