import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, describe, test } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, Timestamp, updateDoc } from 'firebase/firestore';

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
      setDoc(doc(firestore, 'loginIdentifiers', '39053344705'), {
        uid: 'driver-1',
        email: 'driver@example.com',
        cpf: '39053344705',
        kind: 'cpf',
        updatedAt: Timestamp.now(),
      }),
      setDoc(doc(firestore, 'trips', 'trip-1'), tripData()),
      setDoc(doc(firestore, 'deliveries', 'delivery-1'), deliveryData()),
    ]);
  });
});

after(async () => {
  await environment.cleanup();
});

describe('CPF login identifier permissions', { concurrency: false }, () => {
  test('unauthenticated login can resolve one CPF identifier', async () => {
    const firestore = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(firestore, 'loginIdentifiers', '39053344705')));
  });

  test('login identifiers cannot be listed by unauthenticated users', async () => {
    const firestore = environment.unauthenticatedContext().firestore();
    await assertFails(getDocs(collection(firestore, 'loginIdentifiers')));
  });

  test('administrator can create a CPF login identifier', async () => {
    const firestore = environment.authenticatedContext('admin-1').firestore();
    await assertSucceeds(
      setDoc(doc(firestore, 'loginIdentifiers', '52998224725'), {
        uid: 'driver-2',
        email: 'driver2@example.com',
        cpf: '52998224725',
        kind: 'cpf',
        updatedAt: Timestamp.now(),
      }),
    );
  });
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

  test('assigned driver can respond after schedule while trip is still pending', async () => {
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
    await assertSucceeds(
      updateDoc(
        doc(environment.authenticatedContext(driverContext).firestore(), referencePath),
        response,
      ),
    );
  });

  test('assigned driver can respond after the trip starts if still unanswered', async () => {
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
        status: 'in_progress',
      });
    });
    await assertSucceeds(
      updateDoc(
        doc(environment.authenticatedContext(driverContext).firestore(), referencePath),
        response,
      ),
    );
  });

  test('driver can advance and complete an accepted trip with proof', async () => {
    const firestore = environment.authenticatedContext('driver-1').firestore();
    const reference = doc(firestore, 'trips', 'trip-1');

    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'trips/trip-1'), {
        driverResponse: 'accepted',
      });
    });

    await assertSucceeds(
      updateDoc(reference, {
        status: 'in_progress',
        programmingStatus: 'loading',
        operationalStatus: 'loading',
        statusUpdatedAt: Timestamp.now(),
        startedAt: Timestamp.now(),
      }),
    );

    await assertSucceeds(
      updateDoc(reference, {
        status: 'completed',
        programmingStatus: 'released',
        operationalStatus: 'released_loading',
        statusUpdatedAt: Timestamp.now(),
        completedAt: Timestamp.now(),
        proofPhotoUrls: ['https://example.test/proof.jpg'],
        pendingProofPhotoLocalPaths: [],
        proofSubmittedAt: Timestamp.now(),
        proofSubmittedBy: 'driver-1',
      }),
    );
  });

  test('driver cannot complete an accepted trip without proof', async () => {
    const firestore = environment.authenticatedContext('driver-1').firestore();
    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'trips/trip-1'), {
        driverResponse: 'accepted',
      });
    });

    await assertFails(
      updateDoc(doc(firestore, 'trips', 'trip-1'), {
        status: 'completed',
        programmingStatus: 'released',
        operationalStatus: 'released_loading',
        statusUpdatedAt: Timestamp.now(),
        completedAt: Timestamp.now(),
        proofPhotoUrls: [],
        pendingProofPhotoLocalPaths: [],
        proofSubmittedAt: Timestamp.now(),
        proofSubmittedBy: 'driver-1',
      }),
    );
  });

  test('driver can attach queued proof upload after completing trip', async () => {
    const firestore = environment.authenticatedContext('driver-1').firestore();
    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'trips/trip-1'), {
        status: 'completed',
        programmingStatus: 'released',
        operationalStatus: 'released_loading',
        completedAt: Timestamp.now(),
        driverResponse: 'accepted',
        proofPhotoUrls: [],
        pendingProofPhotoLocalPaths: ['C:/tmp/proof.jpg'],
        proofSubmittedAt: Timestamp.now(),
        proofSubmittedBy: 'driver-1',
      });
    });

    await assertSucceeds(
      updateDoc(doc(firestore, 'trips', 'trip-1'), {
        proofPhotoUrls: ['https://example.test/proof.jpg'],
        pendingProofPhotoLocalPaths: [],
      }),
    );
  });

  test('driver cannot alter trip assignment or delivery operational status', async () => {
    const firestore = environment.authenticatedContext('driver-1').firestore();
    await assertFails(
      updateDoc(doc(firestore, 'trips', 'trip-1'), {
        status: 'in_progress',
        programmingStatus: 'in_transit',
        operationalStatus: 'transit_to_loading',
        driverId: 'driver-2',
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

describe('locality and route catalog permissions', { concurrency: false }, () => {
  test('administrator can create localities and immutable route versions', async () => {
    const firestore = environment.authenticatedContext('admin-1').firestore();
    await assertSucceeds(setDoc(doc(firestore, 'localities', 'location-1'), localityData()));
    await assertSucceeds(setDoc(doc(firestore, 'routeVersions', 'version-1'), routeVersionData()));
    await assertSucceeds(setDoc(doc(firestore, 'routeTemplates', 'route-template-1'), routeTemplateData()));
    await assertFails(updateDoc(doc(firestore, 'routeVersions', 'version-1'), { distanceMeters: 123 }));
  });

  test('driver cannot read or write the administrative route catalog', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, 'localities', 'location-1'), localityData());
      await setDoc(doc(firestore, 'routeVersions', 'version-1'), routeVersionData());
      await setDoc(doc(firestore, 'routeTemplates', 'route-template-1'), routeTemplateData());
    });
    const firestore = environment.authenticatedContext('driver-1').firestore();
    await assertFails(getDoc(doc(firestore, 'localities', 'location-1')));
    await assertFails(getDoc(doc(firestore, 'routeTemplates', 'route-template-1')));
    await assertFails(getDoc(doc(firestore, 'routeVersions', 'version-1')));
    await assertFails(setDoc(doc(firestore, 'localities', 'location-2'), localityData('location-2')));
  });

  test('driver reads the saved route snapshot only through the assigned trip', async () => {
    const firestore = environment.authenticatedContext('driver-1').firestore();
    const snapshot = await assertSucceeds(getDoc(doc(firestore, 'trips', 'trip-1')));
    if (snapshot.data()?.routeSnapshot?.routeVersionId !== 'version-1') {
      throw new Error('Trip route snapshot was not preserved.');
    }
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
    routeTemplateId: 'route-template-1',
    routeVersionId: 'version-1',
    routeSnapshot: {
      routeTemplateId: 'route-template-1',
      routeVersionId: 'version-1',
      name: 'Guarulhos - Santos',
      ...routeDefinition(),
    },
  };
}

function localityData(id = 'location-1') {
  return {
    id,
    reference: 'Matriz',
    normalizedReference: 'MATRIZ',
    city: 'Guarulhos',
    normalizedCity: 'GUARULHOS',
    uf: 'SP',
    address: 'Guarulhos - SP',
    normalizedAddress: 'GUARULHOS SP',
    latitude: -23.45,
    longitude: -46.53,
    originalCoordinates: '-23.45, -46.53',
    status: 'active',
    needsReview: false,
    source: 'manual',
    sourceRow: null,
    fingerprint: `MATRIZ|GUARULHOS|SP|${id}`,
    createdAt: Timestamp.now(),
    createdBy: 'admin-1',
    updatedAt: Timestamp.now(),
    updatedBy: 'admin-1',
  };
}

function routeDefinition() {
  return {
    version: 1,
    points: [
      { id: 'point-1', type: 'origin', sequence: 0, locationId: 'location-1', reference: 'Matriz', city: 'Guarulhos', uf: 'SP', address: 'Guarulhos - SP', latitude: -23.45, longitude: -46.53 },
      { id: 'point-2', type: 'destination', sequence: 1, locationId: 'location-2', reference: 'Porto', city: 'Santos', uf: 'SP', address: 'Santos - SP', latitude: -23.96, longitude: -46.33 },
    ],
    locationIds: ['location-1', 'location-2'],
    distanceMeters: 100000,
    durationSeconds: 7200,
    encodedPolyline: 'encoded-route',
    path: [
      { latitude: -23.45, longitude: -46.53 },
      { latitude: -23.96, longitude: -46.33 },
    ],
  };
}

function routeVersionData() {
  return {
    id: 'version-1',
    routeTemplateId: 'route-template-1',
    ...routeDefinition(),
    createdAt: Timestamp.now(),
    createdBy: 'admin-1',
  };
}

function routeTemplateData() {
  return {
    id: 'route-template-1',
    name: 'Guarulhos - Santos',
    normalizedName: 'GUARULHOS SANTOS',
    description: '',
    notes: '',
    status: 'active',
    currentVersionId: 'version-1',
    currentVersion: routeDefinition(),
    usedCount: 0,
    createdAt: Timestamp.now(),
    createdBy: 'admin-1',
    updatedAt: Timestamp.now(),
    updatedBy: 'admin-1',
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
