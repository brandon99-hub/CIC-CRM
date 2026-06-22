import { db } from "../db";
import { marketingUsers } from "../../shared/schema";
import { stakeholders, intakeSignals, cases, caseHistory, caseComments, caseAttachments, stakeholderInteractions, stakeholderRelationships } from "../../shared/crmSchema";
import { DiscoveryService } from "./discovery-service";
import { serviceCategories, systemRoles, slaRules } from "../../shared/adminSchema";
import { IntakeSignal } from "./categorization-service";
import { NLPService } from "./nlp-service";
import { AssignmentService } from "./assignment-service";
import { StakeholderMatchingService } from "./stakeholder-matching-service";
import { eq, or, and, count, sql } from "drizzle-orm";

// --- Realistic randomized data pools per portal ---

const firstNames = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "David", "Barbara", "Kevin", "Amina", "Brian", "Joyce", "Samuel", "Grace", "Daniel", "Faith", "Peter", "Mercy"];
const lastNames = ["Kamau", "Otieno", "Mwangi", "Wanjiru", "Odhiambo", "Kimani", "Wambua", "Njoroge", "Achieng", "Mutua", "Kirui", "Kiplangat", "Nyambura", "Chege", "Owino", "Nzuri", "Koech", "Mugo"];
const institutions = ["Strathmore University", "KCA University", "Mount Kenya University", "Daystar University", "JKUAT", "Zetech University", "USIU-Africa", "Kenya Institute of Management"];
const programmes = ["CFFE", "CPA", "CS", "CIFA", "CCP", "CISSE", "CQP", "ATD", "DDMA", "DCNSA", "CAMS"];
const examSubjects = ["Management Accounting", "Advanced Taxation", "Auditing", "Financial Reporting", "Economics", "Business Law", "Corporate Governance", "Investment Analysis"];
const counties = ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika", "Nyeri", "Kisii", "Kakamega"];
const companies = ["Kenya Power", "Safaricom PLC", "KCB Group", "Equity Bank", "Standard Chartered", "NCBA Bank", "Nation Media Group", "East African Breweries", "Bamburi Cement"];
const industries = ["Banking & Finance", "Telecommunications", "Energy", "Manufacturing", "Media & Communications", "Insurance", "Real Estate"];

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randId = (prefix: string) => `${prefix}/${100000 + Math.floor(Math.random() * 899999)}`;
const randRef = () => `REF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
const randAmount = () => (Math.floor(Math.random() * 20) + 1) * 500;

// --- Stakeholder Seeding ---

interface StakeholderSeed {
    type: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    registrationNumber: string;
    organization: string;
    county: string;
    metadata: Record<string, any>;
}

async function generateStakeholderSeeds(): Promise<any[]> {
    const seeds: any[] = [];
    const usedEmails = new Set<string>();

    const makeEmail = (first: string, last: string, domain: string): string => {
        let email = `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`;
        let counter = 1;
        while (usedEmails.has(email)) {
            email = `${first.toLowerCase()}.${last.toLowerCase()}${counter}@${domain}`;
            counter++;
        }
        usedEmails.add(email);
        return email;
    };

    const makePhone = () => `+2547${Math.floor(10000000 + Math.random() * 89999999)}`;

    const generateSeedGroup = (
        type: string,
        domainSuffix: string,
        regPrefix: string,
        orgType: 'institution' | 'company' | 'kasneb',
        customFields: (i: number) => Record<string, any>
    ) => {
        for (let i = 0; i < 5; i++) {
            const fn = pick(firstNames);
            const ln = pick(lastNames);
            
            let org = "KASNEB";
            if (orgType === 'institution') org = pick(institutions);
            else if (orgType === 'company') org = pick(companies);
            
            
            const custom = customFields(i);
            
            seeds.push({
                type,
                firstName: fn,
                lastName: ln,
                email: makeEmail(fn, ln, domainSuffix),
                phone: makePhone(),
                registrationNumber: `${regPrefix}/${Math.floor(100000 + Math.random() * 899999)}`,
                organization: org,
                county: pick(counties),
                country: custom.country || "Kenya",
                region: custom.region || "East Africa",
                qualificationPathway: custom.qualificationPathway || (type === 'student' || type === 'alumni' || type === 'international_student' ? pick(programmes) : null),
                institutionAttachedTo: orgType === 'institution' ? org : null,
                registrationHistory: custom.registrationHistory || [],
                examinationHistory: custom.examinationHistory || [],
                paymentHistory: custom.paymentHistory || [],
                certificatesAwarded: custom.certificatesAwarded || [],
                metadata: custom.metadata || {}
            });
        }
    };

    // 1. student
    generateSeedGroup("student", "student.kasneb.or.ke", "KAS", "institution", () => ({
        registrationHistory: [
            { date: "2023-01-15T08:00:00Z", status: "Active", type: "Initial Registration" },
            { date: "2024-01-10T08:00:00Z", status: "Active", type: "Renewal" }
        ],
        examinationHistory: [
            { subject: pick(examSubjects), result: "Pass", series: "Dec 2023", score: 68 },
            { subject: pick(examSubjects), result: "Pass", series: "May 2024", score: 72 }
        ],
        paymentHistory: [
            { amount: Math.floor(Math.random() * 5000) + 1000, date: new Date().toISOString(), type: "Exam Fee", status: "Completed", reference: randRef() },
            { amount: 2000, date: "2024-01-10T08:00:00Z", type: "Renewal Fee", status: "Completed", reference: randRef() }
        ],
        certificatesAwarded: []
    }));

    // 2. alumni
    generateSeedGroup("alumni", "alumni.kasneb.or.ke", "ALU", "company", () => ({
        registrationHistory: [{ date: "2018-01-15T08:00:00Z", status: "Completed", type: "Initial Registration" }],
        examinationHistory: [
            { subject: pick(examSubjects), result: "Pass", series: "Dec 2018", score: 75 },
            { subject: pick(examSubjects), result: "Pass", series: "May 2019", score: 80 }
        ],
        paymentHistory: [{ amount: 1500, date: new Date().toISOString(), type: "Alumni Fee", status: "Completed", reference: randRef() }],
        certificatesAwarded: [{ certificate: "CPA Finalist Certificate", issueDate: "2020-01-15T00:00:00Z", validUntil: "2025-01-15T00:00:00Z" }]
    }));

    // 3. institution
    generateSeedGroup("institution", "ac.ke", "INS", "institution", () => ({
        metadata: {
            accreditation_status: "Active",
            student_population: 500 + Math.floor(Math.random() * 2000)
        },
        registrationHistory: [
            { date: "2020-01-15T08:00:00Z", status: "Active", type: "Initial Accreditation" },
            { date: "2023-01-10T08:00:00Z", status: "Active", type: "Accreditation Renewal" }
        ]
    }));

    // 4. employer
    generateSeedGroup("employer", "co.ke", "EMP", "company", () => ({
        metadata: {
            industry: pick(industries),
            verification_requests_last_30_days: Math.floor(Math.random() * 20)
        }
    }));

    // 5. corporate_partner
    generateSeedGroup("corporate_partner", "partner.co.ke", "CORP", "company", () => ({
        metadata: {
            partnership_level: pick(["Gold", "Silver", "Platinum"]),
            active_agreements: 1
        }
    }));

    // 6. government_agency
    generateSeedGroup("government_agency", "go.ke", "GOV", "company", () => ({
        metadata: {
            agency_type: pick(["Regulatory", "Ministry", "State Corporation"]),
            joint_initiatives: Math.floor(Math.random() * 3)
        }
    }));

    // 7. media
    generateSeedGroup("media", "media.co.ke", "MED", "company", () => ({
        metadata: {
            media_type: pick(["Print", "Digital", "TV", "Radio"]),
            press_releases_received: Math.floor(Math.random() * 10)
        }
    }));

    // 8. sponsor
    generateSeedGroup("sponsor", "sponsor.org", "SPO", "company", () => ({
        metadata: {
            sponsorship_type: pick(["Scholarship", "Event", "Infrastructure"]),
            students_sponsored: Math.floor(Math.random() * 50) + 5
        }
    }));

    // 9. international_student
    generateSeedGroup("international_student", "student.kasneb.org", "INT", "institution", () => {
        const intlCountry = pick(["Rwanda", "Cameroon"]);
        let countyStr = "Kigali";
        if (intlCountry === "Rwanda") {
            countyStr = pick(["Kigali", "Butare", "Gitarama", "Ruhengeri", "Gisenyi"]);
        } else if (intlCountry === "Cameroon") {
            countyStr = pick(["Yaoundé", "Douala", "Garoua", "Bamenda", "Maroua"]);
        }
        return {
            country: intlCountry,
            county: countyStr,
            region: "International",
            registrationHistory: [{ date: "2024-01-15T08:00:00Z", status: "Active", type: "Initial Registration" }],
            examinationHistory: [{ subject: pick(examSubjects), result: "Pass", series: "Aug 2024", score: 60 }],
            paymentHistory: [{ amount: 5000, date: new Date().toISOString(), type: "International Exam Fee", status: "Completed", reference: randRef() }],
            certificatesAwarded: []
        };
    });

    // 10. vendor
    generateSeedGroup("vendor", "vendor.co.ke", "VEN", "company", () => ({
        metadata: {
            services_provided: pick(["IT Support", "Stationery", "Consulting"]),
            contract_status: "Active"
        }
    }));

    return seeds;
}


type TemplateFn = (s?: any) => { text: string; metadata: Record<string, any> };

// --- Portal-specific signal template pools ---
// Updated to accept an optional stakeholder for realistic data injection

const channelTemplates: Record<string, TemplateFn[]> = {
    email: [
        (s) => {
            const name = s ? `${s.firstName} ${s.lastName}` : "John Doe";
            const email = s?.email || `john.doe${Math.floor(Math.random()*100)}@gmail.com`;
            const subject = pick(examSubjects);
            const reg = s?.registrationNumber || randId("KAS");
            return {
                text: `Hello KASNEB,\n\nI checked the portal but my results for ${subject} are missing. I sat for the exam last series. Can someone look into this?\n\nReg number: ${reg}`,
                metadata: { email, firstName: s?.firstName || "John", lastName: s?.lastName || "Doe", source: "email", registrationNumber: reg }
            };
        },
        (s) => {
            const institution = pick(institutions);
            const email = `admin@${institution.replace(/\s+/g, '').toLowerCase()}.ac.ke`;
            return {
                text: `Dear KASNEB,\n\nI am writing on behalf of ${institution} to formally request accreditation to offer the CPA and CS programmes. We have modern facilities and would like to understand the inspection requirements and syllabus guidelines.`,
                metadata: { email, organization: institution, request_type: "accreditation", source: "email" }
            };
        }
    ],
    call: [
        (s) => {
            const name = s ? `${s.firstName} ${s.lastName}` : pick(firstNames);
            const reg = s?.registrationNumber || randId("KAS");
            return {
                text: `[VOICE TRANSCRIPT] Yeah hi, I am calling because I have been trying to pay for my ${pick(programmes)} exam registration but M-PESA keeps failing. My Kasneb ID is ${reg}. Can someone help me before the deadline?`,
                metadata: { full_name: name, registration_number: reg, source: "call", urgency: "high" }
            };
        }
    ],
    whatsapp: [
        (s) => {
            const name = s ? `${s.firstName} ${s.lastName}` : pick(firstNames);
            return {
                text: `Hi KASNEB. Need help ASAP. My certificate was supposed to be dispatched yesterday. Has it been sent? 😭`,
                metadata: { full_name: name, source: "whatsapp", platform: "whatsapp" }
            };
        }
    ],
    live_chat: [
        (s) => {
            const name = s ? `${s.firstName} ${s.lastName}` : "Guest user";
            const prog = pick(programmes);
            return {
                text: `Hi there, I am looking to enroll in the ${prog} program. What are the minimum requirements?`,
                metadata: { full_name: name, source: "live_chat", intent: "enrollment" }
            };
        }
    ],
    chatbot: [
        (s) => {
            const reg = s?.registrationNumber || randId("KAS");
            return {
                text: `[BOT ESCALATION] User requested human agent. Chat log: "I need to dispute my grading for ${pick(examSubjects)}. Kasneb ID: ${reg}."`,
                metadata: { registration_number: reg, source: "chatbot", escalation_reason: "dispute" }
            };
        }
    ],
    facebook: [
        (s) => {
            const name = s ? `${s.firstName} ${s.lastName}` : "Angry Customer";
            return {
                text: `KASNEB's customer service is terrible! Been waiting 3 weeks for my certificate and no one answers the phone! - ${name} #KASNEB`,
                metadata: { platform: "facebook", full_name: name, source: "facebook", sentiment: "negative" }
            };
        }
    ],
    instagram: [
        (s) => {
            const prog = pick(programmes);
            const name = s ? `${s.firstName} ${s.lastName}` : "Student";
            return {
                text: `Just passed all ${prog} papers! Shoutout to KASNEB for the curriculum. 🎓🙌`,
                metadata: { platform: "instagram", full_name: name, source: "instagram", sentiment: "positive" }
            };
        }
    ],
    linkedin: [
        (s) => {
            const company = pick(companies);
            return {
                text: `We at ${company} are looking to partner with KASNEB to provide corporate training and sponsorships. Who can we reach out to?`,
                metadata: { platform: "linkedin", company, source: "linkedin", request_type: "sponsorship" }
            };
        }
    ],
    tiktok: [
        (s) => {
            const prog = pick(programmes);
            return {
                text: `Can someone explain the difference between ${prog} and the other programmes? The website is so confusing tbh 🤔`,
                metadata: { platform: "tiktok", source: "tiktok", intent: "inquiry" }
            };
        }
    ],
    website: [
        (s) => {
            const company = s?.organization || pick(companies);
            const candidate = `${pick(firstNames)} ${pick(lastNames)}`;
            return {
                text: `[WEBSITE FORM] ${company} is requesting verification of a certificate for candidate ${candidate}.`,
                metadata: { company, source: "website", request_type: "verification" }
            };
        }
    ],
    walk_in: [
        (s) => {
            const name = s ? `${s.firstName} ${s.lastName}` : "Walk-in Client";
            return {
                text: `[FRONT DESK LOG] Client visited branch to collect their ${pick(programmes)} certificate but brought the wrong ID. Requested a hold for 2 days.`,
                metadata: { full_name: name, source: "walk_in", priority: "low" }
            };
        }
    ],
    sms: [
        (s) => {
            const reg = s?.registrationNumber || randId("KAS");
            return {
                text: `My M-PESA payment for exam booking failed. Ref ID is ${randRef()}. Kasneb ID ${reg}.`,
                metadata: { source: "sms", registration_number: reg }
            };
        }
    ]
};

