import { Router } from 'express';
import { getJiraSites } from '../../controller/frontend/finalizeJiraConnection.controller';


export default function createFinalizeJiraConnectionRouter() {
    const router = Router();

    router.post('/get-jira-sites', getJiraSites);


    return router;
}