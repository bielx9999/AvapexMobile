# Integracoes Microsoft

A area `Documentacao e Relatorios` usa autenticacao delegada. O usuario entra com a conta Microsoft corporativa e o navegador recebe tokens temporarios para consultar o Graph e abrir o Power BI. Nenhum client secret deve ser colocado no `.env` do frontend.

## 1. Aplicativo no Microsoft Entra ID

1. Em **Microsoft Entra admin center > App registrations**, crie um registro para o painel web.
2. Em **Authentication**, adicione uma plataforma **Single-page application (SPA)** com as URLs:
   - `http://localhost:5173`
   - URL HTTPS oficial do painel, quando publicada
3. Em **API permissions**, adicione permissao delegada do **Microsoft Graph**: `User.Read` e `Files.Read`.
4. Para relatorios Power BI, adicione a permissao delegada `Report.Read.All` da API `Power BI Service`. O administrador do tenant pode precisar conceder consentimento.
5. Use o **Application (client) ID** no `.env` como `VITE_MICROSOFT_CLIENT_ID`.

Se a equipe trabalha em uma biblioteca do SharePoint, a pasta precisa ser compartilhada com os usuarios do aplicativo e o `driveId` da biblioteca pode ser informado. Para um OneDrive pessoal/corporativo, deixe `VITE_MICROSOFT_ONEDRIVE_DRIVE_ID` vazio.

## 2. Variaveis do painel

Copie `apps/admin/.env.example` para `apps/admin/.env` e preencha:

```env
VITE_MICROSOFT_CLIENT_ID=client-id-do-entra
VITE_MICROSOFT_TENANT_ID=tenant-id-da-organizacao
VITE_MICROSOFT_ONEDRIVE_ROOT_FOLDER_ID=id-da-pasta
VITE_MICROSOFT_ONEDRIVE_DRIVE_ID=id-da-biblioteca-sharepoint-opcional
VITE_MICROSOFT_POWERBI_WORKSPACE_ID=id-do-workspace-opcional
VITE_MICROSOFT_POWERBI_REPORT_ID=id-do-relatorio
VITE_MICROSOFT_POWERBI_EMBED_URL=https://app.powerbi.com/reportEmbed?reportId=...
```

O `VITE_MICROSOFT_POWERBI_EMBED_URL` pode ficar vazio quando o relatorio estiver no workspace informado; nesse caso o painel monta a URL automaticamente. Para relatorios distribuidos por app, informe a URL completa e garanta que os usuarios tenham acesso ao app.

## 3. Como obter IDs

- OneDrive: abra a pasta no navegador e use o identificador do item obtido no Graph Explorer ou pela API `/me/drive/root/children`.
- SharePoint: use o `driveId` da biblioteca e o `itemId` da pasta no Graph Explorer.
- Power BI: o `reportId` esta na URL do relatorio; o `groupId` e o ID do workspace.

## 4. Comportamento da aplicacao

- `Documentacao`: lista os itens da pasta configurada, permite buscar e abre o arquivo na experiencia Microsoft original.
- `Relatorios`: incorpora o relatorio com o token da conta conectada e respeita as permissoes do Power BI.
- Sem configuracao Microsoft, a pagina continua acessivel e informa exatamente o que falta.
- Sem permissao no Graph ou Power BI, o erro retornado pela Microsoft aparece no painel para facilitar o diagnostico.

Para o primeiro teste local, rode `npm run dev` em `apps/admin`, acesse `http://localhost:5173`, entre no painel e clique em `Conectar Microsoft`.
