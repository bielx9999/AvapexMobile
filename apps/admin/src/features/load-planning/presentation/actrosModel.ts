import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const MODEL_URL = '/models/MercedesActros2017.fbx';
let sourcePromise: Promise<THREE.Group> | null = null;

function source() {
  sourcePromise ??= new FBXLoader().loadAsync(MODEL_URL).catch((error: unknown) => {
    sourcePromise = null;
    throw error;
  });
  return sourcePromise;
}

export async function createActrosModel(bodyWidth: number): Promise<THREE.Group> {
  const loaded = await source();
  const model = loaded.clone(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(bodyWidth) || bodyWidth <= 0 || size.x <= 0 || size.z <= 0) throw new Error('Dimensoes invalidas do modelo 3D.');

  // The FBX faces positive Z. Place its cab ahead of X=0, the cargo-floor origin.
  const scale = bodyWidth / size.x;
  const cabRearZ = bounds.max.z - size.z * .4;
  model.scale.setScalar(scale);
  model.rotation.y = -Math.PI / 2;
  model.position.set(cabRearZ * scale, -1 - bounds.min.y * scale, bodyWidth / 2 - bounds.getCenter(new THREE.Vector3()).x * scale);
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = false;
      object.receiveShadow = true;
      const part = new THREE.Box3().setFromObject(object);
      const isCab = part.getCenter(new THREE.Vector3()).x < -.35 && part.max.y > .1;
      const recolor = (material: THREE.Material) => {
        const copy = material.clone();
        if ('color' in copy && copy.color instanceof THREE.Color) copy.color.set(isCab ? '#e1e6e7' : '#69777e');
        if ('map' in copy) copy.map = null;
        if ('vertexColors' in copy) copy.vertexColors = false;
        if ('metalness' in copy) copy.metalness = .08;
        if ('emissive' in copy && copy.emissive instanceof THREE.Color) copy.emissive.set(isCab ? '#343c40' : '#151b1e');
        return copy;
      };
      object.material = Array.isArray(object.material) ? object.material.map(recolor) : recolor(object.material);
    }
  });
  return model;
}

export function disposeActrosInstance(model: THREE.Group) {
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
    }
  });
}
