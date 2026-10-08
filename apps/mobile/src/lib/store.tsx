import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { AppState } from "react-native";
import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";
import { randomUUID } from "expo-crypto";
import { fetch as streamFetch } from "expo/fetch";
import type {
  Entity,
  EntityType,
  Operation,
  SyncResult,
  DataMap,
  ModelOptions,
} from "@rho/shared";
import { Reminders, type ReminderStatus } from "../../modules/rho-reminders";
export type Pending = Operation & { error?: string };
type Connection = { url: string; token: string };
type Model = {
  ready: boolean;
  entities: Entity[];
  pending: Pending[];
  error: string | null;
  syncing: boolean;
  connection: Connection | null;
  reminders: ReminderStatus | null;
  loadModels(): Promise<ModelOptions>;
  saveDefaultModel(modelId: string, version: number): Promise<void>;
  saveConversationModel(
    id: string,
    modelId: string,
    version: number,
  ): Promise<void>;
  configure(c: Connection): Promise<void>;
  sync(): Promise<void>;
  submit(
    action: Operation["action"],
    payload: Record<string, unknown>,
  ): Promise<void>;
  discard(id: string): Promise<void>;
  retry(id: string): Promise<void>;
  audit(event: string, target?: string): void;
};
const Context = createContext<Model>(null!);
let db: SQLite.SQLiteDatabase;
async function saveEntities(entities: Entity[]) {
  await db.withTransactionAsync(async () => {
    for (const e of entities)
      await db.runAsync(
        "INSERT INTO entities(id,json,seq) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json,seq=excluded.seq WHERE excluded.seq >= entities.seq",
        e.id,
        JSON.stringify(e),
        e.seq,
      );
  });
}
export function Provider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false),
    [entities, setEntities] = useState<Entity[]>([]),
    [pending, setPending] = useState<Pending[]>([]);
  const [connection, setConnection] = useState<Connection | null>(null),
    [error, setError] = useState<string | null>(null),
    [syncing, setSyncing] = useState(false),
    [reminders, setReminders] = useState<ReminderStatus | null>(null),
    [active, setActive] = useState(AppState.currentState === "active");
  const [streamAttempt, setStreamAttempt] = useState(0);
  const busy = useRef(false),
    config = useRef(connection);
  config.current = connection;
  const reload = useCallback(async () => {
    setEntities(
      (
        await db.getAllAsync<{ json: string }>(
          "SELECT json FROM entities ORDER BY seq",
        )
      ).map((r) => JSON.parse(r.json)),
    );
    setPending(
      (
        await db.getAllAsync<{ json: string; error: string | null }>(
          "SELECT json,error FROM outbox ORDER BY n",
        )
      ).map((r) => ({ ...JSON.parse(r.json), error: r.error ?? undefined })),
    );
  }, []);
  useEffect(() => {
    let live = true;
    void (async () => {
      db = await SQLite.openDatabaseAsync("rho.db");
      await db.execAsync(
        "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS entities(id TEXT PRIMARY KEY,json TEXT NOT NULL,seq INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS outbox(n INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE,json TEXT NOT NULL,error TEXT); CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);",
      );
      const stored = await SecureStore.getItemAsync("connection");
      if (live) {
        setConnection(stored ? JSON.parse(stored) : null);
        await reload();
        if (Reminders) setReminders(JSON.parse(await Reminders.status()));
        setReady(true);
      }
    })().catch((e) => {
      setError(String(e));
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [reload]);
  const request = useCallback(async (path: string, body?: unknown) => {
    const c = config.current;
    if (!c) throw new Error("请先连接你的 rho 服务");
    const response = await fetch(c.url + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${c.token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    }).catch(() => {
      throw new Error("暂时无法连接，已保存在手机的内容仍可查看");
    });
    if (!response.ok) {
      const data = await response.json();
      throw Object.assign(new Error(data.error ?? "连接失败"), {
        status: response.status,
      });
    }
    return response.json();
  }, []);
  const sync = useCallback(async () => {
    if (!db || !config.current || busy.current) return;
    busy.current = true;
    setSyncing(true);
    try {
      const queue = await db.getAllAsync<{
        id: string;
        json: string;
        error: string | null;
      }>("SELECT id,json,error FROM outbox ORDER BY n");
      for (const row of queue) {
        if (row.error) break;
        try {
          const result = await request("/v1/operations", JSON.parse(row.json));
          await saveEntities(result.entities);
          await db.runAsync("DELETE FROM outbox WHERE id=?", row.id);
        } catch (e) {
          const x = e as Error & { status?: number };
          if (x.status && [400, 404, 409].includes(x.status)) {
            await db.runAsync(
              "UPDATE outbox SET error=? WHERE id=?",
              x.message,
              row.id,
            );
            break;
          }
          throw e;
        }
      }
      let cursor = Number(
        (
          await db.getFirstAsync<{ value: string }>(
            "SELECT value FROM meta WHERE key='cursor'",
          )
        )?.value ?? 0,
      );
      let hasMore = true;
      while (hasMore) {
        const result: SyncResult = await request(`/v1/sync?since=${cursor}`);
        await saveEntities(result.entities);
        cursor = result.cursor;
        hasMore = result.hasMore;
        await db.runAsync(
          "INSERT OR REPLACE INTO meta(key,value) VALUES('cursor',?)",
          String(cursor),
        );
      }
      if (Reminders) {
        const all: Entity[] = (
          await db.getAllAsync<{ json: string }>("SELECT json FROM entities")
        ).map((r) => JSON.parse(r.json));
        const rs = all.filter(
          (e) => e.type === "reminder" && !e.deleted,
        ) as Entity<"reminder">[];
        const status: ReminderStatus = JSON.parse(
          await Reminders.sync(
            JSON.stringify(
              rs.map((e) => ({ id: e.id, version: e.version, ...e.data })),
            ),
          ).catch(() => {
            throw new Error("记录已同步，但手机提醒尚未安排。请稍后重试。");
          }),
        );
        setReminders(status);
        let deviceId = (
          await db.getFirstAsync<{ value: string }>(
            "SELECT value FROM meta WHERE key='device'",
          )
        )?.value;
        if (!deviceId) {
          deviceId = randomUUID();
          await db.runAsync(
            "INSERT INTO meta(key,value) VALUES('device',?)",
            deviceId,
          );
        }
        const { history, ...payload } = status;
        const serialized = JSON.stringify(payload);
        const old = (
          await db.getFirstAsync<{ value: string }>(
            "SELECT value FROM meta WHERE key='deviceStatus'",
          )
        )?.value;
        if (old !== serialized) {
          await request("/v1/operations", {
            id: randomUUID(),
            action: "device.sync",
            payload: { id: deviceId, ...payload },
          });
          await db.runAsync(
            "INSERT OR REPLACE INTO meta(key,value) VALUES('deviceStatus',?)",
            serialized,
          );
        }
      }
      const blocked = await db.getFirstAsync<{ error: string }>(
        "SELECT error FROM outbox WHERE error IS NOT NULL ORDER BY n LIMIT 1",
      );
      setError(blocked?.error ?? null);
    } catch (e) {
      setError((e as Error).message || "暂时无法连接，已保存内容仍可查看");
    } finally {
      try {
        await reload();
      } finally {
        busy.current = false;
        setSyncing(false);
      }
    }
  }, [reload, request]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      setActive(state === "active");
      if (state === "active") {
        if (Reminders)
          void Reminders.status()
            .then((value) => setReminders(JSON.parse(value)))
            .catch((e) => setError(String(e)));
        void sync();
      }
    });
    return () => sub.remove();
  }, [sync]);
  useEffect(() => {
    if (ready && connection) void sync();
  }, [ready, connection, sync]);
  useEffect(() => {
    if (!ready || !active || !connection || (!error && !pending.length)) return;
    const timer = setTimeout(
      () => {
        void sync();
      },
      error ? 15000 : 250,
    );
    return () => clearTimeout(timer);
  }, [ready, active, connection, error, pending, sync]);
  const running = entities.find(
    (e) =>
      !e.deleted &&
      e.type === "job" &&
      ["queued", "running"].includes((e.data as DataMap["job"]).status),
  );
  useEffect(() => {
    if (!running || !connection || !active) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    void (async () => {
      const r = await streamFetch(
        `${connection.url}/v1/jobs/${running.id}/events`,
        {
          headers: { Authorization: `Bearer ${connection.token}` },
          signal: abort.signal,
        },
      );
      if (!r.ok || !r.body) throw new Error("任务进度连接中断");
      const reader = r.body.getReader(),
        decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop()!;
        const events = chunks
          .filter((c) => c.startsWith("data: "))
          .map((c) => JSON.parse(c.slice(6)) as Entity);
        if (events.length) {
          await saveEntities(events);
          await reload();
        }
      }
      await sync();
    })().catch((e) => {
      if (!abort.signal.aborted) {
        setError("进度连接中断，任务仍在服务端执行");
        timer = setTimeout(() => {
          setStreamAttempt((n) => n + 1);
          void sync();
        }, 3000);
      }
    });
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [running?.id, connection, active, reload, sync, streamAttempt]);
  const submit = useCallback(
    async (action: Operation["action"], payload: Record<string, unknown>) => {
      const op: Operation = { id: randomUUID(), action, payload };
      await db.runAsync(
        "INSERT INTO outbox(id,json) VALUES(?,?)",
        op.id,
        JSON.stringify(op),
      );
      if (action === "conversation.create")
        await saveEntities([
          {
            id: payload.id as string,
            type: "conversation",
            version: 0,
            seq: 0,
            deleted: false,
            updatedAt: new Date().toISOString(),
            data: { title: payload.title as string },
          },
        ]);
      await reload();
      void sync();
    },
    [reload, sync],
  );
  const loadModels = useCallback(
    (): Promise<ModelOptions> => request("/v1/models"),
    [request],
  );
  const saveDefaultModel = async (modelId: string, version: number) => {
    await request("/v1/model-settings", { modelId, version });
  };
  const saveConversationModel = async (
    id: string,
    modelId: string,
    version: number,
  ) => {
    const result = await request("/v1/operations", {
      id: randomUUID(),
      action: "conversation.model",
      payload: { id, modelId, version },
    });
    await saveEntities(result.entities);
    await reload();
  };
  const configure = async (c: Connection) => {
    c.url = c.url.trim().replace(/\/$/, "");
    c.token = c.token.trim();
    if (!/^https:\/\//.test(c.url)) throw new Error("请输入 HTTPS 服务地址");
    if (connection && connection.url !== c.url)
      throw new Error(
        "此安装已关联一个服务，切换服务前请导出数据并清除应用数据",
      );
    const r = await fetch(c.url + "/v1/sync?since=0", {
      headers: { Authorization: `Bearer ${c.token}` },
      signal: AbortSignal.timeout(15000),
    }).catch(() => {
      throw new Error("无法连接服务，请检查服务地址和网络");
    });
    if (!r.ok)
      throw new Error(r.status === 401 ? "访问令牌不正确" : "服务暂时不可用");
    await SecureStore.setItemAsync("connection", JSON.stringify(c));
    setConnection(c);
  };
  const discard = async (id: string) => {
    const row = await db.getFirstAsync<{ json: string }>(
      "SELECT json FROM outbox WHERE id=?",
      id,
    );
    if (row && JSON.parse(row.json).action === "conversation.create")
      throw new Error("请先恢复会话创建，避免后续消息失去所属对话");
    await db.runAsync("DELETE FROM outbox WHERE id=?", id);
    await reload();
    void sync();
  };
  const retry = async (id: string) => {
    await db.runAsync("UPDATE outbox SET error=NULL WHERE id=?", id);
    await reload();
    void sync();
  };
  const audit = (event: string, target?: string) => {
    if (ready)
      void submit("audit", { event, target }).catch((e) => setError(String(e)));
  };
  return (
    <Context.Provider
      value={{
        ready,
        entities,
        pending,
        error,
        syncing,
        connection,
        reminders,
        configure,
        loadModels,
        saveDefaultModel,
        saveConversationModel,
        sync,
        submit,
        discard,
        retry,
        audit,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useStore = () => useContext(Context);
export function useEntities<T extends EntityType>(type: T): Entity<T>[] {
  return useStore().entities.filter(
    (e) => e.type === type && !e.deleted,
  ) as Entity<T>[];
}
