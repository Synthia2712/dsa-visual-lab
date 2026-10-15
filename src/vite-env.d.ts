/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_ID?: string;
  readonly VITE_PROJECT_TITLE?: string;
  readonly VITE_AUTHOR?: string;
  readonly VITE_INSTITUTION?: string;
  readonly VITE_COURSE?: string;
  readonly VITE_ROLL_NUMBER?: string;
  readonly VITE_YEAR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
