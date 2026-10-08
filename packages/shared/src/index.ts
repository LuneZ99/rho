import { z } from "zod";
export const moduleSchema = z.enum(["health", "investment", "tasks"]);
export type ModuleId = z.infer<typeof moduleSchema>;
export const moduleNames: Record<ModuleId, string> = {
  health: "健康",
  investment: "投资",
  tasks: "待办",
};
export const entityTypes = [
  "conversation",
  "message",
  "job",
  "item",
  "card",
  "reminder",
  "device",
] as const;
export type EntityType = (typeof entityTypes)[number];
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };
const json: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(json),
    z.record(json),
  ]),
);
export const itemSchema = z.object({
  module: moduleSchema,
  kind: z.enum(["record", "task"]),
  title: z.string().min(1).max(200),
  content: z.string().max(16000),
  originalText: z.string().max(16000),
  category: z.string().min(1).max(80),
  fields: z.record(json).default({}),
  occurredAt: z.string().datetime({ offset: true }),
  dueAt: z.string().datetime({ offset: true }).nullable().default(null),
  status: z.enum(["active", "completed"]).default("active"),
  sourceConversationId: z.string().uuid().nullable(),
});
export type Item = z.infer<typeof itemSchema>;
export const cardSchema = z.object({
  itemId: z.string().uuid(),
  title: z.string().min(1).max(200),
  summary: z.string().max(2000),
  priority: z.number().int().min(0).max(100),
});
export type Card = z.infer<typeof cardSchema> & {
  ignored: boolean;
  snoozedUntil: string | null;
};
export const reminderSchema = z.object({
  itemId: z.string().uuid(),
  title: z.string().min(1).max(200),
  at: z.string().datetime({ offset: true }),
  timezone: z.string().min(1),
  repeat: z.enum(["once", "daily", "weekly"]),
});
export type Reminder = z.infer<typeof reminderSchema> & { active: boolean };
export type Conversation = { title: string; modelId?: string };
export type ModelOptions = {
  models: string[];
  defaultModelId: string;
  legacyModelId: string;
  version: number;
};
export type Message = {
  conversationId: string;
  role: "user" | "assistant";
  text: string;
  state: "pending" | "streaming" | "done" | "failed";
  jobId: string;
  createdAt?: string;
  modelId?: string;
};
export type Job = {
  conversationId: string;
  messageId: string;
  assistantId: string;
  status: "queued" | "running" | "completed" | "failed" | "interrupted";
  error: string | null;
  timezone: string;
  resume?: boolean;
  cardContext?: string;
  modelId?: string;
};
export type Device = {
  installedReminderVersions: Record<string, number>;
  notificationPermission: boolean;
  exactAlarmPermission: boolean;
  receipts: string[];
};
export type DataMap = {
  item: Item;
  card: Card;
  reminder: Reminder;
  conversation: Conversation;
  message: Message;
  job: Job;
  device: Device;
};
export type Entity<T extends EntityType = EntityType> = {
  id: string;
  type: T;
  version: number;
  seq: number;
  deleted: boolean;
  updatedAt: string;
  data: DataMap[T];
};
export const operationSchema = z.object({
  id: z.string().uuid(),
  action: z.enum([
    "conversation.create",
    "conversation.model",
    "message.send",
    "job.resume",
    "item.save",
    "item.delete",
    "card.save",
    "card.action",
    "reminder.save",
    "reminder.cancel",
    "device.sync",
    "audit",
  ]),
  payload: z.record(z.unknown()),
});
export type Operation = z.infer<typeof operationSchema>;
export type SyncResult = {
  entities: Entity[];
  cursor: number;
  hasMore: boolean;
};
