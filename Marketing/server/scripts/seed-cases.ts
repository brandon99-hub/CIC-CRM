import { db } from "../db";
import { cases, stakeholders } from "../../shared/crmSchema";
import { marketingUsers } from "../../shared/schema";
import { conversations, messages } from "../../shared/commsSchema";
import { serviceCategories, slaRules } from "../../shared/adminSchema";
import { AssignmentService } from "../services/assignment-service";
import { eq, not, sql } from "drizzle-orm";

const casesData = [
  { 
    status: 'open', 
    channel: 'email', 
    categoryName: 'Claims Dispute', 
    subject: 'Dispute over Motor Claim Settlement Amount',
    inboundMsg: `Dear CIC Team,\n\nI am writing to formally dispute the settlement amount offered for my recent motor insurance claim (Claim Reference: CLM-84920). The valuation provided is significantly lower than the actual market value of the vehicle and does not cover the repair estimates I received from three separate approved garages.\n\nPlease review my file. I have attached the independent valuation reports for your reference.\n\nLooking forward to your prompt response.\n\nBest regards,`,
    outboundMsgs: []
  },
  { 
    status: 'open', 
    channel: 'email', 
    categoryName: 'Premium Dispute', 
    subject: 'Urgent: M-PESA Premium Payment Not Reflected',
    inboundMsg: `Hello Finance Team,\n\nI made my monthly premium payment of KES 15,000 via M-PESA yesterday morning, but I just received an automated SMS stating my policy is in arrears. My M-PESA transaction code is RH92KLT44. \n\nCan someone please check the system and update my account? I don't want my medical cover to be suspended.\n\nThanks,`,
    outboundMsgs: []
  },
  { 
    status: 'in_progress', 
    channel: 'whatsapp', 
    categoryName: 'Policy Enrollment Issue', 
    subject: 'Help with SACCO Group Medical Enrollment',
    inboundMsg: `Hi, I am trying to enroll my dependents under our SACCO's group medical scheme but the USSD portal keeps timing out after I enter the ID numbers. Is there another way I can submit the details?`,
    outboundMsgs: [
      `Hello! Thank you for reaching out to CIC Insurance. I apologize for the inconvenience with the USSD portal. You can share the ID numbers and full names of your dependents here securely, and I will manually update your enrollment profile.`
    ]
  },
  { 
    status: 'in_progress', 
    channel: 'email', 
    categoryName: 'Claims Status Inquiry', 
    subject: 'Follow up on Inpatient Medical Claim',
    inboundMsg: `Good Morning,\n\nI am writing to inquire about the status of my inpatient medical reimbursement claim submitted two weeks ago following my admission at Nairobi Hospital. The claim forms and original receipts were dropped off at your Upperhill branch.\n\nPlease advise if any further documentation is required.\n\nRegards,`,
    outboundMsgs: [
      `Dear customer,\n\nThank you for getting in touch. We have received your claim documents and they are currently under review by our medical assessment team. We expect to process the reimbursement within the next 3-5 business days. We will keep you updated.`
    ]
  },
  { 
    status: 'escalated', 
    channel: 'email', 
    categoryName: 'Claims Dispute', 
    subject: 'Escalation: Claim Rejected Unfairly',
    inboundMsg: `To Whom It May Concern,\n\nI am extremely frustrated! My property insurance claim for water damage was outright rejected with a note saying it falls under "wear and tear". A burst pipe is NOT wear and tear! I have been a loyal CIC customer for 8 years and this is unacceptable.\n\nI demand to speak to a manager or a senior claims assessor immediately before I take this to the IRA.\n\nRegards,`,
    outboundMsgs: [
      `Dear customer,\n\nWe sincerely apologize for the frustration this has caused. Your case has been escalated to the Senior Claims Assessor for an immediate secondary review. A manager will contact you by the end of the day to discuss the findings.`
    ]
  },
  { 
    status: 'escalated', 
    channel: 'whatsapp', 
    categoryName: 'Premium Dispute', 
    subject: 'Double Deduction on Standing Order',
    inboundMsg: `Hello, my bank statement shows that CIC deducted my life assurance premium TWICE this month. This is the second time this is happening. I need a refund immediately!`,
    outboundMsgs: [
      `Hello. We deeply apologize for the double deduction. I have escalated this issue to our Finance Department for urgent reconciliation. We will process a refund to your bank account within 24 hours.`
    ]
  },
  { 
    status: 'resolved', 
    channel: 'email', 
    categoryName: 'Claim Payout Request', 
    subject: 'Request for Final Discharge Voucher',
    inboundMsg: `Dear Claims Team,\n\nMy motor claim was approved last week but I am yet to receive the discharge voucher to sign so the payout can be processed. Kindly send it to me as soon as possible so I can pay the garage.\n\nThank you.`,
    outboundMsgs: [
      `Dear customer,\n\nPlease find attached the discharge voucher for your motor claim. Kindly sign and return a scanned copy so we can initiate the RTGS transfer to your account.`,
      `Thank you. I have signed and attached the voucher. Please process the payment.`,
      `Dear customer,\n\nThank you. We have received the signed voucher. The payment of KES 125,000 has been processed and should reflect in your account within 48 hours. We are now closing this case. Have a great day!`
    ],
    rootCause: 'Administrative delay in document generation',
    resolution: 'Generated and sent discharge voucher. Received signed copy and initiated RTGS payment.',
    sopSteps: ['Verify claim approval', 'Generate discharge voucher', 'Send to client for signature', 'Process payment upon receipt']
  },
  { 
    status: 'resolved', 
    channel: 'email', 
    categoryName: 'Policy Enrollment Issue', 
    subject: 'Missing Motor Certificate',
    inboundMsg: `Hello,\n\I renewed my motor comprehensive insurance yesterday via the portal but I haven't received the digital certificate in my email. Could you please resend it? I need to travel tomorrow.\n\nThanks,`,
    outboundMsgs: [
      `Dear customer,\n\nWe apologize for the delay. It seems there was a slight system lag during the digital certificate generation. I have manually generated it and attached it to this email. Please print it in color.\n\nSafe travels!`,
      `Received! Thank you so much for the swift response.`,
      `You're very welcome! We are always happy to help. We will now close this inquiry.`
    ],
    rootCause: 'System lag during certificate generation',
    resolution: 'Manually generated the digital certificate and emailed it to the client.',
    sopSteps: ['Check renewal status', 'Generate digital certificate manually', 'Email to client']
  },
  { 
    status: 'resolved', 
    channel: 'whatsapp', 
    categoryName: 'General Inquiry', 
    subject: 'Branch Operating Hours',
    inboundMsg: `Hi, what time does the Upperhill branch close today? I need to drop off some forms.`,
    outboundMsgs: [
      `Hello! Our Upperhill branch is open until 4:30 PM today. However, you can also drop off the forms at our customer care desk at the main lobby which remains open until 5:00 PM.`
    ],
    rootCause: 'Information request',
    resolution: 'Provided correct branch operating hours.',
    sopSteps: ['Provide branch hours', 'Offer alternative drop-off options']
  },
];

