import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { resolve, basename } from "node:path";
import type { FastifyInstance } from "fastify";
import {
  releaseCatalogSchema,
  releaseDownloadPattern,
  releasePath,
} from "@rho/shared/releases";

export function isPublicReleaseRequest(method: string, url: string) {
  const path = url.split("?")[0];
  return (
    ["GET", "HEAD"].includes(method) &&
    (path === "/releases.json" || releaseDownloadPattern.test(path))
  );
}
export function registerReleases(app: FastifyInstance) {
  const directory = () =>
    resolve(process.env.RHO_DOWNLOADS_DIR ?? "../../artifacts", "releases");
  async function catalog() {
    try {
      return releaseCatalogSchema
        .parse(
          JSON.parse(
            await readFile(resolve(directory(), "index.json"), "utf8"),
          ),
        )
        .sort((a, b) => b.versionCode - a.versionCode);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
  app.get("/releases.json", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
    return catalog();
  });
  app.get("/downloads/releases/:filename", async (req, reply) => {
    const path = req.url.split("?")[0];
    const release = (await catalog()).find(
      (r) => releasePath(r.version) === path,
    );
    if (!release) return reply.code(404).send({ error: "此版本尚未提供下载" });
    const filename = resolve(directory(), basename(path));
    try {
      const info = await stat(filename);
      if (info.size !== release.size)
        return reply.code(503).send({ error: "安装包暂不可用，请稍后重试" });
    } catch {
      return reply.code(404).send({ error: "安装包暂不可用，请稍后重试" });
    }
    return reply
      .type("application/vnd.android.package-archive")
      .header("Content-Disposition", `attachment; filename="${basename(path)}"`)
      .header("Content-Length", release.size)
      .header("X-Content-Type-Options", "nosniff")
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .send(createReadStream(filename));
  });
}
