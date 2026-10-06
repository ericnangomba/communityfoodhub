import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Barcode,
  Bell,
  Bike,
  Boxes,
  Check,
  CheckCircle,
  ChevronDown,
  CircleAlert,
  Clock3,
  CreditCard,
  Database,
  ExternalLink,
  LayoutDashboard,
  Leaf,
  LineChart,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Minus,
  Navigation,
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
  Trash,
  Truck,
  Upload,
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
import Ward28Map from './components/Ward28Map';
import logoSvg from '@assets/onsekombuislogosvg.svg';
import paymerchLogo from '@assets/mlogopaymerch_1789737270045.png';
import './index.css';

const queryClient = new QueryClient();
const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

type Role = 'client' | 'hub' | 'agent' | 'warehouse' | 'super';
type AuthRole = 'CLIENT' | 'HUB_ADMIN' | 'DELIVERY_AGENT' | 'WAREHOUSE_MANAGER' | 'SUPER_ADMIN';
type AuthUser = { id: number; name?: string; fullName: string | null; email: string; phoneNumber: string | null; role: AuthRole; hubId: number | null };
type DemoUser = { id: number; email: string; password: string; fullName: string; role: AuthRole; phoneNumber: string };

// Simple in-memory user store for prototyping
const DEMO_USERS_KEY = 'cwh-demo-users';
const DEMO_SESSION_KEY = 'cwh-demo-session';

function getDemoUsers(): DemoUser[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(DEMO_USERS_KEY);
  if (!stored) {
    // Initialize with default users
    const defaultUsers: DemoUser[] = [
      { id: 1, email: 'admin@comhub.co.za', password: 'Kamphata@2023', fullName: 'Super Admin', role: 'SUPER_ADMIN', phoneNumber: '' },
      { id: 2, email: 'hub@comhub.co.za', password: 'hub123', fullName: 'Hub Manager', role: 'HUB_ADMIN', phoneNumber: '+27123456789' },
      { id: 3, email: 'agent@comhub.co.za', password: 'agent123', fullName: 'Delivery Agent', role: 'DELIVERY_AGENT', phoneNumber: '+27123456788' },
      { id: 4, email: 'warehouse@comhub.co.za', password: 'warehouse123', fullName: 'Warehouse Manager', role: 'WAREHOUSE_MANAGER', phoneNumber: '+27123456786' },
      { id: 5, email: 'client@comhub.co.za', password: 'client123', fullName: 'Community Client', role: 'CLIENT', phoneNumber: '+27123456787' },
    ];
    localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(defaultUsers));
    return defaultUsers;
  }
  return JSON.parse(stored);
}

function saveDemoUsers(users: DemoUser[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
  }
}

function getCurrentSession(): DemoUser | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(DEMO_SESSION_KEY);
  return stored ? JSON.parse(stored) : null;
}

function setCurrentSession(user: DemoUser | null) {
  if (typeof window !== 'undefined') {
    if (user) {
      localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(DEMO_SESSION_KEY);
    }
  }
}
type AccessUser = Pick<AuthUser, 'id' | 'name' | 'fullName' | 'email' | 'phoneNumber' | 'role' | 'hubId'>;

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  register: (fullName: string, email: string, phoneNumber: string, password: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  createUser: (fullName: string, email: string, phoneNumber: string, password: string, role: AuthRole) => Promise<AuthUser>;
  getUsers: () => DemoUser[];
  deleteUser: (id: number) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

// Admin-only hook for user management
function useAdminAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAdminAuth must be used inside AuthProvider');
  const { user } = context;
  if (user?.role !== 'SUPER_ADMIN') {
    throw new Error('Admin access required');
  }
  return {
    getUsers: context.getUsers,
    deleteUser: context.deleteUser,
    createUser: context.register,
    resetPassword: context.resetPassword
  };
}

