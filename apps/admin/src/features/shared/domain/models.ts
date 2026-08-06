export type UserRole = 'driver' | 'admin';
export type UserStatus = 'active' | 'inactive';
export type VehicleStatus = 'active' | 'inactive';
export type VehicleType = 'mechanical_horse_trucado' | 'mechanical_horse_toco' | 'truck';
export type TripStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type DriverTripResponse = 'pending' | 'accepted' | 'rejected';
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
export type RouteStatus = 'draft' | 'planned' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type RouteOptimizationStatus = 'not_requested' | 'processing' | 'optimized' | 'failed';
export type LocalityStatus = 'active' | 'inactive';
export type LocalitySource = 'import' | 'manual';
export type RouteTemplateStatus = 'active' | 'inactive';
export type RoutePointType = 'origin' | 'stop' | 'via' | 'destination';
export type DeliveryStatus = 'pending' | 'in_route' | 'arrived' | 'delivered' | 'not_delivered' | 'cancelled';
export type DeliveryProofStatus = 'pending' | 'submitted' | 'approved' | 'rejected';
export type RouteEventSource = 'admin' | 'driver' | 'system';
export type RouteEventType =
  | 'route_created'
  | 'route_assigned'
  | 'route_started'
  | 'route_completed'
  | 'route_cancelled'
  | 'delivery_check_in'
  | 'delivery_completed'
  | 'delivery_failed'
  | 'delivery_cancelled'
  | 'delivery_proof_submitted'
  | 'delivery_proof_approved'
  | 'delivery_proof_rejected'
  | 'status_changed'
  | 'note_added';

export type GeoLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  headingDegrees?: number;
  speedKph?: number;
  recordedAt?: Date | null;
};

