import { Router } from 'express';
import { getJiraProjects, getSelectedJiraProjectId, selectJiraProject } from '../../controller/backend/jira.controller';

/**
 * Creates a router for connection info endpoints
 * @returns Express Router
 */
export default function createJiraConnectionRouter() {
    const router = Router();

    router.get('/get-all-projects', getJiraProjects);
    
    router.post('/select-project', selectJiraProject);
    
    router.get('/get-selected-project-id', getSelectedJiraProjectId);

    return router;
}