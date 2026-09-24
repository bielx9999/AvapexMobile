import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeLoad, validateCargo } from '../src/features/load-planning/domain/engine.ts';
import { snapshotPlan } from '../src/features/load-planning/domain/snapshot.ts';

const vehicle = { id: 'v', name: 'Truck teste', kind: 'truck', length: 10, width: 2.5, height: 3, tareKg: 5000, capacityKg: 10000, grossLimitKg: 16000, axleGroups: [{ id: 'front', label: 'Dianteiro', x: 1, maxKg: 6000, emptyKg: null }, { id: 'rear', label: 'Traseiro', x: 9, maxKg: 11000, emptyKg: null }] };
const cargo = { id: 'c', code: 'C1', description: 'Caixa', shape: 'box', weightKg: 1000, length: 2, width: 1, height: 1, diameter: null, canRotate: true, canStack: false, maxLayers: 1, maxTopWeightKg: null };
const item = (id, x, y = 0, z = 0) => ({ id, cargoId: 'c', cargo, rotation: 0, position: { x, y, z } });

test('peso bruto e centro de gravidade usam massas cadastradas', () => {
  const result = analyzeLoad(vehicle, [item('a', 0), item('b', 6)]);
  assert.equal(result.cargoKg, 2000);
  assert.equal(result.tareKg, 5000);
  assert.equal(result.grossKg, 7000);
  assert.equal(result.center.x, 4);
  assert.equal(result.occupiedVolumeM3, 4);
});

test('reacoes conservam forca e momento e mudam com a posicao', () => {
  const front = analyzeLoad(vehicle, [item('a', 0)]);
  const rear = analyzeLoad(vehicle, [item('a', 7)]);
  assert.equal(front.reactions.reduce((sum, reaction) => sum + reaction.loadKg, 0), 6000);
  assert.equal(rear.reactions.reduce((sum, reaction) => sum + reaction.loadKg, 0), 6000);
  assert.ok(front.reactions[0].loadKg > rear.reactions[0].loadKg);
  const moment = rear.reactions[1].loadKg * (9 - 1);
  assert.equal(moment, 5000 * (5 - 1) + 1000 * (8 - 1));
});

test('usa pesos vazios cadastrados quando somam a tara', () => {
  const configured = { ...vehicle, axleGroups: [{ ...vehicle.axleGroups[0], emptyKg: 2000 }, { ...vehicle.axleGroups[1], emptyKg: 3000 }] };
  const result = analyzeLoad(configured, []);
  assert.deepEqual(result.reactions.map((reaction) => reaction.loadKg), [2000, 3000]);
});

test('detecta limite, colisao, flutuacao e empilhamento proibido', () => {
  assert.ok(analyzeLoad(vehicle, [item('a', 9)]).issues.some((issue) => issue.code === 'outside'));
  assert.ok(analyzeLoad(vehicle, [item('a', 0), item('b', 1)]).issues.some((issue) => issue.code === 'collision'));
  assert.ok(analyzeLoad(vehicle, [item('a', 0, 0, 1)]).issues.some((issue) => issue.code === 'floating'));
  assert.ok(analyzeLoad(vehicle, [item('a', 0), item('b', 0, 0, 1)]).issues.some((issue) => issue.code === 'stacking'));
  assert.equal(validateCargo({ ...cargo, weightKg: 0 }).length, 1);
});

test('apoios insuficientes nao produzem distribuicao inventada', () => {
  const result = analyzeLoad({ ...vehicle, axleGroups: [vehicle.axleGroups[0]] }, [item('a', 0)]);
  assert.equal(result.reactions, null);
  assert.ok(result.reactionUnavailable.length);
});

test('conjunto articulado transfere forca pelo pino-rei', () => {
  const trailer = { ...vehicle, kind: 'carreta', tareKg: 4000, kingpinX: 1, axleGroups: [{ id: 'rear', label: 'Grupo traseiro', x: 9, maxKg: null, emptyKg: null }] };
  const tractor = { ...vehicle, kind: 'tractor', length: 5, tareKg: 6000, fifthWheelX: 3, axleGroups: [{ id: 'f', label: 'Frente', x: 1, maxKg: null, emptyKg: null }, { id: 'r', label: 'Tras', x: 4, maxKg: null, emptyKg: null }] };
  const result = analyzeLoad(trailer, [item('a', 6)], tractor);
  assert.equal(result.reactions.reduce((sum, reaction) => sum + reaction.loadKg, 0), result.grossKg);
});

test('snapshot preserva posicoes e dados historicos do catalogo', () => {
  const original = { id: 'plan-1', name: 'Teste', vehicleId: 'v', vehicle, tractor: null, items: [item('a', 3, .5, 0)], notes: '', authorId: 'admin', modelVersion: 1, revision: 1, createdAt: null, updatedAt: null };
  const stored = structuredClone(snapshotPlan(original));
  cargo.weightKg = 1200;
  assert.equal(stored.items[0].cargo.weightKg, 1000);
  assert.deepEqual(stored.items[0].position, { x: 3, y: .5, z: 0 });
  cargo.weightKg = 1000;
});
