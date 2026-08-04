import { readDate, readRecord, readStringList } from '../../../core/firebase/firestoreConverters';
import type {
  AppUser,
  AddressSnapshot,
  Checklist,
  Delivery,
  DeliveryReceipt,
  DeliveryProofRequirements,
  DriverEquipment,
  FuelingRecord,
  GeoLocation,
  OperationalSettings,
  RouteEvent,
  RoutePlan,
  Trip,
  Vehicle,
} from '../domain/models';

export function mapUser(id: string, data: Record<string, unknown>): AppUser {
  const cnh = readRecord(data.cnh);
  return {
    uid: typeof data.uid === 'string' ? data.uid : id,
    name: typeof data.name === 'string' ? data.name : '',
    email: typeof data.email === 'string' ? data.email : '',
    phone: typeof data.phone === 'string' ? data.phone : '',
    role: data.role === 'admin' ? 'admin' : 'driver',
    status: data.status === 'inactive' ? 'inactive' : 'active',
    photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : undefined,
    cnh:
      Object.keys(cnh).length > 0
        ? {
            number: typeof cnh.number === 'string' ? cnh.number : undefined,
            category: typeof cnh.category === 'string' ? cnh.category : undefined,
            expirationDate: readDate(cnh.expirationDate),
          }
        : undefined,
    createdAt: readDate(data.createdAt),
  };
}

export function mapVehicle(id: string, data: Record<string, unknown>): Vehicle {
  const type = typeof data.type === 'string' ? data.type : 'truck';
  return {
    id: typeof data.id === 'string' ? data.id : id,
    plate: typeof data.plate === 'string' ? data.plate : id,
    model: typeof data.model === 'string' ? data.model : '',
    fleetNumber:
      typeof data.fleetNumber === 'string'
        ? data.fleetNumber
        : typeof data.frota === 'string'
          ? data.frota
          : '',
    year: typeof data.year === 'number' ? data.year : null,
    type:
      type === 'mechanical_horse_trucado' || type === 'mechanical_horse_toco' || type === 'truck'
        ? type
        : 'truck',
    currentKm: typeof data.currentKm === 'number' ? data.currentKm : 0,
    status: data.status === 'inactive' || data.status === 'maintenance' ? 'inactive' : 'active',
    lastChecklistId: typeof data.lastChecklistId === 'string' ? data.lastChecklistId : undefined,
  };
}

export function mapTrip(id: string, data: Record<string, unknown>): Trip {
  const programmingStatus =
    data.programmingStatus === 'in_transit' ||
    data.programmingStatus === 'unloading' ||
    data.programmingStatus === 'unloading_in_transit' ||
    data.programmingStatus === 'awaiting_invoice' ||
    data.programmingStatus === 'released'
      ? data.programmingStatus === 'unloading_in_transit'
        ? 'unloading'
        : data.programmingStatus
      : 'loading';
  const programmedVehicleType =
    typeof data.programmedVehicleType === 'string' ? data.programmedVehicleType : undefined;
  const operationalStatus =
    data.operationalStatus === 'transit_to_loading' ||
    data.operationalStatus === 'transit_to_unloading' ||
    data.operationalStatus === 'waiting_loading' ||
    data.operationalStatus === 'loading' ||
    data.operationalStatus === 'waiting_unloading' ||
    data.operationalStatus === 'unloading' ||
    data.operationalStatus === 'released_unloading' ||
    data.operationalStatus === 'released_loading'
      ? data.operationalStatus
      : defaultOperationalStatus(programmingStatus as Trip['programmingStatus']);
  const operationType =
    data.operationType === 'loading' || data.operationType === 'unloading'
      ? data.operationType
      : operationalStatus === 'transit_to_unloading' ||
          operationalStatus === 'waiting_unloading' ||
          operationalStatus === 'unloading' ||
          operationalStatus === 'released_unloading' ||
          programmingStatus === 'unloading'
        ? 'unloading'
        : 'loading';

  return {
    id: typeof data.id === 'string' ? data.id : id,
    driverId: typeof data.driverId === 'string' ? data.driverId : '',
    vehicleId: typeof data.vehicleId === 'string' ? data.vehicleId : '',
    origin: typeof data.origin === 'string' ? data.origin : '',
    destination: typeof data.destination === 'string' ? data.destination : '',
    status:
      data.status === 'in_progress' || data.status === 'completed' || data.status === 'cancelled'
        ? data.status
        : 'pending',
    scheduledAt: readDate(data.scheduledAt),
    startedAt: readDate(data.startedAt),
    completedAt: readDate(data.completedAt),
    deliveryDocs: readStringList(data.deliveryDocs),
    driverName: typeof data.driverName === 'string' ? data.driverName : undefined,
    vehiclePlate: typeof data.vehiclePlate === 'string' ? data.vehiclePlate : undefined,
    vehicleModel: typeof data.vehicleModel === 'string' ? data.vehicleModel : undefined,
    programmingStatus: programmingStatus as Trip['programmingStatus'],
    operationalStatus,
    returnTrip: typeof data.returnTrip === 'boolean' ? data.returnTrip : false,
    customerRequestNumber:
      typeof data.customerRequestNumber === 'string' ? data.customerRequestNumber : undefined,
    programmedVehicleType: programmedVehicleType as Trip['programmedVehicleType'],
    operationType,
    expectedArrivalAt: readDate(data.expectedArrivalAt),
    additionalInfo: typeof data.additionalInfo === 'string' ? data.additionalInfo : undefined,
    returnGeneratedTripId:
      typeof data.returnGeneratedTripId === 'string' ? data.returnGeneratedTripId : undefined,
    returnSourceTripId: typeof data.returnSourceTripId === 'string' ? data.returnSourceTripId : undefined,
    unloadingGeneratedTripId:
      typeof data.unloadingGeneratedTripId === 'string' ? data.unloadingGeneratedTripId : undefined,
    unloadingSourceTripId:
      typeof data.unloadingSourceTripId === 'string' ? data.unloadingSourceTripId : undefined,
    gpsLocation: data.gpsLocation ? readRecord(data.gpsLocation) : undefined,
    lastGpsUpdateAt: readDate(data.lastGpsUpdateAt),
    statusUpdatedAt: readDate(data.statusUpdatedAt),
  };
}

