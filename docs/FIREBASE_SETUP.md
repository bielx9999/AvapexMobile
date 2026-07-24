# Firebase Setup

Este projeto esta preparado para usar Firebase Authentication, Cloud Firestore,
Cloud Storage, Firestore Rules, Storage Rules e Firestore Indexes.

## 1. Ferramentas

Instale e autentique as CLIs:

```powershell
npm install -g firebase-tools
firebase login
C:\Users\operacional.GRUPOSEDAY\SDK\flutter\bin\dart.bat pub global activate flutterfire_cli
```

Depois adicione o Pub Cache ao PATH do Windows, se necessario:

```text
C:\Users\operacional.GRUPOSEDAY\AppData\Local\Pub\Cache\bin
```

Neste workspace, o terminal integrado do VS Code ja inclui:

```text
C:\Users\operacional.GRUPOSEDAY\SDK\flutter\bin
C:\Users\operacional.GRUPOSEDAY\AppData\Local\Pub\Cache\bin
```

## 2. Projeto Firebase

No Console Firebase:

* Ative Authentication com provedor E-mail/Senha.
* Crie o Cloud Firestore em modo Native.
* Ative Cloud Storage.
* Registre o app Android com package name:

```text
br.com.avapex.logistica.mobile
```

* Registre o app iOS com bundle ID:

```text
br.com.avapex.logistica.mobile
```

## 3. Configuracao local

O projeto Firebase padrao deste repositorio esta configurado em `.firebaserc`:

```text
logisticaavapex-dede6
```

Copie `apps/mobile/.env.example` para `apps/mobile/.env` e preencha os valores
publicos do Firebase. O app tambem aceita esses valores por `--dart-define`.

Alternativamente, rode o fluxo oficial FlutterFire a partir de `apps/mobile`:

```powershell
flutterfire configure `
  --project=logisticaavapex-dede6 `
  --android-package-name=br.com.avapex.logistica.mobile `
  --ios-bundle-id=br.com.avapex.logistica.mobile
```

## 4. Deploy das regras

Na raiz do repositorio:

```powershell
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Se a CLI responder `No authorized accounts`, rode antes:

```powershell
firebase login
```

## 5. Ambiente Android

Para rodar em emulador ou device Android, instale o Android SDK pelo Android
Studio ou aponte para um SDK ja existente:

```powershell
flutter config --android-sdk "CAMINHO_DO_ANDROID_SDK"
flutter doctor -v
```

## 6. Usuario motorista inicial

Crie o usuario no Authentication e depois crie um documento em `users/{uid}`:

```json
{
  "uid": "UID_DO_AUTH",
  "name": "Motorista Teste",
  "email": "motorista@avapex.com.br",
  "phone": "11999999999",
  "role": "driver",
  "cnh": {
    "number": "12345678900",
    "category": "E",
    "expirationDate": "Timestamp"
  },
  "status": "active",
  "createdAt": "Timestamp"
}
```

As regras atuais permitem que motoristas leiam/escrevam apenas documentos com
`driverId == auth.uid`. Administradores sao identificados por `users/{uid}.role`
igual a `admin`.
