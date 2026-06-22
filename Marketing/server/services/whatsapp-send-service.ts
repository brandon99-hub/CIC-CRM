import { db } from "../db";
import { integrationConfigs } from "../../shared/crmSchema";
import { SecurityService } from "./security-service";
import { eq } from "drizzle-orm";
import axios from "axios";

export class WhatsappSendService {
  static async getIntegrationConfig(integrationId: string) {
    const [config] = await db
      .select()
      .from(integrationConfigs)
      .where(eq(integrationConfigs.id, integrationId));
      
    if (!config) throw new Error(`Integration ${integrationId} not found`);
    if (config.portalType !== "whatsapp") throw new Error(`Integration ${integrationId} is not a WhatsApp portal`);
    
    const token = config.apiKey ? SecurityService.decrypt(config.apiKey) : null;
    const phoneNumberId = config.clientId;
    
    if (!token || !phoneNumberId) {
      throw new Error("WhatsApp integration is missing System User Token or Phone Number ID");
    }
    
    return { token, phoneNumberId };
  }

  static async sendTextMessage(integrationId: string, toPhone: string, text: string) {
    const { token, phoneNumberId } = await this.getIntegrationConfig(integrationId);
    
    // Meta requires phone numbers without the '+' sign
    const cleanPhone = toPhone.replace(/\D/g, "");

    const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
    
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone,
      type: "text",
      text: {
        preview_url: false,
        body: text
      }
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error: any) {
      console.error("[WhatsApp] Failed to send message:", error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || "Failed to send WhatsApp message");
    }
  }
}
