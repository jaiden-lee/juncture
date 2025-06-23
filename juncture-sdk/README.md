# Juncture SDK

A TypeScript/JavaScript SDK for interacting with the Juncture API, providing both frontend and backend functionality.

## Installation

```bash
npm install juncture-sdk
```

## Frontend SDK

The `JunctureFrontend` class provides a convenient way to interact with Juncture's frontend API routes, specifically for OAuth flows and provider integrations.

### Basic Usage

```typescript
import { JunctureFrontend } from 'juncture-sdk';

// Initialize the SDK
const juncture = new JunctureFrontend({
  config: {
    junctureApiUrl: 'https://api.juncture.com'
  }
});
```

### Cloud Mode Usage

If you're using Juncture in cloud mode, you'll need to provide your public key:

```typescript
import { JunctureFrontend } from 'juncture-sdk';

const juncture = new JunctureFrontend({
  config: {
    junctureApiUrl: 'https://api.juncture.com',
    juncturePublicKey: 'your-public-key-here'
  }
});
```

### Frontend Configuration Options

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `junctureApiUrl` | string | Yes | Base URL for the Juncture API |
| `juncturePublicKey` | string | No | Public key for Juncture cloud mode (only required if using cloud mode) |

### Frontend SDK Methods

#### OAuth Flow Methods

##### `getOAuthAuthorizationUrl(request)`
Get the authorization URL for initiating an OAuth flow.

```typescript
const authUrl = await juncture.getOAuthAuthorizationUrl({
  provider: 'jira',
  externalId: 'project-123'
});
console.log('Redirect user to:', authUrl.authorizationUri);
```

##### `redirectToOAuth(request, framework)`
Automatically redirect the user to the OAuth authorization page.

```typescript
// For Next.js (default)
await juncture.redirectToOAuth({
  provider: 'jira',
  externalId: 'project-123'
}, 'nextjs');

// For React Router
await juncture.redirectToOAuth({
  provider: 'jira',
  externalId: 'project-123'
}, 'react');

// For Vue.js
await juncture.redirectToOAuth({
  provider: 'jira',
  externalId: 'project-123'
}, 'vue');
```

**Supported Frameworks**: `nextjs`, `react`, `vue`, `angular`, `vanilla`

##### `reauthorizeConnection(provider, externalId, framework)`
Reauthorize an existing connection when tokens expire.

```typescript
// Reauthorize an existing Jira connection
await juncture.reauthorizeConnection('jira', 'project-123', 'nextjs');
```

##### `completeIntegration(provider, externalId, framework)`
Complete the full integration flow for any provider.

```typescript
// Complete Jira integration
await juncture.completeIntegration('jira', 'project-123', 'nextjs');
```

### Complete Integration Example

Here's a complete example of integrating with any provider:

```typescript
import { JunctureFrontend } from 'juncture-sdk';

const juncture = new JunctureFrontend({
  config: {
    junctureApiUrl: 'https://api.juncture.com',
    juncturePublicKey: 'your-public-key' // if using cloud mode
  }
});

// 1. Start OAuth flow
const startIntegration = async (provider: string, projectId: string) => {
  await juncture.redirectToOAuth({
    provider: provider as any,
    externalId: projectId
  }, 'nextjs');
};

// 2. Reauthorize when needed
const reauthorize = async (provider: string, projectId: string) => {
  await juncture.reauthorizeConnection(provider as any, projectId, 'nextjs');
};

// Usage
await startIntegration('jira', 'project-123');
```

### OAuth Callback Handling

The OAuth callback is handled automatically by the Juncture backend. After the user completes the OAuth flow, they will be redirected to your application with a connection code that can be used to finalize the integration.

**Note**: The frontend SDK focuses on initiating OAuth flows. For handling callbacks and finalizing connections, you'll need to implement the callback handling in your application or use the Juncture frontend pages.

## Backend SDK

The `JunctureBackend` class provides a secure way to interact with Juncture's backend API routes, including connection management, Jira operations, and credential handling. The SDK uses a namespaced structure for better organization.

### Basic Usage

```typescript
import { JunctureBackend } from 'juncture-sdk';

// Initialize the backend SDK
const juncture = new JunctureBackend({
  config: {
    junctureApiUrl: 'https://api.juncture.com',
    junctureSecretKey: 'your-secret-key-here'
  }
});
```

