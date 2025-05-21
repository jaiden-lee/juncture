# Juncture

Juncture is a serverless application that provides deep integrations with hard APIs, like Jira, supporting complex workflows and automations.

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm (v8 or higher)
- Upstash Redis

### Getting Started

1. Inside of the `server` directory, run `npm install` to install dependencies.
2. Create a `.env` file in the root directory and add the following variables:
```
PORT=<PORT, i.e. 8000>
UPSTASH_REDIS_REST_URL=<UPSTASH_REDIS_REST_URL>
UPSTASH_REDIS_REST_TOKEN=<UPSTASH_REDIS_REST_TOKEN>

# Jira (if self-hosting, provide your own credentials)
DEFAULT_JIRA_CLIENT_ID=<JIRA_CLIENT_ID>
DEFAULT_JIRA_CLIENT_SECRET=<JIRA_CLIENT_SECRET>
DEFAULT_JIRA_SCOPES=<JIRA_SCOPES>
DEFAULT_JIRA_REDIRECT_URI=[API_BASE_URL]/api/oauth/authorization-callback
```
3. Run `npm run dev` to start the server.