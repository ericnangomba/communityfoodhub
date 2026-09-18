import { type ReactNode, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Bike,
  Boxes,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  CreditCard,
  Database,
  ExternalLink,
  LayoutDashboard,
  Leaf,
  LineChart,
  MapPin,
  Menu,
  MessageCircle,
  Minus,
  Package,
  PanelLeft,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShoppingBasket,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Store,
  Truck,
  Users,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';
import {
  getGetDashboardQueryKey,
  getGetPricingQueryKey,
  getHealthCheckQueryKey,
  getListCatalogQueryKey,
  getListDeliveriesQueryKey,
  getListHubsQueryKey,
  getListOrdersQueryKey,
  getListZonesQueryKey,
  useCalculatePricing,
  useCreateOrder,
  useGetDashboard,
  useGetPricing,
  useHealthCheck,
  useListCatalog,
  useListDeliveries,
  useListHubs,
  useListOrders,
  useListZones,
  useParseWhatsAppOrder,
  useUpdateDeliveryStatus,
  useUpdateOrderStatus,
} from '@workspace/api-client-react';
import type {
  CatalogItem,
  DashboardSummary,
  Delivery,
  Hub,
  Order,
  WardZone,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import './index.css';

const queryClient = new QueryClient();

type Role = 'client' | 'hub' | 'agent' | 'super';
const roles: { id: Role; label: string; detail: string; icon: typeof ShoppingBasket; href: string }[] = [
  { id: 'client', label: 'Community Client', detail: 'Shop household staples', icon: ShoppingBasket, href: '/shop' },
  { id: 'hub', label: 'Hub Admin', detail: 'Run the order queue', icon: Store, href: '/orders' },
  { id: 'agent', label: 'Delivery Agent', detail: 'Move orders home', icon: Bike, href: '/deliveries' },
  { id: 'super', label: 'Super Admin', detail: 'See the full network', icon: LayoutDashboard, href: '/command' },
];

const navGroups = [
  { label: 'Workspaces', items: [
    { href: '/shop', label: 'Shop', icon: ShoppingBasket, role: 'client' as Role },
    { href: '/orders', label: 'Order queue', icon: Package, role: 'hub' as Role },
    { href: '/deliveries', label: 'Deliveries', icon: Bike, role: 'agent' as Role },
    { href: '/command', label: 'Command centre', icon: LayoutDashboard, role: 'super' as Role },
  ] },
  { label: 'Network', items: [
    { href: '/pricing', label: 'Pricing controls', icon: SlidersHorizontal, role: 'super' as Role },
    { href: '/zones', label: 'Ward coverage', icon: MapPin, role: 'super' as Role },
  ] },
];

function money(value: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function statusTone(status: string) {
  const value = status.toLowerCase();
  if (value.includes('deliver') || value.includes('complete') || value.includes('active') || value.includes('healthy') || value.includes('ready')) return 'green';
  if (value.includes('cancel') || value.includes('issue') || value.includes('low')) return 'red';
  if (value.includes('pack') || value.includes('transit') || value.includes('pending') || value.includes('review')) return 'amber';
  return 'blue';
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

function Panel({ children, className = '', ...props }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return <section className={`panel ${className}`} {...props}>{children}</section>;
}

function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill ${statusTone(status)}`} data-testid={`status-${status.toLowerCase().replaceAll(' ', '-')}`}>
    <span className="status-dot" />{status}
  </span>;
}

function Metric({ label, value, note, icon: Icon, accent = 'sun' }: { label: string; value: string; note?: string; icon: typeof Activity; accent?: string }) {
  return <div className={`metric-card accent-${accent}`} data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>
    <div className="metric-top"><span>{label}</span><Icon size={16} /></div>
    <strong>{value}</strong>
    {note && <small>{note}</small>}
  </div>;
}

function LoadingBlocks({ count = 3 }: { count?: number }) {
  return <div className="space-y-3" data-testid="loading-state">{Array.from({ length: count }).map((_, index) => <div className="skeleton" key={index} />)}</div>;
}

function QueryState({ loading, error, empty, children, onRetry }: { loading: boolean; error: boolean; empty?: boolean; children: ReactNode; onRetry?: () => void }) {
  if (loading) return <LoadingBlocks />;
  if (error) return <div className="empty-state" data-testid="error-state"><CircleAlert size={26} /><strong>Something needs a second look.</strong><span>The hub could not reach this view right now.</span><button className="button button-secondary" onClick={onRetry} data-testid="button-retry"><RefreshCw size={15} /> Try again</button></div>;
  if (empty) return <div className="empty-state" data-testid="empty-state"><Boxes size={26} /><strong>Nothing here yet</strong><span>New activity will appear as the network moves.</span></div>;
  return children;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className={`brand ${compact ? 'compact' : ''}`} data-testid="link-brand">
    <span className="brand-mark"><Leaf size={18} strokeWidth={2.5} /></span>
    <span><b>Community</b><em>Wealth Hub</em></span>
  </Link>;
}

function AppShell({ children, role = 'super', title, eyebrow }: { children: ReactNode; role?: Role; title?: string; eyebrow?: string }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const currentRole = roles.find((item) => item.id === role) ?? roles[3];
  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="sidebar-head"><Brand compact /><button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)} data-testid="button-close-menu"><X size={18} /></button></div>
      <div className="network-badge"><span className="live-pulse" /> Elsies River network <ChevronDown size={14} /></div>
      <nav className="sidebar-nav">
        {navGroups.map((group) => <div className="nav-group" key={group.label}>
          <p>{group.label}</p>
          {group.items.map((item) => <Link key={item.href} href={item.href} className={`nav-link ${location === item.href ? 'active' : ''}`} onClick={() => setMobileOpen(false)} data-testid={`link-${item.label.toLowerCase().replaceAll(' ', '-')}`}>
            <item.icon size={17} /><span>{item.label}</span>{location === item.href && <span className="nav-active-mark" />}
          </Link>)}
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="side-note"><Sparkles size={15} /><div><b>Local first</b><span>Every order keeps value moving nearby.</span></div></div>
        <div className="profile-chip"><span className="avatar">{initials(currentRole.label)}</span><div><b>{currentRole.label}</b><span>Elsies River · Western Cape</span></div><Settings2 size={15} /></div>
      </div>
    </aside>
    <main className="main-content">
      <header className="topbar">
        <button className="mobile-menu icon-button" onClick={() => setMobileOpen(true)} data-testid="button-open-menu"><Menu size={20} /></button>
        <div className="topbar-copy">{eyebrow && <span>{eyebrow}</span>}<h1>{title}</h1></div>
        <div className="topbar-actions"><span className="connection"><span className="live-pulse" /> Live network</span><button className="icon-button" onClick={() => setNoticeOpen((current) => !current)} data-testid="button-notifications"><Bell size={18} /><i /></button><div className="top-avatar">{initials(currentRole.label)}</div></div>
      </header>
      {noticeOpen && <div className="notice-popover" data-testid="notice-popover"><b>Network is moving well.</b><span>No new alerts for this workspace.</span></div>}
      <div className="page-wrap">{children}</div>
    </main>
  </div>;
}

function Home() {
  const [, setLocation] = useLocation();
  const [role, setRole] = useState<Role>('client');
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), retry: 1 } });
  return <div className="entry-page">
    <div className="entry-noise" />
    <header className="entry-nav"><Brand /><div className="entry-status"><span className="live-pulse" /> Network online {health.isLoading ? '' : health.isError ? '· offline check' : '· Elsies River'}</div></header>
    <div className="entry-grid">
      <section className="entry-copy">
        <div className="eyebrow"><span className="eyebrow-line" /> A neighborhood utility</div>
        <h1>Food that stays <i>in the community.</i></h1>
        <p className="entry-lede">Community Wealth Hub connects Elsies River households, local hubs and delivery teams around one simple promise: better access, with more value kept close to home.</p>
        <div className="entry-stats"><div><strong>04</strong><span>active hubs</span></div><div><strong>1,240</strong><span>households reached</span></div><div><strong>18.6%</strong><span>value retained locally</span></div></div>
      </section>
      <section className="role-card">
        <div className="role-card-head"><span className="tiny-label">Enter your workspace</span><span className="mono">CW / 01</span></div>
        <h2>What are you here to do?</h2>
        <div className="role-list">{roles.map((item) => <button key={item.id} className={`role-option ${role === item.id ? 'selected' : ''}`} onClick={() => setRole(item.id)} data-testid={`button-role-${item.id}`}>
          <span className="role-icon"><item.icon size={19} /></span><span><b>{item.label}</b><small>{item.detail}</small></span><ArrowRight size={17} className="role-arrow" />
        </button>)}</div>
        <button className="button button-primary button-wide" onClick={() => setLocation(roles.find((item) => item.id === role)?.href ?? '/shop')} data-testid="button-enter-workspace">Enter workspace <ArrowRight size={16} /></button>
        <p className="role-foot">No account needed for this preview · role-based views</p>
      </section>
    </div>
    <footer className="entry-footer"><span>Western Cape · South Africa</span><span>Built for local circulation, not extraction.</span><span className="mono">v1.0 / LIVE</span></footer>
  </div>;
}

function ShopPage() {
  const catalog = useListCatalog({ query: { queryKey: getListCatalogQueryKey(), staleTime: 60_000 } });
  const hubs = useListHubs({ query: { queryKey: getListHubsQueryKey(), staleTime: 60_000 } });
  const createOrder = useCreateOrder();
  const parseWhatsApp = useParseWhatsAppOrder();
  const [cart, setCart] = useState<Record<number, number>>({});
  const [category, setCategory] = useState('All');
  const [address, setAddress] = useState('');
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [whatsappText, setWhatsappText] = useState('Hi, please send 2 rice 2kg and 1 cooking oil 750ml to 14 Avon Road, Elsies River.');
  const [confirmation, setConfirmation] = useState<Order | null>(null);
  const items = catalog.data ?? [];
  const categories = ['All', ...Array.from(new Set(items.map((item) => item.category)))];
  const shown = items.filter((item) => category === 'All' || item.category === category);
  const cartItems = items.filter((item) => cart[item.id]);
  const total = cartItems.reduce((sum, item) => sum + item.communityPrice * (cart[item.id] ?? 0), 0);
  const itemCount = cartItems.reduce((sum, item) => sum + (cart[item.id] ?? 0), 0);
  const setQuantity = (id: number, amount: number) => setCart((current) => ({ ...current, [id]: Math.max(0, amount) }));
  const submitOrder = () => {
    const hubId = hubs.data?.[0]?.id;
    if (!hubId || !clientName || !phone || !address || !cartItems.length) return;
    createOrder.mutate({ data: { clientName, clientPhone: phone, hubId, address, orderSource: 'web', lines: cartItems.map((item) => ({ itemName: item.name, packageSize: item.packageSize, quantity: cart[item.id] ?? 0, unitPrice: item.communityPrice })) } }, {
      onSuccess: (order) => { setConfirmation(order); setCart({}); queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }); },
    });
  };
  return <AppShell role="client" eyebrow="Community storefront" title="Good food, fairly priced.">
    <div className="shop-layout">
      <section className="shop-main">
        <div className="shop-hero"><div><span className="eyebrow"><span className="eyebrow-line" /> Elsies River pantry</span><h2>Staples for <i>this week.</i></h2><p>Community pricing is calculated against the retail baseline, so your basket goes further without leaving the neighborhood.</p></div><div className="hero-stamp"><span>LOCAL</span><strong>−18%</strong><small>average saving</small></div></div>
        <div className="shop-toolbar"><div className="category-tabs">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)} data-testid={`button-category-${item.toLowerCase()}`}>{item}</button>)}</div><div className="catalog-count"><span className="live-pulse" /> {items.length} items in stock</div></div>
        <QueryState loading={catalog.isLoading} error={catalog.isError} empty={!items.length} onRetry={() => catalog.refetch()}><div className="product-grid">{shown.map((item) => <ProductCard key={item.id} item={item} quantity={cart[item.id] ?? 0} onQuantity={(amount) => setQuantity(item.id, amount)} />)}</div></QueryState>
        <div className="shop-trust"><BadgeCheck size={20} /><div><b>Community price, checked weekly</b><span>Prices are transparent and the difference is returned through local service reinvestment.</span></div><ArrowRight size={17} /></div>
      </section>
      <aside className="cart-panel">
        <div className="cart-head"><div><span className="tiny-label">Your basket</span><h3>{itemCount ? `${itemCount} item${itemCount === 1 ? '' : 's'}` : 'Start with the essentials'}</h3></div><span className="cart-count">{itemCount}</span></div>
        {cartItems.length ? <div className="cart-lines">{cartItems.map((item) => <div className="cart-line" key={item.id}><span className="cart-thumb">{item.name.slice(0, 1)}</span><div><b>{item.name}</b><small>{item.packageSize} · {money(item.communityPrice)}</small></div><div className="quantity-control"><button onClick={() => setQuantity(item.id, (cart[item.id] ?? 0) - 1)} data-testid={`button-decrease-${item.id}`}><Minus size={13} /></button><span>{cart[item.id]}</span><button onClick={() => setQuantity(item.id, (cart[item.id] ?? 0) + 1)} data-testid={`button-increase-${item.id}`}><Plus size={13} /></button></div></div>)}</div> : <div className="cart-empty"><ShoppingCart size={28} /><span>Your basket is waiting.</span><small>Add a few pantry staples to see your community total.</small></div>}
        <div className="cart-summary"><div><span>Community total</span><strong>{money(total)}</strong></div><div className="saving-line"><span>Your saving today</span><b>{money(cartItems.reduce((sum, item) => sum + (item.retailPrice - item.communityPrice) * (cart[item.id] ?? 0), 0))}</b></div></div>
        <div className="checkout-form"><span className="tiny-label">Delivery details</span><input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Your name" data-testid="input-client-name" /><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Mobile number" data-testid="input-client-phone" /><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street address in Elsies River" data-testid="input-delivery-address" /><button className="button button-primary button-wide" disabled={!cartItems.length || !clientName || !phone || !address || createOrder.isPending} onClick={submitOrder} data-testid="button-place-order">{createOrder.isPending ? 'Sending order…' : 'Place community order'} <ArrowRight size={16} /></button><button className="whatsapp-button" onClick={() => setWhatsappOpen(true)} data-testid="button-open-whatsapp"><MessageCircle size={17} /> Order through WhatsApp</button></div>
        {confirmation && <div className="confirmation"><Check size={16} /><span>Order <b>{confirmation.reference}</b> is with the hub.</span><button onClick={() => setConfirmation(null)} data-testid="button-dismiss-confirmation"><X size={14} /></button></div>}
      </aside>
    </div>
    {whatsappOpen && <div className="modal-backdrop"><div className="modal whatsapp-modal"><div className="modal-head"><div><span className="tiny-label">WhatsApp simulator</span><h3>Send a pantry message</h3></div><button className="icon-button" onClick={() => setWhatsappOpen(false)} data-testid="button-close-whatsapp"><X size={18} /></button></div><div className="wa-preview"><div className="wa-bubble">Hi there. Tell us what you need and we’ll turn it into a clear order for the hub.</div><div className="wa-bubble outgoing">{whatsappText}</div></div><textarea value={whatsappText} onChange={(event) => setWhatsappText(event.target.value)} data-testid="input-whatsapp-message" /><input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Client name" data-testid="input-whatsapp-name" /><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Mobile number" data-testid="input-whatsapp-phone" /><button className="button button-primary button-wide" disabled={!clientName || !phone || parseWhatsApp.isPending} onClick={() => parseWhatsApp.mutate({ data: { message: whatsappText, clientName, clientPhone: phone } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }) })} data-testid="button-parse-whatsapp">{parseWhatsApp.isPending ? 'Reading message…' : 'Parse into order'} <Zap size={15} /></button>{parseWhatsApp.data && <div className="parsed-result"><div><Check size={15} /><b>Order understood at {Math.round(parseWhatsApp.data.confidence * 100)}% confidence</b></div><span>{parseWhatsApp.data.parsedMessage}</span><small>Reference {parseWhatsApp.data.order.reference} · {money(parseWhatsApp.data.order.totalAmount)}</small></div>}</div></div>}
  </AppShell>;
}

function ProductCard({ item, quantity, onQuantity }: { item: CatalogItem; quantity: number; onQuantity: (value: number) => void }) {
  return <article className={`product-card ${quantity ? 'in-cart' : ''}`} data-testid={`card-product-${item.id}`}><div className={`product-art art-${item.id % 5}`}><span>{item.name.slice(0, 1)}</span>{item.popular && <small>Popular</small>}</div><div className="product-info"><div><span className="product-category">{item.category}</span><h3>{item.name}</h3><p>{item.packageSize}</p></div><div className="price-row"><div><strong>{money(item.communityPrice)}</strong><del>{money(item.retailPrice)}</del></div>{quantity ? <div className="quantity-control"><button onClick={() => onQuantity(quantity - 1)} data-testid={`button-product-decrease-${item.id}`}><Minus size={13} /></button><span>{quantity}</span><button onClick={() => onQuantity(quantity + 1)} data-testid={`button-product-increase-${item.id}`}><Plus size={13} /></button></div> : <button className="add-button" onClick={() => onQuantity(1)} data-testid={`button-add-product-${item.id}`}><Plus size={16} /></button>}</div></div></article>;
}

function OrdersPage() {
  const orders = useListOrders({ status: undefined }, { query: { queryKey: getListOrdersQueryKey(), refetchInterval: 30_000 } });
  const updateStatus = useUpdateOrderStatus();
  const [filter, setFilter] = useState('all');
  const statuses = ['all', 'received', 'packing', 'ready', 'out for delivery', 'delivered'];
  const rows = (orders.data ?? []).filter((order) => filter === 'all' || order.status.toLowerCase() === filter);
  const moveOrder = (order: Order) => {
    const sequence = ['received', 'packing', 'ready', 'out for delivery', 'delivered'];
    const next = sequence[Math.min(sequence.indexOf(order.status.toLowerCase()) + 1, sequence.length - 1)] ?? 'packing';
    updateStatus.mutate({ orderId: order.id, data: { status: next } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }) });
  };
  return <AppShell role="hub" eyebrow="Hub operations · Live queue" title="Keep the line moving."><div className="page-actions"><div className="filter-tabs">{statuses.map((item) => <button className={filter === item ? 'active' : ''} key={item} onClick={() => setFilter(item)} data-testid={`button-filter-${item.replaceAll(' ', '-')}`}>{item}<span>{item === 'all' ? orders.data?.length ?? 0 : (orders.data ?? []).filter((order) => order.status.toLowerCase() === item).length}</span></button>)}</div><button className="button button-secondary" onClick={() => orders.refetch()} data-testid="button-refresh-orders"><RefreshCw size={15} /> Refresh queue</button></div><div className="queue-layout"><Panel className="queue-panel"><div className="panel-head"><div><span className="tiny-label">Today · {rows.length} orders</span><h2>Fulfillment queue</h2></div><div className="queue-legend"><span><i className="dot dot-web" /> Web</span><span><i className="dot dot-wa" /> WhatsApp</span></div></div><QueryState loading={orders.isLoading} error={orders.isError} empty={!rows.length} onRetry={() => orders.refetch()}><div className="order-table"><div className="order-table-head"><span>Order</span><span>Client & address</span><span>Items</span><span>Amount</span><span>Status</span><span /></div>{rows.map((order) => <div className="order-row" key={order.id} data-testid={`row-order-${order.id}`}><div><b>{order.reference}</b><small><i className={`dot ${order.orderSource === 'whatsapp' ? 'dot-wa' : 'dot-web'}`} /> {order.orderSource} · {shortDate(order.createdAt)}</small></div><div><b>{order.clientName}</b><small>{order.address}</small></div><div><b>{order.itemCount} items</b><small>{order.lines.slice(0, 2).map((line) => line.itemName).join(', ')}</small></div><div><b>{money(order.totalAmount)}</b><small>{order.hubName}</small></div><div><StatusPill status={order.status} /></div><div><button className="row-action" onClick={() => moveOrder(order)} disabled={updateStatus.isPending || order.status.toLowerCase() === 'delivered'} data-testid={`button-advance-order-${order.id}`}>{order.status.toLowerCase() === 'delivered' ? <Check size={16} /> : <ArrowRight size={16} />}</button></div></div>)}</div></QueryState></Panel><Panel className="queue-side"><span className="tiny-label">At a glance</span><h3>What needs attention?</h3><div className="attention-item"><span className="attention-icon amber"><Clock3 size={16} /></span><div><b>{(orders.data ?? []).filter((order) => order.status.toLowerCase() === 'received').length} new orders</b><small>Ready to be picked up by the packing team.</small></div></div><div className="attention-item"><span className="attention-icon coral"><Truck size={16} /></span><div><b>{(orders.data ?? []).filter((order) => order.status.toLowerCase().includes('delivery')).length} on the road</b><small>Delivery agents are carrying value home.</small></div></div><div className="queue-note"><MessageCircle size={17} /><span>WhatsApp orders are parsed into the same queue. Nothing gets lost between channels.</span></div></Panel></div></AppShell>;
}

function DeliveriesPage() {
  const deliveries = useListDeliveries({ query: { queryKey: getListDeliveriesQueryKey(), refetchInterval: 30_000 } });
  const updateDelivery = useUpdateDeliveryStatus();
  const active = deliveries.data ?? [];
  const confirm = (delivery: Delivery) => updateDelivery.mutate({ deliveryId: delivery.id, data: { status: delivery.status.toLowerCase().includes('pickup') ? 'in transit' : 'delivered' } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListDeliveriesQueryKey() }) });
  return <AppShell role="agent" eyebrow="Delivery desk · Elsies River" title="Your route, at a glance."><div className="route-banner"><div className="route-number">03</div><div><span className="tiny-label">Tuesday route</span><h2>Small distances. Big difference.</h2><p>Every doorstep is a household choosing to keep value circulating here.</p></div><div className="route-progress"><div><strong>{active.filter((item) => item.status.toLowerCase() === 'delivered').length}</strong><span>of {active.length || 0} stops</span></div><div className="progress-track"><span style={{ width: `${active.length ? (active.filter((item) => item.status.toLowerCase() === 'delivered').length / active.length) * 100 : 0}%` }} /></div></div></div><div className="delivery-layout"><Panel className="delivery-list"><div className="panel-head"><div><span className="tiny-label">Assigned to you</span><h2>Today's drops</h2></div><button className="button button-secondary" onClick={() => deliveries.refetch()} data-testid="button-refresh-deliveries"><RefreshCw size={15} /> Refresh</button></div><QueryState loading={deliveries.isLoading} error={deliveries.isError} empty={!active.length} onRetry={() => deliveries.refetch()}><div className="delivery-cards">{active.map((delivery, index) => <DeliveryCard key={delivery.id} delivery={delivery} index={index} onConfirm={() => confirm(delivery)} pending={updateDelivery.isPending} />)}</div></QueryState></Panel><Panel className="route-side"><span className="tiny-label">Route note</span><h3>Carry the care with you.</h3><p>Your pickup point is the hub that knows this neighborhood best. Call ahead if a household is not reachable.</p><div className="route-contact"><span className="avatar">ER</span><div><b>Elsies River Hub</b><small>14th Avenue · Open until 18:00</small></div><a className="icon-button" href="tel:+27210000000" data-testid="button-call-hub"><Phone size={16} /></a></div><div className="route-detail"><MapPin size={16} /><span>All stops are within a 4.2 km local radius.</span></div></Panel></div></AppShell>;
}

function DeliveryCard({ delivery, index, onConfirm, pending }: { delivery: Delivery; index: number; onConfirm: () => void; pending: boolean }) {
  const complete = delivery.status.toLowerCase() === 'delivered';
  return <article className={`delivery-card ${complete ? 'complete' : ''}`} data-testid={`card-delivery-${delivery.id}`}><div className="delivery-index">{String(index + 1).padStart(2, '0')}</div><div className="delivery-main"><div className="delivery-card-head"><div><span className="tiny-label">{delivery.orderReference}</span><h3>{delivery.dropoff}</h3></div><StatusPill status={delivery.status} /></div><div className="delivery-route"><div><small>Pickup</small><b>{delivery.pickup}</b></div><ArrowRight size={15} /><div><small>Drop-off</small><b>{delivery.dropoff}</b></div></div><div className="delivery-card-foot"><span><Clock3 size={14} /> ETA {delivery.eta}</span><span className="agent-name"><span className="avatar small">{delivery.agentInitials}</span>{delivery.agentName}</span><button className={`button ${complete ? 'button-complete' : 'button-primary'}`} onClick={onConfirm} disabled={complete || pending} data-testid={`button-confirm-delivery-${delivery.id}`}>{complete ? <><Check size={15} /> Delivered</> : <>{delivery.status.toLowerCase().includes('pickup') ? 'Confirm pickup' : 'Confirm drop-off'} <ArrowRight size={15} /></>}</button></div></div></article>;
}

function CommandPage() {
  const dashboard = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey(), refetchInterval: 60_000 } });
  const hubs = useListHubs({ query: { queryKey: getListHubsQueryKey(), refetchInterval: 60_000 } });
  const pricing = useGetPricing({ query: { queryKey: getGetPricingQueryKey(), staleTime: 60_000 } });
  const data = dashboard.data;
  return <AppShell role="super" eyebrow="Super admin · Network intelligence" title="The whole picture, clearly."><QueryState loading={dashboard.isLoading} error={dashboard.isError} onRetry={() => dashboard.refetch()}><div className="command-intro"><div><span className="eyebrow"><span className="eyebrow-line" /> Wednesday, 12 June · 08:42</span><h2>Good morning, <i>builders.</i></h2><p>Here is how local circulation is holding up across the network.</p></div><div className="command-actions"><button className="button button-secondary" onClick={() => { dashboard.refetch(); hubs.refetch(); pricing.refetch(); }} data-testid="button-refresh-command"><RefreshCw size={15} /> Sync data</button><Link href="/pricing" className="button button-primary" data-testid="link-command-pricing"><SlidersHorizontal size={15} /> Adjust pricing</Link></div></div>{data && <><div className="metric-grid"><Metric label="Orders this month" value={data.totalOrders.toLocaleString()} note="+12.4% vs last month" icon={ShoppingBasket} accent="sun" /><Metric label="Active hubs" value={String(data.activeHubs).padStart(2, '0')} note="All hubs reporting" icon={Store} accent="mint" /><Metric label="Local savings" value={money(data.localSavings)} note="Passed to households" icon={WalletCards} accent="coral" /><Metric label="Currency retained" value={money(data.retainedCurrency)} note="Circulating in the network" icon={LineChart} accent="blue" /></div><div className="command-grid"><Panel className="trend-panel"><div className="panel-head"><div><span className="tiny-label">Network pulse</span><h3>Orders & value retained</h3></div><span className="panel-period">Last 7 weeks <ChevronDown size={14} /></span></div><TrendChart points={data.orderTrend} /></Panel><Panel className="hubs-panel"><div className="panel-head"><div><span className="tiny-label">Operational health</span><h3>Community hubs</h3></div><Link href="/zones" className="text-link" data-testid="link-view-hubs">View coverage <ArrowRight size={14} /></Link></div><div className="hub-list">{(hubs.data ?? []).map((hub) => <HubRow key={hub.id} hub={hub} />)}</div></Panel><Panel className="forecast-panel"><div className="panel-head"><div><span className="tiny-label">Demand signal</span><h3>Stock to watch</h3></div><BarChart3 size={17} /></div><div className="forecast-list">{data.demandForecast.map((item) => <div className="forecast-row" key={item.item}><div><b>{item.item}</b><small>{item.confidence}% confidence · {item.trend}</small></div><div className={`forecast-days ${item.daysRemaining < 5 ? 'urgent' : ''}`}><strong>{item.daysRemaining}</strong><small>days</small></div></div>)}</div></Panel><Panel className="activity-panel"><div className="panel-head"><div><span className="tiny-label">Live ledger</span><h3>Recent activity</h3></div><Activity size={17} /></div><div className="activity-list">{data.recentActivity.map((item) => <div className="activity-row" key={item.id}><span className={`activity-dot ${statusTone(item.tone)}`} /><div><b>{item.title}</b><small>{item.detail}</small></div><time>{item.timestamp}</time></div>)}</div></Panel></div><div className="leakage-strip"><div><span className="tiny-label">The point of the network</span><h3>Less leakage. More life in the places we share.</h3></div><div className="leakage-stats"><div><small>Corporate leakage</small><strong>{money(data.corporateLeakage)}</strong></div><ArrowRight size={20} /><div><small>Service reinvestment</small><strong className="green-text">{money(data.serviceReinvestment)}</strong></div></div></div></>}</QueryState></AppShell>;
}

function HubRow({ hub }: { hub: Hub }) {
  return <div className="hub-row" data-testid={`row-hub-${hub.id}`}><span className="hub-avatar">{initials(hub.name)}</span><div><b>{hub.name}</b><small>{hub.activeOrders} active orders · {hub.agentCount} agents</small></div><div className="health-bar"><span style={{ width: `${hub.stockHealth}%` }} /></div><div className="health-value">{hub.stockHealth}%</div><StatusPill status={hub.status} /></div>;
}

function TrendChart({ points }: { points: DashboardSummary['orderTrend'] }) {
  const max = Math.max(...points.map((point) => point.orders), 1);
  return <div className="chart-wrap"><div className="chart-y"><span>{max}</span><span>{Math.round(max * .66)}</span><span>{Math.round(max * .33)}</span><span>0</span></div><div className="chart"><div className="chart-grid"><i /><i /><i /><i /></div><div className="chart-bars">{points.map((point) => <div className="chart-column" key={point.label}><div className="bar retained" style={{ height: `${Math.max(10, (point.retained / max) * 100)}%` }} /><div className="bar orders" style={{ height: `${Math.max(14, (point.orders / max) * 100)}%` }} /><small>{point.label}</small></div>)}</div><div className="chart-legend"><span><i className="legend-dot orders" /> Orders</span><span><i className="legend-dot retained" /> Retained value</span></div></div></div>;
}

function PricingPage() {
  const pricing = useGetPricing({ query: { queryKey: getGetPricingQueryKey() } });
  const calculate = useCalculatePricing();
  const [offset, setOffset] = useState<number | null>(null);
  const summary = pricing.data;
  const current = offset ?? summary?.globalOffsetPercent ?? 18;
  const savePricing = () => calculate.mutate({ data: { offsetPercent: current } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPricingQueryKey() }) });
  return <AppShell role="super" eyebrow="Super admin · Price controls" title="Make the fair price visible."><QueryState loading={pricing.isLoading} error={pricing.isError} onRetry={() => pricing.refetch()}><div className="pricing-hero"><div><span className="eyebrow"><span className="eyebrow-line" /> Baseline calculator</span><h2>Price access without <i>guesswork.</i></h2><p>Set one transparent community offset against the retail baseline. The network does the arithmetic; you keep the decision grounded.</p></div><div className="pricing-status"><span className="status-pill green"><span className="status-dot" /> {summary?.status ?? 'Ready'}</span><small>Last calculated<br />{summary?.lastCalculatedAt ? shortDate(summary.lastCalculatedAt) : '—'}</small></div></div><div className="pricing-grid"><Panel className="pricing-control"><div className="panel-head"><div><span className="tiny-label">Global community offset</span><h3>One lever, every basket</h3></div><SlidersHorizontal size={18} /></div><div className="offset-display"><strong>{current}%</strong><span>below retail baseline</span></div><input className="range-input" type="range" min="0" max="50" value={current} onChange={(event) => setOffset(Number(event.target.value))} data-testid="input-offset-percent" /><div className="range-labels"><span>0% · baseline</span><span>25% · balanced</span><span>50% · maximum support</span></div><div className="control-divider" /><div className="pricing-preview"><div><span>Example retail price</span><b>R100.00</b></div><ArrowRight size={18} /><div><span>Community price</span><b className="green-text">R{(100 * (1 - current / 100)).toFixed(2)}</b></div></div><button className="button button-primary button-wide" disabled={calculate.isPending} onClick={savePricing} data-testid="button-publish-pricing">{calculate.isPending ? 'Publishing new prices…' : 'Publish community prices'} <ArrowRight size={16} /></button></Panel><div className="pricing-summary"><Metric label="Items affected" value={String(summary?.totalItems ?? 0)} note="Published in the catalogue" icon={Boxes} accent="mint" /><Metric label="Projected savings" value={money(summary?.projectedCommunitySavings ?? 0)} note="Across the current catalogue" icon={WalletCards} accent="coral" /><Panel className="pricing-principles"><span className="tiny-label">Our pricing principles</span><div><BadgeCheck size={17} /><span>Retail baseline is always visible.</span></div><div><BadgeCheck size={17} /><span>Offsets are applied consistently.</span></div><div><BadgeCheck size={17} /><span>Every saving stays legible.</span></div></Panel></div></div></QueryState></AppShell>;
}

function ZonesPage() {
  const zones = useListZones({ query: { queryKey: getListZonesQueryKey(), staleTime: 60_000 } });
  const [selected, setSelected] = useState<number | null>(null);
  const rows = zones.data ?? [];
  const selectedZone = rows.find((zone) => zone.id === selected) ?? rows[0];
  return <AppShell role="super" eyebrow="Network · Ward coverage" title="Know where the work lands."><div className="zones-intro"><div><span className="eyebrow"><span className="eyebrow-line" /> Western Cape map room</span><h2>Coverage is a <i>relationship.</i></h2><p>Track household reach by ward and keep each local hub resourced for the work ahead.</p></div><div className="coverage-total"><strong>{rows.reduce((sum, zone) => sum + zone.households, 0).toLocaleString()}</strong><span>households in view</span></div></div><QueryState loading={zones.isLoading} error={zones.isError} empty={!rows.length} onRetry={() => zones.refetch()}><div className="zones-grid"><Panel className="map-panel"><div className="panel-head"><div><span className="tiny-label">Coverage view</span><h3>Ward network</h3></div><div className="map-tools"><button className="icon-button" onClick={() => zones.refetch()} data-testid="button-map-search"><Search size={16} /></button><button className="icon-button" onClick={() => setSelected(null)} data-testid="button-map-settings"><Settings2 size={16} /></button></div></div><div className="map-canvas"><div className="map-river river-one" /><div className="map-river river-two" />{rows.map((zone, index) => <button key={zone.id} className={`map-node node-${index % 6} ${selectedZone?.id === zone.id ? 'selected' : ''}`} onClick={() => setSelected(zone.id)} data-testid={`button-zone-node-${zone.id}`}><span>{zone.households}</span><i /></button>)}<div className="map-label label-north">NORTH</div><div className="map-label label-south">SOUTHERN SUBURBS</div><div className="map-scale">5 km <span /></div></div><div className="map-legend"><span><i className="legend-node active" /> Active coverage</span><span><i className="legend-node growing" /> Growing reach</span><span><i className="legend-node watch" /> Needs attention</span></div></Panel><Panel className="zone-list-panel"><div className="panel-head"><div><span className="tiny-label">Ward register</span><h3>{rows.length} zones · sorted by reach</h3></div><span className="mono">WC / ZONES</span></div><div className="zone-list">{rows.map((zone) => <button key={zone.id} className={`zone-row ${selectedZone?.id === zone.id ? 'selected' : ''}`} onClick={() => setSelected(zone.id)} data-testid={`button-zone-${zone.id}`}><span className="zone-number">{String(zone.id).padStart(2, '0')}</span><div><b>{zone.name}</b><small>{zone.municipality} · {zone.hubName}</small></div><strong>{zone.households.toLocaleString()}</strong><StatusPill status={zone.status} /></button>)}</div>{selectedZone && <div className="zone-detail"><div className="zone-detail-head"><span className="hub-avatar">{initials(selectedZone.hubName)}</span><div><span className="tiny-label">Selected ward</span><h3>{selectedZone.name}</h3></div><button className="icon-button" onClick={() => setSelected(null)} data-testid="button-close-zone-detail"><X size={16} /></button></div><div className="zone-detail-meta"><span><Users size={15} /> {selectedZone.households.toLocaleString()} households</span><span><Store size={15} /> {selectedZone.hubName}</span></div></div>}</Panel></div></QueryState></AppShell>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={Home} /><Route path="/shop" component={ShopPage} /><Route path="/orders" component={OrdersPage} /><Route path="/deliveries" component={DeliveriesPage} /><Route path="/command" component={CommandPage} /><Route path="/pricing" component={PricingPage} /><Route path="/zones" component={ZonesPage} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;