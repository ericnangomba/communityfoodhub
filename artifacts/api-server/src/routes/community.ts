import { Router, type IRouter } from "express";
import {
  CalculatePricingBody,
  CreateOrderBody,
  GetDashboardResponse,
  GetPricingResponse,
  ListCatalogResponse,
  ListDeliveriesResponse,
  ListHubsResponse,
  ListOrdersQueryParams,
  ListOrdersResponse,
  ListZonesResponse,
  ParseWhatsAppOrderBody,
  ParseWhatsAppOrderResponse,
  UpdateDeliveryStatusBody,
  UpdateOrderStatusBody,
} from "@workspace/api-zod";

type CatalogItem = {
  id: number;
  name: string;
  category: string;
  packageSize: string;
  communityPrice: number;
  retailPrice: number;
  savingsPercent: number;
  stockQuantity: number;
  imageKey: string;
  popular?: boolean;
};

type OrderLine = {
  itemName: string;
  packageSize: string;
  quantity: number;
  unitPrice: number;
};

type Order = {
  id: number;
  reference: string;
  clientName: string;
  clientPhone: string;
  hubName: string;
  address: string;
  orderSource: string;
  status: string;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
  lines: OrderLine[];
};

type Delivery = {
  id: number;
  orderReference: string;
  agentName: string;
  agentInitials: string;
  pickup: string;
  dropoff: string;
  status: string;
  eta: string;
};

const hubs = [
  { id: 1, name: "Elsies River Hub", region: "Northern Suburbs", status: "ACTIVE", activeOrders: 12, stockHealth: 87, agentCount: 8 },
  { id: 2, name: "Southern Suburbs Hub", region: "Southern Suburbs", status: "ACTIVE", activeOrders: 8, stockHealth: 93, agentCount: 6 },
  { id: 3, name: "Khayelitsha Hub", region: "Cape Flats", status: "ONBOARDING", activeOrders: 0, stockHealth: 0, agentCount: 0 },
];

const zones = [
  { id: 1, name: "Elsies River Ward 28", municipality: "City of Cape Town", hubName: "Elsies River Hub", households: 1240, status: "LIVE" },
  { id: 2, name: "Elsies River Ward 29", municipality: "City of Cape Town", hubName: "Elsies River Hub", households: 980, status: "LIVE" },
  { id: 3, name: "Goodwood Ward 55", municipality: "City of Cape Town", hubName: "Elsies River Hub", households: 760, status: "READY" },
  { id: 4, name: "Athlone Ward 49", municipality: "City of Cape Town", hubName: "Southern Suburbs Hub", households: 1420, status: "READY" },
  { id: 5, name: "Khayelitsha Ward 91", municipality: "City of Cape Town", hubName: "Khayelitsha Hub", households: 1840, status: "ONBOARDING" },
  { id: 6, name: "Mfuleni Ward 109", municipality: "City of Cape Town", hubName: "Khayelitsha Hub", households: 1120, status: "ONBOARDING" },
];

let globalOffsetPercent = 8;
let nextOrderId = 106;

const catalog: CatalogItem[] = [
  { id: 1, name: "Long Grain Rice", category: "Staples", packageSize: "1kg", communityPrice: 21.99, retailPrice: 25.99, savingsPercent: 15, stockQuantity: 138, imageKey: "rice", popular: true },
  { id: 2, name: "Maize Meal", category: "Staples", packageSize: "2.5kg", communityPrice: 38.5, retailPrice: 44.99, savingsPercent: 14, stockQuantity: 86, imageKey: "maize", popular: true },
  { id: 3, name: "Cooking Oil", category: "Kitchen", packageSize: "750ml", communityPrice: 29.99, retailPrice: 36.99, savingsPercent: 19, stockQuantity: 64, imageKey: "oil" },
  { id: 4, name: "Sugar", category: "Staples", packageSize: "1kg", communityPrice: 18.5, retailPrice: 22.99, savingsPercent: 20, stockQuantity: 42, imageKey: "sugar" },
  { id: 5, name: "Brown Bread", category: "Fresh", packageSize: "700g", communityPrice: 15.99, retailPrice: 19.99, savingsPercent: 20, stockQuantity: 28, imageKey: "bread", popular: true },
  { id: 6, name: "Baked Beans", category: "Pantry", packageSize: "410g", communityPrice: 13.5, retailPrice: 16.99, savingsPercent: 21, stockQuantity: 112, imageKey: "beans" },
  { id: 7, name: "Washing Powder", category: "Home", packageSize: "500g", communityPrice: 24.99, retailPrice: 31.99, savingsPercent: 22, stockQuantity: 19, imageKey: "washing" },
  { id: 8, name: "Tea Bags", category: "Kitchen", packageSize: "100 pack", communityPrice: 32.5, retailPrice: 39.99, savingsPercent: 19, stockQuantity: 51, imageKey: "tea" },
];

