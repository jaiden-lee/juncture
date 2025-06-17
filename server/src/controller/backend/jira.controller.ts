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
    lead: {
        displayName: string;
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
            
            // Transform the projects to match our simplified JiraProject type
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
    summary: string;
    status: string;
    assignee?: string;
    priority?: string;
    created: string;
    updated: string;
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
            
            // Transform the issues to match our simplified JiraTicket type
            const transformedTickets: JiraTicket[] = issues.map((issue: any) => ({
                id: issue.id,
                key: issue.key,
                summary: issue.fields.summary || '',
                status: issue.fields.status.name,
                assignee: issue.fields.assignee ? issue.fields.assignee.displayName : undefined,
                priority: issue.fields.priority ? issue.fields.priority.name : undefined,
                created: issue.fields.created,
                updated: issue.fields.updated
            }));
            
            allTickets.push(...transformedTickets);
            
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
    name: string;
    state: 'future' | 'active' | 'closed';
    startDate?: string;
    endDate?: string;
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
    boards: JiraBoard[];
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
        res.status(500).json({ 
            error: 'Failed to fetch Jira boards',
        });
        return;
    }
}

type GetJiraTicketsForSprintQueryParams = {
    external_id: string;
    sprint_id: string;
}

type GetJiraTicketsForSprintResponse = {
    tickets: JiraTicket[];
    total: number;
    sprint: JiraSprint;
} | {
    error: string;
} | {
    needs_reauthorization: true;
    error: string;
}

/**
 * Get Jira tickets for a specific sprint
 * Scopes: read:sprint:jira-software
 * @param req.query.external_id - The external ID of the Jira connection
 * @param req.query.sprint_id - The ID of the sprint to get tickets for
 * @param req.headers.Authorization - The juncture secret key
 * @param res.json - The tickets for the given sprint and sprint details
 */
export async function getJiraTicketsForSprint(req: Request<{}, {}, {}, GetJiraTicketsForSprintQueryParams>, res: Response<GetJiraTicketsForSprintResponse>) {
    const { external_id, sprint_id } = req.query;
    
    if (!external_id) {
        res.status(400).json({ error: 'Missing external_id' });
        return;
    }

    if (!sprint_id) {
        res.status(400).json({ error: 'Missing sprint_id' });
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

    try {
        // First, get sprint details to verify it exists and get sprint info
        const sprintResponse = await axios.get(`https://api.atlassian.com/ex/jira/${siteId}/rest/agile/1.0/sprint/${sprint_id}`, {
            headers: {
                'Authorization': `Bearer ${accessTokenResult.accessToken}`,
                'Accept': 'application/json'
            }
        });

        const sprint = sprintResponse.data;

        // Get tickets for the sprint
        const allTickets: JiraTicket[] = [];
        let startAt = 0;
        const maxResults = 50; // Maximum allowed by Jira API
        let isLastPage = false;

        while (!isLastPage) {
            const response = await axios.get(`https://api.atlassian.com/ex/jira/${siteId}/rest/agile/1.0/sprint/${sprint_id}/issue`, {
                headers: {
                    'Authorization': `Bearer ${accessTokenResult.accessToken}`,
                    'Accept': 'application/json'
                },
                params: {
                    startAt,
                    maxResults,
                    expand: 'names,schema'
                }
            });

            const { issues, isLast, total } = response.data;
            
            // Transform the issues to match our JiraTicket type
            const transformedTickets: JiraTicket[] = issues.map((issue: any) => ({
                id: issue.id,
                key: issue.key,
                summary: issue.fields.summary || '',
                status: issue.fields.status.name,
                assignee: issue.fields.assignee ? issue.fields.assignee.displayName : undefined,
                priority: issue.fields.priority ? issue.fields.priority.name : undefined,
                created: issue.fields.created,
                updated: issue.fields.updated
            }));

            allTickets.push(...transformedTickets);
            
            if (isLast || allTickets.length >= total) {
                isLastPage = true;
            } else {
                startAt += maxResults;
            }
        }

        res.status(200).json({
            tickets: allTickets,
            total: allTickets.length,
            sprint: {
                id: sprint.id,
                name: sprint.name,
                state: sprint.state,
                startDate: sprint.startDate,
                endDate: sprint.endDate,
                goal: sprint.goal
            }
        });
        return;
    } catch (error: any) {
        if (error.response?.status === 404) {
            res.status(404).json({ error: 'Sprint not found' });
            return;
        }
        if (error.response?.status === 403) {
            res.status(403).json({ error: 'Access denied to sprint' });
            return;
        }
        console.error('Error fetching Jira tickets for sprint:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch Jira tickets for sprint',
        });
        return;
    }
}

type JiraBoard = {
    id: number;
    name: string;
    type: string;
}

