import type { Express } from "express";
import { db } from "../db";
import { marketingAuth, checkPermission } from "../middleware/marketingAuth";
import { accreditationProcesses, stakeholders } from "../../shared/crmSchema";
import { marketingUsers } from "../../shared/schema";
import { eq, desc, sql, aliasedTable } from "drizzle-orm";
import { z } from "zod";

export function registerAccreditationRoutes(app: Express) {
  // GET /api/accreditation
  app.get("/api/accreditation", marketingAuth, checkPermission("stakeholders.view_all"), async (req, res) => {
    try {
      // Query all institutions from stakeholders table
      const results = await db
        .select({
          stakeholderId: stakeholders.id,
          stage: stakeholders.lifecycleStage,
          stakeholderName: sql<string>`${stakeholders.firstName} || ' ' || ${stakeholders.lastName}`,
          organization: stakeholders.organization,
          // Pull additional data from accreditation_processes if it exists
          id: accreditationProcesses.id,
          status: accreditationProcesses.status,
          assignedOfficerId: accreditationProcesses.assignedOfficerId,
          applicationDate: accreditationProcesses.applicationDate,
          assessmentDate: accreditationProcesses.assessmentDate,
          decisionDate: accreditationProcesses.decisionDate,
          renewalDate: accreditationProcesses.renewalDate,
          slaDeadline: accreditationProcesses.slaDeadline,
          notes: accreditationProcesses.notes,
          createdAt: accreditationProcesses.createdAt,
          assignedOfficerName: sql<string>`${marketingUsers.firstName} || ' ' || ${marketingUsers.lastName}`,
        })
        .from(stakeholders)
        .leftJoin(accreditationProcesses, eq(stakeholders.id, accreditationProcesses.stakeholderId))
        .leftJoin(marketingUsers, eq(accreditationProcesses.assignedOfficerId, marketingUsers.id))
        .where(eq(stakeholders.type, 'institution'))
        .orderBy(desc(stakeholders.createdAt));

      // Map the results to ensure fallback values and proper ID formatting
      const mappedResults = results.map(row => ({
        id: row.id || `virtual-${row.stakeholderId}`,
        stakeholderId: row.stakeholderId,
        stage: row.stage || "inquiry",
        status: row.status || "pending",
        assignedOfficerId: row.assignedOfficerId,
        applicationDate: row.applicationDate,
        assessmentDate: row.assessmentDate,
        decisionDate: row.decisionDate,
        renewalDate: row.renewalDate,
        slaDeadline: row.slaDeadline,
        notes: row.notes,
        createdAt: row.createdAt || new Date().toISOString(),
        stakeholderName: row.stakeholderName || row.organization || "Unknown",
        organization: row.organization,
        assignedOfficerName: row.assignedOfficerName,
      }));

      res.json({ processes: mappedResults });
    } catch (error) {
      console.error("Error fetching accreditation processes:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/accreditation
  app.post("/api/accreditation", marketingAuth, checkPermission("stakeholders.create"), async (req, res) => {
    try {
      const { stakeholderId, notes } = req.body;
      if (!stakeholderId) {
        return res.status(400).json({ error: "stakeholderId is required" });
      }

      const newProcess = await db
        .insert(accreditationProcesses)
        .values({
          stakeholderId,
          stage: "inquiry",
          status: "pending",
          notes: notes || "",
        })
        .returning();

      res.status(201).json({ process: newProcess[0] });
    } catch (error) {
      console.error("Error creating accreditation process:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PATCH /api/accreditation/:id
  app.patch("/api/accreditation/:id", marketingAuth, checkPermission("stakeholders.edit"), async (req, res) => {
    try {
      const { id } = req.params;
      const { stage, status, assignedOfficerId, notes } = req.body;

      const updates: any = {};
      if (stage !== undefined) updates.stage = stage;
      if (status !== undefined) updates.status = status;
      if (assignedOfficerId !== undefined) updates.assignedOfficerId = assignedOfficerId;
      if (notes !== undefined) updates.notes = notes;

      // Automatically set dates based on stage changes
      if (stage === "application_submitted") {
        updates.applicationDate = sql`now()`;
        // Set 90-day SLA deadline
        updates.slaDeadline = sql`now() + interval '90 days'`;
      } else if (stage === "assessment_visit") {
        updates.assessmentDate = sql`now()`;
      } else if (stage === "active_partner") {
        updates.decisionDate = sql`now()`;
      }

      let updatedProcess;
      
      const processId = id as string;

      if (processId.startsWith('virtual-')) {
        const stakeholderId = processId.replace('virtual-', '');
        
        // Ensure stakeholder exists
        const sh = await db.select().from(stakeholders).where(eq(stakeholders.id, stakeholderId)).limit(1);
        if (!sh.length) {
          return res.status(404).json({ error: "Stakeholder not found" });
        }

        const inserted = await db
          .insert(accreditationProcesses)
          .values({
            stakeholderId,
            stage: stage || "inquiry",
            status: status || "pending",
            assignedOfficerId,
            notes: notes || "",
            ...updates
          })
          .returning();
          
        updatedProcess = inserted[0];

        // Update stakeholder lifecycle stage
        if (stage !== undefined) {
          await db.update(stakeholders)
            .set({ lifecycleStage: stage })
            .where(eq(stakeholders.id, stakeholderId));
        }

      } else {
        const updated = await db
          .update(accreditationProcesses)
          .set({ ...updates, updatedAt: sql`now()` })
          .where(eq(accreditationProcesses.id, id as string))
          .returning();

        if (!updated.length) {
          return res.status(404).json({ error: "Process not found" });
        }
        updatedProcess = updated[0];

        // Also update the associated stakeholder's lifecycle stage
        if (stage !== undefined && updatedProcess.stakeholderId) {
          await db.update(stakeholders)
            .set({ lifecycleStage: stage })
            .where(eq(stakeholders.id, updatedProcess.stakeholderId));
        }
      }

      res.json({ process: updatedProcess });
    } catch (error) {
      console.error("Error updating accreditation process:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
