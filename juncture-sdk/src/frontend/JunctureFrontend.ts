import axios, { AxiosInstance } from 'axios';
import { JunctureFrontendConfig, JunctureFrontendOptions } from './types';

/**
 * JunctureFrontend SDK for interacting with Juncture API endpoints
 * 
 * This SDK provides a convenient way to interact with Juncture's frontend API routes
 * including OAuth flows and connection management.
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
}
