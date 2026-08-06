import type { TripCteDocument } from '../../../shared/domain/models';

export type CteDocumentDraft = {
  key: string;
  number: string;
  existing: TripCteDocument | null;
  file: File | null;
};

export function emptyCteDraft(document?: TripCteDocument): CteDocumentDraft {
  return {
    key: document?.id || crypto.randomUUID(),
    number: document?.number ?? '',
    existing: document ?? null,
    file: null,
  };
}
