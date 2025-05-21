export type Credentials = {
    providerClientID: string;
    providerClientSecret: string;
    redirectURI: string;
    scopes: string[];
}

export interface CredentialStore {
    get: (provider: string, publicClientId: string) => Promise<Credentials | null>;
}
