import type { AxleGroup, LoadCargo, LoadItem, LoadVehicle, Vec3 } from './models';

export const MODEL_VERSION = 1;
export const EPSILON = 0.001;

export type LoadIssue = { itemId: string; code: 'outside' | 'collision' | 'floating' | 'stacking' | 'layers' | 'top_weight'; message: string };
export type SupportReaction = { label: string; loadKg: number; limitKg: number | null; emptyKg: number | null };
export type LoadAnalysis = {
  placedCount: number;
  totalCount: number;
  cargoKg: number;
  tareKg: number;
  grossKg: number;
  remainingKg: number;
  usefulVolumeM3: number;
  occupiedVolumeM3: number;
  volumePercent: number;
  center: Vec3 | null;
  reactions: SupportReaction[] | null;
  reactionUnavailable: string[];
  issues: LoadIssue[];
  overCapacity: boolean;
  overGross: boolean;
};

export function dimensions(cargo: LoadCargo, rotation: 0 | 90): Vec3 {
  const length = cargo.shape === 'cylinder' ? cargo.length : cargo.length;
  const width = cargo.shape === 'cylinder' ? cargo.diameter ?? cargo.width : cargo.width;
  const height = cargo.shape === 'cylinder' ? cargo.diameter ?? cargo.height : cargo.height;
  return { x: rotation ? width : length, y: rotation ? length : width, z: height };
}

export function validateVehicle(vehicle: LoadVehicle): string[] {
  const errors: string[] = [];
  if (!vehicle.name.trim()) errors.push('Informe o nome do veiculo.');
  const required: Array<[string, number]> = [['comprimento', vehicle.length]];
  if (vehicle.kind !== 'tractor') required.push(['largura', vehicle.width], ['altura', vehicle.height], ['capacidade', vehicle.capacityKg]);
  for (const [label, value] of required) {
    if (!Number.isFinite(value) || value <= 0) errors.push(`Informe ${label} maior que zero.`);
  }
  if (!Number.isFinite(vehicle.tareKg) || vehicle.tareKg < 0) errors.push('Informe a tara em kg.');
  if (vehicle.grossLimitKg !== null && vehicle.grossLimitKg <= 0) errors.push('Limite bruto deve ser positivo.');
  if (vehicle.axleGroups.some((group) => !group.label.trim() || !Number.isFinite(group.x) || (group.maxKg !== null && group.maxKg <= 0) || (group.emptyKg !== null && group.emptyKg < 0))) errors.push('Revise os grupos de eixos.');
  return errors;
}

export function validateCargo(cargo: LoadCargo): string[] {
  const errors: string[] = [];
  if (!cargo.code.trim() || !cargo.description.trim()) errors.push('Informe codigo e descricao.');
  if (!Number.isFinite(cargo.weightKg) || cargo.weightKg <= 0) errors.push('Peso unitario deve ser positivo.');
  const values = cargo.shape === 'box' ? [cargo.length, cargo.width, cargo.height] : [cargo.length, cargo.diameter];
  if (values.some((value) => value === null || !Number.isFinite(value) || value <= 0)) errors.push('Todas as medidas devem ser positivas.');
  if (!Number.isInteger(cargo.maxLayers) || cargo.maxLayers < 1) errors.push('Maximo de camadas deve ser ao menos 1.');
  if (cargo.maxTopWeightKg !== null && cargo.maxTopWeightKg < 0) errors.push('Peso suportado acima nao pode ser negativo.');
  return errors;
}

function overlap(a: LoadItem, b: LoadItem): Vec3 {
  const ad = dimensions(a.cargo, a.rotation);
  const bd = dimensions(b.cargo, b.rotation);
  const ap = a.position!;
  const bp = b.position!;
  return { x: Math.min(ap.x + ad.x, bp.x + bd.x) - Math.max(ap.x, bp.x), y: Math.min(ap.y + ad.y, bp.y + bd.y) - Math.max(ap.y, bp.y), z: Math.min(ap.z + ad.z, bp.z + bd.z) - Math.max(ap.z, bp.z) };
}

function cargoVolume(cargo: LoadCargo): number {
  return cargo.shape === 'cylinder' ? Math.PI * ((cargo.diameter ?? 0) / 2) ** 2 * cargo.length : cargo.length * cargo.width * cargo.height;
}

function twoSupport(loads: Array<{ x: number; kg: number }>, frontX: number, rearX: number): [number, number] | null {
  if (!Number.isFinite(frontX) || !Number.isFinite(rearX) || rearX - frontX <= EPSILON) return null;
  const rear = loads.reduce((sum, load) => sum + load.kg * (load.x - frontX), 0) / (rearX - frontX);
  return [loads.reduce((sum, load) => sum + load.kg, 0) - rear, rear];
}

