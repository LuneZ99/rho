import { z } from "zod";
import { DomainError, transaction, type Store } from "./db.js";
export const configuredModel = () => process.env.LITELLM_MODEL ?? "prod-max-1m";
export async function availableModels(): Promise<string[]> {
  if (!process.env.LITELLM_API_KEY)
    throw new DomainError(503, "服务端尚未配置模型凭据");
  try {
    const base = (
      process.env.LITELLM_BASE_URL ?? "https://litellm.sh.corgi.plus/v1"
    ).replace(/\/$/, "");
    const response = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${process.env.LITELLM_API_KEY}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("model list unavailable");
    const data = z
      .object({ data: z.array(z.object({ id: z.string().min(1).max(256) })) })
      .parse(await response.json());
    return [...new Set(data.data.map((m) => m.id))].sort((a, b) =>
      a.localeCompare(b),
    );
  } catch {
    throw new DomainError(
      503,
      "暂时无法获取可用模型，请稍后重试；原选择保持不变",
    );
  }
}
export async function requireAvailableModel(id: string) {
  if (!(await availableModels()).includes(id))
    throw new DomainError(400, "此模型已不可用，请刷新列表重新选择");
}
export async function modelPreference(
  s: Store,
): Promise<{ defaultModelId: string; version: number }> {
  const { rows } = await s.client.query(
    "SELECT value,version FROM preferences WHERE key='llm'",
  );
  return rows[0]
    ? { defaultModelId: rows[0].value.modelId, version: rows[0].version }
    : { defaultModelId: configuredModel(), version: 0 };
}
export async function modelOptions() {
  const models = await availableModels();
  const preference = await transaction(modelPreference);
  return { models, ...preference, legacyModelId: configuredModel() };
}
export async function setDefaultModel(input: unknown) {
  const p = z
    .object({
      modelId: z.string().min(1).max(256),
      version: z.number().int().nonnegative(),
    })
    .parse(input);
  await requireAvailableModel(p.modelId);
  return transaction(async (s) => {
    const old = await modelPreference(s);
    if (old.version !== p.version)
      throw new DomainError(409, "默认模型已改变，请刷新后重新选择");
    await s.client.query(
      "INSERT INTO preferences(key,value,version) VALUES('llm',$1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value,version=excluded.version",
      [JSON.stringify({ modelId: p.modelId }), old.version + 1],
    );
    await s.client.query(
      "INSERT INTO audit(actor,action,payload) VALUES('user','model.default',$1)",
      [JSON.stringify({ previous: old.defaultModelId, modelId: p.modelId })],
    );
    return { defaultModelId: p.modelId, version: old.version + 1 };
  });
}
