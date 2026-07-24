# Estrutura Base do Projeto

Esta estrutura separa o app mobile dos motoristas, o painel web administrativo e a documentacao tecnica compartilhada.

```text
.
├── ARCHITECTURE.md
├── firebase.json
├── firestore.indexes.json
├── firestore.rules
├── storage.rules
├── docs/
│   └── PROJECT_STRUCTURE.md
└── apps/
    ├── mobile/
    │   ├── .env.example
    │   ├── pubspec.yaml
    │   └── lib/
    │       ├── core/
    │       │   ├── config/
    │       │   │   ├── firebase_environment.dart
    │       │   │   └── firebase_initializer.dart
    │       │   ├── errors/
    │       │   │   └── firebase_failure.dart
    │       │   ├── firebase/
    │       │       ├── firestore_collections.dart
    │       │       └── firestore_serializers.dart
    │       │   └── providers/
    │       │       └── firebase_providers.dart
    │       └── features/
    │           ├── auth/
    │           │   └── data/repositories/auth_repository.dart
    │           ├── checklists/
    │           │   └── data/
    │           │       ├── models/checklist_model.dart
    │           │       └── repositories/checklist_repository.dart
    │           ├── incidents/
    │           │   └── data/
    │           │       ├── models/incident_model.dart
    │           │       └── repositories/incident_repository.dart
    │           ├── media/
    │           │   └── data/
    │           │       ├── models/
    │           │       │   ├── driver_media_type.dart
    │           │       │   └── pending_media_upload.dart
    │           │       └── services/
    │           │           ├── media_upload_service.dart
    │           │           └── pending_media_queue.dart
    │           ├── trips/
    │           │   └── data/
    │           │       ├── models/trip_model.dart
    │           │       └── repositories/trip_repository.dart
    │           ├── users/
    │           │   └── data/
    │           │       ├── models/app_user_model.dart
    │           │       └── repositories/user_repository.dart
    │           └── vehicles/
    │               └── data/
    │                   ├── models/vehicle_model.dart
    │                   └── repositories/vehicle_repository.dart
    └── admin/
        ├── .env.example
        └── src/
            ├── app/
            ├── features/
            ├── lib/firebase/
            ├── models/
            └── repositories/
```

## Regras de Separacao

* `features/*/presentation`: telas e componentes de UI.
* `features/*/application`: Riverpod/Bloc, casos de uso e estado.
* `features/*/data/models`: classes puras de dominio/dados.
* `features/*/data/repositories`: operacoes Firestore/Auth/Storage por entidade.
* `core/config`: bootstrapping do Firebase e variaveis de ambiente.
* `core/firebase`: nomes de colecoes, conversores e utilitarios compartilhados.

O mobile deve chamar Firebase somente por servicos/repositorios. O painel admin segue a mesma regra com SDK modular Web v9+ quando for implementado.