const orders: Order[] = [
  {
    id: 101,
    reference: "CWH-0101",
    clientName: "Noluthando M.",
    clientPhone: "072 555 0142",
    hubName: "Elsies River Hub",
    address: "Elsies River Block B, 14 3rd Avenue",
    orderSource: "WEB_APP",
    status: "WAREHOUSE_PACKING",
    totalAmount: 96.47,
    itemCount: 4,
    createdAt: "2026-09-18T08:14:00.000Z",
    lines: [
      { itemName: "Long Grain Rice", packageSize: "1kg", quantity: 2, unitPrice: 21.99 },
      { itemName: "Baked Beans", packageSize: "410g", quantity: 2, unitPrice: 13.5 },
    ],
  },
  {
    id: 102,
    reference: "CWH-0102",
    clientName: "Thabiso J.",
    clientPhone: "078 222 9341",
    hubName: "Elsies River Hub",
    address: "Elsies River Zone 4, 8 Halt Road",
    orderSource: "WHATSAPP",
    status: "PENDING",
    totalAmount: 60.49,
    itemCount: 2,
    createdAt: "2026-09-18T08:46:00.000Z",
    lines: [
      { itemName: "Maize Meal", packageSize: "2.5kg", quantity: 1, unitPrice: 38.5 },
      { itemName: "Cooking Oil", packageSize: "750ml", quantity: 1, unitPrice: 29.99 },
    ],
  },
  {
    id: 103,
    reference: "CWH-0103",
    clientName: "Ayesha K.",
    clientPhone: "076 841 0208",
    hubName: "Southern Suburbs Hub",
    address: "Athlone, 22 Belgravia Road",
    orderSource: "WEB_APP",
    status: "DISPATCHED",
    totalAmount: 88.48,
    itemCount: 4,
    createdAt: "2026-09-18T07:32:00.000Z",
    lines: [
      { itemName: "Long Grain Rice", packageSize: "1kg", quantity: 2, unitPrice: 21.99 },
      { itemName: "Sugar", packageSize: "1kg", quantity: 2, unitPrice: 18.5 },
    ],
  },
  {
    id: 104,
    reference: "CWH-0104",
    clientName: "Lwazi S.",
    clientPhone: "071 443 1670",
    hubName: "Elsies River Hub",
    address: "Elsies River Block C, 10 Viking Way",
    orderSource: "WEB_APP",
    status: "DELIVERED",
    totalAmount: 55.48,
    itemCount: 3,
    createdAt: "2026-09-17T15:12:00.000Z",
    lines: [
      { itemName: "Brown Bread", packageSize: "700g", quantity: 1, unitPrice: 15.99 },
      { itemName: "Baked Beans", packageSize: "410g", quantity: 2, unitPrice: 13.5 },
    ],
  },
];

