export const inspectionSections = {
  'Documentacao geral do veiculo': ['CRLV atualizado', 'Licenciamento valido', 'Placa e identificacao legiveis'],
  'Documentos do motorista': ['CNH valida', 'Categoria compativel', 'Exame toxicologico valido'],
  Procedimentos: ['Checklist operacional realizado', 'Procedimento de embarque seguido', 'Area de circulacao respeitada'],
  EPI: ['Colete refletivo', 'Capacete', 'Calcado de seguranca', 'Oculos e luvas quando aplicavel'],
  Utilitarios: ['Extintor dentro da validade', 'Kit primeiros socorros', 'Cones e sinalizacao', 'Ferramentas basicas'],
};

export type InspectionSections = Record<string, string[]>;
export const inspectionModelStorageKey = 'avapex.security-inspection-sections';

export function loadInspectionSections(): InspectionSections {
  try {
    const saved = window.localStorage.getItem(inspectionModelStorageKey);
    if (saved) return JSON.parse(saved) as InspectionSections;
  } catch {
    // Use the standard model when local storage is unavailable or invalid.
  }
  return JSON.parse(JSON.stringify(inspectionSections)) as InspectionSections;
}