### Backend Configuration Options

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `junctureApiUrl` | string | Yes | Base URL for the Juncture API |
| `junctureSecretKey` | string | Yes | Secret key for backend authentication |

### Backend SDK Methods (Namespaced)

The backend SDK organizes methods into namespaces for better discoverability and organization:

#### General Namespace (`juncture.general.*`)

##### `checkConnectionValidity(request)`
Check if a connection exists and whether it's expired.

```typescript
const status = await juncture.general.checkConnectionValidity({
  externalId: 'project-123',
  provider: 'jira'
});

if (status.exists && !status.isInvalid) {
  console.log('Connection is valid until:', status.expiresAt);
}
```

##### `getAccessToken(request)`
Get an access token for making API calls (recommended method).

```typescript
const token = await juncture.general.getAccessToken({
  externalId: 'project-123',
  provider: 'jira'
});

console.log('Access token:', token.accessToken);
console.log('Expires at:', token.expiresAt);
```

##### `getConnectionCredentials(request)`
Get connection credentials (refresh token and expiry info).

```typescript
const credentials = await juncture.general.getConnectionCredentials({
  externalId: 'project-123',
  provider: 'jira'
});

console.log('Refresh token:', credentials.refreshToken);
console.log('Expires at:', credentials.expiresAt);
```

**Note**: It's recommended to use `getAccessToken` instead and let Juncture manage refresh tokens.

#### Jira Namespace (`juncture.jira.*`)

##### Project Operations

```typescript
// Get all available projects
const projects = await juncture.jira.getProjects();
console.log('Available projects:', projects.projects);

// Select a project
await juncture.jira.selectProject({ projectId: 'project-123' });

// Get currently selected project
const selectedProject = await juncture.jira.getSelectedProjectId();
console.log('Selected project:', selectedProject.projectId);
```

##### Ticket Operations

```typescript
// Get tickets for the current project
const tickets = await juncture.jira.getTickets({ maxResults: 50 });
console.log('Tickets:', tickets.tickets);

// Get tickets for a specific sprint
const sprintTickets = await juncture.jira.getTicketsForSprint({
  sprintId: 'sprint-123',
  maxResults: 25
});

// Get detailed information about a specific issue
const issue = await juncture.jira.getIssue({ issueKey: 'PROJ-123' });
console.log('Issue details:', issue.issue);

// Create a new ticket
const newTicket = await juncture.jira.createTicket({
  projectKey: 'PROJ',
  issueType: 'Task',
  summary: 'New task',
  description: 'Task description',
  priority: 'Medium'
});

// Edit an existing issue
await juncture.jira.editIssue({
  issueKey: 'PROJ-123',
  fields: {
    summary: 'Updated summary',
    description: 'Updated description'
  }
});

// Delete an issue
await juncture.jira.deleteIssue({ issueKey: 'PROJ-123' });
```

##### Sprint Operations

```typescript
// Get all sprints for the current project
const sprints = await juncture.jira.getSprints({ maxResults: 20 });
console.log('All sprints:', sprints.sprints);

// Get only active sprints
const activeSprints = await juncture.jira.getActiveSprints();
console.log('Active sprints:', activeSprints.sprints);
```

##### Board Operations

```typescript
// Get boards for the current project
const boards = await juncture.jira.getBoards({ maxResults: 10 });
console.log('Available boards:', boards.boards);
```

### Complete Backend Example

Here's a complete example of using the backend SDK:

```typescript
import { JunctureBackend } from 'juncture-sdk';

const juncture = new JunctureBackend({
  config: {
    junctureApiUrl: 'https://api.juncture.com',
    junctureSecretKey: 'your-secret-key'
  }
});

// 1. Check connection status
const connectionStatus = await juncture.general.checkConnectionValidity({
  externalId: 'project-123',
  provider: 'jira'
});

if (!connectionStatus.exists || connectionStatus.isInvalid) {
  console.log('Connection needs to be reauthorized');
  return;
}

// 2. Get access token for API calls
const token = await juncture.general.getAccessToken({
  externalId: 'project-123',
  provider: 'jira'
});

// 3. Work with Jira projects
const projects = await juncture.jira.getProjects();
await juncture.jira.selectProject({ projectId: projects.projects[0].id });

// 4. Get tickets
const tickets = await juncture.jira.getTickets({ maxResults: 10 });
console.log('Recent tickets:', tickets.tickets);

// 5. Create a new ticket
const newTicket = await juncture.jira.createTicket({
  projectKey: 'PROJ',
  issueType: 'Bug',
  summary: 'Critical bug found',
  description: 'Detailed bug description',
  priority: 'High'
});

console.log('Created ticket:', newTicket.ticketKey);
```

