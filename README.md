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
6. Afterwards, another API request is sent to `/api/frontend/finalize-connection/jira/set-jira-site`, which will finalize the creation of the connection and add it to the database.

## Juncture's frontend site and why we have redundant site selection?