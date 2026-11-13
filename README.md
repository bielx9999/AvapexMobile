# Logistica Avapex

Sistema com painel administrativo web (`apps/admin`), aplicativo Flutter para motoristas (`apps/mobile`) e Firebase. Este guia mostra como preparar outro computador Windows para desenvolvimento.

## Pre-requisitos

- Git e acesso autorizado ao repositorio GitHub.
- Node.js 22 LTS e npm, para o painel e as Functions.
- Flutter SDK com Dart compativel com `apps/mobile/pubspec.yaml` e Android Studio com Android SDK para desenvolver o aplicativo. Execute `flutter doctor` para verificar a instalacao.
- Acesso ao projeto Firebase e ao Google Maps Platform, para obter as configuracoes necessarias. As contas de acesso ao sistema nao sao recriadas automaticamente pelo codigo.
- Firebase CLI para administrar ou publicar o projeto: `npm install -g firebase-tools`, seguido de `firebase login`.

## Obter o projeto

No PowerShell, em uma pasta de trabalho:

```powershell
git clone https://github.com/bielx9999/AvapexMobile.git
cd AvapexMobile
```

O acesso ao repositorio privado, se aplicavel, exige autenticacao no GitHub. O codigo nao inclui dados do Firestore, arquivos enviados ao Storage nem contas do Firebase Auth.

## Painel web

1. Entre em `apps/admin`, instale as dependencias e crie a configuracao local:

```powershell
cd apps/admin
npm ci
Copy-Item .env.example .env.local
```

2. Preencha `.env.local` com os valores `VITE_FIREBASE_*` do aplicativo web no Console Firebase. Configure `VITE_GOOGLE_MAPS_API_KEY` para os recursos de mapas e `VITE_GOOGLE_MAPS_MAP_ID` se houver um Map ID proprio. Configure as variaveis Microsoft somente quando OneDrive e Power BI forem utilizados.
3. Inicie o painel:

```powershell
npm run dev
```

Abra o endereco `Local` mostrado no terminal, normalmente `http://localhost:5173/`. Para acessar pelo celular na mesma rede, use o endereco `Network` exibido pelo Vite e permita a conexao no firewall quando necessario.

Para verificar a compilacao de producao, execute `npm run build` dentro de `apps/admin`. A pasta `dist` e gerada automaticamente.

## Aplicativo Android

1. No diretorio `apps/mobile`, crie o arquivo de configuracao e instale as dependencias:

```powershell
cd apps/mobile
Copy-Item .env.example .env
flutter pub get
flutter doctor
```

2. Preencha `FIREBASE_ANDROID_*` no `.env` com os dados do aplicativo Android no Firebase. Configure `GOOGLE_MAPS_API_KEY` se utilizar a pre-visualizacao da rota. As secoes Web e iOS so sao necessarias para essas plataformas.
3. Baixe `google-services.json` do aplicativo Android correspondente no Console Firebase e coloque-o em `apps/mobile/android/app/google-services.json`. Confirme que o nome do pacote Android corresponde ao aplicativo cadastrado no Firebase. Para iOS, o arquivo correspondente e `apps/mobile/ios/Runner/GoogleService-Info.plist`.
4. Ative a depuracao USB no telefone, conecte-o e aceite a autorizacao. Em `apps/mobile`, execute:

```powershell
flutter devices
flutter run
```

Quando houver mais de um dispositivo, use `flutter run -d ID_DO_DISPOSITIVO`. Consulte tambem [apps/mobile/README.md](apps/mobile/README.md) e [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md).

## Firebase e Functions

O projeto padrao do CLI esta em `.firebaserc`. Confira o projeto selecionado com `firebase use` antes de qualquer publicacao. Regras e indices do Firestore, regras do Storage e configuracao do Hosting estao no repositorio; modifica-los localmente nao os publica automaticamente.

Para preparar o codigo das Functions:

```powershell
cd functions
npm ci
```

A integracao Oracle esta reservada para uso futuro e sua pagina foi retirada do painel. Ela depende de credenciais no Secret Manager, acesso de rede e configuracao de infraestrutura; veja [docs/INTEGRACAO_ORACLE.md](docs/INTEGRACAO_ORACLE.md). Nao e necessario configurar Oracle para iniciar o painel web.

## Arquivos e credenciais locais

Os arquivos `.env`, `.env.local`, `google-services.json` e `GoogleService-Info.plist` nao sao incluidos no Git. Obtenha-os pelos canais autorizados ou recrie-os a partir dos exemplos e do Console Firebase. Nao publique senhas, tokens, chaves privadas ou credenciais Oracle no repositorio; segredos de servidor devem permanecer no Secret Manager.
