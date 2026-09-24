export type LoadVehicleKind = 'truck' | 'carreta' | 'vanderleia' | 'tractor';
export type Vec3 = { x: number; y: number; z: number };
export type AxleGroup = { id: string; label: string; x: number; maxKg: number | null; emptyKg: number | null };

export type LoadVehicle = {
  id: string;
  name: string;
  kind: LoadVehicleKind;
  length: number;
  width: number;
  height: number;
  tareKg: number;
  capacityKg: number;
  grossLimitKg: number | null;
  axleGroups: AxleGroup[];
  kingpinX: number | null;
  fifthWheelX: number | null;
  tractorId: string;
  notes: string;
  active: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type LoadCargo = {
  id: string;
  code: string;
  description: string;
  shape: 'box' | 'cylinder';
  weightKg: number;
  length: number;
  width: number;
  height: number;
  diameter: number | null;
  color: string;
  canRotate: boolean;
  canStack: boolean;
  maxLayers: number;
  maxTopWeightKg: number | null;
  notes: string;
  active: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type LoadItem = {
  id: string;
  cargoId: string;
  cargo: LoadCargo;
  position: Vec3 | null;
  rotation: 0 | 90;
};

export type LoadPlan = {
  id: string;
  name: string;
  vehicleId: string;
  vehicle: LoadVehicle;
  tractor: LoadVehicle | null;
  items: LoadItem[];
  notes: string;
  authorId: string;
  modelVersion: number;
  revision: number;
  createdAt: Date | null;
  updatedAt: Date | null;
};