// --- Source label mapping for each channel ---
const channelSourceMap: Record<string, string> = {
    call: "call",
    email: "email",
    whatsapp: "whatsapp",
    live_chat: "live_chat",
    chatbot: "chatbot",
    facebook: "facebook",
    instagram: "instagram",
    linkedin: "linkedin",
    tiktok: "tiktok",
    website: "website",
    walk_in: "walk_in",
    sms: "sms"
};

const channelStakeholderTypeMap: Record<string, string> = {
    call: "student",
    email: "student",
    whatsapp: "student",
    live_chat: "student",
    chatbot: "student",
    facebook: "student",
    instagram: "student",
    linkedin: "employer",
    tiktok: "student",
    website: "institution",
    walk_in: "student",
    sms: "student"
};

import { AnalyticsService } from "./analytics-service";

export const SimulationService = {
    /**
     * Seeds 5 unique stakeholders per type group (50 total).
     * Idempotent: skips if stakeholders already exist.
     */
    async seedStakeholders() {
        // We'll generate a variety of stakeholders
        const seeds = await generateStakeholderSeeds();
        let created = 0;
        let updated = 0;

        for (const seed of seeds) {
            // Check if this exact stakeholder already exists
            const [existing] = await db.select({ id: stakeholders.id })
                .from(stakeholders)
                .where(eq(stakeholders.registrationNumber, seed.registrationNumber))
                .limit(1);

            // Calculate risk based on the metadata using AnalyticsService
            const riskLevel = await AnalyticsService.calculateRiskLevel(existing?.id || "temp", seed.metadata);

            let lifecycleStage = "active";
            if (seed.type === "student" || seed.type === "international_student") {
                lifecycleStage = "registered";
            } else if (seed.type === "institution") {
                lifecycleStage = "accredited";
            }

            const stakeholderData = {
                type: seed.type,
                lifecycleStage,
                firstName: seed.firstName,
                lastName: seed.lastName,
                email: seed.email,
                phone: seed.phone,
                registrationNumber: seed.registrationNumber,
                organization: seed.organization,
                county: seed.county,
                country: seed.country,
                region: seed.region,
                qualificationPathway: seed.qualificationPathway,
                institutionAttachedTo: seed.institutionAttachedTo,
                engagementScore: 0,
                riskLevel,
                preferredChannel: pick(["email", "phone", "portal"]),
                registrationHistory: seed.registrationHistory,
                examinationHistory: seed.examinationHistory,
                paymentHistory: seed.paymentHistory,
                certificatesAwarded: seed.certificatesAwarded,
                metadata: seed.metadata,
                updatedAt: new Date().toISOString()
            };

            if (!existing) {
                await db.insert(stakeholders).values({
                    ...stakeholderData,
                    createdAt: new Date().toISOString()
                } as any);
                created++;
            } else {
                await db.update(stakeholders)
                    .set(stakeholderData as any)
                    .where(eq(stakeholders.id, existing.id));
                updated++;
            }
        }

        return { message: `Stakeholder seeding complete. Created: ${created}, Updated: ${updated}`, count: created + updated };
    },

    /**
     * Simulates an inbound signal from any source (Portal, Social, Walk-in)
     * with automatic stakeholder matching
     */
    async simulateSignal(signal: IntakeSignal) {
        console.log(`[Simulation] Processing signal from ${signal.source}: "${signal.text.substring(0, 60)}..."`);

        // 1. Trigger NLP Categorization
        const nlpResult = await NLPService.matchCategory(signal.text);

        // 2. Auto-match stakeholder from signal metadata
        let finalStakeholderId = await StakeholderMatchingService.matchFromMetadata(signal.metadata || {});
        if (finalStakeholderId) {
            console.log(`[Simulation] Auto-matched stakeholder: ${finalStakeholderId}`);
        } else {
            console.log(`[Simulation] No stakeholder match found for signal metadata.`);
            // Auto-create stakeholder if email is provided
            if (signal.metadata?.email) {
                const [existing] = await db.select().from(stakeholders).where(eq(stakeholders.email, signal.metadata.email)).limit(1);
                if (existing) {
                    finalStakeholderId = existing.id;
                } else {
                    let type = "student";
                    let lifecycleStage = "registered";
                    // If it's an accreditation request, create an institution in inquiry stage
                    if (signal.source === "accreditation_portal" || signal.metadata?.request_type === "accreditation") {
                        type = "institution";
                        lifecycleStage = "inquiry";
                    }
                    
                    const [newStakeholder] = await db.insert(stakeholders).values({
                        type,
                        lifecycleStage,
                        firstName: signal.metadata?.firstName || "Unknown",
                        lastName: signal.metadata?.lastName || "Sender",
                        email: signal.metadata.email,
                        organization: signal.metadata?.organization || "Unknown",
                        registrationNumber: randId(type === "institution" ? "ACC" : "KAS"),
                        preferredChannel: "email",
                        createdAt: new Date().toISOString()
                    } as any).returning();
                    finalStakeholderId = newStakeholder.id;
                    console.log(`[Simulation] Auto-created new stakeholder: ${finalStakeholderId} (${type})`);
                }
            }
        }

        // 3. Insert into Intake Signals (Triage Queue)
        const [intakeSignal] = await db.insert(intakeSignals).values({
            source: signal.source,
            rawText: signal.text,
            metadata: signal.metadata || {},
            stakeholderId: finalStakeholderId,
            suggestedCategoryId: nlpResult.categoryId,
            confidenceScore: nlpResult.confidence,
            status: nlpResult.confidence > 70 ? "mapped" : "pending"
        } as any).returning();

        let createdCase = null;

        // 4. Auto-create case if confidence is high
        if (nlpResult.confidence > 70 && nlpResult.categoryId) {
            const [targetCategory] = await db.select().from(serviceCategories).where(eq(serviceCategories.id, nlpResult.categoryId)).limit(1);

            if (targetCategory) {
                const yearShort = new Date().getFullYear().toString().slice(-2);
                const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
                const caseNumber = `KASNEB-${yearShort}-${random}`;

                // Compute SLA deadlines from SLA rules
                let slaDeadline = null;
                let slaResponseDeadline = null;
                const priorityToMatch = targetCategory.defaultPriority || "medium";
                
                let slaRuleResult = await db.select()
                    .from(slaRules)
                    .where(and(
                        eq(slaRules.serviceCategoryId, targetCategory.id),
                        eq(slaRules.priority, priorityToMatch),
                        eq(slaRules.isActive, true)
                    ))
                    .limit(1);
                    
                if (slaRuleResult.length === 0) {
                    slaRuleResult = await db.select()
                        .from(slaRules)
                        .where(and(eq(slaRules.serviceCategoryId, targetCategory.id), eq(slaRules.isActive, true)))
                        .limit(1);
                }

                if (slaRuleResult.length > 0) {
                    const slaRule = slaRuleResult[0];
                    const now = new Date();
                    if (slaRule.responseTimeMinutes) slaResponseDeadline = new Date(now.getTime() + slaRule.responseTimeMinutes * 60000).toISOString();
                    if (slaRule.timeline) {
                        let mins = slaRule.timeline;
                        if (slaRule.timelineUnit === "hours") mins *= 60;
                        else if (slaRule.timelineUnit === "working days") mins *= 8 * 60;
                        else if (slaRule.timelineUnit === "days") mins *= 24 * 60;
                        else if (slaRule.timelineUnit !== "minutes") mins *= 60; // fallback
                        
                        slaDeadline = new Date(now.getTime() + mins * 60000).toISOString();
                    }
                }

                const [newCase] = await db.insert(cases).values({
                    caseNumber,
                    title: signal.text.substring(0, 80),
                    description: signal.text,
                    stakeholderId: finalStakeholderId,
                    serviceCategoryId: targetCategory.id,
                    priority: targetCategory.defaultPriority || "medium",
                    status: "open",
                    channel: signal.source as any,
                    assignedDepartment: targetCategory.departmentId,
                    slaDeadline,
                    slaResponseDeadline,
                    metadata: {
                        ...(signal.metadata as any),
                        simulated: true,
                        nlp_confidence: nlpResult.confidence,
                        nlp_tokens: nlpResult.tokensFound
                    }
                } as any).returning();

                createdCase = newCase;

                // Update intake signal with mapped case
                await db.update(intakeSignals).set({
                    mappedCaseId: newCase.id,
                    status: "mapped"
                }).where(eq(intakeSignals.id, intakeSignal.id));

                // 5. Log the initial signal as a Stakeholder Interaction if matched
                // This ensures it appears in the Communication card and timeline
                if (finalStakeholderId) {
                    await db.insert(stakeholderInteractions).values({
                        stakeholderId: finalStakeholderId,
                        caseId: newCase.id,
                        type: "portal_submission",
                        channel: signal.source as any,
                        direction: "inbound",
                        subject: nlpResult.categoryId ? "New Portal Case" : "Portal Inquiry",
                        description: signal.text,
                        metadata: signal.metadata || {},
                        date: new Date().toISOString()
                    } as any);
                    console.log(`[Simulation] Logged interaction for stakeholder ${finalStakeholderId} on case ${caseNumber}`);
                }

                // 6. Trigger Auto-Assignment if a category exists
                if (targetCategory.departmentId) {
                    const [officerRole] = await db.select().from(systemRoles).where(eq(systemRoles.name, "Case Management Officer")).limit(1);
                    if (officerRole) {
                        await AssignmentService.autoAssignCase(newCase.id, officerRole.id, targetCategory.departmentId);
                        console.log(`[Simulation] Auto-assigned case ${caseNumber} to optimal officer.`);
                    }
                }

                // 6. Log case history for activity feed
                await db.insert(caseHistory).values({
                    caseId: newCase.id,
                    action: `Case created from ${signal.source} — "${signal.text.substring(0, 50)}..."`,
                    previousStatus: null,
                    newStatus: "open",
                    changedBy: null,
                } as any);
            }
        }

        return createdCase || { id: intakeSignal.id, status: "pending_triage" };
    },

    /**
     * Triggers a randomized, realistic signal from a specific KASNEB portal
     */
    async triggerScenario(channelSlug: string) {
        console.log(`[Simulation] Injecting random scenario for channel: ${channelSlug}`);
        const type = channelStakeholderTypeMap[channelSlug] || "student";

        const templates = channelTemplates[channelSlug];
        if (!templates || templates.length === 0) {
            console.error(`[Simulation] No scenario templates available for ${channelSlug}`);
            return;
        }

        // Pull a random existing stakeholder
        let [stakeholder] = await db.select()
            .from(stakeholders)
            .where(eq(stakeholders.type, type))
            .orderBy(sql`RANDOM()`)
            .limit(1);

        if (!stakeholder) {
            console.log(`[Simulation] Warning: No stakeholders of type ${type} found. Falling back to any stakeholder.`);
            [stakeholder] = await db.select()
                .from(stakeholders)
                .orderBy(sql`RANDOM()`)
                .limit(1);
        }

        const templateFn = pick(templates);
        const generated = templateFn(stakeholder);

        return this.simulateSignal({
            source: channelSourceMap[channelSlug] || channelSlug,
            text: generated.text,
            metadata: generated.metadata
        });
    },

    /**
     * Complete system reset and reseed
     * 1. Clears all cases/triage
     * 2. Seeds stakeholders
     * 3. Triggers 20 random scenarios
     */
    async reseedSystem() {
        console.log("[Simulation] Starting full system reseed...");

        // 1. Delete in dependency order
        await db.transaction(async (tx) => {
            await tx.delete(caseHistory);
            await tx.delete(caseComments);
            await tx.delete(caseAttachments);
            await tx.delete(intakeSignals);
            await tx.delete(stakeholderInteractions);
            await tx.delete(stakeholderRelationships);
            await tx.delete(cases);
        });

        // 2. Seed stakeholders (90)
        await this.seedStakeholders();

        // 3. Trigger 20 scenarios
        const scenarios = Object.keys(channelTemplates);
        const results = [];
        for (let i = 0; i < 20; i++) {
            const scenario = pick(scenarios);
            results.push(await this.triggerScenario(scenario));
        }

        return {
            message: "System reset and reseeded with 90 stakeholders and 20 cases.",
            casesCreated: results.length
        };
    }
};