async function authRequest(path: string, options?: RequestInit) {
  const apiUrl = import.meta.env.VITE_API_URL || '';
  const url = apiUrl ? `${apiUrl}/api/auth/${path}` : `/api/auth/${path}`;
  
  // Simplified authentication - works without API server
  if (!apiUrl) {
    console.log('Simplified authentication for', path);
    
    if (path === 'me') {
      const session = getCurrentSession();
      return { user: session ? {
        id: session.id,
        name: session.fullName,
        fullName: session.fullName,
        email: session.email,
        phoneNumber: session.phoneNumber,
        role: session.role,
        hubId: null
      } : null };
    }
    
    if (path === 'login') {
      try {
        const body = JSON.parse(options?.body as string || '{}');
        console.log('Login attempt:', body.email);
        
        // Hardcoded admin credentials
        if (body.email === 'admin@comhub.co.za' && body.password === 'Kamphata@2023') {
          const adminUser: DemoUser = {
            id: 1,
            email: body.email,
            password: body.password,
            fullName: 'Super Admin',
            role: 'SUPER_ADMIN',
            phoneNumber: ''
          };
          setCurrentSession(adminUser);
          return { user: {
            id: adminUser.id,
            name: adminUser.fullName,
            fullName: adminUser.fullName,
            email: adminUser.email,
            phoneNumber: adminUser.phoneNumber,
            role: adminUser.role,
            hubId: null
          } };
        }
        
        // Check against demo users list with password validation
        const users = getDemoUsers();
        const user = users.find(u => u.email === body.email && u.password === body.password);
        
        if (user) {
          console.log('User found:', user.fullName, 'with role:', user.role);
          setCurrentSession(user);
          return { user: {
            id: user.id,
            name: user.fullName,
            fullName: user.fullName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            hubId: null
          } };
        }
        
        console.log('User not found or invalid password for:', body.email);
        throw new Error('Invalid email or password');
      } catch (e) {
        console.error('Login error:', e);
        throw new Error('Invalid email or password');
      }
    }
    
    if (path === 'register') {
      try {
        const body = JSON.parse(options?.body as string || '{}');
        console.log('Register attempt:', body.email);
        const users = getDemoUsers();
        
        // Check if user already exists
        if (users.find(u => u.email === body.email)) {
          throw new Error('User already exists');
        }
        
        const newUser: DemoUser = {
          id: Math.max(...users.map(u => u.id), 0) + 1,
          email: body.email,
          password: body.password,
          fullName: body.fullName,
          role: 'CLIENT',
          phoneNumber: body.phoneNumber
        };
        
        users.push(newUser);
        saveDemoUsers(users);
        setCurrentSession(newUser);
        
        return { user: {
          id: newUser.id,
          name: newUser.fullName,
          fullName: newUser.fullName,
          email: newUser.email,
          phoneNumber: newUser.phoneNumber,
          role: newUser.role,
          hubId: null
        } };
      } catch (e) {
        console.error('Register error:', e);
        throw new Error('Invalid request');
      }
    }
    
    if (path === 'logout') {
      console.log('Logout');
      setCurrentSession(null);
      return {};
    }
    
    console.error('Unknown auth path:', path);
    throw new Error('Authentication request failed');
  }
  
  console.log('API mode: Fetching from', url);
  const response = await fetch(url, { ...options, credentials: apiUrl ? 'include' : 'include', headers: { 'content-type': 'application/json', ...(options?.headers ?? {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? 'Authentication request failed');
  return payload as { user?: AuthUser };
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { authRequest('me').then((payload) => setUser(payload.user ?? null)).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  const value: AuthContextValue = {
    user,
    loading,
    signIn: async (email, password) => { const payload = await authRequest('login', { method: 'POST', body: JSON.stringify({ email, password }) }); if (!payload.user) throw new Error('Authentication response did not include a user'); setUser(payload.user); return payload.user; },
    register: async (fullName, email, phoneNumber, password) => { const payload = await authRequest('register', { method: 'POST', body: JSON.stringify({ fullName, email, phoneNumber, password }) }); if (!payload.user) throw new Error('Registration response did not include a user'); setUser(payload.user); return payload.user; },
    signOut: async () => { await authRequest('logout', { method: 'POST' }).catch(() => undefined); setUser(null); setCurrentSession(null); },
  createUser: async (fullName, email, phoneNumber, password, role) => {
      const users = getDemoUsers();
      if (users.find(u => u.email === email)) {
        throw new Error('User already exists');
      }
      const newUser: DemoUser = {
        id: Math.max(...users.map(u => u.id), 0) + 1,
        email,
        password,
        fullName,
        role: role as AuthRole,
        phoneNumber
      };
      users.push(newUser);
      saveDemoUsers(users);
      return {
        id: newUser.id,
        name: newUser.fullName,
        fullName: newUser.fullName,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber,
        role: newUser.role,
        hubId: null
      };
    },
    getUsers: () => getDemoUsers(),
    deleteUser: (id) => {
      const users = getDemoUsers().filter(u => u.id !== id);
      saveDemoUsers(users);
    },
    resetPassword: (id: number, newPassword: string) => {
      const users = getDemoUsers();
      const userIndex = users.findIndex(u => u.id === id);
      if (userIndex !== -1) {
        users[userIndex].password = newPassword;
        saveDemoUsers(users);
      }
    }
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
const roles: { id: Role; label: string; detail: string; icon: typeof ShoppingBasket; href: string }[] = [
  { id: 'client', label: 'Community Client', detail: 'Shop household staples', icon: ShoppingBasket, href: '/shop' },
  { id: 'hub', label: 'Hub Admin', detail: 'Run the order queue', icon: Store, href: '/orders' },
  { id: 'agent', label: 'Delivery Agent', detail: 'Move orders home', icon: Bike, href: '/deliveries' },
  { id: 'warehouse', label: 'Warehouse Manager', detail: 'Manage inventory', icon: Boxes, href: '/inventory' },
  { id: 'super', label: 'Super Admin', detail: 'See the full network', icon: LayoutDashboard, href: '/command' },
];

const navGroups = [
  { label: 'Workspaces', items: [
    { href: '/shop', label: 'Shop', icon: ShoppingBasket, role: 'client' as Role },
    { href: '/orders', label: 'Order queue', icon: Package, role: 'hub' as Role },
    { href: '/deliveries', label: 'Deliveries', icon: Bike, role: 'agent' as Role },
    { href: '/inventory', label: 'Inventory', icon: Boxes, role: 'warehouse' as Role },
    { href: '/command', label: 'Command centre', icon: LayoutDashboard, role: 'super' as Role },
  ] },
  { label: 'My Orders', items: [
    { href: '/orders', label: 'Order Status', icon: Package, role: 'client' as Role },
    { href: '/deliveries', label: 'Delivery Status', icon: Bike, role: 'client' as Role },
  ] },
  { label: 'Warehouse', items: [
    { href: '/inventory', label: 'Inventory', icon: Boxes, role: 'warehouse' as Role },
    { href: '/orders', label: 'Pack Orders', icon: Package, role: 'warehouse' as Role },
  ] },
  { label: 'Hub Operations', items: [
    { href: '/orders', label: 'Order Queue', icon: Package, role: 'hub' as Role },
    { href: '/deliveries', label: 'Delivery Tracking', icon: Bike, role: 'hub' as Role },
  ] },
  { label: 'Deliveries', items: [
    { href: '/deliveries', label: 'My Deliveries', icon: Bike, role: 'agent' as Role },
  ] },
  { label: 'Network', items: [
    { href: '/pricing', label: 'Pricing controls', icon: SlidersHorizontal, role: 'super' as Role },
    { href: '/zones', label: 'Ward coverage', icon: MapPin, role: 'super' as Role },
  ] },
  { label: 'Administration', items: [
    { href: '/users', label: 'User Management', icon: Users, role: 'super' as Role },
  ] },
];

const productImages: Record<string, string> = {
  rice: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=700&q=82',
  maize: 'https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?auto=format&fit=crop&w=700&q=82',
  oil: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=700&q=82',
  sugar: 'https://images.unsplash.com/photo-1581268497302-7e4c4ea5fb6c?auto=format&fit=crop&w=700&q=82',
  bread: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=700&q=82',
  beans: 'https://images.unsplash.com/photo-1612257999756-4bdfadf4b0a3?auto=format&fit=crop&w=700&q=82',
  washing: 'https://images.unsplash.com/photo-1585832770485-e68a5dbfad52?auto=format&fit=crop&w=700&q=82',
  tea: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=700&q=82',
};

function setIntendedRole(role: Role) {
  window.sessionStorage.setItem('cwh-intended-role', role);
}

function intendedRole(): Role {
  const role = window.sessionStorage.getItem('cwh-intended-role');
  return role === 'super' || role === 'hub' || role === 'agent' || role === 'warehouse' ? role : 'client';
}

function workspacePath(role: AuthRole) {
  console.log('workspacePath called with role:', role);
  const path = role === 'SUPER_ADMIN' ? '/command' : role === 'HUB_ADMIN' ? '/orders' : role === 'DELIVERY_AGENT' ? '/deliveries' : role === 'WAREHOUSE_MANAGER' ? '/inventory' : '/shop';
  console.log('workspacePath returning:', path);
  return path;
}

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

function Brand({ compact = false, showWordmark = true }: { compact?: boolean; showWordmark?: boolean }) {
  return <Link href="/" className={`brand ${compact ? 'compact' : ''}`} data-testid="link-brand">
    <img src={logoSvg} alt="Community Food Hub logo" className="brand-logo" />
    {showWordmark && <span className="brand-wordmark">
      <span className="brand-kicker"><span className="eyebrow-line" /> Community</span>
      <em>Food Hub</em>
    </span>}
  </Link>;
}

function AppShell({ children, role = 'super', title, eyebrow }: { children: ReactNode; role?: Role; title?: string; eyebrow?: string }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: number; type: string; title: string; message: string; timestamp: Date; read: boolean }>>([]);
  const { user, signOut } = useAuth();
  const currentRole = roles.find((item) => item.id === role) ?? roles[3];
  const isClient = user?.role === 'CLIENT';
  const visibleGroups = isClient
    ? [
        { label: 'Shop', items: [
          { href: '/shop', label: 'Shop', icon: ShoppingBasket, role: 'client' as Role },
        ] },
        { label: 'My Orders', items: [
          { href: '/orders', label: 'Order Status', icon: Package, role: 'client' as Role },
          { href: '/deliveries', label: 'Delivery Status', icon: Bike, role: 'client' as Role },
        ] },
      ]
    : role === 'hub'
    ? [
        { label: 'Hub Operations', items: [
          { href: '/orders', label: 'Order Queue', icon: Package, role: 'hub' as Role },
          { href: '/deliveries', label: 'Delivery Tracking', icon: Bike, role: 'hub' as Role },
        ] },
      ]
    : role === 'warehouse'
    ? [
        { label: 'Warehouse', items: [
          { href: '/inventory', label: 'Inventory', icon: Boxes, role: 'warehouse' as Role },
          { href: '/orders', label: 'Pack Orders', icon: Package, role: 'warehouse' as Role },
        ] },
      ]
    : role === 'agent'
    ? [
        { label: 'Deliveries', items: [
          { href: '/deliveries', label: 'My Deliveries', icon: Bike, role: 'agent' as Role },
        ] },
      ]
    : navGroups.filter((group) => group.items.some((item) => item.role === role));

  // Mobile bottom navigation items
  const bottomNavItems = isClient
    ? [
        { href: '/shop', label: 'Shop', icon: ShoppingBasket },
        { href: '/orders', label: 'Orders', icon: Package },
        { href: '/deliveries', label: 'Deliveries', icon: Bike },
      ]
    : role === 'hub'
    ? [
        { href: '/orders', label: 'Orders', icon: Package },
        { href: '/deliveries', label: 'Deliveries', icon: Bike },
      ]
    : role === 'warehouse'
    ? [
        { href: '/inventory', label: 'Inventory', icon: Boxes },
        { href: '/orders', label: 'Pack Orders', icon: Package },
      ]
    : role === 'agent'
    ? [
        { href: '/deliveries', label: 'Deliveries', icon: Bike },
      ]
    : [
        { href: '/command', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/pricing', label: 'Pricing', icon: SlidersHorizontal },
        { href: '/zones', label: 'Zones', icon: MapPin },
        { href: '/users', label: 'Users', icon: Users },
      ];

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize demo notifications
  useEffect(() => {
    const demoNotifications = [
      { id: 1, type: 'NEW_ORDER', title: 'New Order Received', message: 'Order #1234 from John Doe - R245.00', timestamp: new Date(Date.now() - 5 * 60 * 1000), read: false },
      { id: 2, type: 'ORDER_CONFIRMED', title: 'Order Confirmed', message: 'Order #1233 confirmed by hub', timestamp: new Date(Date.now() - 15 * 60 * 1000), read: false },
      { id: 3, type: 'LOW_STOCK', title: 'Low Stock Alert', message: 'Maize Meal is running low (45 units)', timestamp: new Date(Date.now() - 30 * 60 * 1000), read: true },
      { id: 4, type: 'DELIVERY_STARTED', title: 'Delivery En Route', message: 'Agent #2 is on the way to 123 Main St', timestamp: new Date(Date.now() - 45 * 60 * 1000), read: true },
      { id: 5, type: 'DELIVERED', title: 'Order Delivered', message: 'Order #1230 delivered successfully', timestamp: new Date(Date.now() - 60 * 60 * 1000), read: true },
    ];
    setNotifications(demoNotifications);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const markAsRead = (id: number) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };
  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'NEW_ORDER': return Package;
      case 'ORDER_CONFIRMED': return CheckCircle;
      case 'ORDER_PICKED': return Truck;
      case 'DELIVERY_STARTED': return Bike;
      case 'DELIVERED': return CheckCircle;
      case 'LOW_STOCK': return AlertCircle;
      default: return Bell;
    }
  };
  const formatRelativeTime = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${Math.floor(hours / 24)} days ago`;
  };

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="sidebar-head"><Brand compact /><button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)} data-testid="button-close-menu"><X size={18} /></button></div>
      <div className="network-badge"><span className="live-pulse" /> Elsies River network <ChevronDown size={14} /></div>
      <nav className="sidebar-nav">
        {visibleGroups.map((group) => <div className="nav-group" key={group.label}>
          <p>{group.label}</p>
          {group.items.map((item) => <Link key={item.href} href={item.href} className={`nav-link ${location === item.href ? 'active' : ''}`} onClick={() => setMobileOpen(false)} data-testid={`link-${item.label.toLowerCase().replaceAll(' ', '-')}`}>
            <item.icon size={17} /><span>{item.label}</span>{location === item.href && <span className="nav-active-mark" />}
          </Link>)}
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="side-note"><Sparkles size={15} /><div><b>Local first</b><span>Every order keeps value moving nearby.</span></div></div>
        <div className="profile-chip"><span className="avatar">{initials(user?.fullName ?? currentRole.label)}</span><div><b>{user?.fullName ?? currentRole.label}</b><span>{user?.email ?? 'Elsies River · Western Cape'}</span></div><Settings2 size={15} /></div>
        <button className="signout-button" onClick={() => void signOut()} data-testid="button-sign-out"><LogOut size={15} /> Sign out</button>
      </div>
    </aside>
    <main className="main-content">
       <header className="topbar">
        <button className="mobile-menu icon-button" onClick={() => setMobileOpen(true)} data-testid="button-open-menu"><Menu size={20} /></button>
         <div className="topbar-copy">{eyebrow && <span>{eyebrow}</span>}<h1>{title}</h1></div>
         <div className="topbar-actions"><span className="connection"><span className="live-pulse" /> Live network</span>
         <div className="notification-wrapper">
           <button className="icon-button notification-button" onClick={() => setNotificationOpen(!notificationOpen)} data-testid="button-notifications">
             <Bell size={18} />
             {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
           </button>
           {notificationOpen && (
             <div className="notification-panel" data-testid="notification-panel">
               <div className="notification-header">
                 <h3>Notifications</h3>
                 <button className="text-button" onClick={markAllAsRead}>Mark all as read</button>
               </div>
               <div className="notification-list">
                 {notifications.length === 0 ? (
                   <div className="notification-empty">
                     <Bell size={32} />
                     <span>No notifications</span>
                   </div>
                 ) : (
                   notifications.map((notification) => {
                     const Icon = getNotificationIcon(notification.type);
                     return (
                       <div key={notification.id} className={`notification-item ${notification.read ? 'read' : ''}`} onClick={() => markAsRead(notification.id)}>
                         <div className="notification-icon"><Icon size={16} /></div>
                         <div className="notification-content">
                           <div className="notification-title">{notification.title}</div>
                           <div className="notification-message">{notification.message}</div>
                           <div className="notification-time">{formatRelativeTime(notification.timestamp)}</div>
                         </div>
                         {!notification.read && <span className="notification-dot" />}
                       </div>
                     );
                   })
                 )}
               </div>
               <div className="notification-footer">
                 <button className="button button-secondary button-wide">View all notifications</button>
               </div>
             </div>
           )}
         </div>
         <div className="top-avatar">{initials(user?.fullName ?? currentRole.label)}</div></div>
      </header>
      {noticeOpen && <div className="notice-popover" data-testid="notice-popover"><b>Network is moving well.</b><span>No new alerts for this workspace.</span></div>}
      <div className="page-wrap">{children}</div>
    </main>
    {isMobile && (
      <nav className="bottom-nav">
        {bottomNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav-item ${location === item.href ? 'active' : ''}`}
          >
            <item.icon size={24} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    )}
  </div>;
}

function Home() {
  const [, setLocation] = useLocation();
  const [role, setRole] = useState<Role>('client');
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), retry: 1 } });
  return <div className="entry-page">
    <div className="entry-noise" />
    <header className="entry-nav"><Brand showWordmark={false} /><div className="entry-status"><span className="live-pulse" /> Network online {health.isLoading ? '' : health.isError ? '· offline check' : '· Elsies River'}</div></header>
    <div className="entry-grid">
      <section className="entry-copy">
         <h1>Wealth that stays <i>in the community.</i></h1>
        <p className="entry-lede">Community Food Hub connects Elsies River households, local hubs and delivery teams around one simple promise: better access, with more value kept close to home.</p>
        <div className="entry-stats"><div><strong>04</strong><span>active hubs</span></div><div><strong>1,240</strong><span>households reached</span></div><div><strong>18.6%</strong><span>value retained locally</span></div></div>
      </section>
      <section className="role-card">
        <div className="role-card-head"><span className="tiny-label">Sign In</span></div>
        <h2>Sign In</h2>
         <div className="role-list">{roles.filter((item) => item.id === 'client' || item.id === 'super').map((item) => <button key={item.id} className={`role-option ${role === item.id ? 'selected' : ''}`} onClick={() => setRole(item.id)} data-testid={`button-role-${item.id}`}>
          <span className="role-icon"><item.icon size={19} /></span><span><b>{item.label}</b><small>{item.detail}</small></span><ArrowRight size={17} className="role-arrow" />
        </button>)}</div>
         <button className="button button-primary button-wide" onClick={() => { setIntendedRole(role); setLocation(role === 'client' ? '/sign-up' : '/sign-in'); }} data-testid="button-enter-workspace">{role === 'client' ? 'Register as a client' : 'Super admin sign in'} <ArrowRight size={16} /></button>
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
  const [paymentMethod, setPaymentMethod] = useState('PAYMERCH');
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [whatsappText, setWhatsappText] = useState('Hi, please send 2 rice 2kg and 1 cooking oil 750ml to 14 Avon Road, Elsies River.');
  const [confirmation, setConfirmation] = useState<Order | null>(null);
  
  // Use dummy data if API is not available
  const dummyCatalog: CatalogItem[] = [
    { id: 1, name: "Long Grain Rice", category: "Staples", packageSize: "1kg", communityPrice: 21.99, retailPrice: 25.99, savingsPercent: 15, stockQuantity: 138, imageKey: "rice", popular: true },
    { id: 2, name: "Maize Meal", category: "Staples", packageSize: "2.5kg", communityPrice: 38.5, retailPrice: 44.99, savingsPercent: 14, stockQuantity: 86, imageKey: "maize", popular: true },
    { id: 3, name: "Cooking Oil", category: "Kitchen", packageSize: "750ml", communityPrice: 29.99, retailPrice: 36.99, savingsPercent: 19, stockQuantity: 64, imageKey: "oil" },
    { id: 4, name: "Sugar", category: "Staples", packageSize: "1kg", communityPrice: 18.5, retailPrice: 22.99, savingsPercent: 20, stockQuantity: 42, imageKey: "sugar" },
    { id: 5, name: "Brown Bread", category: "Fresh", packageSize: "700g", communityPrice: 15.99, retailPrice: 19.99, savingsPercent: 20, stockQuantity: 28, imageKey: "bread", popular: true },
    { id: 6, name: "Baked Beans", category: "Pantry", packageSize: "410g", communityPrice: 13.5, retailPrice: 16.99, savingsPercent: 21, stockQuantity: 112, imageKey: "beans" },
    { id: 7, name: "Washing Powder", category: "Home", packageSize: "500g", communityPrice: 24.99, retailPrice: 31.99, savingsPercent: 22, stockQuantity: 19, imageKey: "washing" },
    { id: 8, name: "Tea Bags", category: "Kitchen", packageSize: "100 pack", communityPrice: 32.5, retailPrice: 39.99, savingsPercent: 19, stockQuantity: 51, imageKey: "tea" },
  ];
  
  const dummyHubs: Hub[] = [
    { id: 1, name: "Elsies River Hub", region: "Northern Suburbs", status: "ACTIVE", activeOrders: 12, stockHealth: 87, agentCount: 8 },
    { id: 2, name: "Southern Suburbs Hub", region: "Southern Suburbs", status: "ACTIVE", activeOrders: 8, stockHealth: 93, agentCount: 6 },
  ];
  
  // Ensure items is always an array
  const items = Array.isArray(catalog.data) && catalog.data.length > 0 ? catalog.data : dummyCatalog;
  const safeHubs = Array.isArray(hubs.data) && hubs.data.length > 0 ? hubs.data : dummyHubs;
  const categories = ['All', ...Array.from(new Set(items.map((item) => item.category)))];
  const shown = items.filter((item) => category === 'All' || item.category === category);
  const cartItems = items.filter((item) => cart[item.id]);
  const total = cartItems.reduce((sum, item) => sum + item.communityPrice * (cart[item.id] ?? 0), 0);
  const itemCount = cartItems.reduce((sum, item) => sum + (cart[item.id] ?? 0), 0);
  const setQuantity = (id: number, amount: number) => setCart((current) => ({ ...current, [id]: Math.max(0, amount) }));
  
  const submitOrder = () => {
    const hubId = safeHubs[0]?.id;
    if (!hubId || !clientName || !phone || !address || !cartItems.length || !paymentMethod) return;
    
    // Simulate payment processing
    if (paymentMethod === 'CARD') {
      // Simulate card payment processing (auto-approve for demo)
      // In production, this would show a proper payment modal
      console.log('Card payment simulated - auto-approved');
    }
    
    const orderData = {
      clientName,
      clientPhone: phone,
      hubId,
      address,
      orderSource: 'WEB_APP',
      paymentMethod,
      lines: cartItems.map((item) => ({ itemName: item.name, packageSize: item.packageSize, quantity: cart[item.id] ?? 0, unitPrice: item.communityPrice }))
    };
    
    if (createOrder.mutate) {
      createOrder.mutate({ data: orderData }, {
        onSuccess: (order) => { setConfirmation(order); setCart({}); queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }); },
      });
    } else {
      // Fallback for demo mode
      const mockOrder: Order = {
        id: Math.floor(Math.random() * 1000),
        reference: `CWH-${Math.floor(Math.random() * 10000)}`,
        clientName,
        clientPhone: phone,
        hubName: safeHubs[0]?.name || 'Elsies River Hub',
        address,
        orderSource: 'WEB_APP',
        status: 'PENDING',
        paymentMethod,
        paymentStatus: 'PAID',
        totalAmount: total,
        itemCount,
        createdAt: new Date().toISOString(),
        lines: cartItems.map((item) => ({ itemName: item.name, packageSize: item.packageSize, quantity: cart[item.id] ?? 0, unitPrice: item.communityPrice }))
      };
      setConfirmation(mockOrder);
      setCart({});
    }
  };
  
  const handleWhatsAppOrder = () => {
    const orderText = encodeURIComponent(whatsappText);
    window.open(`https://wa.me/27798567196?text=${orderText}`, '_blank');
    setWhatsappOpen(false);
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
         <div className="checkout-form"><span className="tiny-label">Delivery details</span><input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Your name" data-testid="input-client-name" /><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Mobile number" data-testid="input-client-phone" /><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street address in Elsies River" data-testid="input-delivery-address" /><span className="tiny-label payment-label">Choose payment</span><div className="payment-methods" role="group" aria-label="Payment methods"><button type="button" className={`payment-method ${paymentMethod === 'PAYMERCH' ? 'selected' : ''}`} onClick={() => setPaymentMethod('PAYMERCH')} data-testid="button-payment-paymerch"><img src={paymerchLogo} alt="Paymerch Mobile" /><span><b>Paymerch</b><small>Partner checkout</small></span><Check size={15} /></button><button type="button" className={`payment-method ${paymentMethod === 'PAYSHAP' ? 'selected' : ''}`} onClick={() => setPaymentMethod('PAYSHAP')} data-testid="button-payment-payshap"><span className="payment-mark payshap-mark">P</span><span><b>PayShap</b><small>Instant bank payment</small></span><Check size={15} /></button><button type="button" className={`payment-method ${paymentMethod === 'CARD' ? 'selected' : ''}`} onClick={() => setPaymentMethod('CARD')} data-testid="button-payment-card"><span className="payment-mark card-mark"><CreditCard size={16} /></span><span><b>Card</b><small>Visa or Mastercard</small></span><Check size={15} /></button></div><button className="button button-primary button-wide" disabled={!cartItems.length || !clientName || !phone || !address || !paymentMethod || createOrder.isPending} onClick={submitOrder} data-testid="button-place-order">{createOrder.isPending ? 'Sending order…' : `Pay ${money(total)}`} <ArrowRight size={16} /></button><button className="whatsapp-button" onClick={() => setWhatsappOpen(true)} data-testid="button-open-whatsapp"><MessageCircle size={17} /> Order through WhatsApp</button></div>
        {confirmation && <div className="confirmation"><Check size={16} /><span>Order <b>{confirmation.reference}</b> is with the hub.</span><button onClick={() => setConfirmation(null)} data-testid="button-dismiss-confirmation"><X size={14} /></button></div>}
      </aside>
    </div>
    {whatsappOpen && <div className="modal-backdrop"><div className="modal whatsapp-modal"><div className="modal-head"><div><span className="tiny-label">WhatsApp simulator</span><h3>Send a pantry message</h3></div><button className="icon-button" onClick={() => setWhatsappOpen(false)} data-testid="button-close-whatsapp"><X size={18} /></button></div><div className="wa-preview"><div className="wa-bubble">Hi there. Tell us what you need and we’ll turn it into a clear order for the hub.</div><div className="wa-bubble outgoing">{whatsappText}</div></div><textarea value={whatsappText} onChange={(event) => setWhatsappText(event.target.value)} data-testid="input-whatsapp-message" /><input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Client name" data-testid="input-whatsapp-name" /><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Mobile number" data-testid="input-whatsapp-phone" /><button className="button button-primary button-wide" disabled={!clientName || !phone || parseWhatsApp.isPending} onClick={() => parseWhatsApp.mutate({ data: { message: whatsappText, clientName, clientPhone: phone } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }) })} data-testid="button-parse-whatsapp">{parseWhatsApp.isPending ? 'Reading message…' : 'Parse into order'} <Zap size={15} /></button>{parseWhatsApp.data && <div className="parsed-result"><div><Check size={15} /><b>Order understood at {Math.round(parseWhatsApp.data.confidence * 100)}% confidence</b></div><span>{parseWhatsApp.data.parsedMessage}</span><small>Reference {parseWhatsApp.data.order.reference} · {money(parseWhatsApp.data.order.totalAmount)}</small></div>}</div></div>}
  </AppShell>;
}

