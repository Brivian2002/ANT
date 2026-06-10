import React from "react";
import { Plus, Edit, Trash2, Eye, EyeOff, Package, DollarSign, ListOrdered, AlertTriangle, Check, RefreshCw, X, TrendingUp, Sparkles, Upload, Building2, Send } from "lucide-react";
import { Product, Order, Category } from "../types";

interface DashboardSellerProps {
  token: string | null;
  categories: Category[];
  onRefreshProducts: () => void;
}

export default function DashboardSeller({ token, categories, onRefreshProducts }: DashboardSellerProps) {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [walletBalance, setWalletBalance] = React.useState(0);
  const [metrics, setMetrics] = React.useState({
    revenue: 0,
    ordersCount: 0,
    productsCount: 0,
    lowStockCount: 0
  });

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Form State for creating/editing products
  const [showFormModal, setShowFormModal] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [formName, setFormName] = React.useState("");
  const [formDesc, setFormDesc] = React.useState("");
  const [formPrice, setFormPrice] = React.useState("");
  const [formSalePrice, setFormSalePrice] = React.useState("");
  const [formStock, setFormStock] = React.useState("");
  const [formCategory, setFormCategory] = React.useState("");
  const [formImgUrl, setFormImgUrl] = React.useState("");
  const [formTag, setFormTag] = React.useState<"hot-deal" | "shipping-free" | "none">("none");
  const [uploadingImage, setUploadingImage] = React.useState(false);

  // Order Fulfillment State
  const [updatingOrderId, setUpdatingOrderId] = React.useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = React.useState("");
  const [fulfillComment, setFulfillComment] = React.useState("");
  const [fulfillStatus, setFulfillStatus] = React.useState<"preparing" | "shipped" | "delivered">("preparing");

  // Ad Boosting State
  const [boostingProductId, setBoostingProductId] = React.useState<string | null>(null);
  const [boostingTier, setBoostingTier] = React.useState<"1_day" | "3_days" | "1_month">("1_day");
  const [isBoostingSubmit, setIsBoostingSubmit] = React.useState(false);

  // Payout / Withdrawal State
  const [withdrawAmount, setWithdrawAmount] = React.useState("");
  const [withdrawBank, setWithdrawBank] = React.useState("MTN Mobile Money");
  const [withdrawAccount, setWithdrawAccount] = React.useState("");
  const [submittingWithdraw, setSubmittingWithdraw] = React.useState(false);

  const [formSaving, setFormSaving] = React.useState(false);

  const loadSellerData = React.useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const sellerProfileToken = token.replace("auth-session-", "");

      // 1. Fetch products
      const pRes = await fetch("/api/products", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const pData = await pRes.json();
      const sellerProds = pData.filter((p: any) => p.sellerId === sellerProfileToken);
      setProducts(sellerProds);

      // 2. Fetch orders
      const oRes = await fetch("/api/orders", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const oData = await oRes.json();
      setOrders(oData);

      // 3. Fetch user wallet balance
      // We look up user parameters inside users list or can query config
      const uRes = await fetch("/api/auth/register"); // We fetch metrics which also streams profiles
      // Simple loop over users list is alternative, let's fetch sellers profile
      const usersRes = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (usersRes.ok) {
        const usersList = await usersRes.json();
        const me = usersList.find((u: any) => u.id === sellerProfileToken);
        if (me) {
          setWalletBalance(me.walletBalance || 0);
        }
      }

      // Compute metrics
      const rev = oData.reduce((sum: number, ord: Order) => {
        const sellerItemsSum = ord.items
          .filter(item => item.sellerId === sellerProfileToken)
          .reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0);
        return sum + sellerItemsSum;
      }, 0);

      const lowStock = sellerProds.filter((p: Product) => p.stock <= 5).length;

      setMetrics({
        revenue: Math.round(rev * 100) / 100,
        ordersCount: oData.length,
        productsCount: sellerProds.length,
        lowStockCount: lowStock
      });

    } catch (err: any) {
      setError("Failed to stream seller metrics from server hub.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    loadSellerData();
  }, [loadSellerData]);

  // Native local photo raw uploader logic
  const handlePhotoUploaderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name: file.name,
            base64: base64String
          })
        });

        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.url) {
          setFormImgUrl(uploadData.url);
        } else {
          alert(uploadData.error || "Failed to upload image.");
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert("Error reading file.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleOpenCreateForm = () => {
    setEditingProduct(null);
    setFormName("");
    setFormDesc("");
    setFormPrice("");
    setFormSalePrice("");
    setFormStock("");
    setFormCategory(categories[0]?.id || "");
    setFormImgUrl("");
    setFormTag("none");
    setShowFormModal(true);
  };

  const handleOpenEditForm = (prod: Product) => {
    setEditingProduct(prod);
    setFormName(prod.name);
    setFormDesc(prod.description);
    setFormPrice(String(prod.price));
    setFormSalePrice(prod.salePrice ? String(prod.salePrice) : "");
    setFormStock(String(prod.stock));
    setFormCategory(prod.categoryId);
    setFormImgUrl(prod.images?.[0]?.url || "");
    setFormTag((prod.tag as any) || "none");
    setShowFormModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formDesc || !formPrice || !formStock || !formCategory) {
      alert("Please complete all required product settings.");
      return;
    }

    setFormSaving(true);
    try {
      const payload = {
        name: formName,
        description: formDesc,
        price: parseFloat(formPrice),
        salePrice: formSalePrice ? parseFloat(formSalePrice) : null,
        stock: parseInt(formStock),
        categoryId: formCategory,
        imageUrls: formImgUrl ? [formImgUrl] : [],
        tag: formTag === "none" ? null : formTag
      };

      const url = editingProduct ? `/api/products/${editingProduct.id}` : "/api/products";
      const method = editingProduct ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to commit product changes.");
      }

      setShowFormModal(false);
      loadSellerData();
      onRefreshProducts();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Are you absolutely sure you want to delete this product? This action is irreversible.")) {
      return;
    }

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        loadSellerData();
        onRefreshProducts();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to delete product.");
      }
    } catch (err) {
      alert("Error occurred on deleting product.");
    }
  };

  const handleToggleVisibility = async (prod: Product) => {
    try {
      const res = await fetch(`/api/products/${prod.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isVisible: !prod.isVisible })
      });
      if (res.ok) {
        loadSellerData();
        onRefreshProducts();
      }
    } catch (err) {
      console.error("Error setting visibility", err);
    }
  };

  const handleFulfillOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingOrderId) return;

    try {
      const res = await fetch(`/api/orders/${updatingOrderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: fulfillStatus,
          comment: fulfillComment || `Package handoff marked as ${fulfillStatus}.`,
          trackingNumber: trackingNumber || null
        })
      });

      if (res.ok) {
        setUpdatingOrderId(null);
        setTrackingNumber("");
        setFulfillComment("");
        loadSellerData();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to change shipment state.");
      }
    } catch (err) {
      alert("Error on fulfillment.");
    }
  };

  const handleBoostAdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boostingProductId) return;

    setIsBoostingSubmit(true);
    try {
      const res = await fetch(`/api/products/${boostingProductId}/boost`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ tier: boostingTier })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Campaign successfully powered! Product has been boosted on storefront.");
        setBoostingProductId(null);
        loadSellerData();
        onRefreshProducts();
      } else {
        alert(data.error || "Required wallet balance is missing. Please top up funds first.");
      }
    } catch (err) {
      alert("Error setting up dynamic ad campaign.");
    } finally {
      setIsBoostingSubmit(false);
    }
  };

  const handleWithdrawalRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawAmount || !withdrawAccount) {
      alert("Please specify withdrawal amount and account number.");
      return;
    }

    const value = parseFloat(withdrawAmount);
    if (value > walletBalance) {
      alert(`Limit exceeded. Minimum settlement requested must be equal or less than GH₵ ${walletBalance.toFixed(2)}.`);
      return;
    }

    setSubmittingWithdraw(true);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: value,
          bankName: withdrawBank,
          accountNumber: withdrawAccount
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Withdrawal request dispatched to admin Desk! Once approved, funds will clear on Mobile Money wallet.");
        setWithdrawAmount("");
        setWithdrawAccount("");
        loadSellerData();
      } else {
        alert(data.error || "Dispatched request unsuccessful.");
      }
    } catch (err) {
      alert("Network server busy. Try again.");
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  if (loading && products.length === 0) {
    return (
      <div id="seller-loading-state" className="max-w-7xl mx-auto px-4 py-24 flex flex-col items-center justify-center gap-4">
        <RefreshCw className="w-8 h-8 text-neutral-400 animate-spin" />
        <span className="font-sans text-sm text-neutral-500">Loading your Seller Command console...</span>
      </div>
    );
  }

  return (
    <div id="seller-dashboard-container" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Welcome header */}
      <div id="seller-dashboard-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-6 mb-10">
        <div>
          <h1 className="font-sans font-bold text-3xl text-neutral-900 tracking-tight">Seller Hub</h1>
          <p className="font-sans text-sm text-neutral-500 mt-1">Manage your storefront catalogues, track wallet balance profit, and fulfill orders.</p>
        </div>
        <button
          id="btn-create-product"
          onClick={handleOpenCreateForm}
          className="px-4.5 py-2.5 rounded-xl bg-neutral-900 text-xs font-sans font-semibold text-white hover:bg-neutral-800 shadow-sm flex items-center gap-2 cursor-pointer transition-all self-start sm:self-center select-none"
        >
          <Plus className="w-4 h-4" />
          Add New Product
        </button>
      </div>

      {/* Metrics Cards row */}
      <div id="seller-metrics-row" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div id="metric-revenue" className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm flex items-center gap-4.5">
          <div className="w-12 h-12 rounded-xl bg-neutral-50 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="font-sans text-xs font-medium text-neutral-400 uppercase tracking-wider block">Gross Sales</span>
            <span className="font-sans font-bold text-xl text-neutral-900 block mt-0.5">GH₵ {metrics.revenue.toLocaleString("en-GH", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div id="metric-orders" className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm flex items-center gap-4.5">
          <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-950">
            <ListOrdered className="w-6 h-6" />
          </div>
          <div>
            <span className="font-sans text-xs font-medium text-neutral-400 uppercase tracking-wider block">Total Orders</span>
            <span className="font-sans font-semibold text-xl text-neutral-900 block mt-0.5">{metrics.ordersCount} requests</span>
          </div>
        </div>

        <div id="metric-products" className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm flex items-center gap-4.5">
          <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-905">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <span className="font-sans text-xs font-medium text-neutral-400 uppercase tracking-wider block">Products Listed</span>
            <span className="font-sans font-semibold text-xl text-neutral-900 block mt-0.5">{metrics.productsCount} catalogued</span>
          </div>
        </div>

        <div id="metric-lowstock" className={`p-6 rounded-2xl border flex items-center gap-4.5 shadow-sm transition-all bg-white border-neutral-100`}>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="font-sans text-xs font-medium text-neutral-400 uppercase tracking-wider block">Withdrawable Balance</span>
            <span className="font-mono font-bold text-lg text-emerald-600 block mt-0.5">GH₵ {walletBalance.toLocaleString("en-GH", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Main split sections */}
      <div id="seller-split-grid" className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* Left Side: Products Catalogue */}
        <div id="products-table-section" className="lg:col-span-2 space-y-4 bg-white p-6 sm:p-8 rounded-2xl border border-neutral-100 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-50 pb-4 mb-4">
            <h2 className="font-sans font-semibold text-lg text-neutral-900">Your Catalogue</h2>
            <button onClick={loadSellerData} className="p-1.5 rounded text-neutral-400 hover:text-neutral-900 cursor-pointer">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {products.length === 0 ? (
            <div id="seller-no-products" className="py-20 flex flex-col items-center justify-center text-center gap-3">
              <Package className="w-10 h-10 text-neutral-300" />
              <h3 className="font-sans font-semibold text-sm text-neutral-800">Your store is completely empty</h3>
              <p className="font-sans text-xs text-neutral-400 max-w-xs">List your first handcrafted product or boutique accessory above to start receiving organic sales.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table id="seller-products-table" className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-100 text-[10px] font-sans font-semibold text-neutral-400 uppercase tracking-wider">
                    <th className="py-3 font-semibold">Product info</th>
                    <th className="py-3 font-semibold">Category</th>
                    <th className="py-3 font-semibold">Price</th>
                    <th className="py-3 font-semibold">Stock</th>
                    <th className="py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {products.map(prod => {
                    const priceStr = prod.salePrice !== null ? (
                      <span className="font-sans text-xs">
                        <span className="font-semibold text-neutral-900">GH₵{prod.salePrice}</span>
                        <span className="text-[10px] text-neutral-400 line-through ml-1.5">GH₵{prod.price}</span>
                      </span>
                    ) : (
                      <span className="font-sans font-medium text-xs text-neutral-800">GH₵{prod.price}</span>
                    );

                    const categoryName = categories.find(c => c.id === prod.categoryId)?.name || "Ghana Storefront";

                    return (
                      <tr key={prod.id} id={`row-product-${prod.id}`} className="hover:bg-neutral-50/40 transition-colors">
                        <td className="py-4 flex items-center gap-3">
                          <img
                            src={prod.images?.[0]?.url || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&q=80&w=80"}
                            alt={prod.name}
                            className="w-11 h-11 object-cover rounded-lg bg-neutral-100"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex flex-col">
                            <span className="font-sans font-semibold text-xs text-neutral-950 max-w-40 sm:max-w-64 truncate flex items-center gap-1.5">
                              {prod.name}
                              {prod.isBoosted && (
                                <span className="bg-amber-100 border border-amber-200 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase flex items-center gap-0.5">
                                  <Sparkles className="w-2 h-2" />
                                  Boosted
                                </span>
                              )}
                            </span>
                            <span className="font-mono text-[9px] text-neutral-400 mt-0.5 truncate flex items-center gap-1.5">
                              {prod.id}
                              {prod.tag && (
                                <span className="text-[10px] font-sans text-emerald-600 font-bold block bg-emerald-50 px-1 py-0.2 rounded border border-emerald-100">
                                  {prod.tag}
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 font-sans text-xs text-neutral-500 capitalize">{categoryName}</td>
                        <td className="py-4">{priceStr}</td>
                        <td className="py-4">
                          <span className={`font-sans font-medium text-xs rounded-full px-2 py-0.5 ${
                            prod.stock === 0 ? "bg-red-50 text-red-700 font-semibold" : prod.stock <= 5 ? "bg-amber-50 text-amber-800 font-semibold" : "text-neutral-600"
                          }`}>
                            {prod.stock === 0 ? "Out of Stock" : `${prod.stock} units`}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              id={`btn-boost-${prod.id}`}
                              onClick={() => setBoostingProductId(prod.id)}
                              className="p-1 px-1.5 rounded bg-gradient-to-r from-amber-500 to-yellow-500 border border-amber-400 text-white font-sans text-[10px] font-bold hover:brightness-105 active:scale-95 transition-all text-neutral-900 cursor-pointer flex items-center gap-0.5 shadow-sm"
                              title="Campaign boost ad package"
                            >
                              <Sparkles className="w-3 h-3 text-white" />
                              Boost
                            </button>
                            <button
                              id={`btn-toggle-visible-${prod.id}`}
                              onClick={() => handleToggleVisibility(prod)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 cursor-pointer transition-all"
                              title={prod.isVisible ? "Hide Product on storefront" : "Make Product public"}
                            >
                              {prod.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-zinc-300" />}
                            </button>
                            <button
                              id={`btn-edit-prod-${prod.id}`}
                              onClick={() => handleOpenEditForm(prod)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 cursor-pointer transition-all"
                              title="Edit parameters"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              id={`btn-delete-prod-${prod.id}`}
                              onClick={() => handleDeleteProduct(prod.id)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-650 hover:bg-red-50 cursor-pointer transition-all"
                              title="Delete permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Side: Orders Fulfillment AND Wallet Withdrawals */}
        <div id="incoming-orders-section" className="space-y-6">
          
          {/* Payout & Withdrawal Panel */}
          <div id="withdrawal-panel" className="bg-white p-6 sm:p-8 rounded-2xl border border-neutral-105 shadow-sm space-y-4">
            <h2 className="font-sans font-semibold text-base text-neutral-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              Settlement Center
            </h2>
            <p className="font-sans text-xs text-neutral-400 leading-relaxed">
              Disburse your accumulated shop profits directly into your local Ghana Account or Mobile Money.
            </p>

            <form onSubmit={handleWithdrawalRequestSubmit} className="space-y-3.5">
              <div>
                <label className="font-sans text-[10px] font-bold text-neutral-500 uppercase block mb-1">Select Transfer Gateway</label>
                <select
                  value={withdrawBank}
                  onChange={(e) => setWithdrawBank(e.target.value)}
                  className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-200 focus:border-neutral-900 outline-none bg-white"
                >
                  <option value="MTN Mobile Money">MTN Mobile Money (MoMo)</option>
                  <option value="Telecel Cash">Telecel Cash</option>
                  <option value="GCB Bank">GCB Bank PLC (Ghana)</option>
                  <option value="Absa Bank Ghana">Absa Bank Ghana</option>
                  <option value="Fidelity Bank Ghana">Fidelity Bank Ghana Ltd</option>
                </select>
              </div>

              <div>
                <label className="font-sans text-[10px] font-bold text-neutral-500 uppercase block mb-1">Account / Mobile Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 054XXXXXXX or Account number"
                  value={withdrawAccount}
                  onChange={(e) => setWithdrawAccount(e.target.value)}
                  className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-200 focus:border-neutral-950 outline-none"
                />
              </div>

              <div>
                <label className="font-sans text-[10px] font-bold text-neutral-500 uppercase block mb-1">Settlement Sum (GH₵)</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="5"
                  placeholder="GH₵ Amount to transfer"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-200 focus:border-neutral-950 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submittingWithdraw || walletBalance <= 0}
                className="w-full py-2.5 bg-neutral-900 text-white hover:bg-neutral-850 disabled:opacity-50 font-sans font-semibold text-xs rounded-xl shadow-sm cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
              >
                {submittingWithdraw ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Submit Settlement Claim
              </button>
            </form>
          </div>

          {/* Store Fulfillment */}
          <div id="seller-fulfillment-pane" className="bg-white p-6 sm:p-8 rounded-2xl border border-neutral-100 shadow-sm space-y-4">
            <h2 className="font-sans font-semibold text-lg text-neutral-900 border-b border-gray-50 pb-4">Store Fulfillment</h2>

            {orders.length === 0 ? (
              <div id="seller-no-orders" className="py-16 text-center space-y-3">
                <ListOrdered className="w-10 h-10 text-neutral-350 mx-auto" />
                <h3 className="font-sans font-semibold text-xs text-neutral-800">No active client orders</h3>
                <p className="font-sans text-[11px] text-neutral-400 max-w-xs mx-auto">When customers purchase items listed inside your catalog, order fulfillments appear here instantly.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {orders.map(ord => {
                  const sellerAndAdminId = token ? token.replace("auth-session-", "") : "";
                  const items = ord.items.filter(oi => oi.sellerId === sellerAndAdminId);
                  const itemNames = items.map(oi => `${oi.productName} (x${oi.quantity})`).join(", ");

                  if (items.length === 0) return null;

                  return (
                    <div key={ord.id} id={`ord-card-${ord.id}`} className="p-4 rounded-xl border border-neutral-150 space-y-3.5 hover:border-neutral-300 transition-all bg-neutral-50/30">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="font-sans font-bold text-xs text-neutral-950 uppercase tracking-tight">{ord.id}</span>
                          <span className="font-sans text-[10px] text-neutral-400 mt-0.5">{new Date(ord.createdAt).toLocaleDateString()}</span>
                        </div>
                        <span className={`font-sans font-semibold text-[10px] uppercase rounded-full px-2 py-0.5 ${
                          ord.status === "shipped" || ord.status === "delivered" ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-800"
                        }`}>
                          {ord.status}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <span className="font-sans text-xs text-neutral-500 block">Deliverables:</span>
                        <span className="font-sans font-medium text-xs text-neutral-800 block leading-relaxed">{itemNames}</span>
                      </div>

                      <div className="space-y-1 text-xs border-t border-neutral-100 pt-3">
                        <span className="font-sans text-neutral-500 max-w-full block">Customer Address:</span>
                        <p className="font-sans font-medium text-neutral-800 inline-block leading-relaxed">
                          {ord.shippingAddress.name} <br />
                          {ord.shippingAddress.street}, {ord.shippingAddress.city}, {ord.shippingAddress.postalCode}
                        </p>
                      </div>

                      {updatingOrderId === ord.id ? (
                        <form onSubmit={handleFulfillOrderSubmit} className="space-y-3 border-t border-gray-100 pt-3.5 animate-in fade-in zoom-in-95 duration-150">
                          <div>
                            <label className="font-sans text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">Fulfillment Stage</label>
                            <select
                              value={fulfillStatus}
                              onChange={(e) => setFulfillStatus(e.target.value as any)}
                              className="w-full font-sans text-xs p-2 rounded-lg border border-neutral-200 outline-none focus:border-neutral-900 bg-white"
                            >
                              <option value="preparing">Preparing Package</option>
                              <option value="shipped">Package Shipped</option>
                              <option value="delivered">Package Delivered</option>
                            </select>
                          </div>
                          <div>
                            <label className="font-sans text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">Optional Tracking Code</label>
                            <input
                              type="text"
                              placeholder="e.g. GPD 1Z29A-..."
                              value={trackingNumber}
                              onChange={(e) => setTrackingNumber(e.target.value)}
                              className="w-full font-sans text-xs p-2 rounded-lg border border-neutral-200 outline-none focus:border-neutral-950 bg-white"
                            />
                          </div>
                          <div>
                            <label className="font-sans text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">Internal Note</label>
                            <input
                              type="text"
                              placeholder="e.g. Left with reception desk..."
                              value={fulfillComment}
                              onChange={(e) => setFulfillComment(e.target.value)}
                              className="w-full font-sans text-xs p-2 rounded-lg border border-neutral-200 outline-none focus:border-neutral-950 bg-white"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="flex-1 py-1.5 bg-neutral-900 text-[11px] font-sans font-semibold text-white rounded-lg hover:bg-neutral-850 cursor-pointer"
                            >
                              Save States
                            </button>
                            <button
                              type="button"
                              onClick={() => setUpdatingOrderId(null)}
                              className="px-2.5 py-1.5 border border-neutral-200 rounded-lg text-neutral-400 hover:text-neutral-900 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        ord.status !== "delivered" && ord.status !== "cancelled" && (
                          <button
                            id={`btn-fulfill-trigger-${ord.id}`}
                            onClick={() => {
                              setUpdatingOrderId(ord.id);
                              setFulfillStatus(ord.status === "payment_received" || ord.status === "confirmed" ? "preparing" : "shipped");
                            }}
                            className="w-full py-2 border border-neutral-950 rounded-xl text-neutral-955 text-xs font-sans font-semibold hover:bg-neutral-50 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Resolve Fulfillment
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Product Boost Campaign ad system Modal overlay */}
      {boostingProductId && (
        <div id="boost-campaign-modal" className="fixed inset-0 z-55 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4.5 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="font-sans font-bold text-base text-neutral-900 flex items-center gap-2">
                <Sparkles className="text-amber-500 animate-pulse" />
                Dataghmart Premium ad Boost
              </h3>
              <button onClick={() => setBoostingProductId(null)} className="text-neutral-400 hover:text-neutral-900 cursor-pointer">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <form onSubmit={handleBoostAdSubmit} className="p-6 space-y-4">
              <p className="font-sans text-xs hover:text-neutral-700 text-neutral-505 leading-relaxed">
                Featured boosted listings appear strictly at the very top of all searches. Select your premium duration campaign tier:
              </p>

              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border border-neutral-150 rounded-xl hover:bg-neutral-50 cursor-pointer">
                  <input
                    type="radio"
                    name="boostTier"
                    value="1_day"
                    checked={boostingTier === "1_day"}
                    onChange={() => setBoostingTier("1_day")}
                    className="accent-neutral-950"
                  />
                  <div>
                    <span className="font-sans font-bold text-xs text-neutral-800 block">1 Day Sparkle</span>
                    <span className="font-sans text-[10px] text-neutral-400 block mt-0.5">Budget friendly top visibility — GH₵ 20.00</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border border-neutral-150 rounded-xl hover:bg-neutral-50 cursor-pointer">
                  <input
                    type="radio"
                    name="boostTier"
                    value="3_days"
                    checked={boostingTier === "3_days"}
                    onChange={() => setBoostingTier("3_days")}
                    className="accent-neutral-950"
                  />
                  <div>
                    <span className="font-sans font-bold text-xs text-neutral-800 block">3 Days Supercharge</span>
                    <span className="font-sans text-[10px] text-neutral-400 block mt-0.5">Weekend high traffic coverage — GH₵ 50.00 (Save GH₵ 10)</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border border-neutral-150 rounded-xl hover:bg-neutral-50 cursor-pointer">
                  <input
                    type="radio"
                    name="boostTier"
                    value="1_month"
                    checked={boostingTier === "1_month"}
                    onChange={() => setBoostingTier("1_month")}
                    className="accent-neutral-950"
                  />
                  <div>
                    <span className="font-sans font-bold text-xs text-neutral-800 block">1 Month Dominator Campaign</span>
                    <span className="font-sans text-[10px] text-neutral-400 block mt-0.5">Monthly storefront supremacy — GH₵ 300.00 (Highly Recommended)</span>
                  </div>
                </label>
              </div>

              <div className="flex gap-3 justify-end border-t border-neutral-50 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setBoostingProductId(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-sans font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isBoostingSubmit}
                  className="px-5 py-2 rounded-xl bg-neutral-900 border border-neutral-900 text-xs font-sans font-bold text-white hover:bg-neutral-800 shadow-xl disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isBoostingSubmit && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Boost Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Elegant Modal form for creating/editing product catalog objects */}
      {showFormModal && (
        <div id="product-form-modal" className="fixed inset-0 z-55 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4.5 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="font-sans font-bold text-base text-neutral-900">
                {editingProduct ? "Bespoke Product Adjuster" : "Create Storefront Placement"}
              </h3>
              <button onClick={() => setShowFormModal(false)} className="text-neutral-400 hover:text-neutral-900 cursor-pointer">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="font-sans text-xs font-medium text-neutral-500 block mb-1">Product placement name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ghana Luxury Kente Stole"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-200 focus:border-neutral-900 outline-none"
                />
              </div>

              <div>
                <label className="font-sans text-xs font-medium text-neutral-500 block mb-1">Explanatory description *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Tell clients about specifications, materials, and dispatch details..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-200 focus:border-neutral-900 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-sans text-xs font-medium text-neutral-500 block mb-1">Regular Price (GH₵) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="350"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-200 focus:border-neutral-900 outline-none"
                  />
                </div>
                <div>
                  <label className="font-sans text-xs font-medium text-neutral-500 block mb-1">Active Sale Price (GH₵)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="280 (optional)"
                    value={formSalePrice}
                    onChange={(e) => setFormSalePrice(e.target.value)}
                    className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-200 focus:border-neutral-900 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-sans text-xs font-medium text-neutral-500 block mb-1">Stock Amount *</label>
                  <input
                    type="number"
                    required
                    placeholder="12"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-200 focus:border-neutral-900 outline-none"
                  />
                </div>
                <div>
                  <label className="font-sans text-xs font-medium text-neutral-500 block mb-1">Product placement category *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-200 focus:border-neutral-900 outline-none bg-white"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="font-sans text-xs font-medium text-neutral-500 block mb-1">Product Tags / Ribbons</label>
                  <select
                    value={formTag}
                    onChange={(e) => setFormTag(e.target.value as any)}
                    className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-200 focus:border-neutral-900 outline-none bg-white font-semibold"
                  >
                    <option value="none">No Ribbon Tag</option>
                    <option value="hot-deal">🔥 Hot Deal</option>
                    <option value="shipping-free">🚚 Shipping Free</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-sans text-xs font-medium text-neutral-500 block mb-2 font-semibold">Product Photo File *</label>
                
                {/* Active Photo file selector interface */}
                <div className="p-4 border-2 border-dashed border-neutral-200 rounded-xl text-center space-y-2 bg-neutral-50/50 hover:bg-neutral-50 hover:border-neutral-400 transition-all">
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="w-6 h-6 text-neutral-450 text-neutral-500" />
                    <span className="font-sans text-xs font-semibold text-neutral-700">Choose physical file or photo of your product</span>
                    <span className="text-[10px] text-neutral-400">Allows instant upload storage on system disk.</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUploaderChange}
                    className="hidden"
                    id="product-photo-upload-input"
                  />
                  <label
                    htmlFor="product-photo-upload-input"
                    className="inline-block px-3.5 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-sans font-semibold cursor-pointer shadow-sm hover:bg-neutral-850 transition-colors"
                  >
                    Select File
                  </label>
                </div>

                <div className="mt-3">
                  <label className="font-sans text-[10px] font-bold text-neutral-400 block mb-1 uppercase">Photo Remote URL / Base64 Output</label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/photo-... or auto-uploaded folder path"
                    value={formImgUrl}
                    onChange={(e) => setFormImgUrl(e.target.value)}
                    className="w-full font-mono text-[10px] p-2.5 rounded-xl border border-neutral-200 focus:border-neutral-900 outline-none"
                  />
                  {formImgUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Target Loaded Successfully
                      </span>
                      <button
                        type="button"
                        onClick={() => setFormImgUrl("")}
                        className="text-[10px] font-sans font-medium text-rose-600 hover:underline"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 justify-end border-t border-neutral-50 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-sans font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={formSaving || uploadingImage}
                  className="px-5 py-2 rounded-xl bg-neutral-900 text-xs font-sans font-semibold text-white hover:bg-neutral-800 shadow-sm disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                >
                  {formSaving && <RefreshCw className="w-3 h-3 animate-spin" />}
                  Commit Catalogue Placement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
