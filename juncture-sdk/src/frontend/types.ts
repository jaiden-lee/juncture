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

// Provider types
export type ProviderType = 'jira';

// OAuth Flow Types
export interface InitiateOAuthFlowRequest {
  /** The provider to connect to (e.g., 'jira') */
  provider: ProviderType;
  /** Unique identifier for this connection in your system */
  externalId: string;
}

export interface InitiateOAuthFlowResponse {
  /** The authorization URL to redirect users to */
  authorizationUri: string;
}

// Error types
export interface JunctureError {
  /** Error message */
  error: string;
  /** Additional error details */
  details?: string;
}

// Framework support types
export type SupportedFramework = 'nextjs' | 'react' | 'vue' | 'angular' | 'vanilla';
