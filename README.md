# Juncture

Juncture is a serverless application that provides deep integrations with hard APIs, like Jira, supporting complex workflows and automations.

## Quickstart

### Prerequisites

- Node.js (v16 or higher)
- npm (v8 or higher)
- Upstash Redis
- PostgreSQL Database (like Neon)
- Jira Developer App with Credentials

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
3. Run `npx drizzle-kit generate` and `npx drizzle-kit migrate` to apply migrations to your database
4. Run `npm run dev` to start the server.

#### Frontend
1. Inside of the `frontend` directory, run `npm install` to install dependencies.
2. Create a `.env` file in the root directory and add the following variables:
```
NEXT_PUBLIC_CLOUD_MODE=false # Always leave to false if you are self-hosting
NEXT_PUBLIC_JUNCTURE_SERVER_URL=http://localhost:8000

NEXT_PUBLIC_DEFAULT_JIRA_SITE_REDIRECT_URI=<URL of your site to redirect to after user authenticates>
```
3. Run `npm run dev` to start the server.


## What is Juncture?
### Problem
Building SaaS integrations is hard, especially with Jira. Although there are many SaaS integration solutions, such as Nango and Paragon, most lack a sophisticated Jira integration. 

### Solution
Juncture is an integration kit (server to handle business logic, frontend for users to set integration settings) that makes integrating with Jira easy (or easier at least).

## What are Connections?
Let's say you're building an application that **integrates** with Jira to provide new AI features. Now, let's say one of your users creates a project on your site and wants to link that project to their Jira project. This results in a **jira connection** being formed. 

