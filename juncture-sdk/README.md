# Juncture SDK

A TypeScript/JavaScript SDK for interacting with the Juncture API, providing both frontend and backend functionality.

## Installation

```bash
npm install juncture-sdk
```

## Frontend SDK

The `JunctureFrontend` class provides a convenient way to interact with Juncture's frontend API routes, including OAuth flows and connection management.

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

## Backend SDK

The `JunctureBackend` class provides a secure way to interact with Juncture's backend API routes, including connection management, Jira operations, and credential handling.

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

- **OAuth Flow**: `/initiate-oauth-flow`, `/authorization-callback/:provider`
- **Jira Connection**: `/fetch-available-sites`, `/create-connection`

### Backend SDK Endpoints
The backend SDK is designed to work with the following API routes:

- **Connection Management**: `/check-connection-validity`, `/get-connection-credentials`, `/get-access-token`
- **Jira Operations**: `/get-all-projects`, `/select-project`, `/get-tickets-for-project`, `/create-ticket`, `/delete-issue`, `/get-boards-for-project`, `/get-all-sprints-for-project`, `/get-active-sprints-for-project`, `/get-tickets-for-sprint`, `/get-issue-details`, `/edit-issue`

*Note: Method implementations for these endpoints will be added in future updates.*

## TypeScript Support

The SDK is written in TypeScript and provides full type definitions:

```typescript
import { 
  JunctureFrontend, 
  JunctureFrontendConfig,
  JunctureBackend,
  JunctureBackendConfig 
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

## Security

- **Frontend SDK**: Uses public keys for cloud mode authentication
- **Backend SDK**: Uses secret keys for secure backend authentication
- All sensitive data is transmitted over HTTPS
- Secret keys are automatically included in request headers

## Development

### Building the SDK

```bash
npm run build
```

This will compile the TypeScript code and generate the distribution files in the `dist/` directory.

## License

ISC
