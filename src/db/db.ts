import fs from "fs";
import path from "path";
import crypto from "crypto";

// ---- DATABASE SCHEMA TYPES ----

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "customer" | "seller" | "admin";
  sellerApproved: boolean;
  avatarUrl: string;
  storeName?: string;
  storeDescription?: string;
  walletBalance: number; // Ghana Cedi balance
  location?: string; // e.g. "Accra"
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  description: string;
}

export interface Product {
  id: string;
  sellerId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  salePrice: number | null;
  stock: number;
  isVisible: boolean;
  isFeatured: boolean;
  averageRating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  
  // Ghana custom features
  location: string;
  tag: string | null;
  isBoosted: boolean;
  boostTier: "1_day" | "3_days" | "1_month" | null;
  boostExpiresAt: string | null;
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  isPrimary: boolean;
  order: number;
}

export interface Cart {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
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
  deliveryDays: number;
  estimatedDeliveryAt: string;
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
  status: Order["status"];
  comment: string;
  changedBy: string; // user name or "System" or "Admin"
  createdAt: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string; // 'order_placed' | 'order_shipped' | 'low_stock' | 'seller_approval' | 'announcement'
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface WishlistItem {
  id: string;
  userId: string;
  productId: string;
  addedAt: string;
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

// ---- DATABASE FILE PERSISTENCE ----

interface DatabaseSchema {
  users: User[];
  categories: Category[];
  products: Product[];
  productImages: ProductImage[];
  carts: Cart[];
  cartItems: CartItem[];
  orders: Order[];
  orderItems: OrderItem[];
  orderStatusHistory: OrderStatusHistory[];
  reviews: Review[];
  notifications: Notification[];
  wishlists: WishlistItem[];
  auditLogs: AuditLog[];
  announcements: Announcement[];
  settings: Settings;
  sessionLogs: SessionLog[];
  withdrawals: WithdrawalRecord[];
}

import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const sanitizeEnvVar = (val: string) => {
  if (!val) return "";
  let s = val.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  return s.trim();
};

const supabaseUrl = sanitizeEnvVar(process.env.VITE_SUPABASE_URL || "");
// Prioritize SUPABASE_SERVICE_ROLE_KEY to bypass storage RLS, fallback to anon key
const supabaseKey = sanitizeEnvVar(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "");

let supabase: any = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
  } catch (err) {
    console.error("Failed to initialize Supabase client in db.ts:", err);
  }
}

// On Vercel, process.cwd() is read-only, so use /tmp
const DB_FILE_PATH = process.env.VERCEL 
  ? path.join("/tmp", "db.json") 
  : path.join(process.cwd(), "db.json");

// Intrinsic locks to prevent concurrent write issues
let isWriting = false;

// Bucket assertion helper to automate project onboarding
async function ensureBucketExists(): Promise<void> {
  if (!supabase) return;
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.warn("Could not list buckets:", listError.message);
      return;
    }
    const hasAvatars = buckets?.some((b: any) => b.name === "avatars");
    if (!hasAvatars) {
      console.log("Bucket 'avatars' not found in Supabase storage. Automatically creating bucket...");
      const { error: createError } = await supabase.storage.createBucket("avatars", {
        public: true,
        fileSizeLimit: 52428800 // 50MB
      });
      if (createError) {
        console.warn("Failed to create bucket 'avatars':", createError.message);
      } else {
        console.log("Bucket 'avatars' created successfully!");
      }
    }
  } catch (err: any) {
    console.warn("Error in ensureBucketExists:", err.message);
  }
}

// Upload helper
async function uploadRemoteDatabase(db: DatabaseSchema): Promise<void> {
  if (!supabase) return;
  try {
    await ensureBucketExists();
    const jsonStr = JSON.stringify(db, null, 2);
    // In Node server, we can use a Buffer for storage upload
    const buffer = Buffer.from(jsonStr, "utf-8");
    
    // We try to upload to 'avatars' bucket (guaranteed to be set up) as 'db_state.json'
    const { error } = await supabase.storage
      .from("avatars")
      .upload("db_state.json", buffer, {
        upsert: true,
        contentType: "application/json"
      });

    if (error) {
      console.error("Supabase Storage upload error:", error.message);
    } else {
      console.log("Database state successfully saved and backed up to Supabase storage!");
    }
  } catch (err: any) {
    console.error("Error in uploadRemoteDatabase:", err.message);
  }
}

