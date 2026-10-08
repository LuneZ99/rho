import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  itemSchema,
  cardSchema,
  reminderSchema,
  type Operation,
  type Entity,
  type EntityType,
} from "@rho/shared";
import { DomainError, transaction, type Store } from "./db.js";
const ref = z.object({
  id: z.string().uuid(),
  version: z.number().int().nonnegative(),
});
const optionalRef = z.object({
  id: z.string().uuid().optional(),
  version: z.number().int().nonnegative().default(0),
});
export async function operate(
  op:
    | Operation
    | {
        id: string;
        action: Operation["action"];
        payload: Record<string, unknown>;
      },
  actor = "user",
) {
  return transaction(async (s) => {
    const previous = await s.client.query(
      "SELECT request,result FROM operations WHERE id=$1",
      [op.id],
    );
    if (previous.rows[0]) {
      const same = await s.client.query(
        "SELECT request=$2::jsonb AS same FROM operations WHERE id=$1",
        [op.id, JSON.stringify(op)],
      );
      if (!same.rows[0].same)
        throw new DomainError(409, "操作编号已被其他请求使用");
      return previous.rows[0].result as Entity[];
    }
    const result = await apply(s, op);
    await s.client.query(
      "INSERT INTO operations(id,request,result) VALUES($1,$2,$3)",
      [op.id, JSON.stringify(op), JSON.stringify(result)],
    );
    await s.client.query(
      "INSERT INTO audit(actor,action,payload) VALUES($1,$2,$3)",
      [
        actor,
        op.action,
        JSON.stringify({
          operationId: op.id,
          input: op.payload,
          entities: result.map((e) => ({ id: e.id, version: e.version })),
        }),
      ],
    );
    return result;
  });
}
async function closeRelated(s: Store, itemId: string, removeCards: boolean) {
  const changed: Entity[] = [];
  for (const r of await s.list("reminder"))
    if (r.data.itemId === itemId && r.data.active)
      changed.push(
        await s.put(r.id, "reminder", { ...r.data, active: false }, r.version),
      );
  if (removeCards)
    for (const c of await s.list("card"))
      if (c.data.itemId === itemId)
        changed.push(await s.put(c.id, "card", c.data, c.version, true));
  return changed;
}
async function apply(
  s: Store,
  op: { action: Operation["action"]; payload: Record<string, unknown> },
): Promise<Entity[]> {
  const p = op.payload;
  switch (op.action) {
    case "conversation.create": {
      const v = z
        .object({ id: z.string().uuid(), title: z.string().min(1).max(100) })
        .parse(p);
      return [await s.put(v.id, "conversation", { title: v.title })];
    }
    case "message.send": {
      const v = z
        .object({
          conversationId: z.string().uuid(),
          text: z.string().min(1).max(16000),
          timezone: z.string().default("Asia/Shanghai"),
          cardId: z.string().uuid().optional(),
          itemId: z.string().uuid().optional(),
        })
        .parse(p);
      await s.get(v.conversationId, "conversation");
      let text = v.text;
      if (v.cardId) {
        const c = await s.get(v.cardId, "card");
        const i = await s.get(c.data.itemId, "item");
        text += `\n\n[用户选中的卡片与事项]\n${JSON.stringify({ card: c, item: i })}`;
      } else if (v.itemId) {
        const i = await s.get(v.itemId, "item");
        text += `\n\n[用户选中的事项]\n${JSON.stringify({ item: i })}`;
      }
      const jobId = randomUUID(),
        messageId = randomUUID(),
        assistantId = randomUUID();
      return [
        await s.put(messageId, "message", {
          conversationId: v.conversationId,
          role: "user",
          text: v.text,
          state: "done",
          jobId,
        }),
        await s.put(assistantId, "message", {
          conversationId: v.conversationId,
          role: "assistant",
          text: "",
          state: "pending",
          jobId,
        }),
        await s.put(jobId, "job", {
          conversationId: v.conversationId,
          messageId,
          assistantId,
          status: "queued",
          error: null,
          timezone: v.timezone,
          ...(v.cardId || v.itemId
            ? { cardContext: text.slice(v.text.length) }
            : {}),
        }),
      ];
    }
    case "job.resume": {
      const { id, version } = ref.parse(p);
      const j = await s.get(id, "job");
      if (!["failed", "interrupted"].includes(j.data.status))
        throw new DomainError(409, "任务当前无需恢复");
      return [
        await s.put(
          id,
          "job",
          { ...j.data, status: "queued", error: null, resume: true },
          version,
        ),
      ];
    }
    case "item.save": {
      const v = optionalRef.extend({ data: itemSchema }).parse(p);
      if (v.id)
        v.data.sourceConversationId = (
          await s.get(v.id, "item")
        ).data.sourceConversationId;
      if (v.data.sourceConversationId)
        await s.get(v.data.sourceConversationId, "conversation");
      const row = await s.put(v.id ?? randomUUID(), "item", v.data, v.version);
      return [
        row,
        ...(v.data.status === "completed"
          ? await closeRelated(s, row.id, true)
          : []),
      ];
    }
    case "item.delete": {
      const v = ref.parse(p);
      const row = await s.get(v.id, "item");
      return [
        await s.put(v.id, "item", row.data, v.version, true),
        ...(await closeRelated(s, v.id, true)),
      ];
    }
    case "card.save": {
      const v = optionalRef.extend({ data: cardSchema }).parse(p);
      const item = await s.get(v.data.itemId, "item");
      if (item.data.status === "completed")
        throw new DomainError(409, "已完成事项无需新增卡片");
      const old = (await s.list("card")).find((c) => c.data.itemId === item.id);
      if (old && !v.id)
        throw new DomainError(
          409,
          `该事项已有卡片 ${old.id}，请查询后更新，不要重复创建`,
        );
      const state = v.id
        ? (await s.get(v.id, "card")).data
        : { ignored: false, snoozedUntil: null };
      return [
        await s.put(
          v.id ?? randomUUID(),
          "card",
          { ...state, ...v.data },
          v.version,
        ),
      ];
    }
    case "card.action": {
      const v = ref
        .extend({
          action: z.enum(["complete", "ignore", "snooze"]),
          until: z.string().datetime({ offset: true }).optional(),
        })
        .parse(p);
      const c = await s.get(v.id, "card");
      if (c.version !== v.version)
        throw new DomainError(409, "卡片已更新，请刷新后重试");
      if (v.action === "complete") {
        const i = await s.get(c.data.itemId, "item");
        if (i.data.kind !== "task")
          throw new DomainError(400, "记录不能标记为完成");
        return [
          await s.put(
            i.id,
            "item",
            { ...i.data, status: "completed" },
            i.version,
          ),
          ...(await closeRelated(s, i.id, true)),
        ];
      }
      if (
        v.action === "snooze" &&
        (!v.until || Date.parse(v.until) <= Date.now())
      )
        throw new DomainError(400, "请选择未来的推迟时间");
      return [
        await s.put(
          c.id,
          "card",
          {
            ...c.data,
            ignored: v.action === "ignore",
            snoozedUntil: v.action === "snooze" ? v.until! : null,
          },
          c.version,
        ),
      ];
    }
    case "reminder.save": {
      const v = optionalRef.extend({ data: reminderSchema }).parse(p);
      try {
        new Intl.DateTimeFormat("en", { timeZone: v.data.timezone });
      } catch {
        throw new DomainError(400, "无效时区");
      }
      const i = await s.get(v.data.itemId, "item");
      if (i.data.status === "completed")
        throw new DomainError(409, "已完成事项不能设置提醒");
      if (Date.parse(v.data.at) <= Date.now())
        throw new DomainError(400, "提醒时间必须在将来");
      return [
        await s.put(
          v.id ?? randomUUID(),
          "reminder",
          { ...v.data, active: true },
          v.version,
        ),
      ];
    }
    case "reminder.cancel": {
      const v = ref.parse(p);
      const r = await s.get(v.id, "reminder");
      return [
        await s.put(r.id, "reminder", { ...r.data, active: false }, v.version),
      ];
    }
    case "device.sync": {
      const v = z
        .object({
          id: z.string().uuid(),
          installedReminderVersions: z.record(z.number().int()),
          notificationPermission: z.boolean(),
          exactAlarmPermission: z.boolean(),
          receipts: z.array(z.string()).max(10000),
        })
        .parse(p);
      const old = (await s.list("device")).find((d) => d.id === v.id);
      const { id, ...data } = v;
      return [await s.put(id, "device", data, old?.version ?? 0)];
    }
    case "audit": {
      z.object({
        event: z.string().min(1).max(100),
        target: z.string().max(200).optional(),
      }).parse(p);
      return [];
    }
  }
}
export async function queryEntities(type: EntityType, search?: string) {
  return transaction(async (s) =>
    (await s.list(type)).filter(
      (row) =>
        !search ||
        JSON.stringify(row.data)
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
    ),
  );
}