export function mapRoute(id: string, data: Record<string, unknown>): RoutePlan {
  const optimization = readRecord(data.optimization);
  const optimizationStatus = optimization.status;
  return {
    id: readString(data.id, id),
    code: readString(data.code),
    serviceDate: readDate(data.serviceDate),
    status: isRouteStatus(data.status) ? data.status : 'draft',
    driverId: readString(data.driverId),
    driverName: readString(data.driverName),
    vehicleId: readString(data.vehicleId),
    vehiclePlate: readString(data.vehiclePlate),
    fleetId: readString(data.fleetId),
    carrierId: readString(data.carrierId),
    carrierName: readString(data.carrierName),
    operationTypeId: readString(data.operationTypeId),
    operationTypeName: readString(data.operationTypeName),
    regionIds: readStringList(data.regionIds),
    startAddress: mapAddress(data.startAddress),
    endAddress: mapAddress(data.endAddress),
    deliveryCount: readNumber(data.deliveryCount),
    completedDeliveryCount: readNumber(data.completedDeliveryCount),
    plannedDistanceMeters: readNumber(data.plannedDistanceMeters),
    plannedDurationSeconds: readNumber(data.plannedDurationSeconds),
    plannedCost: readNumber(data.plannedCost),
    actualDistanceMeters: readNumber(data.actualDistanceMeters),
    actualDurationSeconds: readNumber(data.actualDurationSeconds),
    actualCost: readNumber(data.actualCost),
    optimization: {
      status:
        optimizationStatus === 'processing' ||
        optimizationStatus === 'optimized' ||
        optimizationStatus === 'failed'
          ? optimizationStatus
          : 'not_requested',
      provider: readString(optimization.provider),
      requestId: readString(optimization.requestId),
      optimizedAt: readDate(optimization.optimizedAt),
      errorMessage: readString(optimization.errorMessage),
    },
    currentLocation: mapGeoLocation(data.currentLocation),
    startedAt: readDate(data.startedAt),
    completedAt: readDate(data.completedAt),
    createdAt: readDate(data.createdAt),
    createdBy: readString(data.createdBy),
    updatedAt: readDate(data.updatedAt),
    updatedBy: readString(data.updatedBy),
  };
}

