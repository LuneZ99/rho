import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/api.js";
import { migrate, pool, transaction } from "../src/db.js";
import { operate } from "../src/domain.js";
const app = createApp("m".repeat(40));
const headers = { authorization: "Bearer " + "m".repeat(40) };
let models = ["model-a", "model-b", "model-c"],
  unavailable = false;
const mock = createServer((req, res) => {
  assert.equal(req.url, "/v1/models");
  assert.equal(req.headers.authorization, "Bearer test-secret");
  res.writeHead(unavailable ? 503 : 200, {
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify({ data: models.map((id) => ({ id })) }));
});
before(async () => {
  if (!process.env.DATABASE_URL?.endsWith("/rho_test"))
    throw new Error("Only rho_test");
  await migrate();
  mock.listen(0, "127.0.0.1");
  await once(mock, "listening");
  process.env.LITELLM_BASE_URL = `http://127.0.0.1:${(mock.address() as { port: number }).port}/v1`;
  process.env.LITELLM_API_KEY = "test-secret";
});
after(async () => {
  await app.close();
  mock.close();
  await pool.end();
});
test("实时目录、权限、默认值范围、会话独立设置及任务模型快照", async () => {
  assert.equal((await app.inject("/v1/models")).statusCode, 401);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/v1/model-settings",
        payload: { modelId: "model-a", version: 0 },
      })
    ).statusCode,
    401,
  );
  const get = () => app.inject({ url: "/v1/models", headers });
  const first = await get();
  assert.equal(first.statusCode, 200);
  assert.equal(first.headers["cache-control"], "no-store");
  assert.deepEqual(first.json().models, models);
  assert.ok(!first.body.includes("test-secret"));
  const original = first.json();
  async function set(modelId: string, version: number) {
    return app.inject({
      method: "POST",
      url: "/v1/model-settings",
      headers,
      payload: { modelId, version },
    });
  }
  const created: string[] = [];
  async function conversation() {
    const id = randomUUID();
    created.push(id);
    return (
      await operate({
        id: randomUUID(),
        action: "conversation.create",
        payload: { id, title: "Model regression" },
      })
    )[0];
  }
  try {
    assert.equal((await set("model-a", original.version)).statusCode, 200);
    const a = await conversation();
    assert.equal((a.data as { modelId: string }).modelId, "model-a");
    assert.equal((await set("model-b", original.version + 1)).statusCode, 200);
    assert.equal((await set("model-c", original.version + 1)).statusCode, 409);
    const b = await conversation();
    assert.equal((b.data as { modelId: string }).modelId, "model-b");
    const messages = await operate({
      id: randomUUID(),
      action: "message.send",
      payload: { conversationId: a.id, text: "before switch" },
    });
    const job = messages.find((m) => m.type === "job")!;
    const change = {
      id: randomUUID(),
      action: "conversation.model" as const,
      payload: { id: a.id, version: a.version, modelId: "model-c" },
    };
    await operate(change);
    assert.equal(
      (await transaction((s) => s.get(a.id, "conversation"))).data.modelId,
      "model-c",
    );
    assert.equal(
      (await transaction((s) => s.get(b.id, "conversation"))).data.modelId,
      "model-b",
    );
    assert.equal(
      (await transaction((s) => s.get(job.id, "job"))).data.modelId,
      "model-a",
    );
    assert.ok(
      messages.every(
        (m) => (m.data as { modelId: string }).modelId === "model-a",
      ),
    );
    const next = await operate({
      id: randomUUID(),
      action: "message.send",
      payload: { conversationId: a.id, text: "after switch" },
    });
    assert.ok(
      next.every((m) => (m.data as { modelId: string }).modelId === "model-c"),
    );
    await assert.rejects(operate({ ...change, id: randomUUID() }), /更新/);
    models = ["model-b"];
    assert.deepEqual((await get()).json().models, ["model-b"]);
    assert.equal((await set("model-c", original.version + 2)).statusCode, 400);
    unavailable = true;
    assert.equal((await get()).statusCode, 503);
    assert.equal((await set("model-b", original.version + 2)).statusCode, 503);
    assert.equal(
      (await operate(change))[0].id,
      a.id,
      "successful retry independent of upstream outage",
    );
    assert.equal(
      (await transaction((s) => s.get(a.id, "conversation"))).data.modelId,
      "model-c",
    );
  } finally {
    await transaction(async (s) => {
      if (original.version)
        await s.client.query(
          "UPDATE preferences SET value=$1,version=$2 WHERE key='llm'",
          [
            JSON.stringify({ modelId: original.defaultModelId }),
            original.version,
          ],
        );
      else await s.client.query("DELETE FROM preferences WHERE key='llm'");
      for (const j of await s.list("job"))
        if (created.includes(j.data.conversationId))
          await s.put(
            j.id,
            "job",
            { ...j.data, status: "failed", error: "test complete" },
            j.version,
          );
    });
  }
});
