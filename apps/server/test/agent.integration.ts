// 使用可控的 OpenAI 协议服务验证真实 Pi SDK 工具链；不作为真实模型验收。
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { migrate, pool, transaction } from "../src/db.js";
import { operate } from "../src/domain.js";
if (!process.env.DATABASE_URL?.endsWith("/rho_test"))
  throw new Error("仅可使用 rho_test");
await migrate();
// 与其他测试的排队任务隔离，不删除业务数据。
await transaction(async (s) => {
  for (const j of await s.list("job"))
    if (j.data.status === "queued")
      await s.put(
        j.id,
        "job",
        { ...j.data, status: "failed", error: "旧测试任务已结束" },
        j.version,
      );
});
const conversationId = randomUUID(),
  category = `咖啡测试-${randomUUID()}`;
let requests = 0;
const calledModels: string[] = [];
const mock = createServer(async (req, res) => {
  if (req.url === "/v1/models") {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({ data: [{ id: "rho-test" }, { id: "rho-test-next" }] }),
    );
    return;
  }
  let body = "";
  for await (const chunk of req) body += chunk;
  const input = JSON.parse(body);
  requests++;
  calledModels.push(input.model);
  assert.equal(req.url, "/v1/chat/completions");
  assert.ok(
    input.tools.some(
      (t: { function: { name: string } }) => t.function.name === "save_item",
    ),
  );
  assert.ok(
    !input.tools.some(
      (t: { function: { name: string } }) => t.function.name === "bash",
    ),
  );
  const saved = input.messages.some(
    (m: { role: string; content: unknown }) =>
      m.role === "tool" && JSON.stringify(m.content).includes(category),
  );
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  const delta = saved
    ? { content: "已记录今天两杯咖啡。" }
    : {
        tool_calls: [
          {
            index: 0,
            id: "call_record_coffee",
            type: "function",
            function: {
              name: "save_item",
              arguments: JSON.stringify({
                data: {
                  module: "health",
                  kind: "record",
                  title: "咖啡两杯",
                  content: "今天喝了两杯咖啡",
                  originalText: "今天喝了两杯咖啡",
                  category,
                  fields: { 杯数: 2 },
                  occurredAt: new Date().toISOString(),
                  sourceConversationId: conversationId,
                },
              }),
            },
          },
        ],
      };
  const send = (d: unknown, finish: string | null) =>
    res.write(
      `data: ${JSON.stringify({ id: "test", object: "chat.completion.chunk", created: 1, model: "rho-test", choices: [{ index: 0, delta: d, finish_reason: finish }] })}\n\n`,
    );
  send({ role: "assistant" }, null);
  send(delta, null);
  send({}, saved ? "stop" : "tool_calls");
  res.end("data: [DONE]\n\n");
});
mock.listen(0, "127.0.0.1");
await once(mock, "listening");
const port = (mock.address() as { port: number }).port,
  directory = await mkdtemp(`${tmpdir()}/rho-agent-`);
const child = spawn(process.execPath, ["--import", "tsx", "src/worker.ts"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    LITELLM_BASE_URL: `http://127.0.0.1:${port}/v1`,
    LITELLM_API_KEY: "test-only",
    LITELLM_MODEL: "rho-test",
    AGENT_DATA_DIR: directory,
  },
  stdio: ["ignore", "inherit", "inherit"],
});
process.env.LITELLM_BASE_URL = `http://127.0.0.1:${port}/v1`;
process.env.LITELLM_API_KEY = "test-only";
process.env.LITELLM_MODEL = "rho-test";
try {
  await operate({
    id: randomUUID(),
    action: "conversation.create",
    payload: { id: conversationId, title: "Pi SDK集成测试" },
  });
  const rows = await operate({
    id: randomUUID(),
    action: "message.send",
    payload: { conversationId, text: "今天喝了两杯咖啡" },
  });
  const id = rows.find((e) => e.type === "job")!.id;
  let done = false;
  for (let n = 0; n < 45; n++) {
    await new Promise((r) => setTimeout(r, 1000));
    const job = await transaction((s) => s.get(id, "job"));
    if (job.data.status === "failed") throw new Error(job.data.error!);
    if (job.data.status === "completed") {
      done = true;
      break;
    }
  }
  assert.ok(done, "worker 应完成任务");
  assert.ok(requests >= 2, "应经过工具调用及最终回答");
  const items = await transaction((s) => s.list("item"));
  assert.equal(items.filter((i) => i.data.category === category).length, 1);
  const messages = await transaction((s) => s.list("message"));
  assert.ok(
    messages.some(
      (m) =>
        m.data.conversationId === conversationId &&
        m.data.role === "assistant" &&
        m.data.text.includes("已记录"),
    ),
  );
  const conversation = await transaction((s) =>
    s.get(conversationId, "conversation"),
  );
  await operate({
    id: randomUUID(),
    action: "conversation.model",
    payload: {
      id: conversationId,
      version: conversation.version,
      modelId: "rho-test-next",
    },
  });
  const next = await operate({
    id: randomUUID(),
    action: "message.send",
    payload: { conversationId, text: "继续上一轮，不要重复记录" },
  });
  const nextJob = next.find((e) => e.type === "job")!;
  let nextDone = false;
  for (let n = 0; n < 45; n++) {
    await new Promise((r) => setTimeout(r, 1000));
    const j = await transaction((s) => s.get(nextJob.id, "job"));
    if (j.data.status === "failed") throw new Error(j.data.error!);
    if (j.data.status === "completed") {
      nextDone = true;
      break;
    }
  }
  assert.ok(nextDone);
  assert.deepEqual(calledModels, ["rho-test", "rho-test", "rho-test-next"]);
  assert.equal(
    (await transaction((s) => s.list("item"))).filter(
      (i) => i.data.category === category,
    ).length,
    1,
    "model switch preserves context and does not repeat tool write",
  );
  console.log("PASS: model switch uses new model and preserves SDK context");
  console.log("PASS: Pi SDK → 工具 → PostgreSQL → 持久消息；未开放 shell");
} finally {
  child.kill("SIGTERM");
  await once(child, "exit");
  mock.close();
  await pool.end();
  await rm(directory, { recursive: true, force: true });
}
