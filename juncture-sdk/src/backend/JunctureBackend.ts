import axios, { AxiosInstance } from 'axios';
import { 
  JunctureBackendConfig, 
  JunctureBackendOptions,
  ProviderType,
  CheckConnectionValidityRequest,
  CheckConnectionValidityResponse,
  GetConnectionCredentialsRequest,
  GetConnectionCredentialsResponse,
  GetAccessTokenRequest,
  GetAccessTokenResponse,
  GetJiraProjectsResponse,
  SelectJiraProjectRequest,
  SelectJiraProjectResponse,
  GetSelectedJiraProjectIdResponse,
  GetJiraTicketsRequest,
  GetJiraTicketsResponse,
  GetJiraTicketsForSprintRequest,
  GetJiraTicketsForSprintResponse,
  GetJiraIssueRequest,
  GetJiraIssueResponse,
  CreateJiraTicketRequest,
  CreateJiraTicketResponse,
  EditJiraIssueRequest,
  EditJiraIssueResponse,
  DeleteJiraIssueRequest,
  DeleteJiraIssueResponse,
  GetSprintsRequest,
  GetSprintsResponse,
  GetActiveSprintsResponse,
  GetJiraBoardRequest,
  GetJiraBoardResponse,
  JunctureError
} from './types';

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
   * General connection and credential management methods
   */
  public readonly general: {
    checkConnectionValidity: (request: CheckConnectionValidityRequest) => Promise<CheckConnectionValidityResponse>;
    getConnectionCredentials: (request: GetConnectionCredentialsRequest) => Promise<GetConnectionCredentialsResponse>;
    getAccessToken: (request: GetAccessTokenRequest) => Promise<GetAccessTokenResponse>;
  };

  /**
   * Jira-specific operations and management
   */
  public readonly jira: {
    // Project operations
    getProjects: () => Promise<GetJiraProjectsResponse>;
    selectProject: (request: SelectJiraProjectRequest) => Promise<SelectJiraProjectResponse>;
    getSelectedProjectId: () => Promise<GetSelectedJiraProjectIdResponse>;
    
    // Ticket operations
    getTickets: (request?: GetJiraTicketsRequest) => Promise<GetJiraTicketsResponse>;
    getTicketsForSprint: (request: GetJiraTicketsForSprintRequest) => Promise<GetJiraTicketsForSprintResponse>;
    getIssue: (request: GetJiraIssueRequest) => Promise<GetJiraIssueResponse>;
    createTicket: (request: CreateJiraTicketRequest) => Promise<CreateJiraTicketResponse>;
    editIssue: (request: EditJiraIssueRequest) => Promise<EditJiraIssueResponse>;
    deleteIssue: (request: DeleteJiraIssueRequest) => Promise<DeleteJiraIssueResponse>;
    
    // Sprint operations
    getSprints: (request?: GetSprintsRequest) => Promise<GetSprintsResponse>;
    getActiveSprints: () => Promise<GetActiveSprintsResponse>;
    
    // Board operations
    getBoards: (request?: GetJiraBoardRequest) => Promise<GetJiraBoardResponse>;
  };

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
   * 
   * // Use namespaced methods
   * const connectionStatus = await juncture.general.checkConnectionValidity({
   *   externalId: 'project-123',
   *   provider: 'jira'
   * });
   * 
   * const projects = await juncture.jira.getProjects();
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

    // Initialize namespaced methods
    this.general = {
      checkConnectionValidity: this.checkConnectionValidity.bind(this),
      getConnectionCredentials: this.getConnectionCredentials.bind(this),
      getAccessToken: this.getAccessToken.bind(this),
    };

    this.jira = {
      getProjects: this.getJiraProjects.bind(this),
      selectProject: this.selectJiraProject.bind(this),
      getSelectedProjectId: this.getSelectedJiraProjectId.bind(this),
      getTickets: this.getJiraTickets.bind(this),
      getTicketsForSprint: this.getJiraTicketsForSprint.bind(this),
      getIssue: this.getJiraIssue.bind(this),
      createTicket: this.createJiraTicket.bind(this),
      editIssue: this.editJiraIssue.bind(this),
      deleteIssue: this.deleteJiraIssue.bind(this),
      getSprints: this.getJiraSprints.bind(this),
      getActiveSprints: this.getActiveJiraSprints.bind(this),
      getBoards: this.getJiraBoards.bind(this),
    };
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

  // ==================== General/Connection Methods ====================

  /**
   * Check if a connection exists and whether it's expired
   */
  private async checkConnectionValidity(request: CheckConnectionValidityRequest): Promise<CheckConnectionValidityResponse> {
    try {
      const response = await this.httpClient.get('/check-connection-validity', {
        params: {
          external_id: request.externalId,
          provider: request.provider
        }
      });
      
      return {
        exists: response.data.exists,
        isInvalid: response.data.is_invalid,
        expiresAt: response.data.expires_at ? new Date(response.data.expires_at) : undefined
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to check connection validity');
    }
  }

  /**
   * Get connection credentials (refresh token and expiry info)
   * 
   * Note: It's recommended to use getAccessToken instead and let Juncture manage refresh tokens
   */
  private async getConnectionCredentials(request: GetConnectionCredentialsRequest): Promise<GetConnectionCredentialsResponse> {
    try {
      const response = await this.httpClient.get('/get-connection-credentials', {
        params: {
          external_id: request.externalId,
          provider: request.provider
        }
      });
      
      return {
        refreshToken: response.data.refresh_token,
        expiresAt: new Date(response.data.expires_at),
        isInvalid: response.data.is_invalid
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to get connection credentials');
    }
  }

  /**
   * Get an access token for making API calls
   * 
   * This is the recommended method for getting tokens. Call this right before making API calls
   * as access tokens may expire at any time.
   */
  private async getAccessToken(request: GetAccessTokenRequest): Promise<GetAccessTokenResponse> {
    try {
      const response = await this.httpClient.get('/get-access-token', {
        params: {
          external_id: request.externalId,
          provider: request.provider
        }
      });
      
      return {
        accessToken: response.data.access_token,
        expiresAt: new Date(response.data.expires_at)
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        const errorData = error.response.data;
        if (errorData.needs_reauthorization) {
          throw new Error(`Reauthorization required: ${errorData.error}`);
        }
      }
      throw this.handleError(error, 'Failed to get access token');
    }
  }

  // ==================== Jira Methods ====================

  // Project Methods
  private async getJiraProjects(): Promise<GetJiraProjectsResponse> {
    try {
      const response = await this.httpClient.get('/get-all-projects');
      return {
        projects: response.data.projects || []
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to get Jira projects');
    }
  }

  private async selectJiraProject(request: SelectJiraProjectRequest): Promise<SelectJiraProjectResponse> {
    try {
      const response = await this.httpClient.post('/select-project', {
        project_id: request.projectId
      });
      
      return {
        success: response.data.success || true
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to select Jira project');
    }
  }

  private async getSelectedJiraProjectId(): Promise<GetSelectedJiraProjectIdResponse> {
    try {
      const response = await this.httpClient.get('/get-selected-project-id');
      return {
        projectId: response.data.project_id
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to get selected Jira project ID');
    }
  }

  // Ticket Methods
  private async getJiraTickets(request?: GetJiraTicketsRequest): Promise<GetJiraTicketsResponse> {
    try {
      const response = await this.httpClient.get('/get-tickets-for-project', {
        params: {
          maxResults: request?.maxResults,
          startAt: request?.startAt
        }
      });
      
      return {
        tickets: response.data.tickets || [],
        total: response.data.total || 0,
        startAt: response.data.startAt || 0,
        maxResults: response.data.maxResults || 50
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to get Jira tickets');
    }
  }

  private async getJiraTicketsForSprint(request: GetJiraTicketsForSprintRequest): Promise<GetJiraTicketsForSprintResponse> {
    try {
      const response = await this.httpClient.get('/get-tickets-for-sprint', {
        params: {
          sprint_id: request.sprintId,
          maxResults: request.maxResults,
          startAt: request.startAt
        }
      });
      
      return {
        tickets: response.data.tickets || [],
        total: response.data.total || 0,
        startAt: response.data.startAt || 0,
        maxResults: response.data.maxResults || 50
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to get Jira tickets for sprint');
    }
  }

  private async getJiraIssue(request: GetJiraIssueRequest): Promise<GetJiraIssueResponse> {
    try {
      const response = await this.httpClient.get('/get-issue-details', {
        params: {
          issue_key: request.issueKey
        }
      });
      
      return {
        issue: response.data.issue
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to get Jira issue');
    }
  }

  private async createJiraTicket(request: CreateJiraTicketRequest): Promise<CreateJiraTicketResponse> {
    try {
      const response = await this.httpClient.post('/create-ticket', {
        project_key: request.projectKey,
        issue_type: request.issueType,
        summary: request.summary,
        description: request.description,
        priority: request.priority,
        assignee: request.assignee,
        fields: request.fields
      });
      
      return {
        success: response.data.success || true,
        ticketKey: response.data.ticket_key,
        ticketId: response.data.ticket_id
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to create Jira ticket');
    }
  }

  private async editJiraIssue(request: EditJiraIssueRequest): Promise<EditJiraIssueResponse> {
    try {
      const response = await this.httpClient.put('/edit-issue', {
        issue_key: request.issueKey,
        fields: request.fields
      });
      
      return {
        success: response.data.success || true
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to edit Jira issue');
    }
  }

  private async deleteJiraIssue(request: DeleteJiraIssueRequest): Promise<DeleteJiraIssueResponse> {
    try {
      const response = await this.httpClient.delete('/delete-issue', {
        params: {
          issue_key: request.issueKey
        }
      });
      
      return {
        success: response.data.success || true
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to delete Jira issue');
    }
  }

  // Sprint Methods
  private async getJiraSprints(request?: GetSprintsRequest): Promise<GetSprintsResponse> {
    try {
      const response = await this.httpClient.get('/get-all-sprints-for-project', {
        params: {
          maxResults: request?.maxResults,
          startAt: request?.startAt
        }
      });
      
      return {
        sprints: response.data.sprints || [],
        total: response.data.total || 0,
        startAt: response.data.startAt || 0,
        maxResults: response.data.maxResults || 50
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to get Jira sprints');
    }
  }

  private async getActiveJiraSprints(): Promise<GetActiveSprintsResponse> {
    try {
      const response = await this.httpClient.get('/get-active-sprints-for-project');
      return {
        sprints: response.data.sprints || []
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to get active Jira sprints');
    }
  }

  // Board Methods
  private async getJiraBoards(request?: GetJiraBoardRequest): Promise<GetJiraBoardResponse> {
    try {
      const response = await this.httpClient.get('/get-boards-for-project', {
        params: {
          maxResults: request?.maxResults,
          startAt: request?.startAt
        }
      });
      
      return {
        boards: response.data.boards || [],
        total: response.data.total || 0,
        startAt: response.data.startAt || 0,
        maxResults: response.data.maxResults || 50
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to get Jira boards');
    }
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
}
