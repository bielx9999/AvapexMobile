import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { firestore } from '../../../core/firebase/firebaseConfig';
import { mapFirebaseError } from '../../../core/firebase/firebaseErrors';
import type { Vehicle, VehicleStatus, VehicleType } from '../../shared/domain/models';

export type VehicleFormInput = {
  id?: string;
  plate: string;
  fleetNumber: string;
  year: string;
  type: VehicleType;
  status: VehicleStatus;
};

function normalizePlate(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export const adminVehicleRepository = {
  async saveVehicle(input: VehicleFormInput): Promise<string> {
    const plate = normalizePlate(input.plate);
    const fleetNumber = input.fleetNumber.trim();
    const year = Number(input.year);

    if (!plate || !fleetNumber || !input.year || Number.isNaN(year)) {
      throw new Error('Informe placa, frota e ano do veiculo.');
    }

    try {
      const id = input.id || plate;
      await setDoc(
        doc(firestore, 'vehicles', id),
        {
          id,
          plate,
          fleetNumber,
          year,
          type: input.type,
          status: input.status,
          model: vehicleTypeLabel(input.type),
          currentKm: 0,
        },
        { merge: true },
      );
      return id;
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao salvar veiculo.');
    }
  },

  async setStatus(vehicle: Vehicle, status: VehicleStatus) {
    try {
      await updateDoc(doc(firestore, 'vehicles', vehicle.id), { status });
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao alterar status do veiculo.');
    }
  },

  async deleteVehicle(vehicle: Vehicle) {
    try {
      await deleteDoc(doc(firestore, 'vehicles', vehicle.id));
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao excluir veiculo.');
    }
  },
};

export function vehicleTypeLabel(type: VehicleType) {
  const labels: Record<VehicleType, string> = {
    mechanical_horse_trucado: 'Cavalo Mecanico Trucado',
    mechanical_horse_toco: 'Cavalo Mecanico Toco',
    truck: 'Caminhao Truck',
  };
  return labels[type];
}

export function vehicleStatusLabel(status: VehicleStatus) {
  const labels: Record<VehicleStatus, string> = {
    available: 'Disponivel',
    in_transit: 'Em transito',
    maintenance: 'Manutencao',
  };
  return labels[status];
}
