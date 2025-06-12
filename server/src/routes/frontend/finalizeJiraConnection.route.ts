import { Router } from 'express';
import { fetchAvailableJiraSites, selectJiraSite } from '../../controller/frontend/finalizeJiraConnection.controller';


export default function createFinalizeJiraConnectionRouter() {
    const router = Router();

    router.get('/fetch-available-sites', fetchAvailableJiraSites);
    router.post('/select-jira-site', selectJiraSite);

    return router;
}