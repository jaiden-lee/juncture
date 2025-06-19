import { Request, Response } from 'express';
import { getConnectionIDFromSecretKey } from '../../../utils/juncture_key_helpers/secret_key_helpers';
import { getAccessTokenHelper } from '../../../utils/credential_helpers';
import { getJiraConnectionDetails } from '../../../utils/integration_helpers/jira';
import axios from 'axios';

export type GetJiraTicketsQueryParams = {
    external_id: string;
    jira_project_id?: string;
};
export type JiraTicket = {
    id: string;
    key: string;
    summary: string;
    status: string;
    assignee?: string;
    priority?: string;
    created: string;
    updated: string;
};
export type GetJiraTicketsResponse = {
    tickets: JiraTicket[];
    total: number;
} | {
    error: string;
} | {
    needs_reauthorization: true;
    error: string;
};
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
        const maxResults = 50;
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
        res.status(500).json({ error: 'Failed to fetch Jira tickets' });
        return;
    }
}

export type GetJiraTicketsForSprintQueryParams = {
    external_id: string;
    sprint_id: string;
};
export type GetJiraTicketsForSprintResponse = {
    tickets: JiraTicket[];
    total: number;
    sprint: JiraSprint;
} | {
    error: string;
} | {
    needs_reauthorization: true;
    error: string;
};
export type JiraSprint = {
    id: number;
    name: string;
    state: 'future' | 'active' | 'closed';
    startDate?: string;
    endDate?: string;
    goal?: string;
};
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
        const sprintResponse = await axios.get(`https://api.atlassian.com/ex/jira/${siteId}/rest/agile/1.0/sprint/${sprint_id}`, {
            headers: {
                'Authorization': `Bearer ${accessTokenResult.accessToken}`,
                'Accept': 'application/json'
            }
        });
        const sprint = sprintResponse.data;
        const allTickets: JiraTicket[] = [];
        let startAt = 0;
        const maxResults = 50;
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
        res.status(500).json({ error: 'Failed to fetch Jira tickets for sprint' });
        return;
    }
}

export type GetJiraIssueQueryParams = {
    external_id: string;
    issue_id_or_key: string;
};
export type DetailedJiraIssue = {
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
};
export type GetJiraIssueResponse = {
    issue: DetailedJiraIssue;
} | {
    error: string;
} | {
    needs_reauthorization: true;
    error: string;
};
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
        res.status(200).json({ issue: detailedIssue });
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
        res.status(500).json({ error: 'Failed to fetch Jira issue' });
        return;
    }
}

