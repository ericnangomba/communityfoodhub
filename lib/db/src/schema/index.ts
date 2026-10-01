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
  warehouseId: integer("warehouse_id").references(() => warehousesTable.id),
  orderSource: text("order_source").notNull(),
  status: text("status").notNull().default("PENDING"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  items: text("items").notNull().default("[]"),
  clientAddress: text("client_address"),
  clientPhone: text("client_phone"),
  hubConfirmedAt: timestamp("hub_confirmed_at", { withTimezone: true }),
  warehouseNotifiedAt: timestamp("warehouse_notified_at", { withTimezone: true }),
  warehousePickedAt: timestamp("warehouse_picked_at", { withTimezone: true }),
  agentNotifiedAt: timestamp("agent_notified_at", { withTimezone: true }),
  agentPickedAt: timestamp("agent_picked_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const analyticsLogsTable = pgTable("analytics_logs", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  metricValue: numeric("metric_value", { precision: 12, scale: 2 }).notNull(),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  orderId: integer("order_id").references(() => ordersTable.id),
  read: text("read").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const deliveryTrackingTable = pgTable("delivery_tracking", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  agentId: integer("agent_id").notNull().references(() => usersTable.id),
  latitude: numeric("latitude", { precision: 10, scale: 6 }),
  longitude: numeric("longitude", { precision: 10, scale: 6 }),
  status: text("status").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
});

export const hubsRelations = relations(hubsTable, ({ many }) => ({
  users: many(usersTable),
  warehouses: many(warehousesTable),
  orders: many(ordersTable),
}));

export const usersRelations = relations(usersTable, ({ many, one }) => ({
  hub: one(hubsTable, { fields: [usersTable.hubId], references: [hubsTable.id] }),
  sessions: many(authSessionsTable),
  notifications: many(notificationsTable),
}));

export const authSessionsRelations = relations(authSessionsTable, ({ one }) => ({
  user: one(usersTable, { fields: [authSessionsTable.userId], references: [usersTable.id] }),
}));

export const ordersRelations = relations(ordersTable, ({ one, many }) => ({
  client: one(usersTable, { fields: [ordersTable.clientId], references: [usersTable.id] }),
  hub: one(hubsTable, { fields: [ordersTable.hubId], references: [hubsTable.id] }),
  agent: one(usersTable, { fields: [ordersTable.agentId], references: [usersTable.id] }),
  warehouse: one(warehousesTable, { fields: [ordersTable.warehouseId], references: [warehousesTable.id] }),
  notifications: many(notificationsTable),
  tracking: many(deliveryTrackingTable),
}));

export const notificationsRelations = relations(notificationsTable, ({ one }) => ({
  user: one(usersTable, { fields: [notificationsTable.userId], references: [usersTable.id] }),
  order: one(ordersTable, { fields: [notificationsTable.orderId], references: [ordersTable.id] }),
}));

export const deliveryTrackingRelations = relations(deliveryTrackingTable, ({ one }) => ({
  order: one(ordersTable, { fields: [deliveryTrackingTable.orderId], references: [ordersTable.id] }),
  agent: one(usersTable, { fields: [deliveryTrackingTable.agentId], references: [usersTable.id] }),
}));

export const insertHubSchema = createInsertSchema(hubsTable).omit({ id: true });
export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true });
export const insertWarehouseSchema = createInsertSchema(warehousesTable).omit({ id: true });
export const insertInventorySchema = createInsertSchema(inventoryTable).omit({ id: true });
export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export const insertAnalyticsLogSchema = createInsertSchema(analyticsLogsTable).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export const insertDeliveryTrackingSchema = createInsertSchema(deliveryTrackingTable).omit({ id: true, timestamp: true });

export type Hub = z.infer<typeof insertHubSchema>;
export type User = z.infer<typeof insertUserSchema>;
export type Warehouse = z.infer<typeof insertWarehouseSchema>;
export type InventoryItem = z.infer<typeof insertInventorySchema>;
export type Order = z.infer<typeof insertOrderSchema>;
export type AnalyticsLog = z.infer<typeof insertAnalyticsLogSchema>;
export type Notification = z.infer<typeof insertNotificationSchema>;
export type DeliveryTracking = z.infer<typeof insertDeliveryTrackingSchema>;