import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/api.js";
import { migrate, pool, transaction } from "../src/db.js";
import { operate } from "../src/domain.js";
import type { Operation } from "@rho/shared";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const token = "t".repeat(40),
  app = createApp(token),
  ids: string[] = [];
const op = (action: Operation["action"], payload: Record<string, unknown>) => ({
  id: randomUUID(),
  action,
  payload,
});
const itemData = () => ({
  module: "health",
  kind: "record",
  title: "头痛两次",
  content: "今日头痛两次",
  originalText: "今天头痛两次",
  category: "头痛",
  fields: { 次数: 2, 单位: "次" },
  occurredAt: new Date().toISOString(),
  sourceConversationId: null,
});
before(async () => {
  if (!process.env.DATABASE_URL?.endsWith("/rho_test"))
    throw new Error("测试必须使用独立 rho_test 数据库");
  await migrate();
});
after(async () => {
  await app.close();
  await pool.end();
});
test("外网接口要求凭据，健康检查不暴露数据", async () => {
  assert.equal((await app.inject("/v1/sync")).statusCode, 401);
  assert.equal((await app.inject("/healthz")).statusCode, 200);
});
test("公开指南和固定下载可访问，不能借此读取凭据或业务数据", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rho-guide-"));
  const previous = process.env.RHO_DOWNLOADS_DIR;
  process.env.RHO_DOWNLOADS_DIR = dir;
  try {
    await writeFile(join(dir, "rho-demo.apk"), "test-apk");
    await writeFile(join(dir, ".env"), "private-file");
    const page = await app.inject("/guide?from=phone");
    assert.equal(page.statusCode, 200);
    assert.match(page.body, /测试步骤/);
    assert.match(page.body, /预期结果/);
    assert.ok(!page.body.includes(token));
    assert.ok(!page.body.includes("private-file"));
    const download = await app.inject("/downloads/rho-demo.apk");
    assert.equal(download.statusCode, 200);
    assert.equal(download.body, "test-apk");
    assert.match(String(download.headers["content-disposition"]), /attachment/);
    assert.equal(
      (await app.inject({ method: "HEAD", url: "/guide" })).statusCode,
      200,
    );
    for (const url of [
      "/downloads/.env",
      "/guide/private",
      "/guide/../v1/sync",
      "/v1/sync?from=guide",
    ])
      assert.equal((await app.inject(url)).statusCode, 401);
    assert.equal(
      (await app.inject({ method: "POST", url: "/guide" })).statusCode,
      401,
    );
    assert.equal(
      (await app.inject("/downloads/rho-demo.apk.sha256")).statusCode,
      404,
    );
  } finally {
    if (previous === undefined) delete process.env.RHO_DOWNLOADS_DIR;
    else process.env.RHO_DOWNLOADS_DIR = previous;
    await rm(dir, { recursive: true });
  }
});
test("灵活记录、重复提交、同编号不同请求与版本冲突", async () => {
  const request = op("item.save", { data: itemData() });
  const [a, b] = await Promise.all([operate(request), operate(request)]);
  assert.equal(a[0].id, b[0].id);
  assert.deepEqual(a, b);
  ids.push(a[0].id);
  await assert.rejects(
    operate({
      ...request,
      payload: { data: { ...itemData(), title: "另一条" } },
    }),
    /编号/,
  );
  const e = a[0];
  const updated = await operate(
    op("item.save", {
      id: e.id,
      version: e.version,
      data: { ...e.data, fields: { 次数: 3, 情境: "下午" } },
    }),
  );
  assert.equal(updated[0].version, 2);
  await assert.rejects(
    operate(op("item.save", { id: e.id, version: e.version, data: e.data })),
    /更新/,
  );
});
test("忽略卡片保留事项与提醒，完成事项同时取消提醒", async () => {
  const [i] = await operate(
    op("item.save", { data: { ...itemData(), module: "tasks", kind: "task" } }),
  );
  const [r] = await operate(
    op("reminder.save", {
      data: {
        itemId: i.id,
        title: "量腰围",
        at: new Date(Date.now() + 3600000).toISOString(),
        timezone: "Asia/Shanghai",
        repeat: "daily",
      },
    }),
  );
  const [c] = await operate(
    op("card.save", {
      data: {
        itemId: i.id,
        title: "量腰围",
        summary: "今晚记一次",
        priority: 60,
      },
    }),
  );
  const [ignored] = await operate(
    op("card.action", { id: c.id, version: c.version, action: "ignore" }),
  );
  await transaction(async (s) => {
    assert.equal((await s.get(i.id, "item")).data.status, "active");
    assert.equal((await s.get(r.id, "reminder")).data.active, true);
  });
  await operate(
    op("card.action", {
      id: c.id,
      version: ignored.version,
      action: "complete",
    }),
  );
  await transaction(async (s) => {
    assert.equal((await s.get(i.id, "item")).data.status, "completed");
    assert.equal((await s.get(r.id, "reminder")).data.active, false);
    await assert.rejects(s.get(c.id, "card"), /不存在/);
  });
});
test("推迟卡片不改提醒，过去时间和已完成事项的提醒被拒绝", async () => {
  const [i] = await operate(op("item.save", { data: itemData() }));
  const [c] = await operate(
    op("card.save", {
      data: { itemId: i.id, title: "关注", summary: "后续记录", priority: 50 },
    }),
  );
  await assert.rejects(
    operate(
      op("card.action", {
        id: c.id,
        version: c.version,
        action: "snooze",
        until: "2020-01-01T00:00:00Z",
      }),
    ),
    /未来/,
  );
  await assert.rejects(
    operate(
      op("reminder.save", {
        data: {
          itemId: i.id,
          title: "提醒",
          at: "2020-01-01T00:00:00Z",
          timezone: "Asia/Shanghai",
          repeat: "once",
        },
      }),
    ),
    /将来/,
  );
});
test("消息接收事务和重试只产生一个任务", async () => {
  const id = randomUUID();
  await operate(op("conversation.create", { id, title: "测试会话" }));
  const [item] = await operate(op("item.save", { data: itemData() }));
  const request = op("message.send", {
    conversationId: id,
    text: "记录一杯咖啡",
    itemId: item.id,
  });
  const a = await operate(request),
    b = await operate(request);
  assert.deepEqual(a, b);
  assert.equal(a.filter((e) => e.type === "job").length, 1);
  assert.equal(
    (a.find((e) => e.type === "message")!.data as { text: string }).text,
    "记录一杯咖啡",
  );
  assert.ok(
    (
      a.find((e) => e.type === "job")!.data as { cardContext: string }
    ).cardContext.includes(item.id),
  );
});
test("跨对话修改记录仍保留原来的详细处理入口", async () => {
  const source = randomUUID(),
    other = randomUUID();
  await operate(op("conversation.create", { id: source, title: "来源对话" }));
  await operate(op("conversation.create", { id: other, title: "另一段对话" }));
  const [item] = await operate(
    op("item.save", { data: { ...itemData(), sourceConversationId: source } }),
  );
  const [updated] = await operate(
    op("item.save", {
      id: item.id,
      version: item.version,
      data: { ...item.data, title: "补充记录", sourceConversationId: other },
    }),
  );
  assert.equal(
    (updated.data as { sourceConversationId: string }).sourceConversationId,
    source,
  );
});
test("删除通过增量同步保留墓碑，不再查询到旧内容", async () => {
  const [i] = await operate(op("item.save", { data: itemData() }));
  await operate(op("item.delete", { id: i.id, version: i.version }));
  const r = await app.inject({
    url: `/v1/sync?since=${i.seq}`,
    headers: { authorization: `Bearer ${token}` },
  });
  const data = r.json();
  assert.equal(
    data.entities.find((e: { id: string }) => e.id === i.id).deleted,
    true,
  );
  assert.ok(data.cursor > i.seq);
});
test("无效负载返回400，不能写入任意实体", async () => {
  const r = await app.inject({
    method: "POST",
    url: "/v1/operations",
    headers: { authorization: `Bearer ${token}` },
    payload: op("item.save", { data: { module: "unknown" } }),
  });
  assert.equal(r.statusCode, 400);
});
test("任务进度连接持续收到更新并在完成后关闭", async () => {
  const id = randomUUID();
  await operate(op("conversation.create", { id, title: "进度测试" }));
  const created = await operate(
    op("message.send", { conversationId: id, text: "测试流式进度" }),
  );
  const job = created.find((e) => e.type === "job")!;
  const url = await app.listen({ port: 0, host: "127.0.0.1" });
  const response = await fetch(`${url}/v1/jobs/${job.id}/events`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  assert.equal(response.status, 200);
  const reader = response.body!.getReader(),
    decoder = new TextDecoder();
  const initial = await reader.read();
  assert.ok(decoder.decode(initial.value).includes('"queued"'));
  await transaction(async (s) => {
    const j = await s.get(job.id, "job");
    const m = await s.get(j.data.assistantId, "message");
    await s.put(
      m.id,
      "message",
      { ...m.data, text: "收到真实流式更新", state: "streaming" },
      m.version,
    );
  });
  let streamed = "";
  while (!streamed.includes("收到真实流式更新")) {
    const part = await reader.read();
    assert.equal(part.done, false, "请求不能在第一批结果后提前结束");
    streamed += decoder.decode(part.value, { stream: true });
  }
  await transaction(async (s) => {
    const j = await s.get(job.id, "job");
    await s.put(j.id, "job", { ...j.data, status: "completed" }, j.version);
  });
  let final = "";
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    final += decoder.decode(part.value, { stream: true });
  }
  assert.ok(final.includes('"completed"'));
});
