import { Router } from 'express';
import { getJiraProjects, getSelectedJiraProjectId, getJiraTicketsForProject, selectJiraProject, getJiraBoardForProject, getAllSprintsForProject, getActiveSprintsPerProject, getJiraTicketsForSprint, getJiraIssue, editJiraIssue } from '../../controller/backend/jira.controller';

/**
 * Creates a router for connection info endpoints
 * @returns Express Router
 */
export default function createJiraConnectionRouter() {
    const router = Router();

    router.get('/get-all-projects', getJiraProjects);
    
    router.post('/select-project', selectJiraProject);
    
    router.get('/get-selected-project-id', getSelectedJiraProjectId);

    router.get('/get-tickets-for-project', getJiraTicketsForProject);

    router.get('/get-boards-for-project', getJiraBoardForProject);
    
    router.get('/get-all-sprints-for-project', getAllSprintsForProject);

    router.get('/get-active-sprints-for-project', getActiveSprintsPerProject);

    router.get('/get-tickets-for-sprint', getJiraTicketsForSprint);

    router.get('/get-issue-details', getJiraIssue);

    router.put('/edit-issue', editJiraIssue);

    return router;
}