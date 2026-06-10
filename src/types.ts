export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: "customer" | "seller" | "admin";
  sellerApproved: boolean;
  avatarUrl: string;
  storeName?: string;
  storeDescription?: string;
  walletBalance: number; // Ghana Cedi wallet balance
  location?: string; // Ghana region/district
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  description: string;
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  isPrimary: boolean;
  order: number;
}

export interface Product {
  id: string;
  sellerId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number; // uniform in Ghana Cedi GH₵
  salePrice: number | null;
  stock: number;
  isVisible: boolean;
  isFeatured: boolean;
  averageRating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  images: ProductImage[];
  primaryImage: string;
  sellerName: string;
  
  // Custom Ghana aligned attributes
  location: string; // Accra, Kumasi, Tamale, Takoradi, etc.
  tag: string | null; // e.g. "free_shipping" | "hot_deal" | "discount"
  isBoosted: boolean; // active advertisement boost
  boostTier: "1_day" | "3_days" | "1_month" | null;
  boostExpiresAt: string | null;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  stock: number;
  quantity: number;
  total: number;
  imageUrl: string;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  total: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  sellerId: string;
  productName: string;
  price: number;
  quantity: number;
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  status: "pending" | "payment_received" | "confirmed" | "preparing" | "shipped" | "delivered" | "completed" | "cancelled";
  comment: string;
  changedBy: string;
  createdAt: string;
}

export interface Order {
  id: string;
  userId: string;
  status: "pending" | "payment_received" | "confirmed" | "preparing" | "shipped" | "delivered" | "completed" | "cancelled";
  shippingAddress: {
    name: string;
    street: string;
    city: string;
    postalCode: string;
    country: string;
    phone: string;
  };
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  trackingNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  history: OrderStatusHistory[];
  
  // Custom delivery timer tracking
  deliveryDays: number; // e.g. 3 days
  estimatedDeliveryAt: string; // ISO timestamp
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  userName?: string;
  action: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Settings {
  id: string;
  platformName: string;
  heroHeadline: string;
  heroSubheadline: string;
  heroImageUrl: string;
  promoText: string;
  contactEmail: string;
  shopAddress: string;
}

// Session logouts tracker record
export interface SessionLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: "LOGIN" | "LOGOUT";
  createdAt: string;
}

export interface WithdrawalRecord {
  id: string;
  sellerId: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  status: "pending" | "approved" | "failed";
  createdAt: string;
}
