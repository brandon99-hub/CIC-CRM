import type { Express } from "express";
import { db } from "../db";
import { marketingUsers } from "../../shared/schema";
import {
  marketingUserLoginSchema,
  marketingUserRegisterSchema,
  marketingQuerySchema,
} from "../../shared/marketingSchema";
import {
  marketingAuth,
  marketingAdminAuth,
  generateMarketingToken,
  hashMarketingPassword,
  verifyMarketingPassword,
} from "../middleware/marketingAuth";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { emailService } from "../services/emailService";
import { AuditService } from "../services/audit-service";

export function registerAuthRoutes(app: Express) {
  // ─── Forgot Password ───────────────────────────────────────────────────────
  app.post("/api/marketing/auth/forgot-password", async (req, res) => {
    try {
      const email = (req.body?.email || "").toString().trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const users = await db
        .select()
        .from(marketingUsers)
        .where(and(eq(marketingUsers.email, email), eq(marketingUsers.isActive, true)))
        .limit(1);

      const baseUrl =
        process.env.FRONTEND_URL ||
        process.env.CLIENT_URL ||
        `${req.protocol}://${req.get("host")}`;

      if (users.length > 0) {
        const user = users[0];
        const { randomUUID } = await import("crypto");
        const rawToken = randomUUID();
        const tokenHash = await hashMarketingPassword(rawToken);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

        await db
          .update(marketingUsers)
          .set({ resetToken: tokenHash as any, resetTokenExpiry: expiresAt as any })
          .where(eq(marketingUsers.id, user.id));

        const resetLink = `${baseUrl}/marketing/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;

        try {
          await emailService.sendPasswordResetEmail({
            to: email,
            userName: user.firstName || email,
            resetLink,
          });
        } catch (e) {
          console.error("Marketing forgot-password: failed to send email", e);
        }
      }

      return res.json({ message: "If the email exists, a reset link has been sent." });
    } catch (error) {
      console.error("Marketing forgot-password error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Reset Password ────────────────────────────────────────────────────────
  app.post("/api/marketing/auth/reset-password", async (req, res) => {
    try {
      const token = (req.body?.token || "").toString();
      const newPassword = (req.body?.newPassword || "").toString();
      const email = (req.body?.email || "").toString().trim().toLowerCase();

      if (!token || !newPassword || !email) {
        return res.status(400).json({ error: "Token, email and newPassword are required" });
      }

      const users = await db
        .select()
        .from(marketingUsers)
        .where(and(eq(marketingUsers.email, email), eq(marketingUsers.isActive, true)))
        .limit(1);

      if (users.length === 0) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      const user = users[0] as any;
      if (!user.resetToken || !user.resetTokenExpiry) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      if (new Date().toISOString() > user.resetTokenExpiry) {
        return res.status(400).json({ error: "Reset token expired" });
      }

      const isTokenValid = await verifyMarketingPassword(token, user.resetToken);
      if (!isTokenValid) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      const hashed = await hashMarketingPassword(newPassword);

      await db
        .update(marketingUsers)
        .set({
          password: hashed as any,
          mustChangePassword: false as any,
          resetToken: null as any,
          resetTokenExpiry: null as any,
        })
        .where(eq(marketingUsers.id, user.id));

      return res.json({ message: "Password reset successful" });
    } catch (error) {
      console.error("Marketing reset-password error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Login ─────────────────────────────────────────────────────────────────
  app.post("/api/marketing/auth/login", async (req, res) => {
    try {
      const { email, password } = marketingUserLoginSchema.parse(req.body);

      const users = await db
        .select()
        .from(marketingUsers)
        .where(and(eq(marketingUsers.email, email), eq(marketingUsers.isActive, true)))
        .limit(1);

      if (users.length === 0) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const user = users[0];
      const isValidPassword = await verifyMarketingPassword(password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      await db
        .update(marketingUsers)
        .set({ lastLoginAt: new Date().toISOString() } as any)
        .where(eq(marketingUsers.id, user.id));

      const token = generateMarketingToken({
        id: user.id,
        email: user.email,
        role: user.role as "admin" | "marketer" | "business_development",
      });

      AuditService.logAction(req, {
        action: "login",
        module: "marketing",
        entityType: "user",
        entityId: user.id,
        details: `User ${user.email} logged in successfully`,
      });

      const { userRoles, systemRoles, systemRolePermissions, systemPermissions } = await import(
        "../../shared/adminSchema"
      );

      const assignedRoles = await db
        .select({ roleId: systemRoles.id, dashboards: systemRoles.dashboards })
        .from(systemRoles)
        .innerJoin(userRoles, eq(userRoles.roleId, systemRoles.id))
        .where(and(eq(userRoles.userId, user.id), eq(systemRoles.isActive, true)));

      const allDashboards = new Set<string>();
      assignedRoles.forEach(r => {
        if (Array.isArray(r.dashboards)) r.dashboards.forEach(d => allDashboards.add(d));
      });

      const roleIds = assignedRoles.map(r => r.roleId);
      let perms: string[] = [];

      if (roleIds.length > 0) {
        const userPerms = await db
          .select({ key: systemPermissions.key })
          .from(systemPermissions)
          .innerJoin(
            systemRolePermissions,
            eq(systemRolePermissions.permissionId, systemPermissions.id)
          )
          .where(
            and(
              inArray(systemRolePermissions.roleId, roleIds),
              eq(systemPermissions.isActive, true)
            )
          );
        perms = userPerms.map(p => p.key);
      }

      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          permissions: perms,
          mustChangePassword: user.mustChangePassword,
          dashboardAccess: Array.from(allDashboards),
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Current User (Me) ────────────────────────────────────────────────────
  app.get("/api/auth/me", marketingAuth, async (req, res) => {
    try {
      const user = req.marketingUser!;
      const { userRoles, systemRoles } = await import("../../shared/adminSchema");
      const assignedRoles = await db
        .select({ dashboards: systemRoles.dashboards })
        .from(systemRoles)
        .innerJoin(userRoles, eq(userRoles.roleId, systemRoles.id))
        .where(eq(userRoles.userId, user.id));
      
      const allDashboards = new Set<string>();
      assignedRoles.forEach(r => {
        if (Array.isArray(r.dashboards)) r.dashboards.forEach(d => allDashboards.add(d));
      });

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        permissions: user.permissions || [],
        dashboardAccess: Array.from(allDashboards),
      });
    } catch (error) {
      console.error("Error fetching current user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Register (admin only) ─────────────────────────────────────────────────
  app.post("/api/marketing/auth/register", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const userData = marketingUserRegisterSchema.parse(req.body);
      const hashedPassword = await hashMarketingPassword(userData.password);

      const newUser = await db
        .insert(marketingUsers)
        .values({ ...userData, password: hashedPassword, mustChangePassword: true } as any)
        .returning();

      // Fire-and-forget welcome email
      (async () => {
        try {
          const { randomUUID } = await import("crypto");
          const rawToken = randomUUID();
          const tokenHash = await hashMarketingPassword(rawToken);
          const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

          await db
            .update(marketingUsers)
            .set({ resetToken: tokenHash as any, resetTokenExpiry: expiresAt as any })
            .where(eq(marketingUsers.id, newUser[0].id));

          const baseUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173";
          const resetLink = `${baseUrl}/marketing/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(newUser[0].email)}`;

          await emailService.sendEmail({
            to: newUser[0].email,
            subject: "Your TaskFlow Marketing Account",
            html: `
              <div style="font-family: Arial, sans-serif; line-height:1.5;">
                <h2>Welcome to TaskFlow Marketing</h2>
                <p>Hi ${newUser[0].firstName},</p>
                <p>Your marketing account has been created by the administrator.</p>
                <p>Please click the link below to set up your password and activate your account:</p>
                <p><a href="${resetLink}">Activate Account</a></p>
                <p>This link expires in 48 hours.</p>
                <p>Regards,<br/>TaskFlow Team</p>
              </div>
            `.trim(),
            text: `Welcome to TaskFlow Marketing\n\nHi ${newUser[0].firstName},\n\nYour account has been created. Set your password here: ${resetLink}\nThis link expires in 48 hours.\n\nRegards,\nTaskFlow Team`,
          });
        } catch (e) {
          console.error("Failed to send marketing user welcome email:", e);
        }
      })();

      res.status(201).json({
        user: {
          id: newUser[0].id,
          email: newUser[0].email,
          firstName: newUser[0].firstName,
          lastName: newUser[0].lastName,
          role: newUser[0].role,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Change Password ───────────────────────────────────────────────────────
  app.post("/api/marketing/auth/change-password", marketingAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = z
        .object({
          currentPassword: z.string().min(1),
          newPassword: z.string()
            .min(8, "Password must be at least 8 characters")
            .max(128, "Password must not exceed 128 characters"),
        })
        .parse(req.body);

      const user = req.marketingUser!;

      const fullUsers = await db
        .select()
        .from(marketingUsers)
        .where(eq(marketingUsers.id, user.id))
        .limit(1);

      const isValidPassword = await verifyMarketingPassword(
        currentPassword,
        fullUsers[0].password
      );
      if (!isValidPassword) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      const hashedNewPassword = await hashMarketingPassword(newPassword);

      await db
        .update(marketingUsers)
        .set({
          password: hashedNewPassword,
          mustChangePassword: false,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(marketingUsers.id, user.id));

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Password change error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Logout ────────────────────────────────────────────────────────────────
  app.post("/api/marketing/auth/logout", marketingAuth, (req, res) => {
    res.clearCookie("auth_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    AuditService.logAction(req, {
      action: "logout",
      module: "marketing",
      entityType: "user",
      entityId: req.marketingUser!.id,
      details: `User ${req.marketingUser!.email} logged out`,
    });
    res.json({ message: "Logged out successfully" });
  });
}
