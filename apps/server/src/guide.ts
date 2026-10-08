import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { demoUrl, guideIntro, guideSections } from "@rho/shared/guide";

const fonts = fileURLToPath(new URL("../public/fonts/", import.meta.url));
const assets = {
  "/downloads/rho-demo.apk": [
    "rho-demo.apk",
    "application/vnd.android.package-archive",
  ],
  "/downloads/rho-demo.apk.sha256": [
    "rho-demo.apk.sha256",
    "text/plain; charset=utf-8",
  ],
  "/guide/fonts/MiSans-Regular.woff2": ["MiSans-Regular.woff2", "font/woff2"],
  "/guide/fonts/MiSans-Medium.woff2": ["MiSans-Medium.woff2", "font/woff2"],
  "/guide/fonts/LICENSE.pdf": ["LICENSE.pdf", "application/pdf"],
} as const;

// 只开放这些固定的只读地址，不按前缀豁免业务接口鉴权。
export function isPublicGuideRequest(method: string, url: string) {
  const path = url.split("?")[0];
  return (
    ["GET", "HEAD"].includes(method) &&
    (["/", "/guide", "/guide/"].includes(path) || Object.hasOwn(assets, path))
  );
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export function guideHtml() {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101823"><meta name="robots" content="noindex,nofollow"><title>rho · 试用指南</title>
<style>
@font-face{font-family:MiSans;src:url('/guide/fonts/MiSans-Regular.woff2') format('woff2');font-weight:400;font-display:swap}
@font-face{font-family:MiSans;src:url('/guide/fonts/MiSans-Medium.woff2') format('woff2');font-weight:500 800;font-display:swap}
:root{color-scheme:dark;--bg:#101823;--surface:#1A2738;--raised:#25364D;--text:#EDF3FC;--muted:#ADBDD3;--accent:#A6C8FF;--on-accent:#132F54;--line:#354861}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:400 16px/1.75 MiSans,sans-serif;overflow-wrap:anywhere;scrollbar-color:var(--line) var(--bg)}
main{max-width:760px;margin:auto;padding:40px 24px 64px}h1{font-size:32px;line-height:1.3;margin:0 0 16px;font-weight:500}h2{font-size:24px;line-height:1.4;font-weight:500;margin:0 0 12px}h3{font-size:20px;line-height:1.5;font-weight:500;margin:28px 0 12px}p{margin:12px 0}a{color:var(--accent);text-underline-offset:.22em}a:focus-visible{outline:2px solid var(--accent);outline-offset:5px}a:hover{text-decoration-thickness:2px}a:active{opacity:.7}::selection{background:var(--accent);color:var(--on-accent)}
.muted,.expected{color:var(--muted)}.actions{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}.button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:10px 20px;border-radius:12px;text-decoration:none;font-weight:500;background:var(--accent);color:var(--on-accent)}.button.secondary{background:var(--raised);color:var(--accent)}.button:hover{filter:brightness(1.08)}
nav{margin:32px 0;display:grid;gap:0}nav a{padding:14px 0;border-bottom:1px solid var(--line)}section{margin-top:40px;padding-top:32px;border-top:1px solid var(--line);scroll-margin-top:24px}.expected{padding:16px 20px;border-radius:16px;background:var(--surface)}footer{margin-top:40px;padding-top:24px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}.address{user-select:all;font-variant-numeric:tabular-nums}
@media(max-width:480px){main{padding:28px 20px 48px}h1{font-size:28px}.actions{flex-direction:column;align-items:stretch}}
</style></head><body><main id="top">
<h1>rho 试用指南</h1><p class="muted">${escape(guideIntro)}</p>
<div class="actions"><a class="button" href="/downloads/rho-demo.apk" download="rho-demo.apk">下载 Android 安装包</a><a class="button secondary" href="rho:///guide">在 rho 中打开指南</a></div>
<p class="muted">安装后：右上角设置 → 试用指南与资料。已安装旧版时，直接覆盖更新即可。</p>
<nav aria-label="指南目录">${guideSections.map((s) => `<a href="#${s.id}">${escape(s.title)}</a>`).join("")}</nav>
${guideSections.map((s) => `<section id="${s.id}" aria-labelledby="heading-${s.id}"><h2 id="heading-${s.id}">${escape(s.title)}</h2>${s.id === "connection" ? `<p>服务地址：<span class="address">${escape(demoUrl)}</span></p>` : ""}${s.entries.map((e) => `<article><h3>${escape(e.title)}</h3>${e.paragraphs.map((p) => `<p>${escape(p)}</p>`).join("")}${"expected" in e ? `<p class="expected">预期结果：${escape(e.expected)}</p>` : ""}</article>`).join("")}<p><a href="#top">返回目录</a></p></section>`).join("")}
<footer>rho · 第一个 demo · 指南更新于 2026-10-04<br><a href="/downloads/rho-demo.apk.sha256">安装包校验值</a> · <a href="/guide/fonts/LICENSE.pdf">MiSans 字体许可</a></footer>
</main></body></html>`;
}

export function registerGuide(app: FastifyInstance) {
  for (const path of ["/", "/guide", "/guide/"])
    app.get(path, async (_req, reply) =>
      reply
        .header(
          "Content-Security-Policy",
          "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; base-uri 'none'; frame-ancestors 'none'",
        )
        .header("Referrer-Policy", "no-referrer")
        .header("X-Content-Type-Options", "nosniff")
        .header("Cache-Control", "no-cache")
        .type("text/html; charset=utf-8")
        .send(guideHtml()),
    );

  for (const [path, [file, type]] of Object.entries(assets))
    app.get(path, async (_req, reply) => {
      const directory = path.startsWith("/guide/fonts/")
        ? fonts
        : resolve(process.env.RHO_DOWNLOADS_DIR ?? "../../artifacts");
      const filename = resolve(directory, file);
      let size: number;
      try {
        size = (await stat(filename)).size;
      } catch {
        return reply
          .code(404)
          .type("text/plain; charset=utf-8")
          .send("文件暂未提供，请稍后回到指南重试。");
      }
      reply
        .header(
          "Cache-Control",
          path.startsWith("/downloads/") ? "no-store" : "public, max-age=86400",
        )
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Length", size)
        .type(type);
      if (path.startsWith("/downloads/"))
        reply.header("Content-Disposition", `attachment; filename="${file}"`);
      return reply.send(createReadStream(filename));
    });
}
