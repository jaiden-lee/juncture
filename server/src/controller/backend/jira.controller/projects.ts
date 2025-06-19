import { Request, Response } from 'express';
import { getConnectionIDFromSecretKey } from '../../../utils/juncture_key_helpers/secret_key_helpers';
import { getAccessTokenHelper } from '../../../utils/credential_helpers';
import { getJiraConnectionDetails, updateSelectedJiraProject } from '../../../utils/integration_helpers/jira';
import axios from 'axios';

export type GetJiraProjectsQueryParams = {
    external_id: string;
};

export type GetJiraProjectsResponse = {
    projects: JiraProject[];
    total: number;
    selected_project_id: string | null;
} | {
    error: string;
} | {
    needs_reauthorization: true;
    error: string;
};

export type JiraProject = {
    id: string;
    key: string;
    name: string;
    lead: {
        displayName: string;
    };
};

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
    const jiraConnectionDetails = await getJiraConnectionDetails(connectionId);
    if ('error' in jiraConnectionDetails) {
        res.status(401).json({ error: jiraConnectionDetails.error });
        return;
    }
    const siteId = jiraConnectionDetails.siteId;
    const selectedProjectId = jiraConnectionDetails.selectedProjectId ?? null;
    try {
        const allProjects: JiraProject[] = [];
        let startAt = 0;
        const maxResults = 50;
        let isLastPage = false;
        while (!isLastPage) {
            const response = await axios.get(`https://api.atlassian.com/ex/jira/${siteId}/rest/api/3/project/search`, {
                headers: {
                    'Authorization': `Bearer ${accessTokenResult.accessToken}`,
                    'Accept': 'application/json'
                },
                params: {
                    startAt,
                    maxResults,
                    expand: 'lead'
                }
            });
            const { values, isLast, total } = response.data;
            const transformedProjects: JiraProject[] = values.map((project: any) => ({
                id: project.id,
                key: project.key,
                name: project.name,
                lead: {
                    displayName: project.lead.displayName
                }
            }));
            allProjects.push(...transformedProjects);
            if (isLast || allProjects.length >= total) {
                isLastPage = true;
            } else {
                startAt += maxResults;
            }
        }
        res.status(200).json({
            projects: allProjects,
            total: allProjects.length,
            selected_project_id: selectedProjectId
        });
        return;
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch Jira projects' });
        return;
    }
}

export type SelectJiraProjectBody = {
    jira_project_id: string;
    external_id: string;
};

export type SelectJiraProjectResponse = {
    error: string;
} | {
    success: true;
};

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

export type GetSelectedJiraProjectIdQueryParams = {
    external_id: string;
};
export type GetSelectedJiraProjectIdResponse = {
    error: string;
} | {
    jira_project_id: string | null;
};
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