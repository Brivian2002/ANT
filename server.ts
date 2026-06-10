import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { dbManager, User, Product, Category, Order, OrderItem, Review, Announcement, Settings, Notification, ProductImage, SessionLog, WithdrawalRecord } from "./src/db/db.js";
import fs from "fs";

// Helper password hashing (matching db.ts sha256 method)
function hashPassword(plain: string) {
  return crypto.createHash("sha256").update(plain + "salt123").digest("hex");
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" })); // allow large base64 strings

// Ensure uploads folder exists and serve it statically
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use("/uploads", express.static(UPLOADS_DIR));

// ---- AUTHENTICATION MIDDLEWARE ----

// We use simple token-based headers for robust iframe execution: "Authorization: Bearer <user-id>"
interface AuthenticatedRequest extends express.Request {
  user?: User;
}

const authenticateUser = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next();
    return;
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    next();
    return;
  }

  // Token is formatted as: auth-session-<userId>
  if (token.startsWith("auth-session-")) {
    const userId = token.replace("auth-session-", "");
    const users = dbManager.getUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
      req.user = user;
    }
  }
  next();
};

app.use(authenticateUser);

// Gates
const requireAuth = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required to perform this action." });
    return;
  }
  next();
};

const requireSeller = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  if (req.user.role !== "seller" && req.user.role !== "admin") {
    res.status(403).json({ error: "Access denied. Seller capabilities required." });
    return;
  }
  if (req.user.role === "seller" && !req.user.sellerApproved) {
    res.status(403).json({ error: "Access denied. Your seller account is pending admin approval." });
    return;
  }
  next();
};

const requireAdmin = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Access denied. Admin authorization required." });
    return;
  }
  next();
};

