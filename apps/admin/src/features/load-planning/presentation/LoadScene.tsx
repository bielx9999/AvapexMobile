import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { LoadItem, LoadVehicle, Vec3 } from '../domain/models';
import { dimensions } from '../domain/engine';
import { createActrosModel, disposeActrosInstance } from './actrosModel';

type Props = { vehicle: LoadVehicle; items: LoadItem[]; selectedId: string; view: 'perspective' | 'top' | 'side' | 'rear'; grid: number; onSelect: (id: string) => void; onMove: (id: string, position: Vec3) => void };

export function LoadScene({ vehicle, items, selectedId, view, grid, onSelect, onMove }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onSelect, onMove });
  const cameraState = useRef<{ key: string; view: Props['view']; position: [number, number, number] } | null>(null);
  useEffect(() => { callbacks.current = { onSelect, onMove }; }, [onSelect, onMove]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f5f7f8');
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
    const cameraKey = `${vehicle.id}:${vehicle.length}:${vehicle.width}:${vehicle.height}`;
    const cabLength = vehicle.kind === 'truck' ? vehicle.width * 1.35 : 0;
    const center = new THREE.Vector3((vehicle.length - cabLength) / 2, 0, vehicle.width / 2);
    const distance = Math.max(vehicle.length + cabLength, vehicle.width * 2, 5) * 1.15;
    if (view === 'top') camera.position.set(center.x, distance, center.z);
    else if (view === 'side') camera.position.set(center.x, Math.max(vehicle.height, 2) * .8, distance);
    else if (view === 'rear') camera.position.set(-distance * .35, Math.max(vehicle.height, 2), center.z);
    else camera.position.set(center.x + distance * .85, Math.max(vehicle.height, 2) * 1.7, center.z + distance * .72);
    if (cameraState.current?.key === cameraKey && cameraState.current.view === view) camera.position.set(...cameraState.current.position);
    camera.lookAt(center);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    element.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight('#ffffff', '#b5bec4', 2));
    const sun = new THREE.DirectionalLight('#ffffff', 2);
    sun.position.set(vehicle.length, 12, 8);
    sun.castShadow = true;
    scene.add(sun);
    const objects: THREE.Object3D[] = [];
    const addBox = (size: [number, number, number], position: [number, number, number], color: string, opacity = 1) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color, transparent: opacity < 1, opacity, roughness: .75 }));
      mesh.position.set(...position); mesh.receiveShadow = true; mesh.castShadow = opacity === 1; scene.add(mesh); objects.push(mesh); return mesh;
    };
    addBox([vehicle.length, .08, vehicle.width], [vehicle.length / 2, -.07, vehicle.width / 2], '#849197');
    addBox([vehicle.length, .28, .08], [vehicle.length / 2, -.16, 0], '#6b7378');
    addBox([vehicle.length, .28, .08], [vehicle.length / 2, -.16, vehicle.width], '#6b7378');
    for (const z of [0, vehicle.width]) addBox([vehicle.length, Math.min(vehicle.height, .9), .035], [vehicle.length / 2, Math.min(vehicle.height, .9) / 2, z], '#b4bec2', .18);
    const cargoOutline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(vehicle.length, vehicle.height, vehicle.width)), new THREE.LineBasicMaterial({ color: '#d4a80b', transparent: true, opacity: .65 }));
    cargoOutline.position.set(vehicle.length / 2, vehicle.height / 2, vehicle.width / 2);
    scene.add(cargoOutline); objects.push(cargoOutline);
    const fallbackParts: THREE.Object3D[] = [];
    for (const group of vehicle.axleGroups) {
      for (const z of [-.22, vehicle.width + .22]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .16, 18), new THREE.MeshStandardMaterial({ color: '#24292e' }));
        wheel.rotation.x = Math.PI / 2; wheel.position.set(group.x, -.42, z); scene.add(wheel); objects.push(wheel);
        if (group.x < vehicle.length * .5) fallbackParts.push(wheel);
      }
    }
    if (vehicle.kind === 'truck' || vehicle.kind === 'tractor') fallbackParts.push(addBox([Math.min(1.3, vehicle.length / 4), 1.4, vehicle.width], [-Math.min(1.3, vehicle.length / 4) / 2 - .14, .65, vehicle.width / 2], vehicle.kind === 'truck' ? '#b8c4c9' : '#f4c51a'));
    let actros: THREE.Group | null = null;
    let active = true;
    if (vehicle.kind === 'truck') void createActrosModel(vehicle.width).then((model) => {
      if (!active) { disposeActrosInstance(model); return; }
      actros = model;
      fallbackParts.forEach((part) => { scene.remove(part); objects.splice(objects.indexOf(part), 1); if (part instanceof THREE.Mesh) { part.geometry.dispose(); (part.material as THREE.Material).dispose(); } });
      scene.add(model);
    }).catch((error) => { console.warn('Modelo Actros indisponivel; exibindo geometria simplificada.', error); });
    const gridHelper = new THREE.GridHelper(Math.max(vehicle.length, vehicle.width) + 2, Math.max(4, Math.ceil((Math.max(vehicle.length, vehicle.width) + 2) / grid)), '#a9b4bb', '#dce3e7');
    gridHelper.position.set(center.x, -.78, center.z); scene.add(gridHelper);
    for (const item of items) {
      if (!item.position) continue;
      const size = dimensions(item.cargo, item.rotation);
      const geometry = item.cargo.shape === 'cylinder' ? new THREE.CylinderGeometry(size.z / 2, size.z / 2, size.x, 24) : new THREE.BoxGeometry(size.x, size.z, size.y);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: item.cargo.color, roughness: .55 }));
      if (item.cargo.shape === 'cylinder') {
        if (item.rotation === 90) mesh.rotation.x = Math.PI / 2;
        else mesh.rotation.z = Math.PI / 2;
      }
      mesh.position.set(item.position.x + size.x / 2, item.position.z + size.z / 2, item.position.y + size.y / 2);
      mesh.userData.itemId = item.id;
      mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); objects.push(mesh);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.z, size.y)), new THREE.LineBasicMaterial({ color: selectedId === item.id ? '#ffcf21' : '#283238', linewidth: 2 }));
      edges.position.copy(mesh.position); scene.add(edges); objects.push(edges);
      if (selectedId === item.id) {
        const outline = new THREE.BoxHelper(mesh, '#e09b00'); scene.add(outline); objects.push(outline);
      }
    }
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let dragging = '';
    let pendingMove: { id: string; position: Vec3 } | null = null;
    let orbiting = false;
    let last = { x: 0, y: 0 };
    let azimuth = Math.atan2(camera.position.z - center.z, camera.position.x - center.x);
    let elevation = Math.atan2(camera.position.y - center.y, Math.hypot(camera.position.x - center.x, camera.position.z - center.z));
    let radius = camera.position.distanceTo(center);
    const positionPointer = (event: PointerEvent) => { const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera); };
    const onDown = (event: PointerEvent) => {
      positionPointer(event);
      const hit = raycaster.intersectObjects(objects, false).find((candidate) => candidate.object.userData.itemId);
      if (hit) dragging = hit.object.userData.itemId as string; else orbiting = true;
      last = { x: event.clientX, y: event.clientY };
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onMovePointer = (event: PointerEvent) => {
      if (!dragging && !orbiting) return;
      if (dragging) {
        const item = items.find((candidate) => candidate.id === dragging);
        if (item?.position) {
          positionPointer(event);
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(item.position.z + dimensions(item.cargo, item.rotation).z / 2));
          const point = new THREE.Vector3();
          if (raycaster.ray.intersectPlane(plane, point)) {
            const size = dimensions(item.cargo, item.rotation);
            const snap = (value: number) => Math.round(value / grid) * grid;
            const position = { x: Math.max(0, snap(point.x - size.x / 2)), y: Math.max(0, snap(point.z - size.y / 2)), z: item.position.z };
            pendingMove = { id: dragging, position };
            const mesh = objects.find((object) => object.userData.itemId === dragging);
            mesh?.position.set(position.x + size.x / 2, position.z + size.z / 2, position.y + size.y / 2);
          }
        }
      } else if (view === 'perspective') {
        azimuth += (event.clientX - last.x) * .006; elevation = Math.max(.12, Math.min(1.45, elevation + (event.clientY - last.y) * .006));
        camera.position.set(center.x + radius * Math.cos(elevation) * Math.cos(azimuth), center.y + radius * Math.sin(elevation), center.z + radius * Math.cos(elevation) * Math.sin(azimuth)); camera.lookAt(center);
        cameraState.current = { key: cameraKey, view, position: camera.position.toArray() as [number, number, number] };
      }
      last = { x: event.clientX, y: event.clientY };
    };
    const onUp = () => { if (dragging) callbacks.current.onSelect(dragging); if (pendingMove) callbacks.current.onMove(pendingMove.id, pendingMove.position); pendingMove = null; dragging = ''; orbiting = false; };
    const onWheel = (event: WheelEvent) => { event.preventDefault(); radius = Math.max(2, Math.min(100, radius * (event.deltaY > 0 ? 1.1 : .9))); camera.position.sub(center).setLength(radius).add(center); camera.lookAt(center); cameraState.current = { key: cameraKey, view, position: camera.position.toArray() as [number, number, number] }; };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointermove', onMovePointer);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    const observer = new ResizeObserver(() => { const width = element.clientWidth; const height = element.clientHeight; if (!width || !height) return; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.render(scene, camera); });
    observer.observe(element);
    let frame = 0;
    const render = () => { renderer.render(scene, camera); frame = requestAnimationFrame(render); };
    render();
    return () => { active = false; cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointermove', onMovePointer); renderer.domElement.removeEventListener('wheel', onWheel); renderer.domElement.removeEventListener('pointerup', onUp); if (actros) disposeActrosInstance(actros); objects.forEach((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); } else if (object instanceof THREE.LineSegments) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); } }); renderer.dispose(); element.removeChild(renderer.domElement); };
  }, [vehicle, items, selectedId, view, grid]);
  return <div aria-label="Simulador tridimensional do carregamento" className="h-full min-h-[360px] w-full touch-none" ref={host} />;
}
