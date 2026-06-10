import React from "react";
import { Search, ArrowRight, SlidersHorizontal, Heart, Trash2, ShoppingBag, Lock, User, Mail, ShieldAlert, Key, Store, Plus, Minus, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { UserProfile, Cart, Product, Category, Order } from "./types";
import Navbar from "./components/Navbar";
import DashboardSeller from "./components/DashboardSeller";
import DashboardAdmin from "./components/DashboardAdmin";
import CheckoutModal from "./components/CheckoutModal";
import ProductDetail from "./components/ProductDetail";
import PaymentCallback from "./components/PaymentCallback";

export default function App() {
  const [activeTab, setActiveTab] = React.useState<string>("home");
  
  // Modern custom dynamic layout toast notifications list
  interface ToastItem {
    id: string;
    message: string;
    type: "success" | "error" | "info";
  }
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const showToast = React.useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  // Intercept standard window.alert calls inside the iframe for pristine visual experience
  React.useEffect(() => {
    const handleAlertOverride = (msg: string) => {
      if (!msg) return;
      const lower = msg.toLowerCase();
      // Heuristic detection of success or failure states for gorgeous custom styled styling
      let toastType: "success" | "error" | "info" = "info";
      if (
        lower.includes("success") || 
        lower.includes("approved") || 
        lower.includes("published") || 
        lower.includes("added") || 
        lower.includes("credited") || 
        lower.includes("authorized") ||
        lower.includes("saved") ||
        lower.includes("complete")
      ) {
        toastType = "success";
      } else if (
        lower.includes("error") || 
        lower.includes("failed") || 
        lower.includes("invalid") || 
        lower.includes("required") || 
        lower.includes("missing") || 
        lower.includes("limit") || 
        lower.includes("unsuccessful") ||
        lower.includes("insufficient") ||
        lower.includes("conflict")
      ) {
        toastType = "error";
      }
      showToast(msg, toastType);
    };

    window.alert = handleAlertOverride;
  }, [showToast]);

  // Authorization Session State
  const [user, setUser] = React.useState<UserProfile | null>(null);
  const [token, setToken] = React.useState<string | null>(null);

  // Global Config Fetched From Backend DB
  const [platformName, setPlatformName] = React.useState("SmartHub Boutique");
  const [heroHeadline, setHeroHeadline] = React.useState("Minimalist Essentials for Modern Routines");
  const [heroSubheadline, setHeroSubheadline] = React.useState("Experience a curated collection of sensory technology and artisan homeware.");
  const [promoText, setPromoText] = React.useState("🌟 SPECIAL: Enjoy 15% off and free carbon-neutral shipping on boutique items.");
  
  // Catalogue & Store Data States
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);
  const [loadingProducts, setLoadingProducts] = React.useState(true);

  // Shopping Cart & Wishlist States
  const [cart, setCart] = React.useState<Cart | null>(null);
  const [wishlist, setWishlist] = React.useState<Product[]>([]);
  const [orders, setOrders] = React.useState<Order[]>([]);

  // Search and Advanced Filter Parameters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategorySlug, setSelectedCategorySlug] = React.useState("");
  const [sortBy, setSortBy] = React.useState("relevance");
  const [minPriceInput, setMinPriceInput] = React.useState("");
  const [maxPriceInput, setMaxPriceInput] = React.useState("");
  const [inStockOnly, setInStockOnly] = React.useState(false);

  // Auth Forms States
  const [authEmail, setAuthEmail] = React.useState("");
  const [authPassword, setAuthPassword] = React.useState("");
  const [authName, setAuthName] = React.useState("");
  const [authIsSeller, setAuthIsSeller] = React.useState(false);
  const [authStoreName, setAuthStoreName] = React.useState("");
  const [authStoreDesc, setAuthStoreDesc] = React.useState("");
  const [authError, setAuthError] = React.useState<string | null>(null);

  // Admin secret passphrase login form
  const [adminSecretInput, setAdminSecretInput] = React.useState("");
  const [adminAuthError, setAdminAuthError] = React.useState<string | null>(null);

  // Modals & Steppers
  const [showCheckout, setShowCheckout] = React.useState(false);
  const [justOrderedId, setJustOrderedId] = React.useState<string | null>(null);

  // 1. Initial configuration boostrapper
  const fetchGlobalConfigAndCategories = React.useCallback(async () => {
    try {
      const configRes = await fetch("/api/config");
      const configData = await configRes.json();
      if (configRes.ok && configData.settings) {
        setPlatformName(configData.settings.platformName || "SmartHub Boutique");
        setHeroHeadline(configData.settings.heroHeadline || "Minimalist Essentials");
        setHeroSubheadline(configData.settings.heroSubheadline || "");
        setPromoText(configData.settings.promoText || "");
      }

      const catRes = await fetch("/api/categories");
      const catData = await catRes.json();
      if (catRes.ok) {
        setCategories(catData);
      }
    } catch (err) {
      console.error("Error setting platform coordinates.", err);
    }
  }, []);

  // 2. Fetch products database row, with sorting & queries
  const fetchProducts = React.useCallback(async () => {
    setLoadingProducts(true);
    try {
      const urlParams = new URLSearchParams();
      if (searchQuery) urlParams.append("q", searchQuery);
      if (selectedCategorySlug) urlParams.append("category", selectedCategorySlug);
      if (sortBy && sortBy !== "relevance") urlParams.append("sort", sortBy);
      if (minPriceInput) urlParams.append("minPrice", minPriceInput);
      if (maxPriceInput) urlParams.append("maxPrice", maxPriceInput);
      if (inStockOnly) urlParams.append("inStockOnly", "true");

      const res = await fetch(`/api/products?${urlParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error("Error parsing catalogue products.", err);
    } finally {
      setLoadingProducts(false);
    }
  }, [searchQuery, selectedCategorySlug, sortBy, minPriceInput, maxPriceInput, inStockOnly]);

  // 3. Keep shopping cart and order histories in sync with backend tables
  const fetchCartAndUserData = React.useCallback(async (activeToken: string) => {
    try {
      // Fetch Cart
      const cartRes = await fetch("/api/cart", {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (cartRes.ok) {
        const cartData = await cartRes.json();
        setCart(cartData);
      }

      // Fetch Wishlist
      const wishRes = await fetch("/api/wishlist", {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (wishRes.ok) {
        const wishData = await wishRes.json();
        setWishlist(wishData);
      }

      // Fetch User's Orders
      const orderRes = await fetch("/api/orders", {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (orderRes.ok) {
        const orderData = await orderRes.json();
        setOrders(orderData);
      }
    } catch (err) {
      console.error("Error synchronizing customer persistent data.", err);
    }
  }, []);

  const handleRefreshUser = React.useCallback(async () => {
    const savedToken = localStorage.getItem("auth-token") || token;
    if (!savedToken) return;
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${savedToken}` }
      });
      if (res.ok) {
        const updatedProfile = await res.json();
        setUser(updatedProfile);
        localStorage.setItem("auth-profile", JSON.stringify(updatedProfile));
      }
    } catch (err) {
      console.error("Failed to sync customer profile refresh:", err);
    }
  }, [token]);

  // Sync session on mount
  React.useEffect(() => {
    fetchGlobalConfigAndCategories();
    
    const savedToken = localStorage.getItem("auth-token");
    const savedProfile = localStorage.getItem("auth-profile");
    if (savedToken && savedProfile) {
      setToken(savedToken);
      const profile = JSON.parse(savedProfile);
      setUser(profile);
      fetchCartAndUserData(savedToken);
    }

    // Capture payment callback redirects automatically
    const searchParams = new URLSearchParams(window.location.search);
    const reference = searchParams.get("reference") || searchParams.get("trxref");
    if (reference) {
      setActiveTab("payment-callback");
    }
  }, [fetchGlobalConfigAndCategories, fetchCartAndUserData]);

  // Sync products on parameter shift
  React.useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Handlers for authentication
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!authEmail || !authPassword) return;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login validation failed.");
      }

      localStorage.setItem("auth-token", data.token);
      localStorage.setItem("auth-profile", JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      
      await fetchCartAndUserData(data.token);
      
      // Redirect to correct dashboard or home
      if (data.user.role === "admin") {
        setActiveTab("admin-portal");
      } else if (data.user.role === "seller" && data.user.sellerApproved) {
        setActiveTab("seller-portal");
      } else {
        setActiveTab("home");
      }

      setAuthEmail("");
      setAuthPassword("");
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!authName || !authEmail || !authPassword) return;

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: authName,
          email: authEmail,
          password: authPassword,
          isSeller: authIsSeller,
          storeName: authStoreName,
          storeDescription: authStoreDesc
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to finalize registration.");
      }

      localStorage.setItem("auth-token", data.token);
      localStorage.setItem("auth-profile", JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);

      await fetchCartAndUserData(data.token);

      if (authIsSeller) {
        alert("Boutique seller account submitted! Your console will be active as soon as our Administrator approves your brand registration.");
        setActiveTab("home");
      } else {
        setActiveTab("home");
      }

      setAuthName("");
      setAuthEmail("");
      setAuthPassword("");
      setAuthIsSeller(false);
      setAuthStoreName("");
      setAuthStoreDesc("");
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleAdminSecretLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError(null);
    if (!adminSecretInput) return;

    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminSecret: adminSecretInput })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authorized keys access denied.");
      }

      localStorage.setItem("auth-token", data.token);
      localStorage.setItem("auth-profile", JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);

      await fetchCartAndUserData(data.token);
      setActiveTab("admin-portal");
      setAdminSecretInput("");
    } catch (err: any) {
      setAdminAuthError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("auth-token");
    localStorage.removeItem("auth-profile");
    setUser(null);
    setToken(null);
    setCart(null);
    setWishlist([]);
    setOrders([]);
    setActiveTab("home");
  };

  // Cart operations
  const handleAddToCart = async (pId: string, qty: number) => {
    if (!token) {
      alert("Authentication required. Please sign in to build your personalized shopping bag.");
      setActiveTab("login");
      return;
    }

    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ productId: pId, quantity: qty })
      });
      if (res.ok) {
        fetchCartAndUserData(token);
        alert("Boutique placement added directly to your Shopping Bag!");
      } else {
        const d = await res.json();
        alert(d.error || "Incomplete stock count.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateCartItemQty = async (itemId: string, currentQty: number, offset: number) => {
    if (!token) return;
    const targetQty = currentQty + offset;
    try {
      const res = await fetch(`/api/cart/${itemId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ quantity: targetQty })
      });
      if (res.ok) {
        fetchCartAndUserData(token);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveCartItem = async (itemId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/cart/${itemId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchCartAndUserData(token);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleWishlist = async (pId: string) => {
    if (!token) {
      alert("Please sign in or register to preserve selected products inside your Saved wishlist.");
      setActiveTab("login");
      return;
    }

    try {
      const res = await fetch("/api/wishlist/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ productId: pId })
      });
      if (res.ok) {
        fetchCartAndUserData(token);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOrderCompletionSuccess = (orderId: string) => {
    setShowCheckout(false);
    setJustOrderedId(orderId);
    if (token) {
      fetchCartAndUserData(token);
    }
    setActiveTab("order-status-success");
  };

  const handleLaunchProductDetail = (pId: string) => {
    setSelectedProductId(pId);
    setActiveTab("product-detail");
  };

  return (
    <div id="application-container" className="min-h-screen bg-white text-neutral-850 flex flex-col antialiased">
      <Navbar
        user={user}
        cart={cart}
        onNavigate={(tab) => {
          setActiveTab(tab);
          if (tab === "shop") {
            // Reset searches on tab trigger
            setSelectedCategorySlug("");
            setSearchQuery("");
          }
        }}
        onLogout={handleLogout}
        activeTab={activeTab}
        promoText={promoText}
        platformName={platformName}
      />

      {/* Screen Routing Outlet and Section wrappers */}
      <main id="app-viewport-outlet" className="flex-grow">
        
        {/* VIEW: HOME PAGE */}
        {activeTab === "home" && (
          <div id="home-view" className="space-y-16 animate-in fade-in duration-300">
            {/* Elegant Hero Slider-banner */}
            <section id="hero-banner" className="relative w-full aspect-[21/9] min-h-[350px] max-h-[500px] flex items-center justify-center text-center overflow-hidden bg-neutral-900 px-4">
              <div className="absolute inset-0 bg-black/40 z-10" />
              <img
                src="https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&q=80&w=1200"
                alt="Banner visual backdrop"
                className="absolute inset-0 w-full h-full object-cover scale-105 select-none opacity-55 animate-pulse"
                referrerPolicy="no-referrer"
              />
              {/* Overlay card */}
              <div className="relative z-20 max-w-2xl text-white space-y-4">
                <h2 className="font-sans font-bold text-3xl sm:text-5xl leading-tight tracking-tight select-none">
                  {heroHeadline}
                </h2>
                <p className="font-sans text-sm sm:text-base text-neutral-100/90 leading-relaxed font-light">
                  {heroSubheadline}
                </p>
                <div className="pt-4">
                  <button
                    id="hero-cta-btn"
                    onClick={() => setActiveTab("shop")}
                    className="px-6 py-3 rounded-xl bg-white text-neutral-950 font-sans font-semibold text-xs tracking-wide uppercase hover:bg-neutral-50 shadow-md cursor-pointer transition-all flex items-center gap-2 mx-auto"
                  >
                    Explore Handpicked Catalogue
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </section>

            {/* Micro Integrated Search block */}
            <section id="home-search-belt" className="max-w-xl mx-auto px-4">
              <div className="relative flex items-center border border-neutral-150 rounded-2xl bg-white p-1 pl-4.5 shadow-sm focus-within:border-neutral-900 transition-all">
                <Search className="w-4 h-4 text-neutral-400" />
                <input
                  id="home-search-input"
                  type="text"
                  placeholder="Bespoke wood keyboards, ANC earbuds..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setActiveTab("shop");
                    }
                  }}
                  className="flex-grow font-sans text-xs p-3 outline-none text-neutral-800"
                />
                <button
                  id="home-search-submit"
                  onClick={() => setActiveTab("shop")}
                  className="px-4.5 py-2.5 rounded-xl bg-neutral-900 text-xs font-sans font-semibold text-white/95 hover:bg-neutral-800 cursor-pointer transition-all"
                >
                  Search
                </button>
              </div>
            </section>

            {/* Horizontal Categories Row */}
            <section id="categories-deck" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center space-y-1 mb-8">
                <span className="text-[10px] uppercase font-sans font-bold tracking-wider text-neutral-400 block">Classified Collections</span>
                <h3 className="font-sans font-semibold text-lg text-neutral-900 block">Curated Focus Rooms</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    id={`cat-card-${cat.id}`}
                    onClick={() => {
                      setSelectedCategorySlug(cat.slug);
                      setActiveTab("shop");
                    }}
                    className="group relative h-48 rounded-2xl overflow-hidden border border-neutral-100 shadow-sm cursor-pointer"
                  >
                    <div className="absolute inset-0 bg-neutral-900/40 group-hover:bg-neutral-900/50 transition-all z-10" />
                    <img
                      src={cat.imageUrl}
                      alt={cat.name}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-5 z-20 text-white space-y-1.5 flex flex-col justify-end h-full">
                      <h4 className="font-sans font-bold text-base tracking-tight">{cat.name}</h4>
                      <p className="font-sans text-[11px] text-zinc-100/95 leading-relaxed font-light">{cat.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Grid of Trending items */}
            <section id="trending-deck" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4.5 mb-8">
                <div>
                  <span className="text-[10px] uppercase font-sans font-bold tracking-wider text-neutral-400">Trending Now</span>
                  <h3 className="font-sans font-bold text-xl text-neutral-950 mt-0.5">Surfaced Placements</h3>
                </div>
                <button
                  onClick={() => {
                    setSortBy("rating");
                    setActiveTab("shop");
                  }}
                  className="font-sans text-xs font-semibold text-neutral-500 hover:text-neutral-950 cursor-pointer inline-flex items-center gap-1"
                >
                  View highly rated
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {loadingProducts ? (
                <div className="py-20 text-center text-neutral-400 font-sans text-xs">Loading items...</div>
              ) : products.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 font-sans text-xs">No product entries are currently active.</div>
              ) : (
                <div id="home-product-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                  {products.slice(0, 4).map((prod) => (
                    <div
                      key={prod.id}
                      id={`p-card-${prod.id}`}
                      className="group border border-neutral-100 rounded-2xl bg-white overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between"
                    >
                      <div className="relative aspect-[4/3] bg-neutral-50 border-b border-neutral-50 overflow-hidden">
                        {prod.stock === 0 && (
                          <span className="absolute top-2.5 right-2.5 z-10 bg-neutral-900/90 font-sans text-[9px] font-bold tracking-wider text-white px-2 py-0.5 rounded uppercase">
                            Out of Stock
                          </span>
                        )}
                        <img
                          src={prod.primaryImage}
                          alt={prod.name}
                          onClick={() => handleLaunchProductDetail(prod.id)}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300 cursor-pointer"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          onClick={() => handleToggleWishlist(prod.id)}
                          className={`absolute bottom-2.5 right-2.5 p-2 rounded-lg border backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer ${
                            wishlist.some(w => w.id === prod.id) ? "bg-red-50 text-red-600 border-red-100" : "bg-white/90 text-neutral-500 border-neutral-100 hover:text-neutral-950"
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${wishlist.some(w => w.id === prod.id) ? "fill-red-600" : ""}`} />
                        </button>
                      </div>

                      <div className="p-4 space-y-2 flex-grow flex flex-col justify-between">
                        <div onClick={() => handleLaunchProductDetail(prod.id)} className="space-y-1 cursor-pointer">
                          <span className="text-[10px] font-sans font-bold text-neutral-400 uppercase tracking-wider block">{prod.sellerName}</span>
                          <h4 className="font-sans font-semibold text-xs text-neutral-950 max-w-full truncate">{prod.name}</h4>
                        </div>

                        <div className="pt-2 border-t border-gray-50 flex items-center justify-between">
                          <div className="space-y-0.5">
                            {prod.salePrice !== null ? (
                              <React.Fragment>
                                <span className="font-sans font-bold text-xs text-neutral-950">${prod.salePrice}</span>
                                <span className="font-sans text-[10px] text-neutral-400 line-through ml-1.5">${prod.price}</span>
                              </React.Fragment>
                            ) : (
                              <span className="font-sans font-bold text-xs text-neutral-950">${prod.price}</span>
                            )}
                          </div>
                          
                          <button
                            onClick={() => handleAddToCart(prod.id, 1)}
                            disabled={prod.stock === 0}
                            className="p-1 px-3 bg-neutral-950 hover:bg-neutral-850 disabled:bg-neutral-100 disabled:text-neutral-400 text-white rounded-lg text-[10px] font-sans font-bold tracking-wide uppercase transition-all shadow-sm cursor-pointer"
                          >
                            Acquire
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Micro horizontal trust banner */}
            <section id="trust-banner" className="bg-neutral-50/50 border-t border-b border-neutral-100 py-10">
              <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center sm:text-left">
                <div className="space-y-1.5 p-4">
                  <span className="font-sans font-bold text-xs text-neutral-950 uppercase tracking-wide block">Carbon-Neutral Handoff</span>
                  <p className="font-sans text-xs text-neutral-500 leading-relaxed block">All platform shipping corridors are entirely offset through audited organic forestry initiatives.</p>
                </div>
                <div className="space-y-1.5 p-4">
                  <span className="font-sans font-bold text-xs text-neutral-950 uppercase tracking-wide block">Independent Merchantry</span>
                  <p className="font-sans text-xs text-neutral-500 leading-relaxed block">We verify all independent seller accounts to enforce strict tactile standards and natural resource safety.</p>
                </div>
                <div className="space-y-1.5 p-4">
                  <span className="font-sans font-bold text-xs text-neutral-950 uppercase tracking-wide block">Atomically Checked Stock</span>
                  <p className="font-sans text-xs text-neutral-500 leading-relaxed block">Every placement counts on a centralized server database to ensure stock reserves remain instantly truthful.</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* VIEW: SHOP CATALOG PAGE */}
        {activeTab === "shop" && (
          <div id="shop-view" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-200">
            <div className="flex flex-col md:flex-row gap-10">
              
              {/* Left Column: Filter Sidebar */}
              <aside id="shop-sidebar" className="w-full md:w-64 space-y-6">
                <div className="border-b border-gray-100 pb-4 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-neutral-900" />
                  <h3 className="font-sans font-bold text-sm text-neutral-900 tracking-tight">Advanced Filter Matrix</h3>
                </div>

                {/* Categories filtering list */}
                <div className="space-y-2">
                  <span className="font-sans text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Target Rooms</span>
                  <div className="space-y-1.5">
                    <button
                      onClick={() => setSelectedCategorySlug("")}
                      className={`w-full text-left font-sans text-xs p-1 px-2.2 rounded-lg cursor-pointer transition-colors ${
                        selectedCategorySlug === "" ? "bg-neutral-900 text-white font-medium" : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
                      }`}
                    >
                      All Collections
                    </button>
                    {categories.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCategorySlug(c.slug)}
                        className={`w-full text-left font-sans text-xs p-1 px-2.2 rounded-lg cursor-pointer transition-colors ${
                          selectedCategorySlug === c.slug ? "bg-neutral-900 text-white font-medium" : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price bounds */}
                <div className="space-y-2 border-t border-neutral-100 pt-5">
                  <span className="font-sans text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Price boundaries</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Min ($)"
                      value={minPriceInput}
                      onChange={(e) => setMinPriceInput(e.target.value)}
                      className="p-2 border border-neutral-200 rounded-xl font-sans text-xs outline-none bg-white font-medium focus:border-black"
                    />
                    <input
                      type="number"
                      placeholder="Max ($)"
                      value={maxPriceInput}
                      onChange={(e) => setMaxPriceInput(e.target.value)}
                      className="p-2 border border-neutral-200 rounded-xl font-sans text-xs outline-none bg-white font-medium focus:border-black"
                    />
                  </div>
                </div>

                {/* Stock Checkbox only option */}
                <div className="flex items-center gap-2.5 pt-2 border-t border-neutral-100 pt-5 select-none font-sans text-xs">
                  <input
                    type="checkbox"
                    id="chk-instock"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-black border-gray-300 focus:ring-black cursor-pointer"
                  />
                  <label htmlFor="chk-instock" className="font-medium text-neutral-600 cursor-pointer">
                    Only In Stock Items
                  </label>
                </div>

                {/* Clear actions link */}
                {(minPriceInput || maxPriceInput || selectedCategorySlug || searchQuery || inStockOnly) && (
                  <button
                    onClick={() => {
                      setMinPriceInput("");
                      setMaxPriceInput("");
                      setSelectedCategorySlug("");
                      setSearchQuery("");
                      setInStockOnly(false);
                      setSortBy("relevance");
                    }}
                    className="w-full text-center py-2 border border-neutral-200 text-neutral-500 rounded-xl font-sans font-semibold text-xs hover:border-neutral-900 hover:text-neutral-900 cursor-pointer transition-all"
                  >
                    Reset Filter Deck
                  </button>
                )}
              </aside>

              {/* Right Column: Unified Card grid */}
              <section id="shop-catalog-main" className="flex-grow space-y-6">
                {/* Search Bar & Order sort triggers */}
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full sm:max-w-xs flex items-center border border-neutral-200 rounded-xl px-3 focus-within:border-neutral-900 bg-white shadow-sm transition-all">
                    <Search className="w-4 h-4 text-neutral-400" />
                    <input
                      id="shop-search-input"
                      type="text"
                      placeholder="Filter active listings..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full font-sans text-xs p-2.5 outline-none text-neutral-800"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end font-sans text-xs">
                    <span className="text-neutral-400">Sort:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="p-2 border border-neutral-200 rounded-xl outline-none focus:border-neutral-950 bg-white font-medium cursor-pointer"
                    >
                      <option value="relevance">Relevance algorithm</option>
                      <option value="price-asc">Price: Low to High</option>
                      <option value="price-desc">Price: High to Low</option>
                      <option value="rating">Top Customer Rated</option>
                      <option value="newest">Newly Arrived</option>
                      <option value="best-sellers">Historical Bestsellers</option>
                    </select>
                  </div>
                </div>

                {/* Items grid */}
                {loadingProducts ? (
                  <div className="py-24 text-center space-y-3">
                    <RefreshCw className="w-8 h-8 text-neutral-350 animate-spin mx-auto" />
                    <span className="font-sans text-xs text-neutral-400">Loading shop Catalogue...</span>
                  </div>
                ) : products.length === 0 ? (
                  <div id="shop-empty-state" className="py-24 text-center border border-dashed border-neutral-200 rounded-2xl bg-neutral-50/50 space-y-2">
                    <span className="font-sans font-bold text-sm text-neutral-800 block">No matching placements found</span>
                    <p className="font-sans text-xs text-neutral-400 max-w-sm mx-auto">Try clearing price limits, adjusting spelling terms, or selecting alternative classified focus rooms.</p>
                  </div>
                ) : (
                  <div id="shop-catalog-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {products.map((prod) => (
                      <div
                        key={prod.id}
                        id={`shop-p-card-${prod.id}`}
                        className="group border border-neutral-100 rounded-2xl bg-white overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between"
                      >
                        <div className="relative aspect-[4/3] bg-neutral-50 border-b border-neutral-50 overflow-hidden">
                          {prod.stock === 0 && (
                            <span className="absolute top-2.5 right-2.5 z-10 bg-neutral-900/90 font-sans text-[9px] font-bold tracking-wider text-white px-2 py-0.5 rounded uppercase">
                              Out of Stock
                            </span>
                          )}
                          <img
                            src={prod.primaryImage}
                            alt={prod.name}
                            onClick={() => handleLaunchProductDetail(prod.id)}
                            className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300 cursor-pointer"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            onClick={() => handleToggleWishlist(prod.id)}
                            className={`absolute bottom-2.5 right-2.5 p-2 rounded-lg border backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer ${
                              wishlist.some(w => w.id === prod.id) ? "bg-red-50 text-red-600 border-red-100" : "bg-white/90 text-neutral-500 border-neutral-100 hover:text-neutral-950"
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${wishlist.some(w => w.id === prod.id) ? "fill-red-600 animate-pulse" : ""}`} />
                          </button>
                        </div>

                        <div className="p-4 space-y-2 flex-grow flex flex-col justify-between">
                          <div onClick={() => handleLaunchProductDetail(prod.id)} className="space-y-1 cursor-pointer">
                            <span className="text-[10px] font-sans font-bold text-neutral-400 uppercase tracking-wider block">{prod.sellerName}</span>
                            <h4 className="font-sans font-semibold text-xs text-neutral-900 max-w-full truncate">{prod.name}</h4>
                          </div>

                          <div className="pt-2 border-t border-gray-50 flex items-center justify-between">
                            <div className="space-y-0.5">
                              {prod.salePrice !== null ? (
                                <React.Fragment>
                                  <span className="font-sans font-bold text-xs text-neutral-950">${prod.salePrice}</span>
                                  <span className="font-sans text-[10px] text-neutral-400 line-through ml-1.5">${prod.price}</span>
                                </React.Fragment>
                              ) : (
                                <span className="font-sans font-bold text-xs text-neutral-950">${prod.price}</span>
                              )}
                            </div>
                            
                            <button
                              id={`shop-btn-add-${prod.id}`}
                              onClick={() => handleAddToCart(prod.id, 1)}
                              disabled={prod.stock === 0}
                              className="p-1 px-3 bg-neutral-950 hover:bg-neutral-850 disabled:bg-neutral-100 disabled:text-neutral-400 text-white rounded-lg text-[10px] font-sans font-bold tracking-wide uppercase transition-all shadow-sm cursor-pointer"
                            >
                              Acquire
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

            </div>
          </div>
        )}

        {/* VIEW: PRODUCT DETAIL MODULE */}
        {activeTab === "product-detail" && selectedProductId && (
          <ProductDetail
            productId={selectedProductId}
            user={user}
            token={token}
            onBack={() => {
              setSelectedProductId(null);
              setActiveTab("shop");
            }}
            onAddToCart={handleAddToCart}
            onToggleWishlist={handleToggleWishlist}
            wishlistedProducts={wishlist.map(w => w.id)}
          />
        )}

        {/* VIEW: SHOPPING BAG MODULE */}
        {activeTab === "cart" && (
          <div id="cart-view" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-200">
            <h1 className="font-sans font-bold text-2xl text-neutral-900 mb-8 border-b border-gray-100 pb-4">Your Shopping Bag</h1>
            
            {!cart || cart.items.length === 0 ? (
              <div id="cart-empty-prompt" className="py-24 text-center border border-dashed border-neutral-200 rounded-2xl bg-neutral-50/50 space-y-4">
                <ShoppingBag className="w-12 h-12 text-neutral-300 mx-auto" />
                <div className="space-y-1">
                  <h3 className="font-sans font-bold text-sm text-neutral-800">Your shopping bag is empty</h3>
                  <p className="font-sans text-xs text-neutral-400 max-w-sm mx-auto">Once you locate premium workspace gear or acoustic tech from our catalog, list additions will survive device reboots instantly.</p>
                </div>
                <button
                  onClick={() => setActiveTab("shop")}
                  className="px-5 py-2 rounded-xl bg-neutral-900 text-xs font-sans font-semibold text-white/95 hover:bg-neutral-800 cursor-pointer shadow-sm transition-all"
                >
                  Explore products
                </button>
              </div>
            ) : (
              <div id="cart-filled-state" className="grid grid-cols-1 md:grid-cols-3 gap-10">
                {/* List Column */}
                <div className="md:col-span-2 space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {cart.items.map((item) => (
                    <div key={item.id} id={`cart-item-${item.id}`} className="p-4 rounded-xl border border-neutral-150 shadow-sm flex items-center justify-between gap-4 bg-neutral-50/10">
                      <div className="flex items-center gap-3">
                        <img src={item.imageUrl} alt={item.name} className="w-12 h-12 rounded-lg object-cover bg-neutral-50 border border-neutral-100" referrerPolicy="no-referrer" />
                        <div className="flex flex-col">
                          <span className="font-sans font-semibold text-xs text-neutral-950">{item.name}</span>
                          <span className="font-sans text-[10px] text-neutral-400 mt-0.5">Unit estimate: ${item.price}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        {/* +/- Qty adjusting panel */}
                        <div className="flex items-center border border-neutral-200 rounded-xl overflow-hidden bg-white">
                          <button
                            onClick={() => handleUpdateCartItemQty(item.id, item.quantity, -1)}
                            className="px-2.5 py-1 text-xs text-neutral-500 hover:bg-neutral-50 focus:outline-none cursor-pointer"
                          >
                            -
                          </button>
                          <span className="px-3.5 py-1 text-xs font-sans font-bold text-neutral-900 select-none">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleUpdateCartItemQty(item.id, item.quantity, 1)}
                            disabled={item.quantity >= item.stock}
                            className="px-2.5 py-1 text-xs text-neutral-550 hover:bg-neutral-50 focus:outline-none cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        {/* Line totals & remove block */}
                        <div className="flex items-center gap-3.5">
                          <span className="font-sans font-bold text-xs text-neutral-900">${item.total.toFixed(2)}</span>
                          <button
                            onClick={() => handleRemoveCartItem(item.id)}
                            className="p-1 text-neutral-300 hover:text-red-600 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Secure checkout totals ledger summary */}
                <div className="lg:col-span-1 p-6 rounded-2xl border border-neutral-150 bg-neutral-50/40 shadow-sm self-start space-y-5">
                  <h3 className="font-sans font-bold text-sm text-neutral-900">Checkout summary</h3>
                  
                  <div className="divide-y divide-neutral-100 font-sans text-xs space-y-2 pt-1">
                    <div className="flex justify-between text-neutral-500 pt-2">
                      <span>Subtotal</span>
                      <span>${cart.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-neutral-550 pt-2">
                      <span>Dispatch Shipping</span>
                      <span className="text-emerald-600 font-semibold uppercase text-[10px]">Free</span>
                    </div>
                    <div className="flex justify-between text-neutral-900 font-bold pt-2 border-t border-neutral-200">
                      <span>Est. Total</span>
                      <span>${cart.total.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    id="btn-checkout-trigger"
                    onClick={() => {
                      setShowCheckout(true);
                    }}
                    className="w-full py-3 bg-neutral-900 hover:bg-neutral-850 text-white font-sans font-semibold text-xs tracking-wide rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Proceed to secure checkout
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW: CUSTOMER ORDERS LIST AND DISPATCH SYSTEM */}
        {activeTab === "my-orders" && (
          <div id="orders-view" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-200">
            <h1 className="font-sans font-bold text-2xl text-neutral-900 mb-8 border-b border-gray-100 pb-4">Active Orders tracking</h1>
            
            {orders.length === 0 ? (
              <div id="orders-empty-state" className="py-24 text-center border border-dashed border-neutral-200 rounded-2xl bg-neutral-50/50 space-y-3">
                <Clock className="w-12 h-12 text-neutral-300 mx-auto" />
                <h3 className="font-sans font-bold text-sm text-neutral-800">Clear histories</h3>
                <p className="font-sans text-xs text-neutral-400 max-w-sm mx-auto">You have not committed any checkout purchases on your user profile account yet.</p>
              </div>
            ) : (
              <div id="orders-list-timeline" className="space-y-8">
                {orders.map(ord => (
                  <div key={ord.id} className="p-6 rounded-2xl border border-neutral-150 shadow-sm space-y-5 bg-neutral-50/10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-50 pb-4.5">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-neutral-900 uppercase tracking-tight">{ord.id}</span>
                        <span className="font-sans text-[10px] text-neutral-400">{new Date(ord.createdAt).toLocaleDateString()}</span>
                      </div>
                      <span className={`font-sans font-semibold text-[10px] uppercase rounded-full px-2.5 py-1 ${
                        ord.status === "shipped" || ord.status === "delivered" || ord.status === "completed" ? "bg-emerald-50 text-emerald-800" : "bg-neutral-100 text-neutral-800"
                      }`}>
                        {ord.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start font-sans text-xs">
                      {/* Products detail lists */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Deliverables</span>
                        <ul className="divide-y divide-neutral-50 font-sans text-xs">
                          {ord.items.map(oi => (
                            <li key={oi.id} className="py-2 flex justify-between font-medium">
                              <span className="text-neutral-700">{oi.productName} <span className="text-neutral-400">x{oi.quantity}</span></span>
                              <span className="text-neutral-950 font-semibold">${(oi.price * oi.quantity).toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="flex justify-between border-t border-neutral-50 pt-3 text-neutral-950 font-bold text-xs">
                          <span>Est. Charged Total</span>
                          <span>${ord.total.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Tracking timeline */}
                      <div className="space-y-3">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Real-time status history timeline</span>
                        <div className="border-l-2 border-neutral-100 pl-4 space-y-4 relative">
                          {ord.history.map(h => (
                            <div key={h.id} className="relative">
                              {/* micro circle indicator */}
                              <span className="absolute -left-5 top-1.5 w-2.5 h-2.5 bg-neutral-900 rounded-full border-2 border-white" />
                              <div className="flex flex-col text-[11px]">
                                <span className="font-sans font-bold text-neutral-800 text-[11px] capitalize">{h.status}</span>
                                <span className="font-sans text-neutral-450 mt-0.5 leading-relaxed">{h.comment}</span>
                                <span className="font-sans font-medium text-[9px] text-neutral-400 uppercase tracking-wider mt-1">{new Date(h.createdAt).toLocaleTimeString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW: WISHLIST MODULE */}
        {activeTab === "wishlist" && (
          <div id="wishlist-view" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-200">
            <h1 className="font-sans font-bold text-2xl text-neutral-900 mb-8 border-b border-gray-100 pb-4">Saved Wishlist Placements</h1>
            {wishlist.length === 0 ? (
              <div id="wishlist-empty-state" className="py-24 text-center border border-dashed border-neutral-200 rounded-2xl bg-neutral-50/50 space-y-3">
                <Heart className="w-12 h-12 text-neutral-300 mx-auto" />
                <h3 className="font-sans font-bold text-sm text-neutral-800">Your saved wishlist is empty</h3>
                <p className="font-sans text-xs text-neutral-400 max-w-sm mx-auto">Save premium bespoke materials or audio technology placements inside your wishlist while exploring.</p>
              </div>
            ) : (
              <div id="wishlist-catalog-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {wishlist.map(prod => (
                  <div key={prod.id} className="group border border-neutral-100 rounded-2xl bg-white overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div className="relative aspect-[4/3] bg-neutral-50 overflow-hidden">
                      <img src={prod.primaryImage || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&q=80&w=400"} alt="wish placement" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button onClick={() => handleToggleWishlist(prod.id)} className="absolute bottom-2.5 right-2.5 p-2 bg-white border border-red-100 rounded-lg text-red-600 cursor-pointer">
                        <Heart className="w-4 h-4 fill-red-600" />
                      </button>
                    </div>
                    <div className="p-4 space-y-2 flex-grow flex flex-col justify-between">
                      <h4 onClick={() => handleLaunchProductDetail(prod.id)} className="font-sans font-semibold text-xs text-neutral-950 truncate cursor-pointer">{prod.name}</h4>
                      <div className="pt-2 border-t border-gray-50 flex items-center justify-between">
                        <span className="font-sans font-bold text-xs text-neutral-950">${prod.price}</span>
                        <button onClick={() => {
                          handleAddToCart(prod.id, 1);
                          handleToggleWishlist(prod.id); // Remove from wish upon carting
                        }} className="px-3 py-1 bg-neutral-950 hover:bg-neutral-850 text-white rounded-lg text-[10px] font-sans font-bold tracking-wide uppercase shadow-sm cursor-pointer">
                          Bag Item
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW: PAYSTACK PAYMENT CALLBACK STATUS VIEW */}
        {activeTab === "payment-callback" && (
          <PaymentCallback
            token={token}
            onNavigate={setActiveTab}
            onRefreshUser={handleRefreshUser}
          />
        )}

        {/* VIEW: ORDER STATUS SUCCESS PAGE */}
        {activeTab === "order-status-success" && (
          <div id="order-success-view" className="max-w-md mx-auto px-4 py-24 text-center space-y-6 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto shadow-sm animate-bounce">
              <CheckCircle className="w-9 h-9" />
            </div>
            <div className="space-y-2">
              <h1 className="font-sans font-bold text-2xl text-neutral-900 tracking-tight">Purchase Confirmed!</h1>
              <p className="font-sans text-xs text-neutral-400 leading-relaxed font-semibold">Your secured dispatch order coordinates have been recorded in our permanent database.</p>
              {justOrderedId && (
                <span className="font-mono text-xs p-1.5 px-3 bg-neutral-50 border border-neutral-150 rounded-lg text-neutral-500 block max-w-full truncate uppercase tracking-tight font-bold mt-2">Order trace: {justOrderedId}</span>
              )}
            </div>
            <div className="flex gap-4 pt-4">
              <button
                onClick={() => {
                  setJustOrderedId(null);
                  setActiveTab("my-orders");
                }}
                className="flex-1 py-2.5 bg-neutral-900 hover:bg-neutral-850 text-white rounded-xl font-sans text-xs font-semibold cursor-pointer"
              >
                Track shipments
              </button>
              <button
                onClick={() => {
                  setJustOrderedId(null);
                  setActiveTab("home");
                }}
                className="flex-1 py-2.5 border border-neutral-200 text-neutral-600 rounded-xl font-sans text-xs font-semibold hover:text-black cursor-pointer"
              >
                Return Storefront
              </button>
            </div>
          </div>
        )}

        {/* VIEW: USER AUTHENTICATION GATE (Sells & Customers) */}
        {activeTab === "login" && (
          <div id="login-view" className="max-w-md mx-auto px-4 py-24 animate-in fade-in duration-300">
            <div className="bg-white p-8 rounded-2xl border border-neutral-150 shadow-sm space-y-6">
              <div className="text-center space-y-1">
                <h2 className="font-sans font-bold text-xl text-neutral-900">Sign Inside SmartHub</h2>
                <p className="font-sans text-xs text-neutral-400">Unlock durable shopping bags, saved wishlists, and item logs.</p>
              </div>

              {authError && (
                <div className="p-3 bg-red-50 border border-red-150 rounded-xl text-red-700 font-sans text-xs">
                  {authError}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="font-sans text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">Email address</label>
                  <div className="flex items-center border border-neutral-200 rounded-xl px-3 focus-within:border-black bg-white">
                    <Mail className="w-4 h-4 text-neutral-350" />
                    <input
                      type="email"
                      required
                      placeholder="sarah@ Jenkins.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full font-sans text-xs p-3.5 outline-none text-neutral-850"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-sans text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">Passphrase code</label>
                  <div className="flex items-center border border-neutral-200 rounded-xl px-3 focus-within:border-black bg-white">
                    <Key className="w-4 h-4 text-neutral-350" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••••••"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full font-sans text-xs p-3.5 outline-none text-neutral-850"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-neutral-900 hover:bg-neutral-850 text-white font-sans font-semibold text-xs tracking-wide uppercase rounded-xl transition-all cursor-pointer"
                >
                  Sign In Account
                </button>
              </form>

              <div className="border-t border-neutral-100 pt-5 text-center text-xs font-sans text-neutral-400 select-none">
                Do not have a credentials profile?{" "}
                <button
                  onClick={() => {
                    setAuthError(null);
                    setActiveTab("register");
                  }}
                  className="text-neutral-900 font-semibold hover:underline cursor-pointer"
                >
                  Create one now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: USER REGISTRATION GATE */}
        {activeTab === "register" && (
          <div id="register-view" className="max-w-md mx-auto px-4 py-20 animate-in fade-in duration-300">
            <div className="bg-white p-8 rounded-2xl border border-neutral-150 shadow-sm space-y-6">
              <div className="text-center space-y-1">
                <h2 className="font-sans font-bold text-xl text-neutral-950">Bespoke Registration</h2>
                <p className="font-sans text-xs text-neutral-400">Join our handcraft and sensory networks instantly.</p>
              </div>

              {authError && (
                <div className="p-3 bg-red-50 border border-red-150 text-red-700 font-sans text-xs rounded-xl">
                  {authError}
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="font-sans text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">Display Name</label>
                  <div className="flex items-center border border-neutral-200 rounded-xl px-3 focus-within:border-black bg-white">
                    <User className="w-4 h-4 text-neutral-350" />
                    <input
                      type="text"
                      required
                      placeholder="Sarah Jenkins"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full font-sans text-xs p-3.5 outline-none text-neutral-850"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-sans text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">Email address</label>
                  <div className="flex items-center border border-neutral-200 rounded-xl px-3 focus-within:border-black bg-white">
                    <Mail className="w-4 h-4 text-neutral-350" />
                    <input
                      type="email"
                      required
                      placeholder="sarah@jenkinshub.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full font-sans text-xs p-3.5 outline-none text-neutral-850"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-sans text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">Bespoke Passphrase</label>
                  <div className="flex items-center border border-neutral-200 rounded-xl px-3 focus-within:border-black bg-white">
                    <Key className="w-4 h-4 text-neutral-350" />
                    <input
                      type="password"
                      required
                      placeholder="Password code (Min 8 letters)"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full font-sans text-xs p-3.5 outline-none text-neutral-850"
                    />
                  </div>
                </div>

                {/* Seller Option */}
                <div className="flex items-start gap-2.5 pt-1.5 select-none text-xs font-sans">
                  <input
                    type="checkbox"
                    id="chk-seller-register"
                    checked={authIsSeller}
                    onChange={(e) => setAuthIsSeller(e.target.checked)}
                    className="w-4.5 h-4.5 rounded text-black border-gray-300 focus:ring-black cursor-pointer mt-0.5"
                  />
                  <div>
                    <label htmlFor="chk-seller-register" className="font-semibold text-neutral-800 cursor-pointer">
                      I want to list and sell handcrafted items here
                    </label>
                    <span className="text-[10px] text-neutral-400 block mt-0.5 max-w-xs leading-relaxed">Approvals processed by our platform admin inside the moderation suite.</span>
                  </div>
                </div>

                {authIsSeller && (
                  <div id="seller-extra-form" className="p-4 rounded-xl border border-neutral-150 space-y-3 animate-in slide-in-from-top-1 bg-neutral-50/50">
                    <div>
                      <label className="font-sans text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Est. Shop Brand Name</label>
                      <input
                        type="text"
                        required={authIsSeller}
                        placeholder="Marcus Aurelius Woodcraft"
                        value={authStoreName}
                        onChange={(e) => setAuthStoreName(e.target.value)}
                        className="w-full font-sans text-xs p-2 rounded-xl border border-neutral-200 outline-none focus:border-black bg-white"
                      />
                    </div>
                    <div>
                      <label className="font-sans text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Short Brand Pitch</label>
                      <input
                        type="text"
                        required={authIsSeller}
                        placeholder="Hand-milled walnut accessories, quiet mechanical triggers..."
                        value={authStoreDesc}
                        onChange={(e) => setAuthStoreDesc(e.target.value)}
                        className="w-full font-sans text-xs p-2 rounded-xl border border-neutral-200 outline-none focus:border-black bg-white"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3.5 bg-neutral-900 hover:bg-neutral-850 text-white font-sans font-semibold text-xs tracking-wide uppercase rounded-xl transition-all cursor-pointer"
                >
                  Create credentials profile
                </button>
              </form>

              <div className="border-t border-neutral-100 pt-5 text-center text-xs font-sans text-neutral-400 select-none">
                Already have an operational user profile?{" "}
                <button
                  onClick={() => {
                    setAuthError(null);
                    setActiveTab("login");
                  }}
                  className="text-neutral-900 font-semibold hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: SELLER PORTAL SCREEN */}
        {activeTab === "seller-portal" && (
          user && (user.role === "seller" || user.role === "admin") ? (
            <DashboardSeller
              token={token}
              categories={categories}
              onRefreshProducts={fetchProducts}
            />
          ) : (
            <div id="seller-protected-error" className="max-w-md mx-auto py-24 text-center space-y-4">
              <ShieldAlert className="w-12 h-12 text-red-650 mx-auto animate-pulse" />
              <h2 className="font-sans font-bold text-lg text-neutral-950">Unauthorized Seller Console Gate</h2>
              <p className="font-sans text-xs text-neutral-400">Only approved independent merchants possess authorizations to parse transaction records and catalog layouts.</p>
              <button onClick={() => setActiveTab("home")} className="px-5 py-2 hover:border-black border border-neutral-200 text-xs font-sans font-semibold rounded-xl cursor-pointer">Return storefront</button>
            </div>
          )
        )}

        {/* VIEW: ADMIN PORTAL SCREEN */}
        {activeTab === "admin-portal" && (
          user && user.role === "admin" ? (
            <DashboardAdmin
              token={token}
              onRefreshConfig={fetchGlobalConfigAndCategories}
            />
          ) : (
            <div id="admin-protected-error" className="max-w-md mx-auto py-24 text-center space-y-4">
              <ShieldAlert className="w-12 h-12 text-red-650 mx-auto animate-pulse" />
              <h2 className="font-sans font-bold text-lg text-neutral-950">Unauthorized Admin Gate</h2>
              <p className="font-sans text-xs text-neutral-400">Gaining access to system configurations, seller queues, and audit trail metrics requires dedicated secret encryption keys.</p>
              <button onClick={() => setActiveTab("admin-login")} className="px-5 py-2 hover:bg-neutral-850 bg-neutral-900 text-white text-xs font-sans font-semibold rounded-xl cursor-pointer">Access Console Portal</button>
            </div>
          )
        )}

        {/* VIEW: SECRET ADMIN PORTAL LOGIN GATED FORM */}
        {activeTab === "admin-login" && (
          <div id="admin-secret-login" className="max-w-md mx-auto py-28 px-4 animate-in fade-in duration-300">
            <div className="bg-white p-8 rounded-2xl border border-neutral-150 shadow-sm space-y-6">
              <div className="text-center space-y-1">
                <h2 className="font-sans font-bold text-xl text-neutral-900">Admin Vault Decryption</h2>
                <p className="font-sans text-xs text-neutral-400">Decouple security logs and settings. Enter administration secret.</p>
              </div>

              {adminAuthError && (
                <div className="p-3 bg-red-50 border border-red-150 rounded-xl text-red-700 font-sans text-xs">
                  {adminAuthError}
                </div>
              )}

              <form onSubmit={handleAdminSecretLogin} className="space-y-4">
                <div>
                  <label className="font-sans text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">Administrative Secret Key</label>
                  <div className="flex items-center border border-neutral-200 rounded-xl px-3 focus-within:border-black bg-white">
                    <Lock className="w-4 h-4 text-neutral-350" />
                    <input
                      type="password"
                      required
                      placeholder="ADMIN_SECRET Passphrase..."
                      value={adminSecretInput}
                      onChange={(e) => setAdminSecretInput(e.target.value)}
                      className="w-full font-sans text-xs p-3.5 outline-none text-neutral-850"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-neutral-1050 hover:bg-neutral-950 text-white font-sans font-bold text-xs tracking-wider uppercase rounded-xl shadow cursor-pointer"
                >
                  Open administration dashboard
                </button>
              </form>
            </div>
          </div>
        )}

      </main>

      {/* FOOTER BAR */}
      <footer id="app-footer" className="bg-neutral-50/50 border-t border-neutral-100 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1.5 flex flex-col items-center sm:items-start text-center sm:text-left select-none">
            <span className="font-sans font-bold text-sm text-neutral-900">{platformName}</span>
            <span className="text-[10px] font-sans text-neutral-400 font-medium leading-relaxed block">Curated Sensory Products and Carbon-Neutral Dispatch Channels. Private LLC Corp. 2026.</span>
          </div>
          <div className="flex items-center gap-6 font-sans text-xs">
            <button
              onClick={() => setActiveTab("admin-login")}
              className="font-semibold text-neutral-400 hover:text-neutral-900 cursor-pointer"
            >
              Portal Administration Console
            </button>
          </div>
        </div>
      </footer>

      {/* FLOATING DETACHED CHECKOUT OVERLAY MODAL */}
      {showCheckout && cart && (
        <CheckoutModal
          cart={cart}
          token={token}
          onClose={() => setShowCheckout(false)}
          onOrderSuccess={handleOrderCompletionSuccess}
        />
      )}

      {/* Dynamic Toast notifications portal floating rendering */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-lg border text-xs font-sans font-medium flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-250 ${
              t.type === "success" 
                ? "bg-emerald-900 border-emerald-850 text-white" 
                : t.type === "error" 
                  ? "bg-rose-900 border-rose-850 text-white" 
                  : "bg-neutral-900 border-neutral-850 text-white"
            }`}
          >
            <span>{t.message}</span>
            <button 
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="text-white/60 hover:text-white cursor-pointer ml-2 text-[10px]"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
