import axios from "axios";
import crypto from "crypto";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { metaPages } from "../../shared/commsSchema";

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

export class MetaSendService {
  /**
   * Send a Messenger reply to a PSID
   */
  static async sendMessengerReply(pageId: string, recipientPsid: string, text: string) {
    const token = await getPageToken(pageId);
    const res = await axios.post(`${GRAPH_API}/me/messages`, {
      recipient: { id: recipientPsid },
      message: { text },
      messaging_type: "RESPONSE",
    }, { params: { access_token: token } });
    return res.data;
  }

  /**
   * Send an Instagram DM reply
   */
  static async sendInstagramReply(igAccountId: string, recipientIgsid: string, text: string) {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    if (!token) throw new Error("INSTAGRAM_ACCESS_TOKEN is not configured");
    const res = await axios.post(`${GRAPH_API}/${igAccountId}/messages`, {
      recipient: { id: recipientIgsid },
      message: { text },
    }, { params: { access_token: token } });
    return res.data;
  }

  /**
   * Reply to a Facebook comment
   */
  static async replyToComment(pageId: string, commentId: string, message: string) {
    const token = await getPageToken(pageId);
    const res = await axios.post(`${GRAPH_API}/${commentId}/comments`, { message }, {
      params: { access_token: token }
    });
    return res.data;
  }

  /**
   * Hide a Facebook comment
   */
  static async hideComment(pageId: string, commentId: string, hide = true) {
    const token = await getPageToken(pageId);
    const res = await axios.post(`${GRAPH_API}/${commentId}`, { is_hidden: hide }, {
      params: { access_token: token }
    });
    return res.data;
  }

  /**
   * Delete a Facebook comment
   */
  static async deleteComment(pageId: string, commentId: string) {
    const token = await getPageToken(pageId);
    const res = await axios.delete(`${GRAPH_API}/${commentId}`, {
      params: { access_token: token }
    });
    return res.data;
  }

  /**
   * Like a Facebook comment
   */
  static async likeComment(pageId: string, commentId: string) {
    const token = await getPageToken(pageId);
    const res = await axios.post(`${GRAPH_API}/${commentId}/likes`, {}, {
      params: { access_token: token }
    });
    return res.data;
  }

  /**
   * Get Facebook page insights for a post (likes, comments, reach)
   */
  static async getPostInsights(pageId: string, postId: string) {
    const token = await getPageToken(pageId);
    const res = await axios.get(`${GRAPH_API}/${postId}`, {
      params: {
        fields: "likes.summary(true),comments.summary(true),shares,message,created_time,full_picture",
        access_token: token
      }
    });
    return res.data;
  }
}
