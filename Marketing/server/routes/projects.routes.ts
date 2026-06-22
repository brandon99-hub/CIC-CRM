import type { Express } from "express";
import { db } from "../db";
import {
  marketingProjects,
  marketingProspects,
  marketingUsers,
  marketingSectors,
} from "../../shared/schema";
import {
  marketingProjectCreateSchema,
  marketingProjectUpdateSchema,
  marketingQuerySchema,
} from "../../shared/marketingSchema";
import { marketingAuth, marketingAdminAuth } from "../middleware/marketingAuth";
import { eq, and, desc, ilike, sql, count } from "drizzle-orm";
import { z } from "zod";
import { emailService } from "../services/emailService";

export function registerProjectsRoutes(app: Express) {
  // ─── List Projects ─────────────────────────────────────────────────────────
  app.get(
    "/api/marketing/projects",
    marketingAuth,
    (req, res, next) => {
      if (
        req.marketingUser?.role === "admin" ||
        req.marketingUser?.permissions?.includes("marketing.view_all")
      ) {
        next();
      } else {
        res.status(403).json({ error: "Insufficient permissions" });
      }
    },
    async (req, res) => {
      try {
        const { page, limit, search, sectorId } = marketingQuerySchema.parse(req.query);
        const offset = (page - 1) * limit;
        let whereCondition: any = undefined;

        if (search) {
          whereCondition = ilike(marketingProjects.institution, `%${search}%`);
        }

        if (sectorId) {
          whereCondition = whereCondition
            ? and(whereCondition, eq(marketingProjects.sectorId, String(sectorId)))
            : eq(marketingProjects.sectorId, String(sectorId));
        }

        const [projects, totalCount] = await Promise.all([
          db
            .select({
              id: marketingProjects.id,
              institution: marketingProjects.institution,
              status: marketingProjects.status,
              sectorId: marketingProjects.sectorId,
              leadMarketer: marketingProjects.leadMarketer,
              contactPerson: marketingProjects.contactPerson,
              contactNumber: marketingProjects.contactNumber,
              remarks: marketingProjects.remarks,
              createdAt: marketingProjects.createdAt,
              updatedAt: marketingProjects.updatedAt,
              sectorName: marketingSectors.name,
              bdName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
              bdEmail: marketingUsers.email,
            })
            .from(marketingProjects)
            .leftJoin(marketingSectors, eq(marketingProjects.sectorId, marketingSectors.id))
            .leftJoin(marketingUsers, eq(marketingProjects.leadMarketer, marketingUsers.id))
            .where(whereCondition)
            .orderBy(desc(marketingProjects.createdAt))
            .limit(limit)
            .offset(offset),
          db
            .select({ count: count() })
            .from(marketingProjects)
            .where(whereCondition),
        ]);

        res.json({
          projects,
          pagination: {
            page,
            limit,
            total: totalCount[0].count,
            pages: Math.ceil(totalCount[0].count / limit),
          },
        });
      } catch (error) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ─── Create Project ────────────────────────────────────────────────────────
  app.post("/api/marketing/projects", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      console.log("Received project creation request:", req.body);
      const projectData = marketingProjectCreateSchema.parse(req.body);

      const newProject = await db
        .insert(marketingProjects)
        .values({
          ...projectData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any)
        .returning();

      if (projectData.leadMarketer) {
        try {
          const bdUser = await db
            .select()
            .from(marketingUsers)
            .where(eq(marketingUsers.id, projectData.leadMarketer))
            .limit(1);

          if (bdUser.length > 0) {
            const sector = await db
              .select()
              .from(marketingSectors)
              .where(eq(marketingSectors.id, projectData.sectorId))
              .limit(1);

            await emailService.sendEmail({
              to: bdUser[0].email,
              subject: "New Project Assignment",
              html: `
                <h2>New Project Assignment</h2>
                <p>Hello ${bdUser[0].firstName},</p>
                <p>A new project has been assigned to you:</p>
                <p><strong>Project:</strong> ${projectData.institution}</p>
                <p><strong>Sector:</strong> ${sector[0]?.name || "Unknown"}</p>
                <p>Please log in to view details and start working on this project.</p>
              `,
              text: `New Project Assignment\n\nHello ${bdUser[0].firstName},\n\nProject: ${projectData.institution}\nSector: ${sector[0]?.name || "Unknown"}\n\nPlease log in to view details.`,
            });
          }
        } catch (emailError) {
          console.error("Failed to send project assignment email:", emailError);
        }
      }

      res.status(201).json({ project: newProject[0] });
    } catch (error) {
      console.error("Project creation error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Validation error",
          details: error.errors,
          receivedData: req.body,
        });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Update Project ────────────────────────────────────────────────────────
  app.put(
    "/api/marketing/projects/:id",
    marketingAuth,
    marketingAdminAuth,
    async (req, res) => {
      try {
        const { id } = req.params;
        console.log("Received project update request:", { id, body: req.body });

        const updateData = marketingProjectUpdateSchema.parse(req.body);
        console.log("Parsed update data:", updateData);

        const updatedProject = await db
          .update(marketingProjects)
          .set({ ...updateData, updatedAt: new Date().toISOString() } as any)
          .where(eq(marketingProjects.id, id as string))
          .returning();

        if (updatedProject.length === 0) {
          return res.status(404).json({ error: "Project not found" });
        }

        res.json({ project: updatedProject[0] });
      } catch (error) {
        console.error("Project update error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            error: "Validation error",
            details: error.errors,
            receivedData: req.body,
          });
        }
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ─── Assign Project to BD Member ───────────────────────────────────────────
  app.post(
    "/api/marketing/projects/:id/assign",
    marketingAuth,
    marketingAdminAuth,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { leadMarketer } = req.body;

        if (!leadMarketer) {
          return res.status(400).json({ error: "BD member assignment is required" });
        }

        const existingProject = await db
          .select()
          .from(marketingProjects)
          .where(eq(marketingProjects.id, id as string))
          .limit(1);

        if (existingProject.length === 0) {
          return res.status(404).json({ error: "Project not found" });
        }

        const bdUser = await db
          .select()
          .from(marketingUsers)
          .where(and(eq(marketingUsers.id, leadMarketer), eq(marketingUsers.isActive, true)))
          .limit(1);

        if (bdUser.length === 0) {
          return res.status(400).json({ error: "Invalid BD member" });
        }

        const updatedProject = await db
          .update(marketingProjects)
          .set({ leadMarketer, updatedAt: new Date().toISOString() })
          .where(eq(marketingProjects.id, id as string))
          .returning();

        const project = existingProject[0];
        const newProspect = await db
          .insert(marketingProspects)
          .values({
            date: new Date().toISOString(),
            client: project.institution,
            contactPerson: project.contactPerson || "To be determined",
            contactNumber: project.contactNumber || "To be determined",
            contactEmail: "To be determined",
            remarks: project.remarks
              ? `Converted from marketing project: ${project.institution}\n\nOriginal remarks: ${project.remarks}`
              : `Converted from marketing project: ${project.institution}`,
            stage: "opportunity",
            marketerId: leadMarketer,
            sectorId: project.sectorId,
            customerType: "institution",
          } as any)
          .returning();

        try {
          await emailService.sendEmail({
            to: bdUser[0].email,
            subject: `🎯 New Project Assignment: ${project.institution}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; padding: 20px;">
                <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                  <div style="text-align: center; margin-bottom: 30px;">
                    <div style="background-color: #3b82f6; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                      <h1 style="margin: 0; font-size: 24px;">🎯 Project Assignment</h1>
                    </div>
                    <p style="color: #6b7280; font-size: 16px; margin: 0;">A new project has been assigned to you</p>
                  </div>
                  <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                    <h2 style="color: #1e293b; margin-top: 0; margin-bottom: 15px; font-size: 20px;">📋 Project Details</h2>
                    <div style="margin-bottom: 10px;">
                      <strong style="color: #374151;">Institution:</strong>
                      <span style="color: #1f2937; margin-left: 8px;">${project.institution}</span>
                    </div>
                    <div style="margin-bottom: 10px;">
                      <strong style="color: #374151;">Prospect ID:</strong>
                      <span style="color: #1f2937; margin-left: 8px; font-family: monospace; background-color: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${newProspect[0].id}</span>
                    </div>
                    ${project.contactPerson && project.contactPerson !== "To be determined" ? `<div style="margin-bottom: 10px;"><strong style="color: #374151;">Contact Person:</strong><span style="color: #1f2937; margin-left: 8px;">${project.contactPerson}</span></div>` : ""}
                    ${project.contactNumber && project.contactNumber !== "To be determined" ? `<div style="margin-bottom: 10px;"><strong style="color: #374151;">Contact Number:</strong><span style="color: #1f2937; margin-left: 8px;">${project.contactNumber}</span></div>` : ""}
                  </div>
                  <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 25px;">
                    <h3 style="color: #92400e; margin-top: 0; margin-bottom: 10px;">🚀 Next Steps</h3>
                    <ul style="color: #92400e; margin: 0; padding-left: 20px;">
                      <li>Log in to your marketing dashboard</li>
                      <li>Review the prospect details in the Prospects section</li>
                      <li>Update contact information if needed</li>
                      <li>Begin your outreach and qualification process</li>
                    </ul>
                  </div>
                  <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5000"}/marketing/dashboard"
                       style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                      📊 View Dashboard
                    </a>
                  </div>
                  <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px; margin: 0;">This is an automated notification from TaskFlow Marketing Pipeline</p>
                  </div>
                </div>
              </div>
            `,
            text: `Project Assignment Notification\n\nHello ${bdUser[0].firstName},\n\nInstitution: ${project.institution}\nProspect ID: ${newProspect[0].id}\nContact Person: ${project.contactPerson || "To be determined"}\nContact Number: ${project.contactNumber || "To be determined"}\n\nDashboard: ${process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5000"}/marketing/dashboard`,
          });
        } catch (emailError) {
          console.error("Failed to send assignment email:", emailError);
        }

        res.json({
          message: "Project assigned successfully",
          project: updatedProject[0],
          prospect: newProspect[0],
        });
      } catch (error) {
        console.error("Failed to assign project:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );
}
