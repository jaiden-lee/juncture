import { Request, Response } from 'express';
import { getConnectionIDFromSecretKey } from '../../../utils/juncture_key_helpers/secret_key_helpers';
import { getAccessTokenHelper } from '../../../utils/credential_helpers';
import { getJiraConnectionDetails } from '../../../utils/integration_helpers/jira';
import axios from 'axios';

export type GetJiraBoardQueryParams = {
    external_id: string;
    jira_project_id?: string;
};
export type JiraBoard = {
    id: number;
    name: string;
    type: string;
};
export type GetJiraBoardResponse = {
    boards: JiraBoard[];
    total: number;
} | {
    error: string;
} | {
    needs_reauthorization: true;
    error: string;
};

export async function getJiraBoardForProject(req: Request<{}, {}, {}, GetJiraBoardQueryParams>, res: Response<GetJiraBoardResponse>) {
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
        const boards = boardResponse.data.values.map((board: any) => ({
            id: board.id,
            name: board.name,
            type: board.type
        }));
        res.status(200).json({
            boards,
            total: boardResponse.data.total
        });
        return;
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch Jira boards' });
        return;
    }
} 