export type UserRole = 'driver' | 'admin';
export type UserStatus = 'active' | 'inactive';
export type VehicleStatus = 'active' | 'inactive';
export type VehicleType = 'mechanical_horse_trucado' | 'mechanical_horse_toco' | 'truck';
export type TripStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type ProgrammingStatus = 'loading' | 'in_transit' | 'unloading' | 'awaiting_invoice' | 'released';
export type ProgrammingOperationType = 'loading' | 'unloading';
export type ProgrammingOperationalStatus =
  | 'transit_to_loading'
  | 'transit_to_unloading'
  | 'waiting_loading'
  | 'loading'
  | 'waiting_unloading'
  | 'unloading'
  | 'released_unloading'
  | 'released_loading';
export type ProgrammedVehicleType =
  | 'vanderleia'
  | 'carreta'
  | 'truck'
  | 'sprinter'
  | 'munck'
  | 'rodotrem'
  | 'prancha'
  | 'saveiro'
  | 'hr';
export type ChecklistType = 'departure' | 'arrival' | 'vehicle_daily' | 'chain_tensioner' | 'strap_ratchet';
export type FuelType = 'diesel' | 'arla';
export type EquipmentType = 'strap' | 'ratchet' | 'chain' | 'tensioner';

export type AppUser = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  photoUrl?: string;
  cnh?: {
    number?: string;
    category?: string;
    expirationDate?: Date | null;
  };
  createdAt: Date | null;
};

export type Vehicle = {
  id: string;
  plate: string;
  model: string;
  fleetNumber: string;
  year: number | null;
  type: VehicleType;
  currentKm: number;
  status: VehicleStatus;
  lastChecklistId?: string;
};

export type Trip = {
  id: string;
  driverId: string;
  vehicleId: string;
  origin: string;
  destination: string;
  status: TripStatus;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  deliveryDocs: string[];
  driverName?: string;
  vehiclePlate?: string;
  vehicleModel?: string;
  programmingStatus?: ProgrammingStatus;
  operationalStatus?: ProgrammingOperationalStatus;
  returnTrip?: boolean;
  customerRequestNumber?: string;
  programmedVehicleType?: ProgrammedVehicleType;
  operationType?: ProgrammingOperationType;
  expectedArrivalAt?: Date | null;
  additionalInfo?: string;
  returnGeneratedTripId?: string;
  returnSourceTripId?: string;
  unloadingGeneratedTripId?: string;
  unloadingSourceTripId?: string;
};

export type Checklist = {
  id: string;
  tripId: string;
  driverId: string;
  vehicleId: string;
  type: ChecklistType;
  kmRegistered: number;
  items: Record<string, unknown>;
  photoUrls: string[];
  signatureUrl: string;
  createdAt: Date | null;
  category?: string;
  vehiclePlate?: string;
  driverName?: string;
  location?: Record<string, unknown>;
  answers?: Record<string, unknown>;
  approvalStatus?: string;
  hasCriticalFailure?: boolean;
};

export type DeliveryReceipt = {
  id: string;
  driverId: string;
  driverName: string;
  cteAccessKey: string;
  cteNumber: string;
  receiverName: string;
  receiverDocument: string;
  location: Record<string, unknown>;
  physicalProofPhotoUrls: string[];
  declaration: string;
  createdAt: Date | null;
  adminStatus?: 'pending' | 'delivered' | 'failed';
  failureReason?: string;
  driverNotificationMessage?: string;
  driverNotificationStatus?: 'not_sent' | 'queued' | 'sent';
  reviewedAt?: Date | null;
};

export type FuelingRecord = {
  id: string;
  driverId: string;
  driverName: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleModel: string;
  kmRegistered: number;
  fuelType: FuelType;
  receiptPhotoUrls: string[];
  odometerPhotoUrls: string[];
  notificationStatus: string;
  createdAt: Date | null;
};

export type DriverEquipment = {
  id: string;
  driverId: string;
  type: EquipmentType;
  tagNumber: string;
  status: string;
  description?: string;
};
