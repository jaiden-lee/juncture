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
export type { 
  JunctureBackendConfig, 
  JunctureBackendOptions,
  // General types
  CheckConnectionValidityRequest,
  CheckConnectionValidityResponse,
  GetConnectionCredentialsRequest,
  GetConnectionCredentialsResponse,
  GetAccessTokenRequest,
  GetAccessTokenResponse,
  // Jira types
  JiraProject,
  GetJiraProjectsResponse,
  SelectJiraProjectRequest,
  SelectJiraProjectResponse,
  GetSelectedJiraProjectIdResponse,
  JiraTicket,
  GetJiraTicketsRequest,
  GetJiraTicketsResponse,
  GetJiraTicketsForSprintRequest,
  GetJiraTicketsForSprintResponse,
  DetailedJiraIssue,
  GetJiraIssueRequest,
  GetJiraIssueResponse,
  CreateJiraTicketRequest,
  CreateJiraTicketResponse,
  EditJiraIssueRequest,
  EditJiraIssueResponse,
  DeleteJiraIssueRequest,
  DeleteJiraIssueResponse,
  JiraSprint,
  GetSprintsRequest,
  GetSprintsResponse,
  GetActiveSprintsResponse,
  JiraBoard,
  GetJiraBoardRequest,
  GetJiraBoardResponse
} from './backend/types';