function emptyReactions(groups: AxleGroup[], tareKg: number, calculated: [number, number]): [number, number] {
  const first = groups[0].emptyKg;
  const second = groups[1].emptyKg;
  return first !== null && second !== null && Math.abs(first + second - tareKg) <= Math.max(1, tareKg * .01) ? [first, second] : calculated;
}

function supportLoads(vehicle: LoadVehicle, cargoLoads: Array<{ x: number; kg: number }>, tractor: LoadVehicle | null): { reactions: SupportReaction[] | null; missing: string[] } {
  const groups = [...vehicle.axleGroups].sort((a, b) => a.x - b.x);
  const missing: string[] = [];
  if (groups.length < 1) missing.push('posicoes dos apoios ou grupos de eixos');
  if (groups.length > 2) missing.push('parametros de suspensao para distribuir carga entre mais de dois grupos');
  if (vehicle.kind === 'carreta' || vehicle.kind === 'vanderleia') {
    if (vehicle.kingpinX === null) missing.push('posicao do pino-rei');
    if (!tractor) missing.push('cavalo mecanico vinculado');
    if (tractor && tractor.fifthWheelX === null) missing.push('posicao da quinta roda no cavalo');
    if (tractor && tractor.axleGroups.length !== 2) missing.push('dois grupos de apoio do cavalo');
    if (groups.length !== 1) missing.push('um grupo traseiro agregado do implemento');
    if (missing.length) return { reactions: null, missing };
    const trailerTare = twoSupport([{ x: vehicle.length / 2, kg: vehicle.tareKg }], vehicle.kingpinX!, groups[0].x);
    const trailerCargo = twoSupport(cargoLoads, vehicle.kingpinX!, groups[0].x);
    if (!trailerTare || !trailerCargo) return { reactions: null, missing: ['geometria valida entre pino-rei e apoio traseiro'] };
    const trailerEmpty = groups[0].emptyKg !== null && groups[0].emptyKg <= vehicle.tareKg ? [vehicle.tareKg - groups[0].emptyKg, groups[0].emptyKg] : trailerTare;
    const trailer = [trailerEmpty[0] + trailerCargo[0], trailerEmpty[1] + trailerCargo[1]];
    const tractorGroups = [...tractor!.axleGroups].sort((a, b) => a.x - b.x);
    const tractorTare = twoSupport([{ x: tractor!.length / 2, kg: tractor!.tareKg }], tractorGroups[0].x, tractorGroups[1].x);
    const transferred = twoSupport([{ x: tractor!.fifthWheelX!, kg: trailer[0] }], tractorGroups[0].x, tractorGroups[1].x);
    if (!tractorTare || !transferred) return { reactions: null, missing: ['geometria valida dos apoios do cavalo'] };
    const emptyTractor = emptyReactions(tractorGroups, tractor!.tareKg, tractorTare);
    const tractorReaction = [emptyTractor[0] + transferred[0], emptyTractor[1] + transferred[1]];
    return { reactions: [
      { label: `Cavalo: ${tractorGroups[0].label}`, loadKg: tractorReaction[0], limitKg: tractorGroups[0].maxKg, emptyKg: tractorGroups[0].emptyKg },
      { label: `Cavalo: ${tractorGroups[1].label}`, loadKg: tractorReaction[1], limitKg: tractorGroups[1].maxKg, emptyKg: tractorGroups[1].emptyKg },
      { label: `Implemento: ${groups[0].label}`, loadKg: trailer[1], limitKg: groups[0].maxKg, emptyKg: groups[0].emptyKg },
    ], missing: [] };
  }
  if (groups.length !== 2) return { reactions: null, missing: missing.length ? missing : ['dois grupos de apoio'] };
  const tare = twoSupport([{ x: vehicle.length / 2, kg: vehicle.tareKg }], groups[0].x, groups[1].x);
  const load = twoSupport(cargoLoads, groups[0].x, groups[1].x);
  if (!tare || !load) return { reactions: null, missing: ['geometria valida entre os dois grupos'] };
  const empty = emptyReactions(groups, vehicle.tareKg, tare);
  const reactions = [empty[0] + load[0], empty[1] + load[1]];
  return { reactions: groups.map((group, index) => ({ label: group.label, loadKg: reactions[index], limitKg: group.maxKg, emptyKg: group.emptyKg })), missing: [] };
}

