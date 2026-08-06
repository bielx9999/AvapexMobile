import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, describe, test } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { getBytes, ref, uploadBytes } from 'firebase/storage';

let environment;
const documentPath = 'trips/trip-1/cte/cte-123.pdf';

before(async () => {
  const [firestoreRules, storageRules] = await Promise.all([
    readFile('../../firestore.rules', 'utf8'),
    readFile('../../storage.rules', 'utf8'),
  ]);
  environment = await initializeTestEnvironment({
    projectId: 'demo-avapex-trip-documents',
    firestore: { rules: firestoreRules },
    storage: { rules: storageRules },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.clearStorage();
  await environment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await Promise.all([
      setDoc(doc(firestore, 'users', 'admin-1'), {
        uid: 'admin-1', role: 'admin', status: 'active',
      }),
      setDoc(doc(firestore, 'users', 'driver-1'), {
        uid: 'driver-1', role: 'driver', status: 'active',
      }),
      setDoc(doc(firestore, 'users', 'driver-2'), {
        uid: 'driver-2', role: 'driver', status: 'active',
      }),
      setDoc(doc(firestore, 'trips', 'trip-1'), {
        id: 'trip-1',
        driverId: 'driver-1',
        vehicleId: 'vehicle-1',
        origin: 'Guarulhos - SP',
        destination: 'Santos - SP',
        status: 'pending',
        scheduledAt: Timestamp.fromMillis(Date.now() + 86_400_000),
      }),
    ]);
  });
});

after(async () => {
  await environment.cleanup();
});

describe('CT-e PDF permissions', { concurrency: false }, () => {
  test('admin uploads and only the assigned driver can read', async () => {
    const adminStorage = environment.authenticatedContext('admin-1').storage();
    await assertSucceeds(uploadBytes(
      ref(adminStorage, documentPath),
      new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      { contentType: 'application/pdf' },
    ));

    const assignedStorage = environment.authenticatedContext('driver-1').storage();
    await assertSucceeds(getBytes(ref(assignedStorage, documentPath), 1024));

    const otherDriverStorage = environment.authenticatedContext('driver-2').storage();
    await assertFails(getBytes(ref(otherDriverStorage, documentPath), 1024));
  });

  test('driver cannot upload or replace a trip document', async () => {
    const driverStorage = environment.authenticatedContext('driver-1').storage();
    await assertFails(uploadBytes(
      ref(driverStorage, documentPath),
      new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      { contentType: 'application/pdf' },
    ));
  });

  test('admin cannot upload a non-PDF file in the CT-e path', async () => {
    const adminStorage = environment.authenticatedContext('admin-1').storage();
    await assertFails(uploadBytes(
      ref(adminStorage, documentPath),
      new Uint8Array([1, 2, 3]),
      { contentType: 'image/png' },
    ));
  });
});
