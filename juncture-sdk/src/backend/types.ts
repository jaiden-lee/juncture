export interface JunctureBackendConfig {
  /** Base URL for the Juncture API */
  junctureApiUrl: string;
  /** Secret key for Juncture backend authentication (required) */
  junctureSecretKey: string;
}

export interface JunctureBackendOptions {
  /** Configuration for the JunctureBackend instance */
  config: JunctureBackendConfig;
}
