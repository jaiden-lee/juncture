import axios, { AxiosInstance } from 'axios';
import { 
  JunctureFrontendConfig, 
  JunctureFrontendOptions,
  ProviderType,
  InitiateOAuthFlowRequest,
  InitiateOAuthFlowResponse,
  JunctureError,
  SupportedFramework
} from './types';

/**
 * JunctureFrontend SDK for interacting with Juncture API endpoints
 * 
 * This SDK provides a convenient way to interact with Juncture's frontend API routes
 * including OAuth flows for provider integrations.
 */
export class JunctureFrontend {
  private config: JunctureFrontendConfig;
  private httpClient: AxiosInstance;

  /**
   * Creates a new JunctureFrontend instance
   * 
   * @param options - Configuration options for the SDK
   * @param options.config - The configuration object
   * @param options.config.junctureApiUrl - Base URL for the Juncture API (required)
   * @param options.config.juncturePublicKey - Public key for Juncture cloud mode (optional)
   * 
   * @example
   * ```typescript
   * // Basic usage
   * const juncture = new JunctureFrontend({
   *   config: {
   *     junctureApiUrl: 'https://api.juncture.com'
   *   }
   * });
   * 
   * // With cloud mode
   * const juncture = new JunctureFrontend({
   *   config: {
   *     junctureApiUrl: 'https://api.juncture.com',
   *     juncturePublicKey: 'your-public-key-here'
   *   }
   * });
   * ```
   */
  constructor(options: JunctureFrontendOptions) {
    this.config = options.config;
    
    // Validate required parameters
    if (!this.config.junctureApiUrl) {
      throw new Error('junctureApiUrl is required');
    }

    // Initialize HTTP client
    this.httpClient = axios.create({
      baseURL: this.config.junctureApiUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add public key to headers if provided (for cloud mode)
    if (this.config.juncturePublicKey) {
      this.httpClient.defaults.headers.common['X-Juncture-Public-Key'] = this.config.juncturePublicKey;
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): JunctureFrontendConfig {
    return { ...this.config };
  }

  /**
   * Get the HTTP client instance
   */
  getHttpClient(): AxiosInstance {
    return this.httpClient;
  }

  // ==================== OAuth Flow Methods ====================

  /**
   * Get the authorization URL for initiating an OAuth flow
   * 
   * @param request - OAuth flow initiation parameters
   * @returns Promise with the authorization URL
   * 
   * @example
   * ```typescript
   * const authUrl = await juncture.getOAuthAuthorizationUrl({
   *   provider: 'jira',
   *   externalId: 'project-123'
   * });
   * console.log('Redirect user to:', authUrl.authorizationUri);
   * ```
   */
  async getOAuthAuthorizationUrl(request: InitiateOAuthFlowRequest): Promise<InitiateOAuthFlowResponse> {
    try {
      const response = await this.httpClient.post('/initiate-oauth-flow', {
        provider: request.provider,
        external_id: request.externalId
      });
      
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get OAuth authorization URL');
    }
  }

  /**
   * Automatically redirect the user to the OAuth authorization page
   * 
   * @param request - OAuth flow initiation parameters
   * @param framework - The framework being used (affects redirect method)
   * 
   * @example
   * ```typescript
   * // For Next.js
   * await juncture.redirectToOAuth({
   *   provider: 'jira',
   *   externalId: 'project-123'
   * }, 'nextjs');
   * 
   * // For React Router
   * await juncture.redirectToOAuth({
   *   provider: 'jira',
   *   externalId: 'project-123'
   * }, 'react');
   * ```
   */
  async redirectToOAuth(request: InitiateOAuthFlowRequest, framework: SupportedFramework = 'nextjs'): Promise<void> {
    try {
      const authResponse = await this.getOAuthAuthorizationUrl(request);
      
      switch (framework) {
        case 'nextjs':
          if (typeof window !== 'undefined') {
            window.location.href = authResponse.authorizationUri;
          } else {
            throw new Error('window is not available in server-side environment');
          }
          break;
        case 'react':
          if (typeof window !== 'undefined') {
            window.location.href = authResponse.authorizationUri;
          } else {
            throw new Error('window is not available in server-side environment');
          }
          break;
        case 'vue':
        case 'angular':
        case 'vanilla':
          if (typeof window !== 'undefined') {
            window.location.href = authResponse.authorizationUri;
          } else {
            throw new Error('window is not available in server-side environment');
          }
          break;
        default:
          throw new Error(`Unsupported framework: ${framework}`);
      }
    } catch (error) {
      throw this.handleError(error, 'Failed to redirect to OAuth');
    }
  }

  /**
   * Reauthorize an existing connection (useful when tokens expire)
   * 
   * @param provider - The provider to reauthorize
   * @param externalId - Unique identifier for this connection
   * @param framework - The framework being used
   * @returns Promise that resolves when the reauthorization flow is complete
   * 
   * @example
   * ```typescript
   * // Reauthorize an existing Jira connection
   * await juncture.reauthorizeConnection('jira', 'project-123', 'nextjs');
   * ```
   */
  async reauthorizeConnection(provider: ProviderType, externalId: string, framework: SupportedFramework = 'nextjs'): Promise<void> {
    await this.redirectToOAuth({
      provider,
      externalId
    }, framework);
  }

  /**
   * Complete the full integration flow for any provider
   * 
   * @param provider - The provider to connect to
   * @param externalId - Unique identifier for this connection
   * @param framework - The framework being used
   * @returns Promise that resolves when the flow is complete
   * 
   * @example
   * ```typescript
   * // Complete Jira integration
   * await juncture.completeIntegration('jira', 'project-123', 'nextjs');
   * ```
   */
  async completeIntegration(provider: ProviderType, externalId: string, framework: SupportedFramework = 'nextjs'): Promise<void> {
    await this.redirectToOAuth({
      provider,
      externalId
    }, framework);
  }

  // ==================== Utility Methods ====================

  /**
   * Handle API errors and provide consistent error messages
   */
  private handleError(error: any, defaultMessage: string): Error {
    if (axios.isAxiosError(error)) {
      const errorData = error.response?.data as JunctureError;
      const message = errorData?.error || error.message || defaultMessage;
      const details = errorData?.details;
      
      const fullMessage = details ? `${message}: ${details}` : message;
      return new Error(fullMessage);
    }
    
    return new Error(error.message || defaultMessage);
  }

  /**
   * Extract error message from various error types
   */
  private getErrorMessage(error: any): string {
    if (axios.isAxiosError(error)) {
      const errorData = error.response?.data as JunctureError;
      return errorData?.error || error.message || 'Unknown error occurred';
    }
    
    return error.message || 'Unknown error occurred';
  }
}
