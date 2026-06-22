import { Request } from "express";
import { db } from "../db";
import { auditLogs } from "../../shared/crmSchema";
import { sql } from "drizzle-orm";

export interface AuditLogOptions {
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  oldValues?: any;
  newValues?: any;
  details?: string;
  metadata?: any;
}

export class AuditService {
  /**
   * Logs a system action to the audit_logs table.
   * This is performed asynchronously to avoid blocking the main request flow.
   */
  static logAction(req: Request, options: AuditLogOptions) {
    const { action, module, entityType, entityId, oldValues, newValues, details, metadata = {} } = options;
    
    // Parse machine info from User-Agent
    const ua = req.headers['user-agent'] || "";
    let machineInfo = "Unknown Device";
    
    if (ua.includes("Windows")) {
      machineInfo = ua.includes("Chrome") ? "Chrome on Windows" : ua.includes("Firefox") ? "Firefox on Windows" : "Windows Device";
    } else if (ua.includes("Macintosh")) {
      machineInfo = ua.includes("Chrome") ? "Chrome on macOS" : ua.includes("Safari") ? "Safari on macOS" : "Mac Device";
    } else if (ua.includes("Linux")) {
      machineInfo = "Linux Device";
    } else if (ua.includes("iPhone") || ua.includes("iPad")) {
      machineInfo = "iOS Device";
    } else if (ua.includes("Android")) {
      machineInfo = "Android Device";
    }

    // Asynchronous execution without await to return immediately
    (async () => {
      try {
        const user = (req as any).marketingUser;
        const fullName = user ? `${user.firstName} ${user.lastName || ""}`.trim() : "System";
        const ip = req.ip || req.headers['x-forwarded-for']?.toString() || "127.0.0.1";
        
        // Generate a stable Device ID based on User-Agent (simple hash)
        let deviceId = "DEV-" + Buffer.from(ua).toString('base64').substring(0, 12).toUpperCase();
        
        // Attempt to resolve hostname
        let hostname = "Unknown Host";
        try {
          const dns = require('dns').promises;
          const hostnames = await dns.reverse(ip === '::1' || ip === '127.0.0.1' ? '127.0.0.1' : ip);
          if (hostnames && hostnames.length > 0) hostname = hostnames[0];
        } catch (e) {
          hostname = "Local/Private Machine";
        }
        
        await db.insert(auditLogs).values({
          userId: user?.id || null,
          userEmail: user?.email || "system",
          userName: fullName,
          action,
          module,
          entityType,
          entityId,
          oldValues: oldValues || {},
          newValues: newValues || {},
          ipAddress: ip,
          userAgent: ua || null,
          metadata: {
            ...metadata,
            details,
            machineInfo,
            hostname,
            deviceId,
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.path
          },
          createdAt: new Date().toISOString()
        } as any);
      } catch (error) {
        console.error(`[AuditService] Failed to log action ${action} in module ${module}:`, error);
      }
    })();
  }

  /**
   * Specialized logger for login actions
   */
  static logLogin(req: Request, user: { id: string, email: string }) {
    this.logAction(req, {
      action: "login",
      module: "auth",
      entityType: "user",
      entityId: user.id,
      metadata: { email: user.email }
    });
  }

  /**
   * Specialized logger for logout actions (if explicit logout is called)
   */
  static logLogout(req: Request) {
    this.logAction(req, {
      action: "logout",
      module: "auth",
      entityType: "user"
    });
  }
}
