import type { QueryDocumentSnapshot, SnapshotOptions, Timestamp } from 'firebase/firestore';

export function readDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'object' && 'toDate' in value) {
    return (value as Timestamp).toDate();
  }
  if (typeof value === 'string') {
    return new Date(value);
  }
  return null;
}

export function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

export function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export type ConverterFactory<T> = (
  id: string,
  data: Record<string, unknown>,
) => T;

export function makeConverter<T>(factory: ConverterFactory<T>) {
  return {
    toFirestore(model: T): Record<string, unknown> {
      return model as Record<string, unknown>;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T {
      return factory(snapshot.id, snapshot.data(options));
    },
  };
}
