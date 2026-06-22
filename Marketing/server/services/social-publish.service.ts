import axios from "axios";
import crypto from "crypto";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { metaPages, socialPosts } from "../../shared/commsSchema";

const GRAPH_API = "https://graph.facebook.com/v19.0";

import { SecurityService } from "./security-service";

function decryptToken(encryptedData: string): string {
  return SecurityService.decrypt(encryptedData);
}

async function getPageToken(pageId: string): Promise<string> {
  const page = await db.query.metaPages.findFirst({ where: eq(metaPages.pageId, pageId) });
  if (!page?.isActive) throw new Error(`No active page token for pageId: ${pageId}`);
  return decryptToken(page.pageAccessToken);
}

export class SocialPublishService {

  /**
   * Publish a text post immediately to a Facebook Page
   */
  static async publishFacebookPost(pageId: string, message: string, link?: string) {
    const token = await getPageToken(pageId);
    const payload: any = { message };
    if (link) payload.link = link;

    const res = await axios.post(`${GRAPH_API}/${pageId}/feed`, payload, {
      params: { access_token: token }
    });
    return res.data; // { id: "PAGE_ID_POST_ID" }
  }

  /**
   * Publish an image post to a Facebook Page
   */
  static async publishFacebookImagePost(pageId: string, message: string, imageUrl: string) {
    const token = await getPageToken(pageId);
    const res = await axios.post(`${GRAPH_API}/${pageId}/photos`, {
      caption: message,
      url: imageUrl,
    }, { params: { access_token: token } });
    return res.data;
  }

  /**
   * Publish a text/image post to Instagram (via Instagram Graph API)
   * Step 1: Create a media container
   * Step 2: Publish the container
   */
  static async publishInstagramPost(message: string, imageUrl?: string) {
    const igAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    if (!igAccountId || !token) throw new Error("Instagram credentials not configured");

    // Step 1: Create media container
    const containerPayload: any = { caption: message };
    if (imageUrl) {
      containerPayload.image_url = imageUrl;
    } else {
      // Text-only posts require a placeholder image for Instagram (image is required)
      throw new Error("Instagram requires an image for feed posts. Stories are not supported via this API.");
    }

    const containerRes = await axios.post(`${GRAPH_API}/${igAccountId}/media`, containerPayload, {
      params: { access_token: token }
    });
    const creationId = containerRes.data.id;

    // Step 2: Publish the container
    const publishRes = await axios.post(`${GRAPH_API}/${igAccountId}/media_publish`, {
      creation_id: creationId,
    }, { params: { access_token: token } });

    return publishRes.data; // { id: "MEDIA_ID" }
  }

  /**
   * Fetch published posts + basic engagement from a Facebook Page
   */
  static async getPagePosts(pageId: string, limit = 10) {
    const token = await getPageToken(pageId);
    const res = await axios.get(`${GRAPH_API}/${pageId}/posts`, {
      params: {
        fields: "id,message,full_picture,created_time,likes.summary(true),comments.summary(true),shares",
        limit,
        access_token: token
      }
    });
    return res.data;
  }

  /**
   * Fetch published Instagram media with basic engagement
   */
  static async getInstagramPosts(limit = 10) {
    const igAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    if (!igAccountId || !token) throw new Error("Instagram credentials not configured");

    const res = await axios.get(`${GRAPH_API}/${igAccountId}/media`, {
      params: {
        fields: "id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count",
        limit,
        access_token: token
      }
    });
    return res.data;
  }

  /**
   * Fetch specific post insights from Meta Graph API
   */
  static async getPostInsights(externalPostId: string, platform: string, pageId?: string) {
    try {
      if (platform === "facebook" && pageId) {
        const token = await getPageToken(pageId);
        // post_impressions_unique, post_engagements, post_reactions_by_type_total, post_clicks
        const res = await axios.get(`${GRAPH_API}/${externalPostId}/insights`, {
          params: {
            metric: "post_impressions_unique,post_engagements,post_reactions_by_type_total,post_clicks",
            access_token: token
          }
        });
        return res.data.data;
      } else if (platform === "instagram") {
        const token = process.env.INSTAGRAM_ACCESS_TOKEN;
        if (!token) throw new Error("No Instagram token");
        // engagement, saved, shares, views, reach
        const res = await axios.get(`${GRAPH_API}/${externalPostId}/insights`, {
          params: {
            metric: "engagement,saved,shares,reach,views",
            access_token: token
          }
        });
        return res.data.data;
      }
    } catch (err: any) {
      console.error(`Failed to fetch real insights for ${externalPostId}:`, err?.response?.data || err.message);
      // Fallback for test environments without real active tokens
      return null;
    }
  }
}