## Available Methods

Both SDKs provide the following utility methods:

#### `getConfig()`
Returns a copy of the current configuration.

```typescript
const config = juncture.getConfig();
console.log(config.junctureApiUrl); // 'https://api.juncture.com'
```

#### `getHttpClient()`
Returns the underlying Axios HTTP client instance for advanced usage.

```typescript
const httpClient = juncture.getHttpClient();
// Use the HTTP client for custom requests
```

## API Endpoints

### Frontend SDK Endpoints
The frontend SDK is designed to work with the following API routes:

- **OAuth Flow**: `/initiate-oauth-flow`

### Backend SDK Endpoints
The backend SDK is designed to work with the following API routes:

- **General**: `/check-connection-validity`, `/get-connection-credentials`, `/get-access-token`
- **Jira Projects**: `/get-all-projects`, `/select-project`, `/get-selected-project-id`
- **Jira Tickets**: `/get-tickets-for-project`, `/get-tickets-for-sprint`, `/get-issue-details`, `/create-ticket`, `/edit-issue`, `/delete-issue`
- **Jira Sprints**: `/get-all-sprints-for-project`, `/get-active-sprints-for-project`
- **Jira Boards**: `/get-boards-for-project`

## TypeScript Support

The SDK is written in TypeScript and provides full type definitions:

```typescript
import { 
  JunctureFrontend, 
  JunctureFrontendConfig,
  JunctureBackend,
  JunctureBackendConfig,
  ProviderType,
  InitiateOAuthFlowRequest,
  CheckConnectionValidityRequest,
  JiraProject,
  JiraTicket
} from 'juncture-sdk';

// Frontend configuration
const frontendConfig: JunctureFrontendConfig = {
  junctureApiUrl: 'https://api.juncture.com',
  juncturePublicKey: 'optional-public-key'
};

// Backend configuration
const backendConfig: JunctureBackendConfig = {
  junctureApiUrl: 'https://api.juncture.com',
  junctureSecretKey: 'required-secret-key'
};

const frontend = new JunctureFrontend({ config: frontendConfig });
const backend = new JunctureBackend({ config: backendConfig });

// Type-safe requests
const oauthRequest: InitiateOAuthFlowRequest = {
  provider: 'jira',
  externalId: 'project-123'
};

const connectionRequest: CheckConnectionValidityRequest = {
  externalId: 'project-123',
  provider: 'jira'
};
```

## Error Handling

The SDK validates required parameters and throws descriptive errors:

```typescript
try {
  const juncture = new JunctureBackend({
    config: {
      junctureApiUrl: 'https://api.juncture.com'
      // Missing junctureSecretKey will throw an error
    }
  });
} catch (error) {
  console.error('Initialization failed:', error.message);
  // Output: "Initialization failed: junctureSecretKey is required"
}
```

API errors are also handled gracefully:

```typescript
try {
  const token = await juncture.general.getAccessToken({
    externalId: 'project-123',
    provider: 'jira'
  });
} catch (error) {
  console.error('Failed to get access token:', error.message);
  // Output: "Failed to get access token: Reauthorization required: Token expired"
}
```

## Security

- **Frontend SDK**: Uses public keys for cloud mode authentication
- **Backend SDK**: Uses secret keys for secure backend authentication
- All sensitive data is transmitted over HTTPS
- Secret keys are automatically included in request headers
- OAuth state parameters are validated to prevent CSRF attacks

## Framework Support

The frontend SDK supports multiple frameworks for OAuth redirects:

- **Next.js**: Full support with automatic redirects
- **React**: Full support with automatic redirects
- **Vue.js**: Full support with automatic redirects
- **Angular**: Full support with automatic redirects
- **Vanilla JavaScript**: Full support with automatic redirects

## Reauthorization

When OAuth tokens expire, you can reauthorize connections using the `reauthorizeConnection` method:

```typescript
// Reauthorize an existing connection
await juncture.reauthorizeConnection('jira', 'project-123', 'nextjs');
```

This method uses the same OAuth flow as initial authorization, so users will be prompted to grant permissions again if needed.

## Development

### Building the SDK

```bash
npm run build
```

This will compile the TypeScript code and generate the distribution files in the `dist/` directory.

## License

ISC
