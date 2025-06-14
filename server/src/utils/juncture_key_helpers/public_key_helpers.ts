import { Request } from "express";

export async function extractPublicKeyFromRequest(req: Request): Promise<string | undefined> {
    const publicKey = req.get("x-juncture-public-key");
    if (!publicKey) {
        return undefined;
    }

    return publicKey;
}
