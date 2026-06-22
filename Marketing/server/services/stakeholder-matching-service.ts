import { db } from "../db";
import { stakeholders } from "../../shared/crmSchema";
import { eq, and, ilike } from "drizzle-orm";

/**
 * Centralized Stakeholder Matching Service
 * 
 * Used by both simulation and integrations to automatically match
 * incoming case data to existing stakeholder records in the database.
 * 
 * Matching priority:
 * 1. Registration number (most unique identifier)
 * 2. Email address
 * 3. Full name (firstName + lastName)
 */
export const StakeholderMatchingService = {

    /**
     * Attempts to find an existing stakeholder from signal/integration metadata.
     * Returns the stakeholder ID if found, null otherwise.
     * 
     * Expects metadata with any of:
     * - full_name / marker_name / setter_name / institution (e.g. "James Kamau")
     * - student_id / registration_number (e.g. "KAS/200000")
     * - email / stakeholder_email (e.g. "james.kamau@student.kasneb.or.ke")
     */
    async matchFromMetadata(metadata: Record<string, any>): Promise<string | null> {
        if (!metadata) return null;

        const regNumber = metadata.student_id || metadata.registration_number || metadata.registrationNumber || null;
        const email = metadata.email || metadata.stakeholder_email || null;
        const fullName = metadata.full_name || metadata.marker_name || metadata.setter_name || metadata.contact_name || null;

        // Priority 1: Match by registration number
        if (regNumber) {
            const [matched] = await db.select({ id: stakeholders.id })
                .from(stakeholders)
                .where(eq(stakeholders.registrationNumber, regNumber))
                .limit(1);
            if (matched) return matched.id;
        }

        // Priority 2: Match by email (Case-insensitive)
        if (email) {
            const [matched] = await db.select({ id: stakeholders.id })
                .from(stakeholders)
                .where(ilike(stakeholders.email, email))
                .limit(1);
            if (matched) return matched.id;
        }

        // Priority 3: Match by full name (firstName + lastName, Case-insensitive)
        if (fullName) {
            const parts = fullName.trim().split(/\s+/);
            if (parts.length >= 2) {
                const firstName = parts[0];
                const lastName = parts.slice(1).join(" ");
                const [matched] = await db.select({ id: stakeholders.id })
                    .from(stakeholders)
                    .where(and(
                        ilike(stakeholders.firstName, firstName),
                        ilike(stakeholders.lastName, lastName)
                    ))
                    .limit(1);
                if (matched) return matched.id;
            }
        }

        return null;
    },

    /**
     * Matches a stakeholder by a specific field value.
     * Useful for integrations that have a known identifier type.
     */
    async matchByField(field: "email" | "registrationNumber" | "nationalId", value: string): Promise<string | null> {
        if (!value) return null;

        const column = field === "email" ? stakeholders.email
            : field === "registrationNumber" ? stakeholders.registrationNumber
                : stakeholders.nationalId;

        const [matched] = await db.select({ id: stakeholders.id })
            .from(stakeholders)
            .where(eq(column, value))
            .limit(1);

        return matched?.id || null;
    }
};
