# Recuperacao de senha

## Implementado

O painel administrativo e o aplicativo mobile usam `sendPasswordResetEmail` do
Firebase Auth. O usuario informa o e-mail cadastrado e recebe o fluxo oficial de
redefinicao de senha do Firebase.

Esse fluxo e o mais seguro para a base atual porque nao expoe segredos no
frontend e respeita os provedores ja configurados no Firebase Authentication.

## Codigo por e-mail ou SMS

Um codigo numerico por e-mail/SMS precisa ser implementado no backend, nao no
React ou Flutter. O fluxo recomendado e:

1. Criar uma Cloud Function `requestPasswordResetCode`.
2. Receber e-mail ou telefone.
3. Localizar o usuario com Admin SDK.
4. Gerar codigo de 6 digitos com validade curta.
5. Salvar apenas hash do codigo em Firestore, com TTL e limite de tentativas.
6. Enviar o codigo por provedor transacional, como SendGrid/Resend para e-mail
   e Twilio/Zenvia/TotalVoice para SMS.
7. Criar uma Cloud Function `confirmPasswordResetCode`.
8. Validar codigo, tentativas e expiracao.
9. Atualizar a senha com Firebase Admin SDK.
10. Invalidar o codigo usado e registrar auditoria.

Nunca coloque token de SMS, SMTP ou API de e-mail no app mobile ou no painel web.
