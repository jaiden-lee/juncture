import redis from "../redis";
import {getDb} from "../../db";
import { connection, jiraConnection } from "../../db/schema";
import { eq } from "drizzle-orm";
import axios from "axios";


const JIRA_CONNECTION_DETAILS_CACHE_PREFIX = 'jira_connection_details';

export function getJiraConnectionDetailsCacheKey(connectionId: string) {
    return `${JIRA_CONNECTION_DETAILS_CACHE_PREFIX}:${connectionId}`;
}

export type JiraConnectionDetailsResponse = {
    siteId: string;
    selectedProjectId?: string | null;
} | {
    error: string;
}

export async function getJiraConnectionDetails(connectionId: string): Promise<JiraConnectionDetailsResponse> {
    const drizzle = getDb();

    const cachedConnectionDetails = await redis.get(getJiraConnectionDetailsCacheKey(connectionId));
    if (cachedConnectionDetails) {
        return cachedConnectionDetails as JiraConnectionDetailsResponse;
    }
    
    const connection = await drizzle.select().from(jiraConnection).where(eq(jiraConnection.connectionId, connectionId));
    
    if (connection.length === 0) {
        return {
            error: 'Connection not found'
        };
    }
    

    const siteId = connection[0].jiraSiteId;
    const selectedProjectId = connection[0].selectedJiraProjectId;

    // no need to await
    redis.set(getJiraConnectionDetailsCacheKey(connectionId), {
        siteId,
        selectedProjectId
    }, {
        ex: 24*60*60
    });
    
    return {
        siteId,
        selectedProjectId
    };
}


export type CreateJiraConnectionDetailsResponse = {
    error: string;
} | {
    success: true;
}

// This method should only be called to update selectedProjectId
// siteId is only updated during the finalize-connection flow
export async function updateSelectedJiraProject(connectionId: string, selectedProjectId?: string | null): Promise<CreateJiraConnectionDetailsResponse> {
    const drizzle = getDb();

    
    const connection = await drizzle.update(jiraConnection).set({
        selectedJiraProjectId: selectedProjectId ?? null
    }).where(eq(jiraConnection.connectionId, connectionId)).returning();
    
    if (connection.length === 0) {
        return {
            error: 'Failed to update connection details. Please try again later.'
        };
    }

    // no need to await
    redis.set(getJiraConnectionDetailsCacheKey(connectionId), {
        siteId: connection[0].jiraSiteId,
        selectedProjectId: selectedProjectId ?? null
    }, {
        ex: 24*60*60
    });
    
    return {    
        success: true
    };
}




const JIRA_SITE_NAME_FROM_CONNECTION_ID_CACHE_PREFIX = 'jira_site_name_from_connection_id';

export function getJiraSiteNameFromConnectionIdCacheKey(connectionId: string) {
    return `${JIRA_SITE_NAME_FROM_CONNECTION_ID_CACHE_PREFIX}:${connectionId}`;
}

export type GetJiraSiteNameFromConnectionIdResponse = {
    error: string;
} | {
    siteName: string;
}

export async function getJiraSiteNameFromConnectionId(connectionId: string, accessToken: string): Promise<GetJiraSiteNameFromConnectionIdResponse> {
    const cachedSiteName = await redis.get(getJiraSiteNameFromConnectionIdCacheKey(connectionId));
    if (cachedSiteName) {
        const cachedData = JSON.parse(cachedSiteName as string);
        return {
            siteName: cachedData.siteName
        };
    }

    const connectionDetails = await getJiraConnectionDetails(connectionId);
    if ('error' in connectionDetails) {
        return connectionDetails;
    }

    const siteId = connectionDetails.siteId;

    try {
        const sitesResponse = await axios.get('https://api.atlassian.com/oauth/token/accessible-resources', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        const site = sitesResponse.data.find((site: any) => site.id === siteId);

        if (!site) {
            return {
                error: 'Failed to find Jira site with the given ID. Please try reauthorizing the connection.'
            };
        }

        const siteData = {
            siteName: site.name,
            siteId: site.id
        };

        redis.set(getJiraSiteNameFromConnectionIdCacheKey(connectionId), JSON.stringify(siteData), {
            ex: 24*60*60
        });

        return siteData;
    } catch (error) {
        return {
            error: 'Failed to get Jira site name. Please try again later.'
        };
    }
}
