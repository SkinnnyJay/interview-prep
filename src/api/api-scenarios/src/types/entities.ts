/**
 * Domain Entity Types for API Scenarios
 *
 * This file defines the core business entities used throughout
 * the API scenarios, including User, Product, Order, and related types.
 */

import { BaseEntity } from "./common";
import { UserRoleType, UserStatusType, UserThemeType } from "../constants";

// User Management
export interface User extends BaseEntity {
  username: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  profile?: UserProfile;
  preferences?: UserPreferences;
  lastLoginAt?: Date;
  emailVerifiedAt?: Date;
  twoFactorEnabled: boolean;
}

export type UserRole = UserRoleType;
export type UserStatus = UserStatusType;

export interface UserProfile {
  avatar?: string;
  bio?: string;
  website?: string;
  location?: string;
  timezone?: string;
  language?: string;
  dateOfBirth?: Date;
  phoneNumber?: string;
}

export interface UserPreferences {
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  privacy: {
    profileVisible: boolean;
    showEmail: boolean;
    showPhone: boolean;
  };
  theme: UserThemeType;
}

// Authentication
export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
  twoFactorCode?: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  acceptTerms: boolean;
}

// Product Management
export interface Product extends BaseEntity {
  name: string;
  description: string;
  sku: string;
  price: number;
  currency: string;
  category: ProductCategory;
  tags: string[];
  images: ProductImage[];
  inventory: ProductInventory;
  specifications: ProductSpecification[];
  status: ProductStatus;
  seoData?: ProductSEO;
  variants?: ProductVariant[];
}

export type ProductStatus = "draft" | "active" | "inactive" | "discontinued";

