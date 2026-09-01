import { PublicClientApplication, type AccountInfo, type AuthenticationResult, type Configuration } from '@azure/msal-browser';

const graphScopes = ['User.Read', 'Files.Read'];
const powerBiScopes = ['https://analysis.windows.net/powerbi/api/Report.Read.All'];

export type CloudItem = {
  id: string;
  name: string;
  webUrl?: string;
  size?: number;
  lastModifiedDateTime?: string;
  isFolder: boolean;
};

export const microsoftConfig = {
  clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID?.trim() ?? '',
  tenantId: import.meta.env.VITE_MICROSOFT_TENANT_ID?.trim() || 'common',
  oneDriveRootFolderId: import.meta.env.VITE_MICROSOFT_ONEDRIVE_ROOT_FOLDER_ID?.trim() ?? '',
  oneDriveDriveId: import.meta.env.VITE_MICROSOFT_ONEDRIVE_DRIVE_ID?.trim() ?? '',
  powerBiWorkspaceId: import.meta.env.VITE_MICROSOFT_POWERBI_WORKSPACE_ID?.trim() ?? '',
  powerBiReportId: import.meta.env.VITE_MICROSOFT_POWERBI_REPORT_ID?.trim() ?? '',
  powerBiEmbedUrl: import.meta.env.VITE_MICROSOFT_POWERBI_EMBED_URL?.trim() ?? '',
};

const msalConfig: Configuration = {
  auth: {
    clientId: microsoftConfig.clientId,
    authority: `https://login.microsoftonline.com/${microsoftConfig.tenantId}`,
    redirectUri: window.location.origin,
  },
  cache: { cacheLocation: 'sessionStorage' },
};

let msalApp: PublicClientApplication | undefined;
let initialization: Promise<void> | undefined;

function getMsalApp() {
  if (!microsoftConfig.clientId) {
    throw new Error('Configure VITE_MICROSOFT_CLIENT_ID para habilitar as integracoes Microsoft.');
  }
  msalApp ??= new PublicClientApplication(msalConfig);
  initialization ??= msalApp.initialize();
  return { app: msalApp, ready: initialization };
}

export function isMicrosoftConfigured() {
  return Boolean(microsoftConfig.clientId);
}

export function microsoftAccount(): AccountInfo | undefined {
  return msalApp?.getActiveAccount() ?? msalApp?.getAllAccounts()[0];
}

async function acquireToken(scopes: string[]) {
  const { app, ready } = getMsalApp();
  await ready;
  let account = microsoftAccount();
  if (!account) {
    const result = await app.loginPopup({ scopes, prompt: 'select_account' });
    account = result.account ?? undefined;
    if (account) app.setActiveAccount(account);
    return result.accessToken;
  }
  try {
    const result = await app.acquireTokenSilent({ account, scopes });
    return result.accessToken;
  } catch {
    const result = await app.acquireTokenPopup({ account, scopes });
    if (result.account) app.setActiveAccount(result.account);
    return result.accessToken;
  }
}

export async function signInMicrosoft() {
  await acquireToken(graphScopes);
  return microsoftAccount();
}

export async function signOutMicrosoft() {
  const { app, ready } = getMsalApp();
  await ready;
  await app.logoutPopup({ account: microsoftAccount(), mainWindowRedirectUri: window.location.origin });
}

async function graphRequest<T>(path: string): Promise<T> {
  const token = await acquireToken(graphScopes);
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Microsoft Graph recusou a solicitacao (${response.status}). ${detail.slice(0, 180)}`);
  }
  return response.json() as Promise<T>;
}

export async function listOneDriveItems() {
  const drivePrefix = microsoftConfig.oneDriveDriveId ? `/drives/${microsoftConfig.oneDriveDriveId}` : '/me/drive';
  const itemPath = microsoftConfig.oneDriveRootFolderId
    ? `${drivePrefix}/items/${microsoftConfig.oneDriveRootFolderId}/children`
    : `${drivePrefix}/root/children`;
  const params = '?$select=id,name,webUrl,file,folder,size,lastModifiedDateTime&$orderby=name';
  const result = await graphRequest<{ value: Array<Record<string, unknown>> }>(`${itemPath}${params}`);
  return result.value.map((item) => ({
    id: String(item.id ?? ''),
    name: String(item.name ?? 'Sem nome'),
    webUrl: typeof item.webUrl === 'string' ? item.webUrl : undefined,
    size: typeof item.size === 'number' ? item.size : undefined,
    lastModifiedDateTime: typeof item.lastModifiedDateTime === 'string' ? item.lastModifiedDateTime : undefined,
    isFolder: Boolean(item.folder),
  })) satisfies CloudItem[];
}

export async function acquirePowerBiToken() {
  return acquireToken(powerBiScopes);
}

export function powerBiEmbedUrl() {
  if (microsoftConfig.powerBiEmbedUrl) return microsoftConfig.powerBiEmbedUrl;
  if (!microsoftConfig.powerBiReportId) return '';
  const group = microsoftConfig.powerBiWorkspaceId ? `&groupId=${encodeURIComponent(microsoftConfig.powerBiWorkspaceId)}` : '';
  return `https://app.powerbi.com/reportEmbed?reportId=${encodeURIComponent(microsoftConfig.powerBiReportId)}${group}`;
}

export function microsoftUserLabel(account: AccountInfo | undefined) {
  return account?.name || account?.username || 'Conta Microsoft';
}

export function authResultAccount(result: AuthenticationResult) {
  return result.account ?? undefined;
}
