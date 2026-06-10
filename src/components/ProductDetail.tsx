import React from "react";
import { ArrowLeft, ShoppingBag, Heart, Star, Sparkles, RefreshCw, MessageSquare } from "lucide-react";
import { Product, UserProfile, Review } from "../types";

interface ProductDetailProps {
  productId: string;
  user: UserProfile | null;
  token: string | null;
  onBack: () => void;
  onAddToCart: (productId: string, quantity: number) => void;
  onToggleWishlist: (productId: string) => void;
  wishlistedProducts: string[];
}

export default function ProductDetail({
  productId,
  user,
  token,
  onBack,
  onAddToCart,
  onToggleWishlist,
  wishlistedProducts
}: ProductDetailProps) {
  const [product, setProduct] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [addingToCart, setAddingToCart] = React.useState(false);
  
  // Gallery State
  const [selectedImage, setSelectedImage] = React.useState("");

  // Review form state
  const [ratingInput, setRatingInput] = React.useState(5);
  const [commentInput, setCommentInput] = React.useState("");
  const [savingReview, setSavingReview] = React.useState(false);

  // Recommendations
  const [related, setRelated] = React.useState<Product[]>([]);

  // Quantity to Add
  const [quantity, setQuantity] = React.useState(1);

  const fetchProductDetails = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}`);
      const data = await res.json();
      if (res.ok) {
        setProduct(data);
        setSelectedImage(data.images?.[0]?.url || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&q=80&w=600");
        
        // 2. Fetch recommendations
        const relRes = await fetch(`/api/products?category=${data.categoryId}`);
        const relData = await relRes.json();
        if (relRes.ok) {
          const filtered = relData.filter((item: Product) => item.id !== productId);
          setRelated(filtered.slice(0, 4));
        }
      }
    } catch (err) {
      console.error("Error loading product detail metadata.", err);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  React.useEffect(() => {
    fetchProductDetails();
  }, [fetchProductDetails]);

  const handleAddCartLocal = () => {
    if (product.stock === 0) return;
    setAddingToCart(true);
    onAddToCart(product.id, quantity);
    setTimeout(() => setAddingToCart(false), 800);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput) return;
    setSavingReview(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          productId: product.id,
          rating: ratingInput,
          comment: commentInput
        })
      });

      if (res.ok) {
        setCommentInput("");
        setRatingInput(5);
        fetchProductDetails();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to commit review.");
      }
    } catch (err) {
      alert("Error occurred publishing review.");
    } finally {
      setSavingReview(false);
    }
  };

  if (loading) {
    return (
      <div id="detail-loading-state" className="max-w-7xl mx-auto px-4 py-24 flex flex-col items-center justify-center gap-4">
        <RefreshCw className="w-8 h-8 text-neutral-400 animate-spin" />
        <span className="font-sans text-sm text-neutral-500">Retrieving product catalogue configurations...</span>
      </div>
    );
  }

  if (!product) {
    return (
      <div id="detail-error-state" className="max-w-7xl mx-auto px-4 py-24 text-center space-y-4">
        <h3 className="font-sans font-bold text-lg text-neutral-900">Catalogue placement not found</h3>
        <button onClick={onBack} className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-semibold hover:border-black cursor-pointer">
          Return Storefront
        </button>
      </div>
    );
  }

  const isWishlisted = wishlistedProducts.includes(product.id);
  const hasSale = product.salePrice !== null;
  const currentPrice = hasSale ? product.salePrice : product.price;

  return (
    <div id="product-detail-page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16 animate-in fade-in duration-200">
      {/* Back Button */}
      <div>
        <button
          id="btn-back-catalog"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-neutral-500 hover:text-neutral-900 text-xs font-sans font-semibold cursor-pointer py-1.5 focus:outline-none"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Catalogue
        </button>
      </div>

      {/* Main detail columns */}
      <div id="detail-main-columns" className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
        
        {/* Left Column: Image Selector Gallery */}
        <div id="detail-gallery-col" className="lg:col-span-7 space-y-4">
          <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-neutral-50 border border-neutral-100 flex items-center justify-center relative shadow-sm">
            <img
              src={selectedImage}
              alt={product.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            
            {/* Display multiple visual ribbons: Boosted, hot-deals, shipping free, or organic sales */}
            <div className="absolute top-4 left-4 flex flex-col gap-2.5">
              {product.isBoosted && (
                <span className="bg-gradient-to-r from-amber-500 to-yellow-500 border border-amber-400 font-sans text-[10px] font-extrabold text-white uppercase tracking-wider px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-white animate-pulse" />
                  Premium Featured
                </span>
              )}
              {product.tag && product.tag !== "none" && (
                <span className="bg-teal-600 border border-teal-500 font-sans text-[10px] font-bold text-white uppercase tracking-wider px-3 py-1 rounded-full shadow-md">
                  {product.tag === "hot-deal" ? "🔥 Hot Deal" : "🚚 Free Delivery"}
                </span>
              )}
            </div>
          </div>

          {/* Thumbnails row */}
          {product.images && product.images.length > 1 && (
            <div id="gallery-thumbnails" className="flex items-center gap-3">
              {product.images.map((img: any) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(img.url)}
                  className={`w-18 h-18 rounded-xl overflow-hidden border bg-neutral-50 cursor-pointer transition-all ${
                    selectedImage === img.url ? "border-neutral-950 ring-2 ring-neutral-200" : "border-neutral-200 hover:border-neutral-400"
                  }`}
                >
                  <img src={img.url} alt="detail thumbnail" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Information & checkout actions */}
        <div id="detail-info-col" className="lg:col-span-5 space-y-6">
          <div className="space-y-2">
            <span className="px-2.5 py-0.5 bg-neutral-100 text-[10px] font-sans font-bold text-neutral-500 rounded-full tracking-wider uppercase inline-block">
              Storefront placement
            </span>
            <h1 className="font-sans font-bold text-2xl sm:text-3xl text-neutral-900 tracking-tight leading-tight">
              {product.name}
            </h1>
            
            {/* Rating summary */}
            <div className="flex items-center gap-2 pt-1">
              <div className="flex items-center text-amber-550">
                {[1,2,3,4,5].map(x => (
                  <Star key={x} className={`w-3.5 h-3.5 ${x <= Math.round(product.averageRating || 0) ? "fill-amber-450 text-amber-450 text-orange-400" : "text-gray-200"}`} />
                ))}
              </div>
              <span className="font-sans text-xs font-semibold text-neutral-900">{product.averageRating?.toFixed(1) || "5.0"}</span>
              <span className="font-sans text-[11px] text-neutral-400">({product.reviewCount || 0} reviews)</span>
            </div>
          </div>

          {/* Pricing panel - uniform Ghana Cedi */}
          <div className="py-4 border-y border-neutral-100 flex items-baseline gap-3">
            {hasSale ? (
              <React.Fragment>
                <span className="font-sans font-bold text-2xl text-neutral-950">GH₵{product.salePrice?.toFixed(2)}</span>
                <span className="font-sans text-sm text-neutral-400 line-through">GH₵{product.price.toFixed(2)}</span>
              </React.Fragment>
            ) : (
              <span className="font-sans font-bold text-2xl text-neutral-950">GH₵{product.price.toFixed(2)}</span>
            )}
            
            <div className="ml-auto">
              <span className={`font-sans font-semibold text-[10px] uppercase rounded-full px-2.5 py-1 ${
                product.stock === 0 ? "bg-red-50 text-red-700" : product.stock <= 5 ? "bg-amber-50 text-amber-800 animate-pulse" : "bg-neutral-50 text-neutral-750"
              }`}>
                {product.stock === 0 ? "Out of Stock" : product.stock <= 5 ? `Only ${product.stock} units left!` : "In Stock & Ready"}
              </span>
            </div>
          </div>

          {/* Description */}
          <p className="font-sans text-sm text-neutral-600 leading-relaxed font-medium">
            {product.description}
          </p>

          {/* Checkout controls */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            {product.stock > 0 && (
              <div className="flex items-center gap-3">
                <span className="font-sans text-xs text-neutral-500 font-medium">Fulfillment Quantity:</span>
                <div className="flex items-center border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-sm">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-1.5 font-sans text-sm text-neutral-600 hover:bg-neutral-50 cursor-pointer focus:outline-none"
                  >
                    -
                  </button>
                  <span className="px-4 py-1.5 font-sans text-xs font-semibold text-neutral-900 select-none">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    className="px-3 py-1.5 font-sans text-sm text-neutral-600 hover:bg-neutral-50 cursor-pointer focus:outline-none"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* CTA Actions */}
            <div className="flex gap-3">
              <button
                id="btn-add-cart-detail"
                disabled={product.stock === 0 || addingToCart}
                onClick={handleAddCartLocal}
                className="flex-1 py-3 bg-neutral-900 hover:bg-neutral-850 disabled:bg-neutral-100 disabled:text-neutral-400 font-sans font-bold text-xs text-white rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
              >
                {addingToCart ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
                {product.stock === 0 ? "Out of Stock" : addingToCart ? "Adding..." : "Add to Shopping Bag"}
              </button>

              <button
                id="btn-wishlist-detail"
                onClick={() => onToggleWishlist(product.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                  isWishlisted
                    ? "border-red-100 bg-red-50 text-red-650"
                    : "border-neutral-200 hover:border-neutral-950 hover:bg-neutral-50 text-neutral-500"
                }`}
                title="Save to Wishlist"
              >
                <Heart className={`w-5 h-5 ${isWishlisted ? "fill-red-600 text-red-600" : ""}`} />
              </button>
            </div>
          </div>

          {/* Seller bio */}
          {product.sellerName && (
            <div id="seller-bio-card" className="p-4 rounded-xl border border-neutral-150 bg-neutral-50/40 flex gap-3">
              <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white/90 font-sans font-bold text-sm">
                {product.sellerName.slice(0, 1).toUpperCase()}
              </div>
              <div className="space-y-1">
                <span className="font-sans font-semibold text-xs text-neutral-950 uppercase tracking-tight block">Merchant Storefront</span>
                <p className="font-sans text-[11px] text-neutral-500 leading-relaxed block">{product.sellerName} (Verified Dataghmart Merchant in Ghana)</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reviews list and submit review form */}
      <div id="detail-reviews-container" className="grid grid-cols-1 lg:grid-cols-12 gap-10 border-t border-neutral-100 pt-16">
        {/* Left: Reviews Feed */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-neutral-900" />
            <h2 className="font-sans font-semibold text-base text-neutral-950">Client Reviews & Notes</h2>
          </div>

          {product.reviews && product.reviews.length === 0 ? (
            <div id="empty-reviews" className="py-12 bg-neutral-50/40 rounded-2xl border border-neutral-150 text-center space-y-2">
              <span className="font-sans text-xs font-semibold text-neutral-800 block">No reviews shared for this product yet</span>
              <p className="font-sans text-[11px] text-neutral-400 max-w-sm mx-auto">Be the first to share your experience by providing a client testimonial on the right.</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 max-h-[400px] overflow-y-auto pr-2 space-y-4">
              {product.reviews?.map((r: Review) => (
                <div key={r.id} className="py-4 space-y-2 first:pt-0">
                  <div className="flex items-center justify-between">
                    <span className="font-sans font-semibold text-xs text-neutral-900">{r.userName}</span>
                    <span className="font-mono text-[9px] text-neutral-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>

                  {/* Stars */}
                  <div className="flex items-center text-amber-450 gap-0.5">
                    {[1,2,3,4,5].map(x => (
                      <Star key={x} className={`w-3 h-3 ${x <= r.rating ? "fill-amber-450" : "text-gray-200"}`} />
                    ))}
                  </div>

                  <p className="font-sans text-xs text-neutral-600 leading-relaxed font-medium">
                    {r.comment}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Write a Review Form */}
        <div className="lg:col-span-5 bg-neutral-50/50 border border-neutral-150 p-6 rounded-2xl self-start space-y-4">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-neutral-900 animate-pulse" />
            <h3 className="font-sans font-semibold text-xs text-neutral-950 block">Write Client Testimonial</h3>
          </div>

          {token ? (
            <form onSubmit={handleReviewSubmit} className="space-y-4 font-sans">
              <div>
                <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1.5">Numerical Rating</label>
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(starIdx => (
                    <button
                      key={starIdx}
                      type="button"
                      onClick={() => setRatingInput(starIdx)}
                      className="p-1 text-amber-450 cursor-pointer focus:outline-none"
                    >
                      <Star className={`w-5 h-5 ${starIdx <= ratingInput ? "fill-amber-450 text-amber-500" : "text-gray-200"}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1.5 font-bold">Detailed Feedback</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Share details of quality, aesthetics, and material feel..."
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-neutral-200 focus:border-neutral-900 outline-none bg-white"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingReview}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-850 text-xs font-semibold text-white rounded-xl shadow-sm disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1"
                >
                  {savingReview && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Publish Review
                </button>
              </div>
            </form>
          ) : (
            <div id="review-logout-prompt" className="py-6 text-center text-xs text-neutral-405 font-sans">
              Please sign in to write an organic review for this product catalogue item.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
