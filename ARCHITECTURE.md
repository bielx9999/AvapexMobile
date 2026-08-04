# ARCHITECTURE.md — Sistema de Gestão Logística

## 1. Visão Geral
Sistema logístico integrado para otimização de processos operacionais e administrativos. O sistema é dividido em duas interfaces que consomem o mesmo backend Firebase:
* **Mobile App (Motoristas):** Focado em agilidade, usabilidade em campo e funcionamento Offline-First (checklists, registro de avarias, atualização de status de viagens).
* **Web Dashboard (Administrativo):** Focado em controle em tempo real, auditoria, despacho de cargas, gestão de frota e relatórios de conformidade.

## 2. Stack Tecnológica
* **Backend & Infraestrutura:** Google Firebase (Authentication, Cloud Firestore, Cloud Storage, Firebase Hosting / App Distribution).
* **Frontend Mobile (Motorista):** Flutter (com State Management via Riverpod/Bloc) — Priorizando persistência offline nativa.
* **Frontend Web (Admin):** React (Next.js ou Vite) com Tailwind CSS.
* **SDKs Firebase:** Uso exclusivo das SDKs modulares mais recentes (v9+ no Web, pacote `cloud_firestore` mais recente no Flutter).

## 3. Modelo de Dados (Cloud Firestore Schema)
O banco NoSQL deve ser estruturado para minimizar leituras e evitar consultas complexas que falhem offline.

### Coleção: `users`
* `uid` (string, PK - ID do Firebase Auth)
* `name` (string)
* `email` (string)
* `phone` (string)
* `role` (string: "driver" | "admin")
* `cnh` (map: `{ number, category, expirationDate }` — obrigatório se role == "driver")
* `status` (string: "active" | "inactive")
* `createdAt` (timestamp)

### Coleção: `vehicles`
* `id` (string, PK - Placa ou ID interno)
* `plate` (string)
* `model` (string)
* `currentKm` (number)
* `status` (string: "available" | "in_transit" | "maintenance")
* `lastChecklistId` (string, FK opcional)

### Coleção: `trips`
* `id` (string, PK)
* `driverId` (string, FK -> users)
* `vehicleId` (string, FK -> vehicles)
* `origin` (string)
* `destination` (string)
* `status` (string: "pending" | "in_progress" | "completed" | "cancelled")
* `scheduledAt` (timestamp)
* `startedAt` (timestamp, null)
* `completedAt` (timestamp, null)
* `deliveryDocs` (array de strings - URLs das fotos de canhotos/NF no Storage)
* `programmingStatus` (string: "loading" | "in_transit" | "unloading" | "awaiting_invoice" | "released")
* `operationalStatus` (string, etapa detalhada registrada pelo motorista)
* `operationType` (string: "loading" | "unloading")
* `statusUpdatedAt` (timestamp, null - ultima atualizacao da etapa)
* `gpsLocation` (map: `{ latitude, longitude, accuracy, display }`, opcional)
* `lastGpsUpdateAt` (timestamp, null - heartbeat usado para calcular GPS online/offline)

### Coleção: `checklists`
* `id` (string, PK)
* `tripId` (string, FK -> trips)
* `driverId` (string, FK -> users)
* `vehicleId` (string, FK -> vehicles)
* `type` (string: "departure" | "arrival")
* `kmRegistered` (number)
* `items` (map: `{ tires: boolean, brakes: boolean, lights: boolean, oil: boolean, notes: string }`)
* `photoUrls` (array de strings - URLs no Cloud Storage para avarias ou documentação)
* `signatureUrl` (string - URL da imagem da assinatura na tela)
* `createdAt` (timestamp)

### Coleção: `incidents`
* `id` (string, PK)
* `tripId` (string, FK -> trips)
* `driverId` (string, FK -> users)
* `type` (string: "mechanical" | "tire" | "accident" | "delay" | "expense")
* `description` (string)
* `cost` (number, opcional)
* `photoUrl` (string, opcional)
* `status` (string: "reported" | "under_review" | "resolved")
* `createdAt` (timestamp)

## 4. Regras de Arquitetura e Integração com Firebase
1. **Offline-First no Mobile:** O cache offline do Firestore (`PersistenceEnabled`) deve ser inicializado antes de qualquer chamada de rede. Nenhuma tela do app mobile pode bloquear o usuário por falta de conexão à internet.
2. **Upload de Mídias (Storage):** Fotos de checklist e canhotos devem ser comprimidas no client-side antes do upload para economizar dados móveis. O app deve salvar o caminho local provisoriamente se estiver offline e realizar o upload para o Cloud Storage em segundo plano quando a conexão for reestabelecida.
3. **Segurança de Acesso:** Motoristas só podem ler e escrever dados onde `driverId == auth.uid`. O setor administrativo tem acesso de leitura/escrita global em todas as coleções.
4. **Separação de Responsabilidades:** Nunca misture lógica de UI com chamadas diretas do Firebase. Utilize uma camada de Serviços/Repositórios para abstrair as operações do Firestore e do Auth.

