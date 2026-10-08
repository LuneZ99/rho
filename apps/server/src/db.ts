import pg from "pg";
import type { Entity, EntityType, DataMap } from "@rho/shared";
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 8,
});
export async function migrate() {
  await transaction(async (s) => {
    await s.client.query(`
    CREATE TABLE IF NOT EXISTS entities (
      id uuid PRIMARY KEY, type text NOT NULL, version integer NOT NULL,
      seq bigint NOT NULL, deleted boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT now(), data jsonb NOT NULL
    );
    CREATE SEQUENCE IF NOT EXISTS change_seq;
    CREATE INDEX IF NOT EXISTS entities_seq ON entities(seq);
    CREATE INDEX IF NOT EXISTS entities_type ON entities(type) WHERE NOT deleted;
    CREATE TABLE IF NOT EXISTS preferences (key text PRIMARY KEY, value jsonb NOT NULL, version integer NOT NULL);
    CREATE TABLE IF NOT EXISTS operations (id text PRIMARY KEY, request jsonb NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS audit (id bigserial PRIMARY KEY, actor text NOT NULL, action text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
  `);
    for (const c of await s.list("conversation"))
      if (!c.data.modelId)
        await s.put(
          c.id,
          "conversation",
          { ...c.data, modelId: process.env.LITELLM_MODEL ?? "prod-max-1m" },
          c.version,
        );
  });
}
export function entity(row: pg.QueryResultRow): Entity {
  return {
    id: row.id,
    type: row.type,
    version: row.version,
    seq: Number(row.seq),
    deleted: row.deleted,
    updatedAt: new Date(row.updated_at).toISOString(),
    data: row.data,
  };
}
export class DomainError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export class Store {
  constructor(public client: pg.PoolClient) {}
  async get<T extends EntityType>(id: string, type: T): Promise<Entity<T>> {
    const r = await this.client.query(
      "SELECT * FROM entities WHERE id=$1 AND type=$2 AND NOT deleted",
      [id, type],
    );
    if (!r.rows[0])
      throw new DomainError(404, "内容已删除或不存在，请刷新后重试");
    return entity(r.rows[0]) as Entity<T>;
  }
  async list<T extends EntityType>(type: T): Promise<Entity<T>[]> {
    const r = await this.client.query(
      "SELECT * FROM entities WHERE type=$1 AND NOT deleted ORDER BY updated_at",
      [type],
    );
    return r.rows.map(entity) as Entity<T>[];
  }
  async put<T extends EntityType>(
    id: string,
    type: T,
    data: DataMap[T],
    version = 0,
    deleted = false,
  ): Promise<Entity<T>> {
    const old = await this.client.query(
      "SELECT version,type FROM entities WHERE id=$1",
      [id],
    );
    if (
      old.rows[0] &&
      (old.rows[0].version !== version || old.rows[0].type !== type)
    )
      throw new DomainError(409, "内容已在其他对话中更新，请刷新后重新操作");
    if (!old.rows[0] && version !== 0)
      throw new DomainError(409, "记录版本不匹配");
    const r = await this.client.query(
      `INSERT INTO entities (id,type,version,seq,data,deleted) VALUES ($1,$2,$3,nextval('change_seq'),$4,$5)
      ON CONFLICT(id) DO UPDATE SET version=excluded.version,seq=excluded.seq,data=excluded.data,deleted=excluded.deleted,updated_at=now() RETURNING *`,
      [id, type, version + 1, JSON.stringify(data), deleted],
    );
    return entity(r.rows[0]) as Entity<T>;
  }
}
// 全局事务锁保证增量游标的提交顺序；demo 为单用户，避免漏同步未提交的较小序号。
export async function transaction<T>(
  fn: (store: Store) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(18870)");
    const result = await fn(new Store(client));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
