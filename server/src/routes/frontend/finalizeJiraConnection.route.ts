import { Router } from 'express';
import { getJiraSites, setJiraSite } from '../../controller/frontend/finalizeJiraConnection.controller';


export default function createFinalizeJiraConnectionRouter() {
    const router = Router();

    router.post('/get-jira-sites', getJiraSites);
    router.post('/set-jira-site', setJiraSite);

    return router;
}