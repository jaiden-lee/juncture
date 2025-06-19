import { Request, Response } from 'express';
import { getConnectionIDFromSecretKey } from '../../../utils/juncture_key_helpers/secret_key_helpers';
import { getAccessTokenHelper } from '../../../utils/credential_helpers';
import { getJiraConnectionDetails } from '../../../utils/integration_helpers/jira';
import axios from 'axios';

export type GetSprintsQueryParams = {
    external_id: string;
    jira_project_id?: string;
};
export type JiraSprint = {
    id: number;
    name: string;
    state: 'future' | 'active' | 'closed';
    startDate?: string;
    endDate?: string;
    goal?: string;
};
export type GetSprintsResponse = {
    boards: {
        board_id: number;
        board_name: string;
        board_type: string;
        sprints: JiraSprint[];
        active_sprints: JiraSprint[];
    }[];
    total_sprints: number;
} | {
    error: string;
} | {
    needs_reauthorization: true;
    error: string;
};
export type GetActiveSprintsResponse = {
    boards: {
        board_id: number;
        board_name: string;
        board_type: string;
        active_sprints: JiraSprint[];
    }[];
} | {
    error: string;
} | {
    needs_reauthorization: true;
    error: string;
};

export async function getAllSprintsForProject(req: Request<{}, {}, {}, GetSprintsQueryParams>, res: Response<GetSprintsResponse>) {
    const { external_id, jira_project_id } = req.query;
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
    let projectIdToUse = jira_project_id;
    if (!projectIdToUse) {
        const jiraConnectionDetails = await getJiraConnectionDetails(connectionId);
        if ('error' in jiraConnectionDetails) {
            res.status(401).json({ error: jiraConnectionDetails.error });
            return;
        }
        projectIdToUse = jiraConnectionDetails.selectedProjectId ?? undefined;
    }
    if (!projectIdToUse) {
        res.status(400).json({ error: 'No project selected and no project ID provided' });
        return;
    }
    const jiraConnectionDetails = await getJiraConnectionDetails(connectionId);
    if ('error' in jiraConnectionDetails) {
        res.status(401).json({ error: jiraConnectionDetails.error });
        return;
    }
    const siteId = jiraConnectionDetails.siteId;
    try {
        const boardResponse = await axios.get(`https://api.atlassian.com/ex/jira/${siteId}/rest/agile/1.0/board`, {
            headers: {
                'Authorization': `Bearer ${accessTokenResult.accessToken}`,
                'Accept': 'application/json'
            },
            params: {
                projectKeyOrId: projectIdToUse
            }
        });
        if (!boardResponse.data.values.length) {
            res.status(404).json({ error: 'No agile boards found for this project' });
            return;
        }
        const boards = boardResponse.data.values;
        let totalSprints = 0;
        const boardSprintPromises = boards.map(async (board: any) => {
            const allSprints: JiraSprint[] = [];
            let startAt = 0;
            const maxResults = 50;
            let isLastPage = false;
            while (!isLastPage) {
                const response = await axios.get(`https://api.atlassian.com/ex/jira/${siteId}/rest/agile/1.0/board/${board.id}/sprint`, {
                    headers: {
                        'Authorization': `Bearer ${accessTokenResult.accessToken}`,
                        'Accept': 'application/json'
                    },
                    params: {
                        startAt,
                        maxResults,
                        state: 'active,future,closed'
                    }
                });
                const { values, isLast } = response.data;
                allSprints.push(...values);
                if (isLast) {
                    isLastPage = true;
                } else {
                    startAt += maxResults;
                }
            }
            const activeSprints = allSprints.filter(sprint => sprint.state === 'active');
            totalSprints += allSprints.length;
            return {
                board_id: board.id,
                board_name: board.name,
                board_type: board.type,
                sprints: allSprints,
                active_sprints: activeSprints
            };
        });
        const boardsWithSprints = await Promise.all(boardSprintPromises);
        res.status(200).json({
            boards: boardsWithSprints,
            total_sprints: boardsWithSprints.reduce((acc, b) => acc + b.sprints.length, 0)
        });
        return;
    } catch (error: any) {
        console.error('Error fetching Jira sprints:', error);
        res.status(500).json({ error: 'Failed to fetch Jira sprints' });
        return;
    }
}

export async function getActiveSprintsPerProject(req: Request<{}, {}, {}, GetSprintsQueryParams>, res: Response<GetActiveSprintsResponse>) {
    const { external_id, jira_project_id } = req.query;
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
    let projectIdToUse = jira_project_id;
    if (!projectIdToUse) {
        const jiraConnectionDetails = await getJiraConnectionDetails(connectionId);
        if ('error' in jiraConnectionDetails) {
            res.status(401).json({ error: jiraConnectionDetails.error });
            return;
        }
        projectIdToUse = jiraConnectionDetails.selectedProjectId ?? undefined;
    }
    if (!projectIdToUse) {
        res.status(400).json({ error: 'No project selected and no project ID provided' });
        return;
    }
    const jiraConnectionDetails = await getJiraConnectionDetails(connectionId);
    if ('error' in jiraConnectionDetails) {
        res.status(401).json({ error: jiraConnectionDetails.error });
        return;
    }
    const siteId = jiraConnectionDetails.siteId;
    try {
        const boardResponse = await axios.get(`https://api.atlassian.com/ex/jira/${siteId}/rest/agile/1.0/board`, {
            headers: {
                'Authorization': `Bearer ${accessTokenResult.accessToken}`,
                'Accept': 'application/json'
            },
            params: {
                projectKeyOrId: projectIdToUse
            }
        });
        if (!boardResponse.data.values.length) {
            res.status(404).json({ error: 'No agile boards found for this project' });
            return;
        }
        const boards = boardResponse.data.values;
        const boardActiveSprintPromises = boards.map(async (board: any) => {
            const response = await axios.get(`https://api.atlassian.com/ex/jira/${siteId}/rest/agile/1.0/board/${board.id}/sprint`, {
                headers: {
                    'Authorization': `Bearer ${accessTokenResult.accessToken}`,
                    'Accept': 'application/json'
                },
                params: {
                    state: 'active'
                }
            });
            const activeSprints = response.data.values || [];
            return {
                board_id: board.id,
                board_name: board.name,
                board_type: board.type,
                active_sprints: activeSprints
            };
        });
        const boardsWithActiveSprints = await Promise.all(boardActiveSprintPromises);
        res.status(200).json({
            boards: boardsWithActiveSprints
        });
        return;
    } catch (error: any) {
        console.error('Error fetching active Jira sprints:', error);
        res.status(500).json({ error: 'Failed to fetch active Jira sprints' });
        return;
    }
} 