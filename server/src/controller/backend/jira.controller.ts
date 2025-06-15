import { Request, Response } from 'express';
import { getConnectionIDFromSecretKey } from '../../utils/juncture_key_helpers/secret_key_helpers';
import { getAccessTokenHelper } from '../../utils/credential_helpers';
import { getJiraConnectionDetails, getJiraSiteNameFromConnectionId, updateSelectedJiraProject } from '../../utils/integration_helpers/jira';
import axios from 'axios';

type GetJiraProjectsQueryParams = {
    external_id: string;
}

type GetJiraProjectsResponse = {
    projects: JiraProject[];
    total: number;
    selected_project_id: string | null;
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
 * @param res.json - The projects for the given external ID and the currently selected project ID
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
        const maxResults = 50; // Maximum allowed by Jira API
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
            total: allProjects.length,
            selected_project_id: selectedProjectId
        });
        return;
    } catch (error: any) {
        // console.error('Error fetching Jira projects:', error);
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






type GetJiraTicketsQueryParams = {
    external_id: string;
    jira_project_id?: string;
}

type GetJiraTicketsResponse = {
    tickets: JiraTicket[];
    total: number;
} | {
    error: string;
} | {
    needs_reauthorization: true;
    error: string;
}

type JiraTicket = {
    id: string;
    key: string;
    fields: {
        summary: string;
        description?: string;
        status: {
            id: string;
            name: string;
            statusCategory: {
                id: number;
                key: string;
                colorName: string;
            };
        };
        assignee?: {
            accountId: string;
            displayName: string;
        };
        reporter?: {
            accountId: string;
            displayName: string;
        };
        created: string;
        updated: string;
        priority?: {
            id: string;
            name: string;
        };
    };
}

/**
 * Get all Jira tickets for a project
 * Scopes: read:jira-work
 * @param req.query.external_id - The external ID of the Jira connection
 * @param req.query.jira_project_id - (Optional) The ID of the Jira project to get tickets for. If not provided, uses the selected project.
 * @param req.headers.Authorization - The juncture secret key
 * @param res.json - The tickets for the given project
 */
export async function getJiraTicketsForProject(req: Request<{}, {}, {}, GetJiraTicketsQueryParams>, res: Response<GetJiraTicketsResponse>) {
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

    // If no project ID provided in query, get the selected project
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
        const allTickets: JiraTicket[] = [];
        let startAt = 0;
        const maxResults = 50; // Maximum allowed by Jira API
        let isLastPage = false;

        while (!isLastPage) {
            const response = await axios.get(`https://api.atlassian.com/ex/jira/${siteId}/rest/api/3/search`, {
                headers: {
                    'Authorization': `Bearer ${accessTokenResult.accessToken}`,
                    'Accept': 'application/json'
                },
                params: {
                    jql: `project = ${projectIdToUse} ORDER BY created DESC`,
                    startAt,
                    maxResults,
                    fields: 'summary,description,status,assignee,reporter,created,updated,priority'
                }
            });

            const { issues, isLast, total } = response.data;
            allTickets.push(...issues);
            
            if (isLast || allTickets.length >= total) {
                isLastPage = true;
            } else {
                startAt += maxResults;
            }
        }

        res.status(200).json({
            tickets: allTickets,
            total: allTickets.length
        });
        return;
    } catch (error: any) {
        console.error('Error fetching Jira tickets:', error);
        res.status(500).json({ 
            error: 'Failed to fetch Jira tickets',
        });
        return;
    }
}






type GetSprintsQueryParams = {
    external_id: string;
    jira_project_id?: string;
}

type GetSprintsResponse = {
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
}

type GetActiveSprintsResponse = {
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
}

type JiraSprint = {
    id: number;
    self: string;
    state: 'future' | 'active' | 'closed';
    name: string;
    startDate?: string;
    endDate?: string;
    completeDate?: string;
    originBoardId: number;
    goal?: string;
}

/**
 * Get all sprints for all boards in a project
 * Scopes: read:jira-work
 * @param req.query.external_id - The external ID of the Jira connection
 * @param req.query.jira_project_id - (Optional) The ID of the Jira project to get sprints for. If not provided, uses the selected project.
 * @param req.headers.Authorization - The juncture secret key
 * @param res.json - The sprints for all boards in the given project
 */
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

    // If no project ID provided in query, get the selected project
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
        // First, get all boards for the project
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
        const boardsWithSprints = [];
        let totalSprints = 0;

        // Get sprints for each board
        for (const board of boards) {
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

            // Find all active sprints for this board
            const activeSprints = allSprints.filter(sprint => sprint.state === 'active');
            totalSprints += allSprints.length;

            boardsWithSprints.push({
                board_id: board.id,
                board_name: board.name,
                board_type: board.type,
                sprints: allSprints,
                active_sprints: activeSprints
            });
        }

        res.status(200).json({
            boards: boardsWithSprints,
            total_sprints: totalSprints
        });
        return;
    } catch (error: any) {
        console.error('Error fetching Jira sprints:', error);
        res.status(500).json({ 
            error: 'Failed to fetch Jira sprints',
        });
        return;
    }
}

/**
 * Get active sprints for all boards in a project
 * Scopes: read:jira-work
 * @param req.query.external_id - The external ID of the Jira connection
 * @param req.query.jira_project_id - (Optional) The ID of the Jira project to get active sprints for. If not provided, uses the selected project.
 * @param req.headers.Authorization - The juncture secret key
 * @param res.json - The active sprints for all boards in the given project
 */
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

    // If no project ID provided in query, get the selected project
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
        // First, get all boards for the project
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
        const boardsWithActiveSprints = [];

        // Get active sprints for each board
        for (const board of boards) {
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

            boardsWithActiveSprints.push({
                board_id: board.id,
                board_name: board.name,
                board_type: board.type,
                active_sprints: activeSprints
            });
        }

        res.status(200).json({
            boards: boardsWithActiveSprints
        });
        return;
    } catch (error: any) {
        console.error('Error fetching active Jira sprints:', error);
        res.status(500).json({ 
            error: 'Failed to fetch active Jira sprints',
        });
        return;
    }
}

type GetJiraBoardQueryParams = {
    external_id: string;
    jira_project_id?: string;
}

type GetJiraBoardResponse = {
    boards: {
        board_id: number;
        board_name: string;
        board_type: string;
    }[];
    total: number;
} | {
    error: string;
} | {
    needs_reauthorization: true;
    error: string;
}

/**
 * Get all boards for a Jira project
 * Scopes: read:jira-work
 * @param req.query.external_id - The external ID of the Jira connection
 * @param req.query.jira_project_id - (Optional) The ID of the Jira project to get boards for. If not provided, uses the selected project.
 * @param req.headers.Authorization - The juncture secret key
 * @param res.json - The boards for the given project
 */
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

    // If no project ID provided in query, get the selected project
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
        // Get all boards for the project
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
            board_id: board.id,
            board_name: board.name,
            board_type: board.type
        }));

        res.status(200).json({
            boards,
            total: boardResponse.data.total
        });
        return;
    } catch (error: any) {
        res.status(500).json({ 
            error: 'Failed to fetch Jira boards',
        });
        return;
    }
}