// Global async initializer
export async function initializeDatabaseAsync(): Promise<void> {
  if (!supabase) {
    console.log("Supabase credentials missing or unconfigured. Running in local filesystem mode.");
    return;
  }

  try {
    await ensureBucketExists();
    console.log("Attempting to restore database state from Supabase storage...");
    const { data, error } = await supabase.storage
      .from("avatars")
      .download("db_state.json");

    if (error) {
      if (error.message && (error.message.includes("Object not found") || error.message.includes("does not exist") || error.message.includes("does not have"))) {
        console.log("No remote database state found in Supabase storage yet. Seeding default database...");
        const initialDb = createInitialSeedData();
        saveDatabaseSync(initialDb);
        await uploadRemoteDatabase(initialDb);
      } else {
        console.warn("Supabase download warning:", error.message);
      }
      return;
    }

    if (data) {
      const text = await data.text();
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.users)) {
        saveDatabaseSync(parsed);
        console.log("Database state successfully synchronized from Supabase storage.");
      }
    }
  } catch (syncErr: any) {
    console.error("Failed to synchronize database state on startup:", syncErr.message);
  }
}

function loadDatabase(): DatabaseSchema {
  if (!fs.existsSync(DB_FILE_PATH)) {
    const initialDb = createInitialSeedData();
    saveDatabaseSync(initialDb);
    return initialDb;
  }
  try {
    const data = fs.readFileSync(DB_FILE_PATH, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Failed to read database file. Re-creating initial data.", err);
    const initialDb = createInitialSeedData();
    saveDatabaseSync(initialDb);
    return initialDb;
  }
}

function saveDatabaseSync(db: DatabaseSchema) {
  try {
    const data = JSON.stringify(db, null, 2);
    // Ensure parent directory exists for /tmp or custom paths
    const parentDir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    // Write via a temp file for solid atomic safety
    const tempPath = `${DB_FILE_PATH}.tmp`;
    fs.writeFileSync(tempPath, data, "utf-8");
    fs.renameSync(tempPath, DB_FILE_PATH);
  } catch (err) {
    console.error("Error writing database to disk:", err);
  }
}

export function saveDatabase(db: DatabaseSchema): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isWriting) {
      // Small backoff retry if write lock is held
      setTimeout(() => {
        saveDatabase(db).then(resolve).catch(reject);
      }, 50);
      return;
    }
    isWriting = true;
    try {
      saveDatabaseSync(db);
      isWriting = false;
      resolve();

      // Trigger background upload to Supabase state storage
      if (supabase) {
        uploadRemoteDatabase(db).catch(err => {
          console.error("Background Supabase sync upload failed:", err.message);
        });
      }
    } catch (err) {
      isWriting = false;
      reject(err);
    }
  });
}

// ---- DYNAMIC SEED GREATION ----

