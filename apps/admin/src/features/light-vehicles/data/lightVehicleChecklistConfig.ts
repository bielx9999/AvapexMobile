export type LightChecklistTopic = { id: string; label: string; category: 'A' | 'B' | 'C' };

export const lightVehicleChecklistTopics: LightChecklistTopic[] = [
  { id: 'km_veiculo', label: 'KM do Veiculo', category: 'A' },
  { id: 'ar_condicionado', label: 'Ar condicionado ou climatizador', category: 'A' },
  { id: 'buzina', label: 'Buzina', category: 'A' },
  { id: 'cameras', label: 'Cameras (estado e funcionalidade)', category: 'A' },
  { id: 'cartao_abastecimento', label: 'Cartao de abastecimento', category: 'A' },
  { id: 'cinto_seguranca', label: 'Cinto de seguranca', category: 'A' },
  { id: 'crlv', label: 'CRLV', category: 'A' },
  { id: 'sistema_freios', label: 'Sistema de freios', category: 'A' },
  { id: 'farois_setas', label: 'Farois / Setas', category: 'A' },
  { id: 'freio_estacionamento', label: 'Freio de estacionamento', category: 'A' },
  { id: 'trancas_portas', label: 'Trancas das portas', category: 'A' },
  { id: 'painel_instrumentos', label: 'Leitura do painel de instrumentos', category: 'A' },
  { id: 'luz_interna', label: 'Luz interna do veiculo', category: 'A' },
  { id: 'marcador_combustivel', label: 'Marcador de combustivel', category: 'A' },
  { id: 'area_canetas', label: 'Parte de area / Canetas', category: 'A' },
  { id: 'vidros', label: 'Sistema para levantar os vidros (botoes e manivela)', category: 'A' },
  { id: 'agua_limpador', label: 'Agua do limpador de parabrisa', category: 'B' },
  { id: 'oleo_motor', label: 'Nivel de oleo do motor', category: 'B' },
  { id: 'liquido_arrefecimento', label: 'Nivel do liquido de arrefecimento', category: 'B' },
  { id: 'palheta_limpador', label: 'Palheta do limpador de parabrisa', category: 'B' },
  { id: 'parabrisa', label: 'Parabrisa', category: 'B' },
  { id: 'estepe', label: 'Estepe', category: 'C' },
  { id: 'identificacao_veiculo', label: 'Identificacao do veiculo', category: 'C' },
  { id: 'lavagem_mensal', label: 'Lavagem mensal - Primeira semana', category: 'C' },
  { id: 'limpeza_veiculo', label: 'Limpeza do veiculo', category: 'C' },
  { id: 'retrovisores', label: 'Retrovisores', category: 'C' },
  { id: 'triangulo_macaco', label: 'Triangulo / Macaco / Chave de roda', category: 'C' },
  { id: 'vazamentos', label: 'Vazamentos', category: 'C' },
];

export const lightChecklistCategoryLabels: Record<LightChecklistTopic['category'], string> = {
  A: 'Seguranca e funcionamento',
  B: 'Niveis e conservacao',
  C: 'Itens complementares',
};

const storageKey = 'avapex-light-vehicle-checklist-topics';

export function loadLightVehicleChecklistTopics(): LightChecklistTopic[] {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return lightVehicleChecklistTopics;
    const parsed = JSON.parse(stored) as LightChecklistTopic[];
    return Array.isArray(parsed) && parsed.length ? parsed : lightVehicleChecklistTopics;
  } catch {
    return lightVehicleChecklistTopics;
  }
}

export function saveLightVehicleChecklistTopics(topics: LightChecklistTopic[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(topics));
}