// ---- AUTHENTICATION ENDPOINTS ----

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, isSeller, storeName, storeDescription, location } = req.body;
    
    if (!name || !email || !password) {
      res.status(400).json({ error: "Please enter all required fields." });
      return;
    }

    const emailNorm = email.toLowerCase().trim();
    const existing = dbManager.getUsers().find(u => u.email.toLowerCase() === emailNorm);
    if (existing) {
      res.status(400).json({ error: "An account with this email already exists." });
      return;
    }

    const newUser: User = {
      id: "user-" + crypto.randomUUID(),
      name: name.trim(),
      email: emailNorm,
      passwordHash: hashPassword(password),
      role: isSeller ? "seller" : "customer",
      sellerApproved: !isSeller, // Automatically approved if normal customer, pending if seller
      avatarUrl: `https://images.unsplash.com/photo-${isSeller ? "1472099645785-5658abf4ff4e" : "1534528741775-53994a69daeb"}?auto=format&fit=crop&q=80&w=120`,
      storeName: isSeller ? (storeName || `${name}'s Boutique`) : undefined,
      storeDescription: isSeller ? (storeDescription || "A beautiful curated lifestyle collection.") : undefined,
      walletBalance: 0, // default wallet balance GHS
      location: location || "Accra", // default Ghanaian city
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await dbManager.addUser(newUser);

    // Dynamic session audit log
    await dbManager.addSessionLog({
      userId: newUser.id,
      userName: newUser.name,
      userEmail: newUser.email,
      action: "LOGIN"
    });

    res.status(201).json({
      token: `auth-session-${newUser.id}`,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        sellerApproved: newUser.sellerApproved,
        avatarUrl: newUser.avatarUrl,
        storeName: newUser.storeName,
        storeDescription: newUser.storeDescription,
        walletBalance: newUser.walletBalance,
        location: newUser.location
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Please enter your email and password." });
      return;
    }

    const user = dbManager.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (!user || user.passwordHash !== hashPassword(password)) {
      res.status(400).json({ error: "Invalid email and/or password combined." });
      return;
    }

    // Capture Session Log
    await dbManager.addSessionLog({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      action: "LOGIN"
    });

    res.json({
      token: `auth-session-${user.id}`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        sellerApproved: user.sellerApproved,
        avatarUrl: user.avatarUrl,
        storeName: user.storeName,
        storeDescription: user.storeDescription,
        walletBalance: user.walletBalance,
        location: user.location
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/logout", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await dbManager.addSessionLog({
      userId: req.user!.id,
      userName: req.user!.name,
      userEmail: req.user!.email,
      action: "LOGOUT"
    });
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/auth/me", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const updatedUser = dbManager.getUsers().find(u => u.id === req.user!.id);
    if (!updatedUser) {
      res.status(404).json({ error: "User profile not found." });
      return;
    }
    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      avatarUrl: updatedUser.avatarUrl,
      walletBalance: updatedUser.walletBalance || 0,
      sellerApproved: updatedUser.sellerApproved,
      storeName: updatedUser.storeName,
      storeDescription: updatedUser.storeDescription,
      createdAt: updatedUser.createdAt
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Custom Secret Login Endpoint
app.post("/api/auth/admin-login", async (req, res) => {
  try {
    const { adminSecret } = req.body;
    if (!adminSecret) {
      res.status(400).json({ error: "Please provide the admin portal passphrase." });
      return;
    }

    const ENV_SECRET = process.env.ADMIN_SECRET || "admin123";
    
    // Constant time comparison
    const bufSubmitted = Buffer.from(adminSecret);
    const bufEnv = Buffer.from(ENV_SECRET);
    const comparisonSuccess = bufSubmitted.length === bufEnv.length && crypto.timingSafeEqual(bufSubmitted, bufEnv);

    if (!comparisonSuccess) {
      res.status(401).json({ error: "Invalid admin passphrase. Access denied." });
      return;
    }

    // Load or generate admin profile
    let adminUser = dbManager.getUsers().find(u => u.role === "admin");
    if (!adminUser) {
      // Dynamic fallback
      adminUser = {
        id: "user-admin",
        name: "Shop Administrator",
        email: "admin@smarthub.com",
        passwordHash: hashPassword(ENV_SECRET),
        role: "admin",
        sellerApproved: true,
        avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120",
        walletBalance: 0,
        location: "Accra",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await dbManager.addUser(adminUser);
    }

    await dbManager.addSessionLog({
      userId: adminUser.id,
      userName: adminUser.name,
      userEmail: adminUser.email,
      action: "LOGIN"
    });

    res.json({
      token: `auth-session-${adminUser.id}`,
      user: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        role: "admin",
        sellerApproved: true,
        avatarUrl: adminUser.avatarUrl,
        walletBalance: adminUser.walletBalance || 0,
        location: adminUser.location || "Accra"
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---- CORE STORE FRONTEND CONFIGURATION ----

app.get("/api/config", (req, res) => {
  try {
    const sets = dbManager.getSettings();
    const activeAnns = dbManager.getAnnouncements().filter(a => a.isActive);
    res.json({ settings: sets, announcements: activeAnns });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---- CATALOG ENDPOINTS ----

app.get("/api/categories", (req, res) => {
  res.json(dbManager.getCategories());
});

app.get("/api/products", (req, res) => {
  try {
    const { q, category, sort, minPrice, maxPrice, inStockOnly, location, tag, timeFilter } = req.query;
    let products = dbManager.getProducts();

    // 1. Core Visibility Check
    products = products.filter(p => p.isVisible);

    // 2. Query Category filter
    if (category) {
      const cats = dbManager.getCategories();
      const matchingCat = cats.find(c => c.slug === category || c.id === category);
      if (matchingCat) {
        products = products.filter(p => p.categoryId === matchingCat.id);
      }
    }

    // 3. Search query
    if (q) {
      const searchStr = String(q).toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(searchStr) || 
        p.description.toLowerCase().includes(searchStr)
      );
    }

    // 4. Custom Location Filtering (Accra, Kumasi etc.)
    if (location && location !== "all") {
      products = products.filter(p => p.location.toLowerCase() === String(location).toLowerCase());
    }

    // 5. Custom Tag Filtering (free_shipping etc.)
    if (tag && tag !== "all") {
      products = products.filter(p => p.tag === tag);
    }

    // 6. Custom Upload Timing Filtering (24h, week)
    if (timeFilter && timeFilter !== "all") {
      const limitMs = timeFilter === "24h" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
      products = products.filter(p => (Date.now() - new Date(p.createdAt).getTime()) <= limitMs);
    }

    // 7. Price Boundaries
    if (minPrice) {
      const min = parseFloat(String(minPrice));
      products = products.filter(p => (p.salePrice || p.price) >= min);
    }
    if (maxPrice) {
      const max = parseFloat(String(maxPrice));
      products = products.filter(p => (p.salePrice || p.price) <= max);
    }

    // 8. In Stock Filtering
    if (inStockOnly === "true") {
      products = products.filter(p => p.stock > 0);
    }

    // 9. Sorting & Ad Boost Prioritized Ranking Algorithm
    const runSort = () => {
      if (sort === "price-asc") {
        products.sort((a, b) => (a.salePrice || a.price) - (b.salePrice || b.price));
      } else if (sort === "price-desc") {
        products.sort((a, b) => (b.salePrice || b.price) - (a.salePrice || a.price));
      } else if (sort === "rating") {
        products.sort((a, b) => b.averageRating - a.averageRating);
      } else if (sort === "newest") {
        products.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } else if (sort === "best-sellers") {
        const oItems = dbManager.getOrderItems();
        const purchaseCountMap: Record<string, number> = {};
        oItems.forEach(oi => {
          purchaseCountMap[oi.productId] = (purchaseCountMap[oi.productId] || 0) + oi.quantity;
        });
        products.sort((a, b) => (purchaseCountMap[b.id] || 0) - (purchaseCountMap[a.id] || 0));
      } else {
        // DEFAULT RELEVANCE SCORE RANKING ALGORITHM WITH INTEGRATED AD BOOST SYSTEM
        // relevance = (sales_count_last_30_days * 2) + (average_rating * 10) + (is_featured ? 50 : 0) - (days_since_creation * 0.1)
        const oItems = dbManager.getOrderItems();
        const salesCountMap: Record<string, number> = {};
        oItems.forEach(oi => {
          salesCountMap[oi.productId] = (salesCountMap[oi.productId] || 0) + oi.quantity;
        });

        const getRelevance = (p: Product) => {
          const sales = salesCountMap[p.id] || 0;
          const rating = p.averageRating || 0;
          const featuredBonus = p.isFeatured ? 50 : 0;
          const daysSince = (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          return (sales * 2) + (rating * 10) + featuredBonus - (daysSince * 0.1);
        };

        products.sort((a, b) => getRelevance(b) - getRelevance(a));
      }
    };

    runSort();

    // ALWAYS rank boosted sponsored items strictly at the top (Ad System integration requirement)
    products.sort((a, b) => {
      const aVal = a.isBoosted ? 1 : 0;
      const bVal = b.isBoosted ? 1 : 0;
      return bVal - aVal;
    });

    // Enrich products with primary and secondary images
    const images = dbManager.getProductImages();
    const enriched = products.map(p => {
      const pImages = images.filter(img => img.productId === p.id).sort((a, b) => a.order - b.order);
      const seller = dbManager.getUsers().find(u => u.id === p.sellerId);
      return {
        ...p,
        images: pImages,
        primaryImage: pImages.find(img => img.isPrimary)?.url || pImages[0]?.url || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&q=80&w=400",
        sellerName: seller?.storeName || seller?.name || "Independent Seller"
      };
    });

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/products/:id", (req, res) => {
  const products = dbManager.getProducts();
  const p = products.find(prod => prod.id === req.params.id);
  
  if (!p) {
    res.status(404).json({ error: "Product not found." });
    return;
  }

  const pImages = dbManager.getProductImages().filter(img => img.productId === p.id).sort((a, b) => a.order - b.order);
  const reviews = dbManager.getReviews().filter(r => r.productId === p.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const seller = dbManager.getUsers().find(u => u.id === p.sellerId);

  res.json({
    ...p,
    images: pImages,
    reviews,
    seller: seller ? {
      id: seller.id,
      name: seller.name,
      avatarUrl: seller.avatarUrl,
      storeName: seller.storeName || seller.name,
      storeDescription: seller.storeDescription || ""
    } : null
  });
});

// ---- SELLERS ENDPOINTS ----

app.post("/api/products", requireSeller, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description, price, salePrice, stock, categoryId, imageUrls } = req.body;
    
    if (!name || !description || !price || !stock || !categoryId) {
      res.status(400).json({ error: "Incomplete fields." });
      return;
    }

    const newProdId = "prod-" + crypto.randomUUID();
    const now = new Date().toISOString();

    const product: Product = {
      id: newProdId,
      sellerId: req.user!.id,
      categoryId,
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      salePrice: salePrice ? parseFloat(salePrice) : null,
      stock: parseInt(stock),
      isVisible: true,
      isFeatured: false,
      averageRating: 0,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
      location: req.user?.location || "Accra",
      tag: req.body.tag || null,
      isBoosted: false,
      boostTier: null,
      boostExpiresAt: null
    };

    const imgs: ProductImage[] = [];
    if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
      imageUrls.forEach((url, i) => {
        imgs.push({
          id: "img-" + crypto.randomUUID(),
          productId: newProdId,
          url: url || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&q=80&w=400",
          isPrimary: i === 0,
          order: i + 1
        });
      });
    } else {
      imgs.push({
        id: "img-" + crypto.randomUUID(),
        productId: newProdId,
        url: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&q=80&w=400",
        isPrimary: true,
        order: 1
      });
    }

    await dbManager.addProduct(product, imgs);

    await dbManager.addAuditLog({
      userId: req.user!.id,
      action: "CREATE_PRODUCT",
      details: `Created product "${product.name}" in category ${categoryId}`,
      ipAddress: req.ip || "127.0.0.1"
    });

    res.status(201).json(product);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/products/:id", requireSeller, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description, price, salePrice, stock, categoryId, isVisible, imageUrls } = req.body;
    const prodId = req.params.id;

    const products = dbManager.getProducts();
    const p = products.find(prod => prod.id === prodId);
    if (!p) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    // Gate seller owner
    if (p.sellerId !== req.user!.id && req.user!.role !== "admin") {
      res.status(403).json({ error: "Unauthorized access list modification." });
      return;
    }

    await dbManager.updateProduct(prodId, (prod) => {
      if (name !== undefined) prod.name = name.trim();
      if (description !== undefined) prod.description = description.trim();
      if (price !== undefined) prod.price = parseFloat(price);
      if (salePrice !== undefined) prod.salePrice = salePrice ? parseFloat(salePrice) : null;
      if (stock !== undefined) prod.stock = parseInt(stock);
      if (categoryId !== undefined) prod.categoryId = categoryId;
      if (isVisible !== undefined) prod.isVisible = Boolean(isVisible);
    });

    // Write updated audit log
    await dbManager.addAuditLog({
      userId: req.user!.id,
      action: "UPDATE_PRODUCT",
      details: `Updated product "${p.name}" fields.`,
      ipAddress: req.ip || "127.0.0.1"
    });

    res.json({ message: "Successfully updated product.", id: prodId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/products/:id", requireSeller, async (req: AuthenticatedRequest, res) => {
  try {
    const prodId = req.params.id;
    const products = dbManager.getProducts();
    const p = products.find(prod => prod.id === prodId);
    if (!p) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    if (p.sellerId !== req.user!.id && req.user!.role !== "admin") {
      res.status(403).json({ error: "Unauthorized." });
      return;
    }

    await dbManager.deleteProduct(prodId);

    await dbManager.addAuditLog({
      userId: req.user!.id,
      action: "DELETE_PRODUCT",
      details: `Removed product "${p.name}" permanently.`,
      ipAddress: req.ip || "127.0.0.1"
    });

    res.json({ success: true, message: "Product deleted successfully." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---- CART RESTFUL ENDPOINTS ----

app.get("/api/cart", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const cart = await dbManager.getOrCreateCart(req.user!.id);
    const cartItems = dbManager.getCartItems().filter(ci => ci.cartId === cart.id);
    const products = dbManager.getProducts();
    const images = dbManager.getProductImages();

    const items = cartItems.map(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (!p) return null;
      
      const primaryImg = images.find(img => img.productId === p.id && img.isPrimary)?.url || images.find(img => img.productId === p.id)?.url;
      const unitPrice = p.salePrice !== null ? p.salePrice : p.price;

      return {
        id: item.id,
        productId: p.id,
        name: p.name,
        price: unitPrice,
        stock: p.stock,
        quantity: item.quantity,
        total: unitPrice * item.quantity,
        imageUrl: primaryImg || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&q=80&w=260"
      };
    }).filter(Boolean);

    const subtotal = items.reduce((acc, current) => acc + (current?.total || 0), 0);
    res.json({ id: cart.id, items, subtotal, total: subtotal });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/cart", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { productId, quantity } = req.body;
    if (!productId) {
      res.status(400).json({ error: "productId required." });
      return;
    }

    const p = dbManager.getProducts().find(prod => prod.id === productId);
    if (!p) {
      res.status(404).json({ error: "Product does not exist." });
      return;
    }

    const qty = parseInt(quantity) || 1;
    if (p.stock < qty) {
      res.status(400).json({ error: "Not enough stock in inventory to purchase." });
      return;
    }

    await dbManager.addToCart(req.user!.id, productId, qty);
    res.json({ success: true, message: "Added item to cart." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/cart/:itemId", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { quantity } = req.body;
    const success = await dbManager.updateCartItem(req.user!.id, req.params.itemId, parseInt(quantity));
    if (success) {
      res.json({ success: true, message: "Cart item updated." });
    } else {
      res.status(404).json({ error: "Cart item not found." });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/cart/:itemId", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const success = await dbManager.removeCartItem(req.user!.id, req.params.itemId);
    if (success) {
      res.json({ success: true, message: "Cart item removed." });
    } else {
      res.status(404).json({ error: "Cart item not found." });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---- ORDERS & TRACKING ----

app.get("/api/orders", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const allOrders = dbManager.getOrders();
    const orderItems = dbManager.getOrderItems();
    const products = dbManager.getProducts();

    let userOrders = [];
    if (req.user!.role === "admin") {
      userOrders = allOrders;
    } else if (req.user!.role === "seller") {
      // Find orders containing seller products
      const sellerItems = orderItems.filter(oi => oi.sellerId === req.user!.id);
      const sellerOrderIds = Array.from(new Set(sellerItems.map(si => si.orderId)));
      userOrders = allOrders.filter(o => sellerOrderIds.includes(o.id));
    } else {
      userOrders = allOrders.filter(o => o.userId === req.user!.id);
    }

    // Enrich orders with item data
    const enriched = userOrders.map(o => {
      let filteredItems = orderItems.filter(oi => oi.orderId === o.id);
      if (req.user!.role === "seller") {
        filteredItems = filteredItems.filter(oi => oi.sellerId === req.user!.id);
      }
      return {
        ...o,
        items: filteredItems,
        history: dbManager.getHistory().filter(h => h.orderId === o.id).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/orders/:id", requireAuth, (req: AuthenticatedRequest, res) => {
  const o = dbManager.getOrders().find(order => order.id === req.params.id);
  if (!o) {
    res.status(404).json({ error: "Order not found." });
    return;
  }

  // Verification checks
  if (o.userId !== req.user!.id && req.user!.role !== "admin" && req.user!.role !== "seller") {
    res.status(403).json({ error: "Unauthorized access to order." });
    return;
  }

  const items = dbManager.getOrderItems().filter(oi => oi.orderId === o.id);
  const history = dbManager.getHistory().filter(h => h.orderId === o.id).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  res.json({ ...o, items, history });
});

app.post("/api/orders", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { shippingAddress, paymentMethod, notes } = req.body;
    
    if (!shippingAddress || !shippingAddress.name || !shippingAddress.street || !shippingAddress.city || !shippingAddress.postalCode) {
      res.status(400).json({ error: "Please enter a valid shipping address." });
      return;
    }

    const cart = await dbManager.getOrCreateCart(req.user!.id);
    const cartItems = dbManager.getCartItems().filter(ci => ci.cartId === cart.id);
    if (cartItems.length === 0) {
      res.status(400).json({ error: "Your shopping cart is empty." });
      return;
    }

    const products = dbManager.getProducts();
    const orderItems: OrderItem[] = [];
    let subtotal = 0;

    // Validate quantities and pricing snapshots
    for (const item of cartItems) {
      const p = products.find(prod => prod.id === item.productId);
      if (!p) {
        res.status(400).json({ error: `Product no longer exists in our shop.` });
        return;
      }
      if (p.stock < item.quantity) {
        res.status(400).json({ error: `Insufficient stock for product: ${p.name}. Only ${p.stock} units remaining.` });
        return;
      }
      const finalPrice = p.salePrice !== null ? p.salePrice : p.price;
      orderItems.push({
        id: "oi-" + crypto.randomUUID(),
        orderId: "", // Completed on transaction
        productId: p.id,
        sellerId: p.sellerId,
        productName: p.name,
        price: finalPrice,
        quantity: item.quantity
      });
      subtotal += finalPrice * item.quantity;
    }

    // CHECKOUT WALLET PAYMENT DEBIT
    if (paymentMethod === "Wallet") {
      if ((req.user!.walletBalance || 0) < subtotal) {
        res.status(400).json({ error: `Insufficient wallet balance. Cart total is GH₵ ${subtotal}, but your balance is only GH₵ ${req.user!.walletBalance || 0}` });
        return;
      }
      await dbManager.deductUserWallet(req.user!.id, subtotal);
    }

    const orderId = "order-" + crypto.randomUUID().slice(0, 18);
    const now = new Date().toISOString();

    const orderRecord: Order = {
      id: orderId,
      userId: req.user!.id,
      status: "payment_received", // Automatically transitions as paid
      shippingAddress,
      subtotal,
      discount: 0,
      total: subtotal,
      paymentMethod: paymentMethod || "Paystack Checkout",
      trackingNumber: null,
      notes: notes || null,
      createdAt: now,
      updatedAt: now,
      deliveryDays: 3, // Default 3 delivery tracker days loading loop
      estimatedDeliveryAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString()
    };

    // Attach order ID to items
    orderItems.forEach(oi => {
      oi.orderId = orderId;
    });

    const timelineHistory = {
      id: "hist-" + crypto.randomUUID(),
      orderId,
      status: "payment_received" as const,
      comment: paymentMethod === "Wallet" ? "Paid instantly via Cantonments Wallet." : "Simulated paystack checkout captured.",
      changedBy: "System",
      createdAt: now
    };

    // Run Atomically inside DB
    await dbManager.createOrder(orderRecord, orderItems, timelineHistory);

    // Clear user cart safely
    await dbManager.clearCart(req.user!.id);

    // Dynamic notification triggers for sellers
    const uniqueSellerIds = Array.from(new Set(orderItems.map(oi => oi.sellerId)));
    for (const sId of uniqueSellerIds) {
      await dbManager.addNotification({
        id: "notif-" + crypto.randomUUID(),
        userId: sId,
        type: "order_placed",
        message: `An order (${orderId}) and items were received inside Cantonments Dataghmart.`,
        isRead: false,
        createdAt: now
      });
    }

    await dbManager.addAuditLog({
      userId: req.user!.id,
      userName: req.user!.name,
      action: "CREATE_ORDER",
      details: `Placed order ${orderId} total GH₵ ${subtotal} via ${paymentMethod}`,
      ipAddress: req.ip || "127.0.0.1"
    });

    res.status(201).json(orderRecord);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/orders/:id/status", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, comment, trackingNumber } = req.body;
    const orderId = req.params.id;

    const orders = dbManager.getOrders();
    const o = orders.find(ord => ord.id === orderId);
    if (!o) {
      res.status(404).json({ error: "Order not found." });
      return;
    }

    // Role gate
    if (req.user!.role !== "admin" && req.user!.role !== "seller") {
      res.status(403).json({ error: "Unauthorized status change." });
      return;
    }

    const changer = req.user!.name;
    const updated = await dbManager.updateOrderStatus(orderId, status, comment || `Status updated to ${status}`, changer);

    if (trackingNumber && req.user!.role === "seller") {
      const db = dbManager.getOrders();
      const match = db.find(ot => ot.id === orderId);
      if (match) {
        match.trackingNumber = trackingNumber;
        // save
        const full = { ...dbManager.getUsers(), users: dbManager.getUsers(), categories: dbManager.getCategories(), products: dbManager.getProducts(), productImages: dbManager.getProductImages(), carts: dbManager.getCarts(), cartItems: dbManager.getCartItems(), orders: db, orderItems: dbManager.getOrderItems(), orderStatusHistory: dbManager.getHistory(), reviews: dbManager.getReviews(), notifications: dbManager.getNotifications(), wishlists: dbManager.getWishlists(), auditLogs: dbManager.getAuditLogs(), announcements: dbManager.getAnnouncements(), settings: dbManager.getSettings() };
        // We can do standard update
      }
    }

    // Notify customer
    await dbManager.addNotification({
      id: "notif-" + crypto.randomUUID(),
      userId: o.userId,
      type: "order_shipped",
      message: `Your order ${orderId} is now: ${status.toUpperCase()}.`,
      isRead: false,
      createdAt: new Date().toISOString()
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---- DISCOVER & ENGAGEMENT: REVIEWS ----

app.post("/api/reviews", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { productId, rating, comment } = req.body;

    if (!productId || !rating || !comment) {
      res.status(400).json({ error: "Incomplete fields." });
      return;
    }

    const products = dbManager.getProducts();
    const p = products.find(prod => prod.id === productId);
    if (!p) {
      res.status(404).json({ error: "Product not found." });
      return;
    }

    const activeRating = parseInt(rating);
    if (activeRating < 1 || activeRating > 5) {
      res.status(400).json({ error: "Rating must be an integer between 1 and 5." });
      return;
    }

    const review: Review = {
      id: "rev-" + crypto.randomUUID(),
      productId,
      userId: req.user!.id,
      userName: req.user!.name,
      rating: activeRating,
      comment: comment.trim(),
      createdAt: new Date().toISOString()
    };

    await dbManager.addReview(review);
    res.status(201).json(review);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---- ACTIONS ENGAGEMENT: WISHLIST ----

app.get("/api/wishlist", requireAuth, (req: AuthenticatedRequest, res) => {
  const wish = dbManager.getWishlists().filter(w => w.userId === req.user!.id);
  const products = dbManager.getProducts();
  const images = dbManager.getProductImages();

  const records = wish.map(w => {
    const p = products.find(prod => prod.id === w.productId);
    if (!p) return null;
    return {
      ...p,
      primaryImage: images.find(img => img.productId === p.id && img.isPrimary)?.url || images.find(img => img.productId === p.id)?.url
    };
  }).filter(Boolean);

  res.json(records);
});

app.post("/api/wishlist/toggle", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { productId } = req.body;
    const result = await dbManager.toggleWishlist(req.user!.id, productId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---- NOTIFICATIONS ----

app.get("/api/notifications", requireAuth, (req: AuthenticatedRequest, res) => {
  const feed = dbManager.getNotifications()
    .filter(n => n.userId === req.user!.id)
    .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(feed);
});

app.put("/api/notifications/:id/read", requireAuth, async (req: AuthenticatedRequest, res) => {
  const success = await dbManager.markNotificationRead(req.user!.id, req.params.id);
  res.json({ success });
});

// ---- ADMIN DASHBOARD SECURE KPIS & CONTROLS ----

app.get("/api/admin/metrics", requireAdmin, (req, res) => {
  try {
    const users = dbManager.getUsers();
    const products = dbManager.getProducts();
    const orders = dbManager.getOrders();
    const logs = dbManager.getAuditLogs().sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Analytics computation
    const totalRev = orders.filter(o => o.status !== "cancelled").reduce((acc, current) => acc + current.total, 0);
    const lowStockCount = products.filter(p => p.stock <= 5).length;

    res.json({
      summary: {
        totalUsers: users.length,
        totalSellers: users.filter(u => u.role === "seller").length,
        pendingSellers: users.filter(u => u.role === "seller" && !u.sellerApproved).length,
        totalProducts: products.length,
        totalOrders: orders.length,
        totalRevenue: Math.round(totalRev * 100) / 100,
        lowStockItems: lowStockCount
      },
      recentLogs: logs.slice(0, 50)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/users", requireAdmin, (req, res) => {
  res.json(dbManager.getUsers().map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    sellerApproved: u.sellerApproved,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt
  })));
});

app.put("/api/admin/users/:userId/role", requireAdmin, async (req, res) => {
  try {
    const { role, sellerApproved } = req.body;
    const userId = req.params.userId;

    const updated = await dbManager.updateUser(userId, (usr) => {
      if (role !== undefined) usr.role = role;
      if (sellerApproved !== undefined) usr.sellerApproved = Boolean(sellerApproved);
    });

    if (updated) {
      await dbManager.addAuditLog({
        userId: "admin",
        action: "MODERATE_USER",
        details: `Updated user (id: ${userId}) role: ${role}, approved: ${sellerApproved}`,
        ipAddress: req.ip || "127.0.0.1"
      });
      res.json(updated);
    } else {
      res.status(404).json({ error: "User not found." });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/announcements", requireAdmin, async (req, res) => {
  try {
    const { title, body } = req.body;
    if (!title || !body) {
      res.status(400).json({ error: "Enter title and body." });
      return;
    }
    
    // De-activate older announcements first
    const db = dbManager.getAnnouncements();
    for (const a of db) {
      a.isActive = false;
    }

    const newAnn: Announcement = {
      id: "ann-" + crypto.randomUUID(),
      title,
      body,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      isActive: true
    };

    await dbManager.addAnnouncement(newAnn);
    res.json(newAnn);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/settings", requireAdmin, async (req, res) => {
  try {
    const { platformName, heroHeadline, heroSubheadline, promoText, contactEmail } = req.body;
    const updated = await dbManager.updateSettings((sets) => {
      if (platformName) sets.platformName = platformName;
      if (heroHeadline) sets.heroHeadline = heroHeadline;
      if (heroSubheadline) sets.heroSubheadline = heroSubheadline;
      if (promoText) sets.promoText = promoText;
      if (contactEmail) sets.contactEmail = contactEmail;
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---- FILE BASE64 UPLOADER ENDPOINT ----
app.post("/api/upload", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, base64 } = req.body;
    if (!name || !base64) {
      res.status(400).json({ error: "Missing file name or base64 data." });
      return;
    }

    // Isolate base64 header from raw binary
    const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let dataBuffer: Buffer;
    if (matches && matches.length === 3) {
      dataBuffer = Buffer.from(matches[2], "base64");
    } else {
      dataBuffer = Buffer.from(base64, "base64");
    }

    const fileExt = path.extname(name) || ".jpg";
    const uniqueFileName = `${crypto.randomUUID()}${fileExt}`;
    const filePath = path.join(UPLOADS_DIR, uniqueFileName);

    fs.writeFileSync(filePath, dataBuffer);

    const publicUrl = `/uploads/${uniqueFileName}`;
    res.json({ url: publicUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---- PAYSTACK INTEGRATION ENDPOINTS ----
app.post("/api/paystack/initialize", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { amount, email, purpose } = req.body;
    if (!amount || parseFloat(amount) <= 0) {
      res.status(400).json({ error: "Positive deposit amount required." });
      return;
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY || "sk_live_67bf0681e848c094aea1f1a986181052f9522c19";
    const amountInPesewas = Math.round(parseFloat(amount) * 100);
    const reference = "pay_" + crypto.randomUUID().slice(0, 12);

    // Metadata payload keeping track of user profile properties
    const metadata = {
      userId: req.user!.id,
      userName: req.user!.name,
      purpose: purpose || "deposit",
      custom_fields: [
        {
          display_name: "Customer ID",
          variable_name: "userId",
          value: req.user!.id
        },
        {
          display_name: "Customer Name",
          variable_name: "userName",
          value: req.user!.name
        }
      ]
    };

    // Try communicating with Live Paystack API
    if (paystackSecret && !paystackSecret.includes("simulation")) {
      try {
        const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${paystackSecret}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: email || req.user!.email,
            amount: amountInPesewas,
            currency: "GHS",
            reference,
            callback_url: process.env.PAYSTACK_CALLBACK_URL || "https://dataghmart.vercel.app/payment/callback",
            metadata
          })
        });

        const paystackData = await paystackRes.json() as any;
        if (paystackRes.ok && paystackData.status) {
          res.json({
            status: true,
            message: paystackData.message || "Authorization URL created",
            reference: paystackData.data.reference || reference,
            authorizationUrl: paystackData.data.authorization_url,
            authorization_url: paystackData.data.authorization_url,
            data: {
              authorization_url: paystackData.data.authorization_url,
              access_code: paystackData.data.access_code,
              reference: paystackData.data.reference || reference
            }
          });
          return;
        } else {
          console.error("Paystack API initialization error response:", paystackData);
        }
      } catch (paystackErr: any) {
        console.error("Failed connecting to Paystack API, falling back to simulation:", paystackErr.message);
      }
    }

    // SIMULATED FALLBACK STATE (when offline or under local environments)
    const simulatedUrl = `/paystack-gateway-simulation?reference=${reference}&amount=${amount}&email=${email || req.user!.email}`;
    res.json({
      status: true,
      message: "Authorization URL created (Simulation)",
      reference,
      authorizationUrl: simulatedUrl,
      authorization_url: simulatedUrl,
      data: {
        authorization_url: simulatedUrl,
        access_code: "code_" + crypto.randomUUID().slice(0, 8),
        reference
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Verification API
app.get("/api/paystack/verify/:reference", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const reference = req.params.reference;
    if (!reference) {
      res.status(400).json({ error: "Transaction reference is required." });
      return;
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY || "sk_live_67bf0681e848c094aea1f1a986181052f9522c19";

    // Deduplicate transaction credits using permanent audit log entries as receipts
    const logs = dbManager.getAuditLogs();
    const alreadyProcessed = logs.find(log => 
      log.userId === req.user!.id && 
      log.action === "WALLET_DEPOSIT" && 
      log.details.includes(reference)
    );

    if (alreadyProcessed) {
      const match = alreadyProcessed.details.match(/GH₵\s*([\d.]+)/);
      const parsedAmount = match ? parseFloat(match[1]) : 0;
      res.json({
        status: "success",
        message: "Payment verified (previously recorded)",
        amount: parsedAmount
      });
      return;
    }

    if (paystackSecret && !paystackSecret.includes("simulation")) {
      try {
        const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${paystackSecret}`,
            "Content-Type": "application/json"
          }
        });

        const pvData = await verifyRes.json() as any;
        if (verifyRes.ok && pvData.status && pvData.data?.status === "success") {
          const amountInPesewas = pvData.data.amount;
          const amountInGhs = amountInPesewas / 100;
          const userId = pvData.data.metadata?.userId || req.user!.id;

          await dbManager.depositUserWallet(userId, amountInGhs);
          await dbManager.addAuditLog({
            userId,
            userName: req.user!.name,
            action: "WALLET_DEPOSIT",
            details: `Credited GH₵ ${amountInGhs.toFixed(2)} via Paystack Verification (ref: ${reference})`,
            ipAddress: req.ip || "127.0.0.1"
          });

          res.json({
            status: "success",
            message: "Payment successfully verified and credited!",
            amount: amountInGhs
          });
          return;
        } else {
          console.error("Paystack validation failed:", pvData);
          res.status(400).json({ error: pvData.message || "Paystack reported this payment has not been finished." });
          return;
        }
      } catch (paystackErr: any) {
        console.error("Verify Paystack API connection error:", paystackErr.message);
      }
    }

    // SIMULATED TRANSACTION COMPLETION FALLBACK
    if (reference.startsWith("pay_")) {
      const amountParam = req.query.amount ? parseFloat(req.query.amount as string) : 50.00;
      await dbManager.depositUserWallet(req.user!.id, amountParam);
      await dbManager.addAuditLog({
        userId: req.user!.id,
        userName: req.user!.name,
        action: "WALLET_DEPOSIT",
        details: `Credited GH₵ ${amountParam.toFixed(2)} via Simulated Paystack Verification (ref: ${reference})`,
        ipAddress: req.ip || "127.0.0.1"
      });

      res.json({
        status: "success",
        message: "Simulated payment successfully verified and credited!",
        amount: amountParam
      });
      return;
    }

    res.status(400).json({ error: "Invalid transaction reference format." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Paystack Live Webhook endpoint
app.post("/api/payment/webhook", async (req, res) => {
  try {
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY || "sk_live_67bf0681e848c094aea1f1a986181052f9522c19";
    const signature = req.headers["x-paystack-signature"];
    
    if (signature) {
      const hash = crypto
        .createHmac("sha512", paystackSecret)
        .update(JSON.stringify(req.body))
        .digest("hex");
      if (hash !== signature) {
        console.warn("Paystack Webhook Signature Verification failed.");
        res.status(400).json({ error: "Invalid signature payload source." });
        return;
      }
    }

    const { event, data } = req.body;
    if (event === "charge.success" && data?.status === "success") {
      const reference = data.reference;
      const amountInPesewas = data.amount;
      const amountInGhs = amountInPesewas / 100;
      const userId = data.metadata?.userId;

      if (userId) {
        const logs = dbManager.getAuditLogs();
        const alreadyProcessed = logs.some(log => 
          log.userId === userId && 
          log.action === "WALLET_DEPOSIT" && 
          log.details.includes(reference)
        );

        if (!alreadyProcessed) {
          await dbManager.depositUserWallet(userId, amountInGhs);
          await dbManager.addAuditLog({
            userId,
            userName: data.metadata?.userName || "Paystack Webhook Verified Client",
            action: "WALLET_DEPOSIT",
            details: `Credited GH₵ ${amountInGhs.toFixed(2)} via Paystack Webhook (ref: ${reference})`,
            ipAddress: req.ip || "127.0.0.1"
          });
          console.log(`Paystack Webhook credited GH₵ ${amountInGhs} to user ${userId}`);
        }
      }
    }

    res.status(200).json({ status: "success" });
  } catch (err: any) {
    console.error("Webhook processing exception:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---- WALLET DEPOSIT & WITHDRAWAL SYSTEM ----
app.post("/api/wallet/deposit", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { amount, reference } = req.body;
    if (!amount || parseFloat(amount) <= 0) {
      res.status(400).json({ error: "Please specify a positive deposit amount." });
      return;
    }

    const updated = await dbManager.depositUserWallet(req.user!.id, parseFloat(amount));
    await dbManager.addAuditLog({
      userId: req.user!.id,
      userName: req.user!.name,
      action: "WALLET_DEPOSIT",
      details: `Deposited GH₵ ${parseFloat(amount).toFixed(2)} via Paystack (Reference: ${reference})`,
      ipAddress: req.ip || "127.0.0.1"
    });

    res.json({ success: true, user: updated, walletBalance: updated?.walletBalance });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/wallet/withdraw", requireSeller, async (req: AuthenticatedRequest, res) => {
  try {
    const { amount, bankName, accountNumber } = req.body;
    if (!amount || parseFloat(amount) <= 0) {
      res.status(400).json({ error: "Please enter a valid withdrawal amount." });
      return;
    }
    if (!bankName || !accountNumber) {
      res.status(400).json({ error: "Please select a payout provider (MTN MoMo, Telecel Cash, GCB Bank) and enter your account number." });
      return;
    }

    const value = parseFloat(amount);
    const newW = await dbManager.addWithdrawal({
      sellerId: req.user!.id,
      amount: value,
      bankName,
      accountNumber
    });

    await dbManager.addAuditLog({
      userId: req.user!.id,
      userName: req.user!.name,
      action: "WITHDRAW_PROFIT",
      details: `Requested profit withdrawal of GH₵ ${value.toFixed(2)} to ${bankName} (${accountNumber})`,
      ipAddress: req.ip || "127.0.0.1"
    });

    res.json({ success: true, withdrawal: newW, balance: req.user!.walletBalance - value });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---- PRODUCT PROMOTIONAL BOOST AD SYSTEM ----
app.post("/api/products/:id/boost", requireSeller, async (req: AuthenticatedRequest, res) => {
  try {
    const { tier } = req.body;
    const productId = req.params.id;

    if (tier !== "1_day" && tier !== "3_days" && tier !== "1_month") {
      res.status(400).json({ error: "Select a valid boost duration: 1_day, 3_days, or 1_month." });
      return;
    }

    let cost = 20; // 1 day GHS 20
    if (tier === "3_days") cost = 50; // 3 days GHS 50
    if (tier === "1_month") cost = 300; // 1 month GHS 300

    const updated = await dbManager.boostProduct(productId, tier, cost);

    await dbManager.addAuditLog({
      userId: req.user!.id,
      userName: req.user!.name,
      action: "BOOST_PRODUCT",
      details: `Paid GH₵ ${cost} to boost product ID: ${productId} for tier: ${tier}`,
      ipAddress: req.ip || "127.0.0.1"
    });

    res.json({ success: true, product: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---- ADMIN AD MONITORING AND FINANCIAL TRANSACTION KPIS ----
app.get("/api/admin/sessions", requireAdmin, (req, res) => {
  try {
    const sessions = dbManager.getSessionLogs();
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/withdrawals", requireAdmin, (req, res) => {
  try {
    const withdrawals = dbManager.getWithdrawals();
    res.json(withdrawals);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/withdrawals/:id/moderate", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body; // approved | failed
    if (status !== "approved" && status !== "failed") {
      res.status(400).json({ error: "Invalid payout status." });
      return;
    }

    const updated = await dbManager.updateWithdrawalStatus(req.params.id, status);
    if (updated) {
      await dbManager.addAuditLog({
        userId: "admin",
        action: "MODERATE_WITHDRAWAL",
        details: `Moderate withdrawal ID: ${req.params.id} to state: ${status}`,
        ipAddress: req.ip || "127.0.0.1"
      });
      res.json(updated);
    } else {
      res.status(404).json({ error: "Withdrawal record not found." });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---- PLATFORM BOOTSTRAPPING & VITE DEV INTEGRATION ----

async function startServer() {
  // Vite dev integration inside sandboxed iFrame
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Dynamic static provider on Production build
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Smart E-Commerce Server launched cleanly on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
