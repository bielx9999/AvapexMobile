import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, storage } from '../../../core/firebase/firebaseConfig';
import type { TripCteDocument } from '../../shared/domain/models';

export const MAX_CTE_PDF_BYTES = 10 * 1024 * 1024;

export function validateCtePdf(file: File) {
  const hasPdfExtension = file.name.toLowerCase().endsWith('.pdf');
  if (file.type !== 'application/pdf' || !hasPdfExtension) {
    throw new Error('Selecione um arquivo PDF valido.');
  }
  if (file.size > MAX_CTE_PDF_BYTES) {
    throw new Error('O PDF do CT-e deve ter no maximo 10 MB.');
  }
}

export async function uploadTripCtePdf({
  documentId,
  file,
  number,
  tripId,
}: {
  documentId: string;
  file: File;
  number: string;
  tripId: string;
}): Promise<TripCteDocument> {
  validateCtePdf(file);
  const uploadedBy = auth.currentUser?.uid;
  if (!uploadedBy) {
    throw new Error('Sessao administrativa expirada. Entre novamente.');
  }

  const storagePath = `trips/${tripId}/cte/${documentId}.pdf`;
  const target = ref(storage, storagePath);
  await uploadBytes(target, file, {
    contentType: 'application/pdf',
    customMetadata: { documentId, tripId, uploadedBy },
  });

  return {
    id: documentId,
    number: number.trim(),
    series: '',
    branch: '',
    issuedAt: null,
    sender: '',
    storagePath,
    fileName: file.name,
    contentType: 'application/pdf',
    sizeBytes: file.size,
    uploadedAt: new Date(),
    uploadedBy,
  };
}

export async function deleteTripCtePdf(storagePath: string) {
  if (!storagePath) {
    return;
  }
  await deleteObject(ref(storage, storagePath));
}

export async function openTripCtePdf(storagePath: string) {
  if (!storagePath) {
    throw new Error('Este CT-e ainda nao possui PDF anexado.');
  }
  const url = await getDownloadURL(ref(storage, storagePath));
  window.open(url, '_blank', 'noopener,noreferrer');
}
