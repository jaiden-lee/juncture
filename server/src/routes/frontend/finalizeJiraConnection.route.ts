import { Router } from 'express';
import { fetchAvailableJiraSites, createJiraConnection } from '../../controller/frontend/finalizeJiraConnection.controller';


export default function createFinalizeJiraConnectionRouter() {
    const router = Router();

    router.get('/fetch-available-sites', fetchAvailableJiraSites);
    router.post('/create-connection', createJiraConnection);

    return router;
}