export function analyzeLoad(vehicle: LoadVehicle, items: LoadItem[], tractor: LoadVehicle | null = null): LoadAnalysis {
  const placed = items.filter((item): item is LoadItem & { position: Vec3 } => Boolean(item.position));
  const issues: LoadIssue[] = [];
  const add = (itemId: string, code: LoadIssue['code'], message: string) => issues.push({ itemId, code, message });
  for (const item of placed) {
    const size = dimensions(item.cargo, item.rotation);
    const p = item.position;
    if (p.x < -EPSILON || p.y < -EPSILON || p.z < -EPSILON || p.x + size.x > vehicle.length + EPSILON || p.y + size.y > vehicle.width + EPSILON || p.z + size.z > vehicle.height + EPSILON) add(item.id, 'outside', `${item.cargo.code}: fora da area util`);
    const supporters = placed.filter((candidate) => candidate.id !== item.id && Math.abs(candidate.position.z + dimensions(candidate.cargo, candidate.rotation).z - p.z) <= EPSILON && overlap(item, candidate).x > EPSILON && overlap(item, candidate).y > EPSILON);
    if (p.z > EPSILON && !supporters.length) add(item.id, 'floating', `${item.cargo.code}: sem apoio`);
    for (const supporter of supporters) {
      if (!supporter.cargo.canStack) add(item.id, 'stacking', `${item.cargo.code}: empilhado sobre item que nao permite empilhamento`);
      const above = placed.filter((candidate) => candidate.position.z >= supporter.position.z + dimensions(supporter.cargo, supporter.rotation).z - EPSILON && overlap(candidate, supporter).x > EPSILON && overlap(candidate, supporter).y > EPSILON);
      if (above.reduce((sum, candidate) => sum + candidate.cargo.weightKg, 0) > (supporter.cargo.maxTopWeightKg ?? Infinity) + EPSILON) add(supporter.id, 'top_weight', `${supporter.cargo.code}: peso acima excedido`);
      const layers = 1 + placed.filter((candidate) => candidate.position.z < p.z - EPSILON && overlap(candidate, item).x > EPSILON && overlap(candidate, item).y > EPSILON).length;
      if (layers > supporter.cargo.maxLayers) add(item.id, 'layers', `${item.cargo.code}: limite de camadas excedido`);
    }
  }
  for (let index = 0; index < placed.length; index++) for (let other = index + 1; other < placed.length; other++) {
    const distance = overlap(placed[index], placed[other]);
    if (distance.x > EPSILON && distance.y > EPSILON && distance.z > EPSILON) add(placed[other].id, 'collision', `${placed[index].cargo.code} e ${placed[other].cargo.code}: sobreposicao`);
  }
  const cargoKg = placed.reduce((sum, item) => sum + item.cargo.weightKg, 0);
  const tareKg = vehicle.tareKg + (tractor?.tareKg ?? 0);
  const occupiedVolumeM3 = placed.reduce((sum, item) => sum + cargoVolume(item.cargo), 0);
  const usefulVolumeM3 = vehicle.length * vehicle.width * vehicle.height;
  const center = cargoKg ? placed.reduce((sum, item) => {
    const size = dimensions(item.cargo, item.rotation);
    return { x: sum.x + (item.position.x + size.x / 2) * item.cargo.weightKg, y: sum.y + (item.position.y + size.y / 2) * item.cargo.weightKg, z: sum.z + (item.position.z + size.z / 2) * item.cargo.weightKg };
  }, { x: 0, y: 0, z: 0 }) : null;
  const supports = supportLoads(vehicle, placed.map((item) => ({ x: item.position.x + dimensions(item.cargo, item.rotation).x / 2, kg: item.cargo.weightKg })), tractor);
  return { placedCount: placed.length, totalCount: items.length, cargoKg, tareKg, grossKg: tareKg + cargoKg, remainingKg: vehicle.capacityKg - cargoKg, usefulVolumeM3, occupiedVolumeM3, volumePercent: usefulVolumeM3 ? occupiedVolumeM3 / usefulVolumeM3 * 100 : 0, center: center ? { x: center.x / cargoKg, y: center.y / cargoKg, z: center.z / cargoKg } : null, reactions: supports.reactions, reactionUnavailable: supports.missing, issues, overCapacity: cargoKg > vehicle.capacityKg + EPSILON, overGross: vehicle.grossLimitKg !== null && tareKg + cargoKg > vehicle.grossLimitKg + EPSILON };
}

export function canPlace(vehicle: LoadVehicle, items: LoadItem[], candidate: LoadItem): boolean {
  return !analyzeLoad(vehicle, items.map((item) => item.id === candidate.id ? candidate : item)).issues.some((issue) => issue.itemId === candidate.id);
}

export type { AxleGroup };
