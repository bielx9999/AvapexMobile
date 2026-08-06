import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, describe, test } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp, updateDoc } from 'firebase/firestore';

let environment;

before(async () => {
  const rules = await readFile('../../firestore.rules', 'utf8');
  environment = await initializeTestEnvironment({
    projectId: 'demo-avapex-trip-responses',
    firestore: { rules },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await Promise.all([
      setDoc(doc(firestore, 'users', 'driver-1'), {
        uid: 'driver-1',
        role: 'driver',
        status: 'active',
      }),
      setDoc(doc(firestore, 'users', 'driver-2'), {
        uid: 'driver-2',
        role: 'driver',
        status: 'active',
      }),
      setDoc(doc(firestore, 'users', 'admin-1'), {
        uid: 'admin-1',
        role: 'admin',
        status: 'active',
      }),
      setDoc(doc(firestore, 'trips', 'trip-1'), tripData()),
      setDoc(doc(firestore, 'deliveries', 'delivery-1'), deliveryData()),
    ]);
  });
});

after(async () => {
  await environment.cleanup();
});

describe('trip response permissions', { concurrency: false }, () => {
  test('assigned driver can accept without changing operational status', async () => {
    const firestore = environment.authenticatedContext('driver-1').firestore();
    await assertSucceeds(
      updateDoc(doc(firestore, 'trips', 'trip-1'), {
        driverResponse: 'accepted',
        driverRespondedAt: Timestamp.now(),
        driverResponseDriverId: 'driver-1',
        driverRejection: null,
      }),
    );
  });

  test('assigned driver can reject with a typed reason', async () => {
    const firestore = environment.authenticatedContext('driver-1').firestore();
    await assertSucceeds(
      updateDoc(doc(firestore, 'trips', 'trip-1'), {
        driverResponse: 'rejected',
        driverRespondedAt: Timestamp.now(),
        driverResponseDriverId: 'driver-1',
        driverRejection: {
          reasonCode: 'schedule_conflict',
          reasonLabel: 'Conflito de horario',
          notes: 'Outra programacao.',
        },
      }),
    );
  });

  test('driver cannot answer a trip twice', async () => {
    const firestore = environment.authenticatedContext('driver-1').firestore();
    const reference = doc(firestore, 'trips', 'trip-1');
    await assertSucceeds(
      updateDoc(reference, {
        driverResponse: 'accepted',
        driverRespondedAt: Timestamp.now(),
        driverResponseDriverId: 'driver-1',
        driverRejection: null,
      }),
    );
    await assertFails(
      updateDoc(reference, {
        driverResponse: 'rejected',
        driverRespondedAt: Timestamp.now(),
        driverResponseDriverId: 'driver-1',
        driverRejection: {
          reasonCode: 'other',
          reasonLabel: 'Outro',
          notes: 'Nova resposta indevida.',
        },
      }),
    );
  });

  test('another driver cannot respond to the assignment', async () => {
    const firestore = environment.authenticatedContext('driver-2').firestore();
    await assertFails(
      updateDoc(doc(firestore, 'trips', 'trip-1'), {
        driverResponse: 'accepted',
        driverRespondedAt: Timestamp.now(),
        driverResponseDriverId: 'driver-2',
        driverRejection: null,
      }),
    );
  });

  test('driver cannot respond after the schedule or after the trip starts', async () => {
    const response = {
      driverResponse: 'accepted',
      driverRespondedAt: Timestamp.now(),
      driverResponseDriverId: 'driver-1',
      driverRejection: null,
    };
    const referencePath = 'trips/trip-1';
    const driverContext = 'driver-1';

    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), referencePath), {
        scheduledAt: Timestamp.fromMillis(Date.now() - 60_000),
      });
    });
    await assertFails(
      updateDoc(
        doc(environment.authenticatedContext(driverContext).firestore(), referencePath),
        response,
      ),
    );

    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), referencePath), {
        scheduledAt: Timestamp.fromMillis(Date.now() + 86_400_000),
        status: 'in_progress',
      });
    });
    await assertFails(
      updateDoc(
        doc(environment.authenticatedContext(driverContext).firestore(), referencePath),
        response,
      ),
    );
  });

  test('driver cannot alter trip or delivery operational status', async () => {
    const firestore = environment.authenticatedContext('driver-1').firestore();
    await assertFails(
      updateDoc(doc(firestore, 'trips', 'trip-1'), {
        status: 'in_progress',
        programmingStatus: 'in_transit',
        operationalStatus: 'transit_to_loading',
      }),
    );
    await assertFails(
      updateDoc(doc(firestore, 'deliveries', 'delivery-1'), {
        status: 'delivered',
        deliveredAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        updatedBy: 'driver-1',
      }),
    );
  });

  test('driver GPS and proof submission remain allowed', async () => {
    const firestore = environment.authenticatedContext('driver-1').firestore();
    await assertSucceeds(
      updateDoc(doc(firestore, 'trips', 'trip-1'), {
        gpsLocation: { latitude: -23.4, longitude: -46.5 },
        lastGpsUpdateAt: Timestamp.now(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(firestore, 'deliveries', 'delivery-1'), {
        proofStatus: 'submitted',
        deliveryProofId: 'receipt-1',
        updatedAt: Timestamp.now(),
        updatedBy: 'driver-1',
      }),
    );
  });

  test('administrator can continue changing the operational status', async () => {
    const firestore = environment.authenticatedContext('admin-1').firestore();
    await assertSucceeds(
      updateDoc(doc(firestore, 'trips', 'trip-1'), {
        status: 'in_progress',
        programmingStatus: 'in_transit',
        operationalStatus: 'transit_to_loading',
      }),
    );
  });
});

function tripData() {
  return {
    id: 'trip-1',
    driverId: 'driver-1',
    vehicleId: 'vehicle-1',
    origin: 'Guarulhos - SP',
    destination: 'Santos - SP',
    status: 'pending',
    scheduledAt: Timestamp.fromMillis(Date.now() + 86_400_000),
    startedAt: null,
    completedAt: null,
    deliveryDocs: [],
    programmingStatus: 'loading',
    operationalStatus: 'waiting_loading',
    operationType: 'loading',
    driverResponse: 'pending',
    driverRespondedAt: null,
    driverResponseDriverId: '',
    driverRejection: null,
  };
}

function deliveryData() {
  return {
    id: 'delivery-1',
    routeId: '',
    orderNumber: 'ORDER-1',
    clientName: 'Cliente Teste',
    driverId: 'driver-1',
    driverName: 'Motorista Teste',
    vehicleId: 'vehicle-1',
    vehiclePlate: 'ABC1D23',
    sequence: 1,
    status: 'arrived',
    address: {
      formattedAddress: 'Santos - SP',
      latitude: -23.9,
      longitude: -46.3,
    },
    scheduledAt: Timestamp.now(),
    proofRequirements: {
      requirePhoto: true,
      requireReceiverName: true,
      requireReceiverDocument: true,
      requireSignature: false,
      requireLocation: true,
    },
    proofStatus: 'pending',
    deliveryProofId: '',
    createdAt: Timestamp.now(),
    createdBy: 'admin-1',
    updatedAt: Timestamp.now(),
    updatedBy: 'admin-1',
  };
}
