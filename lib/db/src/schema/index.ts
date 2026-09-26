import { relations } from "drizzle-orm";
import {
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hubsTable = pgTable("hubs", {
  id: serial("id").primaryKey(),
  hubName: text("hub_name").notNull(),
  region: text("region").notNull(),
  status: text("status").notNull().default("ACTIVE"),
});

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
  fullName: text("full_name"),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phoneNumber: text("phone_number"),
  role: text("role").notNull().default("CLIENT"),
  hubId: integer("hub_id").references(() => hubsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const authSessionsTable = pgTable("auth_sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const warehousesTable = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  hubId: integer("hub_id")
    .notNull()
    .references(() => hubsTable.id),
  warehouseName: text("warehouse_name").notNull(),
  address: text("address").notNull(),
});

export const inventoryTable = pgTable("inventory", {
  id: serial("id").primaryKey(),
  warehouseId: integer("warehouse_id")
    .notNull()
    .references(() => warehousesTable.id),
  itemName: text("item_name").notNull(),
  packageSize: text("package_size").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  stockQuantity: integer("stock_quantity").notNull(),
  reorderThreshold: integer("reorder_threshold").notNull(),
});

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => usersTable.id),
  hubId: integer("hub_id")
    .notNull()
    .references(() => hubsTable.id),
  agentId: integer("agent_id").references(() => usersTable.id),
  orderSource: text("order_source").notNull(),
  status: text("status").notNull().default("PENDING"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const analyticsLogsTable = pgTable("analytics_logs", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  metricValue: numeric("metric_value", { precision: 12, scale: 2 }).notNull(),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const hubsRelations = relations(hubsTable, ({ many }) => ({
  users: many(usersTable),
  warehouses: many(warehousesTable),
  orders: many(ordersTable),
}));

export const usersRelations = relations(usersTable, ({ many, one }) => ({
  hub: one(hubsTable, { fields: [usersTable.hubId], references: [hubsTable.id] }),
  sessions: many(authSessionsTable),
}));

export const authSessionsRelations = relations(authSessionsTable, ({ one }) => ({
  user: one(usersTable, { fields: [authSessionsTable.userId], references: [usersTable.id] }),
}));

export const insertHubSchema = createInsertSchema(hubsTable).omit({ id: true });
export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true });
export const insertWarehouseSchema = createInsertSchema(warehousesTable).omit({ id: true });
export const insertInventorySchema = createInsertSchema(inventoryTable).omit({ id: true });
export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export const insertAnalyticsLogSchema = createInsertSchema(analyticsLogsTable).omit({ id: true, createdAt: true });

export type Hub = z.infer<typeof insertHubSchema>;
export type User = z.infer<typeof insertUserSchema>;
export type Warehouse = z.infer<typeof insertWarehouseSchema>;
export type InventoryItem = z.infer<typeof insertInventorySchema>;
export type Order = z.infer<typeof insertOrderSchema>;
export type AnalyticsLog = z.infer<typeof insertAnalyticsLogSchema>;