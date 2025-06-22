import axios, { AxiosInstance } from 'axios';
import { JunctureBackendConfig, JunctureBackendOptions } from './types';

/**
 * JunctureBackend SDK for interacting with Juncture API endpoints
 * 
 * This SDK provides a convenient way to interact with Juncture's backend API routes
 * including connection management, Jira operations, and credential handling.
 */
export class JunctureBackend {
  private config: JunctureBackendConfig;
  private httpClient: AxiosInstance;

  /**
   * Creates a new JunctureBackend instance
   * 
   * @param options - Configuration options for the SDK
   * @param options.config - The configuration object
   * @param options.config.junctureApiUrl - Base URL for the Juncture API (required)
   * @param options.config.junctureSecretKey - Secret key for backend authentication (required)
   * 
   * @example
   * ```typescript
   * // Initialize the backend SDK
   * const juncture = new JunctureBackend({
   *   config: {
   *     junctureApiUrl: 'https://api.juncture.com',
   *     junctureSecretKey: 'your-secret-key-here'
   *   }
   * });
   * ```
   */
  constructor(options: JunctureBackendOptions) {
    this.config = options.config;
    
    // Validate required parameters
    if (!this.config.junctureApiUrl) {
      throw new Error('junctureApiUrl is required');
    }

    if (!this.config.junctureSecretKey) {
      throw new Error('junctureSecretKey is required');
    }

    // Initialize HTTP client
    this.httpClient = axios.create({
      baseURL: this.config.junctureApiUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-Juncture-Secret-Key': this.config.junctureSecretKey,
      },
    });
  }

  /**
   * Get the current configuration
   */
  getConfig(): JunctureBackendConfig {
    return { ...this.config };
  }

  /**
   * Get the HTTP client instance
   */
  getHttpClient(): AxiosInstance {
    return this.httpClient;
  }
}
