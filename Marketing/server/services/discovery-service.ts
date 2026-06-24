import { db } from "../db";
import { stakeholders, stakeholderRelationships, cases } from "../../shared/crmSchema";
import { departments } from "../../shared/adminSchema";
import { marketingUsers } from "../../shared/schema";
import { eq, and, or, sql, ilike, ne, inArray, isNotNull } from "drizzle-orm";

/**
 * DiscoveryService
 * 
 * Automatically identifies and persists relationships between stakeholders
 * based on organization fields, email domains (secondary), and case metadata.
 */
export const DiscoveryService = {
    /**
     * Runs all discovery logic across the entire stakeholder database.
     * Idempotent: Can be run multiple times safely.
     */
    async discoverAll() {
        console.log("[Discovery] Starting automated anchor sync & relationship mapping...");
        const start = Date.now();
        try {
            // Surgical cleanup: Remove any existing self-links created by previous logic
            await db.delete(stakeholderRelationships).where(sql`${stakeholderRelationships.stakeholderAId} = ${stakeholderRelationships.stakeholderBId}`);

            await this.ensureAnchorsExist();

            await this.linkAlumniToEntities();
            console.log(`[Discovery] Relationship mapping complete in ${Date.now() - start}ms.`);
        } catch (error) {
            console.error("[Discovery] Error during discovery:", error);
        }
    },

    /**
     * Executes targeted discovery for a specific stakeholder.
     * Triggers real-time relationship mapping.
     */
    async discoverForStakeholder(stakeholderId: string) {
        console.log(`[Discovery] Running real-time discovery for stakeholder: ${stakeholderId}`);
        const start = Date.now();
        try {
            const [s] = await db.select().from(stakeholders).where(eq(stakeholders.id, stakeholderId)).limit(1);
            if (!s) return;

            // 1. Ensure their specific anchor exists if they have an organization
            if (s.organization) {
                await this.ensureAnchorForStakeholder(s);
            }

            // 2. Run targeted strategies
            await this.linkAlumniToEntities(stakeholderId);

            console.log(`[Discovery] Real-time mapping complete for ${stakeholderId} in ${Date.now() - start}ms.`);
        } catch (error) {
            console.error(`[Discovery] Error during real-time discovery for ${stakeholderId}:`, error);
        }
    },

    /**
     * Ensures an anchor exists for a specific stakeholder's organization.
     */
    async ensureAnchorForStakeholder(s: any) {
        if (!s.organization) return;

        const orgName = s.organization.trim();
        const existing = await db.select().from(stakeholders).where(and(
            eq(stakeholders.organization, orgName),
            inArray(stakeholders.type, ["institution", "employer", "department"])
        )).limit(1);

        if (existing.length === 0) {
            console.log(`[Discovery] creating on-the-fly anchor for: ${orgName}`);
            const isInstitution = /university|college|school|institute/i.test(orgName);
            await db.insert(stakeholders).values({
                firstName: orgName,
                lastName: "",
                organization: orgName,
                type: (isInstitution ? "institution" : "employer") as any,
                isActive: true
            });
        }
    },

    /**
     * Phase 0: Automated Anchor Sync
     * Ensures stakeholders exist for every Department and unique Organization string.
     */
    async ensureAnchorsExist() {
        console.log("[Discovery] Phase 0: Syncing Department & Organization anchors...");

        // 2. Sync Organizations (Institutions/Employers) from data strings
        const uniqueOrgs = await db.select({ org: sql<string>`DISTINCT ${stakeholders.organization}` })
            .from(stakeholders)
            .where(and(
                isNotNull(stakeholders.organization),
                ne(stakeholders.organization, ""),
                inArray(stakeholders.type, ["student", "employer", "marker", "setter"])
            ));

        const existingOrgStakeholders = await db.select({ organization: stakeholders.organization })
            .from(stakeholders)
            .where(inArray(stakeholders.type, ["institution", "employer"]));

        const existingOrgNames = new Set(existingOrgStakeholders.map(s => s.organization?.toLowerCase()));

        const orgsToCreate = uniqueOrgs
            .filter(o => o.org && !existingOrgNames.has(o.org.toLowerCase()))
            .map(o => ({
                firstName: o.org,
                lastName: "",
                organization: o.org,
                type: "institution" as any, // Placeholder, refined below
                isActive: true
            }));

        if (orgsToCreate.length > 0) {
            console.log(`[Discovery] Creating ${orgsToCreate.length} missing organization anchors...`);
            // Refine type based on if we find 'University' or 'School' etc.
            const uniqueToCreate = Array.from(new Map(orgsToCreate.map(o => [o.organization.toLowerCase(), o])).values());

            const withRefinedTypes = uniqueToCreate.map(o => {
                const isInstitution = /university|college|school|institute/i.test(o.organization);
                return {
                    ...o,
                    type: (isInstitution ? "institution" : "employer") as any
                };
            });
            await db.insert(stakeholders).values(withRefinedTypes);
        }
    },

    /**
     * Batch inserts relationships to minimize round-trips.
     * Requires the unique index on (stakeholder_a_id, stakeholder_b_id, relationship_type).
     */
    async batchUpsert(links: any[]) {
        if (!links || links.length === 0) return;

        // Deduplicate and ensure deterministic order for link pairs
        const uniqueMap = new Map<string, any>();

        links.forEach(l => {
            const [id1, id2] = l.stakeholderAId < l.stakeholderBId
                ? [l.stakeholderAId, l.stakeholderBId]
                : [l.stakeholderBId, l.stakeholderAId];

            const key = `${id1}-${id2}-${l.relationshipType}`;
            uniqueMap.set(key, {
                stakeholderAId: id1,
                stakeholderBId: id2,
                relationshipType: l.relationshipType,
                description: l.description,
            });
        });

        const normalized = Array.from(uniqueMap.values());

        // Chunking to prevent overly large single queries
        const chunkSize = 100;
        for (let i = 0; i < normalized.length; i += chunkSize) {
            const chunk = normalized.slice(i, i + chunkSize);
            await db.insert(stakeholderRelationships)
                .values(chunk as any)
                .onConflictDoUpdate({
                    target: [
                        stakeholderRelationships.stakeholderAId,
                        stakeholderRelationships.stakeholderBId,
                        stakeholderRelationships.relationshipType
                    ],
                    set: {
                        description: sql`excluded.description`
                    }
                });
        }
    },



    /**
     * Strategy 2: Case Metadata Matching
     * Links Markers/Setters to specific Subjects based on their case history.
     */
    async linkMarkersByMetadata(targetId?: string) {
        console.log(`[Discovery] Phase 2: Linking Markers via Case History ${targetId ? `for ${targetId}` : "(Batch)"}...`);

        const query = db.select({
            stakeholder: stakeholders,
            case: cases
        })
            .from(stakeholders)
            .innerJoin(cases, eq(stakeholders.id, cases.stakeholderId))
            .where(and(
                or(eq(stakeholders.type, "marker"), eq(stakeholders.type, "setter")),
                targetId ? eq(stakeholders.id, targetId) : undefined
            ));

        const data = await query;
        if (data.length === 0) return;

        const examinerMap: Record<string, { stakeholder: any, cases: any[] }> = {};
        for (const item of data) {
            if (!examinerMap[item.stakeholder.id]) {
                examinerMap[item.stakeholder.id] = { stakeholder: item.stakeholder, cases: [] };
            }
            examinerMap[item.stakeholder.id].cases.push(item.case);
        }

        const allLinks: any[] = [];
        const pattern = /(CPA|CS|CIFA|CICT|CCP|DCM|Management Accounting|Taxation|Auditing|Financial Reporting|Economics)/gi;

        for (const ex of Object.values(examinerMap)) {
            const subjects = new Set<string>();
            for (const c of ex.cases) {
                const matches = c.title.match(pattern);
                if (matches) matches.forEach((m: string) => subjects.add(m.toUpperCase()));
            }

            for (const sub of subjects) {
                allLinks.push({
                    stakeholderAId: ex.stakeholder.id,
                    stakeholderBId: ex.stakeholder.id,
                    relationshipType: "marker_subject",
                    description: `Active expertise: ${sub}`
                });
            }
        }

        await this.batchUpsert(allLinks);
    },

    /**
     * Strategy 5: Alumni Network (Ghost Links)
     * Links Alumni to their current Employers while maintaining a link to 
     * their graduation Institution for career tracking.
     */
    async linkAlumniToEntities(targetId?: string) {
        console.log(`[Discovery] Phase 5: Linking Alumni Network ${targetId ? `for ${targetId}` : "(Batch)"}...`);

        const query = db.select().from(stakeholders).where(and(
            eq(stakeholders.lifecycleStage, "alumni"),
            isNotNull(stakeholders.organization),
            ne(stakeholders.organization, ""),
            targetId ? eq(stakeholders.id, targetId) : undefined
        ));

        const alumni = await query;
        if (alumni.length === 0) return;

        const allLinks: any[] = [];
        for (const al of alumni) {
            const currentOrg = al.organization!.trim();
            const metadata = (al.metadata as any) || {};
            const gradInstitution = metadata.alumni_institution;

            // 1. Link to CURRENT Employer
            const [employerAnchor] = await db.select().from(stakeholders).where(and(
                eq(stakeholders.organization, currentOrg),
                eq(stakeholders.type, "employer")
            )).limit(1);

            if (employerAnchor) {
                allLinks.push({
                    stakeholderAId: employerAnchor.id,
                    stakeholderBId: al.id,
                    relationshipType: "alumni_employer",
                    description: `Alumnus working at ${currentOrg}`
                });
            }

            // 2. Link to GRADUATION Institution (The Ghost Link)
            // If we have a specific name in metadata, use it. 
            // Otherwise, we look for 'university'/'college' in their current org (if they haven't updated it yet)
            const instName = gradInstitution || (currentOrg.match(/university|college|school|institute/i) ? currentOrg : null);

            if (instName) {
                const [instAnchor] = await db.select().from(stakeholders).where(and(
                    eq(stakeholders.organization, instName),
                    eq(stakeholders.type, "institution")
                )).limit(1);

                if (instAnchor) {
                    allLinks.push({
                        stakeholderAId: instAnchor.id,
                        stakeholderBId: al.id,
                        relationshipType: "alumni_institution",
                        description: `Graduated from ${instName}`
                    });
                }
            }
        }

        await this.batchUpsert(allLinks);
    }
};