// Super Admin Shop Page - shows storefront content
function AdminShopPage() {
  const catalog = useListCatalog({ query: { queryKey: getListCatalogQueryKey(), staleTime: 60_000 } });
  
  // Use dummy data if API is not available
  const dummyCatalog: CatalogItem[] = [
    { id: 1, name: "Long Grain Rice", category: "Staples", packageSize: "1kg", communityPrice: 21.99, retailPrice: 25.99, savingsPercent: 15, stockQuantity: 138, imageKey: "rice", popular: true },
    { id: 2, name: "Maize Meal", category: "Staples", packageSize: "2.5kg", communityPrice: 38.5, retailPrice: 44.99, savingsPercent: 14, stockQuantity: 86, imageKey: "maize", popular: true },
    { id: 3, name: "Cooking Oil", category: "Kitchen", packageSize: "750ml", communityPrice: 29.99, retailPrice: 36.99, savingsPercent: 19, stockQuantity: 64, imageKey: "oil" },
    { id: 4, name: "Sugar", category: "Staples", packageSize: "1kg", communityPrice: 18.5, retailPrice: 22.99, savingsPercent: 20, stockQuantity: 42, imageKey: "sugar" },
    { id: 5, name: "Brown Bread", category: "Fresh", packageSize: "700g", communityPrice: 15.99, retailPrice: 19.99, savingsPercent: 20, stockQuantity: 28, imageKey: "bread", popular: true },
    { id: 6, name: "Baked Beans", category: "Pantry", packageSize: "410g", communityPrice: 13.5, retailPrice: 16.99, savingsPercent: 21, stockQuantity: 112, imageKey: "beans" },
    { id: 7, name: "Washing Powder", category: "Home", packageSize: "500g", communityPrice: 24.99, retailPrice: 31.99, savingsPercent: 22, stockQuantity: 19, imageKey: "washing" },
    { id: 8, name: "Tea Bags", category: "Kitchen", packageSize: "100 pack", communityPrice: 32.5, retailPrice: 39.99, savingsPercent: 19, stockQuantity: 51, imageKey: "tea" },
  ];
  
  const items = Array.isArray(catalog.data) && catalog.data.length > 0 ? catalog.data : dummyCatalog;
  const categories = ['All', ...Array.from(new Set(items.map((item) => item.category)))];
  const [category, setCategory] = useState('All');
  const shown = items.filter((item) => category === 'All' || item.category === category);
  
  return <AppShell role="super" eyebrow="Super admin · Storefront" title="View community inventory.">
    <div className="shop-layout">
      <section className="shop-main">
        <div className="shop-hero"><div><span className="eyebrow"><span className="eyebrow-line" /> Admin view</span><h2>Community <i>storefront.</i></h2><p>View and manage inventory available to community clients.</p></div><div className="hero-stamp"><span>ADMIN</span><strong>{items.length}</strong><small>items in catalog</small></div></div>
        <div className="shop-toolbar"><div className="category-tabs">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="catalog-count"><span className="live-pulse" /> {shown.length} items shown</div></div>
        <div className="product-grid">{shown.map((item) => <div className="product-card admin-view" key={item.id}><div className={`product-art art-${item.id % 5}`}><img src={productImages[item.imageKey]} alt={`${item.name} ${item.packageSize}`} loading="lazy" /></div><div className="product-info"><div><span className="product-category">{item.category}</span><h3>{item.name}</h3><p>{item.packageSize}</p></div><div className="price-row"><div><strong>{money(item.communityPrice)}</strong><del>{money(item.retailPrice)}</del></div><span className="stock-badge">Stock: {item.stockQuantity}</span></div></div></div>)}</div>
      </section>
      <aside className="admin-shop-sidebar">
        <Panel className="stock-summary-panel">
          <div className="panel-head"><div><span className="tiny-label">Stock summary</span><h3>Inventory status</h3></div><Database size={17} /></div>
          <div className="stock-summary">
            <div><span>Total items</span><strong>{items.length}</strong></div>
            <div><span>Low stock</span><strong className="red-text">{items.filter(i => i.stockQuantity < 30).length}</strong></div>
            <div><span>Popular items</span><strong>{items.filter(i => i.popular).length}</strong></div>
          </div>
        </Panel>
      </aside>
    </div>
  </AppShell>;
}

function ProductCard({ item, quantity, onQuantity }: { item: CatalogItem; quantity: number; onQuantity: (value: number) => void }) {
  return <article className={`product-card ${quantity ? 'in-cart' : ''}`} data-testid={`card-product-${item.id}`}><div className={`product-art art-${item.id % 5}`}><img src={productImages[item.imageKey]} alt={`${item.name} ${item.packageSize}`} loading="lazy" />{item.popular && <small>Popular</small>}</div><div className="product-info"><div><span className="product-category">{item.category}</span><h3>{item.name}</h3><p>{item.packageSize}</p></div><div className="price-row"><div><strong>{money(item.communityPrice)}</strong><del>{money(item.retailPrice)}</del></div>{quantity ? <div className="quantity-control"><button onClick={() => onQuantity(quantity - 1)} data-testid={`button-product-decrease-${item.id}`}><Minus size={13} /></button><span>{quantity}</span><button onClick={() => onQuantity(quantity + 1)} data-testid={`button-product-increase-${item.id}`}><Plus size={13} /></button></div> : <button className="add-button" onClick={() => onQuantity(1)} data-testid={`button-add-product-${item.id}`}><Plus size={16} /></button>}</div></div></article>;
}