export function mapDelivery(id: string, data: Record<string, unknown>): Delivery {
  const failure = readRecord(data.failure);
  return {
    id: readString(data.id, id),
    routeId: readString(data.routeId),
    orderNumber: readString(data.orderNumber),
    cteAccessKey: readString(data.cteAccessKey),
    cteNumber: readString(data.cteNumber),
    clientId: readString(data.clientId),
    clientName: readString(data.clientName),
    carrierId: readString(data.carrierId),
    carrierName: readString(data.carrierName),
    regionId: readString(data.regionId),
    regionName: readString(data.regionName),
    driverId: readString(data.driverId),
    driverName: readString(data.driverName),
    vehicleId: readString(data.vehicleId),
    vehiclePlate: readString(data.vehiclePlate),
    sequence: readNumber(data.sequence),
    status: isDeliveryStatus(data.status) ? data.status : 'pending',
    address: mapAddress(data.address),
    scheduledAt: readDate(data.scheduledAt),
    timeWindowStart: readDate(data.timeWindowStart),
    timeWindowEnd: readDate(data.timeWindowEnd),
    estimatedArrivalAt: readDate(data.estimatedArrivalAt),
    arrivedAt: readDate(data.arrivedAt),
    deliveredAt: readDate(data.deliveredAt),
    packageCount: readNumber(data.packageCount),
    weightKg: readNumber(data.weightKg),
    volumeM3: readNumber(data.volumeM3),
    notes: readString(data.notes),
    proofRequirements: mapProofRequirements(data.proofRequirements),
    proofStatus:
      data.proofStatus === 'submitted' || data.proofStatus === 'approved' || data.proofStatus === 'rejected'
        ? data.proofStatus
        : 'pending',
    deliveryProofId: readString(data.deliveryProofId),
    checkInLocation: mapGeoLocation(data.checkInLocation),
    failure:
      Object.keys(failure).length > 0
        ? {
            reasonCode: readString(failure.reasonCode),
            reasonLabel: readString(failure.reasonLabel),
            notes: readString(failure.notes),
            registeredAt: readDate(failure.registeredAt),
          }
        : undefined,
    createdAt: readDate(data.createdAt),
    createdBy: readString(data.createdBy),
    updatedAt: readDate(data.updatedAt),
    updatedBy: readString(data.updatedBy),
  };
}

export function mapRouteEvent(id: string, data: Record<string, unknown>): RouteEvent {
  return {
    id: readString(data.id, id),
    routeId: readString(data.routeId),
    deliveryId: readString(data.deliveryId),
    driverId: readString(data.driverId),
    vehicleId: readString(data.vehicleId),
    type: isRouteEventType(data.type) ? data.type : 'note_added',
    source: data.source === 'driver' || data.source === 'system' ? data.source : 'admin',
    actorId: readString(data.actorId),
    actorName: readString(data.actorName),
    fromStatus: readString(data.fromStatus),
    toStatus: readString(data.toStatus),
    message: readString(data.message),
    metadata: readRecord(data.metadata),
    location: mapGeoLocation(data.location),
    occurredAt: readDate(data.occurredAt),
    createdAt: readDate(data.createdAt),
  };
}

export function mapOperationalSettings(id: string, data: Record<string, unknown>): OperationalSettings {
  const kind = data.kind === 'delivery' || data.kind === 'routes' || data.kind === 'permissions' || data.kind === 'imports'
    ? data.kind
    : id === 'delivery' || id === 'routes' || id === 'permissions'
      ? id
      : 'imports';
  const common = {
    version: readNumber(data.version, 1),
    updatedAt: readDate(data.updatedAt),
    updatedBy: readString(data.updatedBy),
  };

  if (kind === 'delivery') {
    const reasons = Array.isArray(data.failureReasons) ? data.failureReasons : [];
    return {
      id: 'delivery',
      kind,
      ...common,
      checkInRadiusMeters: readNumber(data.checkInRadiusMeters, 150),
      defaultProofRequirements: mapProofRequirements(data.defaultProofRequirements),
      failureReasons: reasons.map((reason) => {
        const value = readRecord(reason);
        return {
          code: readString(value.code),
          label: readString(value.label),
          active: readBoolean(value.active, true),
          requireNotes: readBoolean(value.requireNotes, true),
          requirePhoto: readBoolean(value.requirePhoto),
        };
      }),
      statusTransitions: readTransitions(data.statusTransitions),
    };
  }
  if (kind === 'routes') {
    return {
      id: 'routes',
      kind,
      ...common,
      gpsUpdateIntervalSeconds: readNumber(data.gpsUpdateIntervalSeconds, 60),
      gpsOfflineAfterSeconds: readNumber(data.gpsOfflineAfterSeconds, 180),
      allowDriverReorderStops: readBoolean(data.allowDriverReorderStops),
      allowRouteEditAfterStart: readBoolean(data.allowRouteEditAfterStart),
      statusTransitions: readTransitions(data.statusTransitions),
    };
  }
  if (kind === 'permissions') {
    const rolePermissions = readRecord(data.rolePermissions);
    return {
      id: 'permissions',
      kind,
      ...common,
      rolePermissions: Object.fromEntries(
        Object.entries(rolePermissions).map(([role, permissions]) => [role, readStringList(permissions)]),
      ),
    };
  }
  return {
    id: 'imports',
    kind: 'imports',
    ...common,
    maxRows: readNumber(data.maxRows, 1000),
    requiredColumns: readStringList(data.requiredColumns),
    duplicateKey: readString(data.duplicateKey, 'orderNumber'),
    allowPartialImport: readBoolean(data.allowPartialImport),
  };
}

