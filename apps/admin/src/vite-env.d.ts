/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MICROSOFT_CLIENT_ID?: string;
  readonly VITE_MICROSOFT_TENANT_ID?: string;
  readonly VITE_MICROSOFT_ONEDRIVE_ROOT_FOLDER_ID?: string;
  readonly VITE_MICROSOFT_ONEDRIVE_DRIVE_ID?: string;
  readonly VITE_MICROSOFT_POWERBI_WORKSPACE_ID?: string;
  readonly VITE_MICROSOFT_POWERBI_REPORT_ID?: string;
  readonly VITE_MICROSOFT_POWERBI_EMBED_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