Each **connection** has its own refresh token (if you are unfamiliar with OAuth, basically it's just a set of credentials) to access Jira's API. Each connection can also store information about its linking with Jira, such as the **jira site** (think of it like an organization in Jira) and the selected project in Jira this connection wants to interact with (if you are building project-based integrations).

## What is Cloud Mode?
juncture-cloud is the hosted SaaS platform layer built on top of the open-source Juncture core (this repo). Juncture-cloud handles all of the infrastructure behind the scenes, so that you can get started right away.

If you are looking at this repo, then you are most likely planning to self-host, so you can safely ignore the `CLOUD_MODE` field, as well as the `server/src/utils/CloudContextManager.ts` file, as both are used to support the juncture-cloud hosted platform.

Also, for any methods where you see `juncture_public_key`, you can ignore the public key portion and not pass it in, as the public key is used for identify different projects created within juncture cloud. However, you still will have to worry about `juncture_secret_key`, since that is used as a security measure to verify incoming requests.

## What is the frontend api vs backend api?
The frontend api, located in `server/src/routes/frontend` or `server/src/controller/frontend`, is a set of API endpoints that can be (and should be) directly called from your frontend. This is mainly responsible for handling things like authorization and authentication.

The backend api, located in `server/src/routes/backend` or `server/src/controller/backend`, is a set of API endpoints that should only ever be directly called from your backend/server. The reason is because these methods may access sensitive information, and thus require a `juncture_secret_key` to access these methods. 

For example, if a user wants to get a list of all jira tickets, this user will first make an API request to YOUR backend first. When your backend receives this request, your backend should verify that the user has permissions depending on however you implemented auth for your own app (i.e., verifying JWT, or verifying Clerk access token). After you have verified that the user has access for this resource, your backend makes an API request to the backend api's getJiraTickets method, making sure to pass in your secret key. Juncture's backend api will then verify this secret key, return the jira tickets to your backend, which you can then return to your frontend user.

## How does the authorization flow work?
1. Let's say an END USER wants to create a jira connection. First, from your site, using juncture's frontend api (`server/src/routes/frontend/oauth.route.ts`), you will make an API request to `/api/frontend/oauth/get-authorization-uri`, which will return you a URL to Jira's site to start the auth process. 
2. Redirect your users to the URL from step 1
3. Your users will sign in to Jira and choose the site they want to grant your app access to
4. After signing in, Jira will redirect to `/api/frontend/oauth/authorization-callback/jira?code=...&state=...`, which essentially is used to ensure this authorization was indeed started by Juncture and not some third party, as well as to kick start the connection creation process.
5. The user will then be redirected to juncture's frontend site (`/frontend`). From here, the user will once again, select the site they would like to integrate with. The reason for this redundancy is specified below.
6. Afterwards, another API request is sent to `/api/frontend/finalize-connection/jira/create-connection`, which will finalize the creation of the connection and add it to the database.

## Juncture's frontend site and why we have redundant site selection?
When a user creates a connection with Jira, Jira makes them select a "site" to grant access to, which is essentially an organization if you are unfamiliar with Jira. If a user makes multiple connections with the same Jira app (the one that you create in the Jira developer console) however, all connections have access to the sites that the other connections granted access to (for the same user).

For example, let's say Bob is part of 2 projects: Projectile and Agiler. For Projectile, Bob creates a Jira connection, so he connects to a jira site called "jira-projectile". For Agiler, Bob also creates a Jira connection, so he grants jira access to "jira-agiler". However, based on the way Jira's auth works, the first connection he made with Projectile actually will have access to both "jira-projectile" and "jira-agiler", and same with the connection for Agiler. This is obviously undesirable behavior, so Juncture will have users reselect the site on Juncture's own frontend, so that Juncture knows what site the user actually intended to integrate with.

## What is ExtendTransaction?
If you're reading through the code for the createConnection helper method or the createJiraConnection method (`/api/frontend/finalize-connection/jira/create-connection`), you'll notice a little ExtendTransaction functionality. The reason this is used is because the createJiraConnection method involves updating 2 tables: connection and jira_connection. The createConnection helper method is supposed to be a generic helper method for all providers (Jira + other providers in the future). The createConnection helper method thus only updates the `connection` table, and instead accepts an optional `ExtendTransaction` function that is run alongside the current DB call inside of a transaction (an atomic operation, so both succeed or both fail). 

This allows createJiraConnection to write a SQL query that creates/updates the jira_connection table, pass it to the createConnection method, and both can get called.

# Server Documentation
## Frontend API
### Initiate OAuth Flow
#### `POST /api/frontend/oauth/initiate-oauth-flow/`
<details>

##### Returns
HTTP Response 200 if successful:
```
{
    "authorization_uri": "URI HERE"
}
```
##### Headers
- (Optional) x-juncture-public-key: '{juncture_public_key}'
    - Only pass in this parameter if you are using Juncture-Cloud. The public api key is only used to identify Juncture-cloud projects

```json
{
    "x-juncture-public-key": "KEY HERE"
}
```
##### Body
- (Required) provider: 'jira'
    - Ensure the provider passed in is all lowercase
    - The only valid provider right now is 'jira'
- (Required) external_id: any unique identifier for your application (i.e., user_id, project_id, org_id) 
    - The external_id is used as a way for you to associate a connection (which this api route kickstarts the process of) with an ID of your choosing.
    - For example, if you want individual users to be able to integrate with Jira, you can pass in their user_ids as external_ids. Later on, when you want to, for example, getJiraTickets for this connection, you can simply pass in the user_id.
    - Or, if you want project-based integrations, then you pass in a project_id, and etc...

```json
{
    "provider": "jira",
    "external_id": "your-unique-id"
}
```
##### Description
This endpoint is used to kickstart the connection creation process. If you want to create a Jira connection, first call this method to get an authorization URI, then redirect the user to that URI.

This method generates a secure state parameter, and stores it inside of redis.
#
</details>

#### `GET /api/frontend/oauth/authorization-callback/:provider`

<details>

WARNING: DO NOT CALL THIS METHOD DIRECTLY. This method is meant as a callback that providers, such as Jira, will redirect to after users authorize that provider on their website. 
##### Returns
Redirect response to Juncture's frontend. Specifically, the `/finalize-connection/:provider/:connection_code` route
##### Query Parameters
- (Required) code: the authorization code to exchange for an access token
- (Required) state: the state generated from the get-authorization-uri method
##### Route Parameters
- (Required) provider: 'jira'

##### Description
This method is not meant to be directly called by you, but rather is a callback from Jira. This method is used to exchange the given code for a (refresh_token, access_token) pair, which are the credentials that a connection in Juncture relies on to interact with Jira's API on behalf of users. 

Specifically, the access_token is cached in redis, while the refresh_token is stored in the database under a Connections table. However, this method doesn't create the connection inside the database yet, but rather stores the refresh_token and connection details in redis first. Only until the user verifies the site they want to connect with in Juncture's frontend at the `/finalize-connection/:provider/:connection_code` route is the connection in the database added. 

If the connection is never finalized on the frontend, then the connection details, refresh token, and access token will be deleted from the redis after a certain period of time (15 minutes for connection details, 1 hour for access token).

This method also verifies that the state was indeed the state generated by `get-authorization-uri` above for security purposes.
#
</details>


### Connection Finalization

#### `GET /api/frontend/finalize-connection/jira/fetch-available-sites`

<details>

##### Returns
HTTP 200 response: a list of the jira sites that the user has authenticated before
```json
{
    "sites": [
        {
            "site_id": "jira-site-id",
            "site_name": "example-site-name"
        },
        {
            "site_id": "jira-site-id-2",
            "site_name": "example-site-name-2"
        }
    ]
}
```

##### Query Parameters
- (Required) connection_code: the temporary connection code generated by `GET /api/frontend/oauth/authorization-callback/:provider`

##### Description
This method is called by the Juncture-frontend `/finalize-connection/:provider/:connection_code` route to get a list of all the Jira sites that the current user has previously granted access to (current user, as in the current user's jira account).

You will most likely never use this method, as it is used by Juncture's frontend, not meant to be used by you.
#
</details>

#### `POST /api/frontend/finalize-connection/jira/create-connection`
<details>

##### Returns
HTTP Response 200 if successful
```json
{
    "success": true
}
```
##### Body
- (Required) connection_code: the temporary connection code generated by `GET /api/frontend/oauth/authorization-callback/:provider`
- (Required) site_id: the site id of the jira site that the user selected
##### Description
You most likely will not use this method, as it is called by Juncture's frontend, and not meant to be used by you. This method is responsible for actually creating the Jira connection in the database, as well as selecting the jira site and recording the selected jira site inside of the database.

Specifically, if you would like more detail, this method creates a new entry in the `connection` table, and a new entry in the `jira_connection` table. The `jira_connection` table stores the site id, while the `connection` table stores the refresh token that was generated in the `authorization-callback` method.

</details>


## Backend API

### General Connection Management/Details

#### `GET /api/backend/connection-info/check-connection-validity`
<details>

##### Returns
Example HTTP 200 response:
```json
{
    "exists": true,
    "is_expired": false,
    "is_invalid": false
}
```
- `exists`: Whether the connection exists and is usable
- `is_expired`: Whether the connection's refresh token has expired (based on `expires_at` in the database) past the refresh tokens MAXIMUM lifetime
- `is_invalid`: Whether the connection's refresh token has been marked as invalid (based on `invalid_refresh_token` in the database) - it is possible for a connection to not be "expired"/past the maximum lifetime, but still be invalid (if it was revoked)

##### Headers
- (Required) Authorization: 'Bearer {juncture_secret_key}'
    - This is the secret key you created in your `.env` file (or was given in juncture-cloud, if using CLOUD)
    - Used to verify that the request is coming from your backend
    - Example:
```json
{
    "Authorization": "Bearer {juncture_secret_key}"
}
```

##### Query Parameters
- (Required) external_id: The external ID you used when creating the connection
    - This is the same external_id you passed in during the OAuth flow
    - Example: If you used a project_id as the external_id, pass that same project_id here
- (Required) provider: 'jira'
    - The provider you want to check the connection for
    - Currently, only 'jira' is supported

##### Description
This endpoint is used to check the status of a connection. It verifies three things:
1. Whether the connection exists
2. Whether the connection's refresh token has expired (based on the `expires_at` field in the database)
3. Whether the connection's refresh token has been marked as invalid (based on the `invalid_refresh_token` field in the database)

A connection is considered invalid if:
- The refresh token was revoked by the user in Jira
- The refresh token was marked as invalid due to a failed refresh attempt

A connection is considered expired if:
- The current time is past the `expires_at` timestamp in the database
- Jira refresh tokens have a maximum lifetime of 365 days

Use this endpoint to:
- Check if a user needs to re-authenticate
- Verify if a connection is still usable before making API calls
- Determine if you need to prompt the user to reconnect their Jira account

Example use case:
```typescript
// Before making a Jira API call, check if the connection is valid
const response = await fetch('/api/backend/connection-info/check-connection-validity?external_id=project123&provider=jira', {
    headers: {
        'Authorization': 'Bearer {juncture_secret_key}'
    }
});
const { is_invalid, is_expired } = await response.json();

if (is_invalid || is_expired) {
    // Prompt user to reconnect their Jira account
    showReconnectPrompt();
}
```

#
</details>

#### `GET /api/backend/connection-info/get-connection-credentials`
<details>

##### Returns
HTTP 200 response:
```json
{
    "refresh_token": "string",
    "expires_at": "2024-03-21T00:00:00Z",
    "is_invalid": false
}
```
- `refresh_token`: The connection's refresh token
- `expires_at`: The timestamp when the refresh token expires (ISO 8601 format)
- `is_invalid`: Whether the refresh token has been marked as invalid

##### Headers
- (Required) Authorization: 'Bearer {juncture_secret_key}'
    - This is the secret key you created in your `.env` file (or was given in juncture-cloud, if using CLOUD)
    - Used to verify that the request is coming from your backend
    - Example:
```json
{
    "Authorization": "Bearer {juncture_secret_key}"
}
```

##### Query Parameters
- (Required) external_id: The external ID you used when creating the connection
    - This is the same external_id you passed in during the OAuth flow
    - Example: If you used a project_id as the external_id, pass that same project_id here
- (Required) provider: 'jira'
    - The provider you want to get credentials for
    - Currently, only 'jira' is supported

##### Description
This endpoint retrieves the connection's refresh token and related information. However, you are discouraged from using this method directly since Juncture manages both the refresh token and access token lifecycle. Instead, it is recommended to use Juncture's getAccessToken endpoints and let Juncture handle the refresh token logic.

The refresh token is marked as invalid if:
- The refresh token was revoked by the user in Jira
- The refresh token was marked as invalid due to a failed refresh attempt

The `expires_at` field indicates when the refresh token will expire:
- Jira refresh tokens have a maximum lifetime of 365 days
- After this period, the user will need to re-authenticate

Use this endpoint only if you need to:
- Debug connection issues
- Implement custom token management (not recommended, since you won't be able to use Juncture's integration helpers, as those also try to manage tokens. Only do this if you are only using Juncture as an authorization layer.)
- Access the raw refresh token for specific use cases

Example use case (not recommended for most cases):
```typescript
// Get connection credentials (only if you need the refresh token)
const response = await fetch('/api/backend/connection-info/get-connection-credentials?external_id=project123&provider=jira', {
    headers: {
        'Authorization': 'Bearer {juncture_secret_key}'
    }
});
const { refresh_token, expires_at, is_invalid } = await response.json();

saveRefreshTokenInCustomDB(); // again, not recommended to do, since it can conflict with Juncture's refresh token management
```

Note: It is strongly recommended to use Juncture's access token endpoints instead of managing refresh tokens yourself, as this could lead to conflicts with Juncture's token management system.


#
</details>

#### `GET /api/backend/connection-info/get-access-token`
<details>

##### Returns
HTTP 200 response:
```json
{
    "access_token": "access_token_here",
    "expires_at": "2024-03-21T00:00:00Z"
}
```
- `access_token`: The current access token for the connection
- `expires_at`: The timestamp when the access token expires (ISO 8601 format)


Or HTTP 403 response if reauthorization is needed:
```json
{
    "error": "Connection is invalid or expired. Please reauthorize the connection.",
    "needs_reauthorization": true
}
```


Or HTTP 401 response otherwise:
```json
{
    "error": "string"
}
```

##### Headers
- (Required) Authorization: 'Bearer {juncture_secret_key}'
    - This is the secret key you created in your `.env` file (or was given in juncture-cloud, if using CLOUD)
    - Used to verify that the request is coming from your backend
    - Example:
```json
{
    "Authorization": "Bearer {juncture_secret_key}"
}
```

##### Query Parameters
- (Required) external_id: The external ID you used when creating the connection
    - This is the same external_id you passed in during the OAuth flow
    - Example: If you used a project_id as the external_id, pass that same project_id here
- (Required) provider: 'jira'
    - The provider you want to get an access token for
    - Currently, only 'jira' is supported

##### Description
This endpoint retrieves a valid access token for making API calls to the provider (e.g., Jira). The endpoint handles both retrieving the current access token from cache and refreshing it if necessary. Here's how it works:

1. First, it checks if there's a valid access token in Redis cache
2. If found and not expired, returns the cached token
3. If not found or expired, it:
   - Uses the refresh token to get a new access token
   - Stores the new access token in Redis cache
   - Returns the new access token

The access token is cached in Redis with a TTL (Time To Live) that's slightly shorter than the actual expiration time to ensure tokens are refreshed before they expire.

Use this endpoint when:
- You need to make direct API calls to Jira (or other providers) that aren't implemented in Juncture
- You want more control over how and when API calls are made
- You're implementing custom integration features

Example use case:
```typescript
// Get an access token before making a Jira API call
const response = await fetch('/api/backend/connection-info/get-access-token?external_id=project123&provider=jira', {
    headers: {
        'Authorization': 'Bearer {juncture_secret_key}'
    }
});

if (response.status === 403) {
    const data = await response.json();
    if (data.needs_reauthorization) {
        // Start reauthorization flow
        startReauthorizationFlow();
    }
} else if (response.status === 401) {
    // Handle other auth errors
    handleAuthError();
} else {
    // do jira api call with access token
}
```

Important notes:
1. If you do call this method, always call this endpoint right before making an API call, as access tokens can expire at any time. Don't try to store and use this access_token for later.
2. The endpoint handles token refresh automatically, so you don't need to worry about refresh token logic
3. If the refresh token is invalid or expired, the endpoint will return a 403 error, indicating that the user needs to re-authenticate
4. The access token is cached in Redis to minimize the number of refresh token requests to the provider

#
</details>

### Jira Integration Methods
#### `GET /api/backend/jira/get-projects`
<details>

##### Required Scopes
- `read:jira-work`

##### Returns
HTTP 200 response:
```json
{
    "projects": [
        {
            "id": "10000",
            "key": "PROJ",
            "name": "Example Project",
            "lead": {
                "displayName": "John Doe"
            }
        }
    ],
    "total": 1,
    "selected_project_id": "10000"
}
```

HTTP 400 response:
```json
{
    "error": "Missing external_id"
}
```

HTTP 401 response:
```json
{
    "error": "Invalid secret key"
}
```

HTTP 403 response:
```json
{
    "error": "Connection is invalid or expired. Please reauthorize the connection.",
    "needs_reauthorization": true
}
```

HTTP 500 response:
```json
{
    "error": "Failed to fetch Jira projects"
}
```

##### Query Parameters
- (Required) external_id: The external ID you used when creating the connection
    - This is the same external_id you passed in during the OAuth flow
    - Example: If you used a project_id as the external_id, pass that same project_id here

##### Description
This endpoint retrieves all Jira projects accessible to the connected account. The endpoint handles pagination automatically and returns all projects in a single response. Each project includes detailed information such as:
- Project ID and key
- Project name and type
- Project lead information
- Project category (if set)
- Project visibility settings

Use this endpoint to:
- List all available Jira projects for a connection
- Get detailed project information for project selection
- Verify project access and permissions

Example use case:
```typescript
// Get all Jira projects for a connection
const response = await fetch('/api/backend/jira/get-projects?external_id=project123', {
    headers: {
        'Authorization': 'Bearer {juncture_secret_key}'
    }
});

if (response.status === 403) {
    const data = await response.json();
    if (data.needs_reauthorization) {
        // Start reauthorization flow
        startReauthorizationFlow();
    }
} else if (response.ok) {
    const { projects } = await response.json();
    // Display projects for selection
    displayProjectSelection(projects);
}
```
#
</details>

#### `POST /api/backend/jira/select-project`
<details>

##### Required Scopes
- `read:jira-work`

##### Returns
HTTP 200 response:
```json
{
    "success": true
}
```

HTTP 400 response:
```json
{
    "error": "Missing external_id or jira_project_id"
}
```

HTTP 401 response:
```json
{
    "error": "Invalid secret key"
}
```

##### Request Body
```json
{
    "external_id": "project123",
    "jira_project_id": "10000"
}
```

##### Description
This endpoint sets the selected Jira project for a connection in Juncture's database. This selection is crucial for project-based integrations, such as:
- Fetching all tickets in a specific project
- Getting project-specific metrics and statistics
- Managing project-level webhooks and notifications

The selected project ID is stored in the `jira_connection` table and is used by other Juncture endpoints that require project context. This endpoint only interacts with Juncture's database and does not make any calls to Jira's API, so it cannot fail due to Jira API issues or require reauthorization.

Use this endpoint to:
- Set the default project for a Jira connection
- Change the selected project for an existing connection
- Enable project-specific integrations

Example use case:
```typescript
// Select a Jira project for a connection
const response = await fetch('/api/backend/jira/select-project', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer {juncture_secret_key}',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        external_id: 'project123',
        jira_project_id: '10000'
    })
});

if (response.ok) {
    // Project selection successful
    showSuccessMessage();
}
```

#### `GET /api/backend/jira/get-selected-project`
##### Returns
HTTP 200 response:
```json
{
    "jira_project_id": "10000"
}
```
Note: `jira_project_id` will be `null` if no project has been selected.

HTTP 400 response:
```json
{
    "error": "Missing external_id"
}
```

HTTP 401 response:
```json
{
    "error": "Invalid secret key"
}
```

##### Query Parameters
- (Required) external_id: The external ID you used when creating the connection
    - This is the same external_id you passed in during the OAuth flow
    - Example: If you used a project_id as the external_id, pass that same project_id here

##### Description
This endpoint retrieves the currently selected Jira project ID for a connection from Juncture's database. This endpoint only interacts with Juncture's database and does not make any calls to Jira's API, so it cannot fail due to Jira API issues or require reauthorization.

Use this endpoint to:
- Check if a project has been selected for a connection
- Get the currently selected project ID for project-specific operations
- Verify project selection before making project-specific API calls

Example use case:
```typescript
// Get the selected project ID for a connection
const response = await fetch('/api/backend/jira/get-selected-project?external_id=project123', {
    headers: {
        'Authorization': 'Bearer {juncture_secret_key}'
    }
});

if (response.ok) {
    const { jira_project_id } = await response.json();
    if (jira_project_id) {
        // A project is selected, proceed with project-specific operations
        fetchProjectTickets(jira_project_id);
    } else {
        // No project selected, prompt user to select one
        showProjectSelectionPrompt();
    }
}
```
#
</details>

#### `GET /api/backend/jira/get-tickets-for-project`
<details>

##### Required Scopes
- `read:jira-work`

##### Returns
HTTP 200 response:
```json
{
    "tickets": [
        {
            "id": "10000",
            "key": "PROJ-1",
            "summary": "Example Ticket",
            "status": "To Do",
            "assignee": "John Doe",
            "priority": "Medium",
            "created": "2024-01-01T00:00:00.000Z",
            "updated": "2024-01-01T00:00:00.000Z"
        }
    ],
    "total": 1,
    "sprint": {
        "id": 10000,
        "name": "Sprint 1",
        "state": "active",
        "startDate": "2024-01-01T00:00:00.000Z",
        "endDate": "2024-01-14T00:00:00.000Z",
        "goal": "Complete initial features"
    }
}
```

HTTP 400 response:
```json
{
    "error": "Missing external_id"
}
```
or
```json
{
    "error": "No project selected and no project ID provided"
}
```

HTTP 401 response:
```json
{
    "error": "Invalid secret key"
}
```

HTTP 403 response:
```json
{
    "error": "Connection is invalid or expired. Please reauthorize the connection.",
    "needs_reauthorization": true
}
```

HTTP 500 response:
```json
{
    "error": "Failed to fetch Jira tickets"
}
```

##### Query Parameters
- (Required) external_id: The external ID you used when creating the connection
    - This is the same external_id you passed in during the OAuth flow
    - Example: If you used a project_id as the external_id, pass that same project_id here
- (Optional) jira_project_id: The ID of the Jira project to get tickets for
    - If not provided, uses the currently selected project from the connection
    - If no project is selected and no project ID is provided, returns a 400 error

##### Description
This endpoint retrieves all Jira tickets for a specific project. The endpoint handles pagination automatically and returns all tickets in a single response. Each ticket includes detailed information such as:
- Ticket ID and key
- Summary and description
- Status information
- Assignee and reporter details
- Creation and update timestamps
- Priority information

Use this endpoint to:
- List all tickets in a project
- Get detailed ticket information
- Track ticket status and progress
- Monitor ticket assignments and updates

Example use case:
```typescript
// Get all tickets for a project
const response = await fetch('/api/backend/jira/get-tickets-for-project?external_id=project123&jira_project_id=10000', {
    headers: {
        'Authorization': 'Bearer {juncture_secret_key}'
    }
});

if (response.status === 403) {
    const data = await response.json();
    if (data.needs_reauthorization) {
        // Start reauthorization flow
        startReauthorizationFlow();
    }
} else if (response.ok) {
    const { tickets } = await response.json();
    // Display tickets
    displayTickets(tickets);
}
```
#
</details>

#### `GET /api/backend/jira/get-boards-for-project`
<details>

##### Required Scopes
- `read:board-scope:jira-software`
- `read:project:jira`

##### Returns
HTTP 200 response:
```json
{
    "boards": [
        {
            "id": 10000,
            "name": "Example Board",
            "type": "scrum"
        },
        {
            "id": 10001,
            "name": "Example Kanban Board",
            "type": "kanban"
        }
    ],
    "total": 2
}
```

HTTP 400 response:
```json
{
    "error": "Missing external_id"
}
```
or
```json
{
    "error": "No project selected and no project ID provided"
}
```

HTTP 401 response:
```json
{
    "error": "Invalid secret key"
}
```

HTTP 403 response:
```json
{
    "error": "Connection is invalid or expired. Please reauthorize the connection.",
    "needs_reauthorization": true
}
```

HTTP 404 response:
```json
{
    "error": "No agile boards found for this project"
}
```

HTTP 500 response:
```json
{
    "error": "Failed to fetch Jira boards"
}
```

##### Query Parameters
- (Required) external_id: The external ID you used when creating the connection
    - This is the same external_id you passed in during the OAuth flow
    - Example: If you used a project_id as the external_id, pass that same project_id here
- (Optional) jira_project_id: The ID of the Jira project to get boards for
    - If not provided, uses the currently selected project from the connection
    - If no project is selected and no project ID is provided, returns a 400 error

##### Description
This endpoint retrieves all agile boards associated with a Jira project. A project can have multiple boards of different types (e.g., scrum, kanban). The board information includes:
- Board ID and name
- Board type (scrum, kanban, etc.)

Use this endpoint to:
- List all boards in a project
- Get board details for sprint planning
- Verify board access and permissions

Example use case:
```typescript
// Get all boards for a project
const response = await fetch('/api/backend/jira/get-boards-for-project?external_id=project123&jira_project_id=10000', {
    headers: {
        'Authorization': 'Bearer {juncture_secret_key}'
    }
});

if (response.status === 403) {
    const data = await response.json();
    if (data.needs_reauthorization) {
        // Start reauthorization flow
        startReauthorizationFlow();
    }
} else if (response.ok) {
    const { boards } = await response.json();
    // Display boards
    displayBoards(boards);
}
```

#### `GET /api/backend/jira/get-all-sprints-for-project`
##### Required Scopes
- `read:board-scope:jira-software`
- `read:project:jira`
- `read:sprint:jira-software`

##### Returns
HTTP 200 response:
```json
{
    "boards": [
        {
            "board_id": 10000,
            "board_name": "Example Board",
            "board_type": "scrum",
            "sprints": [
                {
                    "id": 10000,
                    "name": "Sprint 1",
                    "state": "active",
                    "startDate": "2024-01-01T00:00:00.000Z",
                    "endDate": "2024-01-14T00:00:00.000Z",
                    "goal": "Complete initial features"
                }
            ],
            "active_sprints": [
                {
                    "id": 10000,
                    "name": "Sprint 1",
                    "state": "active",
                    "startDate": "2024-01-01T00:00:00.000Z",
                    "endDate": "2024-01-14T00:00:00.000Z",
                    "goal": "Complete initial features"
                }
            ]
        }
    ],
    "total_sprints": 1
}
```

HTTP 400 response:
```json
{
    "error": "Missing external_id"
}
```
or
```json
{
    "error": "No project selected and no project ID provided"
}
```

HTTP 401 response:
```json
{
    "error": "Invalid secret key"
}
```

HTTP 403 response:
```json
{
    "error": "Connection is invalid or expired. Please reauthorize the connection.",
    "needs_reauthorization": true
}
```

HTTP 404 response:
```json
{
    "error": "No agile boards found for this project"
}
```

HTTP 500 response:
```json
{
    "error": "Failed to fetch Jira sprints"
}
```

##### Query Parameters
- (Required) external_id: The external ID you used when creating the connection
    - This is the same external_id you passed in during the OAuth flow
    - Example: If you used a project_id as the external_id, pass that same project_id here
- (Optional) jira_project_id: The ID of the Jira project to get sprints for
    - If not provided, uses the currently selected project from the connection
    - If no project is selected and no project ID is provided, returns a 400 error

##### Description
This endpoint retrieves all sprints for all boards in a specific project. A project can have multiple boards (e.g., one scrum board and one kanban board), and each board can have its own set of sprints. The response includes:
- A list of boards, each containing:
  - Board ID, name, and type
  - All sprints for that board (future, active, and closed)
  - The currently active sprints for that board (if any)
- Total count of all sprints across all boards

Use this endpoint to:
- List all sprints across all boards in a project
- Get detailed sprint information for each board
- Track sprint status and timelines
- Monitor sprint progress across different boards

Example use case:
```typescript
// Get all sprints for all boards in a project
const response = await fetch('/api/backend/jira/get-all-sprints-for-project?external_id=project123&jira_project_id=10000', {
    headers: {
        'Authorization': 'Bearer {juncture_secret_key}'
    }
});

if (response.status === 403) {
    const data = await response.json();
    if (data.needs_reauthorization) {
        // Start reauthorization flow
        startReauthorizationFlow();
    }
} else if (response.ok) {
    const { boards } = await response.json();
    // Display sprints grouped by board
    boards.forEach(board => {
        displayBoardSprints(board);
    });
}
```
#
</details>

#### `GET /api/backend/jira/get-active-sprints-for-project`
<details>

##### Required Scopes
- `read:board-scope:jira-software`
- `read:project:jira`
- `read:sprint:jira-software`

##### Returns
HTTP 200 response:
```json
{
    "boards": [
        {
            "board_id": 10000,
            "board_name": "Example Board",
            "board_type": "scrum",
            "active_sprints": [
                {
                    "id": 10000,
                    "name": "Sprint 1",
                    "state": "active",
                    "startDate": "2024-01-01T00:00:00.000Z",
                    "endDate": "2024-01-14T00:00:00.000Z",
                    "goal": "Complete initial features"
                }
            ]
        }
    ]
}
```

HTTP 400 response:
```json
{
    "error": "Missing external_id"
}
```
or
```json
{
    "error": "No project selected and no project ID provided"
}
```

HTTP 401 response:
```json
{
    "error": "Invalid secret key"
}
```

HTTP 403 response:
```json
{
    "error": "Connection is invalid or expired. Please reauthorize the connection.",
    "needs_reauthorization": true
}
```

HTTP 404 response:
```json
{
    "error": "No agile boards found for this project"
}
```

HTTP 500 response:
```json
{
    "error": "Failed to fetch active Jira sprints"
}
```

##### Query Parameters
- (Required) external_id: The external ID you used when creating the connection
    - This is the same external_id you passed in during the OAuth flow
    - Example: If you used a project_id as the external_id, pass that same project_id here
- (Optional) jira_project_id: The ID of the Jira project to get active sprints for
    - If not provided, uses the currently selected project from the connection
    - If no project is selected and no project ID is provided, returns a 400 error

##### Description
This endpoint retrieves only the active sprints for all boards in a specific project. A project can have multiple boards (e.g., one scrum board and one kanban board), and each board can have multiple active sprints. The response includes:
- A list of boards, each containing:
  - Board ID, name, and type
  - An array of currently active sprints for that board (if any)

Use this endpoint to:
- Get information about all active sprints across all boards
- Display active sprint details for each board
- Track current sprint progress
- Monitor sprint timelines

Example use case:
```typescript
// Get active sprints for all boards in a project
const response = await fetch('/api/backend/jira/get-active-sprints-for-project?external_id=project123&jira_project_id=10000', {
    headers: {
        'Authorization': 'Bearer {juncture_secret_key}'
    }
});

if (response.status === 403) {
    const data = await response.json();
    if (data.needs_reauthorization) {
        // Start reauthorization flow
        startReauthorizationFlow();
    }
} else if (response.ok) {
    const { boards } = await response.json();
    // Display active sprints for each board
    boards.forEach(board => {
        if (board.active_sprints.length > 0) {
            displayActiveSprints(board);
        }
    });
}
```
#
</details>


#### `GET /api/backend/jira/get-tickets-for-sprint`
<details>

##### Required Scopes
- `read:sprint:jira-software`
- `read:issue-details:jira`
- `read:jql:jira`

##### Returns
HTTP 200 response:
```json
{
    "tickets": [
        {
            "id": "10000",
            "key": "PROJ-1",
            "fields": {
                "summary": "Example Ticket",
                "description": "This is an example ticket",
                "status": {
                    "id": "10000",
                    "name": "To Do",
                    "statusCategory": {
                        "id": 2,
                        "key": "new",
                        "colorName": "blue-gray"
                    }
                },
                "assignee": {
                    "accountId": "5b10a2844c20165700ede21g",
                    "displayName": "John Doe"
                },
                "reporter": {
                    "accountId": "5b10a2844c20165700ede21g",
                    "displayName": "John Doe"
                },
                "created": "2024-01-01T00:00:00.000Z",
                "updated": "2024-01-01T00:00:00.000Z",
                "priority": {
                    "id": "3",
                    "name": "Medium"
                }
            }
        }
    ],
    "total": 1,
    "sprint": {
        "id": 10000,
        "name": "Sprint 1",
        "state": "active",
        "startDate": "2024-01-01T00:00:00.000Z",
        "endDate": "2024-01-14T00:00:00.000Z",
        "completeDate": null,
        "goal": "Complete initial features"
    }
}
```

HTTP 400 response:
```json
{
    "error": "Missing external_id"
}
```
or
```json
{
    "error": "Missing sprint_id"
}
```

HTTP 401 response:
```json
{
    "error": "Invalid secret key"
}
```

HTTP 403 response:
```json
{
    "error": "Connection is invalid or expired. Please reauthorize the connection.",
    "needs_reauthorization": true
}
```

HTTP 404 response:
```json
{
    "error": "Sprint not found"
}
```

HTTP 500 response:
```json
{
    "error": "Failed to fetch Jira tickets for sprint"
}
```

##### Query Parameters
- (Required) external_id: The external ID you used when creating the connection
    - This is the same external_id you passed in during the OAuth flow
    - Example: If you used a project_id as the external_id, pass that same project_id here
- (Required) sprint_id: The ID of the sprint to get tickets for
    - This is the sprint ID returned from the sprint endpoints
    - Example: 10000

##### Description
This endpoint retrieves all tickets for a specific sprint. The endpoint handles pagination automatically and returns all tickets in a single response. Each ticket includes detailed information such as:
- Ticket ID and key
- Summary and description
- Status information
- Assignee and reporter details
- Creation and update timestamps
- Priority information

The response also includes sprint details:
- Sprint ID, name, and state (future, active, or closed)
- Start and end dates
- Completion date (if closed)
- Sprint goal

Use this endpoint to:
- List all tickets in a specific sprint
- Get detailed ticket information for sprint planning
- Track sprint progress and ticket status
- Monitor sprint completion and goals

Example use case:
```typescript
// Get all tickets for a specific sprint
const response = await fetch('/api/backend/jira/get-tickets-for-sprint?external_id=project123&sprint_id=10000', {
    headers: {
        'Authorization': 'Bearer {juncture_secret_key}'
    }
});

if (response.status === 403) {
    const data = await response.json();
    if (data.needs_reauthorization) {
        // Start reauthorization flow
        startReauthorizationFlow();
    }
} else if (response.ok) {
    const { tickets, sprint } = await response.json();
    // Display tickets and sprint information
    displaySprintTickets(tickets, sprint);
}
```
#
</details>

#### `GET /api/backend/jira/get-issue-details`
<details>

##### Required Scopes
- `read:jira-work`

##### Returns
HTTP 200 response:
```json
{
    "issue": {
        "id": "10000",
        "key": "PROJ-123",
        "summary": "Fix critical bug in login system",
        "description": "Users are unable to log in when using SSO authentication",
        "status": {
            "name": "In Progress",
            "category": "indeterminate"
        },
        "priority": {
            "name": "High",
            "iconUrl": "https://your-domain.atlassian.net/images/icons/priorities/high.svg"
        },
        "issueType": {
            "name": "Bug",
            "iconUrl": "https://your-domain.atlassian.net/images/icons/issuetypes/bug.svg"
        },
        "assignee": {
            "displayName": "John Doe",
            "emailAddress": "john.doe@example.com",
            "avatarUrl": "https://avatar-management--avatars.server-location.prod.public.atl-paas.net/initials/JD-5.png?size=48&s=48"
        },
        "reporter": {
            "displayName": "Jane Smith",
            "emailAddress": "jane.smith@example.com",
            "avatarUrl": "https://avatar-management--avatars.server-location.prod.public.atl-paas.net/initials/JS-5.png?size=48&s=48"
        },
        "project": {
            "id": "10000",
            "key": "PROJ",
            "name": "Example Project"
        },
        "created": "2024-01-01T10:00:00.000Z",
        "updated": "2024-01-02T15:30:00.000Z",
        "resolution": {
            "name": "Fixed",
            "description": "A resolution was provided and the issue is now being resolved."
        },
        "labels": ["bug", "critical", "authentication"],
        "components": ["Frontend", "Authentication"],
        "fixVersions": ["v2.1.0"],
        "affectedVersions": ["v2.0.0"],
        "timeTracking": {
            "originalEstimate": "4h",
            "remainingEstimate": "1h",
            "timeSpent": "3h"
        },
        "customFields": {
            "customfield_10001": "High",
            "customfield_10002": "Security"
        }
    }
}
```

HTTP 400 response:
```json
{
    "error": "Missing external_id"
}
```
or
```json
{
    "error": "Missing issue_id_or_key"
}
```

HTTP 401 response:
```json
{
    "error": "Invalid secret key"
}
```

HTTP 403 response:
```json
{
    "error": "Connection is invalid or expired. Please reauthorize the connection.",
    "needs_reauthorization": true
}
```

HTTP 404 response:
```json
{
    "error": "Issue not found"
}
```

HTTP 500 response:
```json
{
    "error": "Failed to fetch Jira issue"
}
```

##### Query Parameters
- (Required) external_id: The external ID you used when creating the connection
    - This is the same external_id you passed in during the OAuth flow
    - Example: If you used a project_id as the external_id, pass that same project_id here
- (Required) issue_id_or_key: The key of the Jira issue to get details for
    - This is the issue key (e.g., "PROJ-123", "BUG-456")
    - You can also pass in the issue ID instead (e.g., "10000", "10004")
    - Example: "PROJ-123", "10033"

##### Description
This endpoint retrieves detailed information for a specific Jira issue. Unlike the ticket list endpoints, this provides comprehensive information about a single issue including:

**Core Information:**
- Issue ID, key, summary, and description
- Status with category (new, indeterminate, done)
- Priority and issue type with icons
- Project information

**People:**
- Assignee and reporter details with email addresses and avatars
- Contact information for notifications and workflows

**Metadata:**
- Creation and update timestamps
- Resolution details (if resolved)
- Labels, components, and version information
- Time tracking data (estimates and time spent)

**Custom Fields:**
- Any custom fields configured for the issue
- Useful for integrations that need specific business data

**Use Cases:**
- Display detailed issue information in dashboards
- Create issue detail views
- Build notification systems
- Generate reports with comprehensive issue data
- Integrate with project management tools

Example use case:
```typescript
// Get detailed information for a specific issue
const response = await fetch('/api/backend/jira/get-issue?external_id=project123&issue_key=PROJ-123', {
    headers: {
        'Authorization': 'Bearer {juncture_secret_key}'
    }
});

if (response.status === 403) {
    const data = await response.json();
    if (data.needs_reauthorization) {
        // Start reauthorization flow
        startReauthorizationFlow();
    }
} else if (response.ok) {
    const { issue } = await response.json();
    // Display detailed issue information
    displayIssueDetails(issue);
    
    // Use specific fields for integrations
    if (issue.assignee) {
        sendNotification(issue.assignee.emailAddress, issue.summary);
    }
    
    if (issue.timeTracking) {
        updateTimeTracking(issue.key, issue.timeTracking);
    }
}
```
#
</details>

#### `PUT /api/backend/jira/edit-issue`
<details>

##### Required Scopes
- `write:jira-work`

##### Returns
HTTP 200 response:
```json
{
    "success": true,
    "issue": {
        "id": "10000",
        "key": "PROJ-123",
        "summary": "Updated issue summary",
        "description": "Updated issue description",
        "priority": {
            "name": "High",
            "iconUrl": "https://your-domain.atlassian.net/images/icons/priorities/high.svg"
        },
        "issueType": {
            "name": "Bug",
            "iconUrl": "https://your-domain.atlassian.net/images/icons/issuetypes/bug.svg"
        },
        "assignee": {
            "displayName": "John Doe",
            "emailAddress": "john.doe@example.com",
            "avatarUrl": "https://avatar-management--avatars.server-location.prod.public.atl-paas.net/initials/JD-5.png?size=48&s=48"
        },
        "updated": "2024-01-02T16:45:00.000Z"
    }
}
```

HTTP 400 response:
```json
{
    "error": "Missing external_id"
}
```
or
```json
{
    "error": "Missing issue_id_or_key"
}
```
or
```json
{
    "error": "At least one field must be provided for update"
}
```
or
```json
{
    "error": "Invalid field values provided"
}
```

HTTP 401 response:
```json
{
    "error": "Invalid secret key"
}
```

HTTP 403 response:
```json
{
    "error": "Connection is invalid or expired. Please reauthorize the connection.",
    "needs_reauthorization": true
}
```
HTTP 404 response:
```json
{
    "error": "Issue not found"
}
```

HTTP 409 response:
```json
{
    "error": "Issue has been modified since last read"
}
```

HTTP 500 response:
```json
{
    "error": "Failed to update Jira issue"
}
```

##### Request Body
```json
{
    "external_id": "project123",
    "issue_id_or_key": "PROJ-123",
    "summary": "Updated issue summary",
    "description": "Updated issue description",
    "priority_id": "3",
    "issue_type_id": "10001",
    "assignee_account_id": "5b10a2844c20165700ede21g"
}
```

##### Request Body Parameters
- (Required) external_id: The external ID you used when creating the connection
    - This is the same external_id you passed in during the OAuth flow
    - Example: If you used a project_id as the external_id, pass that same project_id here
- (Required) issue_id_or_key: The ID or key of the Jira issue to edit
    - This is the issue key (e.g., "PROJ-123") or issue ID (e.g., "10000")
    - Example: "PROJ-123", "10033"
- (Optional) summary: New summary/title for the issue
    - Example: "Fix critical bug in login system"
- (Optional) description: New description for the issue
    - Example: "Users are unable to log in when using SSO authentication"
- (Optional) priority_id: New priority ID for the issue
    - Common values: "1" (Highest), "2" (High), "3" (Medium), "4" (Low), "5" (Lowest)
    - Example: "3"
- (Optional) issue_type_id: New issue type ID for the issue
    - Common values: "10001" (Bug), "10002" (Task), "10003" (Story), "10004" (Epic)
    - Example: "10001"
- (Optional) assignee_account_id: New assignee account ID
    - Use the account ID of the user to assign
    - Use "null" to unassign the issue
    - Example: "5b10a2844c20165700ede21g" or "null"

##### Description
This endpoint allows you to edit a Jira issue by updating one or more fields. You can update the summary, description, priority, issue type, and assignee. At least one field must be provided for the update to succeed.

**Supported Fields:**
- **Summary**: The title/name of the issue
- **Description**: The detailed description of the issue
- **Priority**: The priority level (Highest, High, Medium, Low, Lowest)
- **Issue Type**: The type of issue (Bug, Task, Story, Epic, etc.)
- **Assignee**: The user assigned to work on the issue

**Use Cases:**
- Update issue details from external systems
- Reassign issues to different team members
- Change issue priorities based on business rules
- Modify issue types as requirements change
- Update descriptions with additional context

**Examples:**

1. **Update Summary Only:**
```json
{
    "external_id": "project123",
    "issue_id_or_key": "PROJ-123",
    "summary": "Updated issue title"
}
```

2. **Change Priority and Assignee:**
```json
{
    "external_id": "project123",
    "issue_id_or_key": "PROJ-123",
    "priority_id": "2",
    "assignee_account_id": "5b10a2844c20165700ede21g"
}
```

3. **Unassign an Issue:**
```json
{
    "external_id": "project123",
    "issue_id_or_key": "PROJ-123",
    "assignee_account_id": "null"
}
```

4. **Update Multiple Fields:**
```json
{
    "external_id": "project123",
    "issue_id_or_key": "PROJ-123",
    "summary": "Critical bug fix needed",
    "description": "This is a critical issue that needs immediate attention",
    "priority_id": "1",
    "issue_type_id": "10001"
}
```

Example use case:
```typescript
// Update issue priority and assignee
const response = await fetch('/api/backend/jira/edit-issue', {
    method: 'PUT',
    headers: {
        'Authorization': 'Bearer {juncture_secret_key}',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        external_id: 'project123',
        issue_id_or_key: 'PROJ-123',
        priority_id: '2',
        assignee_account_id: '5b10a2844c20165700ede21g'
    })
});

if (response.status === 403) {
    const data = await response.json();
    if (data.needs_reauthorization) {
        // Start reauthorization flow
        startReauthorizationFlow();
    }
} else if (response.ok) {
    const { issue } = await response.json();
    // Issue updated successfully
    console.log(`Issue ${issue.key} updated at ${issue.updated}`);
}
```
#
</details>

#### `POST /api/backend/jira/create-ticket`
<details>

##### Required Scopes
- `write:jira-work`

##### Body
- (Required) external_id: The external ID you used when creating the connection
- (Optional) jira_project_id: The Jira project ID to create the ticket in (if not provided, uses the selected project)
- (Required) summary: The summary/title of the ticket
- (Optional) description: The description of the ticket
- (Required) issue_type_id: The Jira issue type ID (e.g., Task, Bug, Story)
- (Optional) priority_id: The Jira priority ID
- (Optional) assignee_account_id: The Jira account ID of the assignee

Example body:
```json
{
  "external_id": "project123",
  "jira_project_id": "10000",
  "summary": "New ticket from API",
  "description": "This ticket was created via the Juncture API.",
  "issue_type_id": "10001",
  "priority_id": "3",
  "assignee_account_id": "5b10a2844c20165700ede21g"
}
```

##### Returns
HTTP 201 response:
```json
{
  "ticket": {
    "id": "10001",
    "key": "PROJ-2",
    "summary": "New ticket from API",
    "status": "To Do",
    "assignee": "John Doe",
    "priority": "Medium",
    "created": "2024-01-01T00:00:00.000Z",
    "updated": "2024-01-01T00:00:00.000Z"
  }
}
```

HTTP 400 response:
```json
{ "error": "Missing required fields: external_id, summary, or issue_type_id" }
```
Or
```json
{ "error": "Invalid field values or missing required fields for Jira issue creation" }
```
Or
```json
{ "error": "No project selected and no project ID provided" }
```

HTTP 401 response:
```json
{ "error": "Invalid secret key" }
```

HTTP 403 response:
```json
{ "error": "Access denied to create issue" }
```
Or
```json
{ "error": "Connection is invalid or expired. Please reauthorize the connection.", "needs_reauthorization": true }
```

HTTP 404 response:
```json
{ "error": "Project or issue type not found" }
```

HTTP 500 response:
```json
{ "error": "Failed to create Jira ticket" }
```

##### Description
This endpoint creates a new Jira ticket (issue) in the specified or selected project. You must provide the summary and issue type ID. Optionally, you can set the description, priority, and assignee. The endpoint returns the created ticket's key, id, summary, status, assignee, priority, created, and updated fields.

Example use case:
```typescript
const response = await fetch('/api/backend/jira/create-ticket', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer {juncture_secret_key}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    external_id: 'project123',
    jira_project_id: '10000',
    summary: 'New ticket from API',
    description: 'This ticket was created via the Juncture API.',
    issue_type_id: '10001',
    priority_id: '3',
    assignee_account_id: '5b10a2844c20165700ede21g'
  })
});
if (response.status === 201) {
  const { ticket } = await response.json();
  // Use the created ticket
}
```
#
</details>


# Database Schema
**connection(<u>connection_id</u>, refresh_token, invalid_refresh_token, expires_at, created_at, last_updated)**
- invalid_refresh_token is a boolean that marks whether or not a refresh_token has been invalidated (perhaps it was revoked, or expired). Specifically, if a request to refresh an access token fails with a request 403 from Jira (or the provider that is being used), then we mark this refresh token as invalid, which forces users to have to reauthenticate.
- expires_at is the maximum lifetime of this refresh_token/connection. Jira refresh_tokens have a maximum lifetime of 365 days. 

**connection_external_map(<u>external_id, provider</u>, connection_id[FK1])**
- FK1: connection_id &#8594; connection(connection_id)
- This table is only used in the open source Juncture core, meaning that you are not using Juncture-Cloud. 
- In Juncture-Core, external IDs (i.e., project id, organization id, user id) + provider have a 1 to 1 mapping with connections. 
- Any integration specific actions, such as getting all jira tickets, rely on you supplying the external ID for a connection.
- In Juncture-Cloud, a different table is used that is stored in Juncture-Cloud's database, which is a mapping of (external_id, provider, juncture_cloud_project_id) to connection_id. This is because in Juncture cloud, there are different projects that users create, so external_ids are only unique PER project_id.

**jira_connection(<u>connection_id[FK2]</u>, selected_jira_project_id, jira_site_id, created_at, last_updated)**
- FK2: connection_id &#8594; connection(connection_id)
- The table is used to store provider specific information about integrations. When you create a new Jira connection, common bookkeeping info is stored in `connection`, and Jira specific integration information is stored in `jira_connection`. This is to support adding additional integrations in the future.
- (Optional) selected_jira_project_id: a common integration use case is to associate a Jira connection with a Jira project. For example, you might only want to getAllTicketsInProject, so this column in the table makes such methods easier.
- jira_site_id: see more details above, used to determine which site this connection actually refers to.

#
# Adding a New Provider Connection

To add support for a new provider (e.g., GitHub, Slack, etc.), you'll need to modify several files and implement provider-specific logic. Here's a step-by-step guide:

### 1. Update Database Schema
In `server/src/db/schema.ts`:
1. Add the new provider to the provider enum:
```typescript
export const providerEnum = junctureCoreSchema.enum("provider", ["jira", "new_provider"]);
export type providerEnumType = "jira" | "new_provider";
```

2. Create a new table for provider-specific data (similar to `jira_connection`):
```typescript
export const newProviderConnection = junctureCoreSchema.table('new_provider_connection', {
  connectionId: uuid('connection_id').primaryKey().references(() => connection.connectionId, { onDelete: 'cascade' }),
  // Add provider-specific fields here
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  lastUpdated: timestamp('last_updated', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
});
```
### 2. Create Provider-Specific Helper Functions
Create a new file `server/src/utils/integration_helpers/new_provider.ts`:
```typescript
import redis from "../redis";
import { getDb } from "../../db";
import { newProviderConnection } from "../../db/schema";
import { eq } from "drizzle-orm";

const NEW_PROVIDER_CONNECTION_DETAILS_CACHE_PREFIX = 'new_provider_connection_details';

export function getNewProviderConnectionDetailsCacheKey(connectionId: string) {
    return `${NEW_PROVIDER_CONNECTION_DETAILS_CACHE_PREFIX}:${connectionId}`;
}

export type NewProviderConnectionDetailsResponse = {
    // Add provider-specific response type
} | {
    error: string;
}

export async function getNewProviderConnectionDetails(connectionId: string): Promise<NewProviderConnectionDetailsResponse> {
    // Implement provider-specific connection details retrieval
}

export async function updateNewProviderConnectionDetails(connectionId: string, /* provider-specific params */): Promise<{ error: string } | { success: true }> {
    // Implement provider-specific connection details update
}
```

### 3. Update OAuth Helpers
In `server/src/utils/oauth_helpers.ts`:
1. Add provider-specific OAuth credentials handling:
```typescript
if (provider === 'new_provider') {
    client_id = process.env.DEFAULT_NEW_PROVIDER_CLIENT_ID!;
    scopes = process.env.DEFAULT_NEW_PROVIDER_SCOPES!.split(',');
    client_secret = process.env.DEFAULT_NEW_PROVIDER_CLIENT_SECRET!;
    site_redirect_uri = process.env.DEFAULT_NEW_PROVIDER_SITE_REDIRECT_URI || '';
}
```

### 4. Update Token Management
In `server/src/utils/credential_helpers.ts`:
1. Add provider-specific token refresh logic in `getNewAccessTokenFromConnection`:
```typescript
if (provider === 'new_provider') {
    try {
        response = await axios.post('https://new-provider.com/oauth/token', {
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: client_id,
            client_secret: client_secret
        });
    } catch (error: any) {
        // Handle provider-specific error cases
    }
}
```

### 5. Create Provider-Specific Routes
Create a new file `server/src/routes/backend/new_provider.route.ts`:
```typescript
import { Router } from 'express';

export default function createNewProviderConnectionRouter() {
    const router = Router();
    // Add provider-specific routes
    return router;
}
```
### 6. Update Environment Variables
Add the following to your `.env` file:
```env
DEFAULT_NEW_PROVIDER_CLIENT_ID=your_client_id
DEFAULT_NEW_PROVIDER_CLIENT_SECRET=your_client_secret
DEFAULT_NEW_PROVIDER_SCOPES=scope1,scope2
DEFAULT_NEW_PROVIDER_SITE_REDIRECT_URI=your_redirect_uri
```

### 7. Create Database Migration
Run the following command to generate a new migration:
```bash
npm run drizzle-kit generate:pg
```

This will create a new migration file in `server/drizzle/` that includes your schema changes.

### Important Notes:
1. All provider-specific data should be stored in a separate table (like `jira_connection`)
2. Use the `ExtendTransaction` pattern when creating connections to ensure atomic operations
3. Implement proper error handling for provider-specific API responses
4. Add appropriate caching mechanisms for provider-specific data
5. Update the documentation to include the new provider's endpoints and requirements

### Example Provider-Specific Implementation:
For a complete example, look at how Jira is implemented:
- `server/src/utils/integration_helpers/jira.ts` for provider-specific helpers
- `server/src/db/schema.ts` for the database schema
- `server/src/utils/credential_helpers.ts` for token management
- `server/src/routes/backend/jira.route.ts` for provider-specific routes

## Backend Controller Structure (Jira)

Jira-related backend endpoints are now organized in a modular folder:
- `jira.controller/`: Folder containing all Jira controller logic.
  - `index.ts`: Central export file for all Jira endpoints. This is the main entrypoint for route imports.
  - `projects.ts`: Contains all project-related endpoint handlers and types.
  - `tickets.ts`: Contains all ticket/issue-related endpoint handlers and types.
  - `sprints.ts`: Contains all sprint-related endpoint handlers and types.
  - `boards.ts`: Contains all board-related endpoint handlers and types.

This structure makes it easier to maintain and extend Jira integration logic.


