import { Request, Response } from 'express';
import { getConnectionIDFromSecretKey } from '../../utils/juncture_key_helpers/secret_key_helpers';
import { getConnectionDetails } from '../../utils/connection_db_helpers';
import { getAccessTokenHelper } from '../../utils/credential_helpers';
import { getJiraConnectionDetails, getJiraSiteNameFromConnectionId, updateSelectedJiraProject } from '../../utils/integration_helpers/jira';
import axios from 'axios';

type GetJiraProjectsQueryParams = {
    external_id: string;
}

type GetJiraProjectsResponse = {
    projects: JiraProject[];
    total: number;
} | {
    error: string;
} | {
    needs_reauthorization: true;
    error: string;
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
export async function getJiraProjects(req: Request<{}, {}, {}, GetJiraProjectsQueryParams>, res: Response<GetJiraProjectsResponse>) {
    const { external_id } = req.query;
    
    if (!external_id) {
        res.status(400).json({ error: 'Missing external_id' });
        return;
    }

    const { connectionId, projectId, error } = await getConnectionIDFromSecretKey(req, external_id, 'jira');
    if (!connectionId) {
        res.status(401).json({ error: error! });
        return;
    }

    const accessTokenResult = await getAccessTokenHelper(connectionId, 'jira', projectId);
    if ('needs_reauthorization' in accessTokenResult) {
        res.status(403).json({ error: accessTokenResult.error, needs_reauthorization: true });
        return;
    }
    if ('error' in accessTokenResult) {
        res.status(401).json({ error: accessTokenResult.error });
        return;
    }

    const siteName = await getJiraSiteNameFromConnectionId(connectionId, accessTokenResult.accessToken);
    if ('error' in siteName) {
        res.status(401).json({ error: siteName.error });
        return;
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

        res.status(200).json({
            projects: allProjects,
            total: allProjects.length
        });
        return;
    } catch (error: any) {
        console.error('Error fetching Jira projects:', error);
        res.status(500).json({ 
            error: 'Failed to fetch Jira projects',
        });
        return;
    }
}







type SelectJiraProjectBody = {
    jira_project_id: string;
    external_id: string;
}

type SelectJiraProjectResponse = {
    error: string;
} | {
    success: true;
}
/**
 * Select a Jira project for a given external ID
 * Scopes: read:jira-work
 * @param req.body.external_id - The external ID of the Jira connection
 * @param req.body.jira_project_id - The ID of the Jira project to select
 * @param req.headers.Authorization - The juncture secret key
 * @param res.json - The selected Jira project
 */
export async function selectJiraProject(req: Request<{}, {}, SelectJiraProjectBody>, res: Response<SelectJiraProjectResponse>) {
    const { external_id, jira_project_id } = req.body;
    
    if (!external_id || !jira_project_id) {
        res.status(400).json({ error: 'Missing external_id or jira_project_id' });
        return;
    }

    const { connectionId, projectId, error } = await getConnectionIDFromSecretKey(req, external_id, 'jira');
    if (!connectionId) {
        res.status(401).json({ error: error! });
        return;
    }
    
    const updateSelectedJiraProjectResult = await updateSelectedJiraProject(connectionId, jira_project_id);
    if ('error' in updateSelectedJiraProjectResult) {
        res.status(401).json({ error: updateSelectedJiraProjectResult.error });
        return;
    }

    res.status(200).json({ success: true });
}





type GetSelectedJiraProjectIdQueryParams = {
    external_id: string;
}
type GetSelectedJiraProjectIdResponse = {
    error: string;
} | {
    jira_project_id: string | null;
}
/**
 * Get the selected Jira project ID for a given external ID
 * Scopes: read:jira-work
 * @param req.query.external_id - The external ID of the Jira connection
 * @param req.headers.Authorization - The juncture secret key
 * @param res.json - The selected Jira project ID
 */
export async function getSelectedJiraProjectId(req: Request<{}, {}, {}, GetSelectedJiraProjectIdQueryParams>, res: Response<GetSelectedJiraProjectIdResponse>) {
    const { external_id } = req.query;

    if (!external_id) {
        res.status(400).json({ error: 'Missing external_id' });
        return;
    }

    const { connectionId, projectId, error } = await getConnectionIDFromSecretKey(req, external_id, 'jira');
    if (!connectionId) {
        res.status(401).json({ error: error! });
        return;
    }

    const jiraConnectionDetails = await getJiraConnectionDetails(connectionId);
    if ('error' in jiraConnectionDetails) {
        res.status(401).json({ error: jiraConnectionDetails.error });
        return;
    }

    res.status(200).json({ jira_project_id: jiraConnectionDetails.selectedProjectId ?? null });
}