import { pgTable, text, integer, boolean, uuid, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";
import { stakeholders, cases, campaigns, integrationConfigs } from "./crmSchema";

export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  channel: text("channel").notNull(), 
  externalConversationId: text("external_conversation_id"),
  stakeholderId: uuid("stakeholder_id").references(() => stakeholders.id, { onDelete: "set null" }),
  assignedTo: uuid("assigned_to"), 
  status: text("status").default("new").notNull(), 
  lastMessageAt: text("last_message_at").default(sql`now()`).notNull(),
  resolvedAt: text("resolved_at"),
  caseId: uuid("case_id").references(() => cases.id, { onDelete: "set null" }),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
}, (table) => ({
  channelIdx: index("convo_channel_idx").on(table.channel),
  statusIdx: index("convo_status_idx").on(table.status),
  stakeholderIdx: index("convo_stakeholder_idx").on(table.stakeholderId),
  assignedToIdx: index("convo_assigned_to_idx").on(table.assignedTo),
  externalIdIdx: uniqueIndex("convo_external_id_idx").on(table.externalConversationId, table.channel),
}));

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }).notNull(),
  direction: text("direction").notNull(), 
  contentType: text("content_type").default("text").notNull(), 
  body: text("body").notNull(), 
  attachments: jsonb("attachments").default([]).notNull(), 
  externalMessageId: text("external_message_id"), 
  sentBy: uuid("sent_by"), 
  deliveredAt: text("delivered_at"),
  readAt: text("read_at"),
  isInternalNote: boolean("is_internal_note").default(false).notNull(), 
  createdAt: text("created_at").default(sql`now()`).notNull(),
}, (table) => ({
  convoIdx: index("msg_convo_idx").on(table.conversationId),
  directionIdx: index("msg_direction_idx").on(table.direction),
  internalIdx: index("msg_internal_idx").on(table.isInternalNote),
  externalIdIdx: uniqueIndex("msg_external_id_idx").on(table.externalMessageId), // Unique prevents duplicate webhook/backfill inserts
}));

export const conversationEvents = pgTable("conversation_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }).notNull(),
  eventType: text("event_type").notNull(), 
  actorId: uuid("actor_id"), 
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
}, (table) => ({
  convoIdx: index("convo_event_idx").on(table.conversationId),
  eventTypeIdx: index("event_type_idx").on(table.eventType),
}));

export const metaPages = pgTable("meta_pages", {
  id: uuid("id").defaultRandom().primaryKey(),
  integrationId: uuid("integration_id").references(() => integrationConfigs.id, { onDelete: "cascade" }),
  pageId: text("page_id").unique().notNull(), 
  pageName: text("page_name").notNull(),
  platform: text("platform").notNull(), 
  pageAccessToken: text("page_access_token").notNull(), 
  tokenExpiresAt: text("token_expires_at"), 
  isActive: boolean("is_active").default(true).notNull(),
  connectedBy: uuid("connected_by"), 
  connectedAt: text("connected_at").default(sql`now()`).notNull(),
}, (table) => ({
  integrationIdx: index("meta_pages_integration_idx").on(table.integrationId),
  pageIdIdx: index("meta_page_id_idx").on(table.pageId),
  platformIdx: index("meta_platform_idx").on(table.platform),
}));

export const metaWebhookEvents = pgTable("meta_webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  objectType: text("object_type").notNull(), 
  eventType: text("event_type").notNull(), 
  rawPayload: jsonb("raw_payload").notNull(),
  receivedAt: text("received_at").default(sql`now()`).notNull(),
  processed: boolean("processed").default(false).notNull(),
  processingError: text("processing_error"),
  idempotencyKey: text("idempotency_key").unique().notNull(), 
}, (table) => ({
  idempotencyIdx: index("wh_idempotency_idx").on(table.idempotencyKey),
  processedIdx: index("wh_processed_idx").on(table.processed),
}));

export const metaLeads = pgTable("meta_leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadgenId: text("leadgen_id").unique().notNull(), 
  formId: text("form_id").notNull(),
  pageId: text("page_id").references(() => metaPages.pageId, { onDelete: "cascade" }).notNull(),
  formData: jsonb("form_data").notNull(), 
  stakeholderId: uuid("stakeholder_id").references(() => stakeholders.id, { onDelete: "set null" }),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  fetchedAt: text("fetched_at").default(sql`now()`).notNull(),
}, (table) => ({
  leadgenIdx: index("leadgen_id_idx").on(table.leadgenId),
  stakeholderIdx: index("lead_stakeholder_idx").on(table.stakeholderId),
}));

