import { migrate, pool } from "./db.js";
import { createApp } from "./api.js";
await migrate();
const app = createApp(process.env.RHO_ACCESS_TOKEN ?? "");
await app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? 18870) });
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  });
