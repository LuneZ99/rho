import Fastify from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z, ZodError } from "zod";
import { operationSchema } from "@rho/shared";
import { pool, entity, DomainError } from "./db.js";
import { operate } from "./domain.js";
import { isPublicGuideRequest, registerGuide } from "./guide.js";
import { isPublicReleaseRequest, registerReleases } from "./releases.js";
import { modelOptions, setDefaultModel } from "./models.js";
export function createApp(token: string) {
  if (token.length < 32) throw new Error("RHO_ACCESS_TOKEN 至少需要 32 个字符");
  const app = Fastify({
    logger: { redact: ["req.headers.authorization"], level: "info" },
    bodyLimit: 256 * 1024,
    disableRequestLogging: true,
  });
  app.addHook("onRequest", async (req, reply) => {
    if (
      req.url === "/healthz" ||
      isPublicGuideRequest(req.method, req.url) ||
      isPublicReleaseRequest(req.method, req.url)
    )
      return;
    const supplied = Buffer.from(
      req.headers.authorization?.replace(/^Bearer /, "") ?? "",
    );
    const expected = Buffer.from(token);
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      return reply.code(401).send({ error: "连接凭据无效，请检查连接设置" });
  });
  app.setErrorHandler((error: Error, req, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({
        error: "提交内容格式不正确",
        issues: error.issues.map((i) => ({
          path: i.path,
          message: i.message,
        })),
      });
    if (error instanceof DomainError)
      return reply.code(error.status).send({ error: error.message });
    req.log.error({ err: error }, "request_failed");
    return reply
      .code(500)
      .send({ error: "服务暂时无法处理，请稍后重试；输入已保留" });
  });
  app.get("/healthz", async () => {
    await pool.query("SELECT 1");
    return { ok: true };
  });
  app.get("/v1/models", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
    return modelOptions();
  });
  app.post("/v1/model-settings", async (req) => setDefaultModel(req.body));
  registerGuide(app);
  registerReleases(app);
  app.post("/v1/operations", async (req) => ({
    entities: await operate(operationSchema.parse(req.body)),
  }));
  app.get("/v1/sync", async (req) => {
    const { since } = z
      .object({ since: z.coerce.number().int().nonnegative().default(0) })
      .parse(req.query);
    const rows = await pool.query(
      "SELECT * FROM entities WHERE seq>$1 ORDER BY seq LIMIT 501",
      [since],
    );
    const entities = rows.rows.slice(0, 500).map(entity);
    return {
      entities,
      cursor: entities.at(-1)?.seq ?? since,
      hasMore: rows.rows.length > 500,
    };
  });
  // 持久消息为真相源；SSE 仅传输增量，连接断开不取消 worker。
  app.get("/v1/jobs/:id/events", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const found = await pool.query(
      "SELECT * FROM entities WHERE id=$1 AND type='job' AND NOT deleted",
      [id],
    );
    if (!found.rows[0]) throw new DomainError(404, "任务不存在");
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    let closed = false,
      seq = 0;
    reply.raw.on("close", () => {
      closed = true;
    });
    try {
      while (!closed) {
        const rows = await pool.query(
          "SELECT * FROM entities WHERE id=$1::uuid OR (type='message' AND data->>'jobId'=$1::text) ORDER BY seq",
          [id],
        );
        for (const row of rows.rows)
          if (Number(row.seq) > seq) {
            reply.raw.write(`data: ${JSON.stringify(entity(row))}\n\n`);
            seq = Number(row.seq);
          }
        if (
          ["completed", "failed", "interrupted"].includes(
            rows.rows.find((r) => r.type === "job")?.data.status,
          )
        )
          break;
        reply.raw.write(": keepalive\n\n");
        await new Promise((r) => setTimeout(r, 700));
      }
    } catch (error) {
      req.log.error({ err: error }, "job_stream_failed");
    } finally {
      reply.raw.end();
    }
  });
  return app;
}
