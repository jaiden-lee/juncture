import { Router } from 'express';
import { getJiraProjects, getSelectedJiraProjectId, getJiraTicketsForProject, selectJiraProject } from '../../controller/backend/jira.controller';

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

    return router;
}