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
##### Returns
HTTP Response 200 if successful:
```
{
    "authorization_uri": "URI HERE"
}
```
##### Headers
- (Optional) x-juncture-public-key: 'Bearer {juncture_public_key}'
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
#### `GET /api/frontend/oauth/authorization-callback/:provider`
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

### Connection Finalization

#### `GET /api/frontend/finalize-connection/jira/fetch-available-sites`
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

#### `POST /api/frontend/finalize-connection/jira/create-connection`
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

## Backend API

### General Connection Management/Details

#### `GET /api/backend/connection-info/check-connection-validity`
##### Returns

##### Headers

##### Query Params

##### Description




#

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