import { providerEnumType } from '../db/schema';
import { isCloudModeEnabled } from './CloudContextManager';
import { useCloudContextManager } from './CloudContextManager';


export type GetOAuthCredentialsResponse = {
    client_id: string;
    client_secret: string;
    scopes: string[];
    site_redirect_uri: string;
    juncture_project_id?: string;
} | {
    error: string;
}

export type GetOAuthCredentialsOptions = {
    juncture_public_key: string;
} | {
    projectId: string;
}

export async function getOAuthCredentials(provider: providerEnumType, options?: GetOAuthCredentialsOptions): Promise<GetOAuthCredentialsResponse> {
    let client_id: string;
    let client_secret: string;
    let scopes: string[];
    let site_redirect_uri: string;
    let juncture_project_id: string | undefined = undefined;

    // Only relevant for Juncture-Cloud, not for OSS
    if (isCloudModeEnabled()) {
        if (!options) {
            return { error: 'Please provide a juncture public key' };
        }
        const cloudContextManager = useCloudContextManager();
        const credentials = await cloudContextManager.getOAuthCredentials(provider, options);
        if (!credentials) {
            return { error: 'Invalid juncture public key' };
        }
        client_id = credentials.clientID;
        scopes = credentials.scopes;
        juncture_project_id = credentials.junctureProjectID;
        client_secret = credentials.clientSecret;
        site_redirect_uri = credentials.siteRedirectURI;
    } else {
        // For OSS, provide own credentials in .env file
        if (provider === 'jira') {
            client_id = process.env.DEFAULT_JIRA_CLIENT_ID!;
            scopes = process.env.DEFAULT_JIRA_SCOPES!.split(',');
            client_secret = process.env.DEFAULT_JIRA_CLIENT_SECRET!;
            site_redirect_uri = process.env.DEFAULT_JIRA_SITE_REDIRECT_URI || '';
        } else {
            return { error: 'Invalid provider' };
        }
    }

    return {
        client_id,
        client_secret,
        scopes,
        site_redirect_uri,
        juncture_project_id
    }
}