const deliveries: Delivery[] = [
  { id: 1, orderReference: "CWH-0103", agentName: "Siyabonga N.", agentInitials: "SN", pickup: "Southern Suburbs Warehouse", dropoff: "Athlone, 22 Belgravia Road", status: "OUT_FOR_DELIVERY", eta: "12 min" },
  { id: 2, orderReference: "CWH-0098", agentName: "Zanele P.", agentInitials: "ZP", pickup: "Elsies River Warehouse", dropoff: "Elsies River Block A, 4 Avon Road", status: "READY_FOR_PICKUP", eta: "25 min" },
  { id: 3, orderReference: "CWH-0096", agentName: "Mandla T.", agentInitials: "MT", pickup: "Elsies River Warehouse", dropoff: "Goodwood, 16 Milton Street", status: "OUT_FOR_DELIVERY", eta: "38 min" },
];

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function refreshCatalogPricing() {
  for (const item of catalog) {
    item.communityPrice = roundMoney(item.retailPrice * (1 - globalOffsetPercent / 100));
    item.savingsPercent = Math.round((1 - item.communityPrice / item.retailPrice) * 100);
  }
}

function pricingSummary() {
  const projectedCommunitySavings = catalog.reduce(
    (total, item) => total + item.retailPrice * 30 * (globalOffsetPercent / 100),
    0,
  );
  return {
    lastCalculatedAt: new Date().toISOString(),
    globalOffsetPercent,
    totalItems: catalog.length,
    projectedCommunitySavings: roundMoney(projectedCommunitySavings),
    status: "PUBLISHED",
  };
}

function totalForLines(lines: OrderLine[]) {
  return roundMoney(lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0));
}

function createOrder(input: {
  clientName: string;
  clientPhone: string;
  hubId: number;
  address: string;
  orderSource: string;
  lines: OrderLine[];
}) {
  const hub = hubs.find((candidate) => candidate.id === input.hubId) ?? hubs[0];
  const order: Order = {
    id: nextOrderId,
    reference: `CWH-0${nextOrderId}`,
    clientName: input.clientName,
    clientPhone: input.clientPhone,
    hubName: hub.name,
    address: input.address,
    orderSource: input.orderSource,
    status: "PENDING",
    totalAmount: totalForLines(input.lines),
    itemCount: input.lines.reduce((count, line) => count + line.quantity, 0),
    createdAt: new Date().toISOString(),
    lines: input.lines,
  };
  nextOrderId += 1;
  orders.unshift(order);
  hub.activeOrders += 1;
  return order;
}

function findCatalogItem(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("maize") || normalized.includes("mealie")) return catalog[1];
  if (normalized.includes("oil")) return catalog[2];
  if (normalized.includes("sugar")) return catalog[3];
  if (normalized.includes("bread")) return catalog[4];
  if (normalized.includes("beans")) return catalog[5];
  return catalog[0];
}

const router: IRouter = Router();

router.get("/catalog", (_req, res) => {
  res.json(ListCatalogResponse.parse(catalog));
});

router.get("/pricing", (_req, res) => {
  res.json(GetPricingResponse.parse(pricingSummary()));
});

router.post("/pricing", (req, res) => {
  const input = CalculatePricingBody.parse(req.body);
  globalOffsetPercent = input.offsetPercent;
  refreshCatalogPricing();
  res.json(GetPricingResponse.parse(pricingSummary()));
});

router.get("/hubs", (_req, res) => {
  res.json(ListHubsResponse.parse(hubs));
});

router.get("/zones", (_req, res) => {
  res.json(ListZonesResponse.parse(zones));
});

router.get("/orders", (req, res) => {
  const query = ListOrdersQueryParams.parse(req.query);
  const filtered = query.status ? orders.filter((order) => order.status === query.status) : orders;
  res.json(ListOrdersResponse.parse(filtered));
});

router.post("/orders", (req, res) => {
  const input = CreateOrderBody.parse(req.body);
  const order = createOrder(input);
  req.log.info({ orderId: order.id, source: order.orderSource }, "Community order created");
  res.status(201).json(order);
});