function createInitialSeedData(): DatabaseSchema {
  // Hash some default passwords of our seed accounts
  // Password is 'password123'
  // Using simple base sha256 or bcrypt mock since standard node crypto can hash directly
  const hashPassword = (plain: string) => {
    return crypto.createHash("sha256").update(plain + "salt123").digest("hex");
  };

  const adminPasswordHash = hashPassword("admin123");
  const seller1PasswordHash = hashPassword("seller123");
  const customer1PasswordHash = hashPassword("customer123");

  const now = new Date().toISOString();

  // Create our default approved sellers and a customer
  const users: User[] = [
    {
      id: "user-admin",
      name: "Shop Administrator",
      email: "admin@smarthub.com",
      passwordHash: adminPasswordHash,
      role: "admin",
      sellerApproved: true,
      avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120",
      walletBalance: 15450,
      location: "Accra",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "user-seller1",
      name: "Marcus Aurelius Tech",
      email: "marcus@aureliustech.com",
      passwordHash: seller1PasswordHash,
      role: "seller",
      sellerApproved: true,
      avatarUrl: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=120",
      storeName: "Aurelius Ghana Craft",
      storeDescription: "Curated Ghanaian tech accessories, custom leather crafts, and artisan goods.",
      walletBalance: 4800,
      location: "Kumasi",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "user-seller2",
      name: "Elena Rostova Designs",
      email: "elena@rostovadesigns.com",
      passwordHash: seller1PasswordHash, // Same password
      role: "seller",
      sellerApproved: false, // Pending approval
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120",
      storeName: "Rostova Accra Home",
      storeDescription: "Handcrafted Accra pottery, eco-furniture, and local organic vessels.",
      walletBalance: 0,
      location: "Accra",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "user-customer1",
      name: "Sarah Jenkins",
      email: "sarah@gmail.com",
      passwordHash: customer1PasswordHash,
      role: "customer",
      sellerApproved: false,
      avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=120",
      walletBalance: 1500, // Preloaded GHS 1500 wallet
      location: "Tema",
      createdAt: now,
      updatedAt: now
    }
  ];

  const categories: Category[] = [
    {
      id: "cat-tech",
      name: "Minimalist Tech",
      slug: "minimalist-tech",
      imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=400",
      description: "Smart audio devices, sleek ergonomics, and beautiful electrical assets."
    },
    {
      id: "cat-workspace",
      name: "Workspace Gear",
      slug: "workspace-gear",
      imageUrl: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&q=80&w=400",
      description: "Bespoke desk pads, sandblasted aluminium risers, and sensory storage solutions."
    },
    {
      id: "cat-lifestyle",
      name: "Home & Lifestyle",
      slug: "home-lifestyle",
      imageUrl: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&q=80&w=400",
      description: "Stoneware vessels, responsive home products, and ultrasonic ambient diffusers."
    }
  ];

  const products: Product[] = [
    {
      id: "prod-earbuds",
      sellerId: "user-seller1",
      categoryId: "cat-tech",
      name: "AeroPro Wireless Earbuds",
      description: "Experience serene audio with active noise-cancellation (ANC), matte black ergonomics, and sound profiles custom-tuned by luxury designers. Case includes 40-hour deep lithium cells and Qi inductive charging compatibility.",
      price: 1490.00,
      salePrice: 1290.00,
      stock: 12,
      isVisible: true,
      isFeatured: true,
      averageRating: 4.8,
      reviewCount: 3,
      createdAt: now,
      updatedAt: now,
      location: "Accra",
      tag: "free_shipping",
      isBoosted: true,
      boostTier: "3_days",
      boostExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString()
    },
    {
      id: "prod-keyboard",
      sellerId: "user-seller1",
      categoryId: "cat-tech",
      name: "OrthoTouch Wood Keyboard",
      description: "An ortholinear mechanical keyboard wrapped in a seamless, premium hand-milled walnut block. Equipped with pre-lubed silent tactile switches, double-shot PBT keycaps with crisp center-aligned legends, and hot-swappable terminals.",
      price: 2100.00,
      salePrice: null,
      stock: 4, // Low stock on purpose
      isVisible: true,
      isFeatured: true,
      averageRating: 5.0,
      reviewCount: 1,
      createdAt: now,
      updatedAt: now,
      location: "Kumasi",
      tag: "hot_deal",
      isBoosted: false,
      boostTier: null,
      boostExpiresAt: null
    },
    {
      id: "prod-lamp",
      sellerId: "user-seller1",
      categoryId: "cat-tech",
      name: "Horizon OLED Desk Lamp",
      description: "A flexible architectural lighting tube engineered with custom OLED elements, mimicking shifting daylight temperatures from 2700K to 6500K. The brushed space-grey aluminium base houses a 15W Qi high-speed charger.",
      price: 890.00,
      salePrice: 750.00,
      stock: 8,
      isVisible: true,
      isFeatured: false,
      averageRating: 4.2,
      reviewCount: 2,
      createdAt: now,
      updatedAt: now,
      location: "Accra",
      tag: null,
      isBoosted: false,
      boostTier: null,
      boostExpiresAt: null
    },
    {
      id: "prod-deskmat",
      sellerId: "user-seller1",
      categoryId: "cat-workspace",
      name: "EcoWool Felt Desk Mat",
      description: "Protect your workspace with 100% genuine merino wool felt sourced ethically and felted in watermills. Provides luxurious cushion, natural heat resistance, and precise optical sensor tracking for modern devices.",
      price: 450.00,
      salePrice: null,
      stock: 25,
      isVisible: true,
      isFeatured: false,
      averageRating: 4.5,
      reviewCount: 2,
      createdAt: now,
      updatedAt: now,
      location: "Takoradi",
      tag: "free_shipping",
      isBoosted: false,
      boostTier: null,
      boostExpiresAt: null
    },
    {
      id: "prod-laptopstand",
      sellerId: "user-seller1",
      categoryId: "cat-workspace",
      name: "Altus Aluminum Laptop Riser",
      description: "A durable piece of workspace geometry carved from structural grade sandblasted aluminum. Elevates your display to eye level, mitigates spine strain, and features a clean wire pass-through tunnel behind.",
      price: 590.00,
      salePrice: null,
      stock: 5, // Low stock threshold
      isVisible: true,
      isFeatured: true,
      averageRating: 4.9,
      reviewCount: 1,
      createdAt: now,
      updatedAt: now,
      location: "Kumasi",
      tag: null,
      isBoosted: false,
      boostTier: null,
      boostExpiresAt: null
    },
    {
      id: "prod-pouch",
      sellerId: "user-seller1",
      categoryId: "cat-workspace",
      name: "Apex Modular Organizer",
      description: "Secure your tech cables, drives, and accessories inside a rugged, water-repellent shell made of recycled PET fabric. Features secure elastic internal layout tabs and responsive YKK waterproof zippers.",
      price: 350.00,
      salePrice: 290.00,
      stock: 0, // Out of stock on purpose
      isVisible: true,
      isFeatured: false,
      averageRating: 4.0,
      reviewCount: 1,
      createdAt: now,
      updatedAt: now,
      location: "Tema",
      tag: "discount",
      isBoosted: false,
      boostTier: null,
      boostExpiresAt: null
    },
    {
      id: "prod-vessel",
      sellerId: "user-seller1",
      categoryId: "cat-lifestyle",
      name: "Luna Ceramic Coffee Vessel",
      description: "A classic hand-thrown pour-over dripper accompanied by a dynamic matching double-wall ceramic flask. Coated in a volcanic charcoal reactive glaze, making every piece entirely unique.",
      price: 750.00,
      salePrice: null,
      stock: 15,
      isVisible: true,
      isFeatured: true,
      averageRating: 4.7,
      reviewCount: 3,
      createdAt: now,
      updatedAt: now,
      location: "Accra",
      tag: "free_shipping",
      isBoosted: true,
      boostTier: "1_day",
      boostExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()
    },
    {
      id: "prod-diffuser",
      sellerId: "user-seller1",
      categoryId: "cat-lifestyle",
      name: "Solace Ultrasonic Diffuser",
      description: "Constructed of raw matte black terracotta, this ambient item uses micro-vibrations to diffuse essential aromas throughout 300sqft. Emits a cozy warm amber candle glow that matches evening rhythms.",
      price: 400.00,
      salePrice: null,
      stock: 18,
      isVisible: true,
      isFeatured: false,
      averageRating: 4.6,
      reviewCount: 2,
      createdAt: now,
      updatedAt: now,
      location: "Koforidua",
      tag: null,
      isBoosted: false,
      boostTier: null,
      boostExpiresAt: null
    }
  ];

  const productImages: ProductImage[] = [
    { id: "img-1", productId: "prod-earbuds", url: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=500", isPrimary: true, order: 1 },
    { id: "img-2", productId: "prod-keyboard", url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=500", isPrimary: true, order: 1 },
    { id: "img-3", productId: "prod-lamp", url: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&q=80&w=500", isPrimary: true, order: 1 },
    { id: "img-4", productId: "prod-deskmat", url: "https://images.unsplash.com/photo-1616440347437-b1c73416efc2?auto=format&fit=crop&q=80&w=500", isPrimary: true, order: 1 },
    { id: "img-5", productId: "prod-laptopstand", url: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=500", isPrimary: true, order: 1 },
    { id: "img-6", productId: "prod-pouch", url: "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&q=80&w=500", isPrimary: true, order: 1 },
    { id: "img-7", productId: "prod-vessel", url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=500", isPrimary: true, order: 1 },
    { id: "img-8", productId: "prod-diffuser", url: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&q=80&w=500", isPrimary: true, order: 1 }
  ];

  const reviews: Review[] = [
    { id: "rev-1", productId: "prod-earbuds", userId: "user-customer1", userName: "Sarah Jenkins", rating: 5, comment: "Bespoke acoustic quality and very light fit! Highly recommend to anybody looking for daily essentials.", createdAt: now },
    { id: "rev-2", productId: "prod-earbuds", userId: "user-admin", userName: "Admin Reviewer", rating: 4, comment: "Subtle build and deep bass response. Fits very neatly during physical habits.", createdAt: now },
    { id: "rev-3", productId: "prod-earbuds", userId: "user-seller1", userName: "Marcus (Seller)", rating: 5, comment: "Our absolute best creation of the season. Handcrafted in minor lots.", createdAt: now },
    { id: "rev-4", productId: "prod-keyboard", userId: "user-customer1", userName: "Sarah Jenkins", rating: 5, comment: "I am absolutely in love with this walnut chassis. Dynamic tactile typing, very silent!", createdAt: now },
    { id: "rev-5", productId: "prod-lamp", userId: "user-customer1", userName: "Sarah Jenkins", rating: 4, comment: "Great light customization, but stand is somewhat heavier than I realized.", createdAt: now },
    { id: "rev-6", productId: "prod-lamp", userId: "user-admin", userName: "Admin User", rating: 4, comment: "High finish quality. Qi charge operates exactly at spec.", createdAt: now }
  ];

  const announcements: Announcement[] = [
    {
      id: "ann-welcome",
      title: "Grand Opening Season in Ghana",
      body: "Discover boutique tech accessories and hand-finished workspace assets sourced with extreme focus on quality and environmental durability. Now offering free shipping to Accra and Kumasi!",
      startDate: now,
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      isActive: true
    }
  ];

  const settings: Settings = {
    id: "global-settings",
    platformName: "Dataghmart",
    heroHeadline: "Minimalist Essentials for Modern Ghanaian Routines",
    heroSubheadline: "Experience a curated collection of sensory technology, custom mechanical gear, and artisan stoneware crafted to last. Fast local delivery in Ghana.",
    heroImageUrl: "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&q=80&w=1200",
    promoText: "🌟 SPECIAL OFFER: Pay instantly using Paystack and claim your free shipping tag!",
    contactEmail: "hello@dataghmart.com.gh",
    shopAddress: "88 Ring Road Central, Cantonments, Accra, Ghana"
  };

  return {
    users,
    categories,
    products,
    productImages,
    carts: [],
    cartItems: [],
    orders: [],
    orderItems: [],
    orderStatusHistory: [],
    reviews,
    notifications: [],
    wishlists: [],
    auditLogs: [],
    announcements,
    settings,
    sessionLogs: [],
    withdrawals: []
  };
}

// ---- STRATEGIC DATABASE OPERATORS ----

export const dbManager = {
  getUsers: () => loadDatabase().users,
  addUser: async (user: User) => {
    const db = loadDatabase();
    db.users.push(user);
    await saveDatabase(db);
  },
  updateUser: async (id: string, builder: (user: User) => void) => {
    const db = loadDatabase();
    const idx = db.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      builder(db.users[idx]);
      db.users[idx].updatedAt = new Date().toISOString();
      await saveDatabase(db);
      return db.users[idx];
    }
    return null;
  },

  getCategories: () => loadDatabase().categories,
  addCategory: async (category: Category) => {
    const db = loadDatabase();
    db.categories.push(category);
    await saveDatabase(db);
  },
  updateCategory: async (id: string, builder: (cat: Category) => void) => {
    const db = loadDatabase();
    const idx = db.categories.findIndex(c => c.id === id);
    if (idx !== -1) {
      builder(db.categories[idx]);
      await saveDatabase(db);
      return db.categories[idx];
    }
    return null;
  },
  deleteCategory: async (id: string) => {
    const db = loadDatabase();
    db.categories = db.categories.filter(c => c.id !== id);
    await saveDatabase(db);
  },

  getProducts: () => {
    const db = loadDatabase();
    // Re-verify average ratings dynamically from reviews
    return db.products.map(p => {
      const pReviews = db.reviews.filter(r => r.productId === p.id);
      if (pReviews.length > 0) {
        const sum = pReviews.reduce((acc, r) => acc + r.rating, 0);
        p.averageRating = Math.round((sum / pReviews.length) * 10) / 10;
        p.reviewCount = pReviews.length;
      } else {
        p.averageRating = 0;
        p.reviewCount = 0;
      }
      return p;
    });
  },
  getProductImages: () => loadDatabase().productImages,
  addProduct: async (product: Product, images: ProductImage[]) => {
    const db = loadDatabase();
    db.products.push(product);
    db.productImages.push(...images);
    await saveDatabase(db);
  },
  updateProduct: async (id: string, builder: (product: Product) => void) => {
    const db = loadDatabase();
    const idx = db.products.findIndex(p => p.id === id);
    if (idx !== -1) {
      builder(db.products[idx]);
      db.products[idx].updatedAt = new Date().toISOString();
      await saveDatabase(db);
      return db.products[idx];
    }
    return null;
  },
  deleteProduct: async (id: string) => {
    const db = loadDatabase();
    db.products = db.products.filter(p => p.id !== id);
    db.productImages = db.productImages.filter(img => img.productId !== id);
    db.cartItems = db.cartItems.filter(ci => ci.productId !== id);
    db.wishlists = db.wishlists.filter(w => w.productId !== id);
    await saveDatabase(db);
  },

  getCarts: () => loadDatabase().carts,
  getCartItems: () => loadDatabase().cartItems,
  getOrCreateCart: async (userId: string) => {
    const db = loadDatabase();
    let cart = db.carts.find(c => c.userId === userId);
    if (!cart) {
      cart = {
        id: "cart-" + crypto.randomUUID(),
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.carts.push(cart);
      await saveDatabase(db);
    }
    return cart;
  },
  addToCart: async (userId: string, productId: string, quantity: number) => {
    const db = loadDatabase();
    let cart = db.carts.find(c => c.userId === userId);
    if (!cart) {
      cart = {
        id: "cart-" + crypto.randomUUID(),
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.carts.push(cart);
    }
    
    // Check if item already exists in cart rules
    let item = db.cartItems.find(ci => ci.cartId === cart!.id && ci.productId === productId);
    if (item) {
      item.quantity += quantity;
    } else {
      item = {
        id: "ci-" + crypto.randomUUID(),
        cartId: cart.id,
        productId,
        quantity
      };
      db.cartItems.push(item);
    }
    await saveDatabase(db);
    return item;
  },
  updateCartItem: async (userId: string, cartItemId: string, quantity: number) => {
    const db = loadDatabase();
    const cart = db.carts.find(c => c.userId === userId);
    if (!cart) return false;

    const item = db.cartItems.find(ci => ci.id === cartItemId && ci.cartId === cart.id);
    if (item) {
      if (quantity <= 0) {
        db.cartItems = db.cartItems.filter(ci => ci.id !== cartItemId);
      } else {
        item.quantity = quantity;
      }
      await saveDatabase(db);
      return true;
    }
    return false;
  },
  removeCartItem: async (userId: string, cartItemId: string) => {
    const db = loadDatabase();
    const cart = db.carts.find(c => c.userId === userId);
    if (!cart) return false;

    db.cartItems = db.cartItems.filter(ci => ci.id !== cartItemId && ci.cartId === cart.id);
    await saveDatabase(db);
    return true;
  },
  clearCart: async (userId: string) => {
    const db = loadDatabase();
    const cart = db.carts.find(c => c.userId === userId);
    if (cart) {
      db.cartItems = db.cartItems.filter(ci => ci.cartId !== cart.id);
      await saveDatabase(db);
    }
  },

  getOrders: () => loadDatabase().orders,
  getOrderItems: () => loadDatabase().orderItems,
  getHistory: () => loadDatabase().orderStatusHistory,
  createOrder: async (order: Order, items: OrderItem[], historyRecord: OrderStatusHistory) => {
    const db = loadDatabase();
    
    // TRANSACTION-SAFE STOCK CHECKS
    for (const item of items) {
      const prod = db.products.find(p => p.id === item.productId);
      if (!prod || prod.stock < item.quantity) {
        throw new Error(`Insufficient stock for product: ${item.productName}`);
      }
    }

    // Decrement stocks safely and calculate commission splits (Deduction of Things)
    for (const item of items) {
      const prod = db.products.find(p => p.id === item.productId)!;
      prod.stock -= item.quantity;
      prod.updatedAt = new Date().toISOString();

      // Split payments
      const itemTotal = item.price * item.quantity;
      const commission = itemTotal * 0.055; // 5.5% platform deduction
      const sellerProfit = itemTotal - commission;

      // Transfer profit to seller wallet
      const seller = db.users.find(u => u.id === item.sellerId);
      if (seller) {
        seller.walletBalance = (seller.walletBalance || 0) + sellerProfit;
      }

      // Transfer platform fee to admin wallet
      const admin = db.users.find(u => u.role === "admin");
      if (admin) {
        admin.walletBalance = (admin.walletBalance || 0) + commission;
      }
    }

    // Capture the purchases
    db.orders.push(order);
    db.orderItems.push(...items);
    db.orderStatusHistory.push(historyRecord);

    await saveDatabase(db);
    return order;
  },
  updateOrderStatus: async (orderId: string, status: Order["status"], comment: string, changedBy: string) => {
    const db = loadDatabase();
    const order = db.orders.find(o => o.id === orderId);
    if (order) {
      const oldStatus = order.status;
      order.status = status;
      order.updatedAt = new Date().toISOString();

      // If cancelled, restore the stock count
      if (status === "cancelled" && oldStatus !== "cancelled") {
        const items = db.orderItems.filter(oi => oi.orderId === orderId);
        for (const item of items) {
          const prod = db.products.find(p => p.id === item.productId);
          if (prod) {
            prod.stock += item.quantity;
          }
        }
      }

      // Append timeline history
      const historyRecord: OrderStatusHistory = {
        id: "hist-" + crypto.randomUUID(),
        orderId,
        status,
        comment,
        changedBy,
        createdAt: new Date().toISOString()
      };
      db.orderStatusHistory.push(historyRecord);

      await saveDatabase(db);
      return order;
    }
    return null;
  },

  getReviews: () => loadDatabase().reviews,
  addReview: async (review: Review) => {
    const db = loadDatabase();
    db.reviews.push(review);
    await saveDatabase(db);
  },

  getNotifications: () => loadDatabase().notifications,
  addNotification: async (notif: Notification) => {
    const db = loadDatabase();
    db.notifications.push(notif);
    await saveDatabase(db);
  },
  markNotificationRead: async (userId: string, notifId: string) => {
    const db = loadDatabase();
    const notif = db.notifications.find(n => n.id === notifId && n.userId === userId);
    if (notif) {
      notif.isRead = true;
      await saveDatabase(db);
      return true;
    }
    return false;
  },

  getWishlists: () => loadDatabase().wishlists,
  toggleWishlist: async (userId: string, productId: string) => {
    const db = loadDatabase();
    const existing = db.wishlists.find(w => w.userId === userId && w.productId === productId);
    if (existing) {
      db.wishlists = db.wishlists.filter(w => w.id !== existing.id);
      await saveDatabase(db);
      return { action: "removed" };
    } else {
      const newItem: WishlistItem = {
        id: "wish-" + crypto.randomUUID(),
        userId,
        productId,
        addedAt: new Date().toISOString()
      };
      db.wishlists.push(newItem);
      await saveDatabase(db);
      return { action: "added", item: newItem };
    }
  },

  getAuditLogs: () => loadDatabase().auditLogs,
  addAuditLog: async (log: Omit<AuditLog, "id" | "createdAt">) => {
    const db = loadDatabase();
    const fullLog: AuditLog = {
      id: "log-" + crypto.randomUUID(),
      ...log,
      createdAt: new Date().toISOString()
    };
    db.auditLogs.push(fullLog);
    await saveDatabase(db);
  },

  getSessionLogs: () => {
    const db = loadDatabase();
    return db.sessionLogs || [];
  },
  addSessionLog: async (log: Omit<SessionLog, "id" | "createdAt">) => {
    const db = loadDatabase();
    if (!db.sessionLogs) db.sessionLogs = [];
    const newLog: SessionLog = {
      id: "sess-" + crypto.randomUUID().slice(0, 8),
      ...log,
      createdAt: new Date().toISOString()
    };
    db.sessionLogs.push(newLog);
    await saveDatabase(db);
    return newLog;
  },

  getWithdrawals: () => {
    const db = loadDatabase();
    return db.withdrawals || [];
  },
  addWithdrawal: async (w: Omit<WithdrawalRecord, "id" | "status" | "createdAt">) => {
    const db = loadDatabase();
    if (!db.withdrawals) db.withdrawals = [];
    const user = db.users.find(u => u.id === w.sellerId);
    if (!user || user.walletBalance < w.amount) {
      throw new Error("Insufficient funds for profit withdrawal.");
    }
    // Deduct from seller balance
    user.walletBalance -= w.amount;
    
    const newW: WithdrawalRecord = {
      id: "with-" + crypto.randomUUID().slice(0, 8),
      ...w,
      status: "pending",
      createdAt: new Date().toISOString()
    };
    db.withdrawals.push(newW);
    await saveDatabase(db);
    return newW;
  },
  updateWithdrawalStatus: async (id: string, status: "approved" | "failed") => {
    const db = loadDatabase();
    if (!db.withdrawals) db.withdrawals = [];
    const idx = db.withdrawals.findIndex(w => w.id === id);
    if (idx !== -1) {
      db.withdrawals[idx].status = status;
      // If failed, return funds to seller
      if (status === "failed") {
        const user = db.users.find(u => u.id === db.withdrawals[idx].sellerId);
        if (user) {
          user.walletBalance += db.withdrawals[idx].amount;
        }
      }
      await saveDatabase(db);
      return db.withdrawals[idx];
    }
    return null;
  },

  depositUserWallet: async (userId: string, amount: number) => {
    const db = loadDatabase();
    const user = db.users.find(u => u.id === userId);
    if (user) {
      user.walletBalance = (user.walletBalance || 0) + amount;
      await saveDatabase(db);
      return user;
    }
    return null;
  },
  deductUserWallet: async (userId: string, amount: number) => {
    const db = loadDatabase();
    const user = db.users.find(u => u.id === userId);
    if (user) {
      if ((user.walletBalance || 0) < amount) {
        throw new Error("Insufficient wallet balance.");
      }
      user.walletBalance -= amount;
      await saveDatabase(db);
      return user;
    }
    return null;
  },

  boostProduct: async (productId: string, tier: "1_day" | "3_days" | "1_month", cost: number) => {
    const db = loadDatabase();
    const product = db.products.find(p => p.id === productId);
    if (!product) throw new Error("Product not found");

    const user = db.users.find(u => u.id === product.sellerId);
    if (!user || user.walletBalance < cost) {
      throw new Error(`Insufficient wallet balance to buy boost. Cost is GH₵ ${cost}`);
    }

    // Deduct cost
    user.walletBalance -= cost;

    // Set boost details
    product.isBoosted = true;
    product.boostTier = tier;
    
    let days = 1;
    if (tier === "3_days") days = 3;
    if (tier === "1_month") days = 30;

    product.boostExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * days).toISOString();
    product.updatedAt = new Date().toISOString();

    await saveDatabase(db);
    return product;
  },

  getAnnouncements: () => loadDatabase().announcements,
  addAnnouncement: async (ann: Announcement) => {
    const db = loadDatabase();
    db.announcements.push(ann);
    await saveDatabase(db);
  },
  updateAnnouncement: async (id: string, builder: (ann: Announcement) => void) => {
    const db = loadDatabase();
    const idx = db.announcements.findIndex(a => a.id === id);
    if (idx !== -1) {
      builder(db.announcements[idx]);
      await saveDatabase(db);
      return db.announcements[idx];
    }
    return null;
  },
  deleteAnnouncement: async (id: string) => {
    const db = loadDatabase();
    db.announcements = db.announcements.filter(a => a.id !== id);
    await saveDatabase(db);
  },

  getSettings: () => loadDatabase().settings,
  updateSettings: async (builder: (sets: Settings) => void) => {
    const db = loadDatabase();
    builder(db.settings);
    await saveDatabase(db);
    return db.settings;
  }
};