export const socialPosts = pgTable("social_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  pageId: uuid("page_id").references(() => metaPages.id, { onDelete: "cascade" }).notNull(),
  platform: text("platform").notNull(), 
  contentText: text("content_text").notNull(),
  mediaUrls: jsonb("media_urls").default([]).notNull(), 
  status: text("status").default("draft").notNull(), 
  scheduledFor: text("scheduled_for"), 
  publishedAt: text("published_at"),
  externalPostId: text("external_post_id"), 
  engagementSnapshot: jsonb("engagement_snapshot").default({ likes: 0, comments: 0, reach: 0 }).notNull(),
  createdBy: uuid("created_by"), 
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
}, (table) => ({
  postStatusIdx: index("post_status_idx").on(table.status),
  scheduledTimeIdx: index("post_scheduled_idx").on(table.scheduledFor),
}));

export const callRecords = pgTable("call_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  avayaCallId: text("avaya_call_id").unique().notNull(), 
  direction: text("direction").notNull(), 
  callerNumber: text("caller_number").notNull(), 
  calledNumber: text("called_number").notNull(),
  agentId: uuid("agent_id"), 
  stakeholderId: uuid("stakeholder_id").references(() => stakeholders.id, { onDelete: "set null" }),
  queueName: text("queue_name"), 
  ivrPath: text("ivr_path"), 
  startedAt: text("started_at").notNull(),
  answeredAt: text("answered_at"),
  endedAt: text("ended_at"),
  durationSeconds: integer("duration_seconds").default(0).notNull(),
  holdDurationSeconds: integer("hold_duration_seconds").default(0).notNull(),
  disposition: text("disposition").notNull(), 
  recordingUrl: text("recording_url"), 
  notes: text("notes"), 
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
}, (table) => ({
  avayaIdIdx: index("avaya_call_id_idx").on(table.avayaCallId),
  callerIdx: index("caller_number_idx").on(table.callerNumber),
  agentIdx: index("call_agent_idx").on(table.agentId),
  stakeholderIdx: index("call_stakeholder_idx").on(table.stakeholderId),
}));

export const avayaAgents = pgTable("avaya_agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  avayaAgentId: text("avaya_agent_id").unique().notNull(), 
  crmUserId: uuid("crm_user_id"), 
  extension: text("extension").notNull(), 
  displayName: text("display_name").notNull(),
  currentStatus: text("current_status").default("offline").notNull(), 
  statusSince: text("status_since").default(sql`now()`).notNull(),
  lastSyncedAt: text("last_synced_at").default(sql`now()`).notNull(),
}, (table) => ({
  agentIdIdx: index("avaya_agent_id_idx").on(table.avayaAgentId),
  agentStatusIdx: index("avaya_agent_status_idx").on(table.currentStatus),
}));

export const avayaQueueSnapshots = pgTable("avaya_queue_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  queueName: text("queue_name").notNull(),
  snapshotAt: text("snapshot_at").default(sql`now()`).notNull(),
  callsWaiting: integer("calls_waiting").notNull(),
  longestWaitSeconds: integer("longest_wait_seconds").notNull(),
  agentsAvailable: integer("agents_available").notNull(),
}, (table) => ({
  queueSnapshotIdx: index("queue_snapshot_time_idx").on(table.snapshotAt),
  queueNameIdx: index("queue_name_idx").on(table.queueName),
}));

export const emailAccounts = pgTable("email_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  emailAddress: text("email_address").unique().notNull(),
  displayName: text("display_name").notNull(),
  imapHost: text("imap_host").notNull(),
  imapPort: integer("imap_port").default(993).notNull(),
  smtpHost: text("smtp_host").notNull(),
  smtpPort: integer("smtp_port").default(587).notNull(),
  credentialsEncrypted: text("credentials_encrypted").notNull(), 
  isActive: boolean("is_active").default(true).notNull(),
  lastSyncedAt: text("last_synced_at"),
}, (table) => ({
  emailAddrIdx: index("email_addr_idx").on(table.emailAddress),
}));

export const dataDeletionRequests = pgTable("data_deletion_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  confirmationCode: uuid("confirmation_code").defaultRandom().notNull().unique(),
  status: text("status").default("pending").notNull(), // pending, processing, completed, failed
  requestedAt: text("requested_at").default(sql`now()`).notNull(),
  completedAt: text("completed_at"),
}, (table) => ({
  userIdIdx: index("del_req_user_idx").on(table.userId),
  codeIdx: index("del_req_code_idx").on(table.confirmationCode),
}));
