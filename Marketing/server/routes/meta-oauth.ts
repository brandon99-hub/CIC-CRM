import express from "express";
import axios from "axios";
import crypto from "crypto";
import { db } from "../db";
import { metaPages } from "../../shared/commsSchema";

import { SecurityService } from "../services/security-service";

const router = express.Router();

router.get("/api/auth/meta/url", (req, res) => {
    const { integrationId } = req.query;
    const appId = process.env.META_APP_ID;
    const redirectUri = encodeURIComponent(`${process.env.CRM_BASE_URL || "https://kasneb-crm.onrender.com"}/api/auth/meta/callback`);
    const scopes = [
        "public_profile",
        "pages_show_list",
        "pages_manage_metadata",
        "pages_read_engagement",
        "pages_messaging",
        "leads_retrieval",
        "instagram_basic",
        "instagram_manage_messages",
        "instagram_manage_comments"
    ].join(",");

    const stateParam = integrationId ? `&state=${encodeURIComponent(integrationId as string)}` : "";
    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scopes}&response_type=code${stateParam}`;
    res.json({ url: authUrl });
});

router.get("/api/auth/meta/callback", async (req, res) => {
    const { code, state, error } = req.query;
    if (error) {
        return res.redirect(`/admin/settings/integrations?error=${encodeURIComponent(error.toString())}`);
    }

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const redirectUri = `${process.env.CRM_BASE_URL || "https://kasneb-crm.onrender.com"}/api/auth/meta/callback`;

    try {
        const shortTokenResponse = await axios.get("https://graph.facebook.com/v19.0/oauth/access_token", {
            params: {
                client_id: appId,
                client_secret: appSecret,
                redirect_uri: redirectUri,
                code: code?.toString()
            }
        });
        const shortUserToken = shortTokenResponse.data.access_token;

        const longTokenResponse = await axios.get("https://graph.facebook.com/v19.0/oauth/access_token", {
            params: {
                grant_type: "fb_exchange_token",
                client_id: appId,
                client_secret: appSecret,
                fb_exchange_token: shortUserToken
            }
        });
        const longUserToken = longTokenResponse.data.access_token;

        const pagesResponse = await axios.get("https://graph.facebook.com/v19.0/me/accounts", {
            params: { access_token: longUserToken }
        });

        const pages = pagesResponse.data.data;
        const userId = ((req as any).user as any)?.id || null; 

        for (const page of pages) {
            const encryptedToken = SecurityService.encrypt(page.access_token);
            const integrationId = state ? state.toString() : null;
            
            await db.insert(metaPages).values({
                integrationId: integrationId,
                pageId: page.id,
                pageName: page.name,
                platform: "facebook",
                pageAccessToken: encryptedToken,
                tokenExpiresAt: null,
                isActive: true,
                connectedBy: userId,
                connectedAt: new Date().toISOString()
            }).onConflictDoUpdate({
                target: metaPages.pageId,
                set: {
                    pageName: page.name,
                    pageAccessToken: encryptedToken,
                    tokenExpiresAt: null,
                    isActive: true,
                    connectedBy: userId,
                    connectedAt: new Date().toISOString()
                }
            });

            // ── Subscribe the Page to Webhook Events ─────────────────────────────
            // Without this call, Meta will NOT deliver any messages/events to our
            // webhook endpoint, even if the app-level webhook URL is verified.
            try {
                await axios.post(
                    `https://graph.facebook.com/v19.0/${page.id}/subscribed_apps`,
                    {},
                    {
                        params: {
                            subscribed_fields: "messages,messaging_postbacks,messaging_optins,feed,mention",
                            access_token: page.access_token
                        }
                    }
                );
                console.log(`[Meta OAuth] ✓ Page "${page.name}" (${page.id}) subscribed to webhook events`);
            } catch (subErr: any) {
                console.error(
                    `[Meta OAuth] ✗ Failed to subscribe page ${page.id} to webhooks:`,
                    subErr.response?.data || subErr.message
                );
                // Non-fatal — token is saved; user can re-trigger via admin sync
            }

            try {
                const igResponse = await axios.get(`https://graph.facebook.com/v19.0/${page.id}`, {
                    params: {
                        fields: "instagram_business_account",
                        access_token: page.access_token
                    }
                });
                
                const igAccount = igResponse.data.instagram_business_account;
                if (igAccount) {
                    await db.insert(metaPages).values({
                        integrationId: integrationId,
                        pageId: igAccount.id,
                        pageName: `${page.name} (Instagram)`,
                        platform: "instagram",
                        pageAccessToken: encryptedToken, 
                        tokenExpiresAt: null,
                        isActive: true,
                        connectedBy: userId,
                        connectedAt: new Date().toISOString()
                    }).onConflictDoUpdate({
                        target: metaPages.pageId,
                        set: {
                            pageAccessToken: encryptedToken,
                            tokenExpiresAt: null,
                            isActive: true,
                            connectedBy: userId,
                            connectedAt: new Date().toISOString()
                        }
                    });
                }
            } catch (igError) {
                console.error(`No connected Instagram account found for page: ${page.name}`, igError);
            }
        }

        res.redirect("/admin/settings/integrations?status=success");
    } catch (err: any) {
        console.error("Meta Token Exchange Failed:", err.response?.data || err.message);
        res.redirect(`/admin/settings/integrations?status=error&message=${encodeURIComponent("OAuth Token Exchange failed")}`);
    }
});

export default router;
