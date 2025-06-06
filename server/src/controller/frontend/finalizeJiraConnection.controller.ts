import {Request, Response} from "express";
import {getConnectionIdFromConnectionCode} from "../../utils/integration_helpers/general";
import { getAccessTokenFromRedis } from "../../utils/credential_helpers";
import axios from "axios";

type GetJiraSitesBody = {
    connection_code: string;
}

export async function getJiraSites(req: Request<{}, {}, GetJiraSitesBody>, res: Response) {
    const { connection_code } = req.body;
    
    if (!connection_code) {
        res.status(400).json({ error: 'Missing connection_code' });
        return;
    }

    const connectionIdResponse = await getConnectionIdFromConnectionCode('jira', connection_code);
    
    if ('error' in connectionIdResponse) {
        res.status(400).json({ error: connectionIdResponse.error });
        return;
    }

    const accessTokenResponse = await getAccessTokenFromRedis(connectionIdResponse.connectionId);
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