function OrdersPage() {
  const orders = useListOrders({ status: undefined }, { query: { queryKey: getListOrdersQueryKey(), refetchInterval: 30_000 } });
  const updateStatus = useUpdateOrderStatus();
  const [filter, setFilter] = useState('all');
  const [confirmingOrder, setConfirmingOrder] = useState<Order | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  
  const dummyOrders: Order[] = [
    { id: 1, reference: "CWH-1001", clientName: "Thabo Mokoena", clientPhone: "+27821234567", hubName: "Elsies River Hub", address: "45 Avon Street, Elsies River", orderSource: "WEB_APP", status: "HUB_CONFIRMED", paymentMethod: "PAYMERCH", paymentStatus: "PAID", totalAmount: 89.97, itemCount: 3, createdAt: new Date().toISOString(), lines: [{ itemName: "Long Grain Rice", packageSize: "1kg", quantity: 2, unitPrice: 21.99 }, { itemName: "Cooking Oil", packageSize: "750ml", quantity: 1, unitPrice: 29.99 }] },
    { id: 2, reference: "CWH-1002", clientName: "Sarah Nkosi", clientPhone: "+27829876543", hubName: "Elsies River Hub", address: "12 Pine Road, Elsies River", orderSource: "whatsapp", status: "PENDING", paymentMethod: "PAYSHAP", paymentStatus: "PAID", totalAmount: 54.48, itemCount: 2, createdAt: new Date(Date.now() - 3600000).toISOString(), lines: [{ itemName: "Maize Meal", packageSize: "2.5kg", quantity: 1, unitPrice: 38.5 }, { itemName: "Sugar", packageSize: "1kg", quantity: 1, unitPrice: 18.5 }] },
    { id: 3, reference: "CWH-1003", clientName: "John Dlamini", clientPhone: "+27823456789", hubName: "Elsies River Hub", address: "78 Oak Street, Elsies River", orderSource: "WEB_APP", status: "WAREHOUSE_PICKED", paymentMethod: "PAYMERCH", paymentStatus: "PAID", totalAmount: 125.50, itemCount: 4, createdAt: new Date(Date.now() - 7200000).toISOString(), lines: [{ itemName: "Rice", packageSize: "1kg", quantity: 2, unitPrice: 21.99 }, { itemName: "Bread", packageSize: "700g", quantity: 2, unitPrice: 14.99 }] },
  ];
  
  const statuses = ['all', 'pending', 'ready', 'hub_confirmed', 'warehouse_picked', 'agent_picked', 'delivered'];
  const safeOrders = Array.isArray(orders.data) && orders.data.length > 0 ? orders.data : dummyOrders;
  const rows = safeOrders.filter((order) => filter === 'all' || order.status.toLowerCase() === filter);
  
  const moveOrder = (order: Order) => {
    const sequence = ['pending', 'ready', 'hub_confirmed', 'warehouse_picked', 'agent_picked', 'delivered'];
    const next = sequence[Math.min(sequence.indexOf(order.status.toLowerCase()) + 1, sequence.length - 1)] ?? 'ready';
    updateStatus.mutate({ orderId: order.id, data: { status: next } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }) });
  };
  
  const handleConfirmOrder = async (order: Order) => {
    setConfirmingOrder(order);
  };
  
  const confirmOrderAction = async () => {
    if (!confirmingOrder) return;
    
    setConfirmLoading(true);
    setErrorMessage(null);
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const url = apiUrl ? `${apiUrl}/api/orders/${confirmingOrder.id}/confirm` : `/api/orders/${confirmingOrder.id}/confirm`;
      
      const response = await fetch(url, {
        method: 'POST',
        credentials: apiUrl ? 'include' : 'include',
        headers: { 'content-type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error('Failed to confirm order');
      }
      
      setSuccessMessage(`Order ${confirmingOrder.reference} confirmed and warehouse notified`);
      setConfirmingOrder(null);
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      setErrorMessage('Failed to confirm order. Please try again.');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setConfirmLoading(false);
    }
  };
  
  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'pending') return 'amber';
    if (s === 'ready') return 'blue';
    if (s === 'hub_confirmed') return 'green';
    if (s === 'warehouse_picked') return 'purple';
    if (s === 'agent_picked') return 'cyan';
    if (s === 'delivered') return 'green';
    return 'gray';
  };
  
  const getStatusLabel = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'pending') return 'Pending';
    if (s === 'ready') return 'Ready';
    if (s === 'hub_confirmed') return 'Hub Confirmed';
    if (s === 'warehouse_picked') return 'Warehouse Picked';
    if (s === 'agent_picked') return 'Agent Picked';
    if (s === 'delivered') return 'Delivered';
    return status;
  };
  
  const getOrderTimeline = (order: Order) => {
    const timeline = [
      { label: 'Order Created', timestamp: order.createdAt, icon: ShoppingCart, completed: true },
      { label: 'Payment Confirmed', timestamp: (order as any).paymentConfirmedAt, icon: CreditCard, completed: !!(order as any).paymentConfirmedAt },
      { label: 'Hub Confirmed', timestamp: (order as any).hubConfirmedAt, icon: CheckCircle, completed: !!(order as any).hubConfirmedAt },
      { label: 'Warehouse Notified', timestamp: (order as any).warehouseNotifiedAt, icon: Bell, completed: !!(order as any).warehouseNotifiedAt },
      { label: 'Warehouse Picked', timestamp: (order as any).warehousePickedAt, icon: Boxes, completed: !!(order as any).warehousePickedAt },
      { label: 'Agent Pickup', timestamp: (order as any).agentPickedAt, icon: Truck, completed: !!(order as any).agentPickedAt },
      { label: 'Delivered', timestamp: (order as any).deliveredAt, icon: Check, completed: !!(order as any).deliveredAt },
    ];
    return timeline;
  };
  return <AppShell role="hub" eyebrow="Hub operations · Live queue" title="Keep the line moving.">
    {successMessage && <div className="toast toast-success" data-testid="toast-success"><Check size={16} /><span>{successMessage}</span></div>}
    {errorMessage && <div className="toast toast-error" data-testid="toast-error"><AlertCircle size={16} /><span>{errorMessage}</span></div>}
    
    <div className="page-actions">
      <div className="filter-tabs">
        {statuses.map((item) => <button className={filter === item ? 'active' : ''} key={item} onClick={() => setFilter(item)} data-testid={`button-filter-${item.replaceAll(' ', '-')}`}>
          {item === 'all' ? 'All' : getStatusLabel(item)}
          <span>{item === 'all' ? (Array.isArray(orders.data) ? orders.data.length : 0) : (Array.isArray(orders.data) ? orders.data.filter((order) => order.status.toLowerCase() === item).length : 0)}</span>
        </button>)}
      </div>
      <button className="button button-secondary" onClick={() => orders.refetch()} data-testid="button-refresh-orders"><RefreshCw size={15} /> Refresh queue</button>
    </div>
    
    <div className="queue-layout">
      <Panel className="queue-panel">
        <div className="panel-head">
          <div>
            <span className="tiny-label">Today · {rows.length} orders</span>
            <h2>Fulfillment queue</h2>
          </div>
          <div className="queue-legend">
            <span><i className="dot dot-web" /> Web</span>
            <span><i className="dot dot-wa" /> WhatsApp</span>
          </div>
        </div>
        
        <QueryState loading={orders.isLoading} error={orders.isError} empty={!rows.length} onRetry={() => orders.refetch()}>
          <div className="order-table">
            <div className="order-table-head">
              <span>Order</span>
              <span>Client & address</span>
              <span>Items</span>
              <span>Amount</span>
              <span>Status</span>
              <span />
            </div>
            
            {rows.map((order) => <div className="order-row" key={order.id} data-testid={`row-order-${order.id}`}>
              <div>
                <b>{order.reference}</b>
                <small><i className={`dot ${order.orderSource === 'whatsapp' ? 'dot-wa' : 'dot-web'}`} /> {order.orderSource} · {shortDate(order.createdAt)}</small>
              </div>
              <div>
                <b>{order.clientName}</b>
                <small>{order.address}</small>
                {(order as any).clientPhone && <small className="phone-display"><Phone size={12} /> {(order as any).clientPhone}</small>}
              </div>
              <div>
                <b>{order.itemCount} items</b>
                <small>{order.lines.slice(0, 2).map((line) => line.itemName).join(', ')}</small>
              </div>
              <div>
                <b>{money(order.totalAmount)}</b>
                <small>{order.hubName}</small>
              </div>
              <div>
                <span className={`status-badge ${getStatusColor(order.status)}`} data-testid={`status-${order.status.toLowerCase()}`}>
                  {getStatusLabel(order.status)}
                </span>
                {order.status.toLowerCase() === 'hub_confirmed' && <span className="warehouse-badge" data-testid="warehouse-notified-badge"><Bell size={10} /> Warehouse Notified</span>}
              </div>
              <div className="order-actions">
                {order.status.toLowerCase() === 'ready' && (
                  <button className="button button-primary button-small" onClick={() => handleConfirmOrder(order)} data-testid={`button-confirm-order-${order.id}`}>
                    <Check size={14} /> Confirm
                  </button>
                )}
                <button className="icon-button" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)} data-testid={`button-expand-order-${order.id}`}>
                  {expandedOrder === order.id ? <ChevronDown size={16} /> : <ArrowDownRight size={16} />}
                </button>
              </div>
            </div>)}
          </div>
        </QueryState>
      </Panel>
    </div>
    
    {confirmingOrder && <div className="modal-backdrop" data-testid="confirm-modal">
      <div className="modal confirm-modal">
        <div className="modal-head">
          <div>
            <span className="tiny-label">Confirm Order</span>
            <h3>Ready to notify warehouse?</h3>
          </div>
          <button className="icon-button" onClick={() => setConfirmingOrder(null)} data-testid="button-close-confirm-modal"><X size={18} /></button>
        </div>
        
        <div className="confirm-details">
          <div className="confirm-detail-row">
            <span className="detail-label">Order Reference</span>
            <strong>{confirmingOrder.reference}</strong>
          </div>
          <div className="confirm-detail-row">
            <span className="detail-label">Client</span>
            <strong>{confirmingOrder.clientName}</strong>
          </div>
          <div className="confirm-detail-row">
            <span className="detail-label">Address</span>
            <strong>{confirmingOrder.address}</strong>
          </div>
          <div className="confirm-detail-row">
            <span className="detail-label">Phone</span>
            <strong>{(confirmingOrder as any).clientPhone || 'N/A'}</strong>
          </div>
          <div className="confirm-detail-row">
            <span className="detail-label">Total Amount</span>
            <strong>{money(confirmingOrder.totalAmount)}</strong>
          </div>
          
          <div className="confirm-items">
            <span className="detail-label">Items</span>
            <div className="confirm-items-list">
              {confirmingOrder.lines.map((line, idx) => <div key={idx} className="confirm-item">
                <span>{line.itemName} ({line.packageSize})</span>
                <strong>×{line.quantity}</strong>
              </div>)}
            </div>
          </div>
        </div>
        
        <div className="modal-actions">
          <button className="button button-secondary" onClick={() => setConfirmingOrder(null)} disabled={confirmLoading}>Cancel</button>
          <button className="button button-primary" onClick={confirmOrderAction} disabled={confirmLoading} data-testid="button-confirm-action">
            {confirmLoading ? 'Confirming...' : 'Confirm & Notify Warehouse'}
          </button>
        </div>
      </div>
    </div>}
    
    {expandedOrder && <div className="order-detail-panel" data-testid={`order-detail-${expandedOrder}`}>
      {(() => {
        const order = safeOrders.find(o => o.id === expandedOrder);
        if (!order) return null;
        
        const timeline = getOrderTimeline(order);
        
        return <div className="order-detail-content">
          <div className="detail-header">
            <div>
              <span className="tiny-label">Order Details</span>
              <h3>{order.reference}</h3>
            </div>
            <button className="icon-button" onClick={() => setExpandedOrder(null)}><X size={18} /></button>
          </div>
          
          <div className="detail-section">
            <h4>Order Timeline</h4>
            <div className="timeline">
              {timeline.map((step, idx) => {
                const Icon = step.icon;
                return <div key={idx} className={`timeline-step ${step.completed ? 'completed' : 'pending'}`}>
                  <div className="timeline-icon">{step.completed ? <Icon size={16} /> : <Clock3 size={16} />}</div>
                  <div className="timeline-content">
                    <span className="timeline-label">{step.label}</span>
                    {step.timestamp && <span className="timeline-time">{shortDate(step.timestamp)}</span>}
                  </div>
                </div>;
              })}
            </div>
          </div>
          
          <div className="detail-section">
            <h4>Order Items</h4>
            <div className="detail-items">
              {order.lines.map((line, idx) => <div key={idx} className="detail-item">
                <span>{line.itemName} ({line.packageSize})</span>
                <div>
                  <strong>×{line.quantity}</strong>
                  <small>{money(line.unitPrice * line.quantity)}</small>
                </div>
              </div>)}
            </div>
          </div>
          
          <div className="detail-section">
            <h4>Delivery Information</h4>
            <div className="detail-info">
              <div><span className="info-label">Client</span><strong>{order.clientName}</strong></div>
              <div><span className="info-label">Address</span><strong>{order.address}</strong></div>
              {(order as any).clientPhone && <div><span className="info-label">Phone</span><strong>{(order as any).clientPhone}</strong></div>}
              <div><span className="info-label">Hub</span><strong>{order.hubName}</strong></div>
            </div>
          </div>
        </div>;
      })()}
    </div>}
  </AppShell>;
}

