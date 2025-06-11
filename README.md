# Juncture

Juncture is a serverless application that provides deep integrations with hard APIs, like Jira, supporting complex workflows and automations.

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm (v8 or higher)
- Upstash Redis
- PostgreSQL Database (like Neon)

### Getting Started

#### Server
1. Inside of the `server` directory, run `npm install` to install dependencies.
2. Create a `.env` file in the root directory and add the following variables:
```
PORT=<PORT, i.e. 8000>
CLOUD_MODE=false # Always leave to false if you are self-hosting
UPSTASH_REDIS_REST_URL=<UPSTASH_REDIS_REST_URL>
UPSTASH_REDIS_REST_TOKEN=<UPSTASH_REDIS_REST_TOKEN>
DATABASE_URL=<POSTGRES_DATABASE_URL>
JUNCTURE_SECRET_KEY=<create your own secret key and provide it here>


# Jira (if self-hosting, provide your own credentials)
DEFAULT_JIRA_CLIENT_ID=<JIRA_CLIENT_ID>
DEFAULT_JIRA_CLIENT_SECRET=<JIRA_CLIENT_SECRET>
DEFAULT_JIRA_SCOPES=<JIRA_SCOPES>
DEFAULT_JIRA_REDIRECT_URI=[API_BASE_URL]/api/frontend/oauth/authorization-callback/jira
```
3. Run `npm run dev` to start the server.

#### Frontend
1. Inside of the `frontend` directory, run `npm install` to install dependencies.
2. Create a `.env` file in the root directory and add the following variables:
```
NEXT_PUBLIC_CLOUD_MODE=false # Always leave to false if you are self-hosting
NEXT_PUBLIC_JUNCTURE_SERVER_URL=http://localhost:8000

NEXT_PUBLIC_DEFAULT_JIRA_SITE_REDIRECT_URI=<URL of your site to redirect to after user authenticates>
```
3. Run `npm run dev` to start the server.