## 5. Schema Operacional V2

O schema V2 separa planejamento, entregas e auditoria. A coleção `trips` permanece ativa durante a migração e não deve ser removida até que as telas existentes passem a consumir `routes` e `deliveries`.

### Coleção: `routes`
* `id` (string, PK)
* `code` (string, identificador visível)
* `serviceDate` (timestamp)
* `status` (string: `draft` | `planned` | `assigned` | `in_progress` | `completed` | `cancelled`)
* `driverId`, `driverName` (string, ID e snapshot)
* `vehicleId`, `vehiclePlate` (string, ID e snapshot)
* `fleetId` (string)
* `carrierId`, `carrierName` (string, ID e snapshot)
* `operationTypeId`, `operationTypeName` (string, ID e snapshot)
* `regionIds` (array de string)
* `startAddress`, `endAddress` (map: `{ formattedAddress, latitude, longitude, placeId, city, state, postalCode }`)
* `deliveryCount`, `completedDeliveryCount` (number)
* `plannedDistanceMeters`, `plannedDurationSeconds`, `plannedCost` (number)
* `actualDistanceMeters`, `actualDurationSeconds`, `actualCost` (number)
* `optimization` (map: `{ status, provider, requestId, optimizedAt, errorMessage }`)
* `currentLocation` (map GeoLocation, opcional)
* `startedAt`, `completedAt`, `createdAt`, `updatedAt` (timestamp, nullable conforme etapa)
* `createdBy`, `updatedBy` (string)

### Coleção: `deliveries`
* `id` (string, PK)
* `routeId` (string, FK -> routes; vazio enquanto não roteirizada)
* `orderNumber`, `cteAccessKey`, `cteNumber` (string)
* `clientId`, `clientName` (string, ID e snapshot)
* `carrierId`, `carrierName` (string, ID e snapshot)
* `regionId`, `regionName` (string, ID e snapshot)
* `driverId`, `driverName`, `vehicleId`, `vehiclePlate` (string, dados denormalizados para leitura offline)
* `sequence` (number, ordem da parada)
* `status` (string: `pending` | `in_route` | `arrived` | `delivered` | `not_delivered` | `cancelled`)
* `address` (map AddressSnapshot)
* `scheduledAt`, `timeWindowStart`, `timeWindowEnd`, `estimatedArrivalAt` (timestamp)
* `arrivedAt`, `deliveredAt` (timestamp, nullable)
* `packageCount`, `weightKg`, `volumeM3` (number)
* `notes` (string)
* `proofRequirements` (map: `{ requirePhoto, requireReceiverName, requireReceiverDocument, requireSignature, requireLocation }`)
* `proofStatus` (string: `pending` | `submitted` | `approved` | `rejected`)
* `deliveryProofId` (string, FK -> deliveryReceipts)
* `checkInLocation` (map GeoLocation, opcional)
* `failure` (map: `{ reasonCode, reasonLabel, notes, registeredAt }`, opcional)
* `createdAt`, `updatedAt` (timestamp)
* `createdBy`, `updatedBy` (string)

### Coleção: `routeEvents`
Coleção append-only usada para auditoria e sincronização offline.
* `id` (string, PK gerada no client para suportar offline)
* `routeId`, `deliveryId`, `driverId`, `vehicleId` (string)
* `type` (string: eventos de rota, check-in, entrega, falha, cancelamento, mudança de status ou observação)
* `source` (string: `admin` | `driver` | `system`)
* `actorId`, `actorName` (string)
* `fromStatus`, `toStatus`, `message` (string)
* `metadata` (map)
* `location` (map GeoLocation, opcional)
* `occurredAt` (timestamp do dispositivo)
* `createdAt` (timestamp do servidor)

### Coleção: `settings`
Documentos fixos, somente administradores podem alterar.
* `settings/delivery`: campos obrigatórios, raio de check-in, motivos de não entrega e transições.
* `settings/routes`: intervalo GPS, limite offline, edição e transições de rota.
* `settings/permissions`: permissões por perfil de usuário.
* `settings/imports`: colunas obrigatórias, limite de linhas e tratamento de duplicidade.

### Objetos compartilhados
* `GeoLocation`: `{ latitude, longitude, accuracyMeters, headingDegrees, speedKph, recordedAt }`.
* `AddressSnapshot`: `{ formattedAddress, latitude, longitude, placeId, city, state, postalCode }`.

### Regras do V2
1. Snapshots de nomes e placas são obrigatórios para reduzir leituras e garantir histórico.
2. Motoristas leem somente rotas, entregas e eventos associados ao próprio `driverId`.
3. Eventos nunca podem ser atualizados ou excluídos.
4. Motoristas não podem alterar atribuição, sequência, cliente, veículo ou requisitos de comprovante.
5. Configurações são versionadas e escritas somente por administradores.
