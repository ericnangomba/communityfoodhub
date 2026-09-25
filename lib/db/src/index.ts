import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const fallbackDb = {
  select() {
    return {
      from() {
        return {
          where() {
            return {
              limit: async () => [],
              innerJoin() {
                return {
                  where() {
                    return { limit: async () => [] };
                  },
                };
              },
            };
          },
        };
      },
    };
  },
  insert() {
    return {
      values(record: Record<string, unknown>) {
        return {
          returning: async () => [record],
        };
      },
    };
  },
  update() {
    return {
      set(record: Record<string, unknown>) {
        return {
          where() {
            return {
              returning: async () => [record],
            };
          },
        };
      },
    };
  },
  delete() {
    return {
      where: async () => undefined,
    };
  },
};

export const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
export const db = pool ? drizzle(pool, { schema }) : (fallbackDb as any);

export async function ensureDatabaseSchema() {
  if (!pool) return;

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS hubs (
        id SERIAL PRIMARY KEY,
        hub_name TEXT NOT NULL,
        region TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE'
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name TEXT NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'CLIENT',
        hub_id INTEGER REFERENCES hubs(id)
      );

      CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS warehouses (
        id SERIAL PRIMARY KEY,
        hub_id INTEGER NOT NULL REFERENCES hubs(id),
        warehouse_name TEXT NOT NULL,
        address TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY,
        warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
        item_name TEXT NOT NULL,
        package_size TEXT NOT NULL,
        unit_price NUMERIC(10, 2) NOT NULL,
        stock_quantity INTEGER NOT NULL,
        reorder_threshold INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES users(id),
        hub_id INTEGER NOT NULL REFERENCES hubs(id),
        agent_id INTEGER REFERENCES users(id),
        order_source TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        total_amount NUMERIC(10, 2) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS analytics_logs (
        id SERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        metric_value NUMERIC(12, 2) NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const requiredColumns: Record<string, [string, string][]> = {
      hubs: [
        ["hub_name", "TEXT"],
        ["region", "TEXT"],
        ["status", "TEXT DEFAULT 'ACTIVE'"],
      ],
      users: [
        ["full_name", "TEXT"],
        ["email", "VARCHAR(255)"],
        ["password_hash", "TEXT"],
        ["phone_number", "TEXT"],
        ["role", "TEXT DEFAULT 'CLIENT'"],
        ["hub_id", "INTEGER"],
      ],
      auth_sessions: [
        ["id", "TEXT"],
        ["user_id", "INTEGER"],
        ["expires_at", "TIMESTAMPTZ"],
        ["created_at", "TIMESTAMPTZ DEFAULT NOW()"],
      ],
      warehouses: [
        ["hub_id", "INTEGER"],
        ["warehouse_name", "TEXT"],
        ["address", "TEXT"],
      ],
      inventory: [
        ["warehouse_id", "INTEGER"],
        ["item_name", "TEXT"],
        ["package_size", "TEXT"],
        ["unit_price", "NUMERIC(10, 2)"],
        ["stock_quantity", "INTEGER"],
        ["reorder_threshold", "INTEGER"],
      ],
      orders: [
        ["client_id", "INTEGER"],
        ["hub_id", "INTEGER"],
        ["agent_id", "INTEGER"],
        ["order_source", "TEXT"],
        ["status", "TEXT DEFAULT 'PENDING'"],
        ["total_amount", "NUMERIC(10, 2)"],
        ["created_at", "TIMESTAMPTZ DEFAULT NOW()"],
      ],
      analytics_logs: [
        ["event_type", "TEXT"],
        ["metric_value", "NUMERIC(12, 2)"],
        ["metadata", "TEXT DEFAULT '{}'"],
        ["created_at", "TIMESTAMPTZ DEFAULT NOW()"],
      ],
    };

    const tableNames = Object.keys(requiredColumns);
    const { rows } = await client.query(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [tableNames],
    );
    const existingColumns = new Set(rows.map((row) => `${row.table_name}:${row.column_name}`));

    for (const [tableName, columns] of Object.entries(requiredColumns)) {
      for (const [columnName] of columns) {
        const key = `${tableName}:${columnName}`;
        if (existingColumns.has(key)) continue;
        const columnSql = columns.find(([name]) => name === columnName)?.[1] ?? "TEXT";
        await client.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnSql};`);
      }
    }
  } finally {
    client.release();
  }
}

export * from "./schema";
