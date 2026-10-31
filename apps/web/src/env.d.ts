// Build-time settings (apps/web/.env).
interface ImportMetaEnv {
  readonly VITE_SYNC_URL?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  // Set by vite.config.ts at build time.
  readonly VITE_APP_VERSION?: string;
  readonly VITE_APP_COMMIT?: string;
  readonly VITE_APP_BUILT?: string;
  readonly VITE_LATEST_UPDATE?: string;
}