type DetailedJiraIssue = {
    id: string;
    key: string;
    summary: string;
    description?: string;
    status: {
        name: string;
        category: string;
    };
    priority: {
        name: string;
        iconUrl?: string;
    };
    issueType: {
        name: string;
        iconUrl?: string;
    };
    assignee?: {
        displayName: string;
        emailAddress?: string;
        avatarUrl?: string;
    };
    reporter?: {
        displayName: string;
        emailAddress?: string;
        avatarUrl?: string;
    };
    project: {
        id: string;
        key: string;
        name: string;
    };
    created: string;
    updated: string;
    resolution?: {
        name: string;
        description?: string;
    };
    labels: string[];
    components: string[];
    fixVersions: string[];
    affectedVersions: string[];
    timeTracking?: {
        originalEstimate?: string;
        remainingEstimate?: string;
        timeSpent?: string;
    };
    customFields?: Record<string, any>;
}

type GetJiraIssueQueryParams = {
    external_id: string;
    issue_id_or_key: string;
}

type GetJiraIssueResponse = {
    issue: DetailedJiraIssue;
} | {
    error: string;
} | {
    needs_reauthorization: true;
    error: string;
}

/**
 * Get detailed information for a specific Jira issue
 * Scopes: read:jira-work
 * @param req.query.external_id - The external ID of the Jira connection
 * @param req.query.issue_key - The key of the Jira issue (e.g., "PROJ-123")
 * @param req.headers.Authorization - The juncture secret key
 * @param res.json - The detailed issue information
 */
export async function getJiraIssue(req: Request<{}, {}, {}, GetJiraIssueQueryParams>, res: Response<GetJiraIssueResponse>) {
    const { external_id, issue_id_or_key } = req.query;
    
    if (!external_id) {
        res.status(400).json({ error: 'Missing external_id' });
        return;
    }

    if (!issue_id_or_key) {
        res.status(400).json({ error: 'Missing issue_id_or_key' });
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

    try {
        const response = await axios.get(`https://api.atlassian.com/ex/jira/${siteId}/rest/api/3/issue/${issue_id_or_key}`, {
            headers: {
                'Authorization': `Bearer ${accessTokenResult.accessToken}`,
                'Accept': 'application/json'
            },
            params: {
                expand: 'names,schema,transitions,operations,editmeta,changelog,renderedFields'
            }
        });

        const issue = response.data;
        
        // Extract custom fields (any field that starts with 'customfield_')
        const customFields: Record<string, any> = {};
        Object.keys(issue.fields).forEach(fieldKey => {
            if (fieldKey.startsWith('customfield_') && issue.fields[fieldKey] !== null) {
                customFields[fieldKey] = issue.fields[fieldKey];
            }
        });

        const detailedIssue: DetailedJiraIssue = {
            id: issue.id,
            key: issue.key,
            summary: issue.fields.summary || '',
            description: issue.fields.description,
            status: {
                name: issue.fields.status.name,
                category: issue.fields.status.statusCategory.key
            },
            priority: {
                name: issue.fields.priority?.name || 'Unassigned',
                iconUrl: issue.fields.priority?.iconUrl
            },
            issueType: {
                name: issue.fields.issuetype.name,
                iconUrl: issue.fields.issuetype.iconUrl
            },
            assignee: issue.fields.assignee ? {
                displayName: issue.fields.assignee.displayName,
                emailAddress: issue.fields.assignee.emailAddress,
                avatarUrl: issue.fields.assignee.avatarUrls?.['48x48']
            } : undefined,
            reporter: issue.fields.reporter ? {
                displayName: issue.fields.reporter.displayName,
                emailAddress: issue.fields.reporter.emailAddress,
                avatarUrl: issue.fields.reporter.avatarUrls?.['48x48']
            } : undefined,
            project: {
                id: issue.fields.project.id,
                key: issue.fields.project.key,
                name: issue.fields.project.name
            },
            created: issue.fields.created,
            updated: issue.fields.updated,
            resolution: issue.fields.resolution ? {
                name: issue.fields.resolution.name,
                description: issue.fields.resolution.description
            } : undefined,
            labels: issue.fields.labels || [],
            components: (issue.fields.components || []).map((comp: any) => comp.name),
            fixVersions: (issue.fields.fixVersions || []).map((version: any) => version.name),
            affectedVersions: (issue.fields.versions || []).map((version: any) => version.name),
            timeTracking: issue.fields.timetracking ? {
                originalEstimate: issue.fields.timetracking.originalEstimate,
                remainingEstimate: issue.fields.timetracking.remainingEstimate,
                timeSpent: issue.fields.timetracking.timeSpent
            } : undefined,
            customFields: Object.keys(customFields).length > 0 ? customFields : undefined
        };

        res.status(200).json({
            issue: detailedIssue
        });
        return;
    } catch (error: any) {
        if (error.response?.status === 404) {
            res.status(404).json({ error: 'Issue not found' });
            return;
        }
        if (error.response?.status === 403) {
            res.status(403).json({ error: 'Access denied to issue' });
            return;
        }
        console.error('Error fetching Jira issue:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch Jira issue',
        });
        return;
    }
}