function randPastDate(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function generateCaseNumber() {
  return `CIC-${new Date().getFullYear().toString().slice(2)}-${Math.floor(1000 + Math.random() * 9000)}`;
}

async function seedCases() {
  console.log("Starting realistic case seeding...");
  
  // Find stakeholders
  const stakeholdersList = await db.select().from(stakeholders).where(not(eq(stakeholders.type, "department"))).limit(9);
  if (stakeholdersList.length === 0) {
    console.error("No stakeholders found, please seed stakeholders first.");
    return;
  }

  // Find categories
  const categoriesList = await db.select().from(serviceCategories);
  if (categoriesList.length === 0) {
    console.error("No service categories found.");
    return;
  }

  // For agent replies if auto-assign fails
  const [defaultAgent] = await db.select().from(marketingUsers).limit(1);

  for (let i = 0; i < casesData.length; i++) {
    const caseDef = casesData[i];
    const stakeholder = stakeholdersList[i % stakeholdersList.length];
    const category = categoriesList.find(c => c.name === caseDef.categoryName) || categoriesList[0];
    
    const now = new Date();
    let createdAt = randPastDate(caseDef.status === 'resolved' ? 5 : (caseDef.status === 'escalated' ? 3 : 1));
    let resolvedAt = null;
    let firstResponseAt = null;
    let resolutionDurationMinutes = null;

    let slaDeadline: string | null = null;
    let slaResponseDeadline: string | null = null;
    
    // Look up SLA rules for this category
    const slaRulesList = await db.select().from(slaRules).where(eq(slaRules.serviceCategoryId, category.id)).limit(1);
    
    if (slaRulesList.length > 0) {
      const rule = slaRulesList[0];
      let mins = rule.timeline;
      if (rule.timelineUnit === 'hours') mins *= 60;
      else if (rule.timelineUnit === 'working days') mins *= 8 * 60;
      else if (rule.timelineUnit === 'days') mins *= 24 * 60;
      else if (rule.timelineUnit !== 'minutes') mins *= 60;

      const respMins = rule.responseTimeMinutes || 120;

      // Adjust creation time dynamically to simulate SLA status
      let createdAtOffsetMinutes = 0;
      
      // Let's create a mix of SLA scenarios based on status
      if (caseDef.status === 'open') {
         // Open cases: one is 'within' SLA, another is 'response breached'
         if (i % 2 === 0) createdAtOffsetMinutes = -15; // 15 mins ago (within SLA)
         else createdAtOffsetMinutes = -(respMins + 30); // Response breached
      } else if (caseDef.status === 'in_progress') {
         // In progress cases: approaching deadline (only 60 mins left)
         createdAtOffsetMinutes = -(mins - 60); 
      } else if (caseDef.status === 'escalated') {
         // Escalated cases: fully breached
         createdAtOffsetMinutes = -(mins + 120); 
      } else if (caseDef.status === 'resolved') {
         // Resolved cases: some days ago
         createdAtOffsetMinutes = -(3 * 24 * 60);
      }

      const exactCreatedAt = new Date(now.getTime() + createdAtOffsetMinutes * 60000);
      createdAt = exactCreatedAt; // Overwrite the generic randPastDate

      slaDeadline = new Date(createdAt.getTime() + mins * 60000).toISOString();
      if (rule.responseTimeMinutes) {
        slaResponseDeadline = new Date(createdAt.getTime() + rule.responseTimeMinutes * 60000).toISOString();
      }
    }

    if (caseDef.status === 'resolved') {
      resolvedAt = new Date(createdAt.getTime() + (Math.floor(Math.random() * 60) + 60) * 60000);
      firstResponseAt = new Date(createdAt.getTime() + 45 * 60 * 1000); // 45 mins later
      resolutionDurationMinutes = Math.floor((resolvedAt.getTime() - createdAt.getTime()) / 60000);
    } else if (caseDef.status !== 'open') {
      firstResponseAt = new Date(createdAt.getTime() + 45 * 60 * 1000);
    }

    // 1. Create the base case
    const newCase = {
      caseNumber: generateCaseNumber(),
      title: `[${caseDef.channel.toUpperCase()}] ${caseDef.subject}`,
      description: caseDef.inboundMsg.substring(0, 200) + "...",
      status: "open", // Will update after auto-assign
      priority: caseDef.status === 'escalated' ? 'high' : 'medium',
      channel: caseDef.channel,
      stakeholderId: stakeholder.id,
      serviceCategoryId: category.id,
      assignedDepartment: category.departmentId,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      slaDeadline,
      slaResponseDeadline
    };

    const [insertedCase] = await db.insert(cases).values(newCase).returning();

    // 2. Auto-assign the case to mimic AI routing
    let assignedUserId = defaultAgent?.id || null;
    try {
      const assignedCase = await AssignmentService.autoAssignCase(insertedCase.id, null, category.departmentId || undefined);
      if (assignedCase && assignedCase.assignedTo) {
        assignedUserId = assignedCase.assignedTo;
      }
    } catch (e) {
      console.error("Auto assignment failed, using default agent", e);
    }

    // 3. Fetch the assigned agent's details for realistic sender name in outbound msgs
    let agentName = "CIC Support";
    if (assignedUserId) {
       const [ag] = await db.select().from(marketingUsers).where(eq(marketingUsers.id, assignedUserId)).limit(1);
       if (ag) agentName = `${ag.firstName} ${ag.lastName}`;
    }

    // 4. Update the case to its target state
    await db.update(cases)
      .set({
        status: caseDef.status,
        updatedAt: (resolvedAt || now).toISOString(),
        resolvedAt: resolvedAt ? resolvedAt.toISOString() : null,
        firstResponseAt: firstResponseAt ? firstResponseAt.toISOString() : null,
        resolutionDurationMinutes: resolutionDurationMinutes || null,
        rootCause: (caseDef as any).rootCause || null,
        resolution: (caseDef as any).resolution || null,
        sopSteps: (caseDef as any).sopSteps || [],
      })
      .where(eq(cases.id, insertedCase.id));

    console.log(`Created case ${insertedCase.caseNumber} - ${caseDef.status} (${caseDef.categoryName}) -> Assigned to ${agentName}`);

    // 5. Create the Conversation
    const isResolved = caseDef.status === 'resolved';
    const [convo] = await db.insert(conversations).values({
      channel: caseDef.channel,
      status: isResolved ? 'resolved' : 'new',
      caseId: insertedCase.id,
      stakeholderId: stakeholder.id,
      assignedTo: assignedUserId,
      createdAt: createdAt.toISOString(),
      lastMessageAt: (isResolved ? resolvedAt! : now).toISOString(),
      resolvedAt: isResolved ? resolvedAt!.toISOString() : null,
      metadata: {
        subject: caseDef.subject,
        senderName: `${stakeholder.firstName} ${stakeholder.lastName}`,
        senderEmail: stakeholder.email
      }
    }).returning();

    // 6. Seed the Messages (Inbound first, then outbound/inbound based on definition)
    let currentMsgTime = createdAt;
    
    // Inbound
    await db.insert(messages).values({
      conversationId: convo.id,
      direction: 'inbound',
      body: caseDef.inboundMsg,
      createdAt: currentMsgTime.toISOString()
    });

    // Back and forths
    for (let j = 0; j < caseDef.outboundMsgs.length; j++) {
      currentMsgTime = new Date(currentMsgTime.getTime() + (Math.floor(Math.random() * 60) + 10) * 60000); // add 10-70 mins
      
      const isOutbound = j % 2 === 0;
      await db.insert(messages).values({
        conversationId: convo.id,
        direction: isOutbound ? 'outbound' : 'inbound',
        body: caseDef.outboundMsgs[j],
        createdAt: currentMsgTime.toISOString(),
        sentBy: isOutbound ? assignedUserId : null,
      });
    }

    console.log(`  -> Created conversation ${convo.id} with ${1 + caseDef.outboundMsgs.length} messages`);
  }
  
  console.log("Realistic Seeding complete.");
  process.exit(0);
}

seedCases().catch((e) => {
  console.error("Seeding failed:", e);
  process.exit(1);
});
