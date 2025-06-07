import redis from "../redis";
import {getDb} from "../../db";
import { jiraConnection } from "../../db/schema";
import { eq } from "drizzle-orm";


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
    error?: string;
}

// export async function createJiraConnectionDetails(connectionId: string, siteId: string, selectedProjectId?: string | null): Promise<CreateJiraConnectionDetailsResponse>  {
//     const drizzle = getDb();
    
//     const connection = await drizzle.insert(jiraConnection).values({
//         connectionId,
//         jiraSiteId: siteId,
//         selectedJiraProjectId: selectedProjectId ?? null
//     }).returning();
    
//     if (connection.length === 0) {
//         return {
//             error: 'Failed to create connection details. Please try again later.'
//         };
//     }

//     // no need to await
//     redis.set(getJiraConnectionDetailsCacheKey(connectionId), {
//         siteId,
//         selectedProjectId: selectedProjectId ?? null
//     });
    
//     return {
//         error: undefined
//     };
// }

export async function updateJiraConnectionDetails(connectionId: string, siteId: string, selectedProjectId?: string | null): Promise<CreateJiraConnectionDetailsResponse> {
    const drizzle = getDb();

    
    const connection = await drizzle.update(jiraConnection).set({
        jiraSiteId: siteId,
        selectedJiraProjectId: selectedProjectId ?? null
    }).where(eq(jiraConnection.connectionId, connectionId)).returning();
    
    if (connection.length === 0) {
        return {
            error: 'Failed to update connection details. Please try again later.'
        };
    }

    // no need to await
    redis.set(getJiraConnectionDetailsCacheKey(connectionId), {
        siteId,
        selectedProjectId: selectedProjectId ?? null
    }, {
        ex: 24*60*60
    });
    
    return {
        error: undefined
    };
}