export type AddressSnapshot = {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

export type TripCteDocument = {
  id: string;
  number: string;
  series: string;
  branch: string;
  issuedAt: Date | null;
  sender: string;
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: Date | null;
  uploadedBy: string;
};

export type TripRouteStop = {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  locationId?: string;
  order?: number;
};

export type Locality = {
  id: string;
  reference: string;
  normalizedReference: string;
  city: string;
  normalizedCity: string;
  uf: string;
  address: string;
  normalizedAddress: string;
  latitude: number | null;
  longitude: number | null;
  originalCoordinates: string;
  status: LocalityStatus;
  needsReview: boolean;
  source: LocalitySource;
  sourceRow: number | null;
  fingerprint: string;
  createdAt: Date | null;
  createdBy: string;
  updatedAt: Date | null;
  updatedBy: string;
};

export type RouteTemplatePoint = {
  id: string;
  type: RoutePointType;
  sequence: number;
  locationId: string;
  reference: string;
  city: string;
  uf: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type RouteVersionDefinition = {
  version: number;
  points: RouteTemplatePoint[];
  locationIds: string[];
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
  path: Array<{ latitude: number; longitude: number }>;
};

export type RouteVersion = RouteVersionDefinition & {
  id: string;
  routeTemplateId: string;
  createdAt: Date | null;
  createdBy: string;
};

export type RouteTemplate = {
  id: string;
  name: string;
  normalizedName: string;
  description: string;
  notes: string;
  status: RouteTemplateStatus;
  currentVersionId: string;
  currentVersion: RouteVersionDefinition;
  usedCount: number;
  createdAt: Date | null;
  createdBy: string;
  updatedAt: Date | null;
  updatedBy: string;
};

export type TripRouteSnapshot = RouteVersionDefinition & {
  routeTemplateId: string;
  routeVersionId: string;
  name: string;
};

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
  gpsLocation?: Record<string, unknown>;
  lastGpsUpdateAt?: Date | null;
  statusUpdatedAt?: Date | null;
  driverResponse?: DriverTripResponse;
  driverRespondedAt?: Date | null;
  driverResponseDriverId?: string;
  driverRejection?: {
    reasonCode: string;
    reasonLabel: string;
    notes: string;
  } | null;
  assignedAt?: Date | null;
  clientId?: string;
  clientName?: string;
  fleetNumber?: string;
  cteDocuments?: TripCteDocument[];
  routeId?: string;
  routeName?: string;
  originLocationId?: string;
  destinationLocationId?: string;
  originLocation?: AddressSnapshot;
  destinationLocation?: AddressSnapshot;
  routeStops?: TripRouteStop[];
  routeTemplateId?: string;
  routeVersionId?: string;
  routeSnapshot?: TripRouteSnapshot;
};

export type RoutePlan = {
  id: string;
  code: string;
  serviceDate: Date | null;
  status: RouteStatus;
  driverId: string;
  driverName: string;
  vehicleId: string;
  vehiclePlate: string;
  fleetId: string;
  carrierId: string;
  carrierName: string;
  operationTypeId: string;
  operationTypeName: string;
  regionIds: string[];
  startAddress: AddressSnapshot;
  endAddress: AddressSnapshot;
  deliveryCount: number;
  completedDeliveryCount: number;
  plannedDistanceMeters: number;
  plannedDurationSeconds: number;
  plannedCost: number;
  actualDistanceMeters: number;
  actualDurationSeconds: number;
  actualCost: number;
  optimization: {
    status: RouteOptimizationStatus;
    provider: string;
    requestId: string;
    optimizedAt: Date | null;
    errorMessage: string;
  };
  currentLocation?: GeoLocation;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date | null;
  createdBy: string;
  updatedAt: Date | null;
  updatedBy: string;
};

export type DeliveryFailure = {
  reasonCode: string;
  reasonLabel: string;
  notes: string;
  registeredAt: Date | null;
};

export type DeliveryProofRequirements = {
  requirePhoto: boolean;
  requireReceiverName: boolean;
  requireReceiverDocument: boolean;
  requireSignature: boolean;
  requireLocation: boolean;
};

export type Delivery = {
  id: string;
  routeId: string;
  orderNumber: string;
  cteAccessKey: string;
  cteNumber: string;
  clientId: string;
  clientName: string;
  carrierId: string;
  carrierName: string;
  regionId: string;
  regionName: string;
  driverId: string;
  driverName: string;
  vehicleId: string;
  vehiclePlate: string;
  sequence: number;
  status: DeliveryStatus;
  address: AddressSnapshot;
  scheduledAt: Date | null;
  timeWindowStart: Date | null;
  timeWindowEnd: Date | null;
  estimatedArrivalAt: Date | null;
  arrivedAt: Date | null;
  deliveredAt: Date | null;
  packageCount: number;
  weightKg: number;
  volumeM3: number;
  notes: string;
  proofRequirements: DeliveryProofRequirements;
  proofStatus: DeliveryProofStatus;
  deliveryProofId: string;
  checkInLocation?: GeoLocation;
  failure?: DeliveryFailure;
  createdAt: Date | null;
  createdBy: string;
  updatedAt: Date | null;
  updatedBy: string;
};

export type RouteEvent = {
  id: string;
  routeId: string;
  deliveryId: string;
  driverId: string;
  vehicleId: string;
  type: RouteEventType;
  source: RouteEventSource;
  actorId: string;
  actorName: string;
  fromStatus: string;
  toStatus: string;
  message: string;
  metadata: Record<string, unknown>;
  location?: GeoLocation;
  occurredAt: Date | null;
  createdAt: Date | null;
};

export type DeliveryFailureReasonSetting = {
  code: string;
  label: string;
  active: boolean;
  requireNotes: boolean;
  requirePhoto: boolean;
};

export type DeliverySettings = {
  id: 'delivery';
  kind: 'delivery';
  version: number;
  checkInRadiusMeters: number;
  defaultProofRequirements: DeliveryProofRequirements;
  failureReasons: DeliveryFailureReasonSetting[];
  statusTransitions: Partial<Record<DeliveryStatus, DeliveryStatus[]>>;
  updatedAt: Date | null;
  updatedBy: string;
};

export type RouteSettings = {
  id: 'routes';
  kind: 'routes';
  version: number;
  gpsUpdateIntervalSeconds: number;
  gpsOfflineAfterSeconds: number;
  allowDriverReorderStops: boolean;
  allowRouteEditAfterStart: boolean;
  statusTransitions: Partial<Record<RouteStatus, RouteStatus[]>>;
  updatedAt: Date | null;
  updatedBy: string;
};

export type PermissionSettings = {
  id: 'permissions';
  kind: 'permissions';
  version: number;
  rolePermissions: Record<string, string[]>;
  updatedAt: Date | null;
  updatedBy: string;
};

export type ImportSettings = {
  id: 'imports';
  kind: 'imports';
  version: number;
  maxRows: number;
  requiredColumns: string[];
  duplicateKey: string;
  allowPartialImport: boolean;
  updatedAt: Date | null;
  updatedBy: string;
};

export type OperationalSettings =
  | DeliverySettings
  | RouteSettings
  | PermissionSettings
  | ImportSettings;

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
  deliveryId: string;
  routeId: string;
  orderNumber: string;
  clientId: string;
  clientName: string;
  driverId: string;
  driverName: string;
  vehicleId: string;
  vehiclePlate: string;
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
  reviewedBy?: string;
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
