import type { LoadPlan } from './models';

export function snapshotPlan(input: LoadPlan) {
  return {
    name: input.name.trim(),
    vehicleId: input.vehicleId,
    vehicle: { ...input.vehicle, createdAt: null, updatedAt: null },
    tractor: input.tractor ? { ...input.tractor, createdAt: null, updatedAt: null } : null,
    items: input.items.map((item) => ({ ...item, position: item.position ? { ...item.position } : null, cargo: { ...item.cargo, createdAt: null, updatedAt: null } })),
    notes: input.notes,
  };
}