function defaultOperationalStatus(programmingStatus: Trip['programmingStatus']): Trip['operationalStatus'] {
  if (programmingStatus === 'in_transit') {
    return 'transit_to_loading';
  }
  if (programmingStatus === 'unloading') {
    return 'waiting_unloading';
  }
  if (programmingStatus === 'released') {
    return 'released_unloading';
  }
  if (programmingStatus === 'loading') {
    return 'waiting_loading';
  }
  return undefined;
}

export function mapChecklist(id: string, data: Record<string, unknown>): Checklist {
  const type = typeof data.type === 'string' ? data.type : 'vehicle_daily';
  return {
    id: typeof data.id === 'string' ? data.id : id,
    tripId: typeof data.tripId === 'string' ? data.tripId : '',
    driverId: typeof data.driverId === 'string' ? data.driverId : '',
    vehicleId: typeof data.vehicleId === 'string' ? data.vehicleId : '',
    type: type as Checklist['type'],
    kmRegistered: typeof data.kmRegistered === 'number' ? data.kmRegistered : 0,
    items: readRecord(data.items),
    photoUrls: readStringList(data.photoUrls),
    signatureUrl: typeof data.signatureUrl === 'string' ? data.signatureUrl : '',
    createdAt: readDate(data.createdAt),
    category: typeof data.category === 'string' ? data.category : undefined,
    vehiclePlate: typeof data.vehiclePlate === 'string' ? data.vehiclePlate : undefined,
    driverName: typeof data.driverName === 'string' ? data.driverName : undefined,
    location: data.location ? readRecord(data.location) : undefined,
    answers: data.answers ? readRecord(data.answers) : undefined,
    approvalStatus: typeof data.approvalStatus === 'string' ? data.approvalStatus : undefined,
    hasCriticalFailure: typeof data.hasCriticalFailure === 'boolean' ? data.hasCriticalFailure : undefined,
  };
}

export function mapDeliveryReceipt(id: string, data: Record<string, unknown>): DeliveryReceipt {
  const adminStatus = typeof data.adminStatus === 'string' ? data.adminStatus : 'pending';
  const driverNotificationStatus =
    typeof data.driverNotificationStatus === 'string' ? data.driverNotificationStatus : 'not_sent';

  return {
    id: typeof data.id === 'string' ? data.id : id,
    deliveryId: readString(data.deliveryId),
    routeId: readString(data.routeId),
    orderNumber: readString(data.orderNumber),
    clientId: readString(data.clientId),
    clientName: readString(data.clientName),
    driverId: typeof data.driverId === 'string' ? data.driverId : '',
    driverName: typeof data.driverName === 'string' ? data.driverName : '',
    vehicleId: readString(data.vehicleId),
    vehiclePlate: readString(data.vehiclePlate),
    cteAccessKey: typeof data.cteAccessKey === 'string' ? data.cteAccessKey : '',
    cteNumber: typeof data.cteNumber === 'string' ? data.cteNumber : '',
    receiverName: typeof data.receiverName === 'string' ? data.receiverName : '',
    receiverDocument: typeof data.receiverDocument === 'string' ? data.receiverDocument : '',
    location: readRecord(data.location),
    physicalProofPhotoUrls: readStringList(data.physicalProofPhotoUrls),
    declaration: typeof data.declaration === 'string' ? data.declaration : '',
    createdAt: readDate(data.createdAt),
    adminStatus: adminStatus as DeliveryReceipt['adminStatus'],
    failureReason: typeof data.failureReason === 'string' ? data.failureReason : undefined,
    driverNotificationMessage:
      typeof data.driverNotificationMessage === 'string' ? data.driverNotificationMessage : undefined,
    driverNotificationStatus: driverNotificationStatus as DeliveryReceipt['driverNotificationStatus'],
    reviewedAt: readDate(data.reviewedAt),
    reviewedBy: readString(data.reviewedBy),
  };
}

