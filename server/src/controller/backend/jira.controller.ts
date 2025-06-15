import { Request, Response } from 'express';
import { getConnectionIDFromSecretKey } from '../../utils/juncture_key_helpers/secret_key_helpers';
import { getConnectionDetails } from '../../utils/connection_db_helpers';
import { getAccessTokenHelper } from '../../utils/credential_helpers';
import { getJiraSiteNameFromConnectionId } from '../../utils/integration_helpers/jira';
import axios from 'axios';

type GetJiraProjectsQueryParams = {
    external_id: string;
}

type JiraProject = {
    id: string;
    key: string;
    name: string;
    projectTypeKey: string;
    simplified: boolean;
    style: string;
    isPrivate: boolean;
    lead: {
        accountId: string;
        displayName: string;
    };
    projectCategory?: {
        id: string;
        name: string;
        description: string;
    };
}

/**
 * Get Jira projects for a given external ID
 * Scopes: read:jira-work
 * @param req.query.external_id - The external ID of the Jira connection
 * @param req.headers.Authorization - The juncture secret key
 * @param res.json - The projects for the given external ID
 */
export async function getJiraProjects(req: Request<{}, {}, {}, GetJiraProjectsQueryParams>, res: Response) {
    const { external_id } = req.query;
    
    if (!external_id) {
        return res.status(400).json({ error: 'Missing external_id' });
    }

    const { connectionId, projectId, error } = await getConnectionIDFromSecretKey(req, external_id, 'jira');
    if (!connectionId) {
        return res.status(401).json({ error: error! });
    }

    const accessTokenResult = await getAccessTokenHelper(connectionId, 'jira', projectId);
    if ('needs_reauthorization' in accessTokenResult) {
        return res.status(403).json({ error: accessTokenResult.error, needs_reauthorization: true });
    }
    if ('error' in accessTokenResult) {
        return res.status(401).json({ error: accessTokenResult.error });
    }

    const siteName = await getJiraSiteNameFromConnectionId(connectionId, accessTokenResult.accessToken);
    if ('error' in siteName) {
        return res.status(401).json({ error: siteName.error });
    }

    try {
        const allProjects: JiraProject[] = [];
        let startAt = 0;
        const maxResults = 50; // Maximum allowed by Jira API
        let isLastPage = false;

        while (!isLastPage) {
            const response = await axios.get(`https://${siteName.siteName}.atlassian.net/rest/api/3/project/search`, {
                headers: {
                    'Authorization': `Bearer ${accessTokenResult.accessToken}`,
                    'Accept': 'application/json'
                },
                params: {
                    startAt,
                    maxResults,
                    expand: 'lead,projectCategory'
                }
            });

            const { values, isLast, total } = response.data;
            allProjects.push(...values);
            
            if (isLast || allProjects.length >= total) {
                isLastPage = true;
            } else {
                startAt += maxResults;
            }
        }

        return res.status(200).json({
            projects: allProjects,
            total: allProjects.length
        });
    } catch (error: any) {
        console.error('Error fetching Jira projects:', error);
        return res.status(500).json({ 
            error: 'Failed to fetch Jira projects',
            details: error.response?.data?.message || error.message
        });
    }
}

