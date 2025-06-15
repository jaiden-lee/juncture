import {Request, Response} from "express";
import {getConnectionDetailsFromConnectionCode} from "../../utils/integration_helpers/general";
import { getAccessTokenFromRedis } from "../../utils/credential_helpers";
import axios from "axios";
import { getJiraConnectionDetails } from "../../utils/integration_helpers/jira";
import { jiraConnection } from "../../db/schema";
import { createConnection } from "../../utils/integration_helpers/general";
import { ExtendTransaction } from "../../utils/connection_db_helpers";
import { eq } from "drizzle-orm";
import redis from "../../utils/redis";
import { getConnectionCodeCacheKey } from "../../utils/integration_helpers/general";
import { getJiraConnectionDetailsCacheKey } from "../../utils/integration_helpers/jira";

type GetJiraSitesQueryParams = {
    connection_code: string;
}

export async function fetchAvailableJiraSites(req: Request<{}, {}, {}, GetJiraSitesQueryParams>, res: Response) {
    const { connection_code } = req.query;
    
    if (!connection_code) {
        res.status(400).json({ error: 'Missing connection_code' });
        return;
    }

    const connectionDetailsResponse = await getConnectionDetailsFromConnectionCode('jira', connection_code);
    
    if ('error' in connectionDetailsResponse) {
        res.status(400).json({ error: connectionDetailsResponse.error });
        return;
    }

    const accessTokenResponse = await getAccessTokenFromRedis(connectionDetailsResponse.connection_id);
    if ('error' in accessTokenResponse) {
        res.status(400).json({ error: accessTokenResponse.error });
        return;
    }

    const { accessToken } = accessTokenResponse;

    try {
        // Call Jira API to get accessible resources (sites)
        const sitesResponse = await axios.get('https://api.atlassian.com/oauth/token/accessible-resources', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        // Transform the response to get only site_id and site_name
        const sites = sitesResponse.data.map((site: any) => ({
            site_id: site.id,
            site_name: site.name
        }));

        res.status(200).json({ sites });
        return;
    } catch (error) {
        console.error('Error fetching Jira sites:', error);
        res.status(500).json({ 
            error: 'Failed to fetch Jira sites',
            details: error instanceof Error ? error.message : String(error)
        });
        return;
    }
}


type SetJiraSiteBody = {
    connection_code: string;
    site_id: string;
}

export async function createJiraConnection(req: Request<{}, {}, SetJiraSiteBody>, res: Response) {
    const { connection_code, site_id } = req.body;
    
    if (!connection_code || !site_id) {
        res.status(400).json({ error: 'Missing connection_code or site_id' });
        return;
    }

    const connectionDetailsResponse = await getConnectionDetailsFromConnectionCode('jira', connection_code);
    if ('error' in connectionDetailsResponse) {
        res.status(400).json({ error: connectionDetailsResponse.error });
        return;
    }

    const connectionId = connectionDetailsResponse.connection_id;

    const jiraConnectionDetailsResponse = await getJiraConnectionDetails(connectionId);
    const isNewJiraConnectionDetail = 'error' in jiraConnectionDetailsResponse;
    
    // Extends the addConnectionToDB method to add a jiraConnection entry
    // Need to do this since want all to be in the same transaction, yet still want reusable functions
    // so supply a callback function that gets called inside the other transaction
    const jiraTransaction: ExtendTransaction = async (tx: any) => {
        if (isNewJiraConnectionDetail) {
            await tx.insert(jiraConnection).values({
                connectionId,
                jiraSiteId: site_id,
                selectedJiraProjectId: null,
                lastUpdated: new Date()
            });
        } else {
            // don't update project id, only update site id
    // though, project might not apply anymore
    // MIGHT NEED TO MODIFY LATER FOR FRONTEND TO SUPPORT PROJECT SELECTION
    // or a way to "evict" the selectedProject if it is wrong later
    // or maybe I can just add a function here later that checks if the project id is valid
    // either way, I would need some way to ensure it, but I don't have selected project id logic yet, so don't worry about it
            await tx.update(jiraConnection).set({
                jiraSiteId: site_id,
                lastUpdated: new Date()
            }).where(eq(jiraConnection.connectionId, connectionId)).returning();
        }
    }

    

    const result = await createConnection(
        connectionId,
        'jira',
        connectionDetailsResponse.external_id,
        connectionDetailsResponse.refresh_token,
        new Date(connectionDetailsResponse.connection_expiry_date),
        false,
        connectionDetailsResponse.juncture_project_id,
        jiraTransaction
    );

    if ('error' in result) {
        res.status(500).json({ error: result.error });
        return;
    }


    const jiraDetailsCacheBody = {
        siteId: site_id,
        selectedProjectId: "selectedProjectId" in jiraConnectionDetailsResponse ? jiraConnectionDetailsResponse.selectedProjectId : null
    };

    // no need to await
    redis.set(getJiraConnectionDetailsCacheKey(connectionId), jiraDetailsCacheBody, {
        ex: 24*60*60
    });

    // don't await, don't care about failure
    redis.del(getConnectionCodeCacheKey('jira', connection_code));

    // res.status(200).json({ connection_id: result.connection_id });
    res.status(200).json({ success: true });
    return;
}