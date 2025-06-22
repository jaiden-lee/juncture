// Frontend SDK exports
export { JunctureFrontend } from './frontend/JunctureFrontend';
export type { 
  JunctureFrontendConfig, 
  JunctureFrontendOptions,
  ProviderType,
  InitiateOAuthFlowRequest,
  InitiateOAuthFlowResponse,
  JunctureError,
  SupportedFramework
} from './frontend/types';

// Backend SDK exports
export { JunctureBackend } from './backend/JunctureBackend';
export type { JunctureBackendConfig, JunctureBackendOptions } from './backend/types';
