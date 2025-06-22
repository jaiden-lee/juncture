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

### Configuration Options

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `junctureApiUrl` | string | Yes | Base URL for the Juncture API |
| `juncturePublicKey` | string | No | Public key for Juncture cloud mode (only required if using cloud mode) |

### Available Methods

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

The SDK is designed to work with the following frontend API routes:

- **OAuth Flow**: `/initiate-oauth-flow`, `/authorization-callback/:provider`
- **Jira Connection**: `/fetch-available-sites`, `/create-connection`

*Note: Method implementations for these endpoints will be added in future updates.*

## TypeScript Support

The SDK is written in TypeScript and provides full type definitions:

```typescript
import { JunctureFrontend, JunctureFrontendConfig } from 'juncture-sdk';

const config: JunctureFrontendConfig = {
  junctureApiUrl: 'https://api.juncture.com',
  juncturePublicKey: 'optional-public-key'
};

const juncture = new JunctureFrontend({ config });
```

## Error Handling

The SDK validates required parameters and throws descriptive errors:

```typescript
try {
  const juncture = new JunctureFrontend({
    config: {
      // Missing junctureApiUrl will throw an error
    }
  });
} catch (error) {
  console.error('Initialization failed:', error.message);
  // Output: "Initialization failed: junctureApiUrl is required"
}
```

## Development

### Building the SDK

```bash
npm run build
```

This will compile the TypeScript code and generate the distribution files in the `dist/` directory.

## License

ISC
