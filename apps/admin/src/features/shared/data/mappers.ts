import { readDate, readRecord, readStringList } from '../../../core/firebase/firestoreConverters';
import type {
  AppUser,
  Checklist,
  DeliveryReceipt,
  DriverEquipment,
  FuelingRecord,
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
    returnTrip: typeof data.returnTrip === 'boolean' ? data.returnTrip : false,
    customerRequestNumber:
      typeof data.customerRequestNumber === 'string' ? data.customerRequestNumber : undefined,
    programmedVehicleType: programmedVehicleType as Trip['programmedVehicleType'],
    returnGeneratedTripId:
      typeof data.returnGeneratedTripId === 'string' ? data.returnGeneratedTripId : undefined,
    returnSourceTripId: typeof data.returnSourceTripId === 'string' ? data.returnSourceTripId : undefined,
    unloadingGeneratedTripId:
      typeof data.unloadingGeneratedTripId === 'string' ? data.unloadingGeneratedTripId : undefined,
    unloadingSourceTripId:
      typeof data.unloadingSourceTripId === 'string' ? data.unloadingSourceTripId : undefined,
  };
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
    driverId: typeof data.driverId === 'string' ? data.driverId : '',
    driverName: typeof data.driverName === 'string' ? data.driverName : '',
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
