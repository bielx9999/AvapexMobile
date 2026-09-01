import { deleteDoc, deleteField, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
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
  currentDriverId?: string;
  currentDriverName?: string;
};

export type VehicleImportInput = {
  plate: string;
  fleetNumber: string;
  year: number;
  type: VehicleType;
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
          currentDriverId: input.currentDriverId || deleteField(),
          currentDriverName: input.currentDriverName || deleteField(),
          ...(!input.id ? { currentKm: 0 } : {}),
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

  async importVehicles(rows: VehicleImportInput[]): Promise<number> {
    if (rows.length === 0) {
      throw new Error('A planilha nao possui veiculos validos para importar.');
    }

    try {
      let imported = 0;
      for (let start = 0; start < rows.length; start += 450) {
        const batch = writeBatch(firestore);
        for (const row of rows.slice(start, start + 450)) {
          const plate = normalizePlate(row.plate);
          const ref = doc(firestore, 'vehicles', plate);
          batch.set(
            ref,
            {
              id: plate,
              plate,
              fleetNumber: row.fleetNumber.trim(),
              year: row.year,
              type: row.type,
              status: 'active' satisfies VehicleStatus,
              model: vehicleTypeLabel(row.type),
              currentKm: 0,
            },
            { merge: true },
          );
          imported += 1;
        }
        await batch.commit();
      }
      return imported;
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao importar veiculos.');
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
    active: 'Ativo',
    inactive: 'Desativado',
  };
  return labels[status];
}
