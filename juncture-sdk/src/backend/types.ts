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

// Provider types
export type ProviderType = 'jira';

// ==================== General/Connection Types ====================

export interface CheckConnectionValidityRequest {
  /** Unique identifier for this connection in your system */
  externalId: string;
  /** The provider to check (e.g., 'jira') */
  provider: ProviderType;
}

export interface CheckConnectionValidityResponse {
  /** Whether the connection exists */
  exists: boolean;
  /** Whether the connection is invalid/expired */
  isInvalid: boolean;
  /** When the connection expires */
  expiresAt?: Date;
}

export interface GetConnectionCredentialsRequest {
  /** Unique identifier for this connection in your system */
  externalId: string;
  /** The provider to get credentials for (e.g., 'jira') */
  provider: ProviderType;
}

export interface GetConnectionCredentialsResponse {
  /** The refresh token for the connection */
  refreshToken: string;
  /** When the connection expires */
  expiresAt: Date;
  /** Whether the connection is invalid */
  isInvalid: boolean;
}

export interface GetAccessTokenRequest {
  /** Unique identifier for this connection in your system */
  externalId: string;
  /** The provider to get access token for (e.g., 'jira') */
  provider: ProviderType;
}

export interface GetAccessTokenResponse {
  /** The access token for making API calls */
  accessToken: string;
  /** When the access token expires */
  expiresAt: Date;
}

export interface GetAccessTokenReauthorizationResponse {
  /** Whether reauthorization is needed */
  needsReauthorization: boolean;
  /** Error message */
  error: string;
}

// ==================== Jira Types ====================

// Project Types
export interface JiraProject {
  /** Project ID */
  id: string;
  /** Project key */
  key: string;
  /** Project name */
  name: string;
  /** Project description */
  description?: string;
  /** Project avatar URL */
  avatarUrl?: string;
}

export interface GetJiraProjectsResponse {
  /** List of available Jira projects */
  projects: JiraProject[];
}

export interface SelectJiraProjectRequest {
  /** Project ID to select */
  projectId: string;
}

export interface SelectJiraProjectResponse {
  /** Whether the project was selected successfully */
  success: boolean;
}

export interface GetSelectedJiraProjectIdResponse {
  /** Currently selected project ID */
  projectId: string;
}

// Ticket Types
export interface JiraTicket {
  /** Ticket ID */
  id: string;
  /** Ticket key (e.g., 'PROJ-123') */
  key: string;
  /** Ticket summary */
  summary: string;
  /** Ticket description */
  description?: string;
  /** Ticket status */
  status: string;
  /** Ticket priority */
  priority?: string;
  /** Ticket assignee */
  assignee?: string;
  /** Ticket reporter */
  reporter?: string;
  /** Ticket created date */
  createdAt: Date;
  /** Ticket updated date */
  updatedAt: Date;
}

export interface GetJiraTicketsRequest {
  /** Number of tickets to return */
  maxResults?: number;
  /** Starting index for pagination */
  startAt?: number;
}

export interface GetJiraTicketsResponse {
  /** List of Jira tickets */
  tickets: JiraTicket[];
  /** Total number of tickets */
  total: number;
  /** Starting index */
  startAt: number;
  /** Maximum results */
  maxResults: number;
}

export interface GetJiraTicketsForSprintRequest {
  /** Sprint ID to get tickets for */
  sprintId: string;
  /** Number of tickets to return */
  maxResults?: number;
  /** Starting index for pagination */
  startAt?: number;
}

export interface GetJiraTicketsForSprintResponse {
  /** List of Jira tickets in the sprint */
  tickets: JiraTicket[];
  /** Total number of tickets */
  total: number;
  /** Starting index */
  startAt: number;
  /** Maximum results */
  maxResults: number;
}

export interface DetailedJiraIssue extends JiraTicket {
  /** Additional fields */
  fields: Record<string, any>;
  /** Comments */
  comments?: Array<{
    id: string;
    author: string;
    body: string;
    created: Date;
  }>;
  /** Attachments */
  attachments?: Array<{
    id: string;
    filename: string;
    url: string;
    size: number;
  }>;
}

export interface GetJiraIssueRequest {
  /** Issue key (e.g., 'PROJ-123') */
  issueKey: string;
}

export interface GetJiraIssueResponse {
  /** Detailed issue information */
  issue: DetailedJiraIssue;
}

export interface CreateJiraTicketRequest {
  /** Project key */
  projectKey: string;
  /** Issue type */
  issueType: string;
  /** Ticket summary */
  summary: string;
  /** Ticket description */
  description?: string;
  /** Ticket priority */
  priority?: string;
  /** Ticket assignee */
  assignee?: string;
  /** Additional fields */
  fields?: Record<string, any>;
}

export interface CreateJiraTicketResponse {
  /** Whether the ticket was created successfully */
  success: boolean;
  /** Created ticket key */
  ticketKey?: string;
  /** Created ticket ID */
  ticketId?: string;
}

export interface EditJiraIssueRequest {
  /** Issue key to edit */
  issueKey: string;
  /** Fields to update */
  fields: Record<string, any>;
}

export interface EditJiraIssueResponse {
  /** Whether the issue was updated successfully */
  success: boolean;
}

export interface DeleteJiraIssueRequest {
  /** Issue key to delete */
  issueKey: string;
}

export interface DeleteJiraIssueResponse {
  /** Whether the issue was deleted successfully */
  success: boolean;
}

// Sprint Types
export interface JiraSprint {
  /** Sprint ID */
  id: string;
  /** Sprint name */
  name: string;
  /** Sprint state */
  state: string;
  /** Sprint start date */
  startDate?: Date;
  /** Sprint end date */
  endDate?: Date;
  /** Sprint goal */
  goal?: string;
}

export interface GetSprintsRequest {
  /** Number of sprints to return */
  maxResults?: number;
  /** Starting index for pagination */
  startAt?: number;
}

export interface GetSprintsResponse {
  /** List of Jira sprints */
  sprints: JiraSprint[];
  /** Total number of sprints */
  total: number;
  /** Starting index */
  startAt: number;
  /** Maximum results */
  maxResults: number;
}

export interface GetActiveSprintsResponse {
  /** List of active Jira sprints */
  sprints: JiraSprint[];
}

// Board Types
export interface JiraBoard {
  /** Board ID */
  id: string;
  /** Board name */
  name: string;
  /** Board type */
  type: string;
  /** Board location */
  location?: {
    projectId: string;
    projectName: string;
  };
}

export interface GetJiraBoardRequest {
  /** Number of boards to return */
  maxResults?: number;
  /** Starting index for pagination */
  startAt?: number;
}

export interface GetJiraBoardResponse {
  /** List of Jira boards */
  boards: JiraBoard[];
  /** Total number of boards */
  total: number;
  /** Starting index */
  startAt: number;
  /** Maximum results */
  maxResults: number;
}

// Error types
export interface JunctureError {
  /** Error message */
  error: string;
  /** Additional error details */
  details?: string;
}