export function mapFuelingRecord(id: string, data: Record<string, unknown>): FuelingRecord {
  return {
    id: typeof data.id === 'string' ? data.id : id,
    driverId: typeof data.driverId === 'string' ? data.driverId : '',
    driverName: typeof data.driverName === 'string' ? data.driverName : '',
    vehicleId: typeof data.vehicleId === 'string' ? data.vehicleId : '',
    vehiclePlate: typeof data.vehiclePlate === 'string' ? data.vehiclePlate : '',
    vehicleModel: typeof data.vehicleModel === 'string' ? data.vehicleModel : '',
    kmRegistered: typeof data.kmRegistered === 'number' ? data.kmRegistered : 0,
    fuelType: data.fuelType === 'arla' ? 'arla' : 'diesel',
    receiptPhotoUrls: readStringList(data.receiptPhotoUrls),
    odometerPhotoUrls: readStringList(data.odometerPhotoUrls),
    notificationStatus:
      typeof data.notificationStatus === 'string' ? data.notificationStatus : 'pending_whatsapp',
    createdAt: readDate(data.createdAt),
  };
}

export function mapDriverEquipment(id: string, data: Record<string, unknown>): DriverEquipment {
  const type = typeof data.type === 'string' ? data.type : 'strap';
  return {
    id: typeof data.id === 'string' ? data.id : id,
    driverId: typeof data.driverId === 'string' ? data.driverId : '',
    type: type as DriverEquipment['type'],
    tagNumber: typeof data.tagNumber === 'string' ? data.tagNumber : '',
    status: typeof data.status === 'string' ? data.status : 'available',
    description: typeof data.description === 'string' ? data.description : undefined,
  };
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function mapAddress(value: unknown): AddressSnapshot {
  const data = readRecord(value);
  return {
    formattedAddress: readString(data.formattedAddress),
    latitude: readNumber(data.latitude),
    longitude: readNumber(data.longitude),
    placeId: readString(data.placeId) || undefined,
    city: readString(data.city) || undefined,
    state: readString(data.state) || undefined,
    postalCode: readString(data.postalCode) || undefined,
  };
}

function mapGeoLocation(value: unknown): GeoLocation | undefined {
  const data = readRecord(value);
  if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
    return undefined;
  }
  return {
    latitude: data.latitude,
    longitude: data.longitude,
    accuracyMeters: typeof data.accuracyMeters === 'number' ? data.accuracyMeters : undefined,
    headingDegrees: typeof data.headingDegrees === 'number' ? data.headingDegrees : undefined,
    speedKph: typeof data.speedKph === 'number' ? data.speedKph : undefined,
    recordedAt: readDate(data.recordedAt),
  };
}

function mapProofRequirements(value: unknown): DeliveryProofRequirements {
  const data = readRecord(value);
  return {
    requirePhoto: readBoolean(data.requirePhoto, true),
    requireReceiverName: readBoolean(data.requireReceiverName, true),
    requireReceiverDocument: readBoolean(data.requireReceiverDocument, true),
    requireSignature: readBoolean(data.requireSignature),
    requireLocation: readBoolean(data.requireLocation, true),
  };
}

function readTransitions<TStatus extends string>(value: unknown) {
  return Object.fromEntries(
    Object.entries(readRecord(value)).map(([status, transitions]) => [status, readStringList(transitions)]),
  ) as Partial<Record<TStatus, TStatus[]>>;
}

function isRouteStatus(value: unknown): value is RoutePlan['status'] {
  return value === 'draft' || value === 'planned' || value === 'assigned' || value === 'in_progress' || value === 'completed' || value === 'cancelled';
}

function isDeliveryStatus(value: unknown): value is Delivery['status'] {
  return value === 'pending' || value === 'in_route' || value === 'arrived' || value === 'delivered' || value === 'not_delivered' || value === 'cancelled';
}

function isRouteEventType(value: unknown): value is RouteEvent['type'] {
  return value === 'route_created' || value === 'route_assigned' || value === 'route_started' || value === 'route_completed' || value === 'route_cancelled' || value === 'delivery_check_in' || value === 'delivery_completed' || value === 'delivery_failed' || value === 'delivery_cancelled' || value === 'delivery_proof_submitted' || value === 'delivery_proof_approved' || value === 'delivery_proof_rejected' || value === 'status_changed' || value === 'note_added';
}
