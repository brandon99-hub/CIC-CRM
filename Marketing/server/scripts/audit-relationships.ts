import { db } from "../db";
import { stakeholders, stakeholderRelationships } from "../../shared/crmSchema";
import { eq, or, and, sql } from "drizzle-orm";

async function audit() {
    console.log("--- Stakeholder Relationship Audit ---");

    // 1. Find the target stakeholders
    const safaricom = await db.select().from(stakeholders).where(
        sql`(${stakeholders.firstName} || ' ' || ${stakeholders.lastName}) ILIKE 'Safaricom PLC%'`
    );
    const james = await db.select().from(stakeholders).where(
        sql`(${stakeholders.firstName} || ' ' || ${stakeholders.lastName}) ILIKE 'James Mugo%'`
    );

    console.log(`Found ${safaricom.length} Safaricom records.`);
    safaricom.forEach(s => console.log(` - ID: ${s.id}, Name: ${s.firstName} ${s.lastName}, Type: ${s.type}`));

    console.log(`Found ${james.length} James Mugo records.`);
    james.forEach(j => console.log(` - ID: ${j.id}, Name: ${j.firstName} ${j.lastName}, Type: ${j.type}`));

    const targetIds = [...safaricom.map(s => s.id), ...james.map(j => j.id)];

    if (targetIds.length === 0) {
        console.log("No matching stakeholders found.");
        return;
    }

    // 2. Query relationships
    const rels = await db.select({
        id: stakeholderRelationships.id,
        aId: stakeholderRelationships.stakeholderAId,
        bId: stakeholderRelationships.stakeholderBId,
        type: stakeholderRelationships.relationshipType,
        desc: stakeholderRelationships.description
    })
    .from(stakeholderRelationships)
    .where(or(
        sql`${stakeholderRelationships.stakeholderAId} IN (${sql.join(targetIds.map(id => sql`${id}`), sql`, `)})`,
        sql`${stakeholderRelationships.stakeholderBId} IN (${sql.join(targetIds.map(id => sql`${id}`), sql`, `)})`
    ));

    console.log(`\nFound ${rels.length} relationships:`);
    for (const r of rels) {
        const [a] = await db.select().from(stakeholders).where(eq(stakeholders.id, r.aId)).limit(1);
        const [b] = await db.select().from(stakeholders).where(eq(stakeholders.id, r.bId)).limit(1);
        
        console.log(`[${r.id}] ${a?.firstName} ${a?.lastName} (${a?.id?.slice(0, 8)}) ---[${r.type}]---> ${b?.firstName} ${b?.lastName} (${b?.id?.slice(0, 8)})`);
        console.log(`      Desc: ${r.desc}`);
    }
}

audit().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