export type EditJiraIssueBody = {
    external_id: string;
    issue_id_or_key: string;
    summary?: string;
    description?: string;
    priority_id?: string;
    issue_type_id?: string;
    assignee_account_id?: string;
};
export type EditJiraIssueResponse = {
    success: true;
    issue: {
        id: string;
        key: string;
        summary: string;
        description?: string;
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
        updated: string;
    };
} | {
    error: string;
} | {
    needs_reauthorization: true;
    error: string;
};
export async function editJiraIssue(req: Request<{}, {}, EditJiraIssueBody>, res: Response<EditJiraIssueResponse>) {
    const { external_id, issue_id_or_key, summary, description, priority_id, issue_type_id, assignee_account_id } = req.body;
    if (!external_id) {
        res.status(400).json({ error: 'Missing external_id' });
        return;
    }
    if (!issue_id_or_key) {
        res.status(400).json({ error: 'Missing issue_id_or_key' });
        return;
    }
    if (!summary && !description && !priority_id && !issue_type_id && assignee_account_id === undefined) {
        res.status(400).json({ error: 'At least one field must be provided for update' });
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
        const fields: any = {};
        if (summary !== undefined) fields.summary = summary;
        if (description !== undefined) fields.description = description;
        if (priority_id !== undefined) fields.priority = { id: priority_id };
        if (issue_type_id !== undefined) fields.issuetype = { id: issue_type_id };
        if (assignee_account_id !== undefined) {
            if (assignee_account_id === "null") fields.assignee = null;
            else fields.assignee = { accountId: assignee_account_id };
        }
        await axios.put(`https://api.atlassian.com/ex/jira/${siteId}/rest/api/3/issue/${issue_id_or_key}`, { fields }, {
            headers: {
                'Authorization': `Bearer ${accessTokenResult.accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        const getIssueResponse = await axios.get(`https://api.atlassian.com/ex/jira/${siteId}/rest/api/3/issue/${issue_id_or_key}`, {
            headers: {
                'Authorization': `Bearer ${accessTokenResult.accessToken}`,
                'Accept': 'application/json'
            }
        });
        const issue = getIssueResponse.data;
        res.status(200).json({
            success: true,
            issue: {
                id: issue.id,
                key: issue.key,
                summary: issue.fields.summary || '',
                description: issue.fields.description,
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
                updated: issue.fields.updated
            }
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
        if (error.response?.status === 400) {
            res.status(400).json({ error: 'Invalid field values provided' });
            return;
        }
        if (error.response?.status === 409) {
            res.status(409).json({ error: 'Issue has been modified since last read' });
            return;
        }
        console.error('Error updating Jira issue:', error.message);
        res.status(500).json({ error: 'Failed to update Jira issue' });
        return;
    }
}

export type CreateJiraTicketBody = {
    external_id: string;
    jira_project_id?: string;
    summary: string;
    description?: string;
    issue_type_id: string;
    priority_id?: string;
    assignee_account_id?: string;
};

export type CreateJiraTicketResponse =
    | {
          ticket: JiraTicket;
      }
    | { error: string }
    | { needs_reauthorization: true; error: string };

export async function createJiraTicket(
    req: Request<{}, {}, CreateJiraTicketBody>,
    res: Response<CreateJiraTicketResponse>
) {
    const {
        external_id,
        jira_project_id,
        summary,
        description,
        issue_type_id,
        priority_id,
        assignee_account_id,
    } = req.body;
    if (!external_id || !summary || !issue_type_id) {
        res.status(400).json({ error: 'Missing required fields: external_id, summary, or issue_type_id' });
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
        const fields: any = {
            project: { id: projectIdToUse },
            summary,
            issuetype: { id: issue_type_id },
        };
        if (description !== undefined) fields.description = description;
        if (priority_id !== undefined) fields.priority = { id: priority_id };
        if (assignee_account_id !== undefined) fields.assignee = { accountId: assignee_account_id };
        const response = await axios.post(
            `https://api.atlassian.com/ex/jira/${siteId}/rest/api/3/issue`,
            { fields },
            {
                headers: {
                    Authorization: `Bearer ${accessTokenResult.accessToken}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
            }
        );
        const issue = response.data;
        // Fetch the created issue to get all fields in a consistent format
        const getIssueResponse = await axios.get(
            `https://api.atlassian.com/ex/jira/${siteId}/rest/api/3/issue/${issue.id}`,
            {
                headers: {
                    Authorization: `Bearer ${accessTokenResult.accessToken}`,
                    Accept: 'application/json',
                },
            }
        );
        const created = getIssueResponse.data;
        const ticket: JiraTicket = {
            id: created.id,
            key: created.key,
            summary: created.fields.summary || '',
            status: created.fields.status.name,
            assignee: created.fields.assignee ? created.fields.assignee.displayName : undefined,
            priority: created.fields.priority ? created.fields.priority.name : undefined,
            created: created.fields.created,
            updated: created.fields.updated,
        };
        res.status(201).json({ ticket });
        return;
    } catch (error: any) {
        if (error.response?.status === 400) {
            res.status(400).json({ error: 'Invalid field values or missing required fields for Jira issue creation' });
            return;
        }
        if (error.response?.status === 403) {
            res.status(403).json({ error: 'Access denied to create issue' });
            return;
        }
        if (error.response?.status === 404) {
            res.status(404).json({ error: 'Project or issue type not found' });
            return;
        }
        console.error('Error creating Jira ticket:', error.message);
        res.status(500).json({ error: 'Failed to create Jira ticket' });
        return;
    }
}

export type DeleteJiraIssueBody = {
    external_id: string;
    issue_id_or_key: string;
};

export type DeleteJiraIssueResponse =
    | { success: true }
    | { error: string }
    | { needs_reauthorization: true; error: string };

export async function deleteJiraIssue(
    req: Request<{}, {}, DeleteJiraIssueBody>,
    res: Response<DeleteJiraIssueResponse>
) {
    const { external_id, issue_id_or_key } = req.body;
    if (!external_id || !issue_id_or_key) {
        res.status(400).json({ error: 'Missing required fields: external_id or issue_id_or_key' });
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
        await axios.delete(
            `https://api.atlassian.com/ex/jira/${siteId}/rest/api/3/issue/${issue_id_or_key}`,
            {
                headers: {
                    Authorization: `Bearer ${accessTokenResult.accessToken}`,
                    Accept: 'application/json',
                },
            }
        );
        res.status(204).json({ success: true });
        return;
    } catch (error: any) {
        if (error.response?.status === 400) {
            res.status(400).json({ error: 'Invalid issue id or key' });
            return;
        }
        if (error.response?.status === 401) {
            res.status(401).json({ error: 'Invalid secret key' });
            return;
        }
        if (error.response?.status === 403) {
            res.status(403).json({ error: 'Access denied to delete issue' });
            return;
        }
        if (error.response?.status === 404) {
            res.status(404).json({ error: 'Issue not found' });
            return;
        }
        console.error('Error deleting Jira issue:', error.message);
        res.status(500).json({ error: 'Failed to delete Jira issue' });
        return;
    }
} 