function DeliveriesPage() {
  const deliveries = useListDeliveries({ query: { queryKey: getListDeliveriesQueryKey(), refetchInterval: 30_000 } });
  const orders = useListOrders({ status: undefined }, { query: { queryKey: getListOrdersQueryKey(), refetchInterval: 30_000 } });
  const updateDelivery = useUpdateDeliveryStatus();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // State for new delivery agent dashboard
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [activeDelivery, setActiveDelivery] = useState<Delivery | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<'warehouse_pickup' | 'en_route' | 'near_destination' | 'delivered'>('warehouse_pickup');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [notification, setNotification] = useState<{ message: string; visible: boolean } | null>(null);
  
  const dummyDeliveries: Delivery[] = [
    { id: 1, orderReference: "CWH-1001", agentId: 1, agentName: "Agent Mike", status: "DELIVERED", dropoff: "45 Avon Street, Elsies River", eta: "10:30 AM", distance: "2.3 km" },
    { id: 2, orderReference: "CWH-1002", agentId: 1, agentName: "Agent Mike", status: "EN_ROUTE", dropoff: "12 Pine Road, Elsies River", eta: "11:15 AM", distance: "3.1 km" },
  ];
  
  const dummyOrders: Order[] = [
    { id: 1, reference: "CWH-1001", clientName: "Thabo Mokoena", clientPhone: "+27821234567", hubName: "Elsies River Hub", address: "45 Avon Street, Elsies River", orderSource: "WEB_APP", status: "WAREHOUSE_PICKED", paymentMethod: "PAYMERCH", paymentStatus: "PAID", totalAmount: 89.97, itemCount: 3, createdAt: new Date().toISOString(), lines: [{ itemName: "Long Grain Rice", packageSize: "1kg", quantity: 2, unitPrice: 21.99 }, { itemName: "Cooking Oil", packageSize: "750ml", quantity: 1, unitPrice: 29.99 }] },
    { id: 2, reference: "CWH-1002", clientName: "Sarah Nkosi", clientPhone: "+27829876543", hubName: "Elsies River Hub", address: "12 Pine Road, Elsies River", orderSource: "whatsapp", status: "WAREHOUSE_PICKED", paymentMethod: "PAYSHAP", paymentStatus: "PAID", totalAmount: 54.48, itemCount: 2, createdAt: new Date(Date.now() - 3600000).toISOString(), lines: [{ itemName: "Maize Meal", packageSize: "2.5kg", quantity: 1, unitPrice: 38.5 }, { itemName: "Sugar", packageSize: "1kg", quantity: 1, unitPrice: 18.5 }] },
  ];
  
  const activeDeliveries = Array.isArray(deliveries.data) && deliveries.data.length > 0 ? deliveries.data : dummyDeliveries;
  const allOrders = Array.isArray(orders.data) && orders.data.length > 0 ? orders.data : dummyOrders;
  
  // Filter orders ready for pickup (WAREHOUSE_PICKED status)
  const availableOrders = allOrders.filter(order => order.status === 'WAREHOUSE_PICKED');
  
  // Filter orders assigned to current agent (AGENT_PICKED status)
  const myDeliveries = allOrders.filter(order => order.status === 'AGENT_PICKED');
  
  // Completed deliveries
  const completedDeliveries = activeDeliveries.filter(d => d.status.toLowerCase() === 'delivered');
  
  // Get current GPS location
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
          setToast({ message: 'Could not get location. Please enable GPS.', type: 'error' });
        }
      );
    }
  };
  
  // Start location tracking during delivery
  useEffect(() => {
    let trackingInterval: NodeJS.Timeout;
    
    if (trackingActive && activeDelivery) {
      trackingInterval = setInterval(() => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              };
              setCurrentLocation(location);
              
              // Send tracking update to API
              const apiUrl = import.meta.env.VITE_API_URL || '';
              if (apiUrl) {
                fetch(`${apiUrl}/api/orders/${activeDelivery.id}/tracking`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    latitude: location.lat,
                    longitude: location.lng,
                    status: deliveryStatus
                  })
                }).catch(err => console.error('Tracking update failed:', err));
              }
            },
            (error) => console.error('Tracking error:', error)
          );
        }
      }, 30000); // Update every 30 seconds
    }
    
    return () => {
      if (trackingInterval) clearInterval(trackingInterval);
    };
  }, [trackingActive, activeDelivery, deliveryStatus]);
  
  // Show notification when new orders become available
  useEffect(() => {
    if (availableOrders.length > 0 && !notification?.visible) {
      setNotification({
        message: `${availableOrders.length} new order${availableOrders.length > 1 ? 's' : ''} ready for pickup`,
        visible: true
      });
      
      setTimeout(() => {
        setNotification(null);
      }, 5000);
    }
  }, [availableOrders.length]);
  
  // Pick up order from warehouse
  const handlePickupOrder = async (order: Order) => {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    
    try {
      if (apiUrl) {
        const response = await fetch(`${apiUrl}/api/orders/${order.id}/pickup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          setToast({ message: 'Order picked up successfully!', type: 'success' });
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        } else {
          throw new Error('Pickup failed');
        }
      } else {
        // Demo mode - simulate pickup
        setToast({ message: 'Order picked up successfully!', type: 'success' });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      }
    } catch (error) {
      setToast({ message: 'Failed to pick up order. Please try again.', type: 'error' });
    }
  };
  
  // Start delivery
  const handleStartDelivery = (order: Order) => {
    const delivery = activeDeliveries.find(d => d.orderReference === order.reference);
    if (delivery) {
      setActiveDelivery(delivery);
      setDeliveryStatus('en_route');
      setTrackingActive(true);
      getCurrentLocation();
      setToast({ message: 'Delivery started. Tracking active.', type: 'success' });
    }
  };
  
  // Mark order as delivered
  const handleMarkDelivered = async (order: Order) => {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    
    try {
      if (apiUrl) {
        const response = await fetch(`${apiUrl}/api/orders/${order.id}/deliver`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: currentLocation?.lat || 0,
            longitude: currentLocation?.lng || 0
          })
        });
        
        if (response.ok) {
          setDeliveryStatus('delivered');
          setTrackingActive(false);
          setActiveDelivery(null);
          setToast({ message: 'Order delivered successfully!', type: 'success' });
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
        } else {
          throw new Error('Delivery update failed');
        }
      } else {
        // Demo mode - simulate delivery
        setDeliveryStatus('delivered');
        setTrackingActive(false);
        setActiveDelivery(null);
        setToast({ message: 'Order delivered successfully!', type: 'success' });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      }
    } catch (error) {
      setToast({ message: 'Failed to mark as delivered. Please try again.', type: 'error' });
    }
  };
  
  // Calculate earnings (placeholder)
  const earnings = completedDeliveries.length * 25; // R25 per delivery
  
  return (
    <AppShell role="agent" eyebrow="Delivery desk · Elsies River" title="Your route, at a glance.">
      {/* Notification Toast */}
      {notification && (
        <div className="notification-toast" data-testid="notification-toast">
          <Bell size={16} />
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)}><X size={14} /></button>
        </div>
      )}
      
      {/* Toast Message */}
      {toast && (
        <div className={`toast-message toast-${toast.type}`} data-testid="toast-message">
          {toast.type === 'success' && <CheckCircle size={16} />}
          {toast.type === 'error' && <AlertCircle size={16} />}
          {toast.type === 'info' && <Bell size={16} />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}
      
      {/* Summary Cards */}
      <div className="metric-grid">
        <Metric 
          label="Available Orders" 
          value={String(availableOrders.length)} 
          note="Ready for pickup" 
          icon={Package} 
          accent="sun" 
        />
        <Metric 
          label="In Progress" 
          value={String(myDeliveries.length)} 
          note="Active deliveries" 
          icon={Bike} 
          accent="mint" 
        />
        <Metric 
          label="Completed Today" 
          value={String(completedDeliveries.length)} 
          note="Deliveries finished" 
          icon={CheckCircle} 
          accent="coral" 
        />
        <Metric 
          label="Earnings" 
          value={money(earnings)} 
          note="Today's total" 
          icon={WalletCards} 
          accent="blue" 
        />
      </div>
      
      {/* Main Delivery Dashboard Layout */}
      <div className="delivery-dashboard-layout">
        {/* Left Panel: Available Orders */}
        <Panel className="available-orders-panel">
          <div className="panel-head">
            <div>
              <span className="tiny-label">Warehouse Queue</span>
              <h2>Available Orders</h2>
            </div>
            <button 
              className="button button-secondary" 
              onClick={() => orders.refetch()}
              data-testid="button-refresh-orders"
            >
              <RefreshCw size={15} /> Refresh
            </button>
          </div>
          
          <div className="warehouse-info">
            <MapPin size={16} />
            <span>Warehouse: Elsies River Hub, 14th Avenue</span>
          </div>
          
          <QueryState 
            loading={orders.isLoading} 
            error={orders.isError} 
            empty={!availableOrders.length} 
            onRetry={() => orders.refetch()}
          >
            <div className="available-orders-list">
              {availableOrders.map((order) => (
                <article className="order-card" key={order.id} data-testid={`card-order-${order.id}`}>
                  <div className="order-card-head">
                    <div>
                      <span className="tiny-label">{order.reference}</span>
                      <h3>{order.clientName}</h3>
                    </div>
                    <StatusPill status={order.status} />
                  </div>
                  
                  <div className="order-details">
                    <div>
                      <small>Address</small>
                      <b>{order.address}</b>
                    </div>
                    <div>
                      <small>Items</small>
                      <b>{order.itemCount}</b>
                    </div>
                    <div>
                      <small>Total</small>
                      <b>{money(order.totalAmount)}</b>
                    </div>
                  </div>
                  
                  <div className="order-pickup-info">
                    <Clock3 size={14} />
                    <span>Est. pickup: 15 min</span>
                  </div>
                  
                  <button 
                    className="button button-primary button-wide"
                    onClick={() => handlePickupOrder(order)}
                    data-testid={`button-pickup-${order.id}`}
                  >
                    <Package size={15} /> Pick Up
                  </button>
                </article>
              ))}
            </div>
          </QueryState>
        </Panel>
        
        {/* Right Panel: Active Delivery with Tracking */}
        <Panel className="active-delivery-panel">
          <div className="panel-head">
            <div>
              <span className="tiny-label">Current Delivery</span>
              <h2>My Deliveries</h2>
            </div>
            {trackingActive && (
              <div className="tracking-indicator" data-testid="tracking-indicator">
                <span className="live-pulse" />
                <span>Tracking Active</span>
              </div>
            )}
          </div>
          
          {activeDelivery ? (
            <div className="active-delivery-content">
              {/* Delivery Status Timeline */}
              <div className="delivery-timeline">
                <div className={`timeline-step ${deliveryStatus === 'warehouse_pickup' || deliveryStatus === 'en_route' || deliveryStatus === 'near_destination' || deliveryStatus === 'delivered' ? 'completed' : ''}`}>
                  <div className="timeline-dot"><Check size={12} /></div>
                  <span>Warehouse Pickup</span>
                </div>
                <div className="timeline-line" />
                <div className={`timeline-step ${deliveryStatus === 'en_route' || deliveryStatus === 'near_destination' || deliveryStatus === 'delivered' ? 'completed' : ''} ${deliveryStatus === 'en_route' ? 'active' : ''}`}>
                  <div className="timeline-dot"><Navigation size={12} /></div>
                  <span>En Route</span>
                </div>
                <div className="timeline-line" />
                <div className={`timeline-step ${deliveryStatus === 'near_destination' || deliveryStatus === 'delivered' ? 'completed' : ''} ${deliveryStatus === 'near_destination' ? 'active' : ''}`}>
                  <div className="timeline-dot"><MapPin size={12} /></div>
                  <span>Near Destination</span>
                </div>
                <div className="timeline-line" />
                <div className={`timeline-step ${deliveryStatus === 'delivered' ? 'completed' : ''} ${deliveryStatus === 'delivered' ? 'active' : ''}`}>
                  <div className="timeline-dot"><CheckCircle size={12} /></div>
                  <span>Delivered</span>
                </div>
              </div>
              
              {/* Current Location Display */}
              {currentLocation && (
                <div className="location-display" data-testid="location-display">
                  <MapPin size={16} />
                  <span>
                    {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                  </span>
                </div>
              )}
              
              {/* Delivery Details */}
              <div className="delivery-details-card">
                <div className="delivery-details-head">
                  <div>
                    <span className="tiny-label">{activeDelivery.orderReference}</span>
                    <h3>{activeDelivery.dropoff}</h3>
                  </div>
                  <StatusPill status={activeDelivery.status} />
                </div>
                
                <div className="delivery-route-info">
                  <div>
                    <small>Pickup</small>
                    <b>{activeDelivery.pickup}</b>
                  </div>
                  <ArrowRight size={15} />
                  <div>
                    <small>Drop-off</small>
                    <b>{activeDelivery.dropoff}</b>
                  </div>
                </div>
                
                {/* Map Placeholder */}
                <div className="map-placeholder" data-testid="map-placeholder">
                  <MapPin size={32} />
                  <span>Map View</span>
                  <small>Route visualization</small>
                </div>
                
                {/* ETA and Distance */}
                <div className="delivery-metrics">
                  <div>
                    <Clock3 size={14} />
                    <span>ETA: {activeDelivery.eta}</span>
                  </div>
                  <div>
                    <Navigation size={14} />
                    <span>Distance: 2.4 km</span>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="delivery-actions">
                  {deliveryStatus === 'warehouse_pickup' && (
                    <button 
                      className="button button-primary button-wide"
                      onClick={() => {
                        setDeliveryStatus('en_route');
                        getCurrentLocation();
                      }}
                      data-testid="button-start-delivery"
                    >
                      <Navigation size={15} /> Start Delivery
                    </button>
                  )}
                  
                  {deliveryStatus === 'en_route' && (
                    <button 
                      className="button button-primary button-wide"
                      onClick={() => setDeliveryStatus('near_destination')}
                      data-testid="button-near-destination"
                    >
                      <MapPin size={15} /> Near Destination
                    </button>
                  )}
                  
                  {deliveryStatus === 'near_destination' && (
                    <button 
                      className="button button-primary button-wide"
                      onClick={() => {
                        const order = allOrders.find(o => o.reference === activeDelivery.orderReference);
                        if (order) handleMarkDelivered(order);
                      }}
                      data-testid="button-mark-delivered"
                    >
                      <CheckCircle size={15} /> Mark Delivered
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <Bike size={26} />
              <strong>No active delivery</strong>
              <span>Pick up an order from the warehouse to start your route.</span>
            </div>
          )}
          
          {/* My Deliveries List (when no active delivery) */}
          {!activeDelivery && myDeliveries.length > 0 && (
            <div className="my-deliveries-list">
              <h3>Assigned Orders</h3>
              {myDeliveries.map((order) => (
                <article className="order-card" key={order.id} data-testid={`card-my-order-${order.id}`}>
                  <div className="order-card-head">
                    <div>
                      <span className="tiny-label">{order.reference}</span>
                      <h3>{order.clientName}</h3>
                    </div>
                    <StatusPill status={order.status} />
                  </div>
                  
                  <div className="order-details">
                    <div>
                      <small>Address</small>
                      <b>{order.address}</b>
                    </div>
                    <div>
                      <small>Items</small>
                      <b>{order.itemCount}</b>
                    </div>
                  </div>
                  
                  <button 
                    className="button button-primary button-wide"
                    onClick={() => handleStartDelivery(order)}
                    data-testid={`button-start-delivery-${order.id}`}
                  >
                    <Navigation size={15} /> Start Delivery
                  </button>
                </article>
              ))}
            </div>
          )}
        </Panel>
      </div>
      
      {/* Bottom Panel: Completed Deliveries History */}
      <Panel className="completed-deliveries-panel">
        <div className="panel-head">
          <div>
            <span className="tiny-label">Delivery History</span>
            <h2>Completed Deliveries</h2>
          </div>
        </div>
        
        {completedDeliveries.length > 0 ? (
          <div className="completed-deliveries-list">
            {completedDeliveries.map((delivery) => (
              <article className="completed-delivery-card" key={delivery.id} data-testid={`card-completed-${delivery.id}`}>
                <div className="completed-delivery-head">
                  <div>
                    <span className="tiny-label">{delivery.orderReference}</span>
                    <h3>{delivery.dropoff}</h3>
                  </div>
                  <StatusPill status={delivery.status} />
                </div>
                
                <div className="completed-delivery-details">
                  <div>
                    <small>Delivered at</small>
                    <b>{delivery.eta}</b>
                  </div>
                  <div>
                    <small>Client Rating</small>
                    <b>⭐⭐⭐⭐⭐</b>
                  </div>
                </div>
                
                <button 
                  className="button button-secondary"
                  data-testid={`button-view-details-${delivery.id}`}
                >
                  View Details
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <CheckCircle size={26} />
            <strong>No completed deliveries today</strong>
            <span>Completed deliveries will appear here.</span>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}

function DeliveryCard({ delivery, index, onConfirm, pending }: { delivery: Delivery; index: number; onConfirm: () => void; pending: boolean }) {
  const complete = delivery.status.toLowerCase() === 'delivered';
  return <article className={`delivery-card ${complete ? 'complete' : ''}`} data-testid={`card-delivery-${delivery.id}`}><div className="delivery-index">{String(index + 1).padStart(2, '0')}</div><div className="delivery-main"><div className="delivery-card-head"><div><span className="tiny-label">{delivery.orderReference}</span><h3>{delivery.dropoff}</h3></div><StatusPill status={delivery.status} /></div><div className="delivery-route"><div><small>Pickup</small><b>{delivery.pickup}</b></div><ArrowRight size={15} /><div><small>Drop-off</small><b>{delivery.dropoff}</b></div></div><div className="delivery-card-foot"><span><Clock3 size={14} /> ETA {delivery.eta}</span><span className="agent-name"><span className="avatar small">{delivery.agentInitials}</span>{delivery.agentName}</span><button className={`button ${complete ? 'button-complete' : 'button-primary'}`} onClick={onConfirm} disabled={complete || pending} data-testid={`button-confirm-delivery-${delivery.id}`}>{complete ? <><Check size={15} /> Delivered</> : <>{delivery.status.toLowerCase().includes('pickup') ? 'Confirm pickup' : 'Confirm drop-off'} <ArrowRight size={15} /></>}</button></div></div></article>;
}

function CommandPage() {
  const dashboard = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey(), refetchInterval: 60_000 } });
  const hubs = useListHubs({ query: { queryKey: getListHubsQueryKey(), refetchInterval: 60_000 } });
  const catalog = useListCatalog({ query: { queryKey: getListCatalogQueryKey(), refetchInterval: 60_000 } });
  const pricing = useGetPricing({ query: { queryKey: getGetPricingQueryKey(), staleTime: 60_000 } });
  const orders = useListOrders({ status: undefined }, { query: { queryKey: getListOrdersQueryKey(), refetchInterval: 30_000 } });
  const data = dashboard.data;
  const activeOrders = Array.isArray(orders.data) ? orders.data.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED') : [];
  
  return (
    <AppShell role="super" eyebrow="Super admin · Network intelligence" title="The whole picture, clearly.">
      <QueryState loading={dashboard.isLoading} error={dashboard.isError} onRetry={() => dashboard.refetch()}>
        <div className="command-intro">
          <div>
            <span className="eyebrow"><span className="eyebrow-line" /> Network intelligence center</span>
            <h2>Good morning, <i>builders.</i></h2>
            <p>Here is how local circulation is holding up across the network.</p>
          </div>
          <div className="command-actions">
            <button className="button button-secondary" onClick={() => { dashboard.refetch(); hubs.refetch(); pricing.refetch(); orders.refetch(); if (catalog.refetch) catalog.refetch(); }} data-testid="button-refresh-command"><RefreshCw size={15} /> Sync data</button>
            <Link href="/pricing" className="button button-primary" data-testid="link-command-pricing"><SlidersHorizontal size={15} /> Adjust pricing</Link>
          </div>
        </div>
        {data && (
          <>
            <div className="metric-grid">
              <Metric label="Orders this month" value={data.totalOrders?.toLocaleString() ?? '0'} note="+12.4% vs last month" icon={ShoppingBasket} accent="sun" />
              <Metric label="Active orders" value={String(activeOrders.length).padStart(2, '0')} note="In progress" icon={Package} accent="mint" />
              <Metric label="Local savings" value={money(data.localSavings)} note="Passed to households" icon={WalletCards} accent="coral" />
              <Metric label="Currency retained" value={money(data.retainedCurrency)} note="Circulating in the network" icon={LineChart} accent="blue" />
            </div>
            <div className="command-grid">
              <Panel className="trend-panel">
                <div className="panel-head"><div><span className="tiny-label">Network pulse</span><h3>Orders & value retained</h3></div><span className="panel-period">Last 7 weeks <ChevronDown size={14} /></span></div>
                <TrendChart points={data.orderTrend} />
              </Panel>
              <Panel className="hubs-panel">
                <div className="panel-head"><div><span className="tiny-label">Operational health</span><h3>Community hubs</h3></div><Link href="/zones" className="text-link">View coverage <ArrowRight size={14} /></Link></div>
                <div className="hub-list">{(Array.isArray(hubs.data) ? hubs.data : []).map((hub) => <HubRow key={hub.id} hub={hub} />)}</div>
              </Panel>
              <Panel className="forecast-panel">
                <div className="panel-head"><div><span className="tiny-label">Demand signal</span><h3>Stock to watch</h3></div><BarChart3 size={17} /></div>
                <div className="forecast-list">{data.demandForecast.map((item) => <div className="forecast-row" key={item.item}><div><b>{item.item}</b><small>{item.confidence}% confidence · {item.trend}</small></div><div className={`forecast-days ${item.daysRemaining < 5 ? 'urgent' : ''}`}><strong>{item.daysRemaining}</strong><small>days</small></div></div>)}</div>
              </Panel>
              <Panel className="activity-panel">
                <div className="panel-head"><div><span className="tiny-label">Live ledger</span><h3>Recent activity</h3></div><Activity size={17} /></div>
                <div className="activity-list">{data.recentActivity.map((item) => <div className="activity-row" key={item.id}><span className={`activity-dot ${statusTone(item.tone)}`} /><div><b>{item.title}</b><small>{item.detail}</small></div><time>{item.timestamp}</time></div>)}</div>
              </Panel>
            </div>
            {/* Real-time Order Tracking Panel */}
            <Panel className="order-tracking-panel">
              <div className="panel-head">
                <div>
                  <span className="tiny-label">Real-time operations</span>
                  <h3>Live order tracking</h3>
                </div>
                <span className="live-indicator"><span className="live-pulse" /> Live</span>
              </div>
              <div className="order-tracking-grid">
                <div className="tracking-stats">
                  <div className="tracking-stat">
                    <span className="stat-label">Pending Payment</span>
                    <strong className="stat-value">{activeOrders.filter(o => o.status === 'PENDING').length}</strong>
                  </div>
                  <div className="tracking-stat">
                    <span className="stat-label">Hub Confirmed</span>
                    <strong className="stat-value">{activeOrders.filter(o => o.status === 'HUB_CONFIRMED').length}</strong>
                  </div>
                  <div className="tracking-stat">
                    <span className="stat-label">Warehouse Processing</span>
                    <strong className="stat-value">{activeOrders.filter(o => o.status === 'WAREHOUSE_PICKED').length}</strong>
                  </div>
                  <div className="tracking-stat">
                    <span className="stat-label">In Delivery</span>
                    <strong className="stat-value">{activeOrders.filter(o => o.status === 'AGENT_PICKED').length}</strong>
                  </div>
                </div>
                <div className="tracking-timeline">
                  <h4>Order Flow</h4>
                  <div className="flow-steps">
                    <div className="flow-step">
                      <span className="step-icon"><Package size={16} /></span>
                      <div>
                        <strong>Order Created</strong>
                        <small>Client places order</small>
                      </div>
                    </div>
                    <div className="flow-arrow"><ArrowRight size={14} /></div>
                    <div className="flow-step">
                      <span className="step-icon"><CheckCircle size={16} /></span>
                      <div>
                        <strong>Hub Confirmed</strong>
                        <small>Payment verified</small>
                      </div>
                    </div>
                    <div className="flow-arrow"><ArrowRight size={14} /></div>
                    <div className="flow-step">
                      <span className="step-icon"><Boxes size={16} /></span>
                      <div>
                        <strong>Warehouse Picked</strong>
                        <small>Items collected</small>
                      </div>
                    </div>
                    <div className="flow-arrow"><ArrowRight size={14} /></div>
                    <div className="flow-step">
                      <span className="step-icon"><Bike size={16} /></span>
                      <div>
                        <strong>Agent Pickup</strong>
                        <small>Delivery started</small>
                      </div>
                    </div>
                    <div className="flow-arrow"><ArrowRight size={14} /></div>
                    <div className="flow-step">
                      <span className="step-icon"><CheckCircle size={16} /></span>
                      <div>
                        <strong>Delivered</strong>
                        <small>Client received</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="active-orders-list">
                <h4>Active Orders ({activeOrders.length})</h4>
                {activeOrders.length === 0 ? (
                  <div className="empty-state">
                    <Package size={26} />
                    <strong>No active orders</strong>
                    <span>All orders have been completed</span>
                  </div>
                ) : (
                  <div className="active-order-rows">
                    {activeOrders.slice(0, 5).map((order) => (
                      <div key={order.id} className="active-order-row">
                        <div>
                          <b>#{order.reference}</b>
                          <small>{order.clientName} · {money(order.totalAmount)}</small>
                        </div>
                        <StatusPill status={order.status} />
                      </div>
                    ))}
                    {activeOrders.length > 5 && (
                      <div className="view-more">
                        <small>View all {activeOrders.length} active orders</small>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Panel>
            <div className="leakage-strip"><div><span className="tiny-label">The point of the network</span><h3>Less leakage. More life in the places we share.</h3></div><div className="leakage-stats"><div><small>Corporate leakage</small><strong>{money(data.corporateLeakage)}</strong></div><ArrowRight size={20} /><div><small>Service reinvestment</small><strong className="green-text">{money(data.serviceReinvestment)}</strong></div></div></div>
            <div className="admin-control-grid">
              <StockPanel items={Array.isArray(catalog.data) ? catalog.data : []} />
              <AccessPanel hubs={Array.isArray(hubs.data) ? hubs.data : []} />
            </div>
            <Panel className="insight-panel">
              <div className="panel-head"><div><span className="tiny-label">AI-assisted monitor</span><h3>Intelligence center</h3></div><Sparkles size={17} /></div>
              <div className="insight-grid">
                <div><span className="insight-badge positive">Demand</span><b>Rice demand is rising in Elsies River</b><small>Recommendation: protect 4 days of safety stock before the next order wave.</small></div>
                <div><span className="insight-badge warning">Attention</span><b>Brown Bread needs replenishment</b><small>Current forecast gives the hub 2 days of cover. Route a supplier top-up now.</small></div>
                <div><span className="insight-badge stable">Network</span><b>Local value retention is healthy</b><small>The current mix of community pricing and delivery coverage is keeping value nearby.</small></div>
              </div>
            </Panel>
          </>
        )}
      </QueryState>
    </AppShell>
  );
}

function StockPanel({ items }: { items: CatalogItem[] }) {
  // Ensure items is always an array
  const safeItems = Array.isArray(items) ? items : [];
  return <Panel className="stock-panel"><div className="panel-head"><div><span className="tiny-label">Warehouse stock</span><h3>Inventory at a glance</h3></div><Database size={17} /></div><div className="stock-list">{safeItems.map((item) => <div className="stock-row" key={item.id}><div><b>{item.name}</b><small>{item.packageSize} · R{item.communityPrice.toFixed(2)}</small></div><div className="stock-bar"><span className={item.stockQuantity < 30 ? 'low' : ''} style={{ width: `${Math.min(100, (item.stockQuantity / 150) * 100)}%` }} /></div><strong className={item.stockQuantity < 30 ? 'low-text' : ''}>{item.stockQuantity}</strong></div>)}</div></Panel>;
}

function AccessPanel({ hubs }: { hubs: Hub[] }) {
  const { user: currentUser, getUsers, createUser, deleteUser } = useAuth();
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ fullName: '', email: '', phoneNumber: '', password: '', role: 'CLIENT' as AuthRole, hubId: null as number | null });
  
  useEffect(() => {
    setUsers(getUsers());
  }, [getUsers]);
  
  const assign = async (userId: number, role: AuthRole, hubId: number | null) => { 
    setBusy(userId); 
    try { 
      // Update user in local storage
      const updatedUsers = users.map((item) => item.id === userId ? { ...item, role, hubId } : item);
      setUsers(updatedUsers);
      // In real API, this would be: const response = await fetch(`/api/auth/users/${userId}/role`, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role, hubId }) });
    } finally { 
      setBusy(null); 
    } 
  };
  
  const handleAddUser = async () => {
    if (!newUser.fullName || !newUser.email || !newUser.password) return;
    try {
      const createdUser = await createUser(newUser.fullName, newUser.email, newUser.phoneNumber, newUser.password, newUser.role);
      setUsers([...users, createdUser]);
      setShowAddUser(false);
      setNewUser({ fullName: '', email: '', phoneNumber: '', password: '', role: 'CLIENT', hubId: null });
    } catch (error) {
      console.error('Failed to create user:', error);
    }
  };
  
  const handleDeleteUser = (userId: number) => {
    deleteUser(userId);
    setUsers(users.filter(u => u.id !== userId));
  };
  
  // Ensure hubs is always an array
  const safeHubs = Array.isArray(hubs) ? hubs : [];
  
  return <Panel className="access-panel"><div className="panel-head"><div><span className="tiny-label">Resource access</span><h3>Assign the team</h3></div><Users size={17} /></div><p className="panel-helper">Community clients register themselves. Assign Hub Admin, Delivery Agent, and Warehouse Manager access here.</p><button className="button button-secondary button-wide" onClick={() => setShowAddUser(true)}><Plus size={15} /> Add new user</button>{showAddUser && <div className="add-user-form"><input value={newUser.fullName} onChange={(e) => setNewUser({...newUser, fullName: e.target.value})} placeholder="Full name" /><input value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} placeholder="Email" /><input value={newUser.phoneNumber} onChange={(e) => setNewUser({...newUser, phoneNumber: e.target.value})} placeholder="Phone number" /><input value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} placeholder="Password" type="password" /><select value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value as AuthRole})}><option value="CLIENT">Community Client</option><option value="HUB_ADMIN">Hub Admin</option><option value="DELIVERY_AGENT">Delivery Agent</option><option value="WAREHOUSE_MANAGER">Warehouse Manager</option><option value="SUPER_ADMIN">Super Admin</option></select><div className="form-actions"><button className="button button-primary" onClick={handleAddUser}>Create User</button><button className="button button-secondary" onClick={() => setShowAddUser(false)}>Cancel</button></div></div>}<div className="access-list">{users.map((item) => <div className="access-row" key={item.id}><div><b>{item.fullName}</b><small>{item.email}</small></div><select disabled={busy === item.id || item.id === currentUser?.id} value={item.role} onChange={(event) => void assign(item.id, event.target.value as AuthRole, item.hubId)}><option value="CLIENT">Community Client</option><option value="HUB_ADMIN">Hub Admin</option><option value="DELIVERY_AGENT">Delivery Agent</option><option value="WAREHOUSE_MANAGER">Warehouse Manager</option><option value="SUPER_ADMIN">Super Admin</option></select><select disabled={busy === item.id || item.id === currentUser?.id} value={item.hubId ?? ''} onChange={(event) => void assign(item.id, item.role, event.target.value ? Number(event.target.value) : null)}><option value="">All hubs</option>{safeHubs.map((hub) => <option key={hub.id} value={hub.id}>{hub.name}</option>)}</select><button className="icon-button" onClick={() => handleDeleteUser(item.id)} disabled={item.id === currentUser?.id}><Trash size={14} /></button></div>)}</div></Panel>;
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
  
  // Use dummy data if API is not available
  const dummyZones = [
    { id: 1, name: "Elsies River Ward 28", municipality: "City of Cape Town", hubName: "Elsies River Hub", households: 1240, status: "LIVE" },
    { id: 2, name: "Elsies River Ward 29", municipality: "City of Cape Town", hubName: "Elsies River Hub", households: 980, status: "LIVE" },
    { id: 3, name: "Goodwood Ward 55", municipality: "City of Cape Town", hubName: "Elsies River Hub", households: 760, status: "READY" },
  ];
  
  const rows = Array.isArray(zones.data) && zones.data.length > 0 ? zones.data : dummyZones;
  const selectedZone = rows.find((zone) => zone.id === selected) ?? rows[0];
  
  // Show Ward 28 map when selected
  const showWard28Map = selectedZone?.name.includes("Ward 28");
  
  // Ward 28 specific map visualization - removed for stability
  return <AppShell role="super" eyebrow="Network · Ward coverage" title="Know where the work lands."><div className="zones-intro"><div><span className="eyebrow"><span className="eyebrow-line" /> Western Cape map room</span><h2>Coverage is a <i>relationship.</i></h2><p>Track household reach by ward and keep each local hub resourced for the work ahead.</p></div><div className="coverage-total"><strong>{rows.reduce((sum, zone) => sum + zone.households, 0).toLocaleString()}</strong><span>households in view</span></div></div><QueryState loading={zones.isLoading} error={zones.isError} empty={!rows.length} onRetry={() => zones.refetch()}><div className="zones-grid"><Panel className="map-panel"><div className="panel-head"><div><span className="tiny-label">Coverage view</span><h3>{selectedZone ? selectedZone.name : 'Ward network'}</h3></div><div className="map-tools"><button className="icon-button" onClick={() => zones.refetch()} data-testid="button-map-search"><Search size={16} /></button>{selectedZone && <button className="icon-button" onClick={() => setSelected(null)} data-testid="button-map-settings"><X size={16} /></button>}</div></div>{showWard28Map ? <div className="map-canvas" style={{ padding: '16px' }}><Ward28Map /></div> : <div className="map-canvas"><div className="map-river river-one" /><div className="map-river river-two" />{rows.map((zone, index) => <button key={zone.id} className={`map-node node-${index % 6} ${selectedZone?.id === zone.id ? 'selected' : ''}`} onClick={() => setSelected(zone.id)} data-testid={`button-zone-node-${zone.id}`}><span>{zone.households}</span><i /></button>)}<div className="map-label label-north">NORTH</div><div className="map-label label-south">SOUTHERN SUBURBS</div><div className="map-scale">5 km <span /></div></div>}{!showWard28Map && <div className="map-legend"><span><i className="legend-node active" /> Active coverage</span><span><i className="legend-node growing" /> Growing reach</span><span><i className="legend-node watch" /> Needs attention</span></div>}</Panel><Panel className="zone-list-panel"><div className="panel-head"><div><span className="tiny-label">Ward register</span><h3>{rows.length} zones · sorted by reach</h3></div><span className="mono">WC / ZONES</span></div><div className="zone-list">{rows.map((zone) => <button key={zone.id} className={`zone-row ${selectedZone?.id === zone.id ? 'selected' : ''}`} onClick={() => setSelected(zone.id)} data-testid={`button-zone-${zone.id}`}><span className="zone-number">{String(zone.id).padStart(2, '0')}</span><div><b>{zone.name}</b><small>{zone.municipality} · {zone.hubName}</small></div><strong>{zone.households.toLocaleString()}</strong><StatusPill status={zone.status} /></button>)}</div>{selectedZone && <div className="zone-detail"><div className="zone-detail-head"><span className="hub-avatar">{initials(selectedZone.hubName)}</span><div><span className="tiny-label">Selected ward</span><h3>{selectedZone.name}</h3></div><button className="icon-button" onClick={() => setSelected(null)} data-testid="button-close-zone-detail"><X size={16} /></button></div><div className="zone-detail-meta"><span><Users size={15} /> {selectedZone.households.toLocaleString()} households</span><span><Store size={15} /> {selectedZone.hubName}</span></div></div>}</Panel></div></QueryState></AppShell>;
}

// Warehouse Manager Inventory Page
function InventoryPage() {
  const catalog = useListCatalog({ query: { queryKey: getListCatalogQueryKey(), staleTime: 60_000 } });

  // State for inventory management
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [sortColumn, setSortColumn] = useState<'name' | 'category' | 'stock' | 'updated'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // State for file upload
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSummary, setUploadSummary] = useState<{ added: number; updated: number; errors: number } | null>(null);
  
  // State for scanner input
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerCode, setScannerCode] = useState('');
  const [scannerName, setScannerName] = useState('');
  const [scannerQuantity, setScannerQuantity] = useState('');
  const [scannerPackageSize, setScannerPackageSize] = useState('');
  const [scannerCategory, setScannerCategory] = useState('Staples');
  const [scannerActivity, setScannerActivity] = useState<Array<{ code: string; name: string; quantity: number; timestamp: string }>>([]);

  // Use dummy data if API is not available
  const dummyCatalog: CatalogItem[] = [
    { id: 1, name: "Long Grain Rice", category: "Staples", packageSize: "1kg", communityPrice: 21.99, retailPrice: 25.99, savingsPercent: 15, stockQuantity: 138, imageKey: "rice", popular: true },
    { id: 2, name: "Maize Meal", category: "Staples", packageSize: "2.5kg", communityPrice: 38.5, retailPrice: 44.99, savingsPercent: 14, stockQuantity: 86, imageKey: "maize", popular: true },
    { id: 3, name: "Sunflower Oil", category: "Staples", packageSize: "750ml", communityPrice: 32.99, retailPrice: 39.99, savingsPercent: 18, stockQuantity: 45, imageKey: "oil", popular: false },
    { id: 4, name: "White Sugar", category: "Staples", packageSize: "2kg", communityPrice: 27.5, retailPrice: 32.99, savingsPercent: 17, stockQuantity: 92, imageKey: "sugar", popular: false },
    { id: 5, name: "Brown Bread", category: "Bakery", packageSize: "700g", communityPrice: 14.99, retailPrice: 18.99, savingsPercent: 21, stockQuantity: 120, imageKey: "bread", popular: true },
    { id: 6, name: "Baked Beans", category: "Pantry", packageSize: "410g", communityPrice: 13.5, retailPrice: 16.99, savingsPercent: 21, stockQuantity: 112, imageKey: "beans", popular: false },
    { id: 7, name: "Washing Powder", category: "Home", packageSize: "500g", communityPrice: 24.99, retailPrice: 31.99, savingsPercent: 22, stockQuantity: 19, imageKey: "washing", popular: false },
    { id: 8, name: "Rooibos Tea", category: "Beverages", packageSize: "80 bags", communityPrice: 42.99, retailPrice: 54.99, savingsPercent: 22, stockQuantity: 67, imageKey: "tea", popular: false },
  ];

  const items = Array.isArray(catalog.data) && catalog.data.length > 0 ? catalog.data : dummyCatalog;
  
  const lowStock = items.filter(item => item.stockQuantity < 50);
  const totalStock = items.reduce((sum, item) => sum + item.stockQuantity, 0);
  const categories = ['All', ...Array.from(new Set(items.map((item) => item.category)))];

  // Filter and sort items
  const filteredItems = items
    .filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortColumn === 'name') comparison = a.name.localeCompare(b.name);
      else if (sortColumn === 'category') comparison = a.category.localeCompare(b.category);
      else if (sortColumn === 'stock') comparison = a.stockQuantity - b.stockQuantity;
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadStatus('uploading');
    setUploadProgress(0);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setUploadStatus('success');
          setUploadSummary({ added: 5, updated: 3, errors: 0 });
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  // Handle scanner input
  const handleScannerSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!scannerCode || !scannerName || !scannerQuantity) return;

    const quantity = parseInt(scannerQuantity, 10);
    const activity = {
      code: scannerCode,
      name: scannerName,
      quantity,
      timestamp: new Date().toLocaleTimeString()
    };

    setScannerActivity(prev => [activity, ...prev].slice(0, 5));
    setScannerCode('');
    setScannerName('');
    setScannerQuantity('');
    setScannerPackageSize('');
    setScannerOpen(false);
  };

  // Get stock level color
  const getStockLevelColor = (quantity: number) => {
    if (quantity < 30) return 'red';
    if (quantity < 70) return 'amber';
    return 'green';
  };

  return (
    <AppShell role="warehouse" eyebrow="Warehouse · Inventory Management" title="Stock control and restocking.">
      <>
        {/* Summary Cards */}
        <div className="inventory-summary">
          <div className="summary-card">
            <Package size={20} className="summary-icon" />
            <div>
              <span className="summary-label">Total Items</span>
              <strong className="summary-value">{items.length}</strong>
            </div>
          </div>
          <div className="summary-card">
            <Boxes size={20} className="summary-icon" />
            <div>
              <span className="summary-label">Total Stock</span>
              <strong className="summary-value">{totalStock.toLocaleString()}</strong>
            </div>
          </div>
          <div className="summary-card warning">
            <AlertCircle size={20} className="summary-icon" />
            <div>
              <span className="summary-label">Low Stock</span>
              <strong className="summary-value">{lowStock.length}</strong>
            </div>
          </div>
          <div className="summary-card info">
            <TrendingUp size={20} className="summary-icon" />
            <div>
              <span className="summary-label">Categories</span>
              <strong className="summary-value">{categories.length - 1}</strong>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="inventory-actions">
          <button className="button button-secondary" onClick={() => document.getElementById('file-upload')?.click()}>
            <Upload size={16} /> Upload Excel/CSV
          </button>
          <input
            id="file-upload"
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <button className="button button-secondary" onClick={() => setScannerOpen(true)}>
            <Barcode size={16} /> Scanner Entry
          </button>
          <button className="button button-secondary" onClick={() => catalog.refetch()}>
            <RefreshCw size={16} /> Refresh Stock
          </button>
        </div>

        {/* Upload Status */}
        {uploadStatus !== 'idle' && (
          <div className={`upload-status ${uploadStatus}`}>
            {uploadStatus === 'uploading' && (
              <div>
                <span>Uploading... {uploadProgress}%</span>
                <div className="progress-bar"><span style={{ width: `${uploadProgress}%` }} /></div>
              </div>
            )}
            {uploadStatus === 'success' && uploadSummary && (
              <div>
                <CheckCircle size={16} />
                <span>Upload complete: {uploadSummary.added} added, {uploadSummary.updated} updated, {uploadSummary.errors} errors</span>
                <button className="icon-button" onClick={() => setUploadStatus('idle')}><X size={14} /></button>
              </div>
            )}
            {uploadStatus === 'error' && (
              <div>
                <AlertCircle size={16} />
                <span>Upload failed. Please try again.</span>
                <button className="icon-button" onClick={() => setUploadStatus('idle')}><X size={14} /></button>
              </div>
            )}
          </div>
        )}

        {/* Scanner Modal */}
        {scannerOpen && (
          <div className="modal-backdrop">
            <div className="modal scanner-modal">
              <div className="modal-head">
                <div>
                  <span className="tiny-label">Quick add</span>
                  <h3>Scanner Input</h3>
                </div>
                <button className="icon-button" onClick={() => setScannerOpen(false)}><X size={18} /></button>
              </div>
              <form onSubmit={handleScannerSubmit}>
                <label>
                  Barcode / QR Code
                  <input
                    value={scannerCode}
                    onChange={(e) => setScannerCode(e.target.value)}
                    placeholder="Scan or enter code"
                    autoFocus
                  />
                </label>
                <label>
                  Item Name
                  <input
                    value={scannerName}
                    onChange={(e) => setScannerName(e.target.value)}
                    placeholder="Enter item name"
                  />
                </label>
                <div className="form-row">
                  <label>
                    Quantity
                    <input
                      type="number"
                      value={scannerQuantity}
                      onChange={(e) => setScannerQuantity(e.target.value)}
                      placeholder="0"
                      min="1"
                    />
                  </label>
                  <label>
                    Package Size
                    <input
                      value={scannerPackageSize}
                      onChange={(e) => setScannerPackageSize(e.target.value)}
                      placeholder="e.g., 1kg"
                    />
                  </label>
                </div>
                <label>
                  Category
                  <select value={scannerCategory} onChange={(e) => setScannerCategory(e.target.value)}>
                    {categories.filter(c => c !== 'All').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </label>
                <div className="form-actions">
                  <button type="button" className="button button-secondary" onClick={() => setScannerOpen(false)}>Cancel</button>
                  <button type="submit" className="button button-primary">Add to Inventory</button>
                </div>
              </form>
              {scannerActivity.length > 0 && (
                <div className="scanner-activity">
                  <span className="tiny-label">Recent activity</span>
                  {scannerActivity.map((activity, index) => (
                    <div key={index} className="activity-item">
                      <CheckCircle size={14} />
                      <span>{activity.name} ({activity.quantity}) - {activity.timestamp}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="inventory-grid">
          {/* Inventory Table */}
          <Panel className="inventory-table-panel">
            <div className="panel-head">
              <div>
                <span className="tiny-label">Warehouse inventory</span>
                <h3>Stock levels</h3>
              </div>
              <div className="table-controls">
                <input
                  className="search-input"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
            <QueryState loading={catalog.isLoading} error={catalog.isError} empty={!filteredItems.length} onRetry={() => catalog.refetch()}>
              <div className="inventory-table">
                <div className="table-header">
                  <button onClick={() => { setSortColumn('name'); setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); }}>
                    Item Name {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                  <button onClick={() => { setSortColumn('category'); setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); }}>
                    Category {sortColumn === 'category' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                  <button onClick={() => { setSortColumn('stock'); setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); }}>
                    Package Size {sortColumn === 'stock' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                  <button onClick={() => { setSortColumn('stock'); setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); }}>
                    Stock Quantity {sortColumn === 'stock' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                  <span>Status</span>
                  <span>Last Updated</span>
                </div>
                <div className="table-body">
                  {filteredItems.map((item) => (
                    <div key={item.id} className="table-row">
                      <div>
                        <b>{item.name}</b>
                      </div>
                      <div>{item.category}</div>
                      <div>{item.packageSize}</div>
                      <div className={`stock-cell ${getStockLevelColor(item.stockQuantity)}`}>
                        <strong>{item.stockQuantity}</strong>
                      </div>
                      <div>
                        <span className={`status-pill ${getStockLevelColor(item.stockQuantity)}`}>
                          <span className="status-dot" />
                          {item.stockQuantity < 30 ? 'Low' : item.stockQuantity < 70 ? 'Medium' : 'High'}
                        </span>
                      </div>
                      <div>{shortDate(new Date().toISOString())}</div>
                    </div>
                  ))}
                </div>
              </div>
            </QueryState>
          </Panel>
        </div>
      </>
    </AppShell>);
}

function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const { loading, user } = useAuth();
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    if (!user) {
      setLocation('/sign-in');
    } else {
      const normalizedRole = user.role === 'SUPER_ADMIN' ? 'super' : user.role === 'HUB_ADMIN' ? 'hub' : user.role === 'DELIVERY_AGENT' ? 'agent' : user.role === 'WAREHOUSE_MANAGER' ? 'warehouse' : 'client';
      console.log('RoleGate useEffect: user.role =', user.role, 'normalizedRole =', normalizedRole, 'required role =', role);
      if (normalizedRole !== role) {
        console.log('RoleGate: Redirecting to', workspacePath(user.role));
        setLocation(workspacePath(user.role));
      }
    }
  }, [user, role, setLocation]);
  
  if (loading) return <div className="auth-loading"><span className="live-pulse" /> Loading workspace…</div>;
  if (!user) return null;
  
  const normalizedRole = user.role === 'SUPER_ADMIN' ? 'super' : user.role === 'HUB_ADMIN' ? 'hub' : user.role === 'DELIVERY_AGENT' ? 'agent' : user.role === 'WAREHOUSE_MANAGER' ? 'warehouse' : 'client';
  console.log('RoleGate render: user.role =', user.role, 'normalizedRole =', normalizedRole, 'required =', role, 'match =', normalizedRole === role);
  if (normalizedRole !== role) return null;
  
  return children;
}

function ClientOrdersPage() {
  const { user } = useAuth();
  const orders = useListOrders({ status: undefined }, { query: { queryKey: getListOrdersQueryKey(), refetchInterval: 15_000 } });
  
  const dummyOrders: Order[] = [
    { id: 1, reference: "CWH-1001", clientName: user?.fullName || "Client", clientPhone: "+27821234567", hubName: "Elsies River Hub", address: "45 Avon Street, Elsies River", orderSource: "WEB_APP", status: "HUB_CONFIRMED", paymentMethod: "PAYMERCH", paymentStatus: "PAID", totalAmount: 89.97, itemCount: 3, createdAt: new Date().toISOString(), lines: [{ itemName: "Long Grain Rice", packageSize: "1kg", quantity: 2, unitPrice: 21.99 }, { itemName: "Cooking Oil", packageSize: "750ml", quantity: 1, unitPrice: 29.99 }] },
    { id: 2, reference: "CWH-1002", clientName: user?.fullName || "Client", clientPhone: "+27829876543", hubName: "Elsies River Hub", address: "12 Pine Road, Elsies River", orderSource: "whatsapp", status: "WAREHOUSE_PICKED", paymentMethod: "PAYSHAP", paymentStatus: "PAID", totalAmount: 54.48, itemCount: 2, createdAt: new Date(Date.now() - 3600000).toISOString(), lines: [{ itemName: "Maize Meal", packageSize: "2.5kg", quantity: 1, unitPrice: 38.5 }, { itemName: "Sugar", packageSize: "1kg", quantity: 1, unitPrice: 18.5 }] },
  ];
  
  const safeOrders = Array.isArray(orders.data) && orders.data.length > 0 ? orders.data : dummyOrders;
  const rows = safeOrders.filter((order) => order.clientName === user?.fullName);
  
  const getStatusLabel = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'pending') return 'Pending';
    if (s === 'hub_confirmed') return 'Hub Confirmed';
    if (s === 'warehouse_picked') return 'Packed';
    if (s === 'agent_picked') return 'Out for Delivery';
    if (s === 'delivered') return 'Delivered';
    return status;
  };
  
  return <AppShell role="client" eyebrow="Community account · Orders" title="Keep track of every basket."><Panel className="client-status-panel"><div className="panel-head"><div><span className="tiny-label">Your order queue</span><h2>Orders in motion</h2></div><button className="button button-secondary" onClick={() => orders.refetch()}><RefreshCw size={15} /> Refresh</button></div><QueryState loading={orders.isLoading} error={orders.isError} empty={!rows.length} onRetry={() => orders.refetch()}><div className="client-order-list">{rows.map((order) => <div className="client-order-row" key={order.id}><div><b>{order.reference}</b><small>{shortDate(order.createdAt)} · {order.itemCount} items</small></div><strong>{money(order.totalAmount)}</strong><StatusPill status={order.status} /></div>)}</div></QueryState></Panel></AppShell>;
}

function ClientDeliveryStatusPage() {
  const { user } = useAuth();
  const orders = useListOrders({ status: undefined }, { query: { queryKey: getListOrdersQueryKey(), refetchInterval: 15_000 } });
  const deliveries = useListDeliveries({ query: { queryKey: getListDeliveriesQueryKey(), refetchInterval: 15_000 } });
  const safeOrders = Array.isArray(orders.data) ? orders.data : [];
  const safeDeliveries = Array.isArray(deliveries.data) ? deliveries.data : [];
  const references = new Set(safeOrders.filter((order) => order.clientName === user?.fullName).map((order) => order.reference));
  const rows = safeDeliveries.filter((delivery) => references.has(delivery.orderReference));
  return <AppShell role="client" eyebrow="Community account · Delivery" title="Know when it is on the way."><Panel className="client-status-panel"><div className="panel-head"><div><span className="tiny-label">Live delivery status</span><h2>Your doorstep updates</h2></div><span className="status-pill green"><span className="status-dot" /> Live updates</span></div><QueryState loading={orders.isLoading || deliveries.isLoading} error={orders.isError || deliveries.isError} empty={!rows.length} onRetry={() => { void orders.refetch(); void deliveries.refetch(); }}><div className="client-order-list">{rows.map((delivery) => <div className="client-order-row" key={delivery.id}><div><b>{delivery.orderReference}</b><small>{delivery.dropoff}</small></div><strong>{delivery.eta}</strong><StatusPill status={delivery.status} /></div>)}</div></QueryState></Panel></AppShell>;
}

function SignInPage() {
  const { signIn } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setError(''); setPending(true); try { const signedInUser = await signIn(email, password); setLocation(workspacePath(signedInUser.role)); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to sign in'); } finally { setPending(false); } };
  return <div className="auth-page"><div className="auth-card"><Brand /><h1>Sign in</h1><form onSubmit={submit} className="auth-form"><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label>{error && <div className="auth-error">{error}</div>}<button className="button button-primary button-wide" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button></form><p className="auth-switch">Need a community account? <Link href="/sign-up">Register</Link></p></div></div>;
}

function SignUpPage() {
  const { register } = useAuth();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ fullName: '', email: '', phoneNumber: '', password: '' });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setError(''); setPending(true); try { await register(form.fullName, form.email, form.phoneNumber, form.password); setLocation('/shop'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to register'); } finally { setPending(false); } };
  return <div className="auth-page"><div className="auth-card"><Brand /><h1>Register</h1><form onSubmit={submit} className="auth-form"><label>Full name<input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required /></label><label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required autoComplete="email" /></label><label>Mobile number<input value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} required /></label><label>Password<input type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required autoComplete="new-password" /></label>{error && <div className="auth-error">{error}</div>}<button className="button button-primary button-wide" disabled={pending}>{pending ? 'Registering…' : 'Register'}</button></form><p className="auth-switch">Already registered? <Link href="/sign-in">Sign in</Link></p></div></div>;
}

function WorkspaceRoute({ role, clientPage, children }: { role: Role; clientPage?: ReactNode; children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role === 'CLIENT' && clientPage) return clientPage;
  // Allow both hub and warehouse managers to access the same pages
  if (role === 'hub' && user?.role === 'WAREHOUSE_MANAGER') return <RoleGate role="warehouse">{children}</RoleGate>;
  return <RoleGate role={role}>{children}</RoleGate>;
}

function UserManagementPage() {
  const { getUsers, deleteUser, createUser, resetPassword } = useAdminAuth();
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DemoUser | null>(null);
  const [newUser, setNewUser] = useState({ fullName: '', email: '', phoneNumber: '', password: '', role: 'CLIENT' as AuthRole });
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUsers(getUsers());
  }, [getUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createUser(newUser.fullName, newUser.email, newUser.phoneNumber, newUser.password, newUser.role);
      setUsers(getUsers());
      setShowCreateModal(false);
      setNewUser({ fullName: '', email: '', phoneNumber: '', password: '', role: 'CLIENT' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = (id: number) => {
    if (confirm('Are you sure you want to delete this user?')) {
      deleteUser(id);
      setUsers(getUsers());
    }
  };

  const handleResetPassword = () => {
    if (selectedUser && newPassword) {
      resetPassword(selectedUser.id, newPassword);
      setShowResetModal(false);
      setNewPassword('');
      setSelectedUser(null);
    }
  };

  const openResetModal = (user: DemoUser) => {
    setSelectedUser(user);
    setNewPassword('');
    setShowResetModal(true);
  };

  return <AppShell role="super" eyebrow="Super Admin · User Management" title="Manage user accounts and roles">
    <Panel>
      <div className="panel-head">
        <div>
          <span className="tiny-label">Administration</span>
          <h3>User Management</h3>
        </div>
        <button className="button button-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} /> Create User
        </button>
      </div>

      <div className="users-table">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Role</th>
              <th className="text-left p-3">Phone</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b">
                <td className="p-3">{user.fullName}</td>
                <td className="p-3">{user.email}</td>
                <td className="p-3">
                  <span className={`status-pill ${user.role === 'SUPER_ADMIN' ? 'green' : user.role === 'HUB_ADMIN' ? 'blue' : user.role === 'WAREHOUSE_MANAGER' ? 'purple' : user.role === 'DELIVERY_AGENT' ? 'amber' : 'gray'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="p-3">{user.phoneNumber || '-'}</td>
                <td className="p-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <button className="icon-button" onClick={() => openResetModal(user)} title="Reset Password">
                      <RefreshCw size={16} />
                    </button>
                    {user.id !== 1 && (
                      <button className="icon-button" onClick={() => handleDeleteUser(user.id)} title="Delete User">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Create New User</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block mb-1">Full Name</label>
                <input
                  type="text"
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block mb-1">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={newUser.phoneNumber}
                  onChange={(e) => setNewUser({ ...newUser, phoneNumber: e.target.value })}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block mb-1">Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full p-2 border rounded"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="block mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as AuthRole })}
                  className="w-full p-2 border rounded"
                >
                  <option value="CLIENT">Client</option>
                  <option value="HUB_ADMIN">Hub Admin</option>
                  <option value="WAREHOUSE_MANAGER">Warehouse Manager</option>
                  <option value="DELIVERY_AGENT">Delivery Agent</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <div className="flex gap-2 justify-end">
                <button type="button" className="button button-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="button button-primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showResetModal && selectedUser && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-head">
              <div>
                <span className="tiny-label">Security</span>
                <h3>Reset Password</h3>
              </div>
              <button className="icon-button" onClick={() => setShowResetModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleResetPassword(); }} className="space-y-4">
              <div>
                <label>User</label>
                <input
                  type="text"
                  value={selectedUser.fullName}
                  disabled
                  className="w-full p-2 border rounded bg-muted"
                />
              </div>
              <div>
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                  minLength={8}
                  placeholder="Enter new password (min 8 characters)"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" className="button button-secondary" onClick={() => setShowResetModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="button button-primary">
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Panel>
  </AppShell>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={Home} /><Route path="/sign-in/*?" component={SignInPage} /><Route path="/sign-up/*?" component={SignUpPage} /><Route path="/shop">{() => <WorkspaceRoute role="client" clientPage={<ShopPage />}><AdminShopPage /></WorkspaceRoute>}</Route><Route path="/orders">{() => <WorkspaceRoute role="hub" clientPage={<ClientOrdersPage />}><OrdersPage /></WorkspaceRoute>}</Route><Route path="/deliveries">{() => <WorkspaceRoute role="agent" clientPage={<ClientDeliveryStatusPage />}><DeliveriesPage /></WorkspaceRoute>}</Route><Route path="/inventory">{() => <WorkspaceRoute role="warehouse"><InventoryPage /></WorkspaceRoute>}</Route><Route path="/command">{() => <RoleGate role="super"><CommandPage /></RoleGate>}</Route><Route path="/pricing">{() => <RoleGate role="super"><PricingPage /></RoleGate>}</Route><Route path="/zones">{() => <RoleGate role="super"><ZonesPage /></RoleGate>}</Route><Route path="/users">{() => <RoleGate role="super"><UserManagementPage /></RoleGate>}</Route><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <WouterRouter base={basePath}><AuthProvider><QueryClientProvider client={queryClient}><TooltipProvider><Router /><Toaster /></TooltipProvider></QueryClientProvider></AuthProvider></WouterRouter>;
}

export default App;