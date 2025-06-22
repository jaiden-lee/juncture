export interface JunctureFrontendConfig {
  /** Base URL for the Juncture API */
  junctureApiUrl: string;
  /** Public key for Juncture cloud mode (optional, only required for cloud mode) */
  juncturePublicKey?: string;
}

export interface JunctureFrontendOptions {
  /** Configuration for the JunctureFrontend instance */
  config: JunctureFrontendConfig;
}