export interface ProductCategory extends BaseEntity {
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  level: number;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductInventory {
  quantity: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  allowBackorder: boolean;
}

export interface ProductSpecification {
  name: string;
  value: string;
  unit?: string;
  group?: string;
}

export interface ProductSEO {
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  canonicalUrl?: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price?: number;
  inventory: ProductInventory;
  attributes: {
    [key: string]: string; // e.g., { color: 'red', size: 'large' }
  };
}

// Order Management
export interface Order extends BaseEntity {
  orderNumber: string;
  userId: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  shippingAddress: Address;
  billingAddress: Address;
  paymentMethod: PaymentMethod;
  shippingMethod: ShippingMethod;
  notes?: string;
  metadata?: {
    source: string;
    campaign?: string;
    referrer?: string;
  };
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface OrderItem {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product: {
    name: string;
    sku: string;
    image?: string;
  };
}

export interface Address {
  firstName: string;
  lastName: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phoneNumber?: string;
}

export interface PaymentMethod {
  type: "credit_card" | "debit_card" | "paypal" | "bank_transfer" | "cash_on_delivery";
  provider?: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  cardholderName?: string;
}

export interface ShippingMethod {
  id: string;
  name: string;
  description?: string;
  price: number;
  estimatedDays: number;
  trackingEnabled: boolean;
}

// Shopping Cart
export interface Cart extends BaseEntity {
  userId?: string; // null for guest carts
  sessionId?: string;
  items: CartItem[];
  subtotal: number;
  tax?: number;
  shipping?: number;
  total: number;
  currency: string;
  expiresAt?: Date;
}

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  addedAt: Date;
}

// Reviews and Ratings
export interface Review extends BaseEntity {
  productId: string;
  userId: string;
  rating: number; // 1-5
  title: string;
  content: string;
  verified: boolean; // Verified purchase
  helpful: number; // Helpful votes
  status: ReviewStatus;
  images?: string[];
  response?: ReviewResponse; // Merchant response
}

export type ReviewStatus = "pending" | "approved" | "rejected" | "flagged";

export interface ReviewResponse {
  content: string;
  respondedAt: Date;
  respondedBy: string;
}

// Notifications
export interface Notification extends BaseEntity {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>; // Additional data for the notification
  read: boolean;
  readAt?: Date;
  channel: NotificationChannel[];
  priority: NotificationPriority;
  expiresAt?: Date;
}

export type NotificationType =
  | "order_confirmed"
  | "order_shipped"
  | "order_delivered"
  | "payment_received"
  | "product_back_in_stock"
  | "price_drop"
  | "review_received"
  | "system_maintenance"
  | "security_alert";

export type NotificationChannel = "email" | "push" | "sms" | "in_app";
export type NotificationPriority = "low" | "normal" | "high" | "urgent";

// Analytics and Reporting
export interface AnalyticsEvent extends BaseEntity {
  userId?: string;
  sessionId: string;
  eventType: string;
  eventData: Record<string, unknown>;
  url?: string;
  userAgent?: string;
  ip?: string;
  referrer?: string;
  timestamp: Date;
}

export interface Report extends BaseEntity {
  name: string;
  type: ReportType;
  parameters: Record<string, unknown>;
  format: ReportFormat;
  status: ReportStatus;
  filePath?: string;
  fileSize?: number;
  generatedBy: string;
  scheduledAt?: Date;
  completedAt?: Date;
  error?: string;
}

export type ReportType = "sales" | "inventory" | "users" | "analytics" | "custom";
export type ReportFormat = "pdf" | "excel" | "csv" | "json";
export type ReportStatus = "pending" | "processing" | "completed" | "failed";

// Content Management
export interface Content extends BaseEntity {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  type: ContentType;
  status: ContentStatus;
  authorId: string;
  categoryId?: string;
  tags: string[];
  featuredImage?: string;
  seoData?: ContentSEO;
  publishedAt?: Date;
  metadata?: {
    readTime?: number;
    wordCount?: number;
    [key: string]: unknown;
  };
}

export type ContentType = "page" | "post" | "article" | "faq" | "help";
export type ContentStatus = "draft" | "published" | "archived" | "scheduled";

export interface ContentSEO {
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  canonicalUrl?: string;
  noIndex?: boolean;
  noFollow?: boolean;
}

// Settings and Configuration
export interface Setting extends BaseEntity {
  key: string;
  value: unknown;
  type: SettingType;
  category: string;
  description?: string;
  isPublic: boolean;
  validation?: {
    required?: boolean;
    type?: string;
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
  };
}

export type SettingType = "string" | "number" | "boolean" | "json" | "array";

// Webhooks
export interface Webhook extends BaseEntity {
  name: string;
  url: string;
  events: string[];
  secret?: string;
  isActive: boolean;
  headers?: { [key: string]: string };
  retryPolicy: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  lastTriggeredAt?: Date;
  failureCount: number;
}

export interface WebhookDelivery extends BaseEntity {
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  httpStatus?: number;
  response?: string;
  error?: string;
  attempts: number;
  nextRetryAt?: Date;
}

export type WebhookDeliveryStatus = "pending" | "success" | "failed" | "cancelled";

// API Keys and Authentication
export interface ApiKey extends BaseEntity {
  name: string;
  key: string;
  userId: string;
  permissions: string[];
  rateLimit?: {
    requests: number;
    window: number; // in seconds
  };
  isActive: boolean;
  expiresAt?: Date;
  lastUsedAt?: Date;
  usageCount: number;
}

// File Management
export interface FileMetadata extends BaseEntity {
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  path: string;
  url: string;
  userId?: string;
  tags?: string[];
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    [key: string]: unknown;
  };
  isPublic: boolean;
  downloadCount: number;
}

// Subscription and Billing
export interface Subscription extends BaseEntity {
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  metadata?: Record<string, unknown>;
}

export type SubscriptionStatus = "active" | "past_due" | "cancelled" | "unpaid" | "trialing";

export interface Plan extends BaseEntity {
  name: string;
  description?: string;
  price: number;
  currency: string;
  interval: "month" | "year";
  intervalCount: number;
  trialPeriodDays?: number;
  features: PlanFeature[];
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export interface PlanFeature {
  name: string;
  description?: string;
  limit?: number;
  unlimited?: boolean;
}
