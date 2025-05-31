import { providerEnumType } from "../db/schema";

export type OAuthCredentials = {
    junctureProjectID: string;
    clientID: string;
    clientSecret: string;
    scopes: string[];
    siteRedirectURI: string;
}


export interface CloudContextManager {
    /**
     * Used in getAuthorizationURI() to get CUSTOMER credentials from juncture-cloud
     * @param provider 
     * @param juncturePublicKey 
     * @returns NULL if credentials not found in DB, otherwise return credentials
     */
    getOAuthCredentials: (provider: providerEnumType, juncturePublicKey: string) => Promise<OAuthCredentials | null>; // returns NULL if credentials don't exist
    
    /**
     * Used when creating a new connection to link the connection_id to the (project_id, external_id, provider). Also adds to juncture-core.Connection; this is a transaction
     * @param connectionID 
     * @param externalID 
     * @param provider 
     * @param project_id 
     * @param refresh_token 
     * @param expires_at 
     * @returns TRUE if successful, FALSE if not
     */
    addConnection: (connectionID: string, externalID: string, provider: providerEnumType, project_id: string, refresh_token: string, expires_at: Date) => Promise<boolean>; 

    updateConnection: (connectionID: string, refresh_token: string, expires_at: Date) => Promise<boolean>;

    getConnectionID: (externalID: string, provider: providerEnumType) => Promise<string | null>;
    /**
     * Used to verify the juncture public key is valid
     * @param junctureSecretKey 
     * @returns NULL if invalid, otherwise returns the project_id
     */
    verifySecretKey: (junctureSecretKey: string) => Promise<string | null>;
}


let cloudContextManager: CloudContextManager | null = null;

export function setCloudContextManager(manager: CloudContextManager) {
    if (isCloudModeEnabled()) {
        cloudContextManager = manager;
    } else {
        console.warn('[Juncture-core] setCloudContextManager() called in OSS mode — ignoring.');
    }
}

export function useCloudContextManager(): CloudContextManager {
    if (!isCloudModeEnabled()) {
        throw new Error('[Juncture-core] useCloudContextManager() called outside of CLOUD_MODE.');
    }
    if (!cloudContextManager) {
        throw new Error('[Juncture-core] CLOUD_MODE is enabled but no CloudContextManager was registered.');
    }
    return cloudContextManager;
}


export function isCloudModeEnabled(): boolean {
    return process.env.CLOUD_MODE === 'true';
}