router.patch("/orders/:orderId/status", (req, res) => {
  const orderId = Number(req.params.orderId);
  const input = UpdateOrderStatusBody.parse(req.body);
  const order = orders.find((candidate) => candidate.id === orderId);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  order.status = input.status;
  if (input.status === "DELIVERED") {
    const hub = hubs.find((candidate) => candidate.name === order.hubName);
    if (hub) hub.activeOrders = Math.max(0, hub.activeOrders - 1);
  }
  req.log.info({ orderId, status: input.status }, "Order status updated");
  res.json(order);
});

router.post("/whatsapp/orders", (req, res) => {
  const input = ParseWhatsAppOrderBody.parse(req.body);
  const item = findCatalogItem(input.message);
  const quantityMatch = input.message.match(/(\d+)\s*x/i);
  const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
  const addressMatch = input.message.match(/\bto\s+(.+)$/i);
  const address = addressMatch?.[1]?.trim() || "Elsies River Hub collection point";
  const order = createOrder({
    clientName: input.clientName,
    clientPhone: input.clientPhone,
    hubId: 1,
    address,
    orderSource: "WHATSAPP",
    lines: [{ itemName: item.name, packageSize: item.packageSize, quantity, unitPrice: item.communityPrice }],
  });
  req.log.info({ orderId: order.id }, "WhatsApp order parsed");
  res.status(201).json(ParseWhatsAppOrderResponse.parse({
    order,
    parsedMessage: `${quantity} × ${item.name} ${item.packageSize} → ${address}`,
    confidence: quantityMatch && addressMatch ? 0.98 : 0.82,
  }));
});

router.get("/deliveries", (_req, res) => {
  res.json(ListDeliveriesResponse.parse(deliveries));
});

router.patch("/deliveries/:deliveryId/status", (req, res) => {
  const deliveryId = Number(req.params.deliveryId);
  const input = UpdateDeliveryStatusBody.parse(req.body);
  const delivery = deliveries.find((candidate) => candidate.id === deliveryId);
  if (!delivery) {
    res.status(404).json({ error: "Delivery not found" });
    return;
  }
  delivery.status = input.status;
  if (input.status === "DELIVERED") {
    const order = orders.find((candidate) => candidate.reference === delivery.orderReference);
    if (order) order.status = "DELIVERED";
  }
  res.json(delivery);
});

router.get("/dashboard", (_req, res) => {
  const dashboard = {
    totalOrders: 1284 + orders.length,
    activeHubs: hubs.filter((hub) => hub.status === "ACTIVE").length,
    localSavings: 18420.6,
    retainedCurrency: 68420.6,
    corporateLeakage: 12884.4,
    serviceReinvestment: 9420,
    orderTrend: [
      { label: "Mon", orders: 142, retained: 7240 },
      { label: "Tue", orders: 168, retained: 8810 },
      { label: "Wed", orders: 154, retained: 8030 },
      { label: "Thu", orders: 187, retained: 9680 },
      { label: "Fri", orders: 206, retained: 10820 },
      { label: "Sat", orders: 238, retained: 12340 },
      { label: "Sun", orders: 189, retained: 10050 },
    ],
    demandForecast: [
      { item: "Long Grain Rice", daysRemaining: 4, confidence: 92, trend: "UP" },
      { item: "Cooking Oil", daysRemaining: 6, confidence: 86, trend: "UP" },
      { item: "Brown Bread", daysRemaining: 2, confidence: 97, trend: "URGENT" },
      { item: "Maize Meal", daysRemaining: 9, confidence: 81, trend: "STABLE" },
    ],
    recentActivity: [
      { id: 1, title: "Order wave detected", detail: "Rice demand is 18% higher in Elsies River this morning.", timestamp: "8 min ago", tone: "positive" },
      { id: 2, title: "Replenishment recommended", detail: "Brown Bread is below its 3-day safety threshold.", timestamp: "21 min ago", tone: "warning" },
      { id: 3, title: "Local milestone reached", detail: "R68,420 retained in the community this month.", timestamp: "1 hr ago", tone: "positive" },
    ],
  };
  res.json(GetDashboardResponse.parse(dashboard));
});

export default router;