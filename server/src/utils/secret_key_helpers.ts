import { Request } from "express";
import { isCloudModeEnabled, useCloudContextManager } from "./CloudContextManager";
import { providerEnumType } from "../db/schema";
import { getDb } from "../db";
import { getConnectionID } from "./connection_db_helpers";

export type verifySecretKeyResponse = {
    isValid: boolean;
    projectId?: string;
    error?: string;
}

export type getConnectionIDFromSecretKeyResponse = {
    connectionId?: string;
    error?: string;
}

export async function verifySecretKey(req: Request): Promise<verifySecretKeyResponse> {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return {
            isValid: false,
            projectId: undefined,
            error: 'No authorization header provided'
        }
    }

    if (!authHeader.startsWith('Bearer ')) {
        return {
            isValid: false,
            projectId: undefined,
            error: 'Authorization header must start with "Bearer"'
        }
    }

    const parts = authHeader.split(' ');
    if (parts.length < 2) {
        return {
            isValid: false,
            projectId: undefined,
            error: 'Invalid Bearer token format'
        }
    }

    const secretKey = parts[1].trim();
    if (!secretKey) {
        return {
            isValid: false,
            projectId: undefined,
            error: 'No secret key provided'
        }
    }

    // OSS mode
    if (!isCloudModeEnabled()) {
        if (secretKey !== process.env.JUNCTURE_SECRET_KEY) {
            return {
                isValid: false,
                projectId: undefined,
                error: 'Invalid secret key'
            }
        }
        return {
            isValid: true,
            projectId: undefined,
            error: undefined
        }
    }

    // Cloud mode
    const cloudContextManager = useCloudContextManager();
    const projectId = await cloudContextManager.verifySecretKey(secretKey);
    if (!projectId) {
        return {
            isValid: false,
            projectId: undefined,
            error: 'Invalid secret key'
        }
    }
    return {
        isValid: true,
        projectId: projectId,
        error: undefined
    }
}


export async function getConnectionIDFromSecretKey(req: Request, external_id: string, provider: providerEnumType): Promise<getConnectionIDFromSecretKeyResponse> {
    const { isValid, projectId, error } = await verifySecretKey(req);
    if (!isValid) {
        return {
            connectionId: undefined,
            error: error!
        }
    }

    // OSS mode
    if (!isCloudModeEnabled()) {
        const connectionId = await getConnectionID(external_id, provider);
        if (!connectionId) {
            return {
                connectionId: undefined,
                error: 'Connection not found'
            }
        }
        return {
            connectionId: connectionId,
            error: undefined
        }
    }

    // Cloud mode
    const cloudContextManager = useCloudContextManager();
    const connectionId = await cloudContextManager.getConnectionID(external_id, provider, projectId!);
    if (!connectionId) {
        return {
            connectionId: undefined,
            error: 'Connection not found'
        }
    }
    return {
        connectionId: connectionId,
        error: undefined
    }
}