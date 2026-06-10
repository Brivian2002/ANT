import React from "react";
import { ShoppingBag, Heart, User, LogOut, LayoutDashboard, Shield, ChevronDown } from "lucide-react";
import { UserProfile, Cart } from "../types";

interface NavbarProps {
  user: UserProfile | null;
  cart: Cart | null;
  onNavigate: (tab: string) => void;
  onLogout: () => void;
  activeTab: string;
  promoText?: string;
  platformName?: string;
}

export default function Navbar({
  user,
  cart,
  onNavigate,
  onLogout,
  activeTab,
  promoText,
  platformName = "Dataghmart"
}: NavbarProps) {
  const [showDropdown, setShowDropdown] = React.useState(false);

  const cartTotalItems = cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <header id="app-header" className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-gray-100 transition-all">
      {/* Top Announcement Bar */}
      {promoText && (
        <div id="promo-bar" className="w-full bg-neutral-900 py-2.5 px-4 text-center text-xs font-sans tracking-wide text-white/90">
          <div className="max-w-7xl mx-auto flex justify-center items-center gap-2">
            <span>{promoText}</span>
          </div>
        </div>
      )}

      {/* Main Bar */}
      <div id="navbar-main" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand Logo */}
        <div 
          id="navbar-brand" 
          onClick={() => onNavigate("home")} 
          className="flex items-center gap-2.5 cursor-pointer group select-none"
        >
          <div className="w-9 h-9 rounded-xl bg-neutral-900 flex items-center justify-center text-white ring-1 ring-neutral-800 shadow-sm transition-all group-hover:scale-105">
            <span className="font-mono font-bold text-lg select-none">D</span>
          </div>
          <span className="font-sans font-semibold text-lg tracking-tight text-neutral-900 group-hover:text-black transition-colors">
            {platformName}
          </span>
        </div>

        {/* Desktop Navigation Link Tabs */}
        <nav id="desktop-links" className="hidden md:flex items-center gap-8">
          <button
            id="nav-home"
            onClick={() => onNavigate("home")}
            className={`font-sans text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "home" ? "text-neutral-900 underline underline-offset-8 decoration-2" : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            Storefront
          </button>
          <button
            id="nav-shop"
            onClick={() => onNavigate("shop")}
            className={`font-sans text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "shop" ? "text-neutral-900 underline underline-offset-8 decoration-2" : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            All Products
          </button>
          {user && user.role === "customer" && (
            <button
              id="nav-orders"
              onClick={() => onNavigate("my-orders")}
              className={`font-sans text-sm font-medium transition-colors cursor-pointer ${
                activeTab === "my-orders" ? "text-neutral-900 underline underline-offset-8 decoration-2" : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              My Orders
            </button>
          )}
        </nav>

        {/* Right Side Controls */}
        <div id="right-side-actions" className="flex items-center gap-4 sm:gap-6">
          {/* Wallet Balance Badge */}
          {user && (
            <div 
              id="nav-wallet-badge"
              onClick={() => onNavigate("wallet")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-all cursor-pointer select-none ${
                activeTab === "wallet" 
                  ? "bg-neutral-900 border-neutral-900 text-white" 
                  : "bg-neutral-50 border-neutral-200/60 text-neutral-800 hover:bg-neutral-100"
              }`}
              title="Wallet Balance (Click to Deposit/Withdraw)"
            >
              <span className="text-emerald-600 font-sans font-bold">GH₵</span>
              <span>{(user.walletBalance || 0).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}

          {/* Wishlist Link */}
          {user && (
            <button
              id="nav-wishlist"
              onClick={() => onNavigate("wishlist")}
              className={`p-2.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 transition-all relative cursor-pointer ${
                activeTab === "wishlist" ? "text-neutral-950 bg-neutral-50" : ""
              }`}
              title="View Wishlist"
            >
              <Heart className="w-5 h-5" />
            </button>
          )}

          {/* Cart Icon Link */}
          <button
            id="nav-cart"
            onClick={() => onNavigate("cart")}
            className={`p-2.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 transition-all relative cursor-pointer ${
              activeTab === "cart" ? "text-neutral-950 bg-neutral-50" : ""
            }`}
            title="Shopping Cart"
          >
            <ShoppingBag className="w-5 h-5" />
            {cartTotalItems > 0 && (
              <span id="cart-item-badge" className="absolute top-1.5 right-1.5 min-w-4.5 h-4.5 px-1 bg-neutral-900 rounded-full flex items-center justify-center text-[10px] font-sans font-semibold text-white/95 scale-95 origin-top-right animate-pulse">
                {cartTotalItems}
              </span>
            )}
          </button>

          {/* User auth state actions */}
          {user ? (
            <div id="user-menu-dropdown" className="relative">
              <button
                id="user-profile-trigger"
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-neutral-100 hover:bg-neutral-50 select-none cursor-pointer transition-all"
              >
                <img
                  id="user-avatar"
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-7 h-7 rounded-lg ring-1 ring-neutral-200"
                  referrerPolicy="no-referrer"
                />
                <span id="user-name-label" className="hidden sm:inline font-sans text-xs font-medium text-neutral-700 max-w-24 truncate">
                  {user.name.split(" ")[0]}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
              </button>

              {/* Collapsible Dropdown drawer */}
              {showDropdown && (
                <div 
                  id="user-dropdown-drawer"
                  className="absolute right-0 mt-2 w-54 bg-white rounded-xl border border-neutral-100 shadow-xl py-1.5 ring-1 ring-black/5 z-50"
                  onMouseLeave={() => setShowDropdown(false)}
                >
                  <div className="px-4 py-2 border-b border-gray-50 flex flex-col">
                    <span className="font-sans font-medium text-xs text-neutral-900 max-w-full truncate">{user.name}</span>
                    <span className="font-mono text-[10px] text-neutral-400 capitalize truncate mt-0.5">{user.role}</span>
                  </div>

                  {/* Active dash indicators based on special admin & seller powers */}
                  {user.role === "admin" && (
                    <button
                      id="dropdown-admin-kpi"
                      onClick={() => {
                        onNavigate("admin-portal");
                        setShowDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-sans text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 flex items-center gap-2 cursor-pointer"
                    >
                      <Shield className="w-4 h-4 text-neutral-500" />
                      Platform Admin
                    </button>
                  )}

                  {user.role === "seller" && (
                    <button
                      id="dropdown-seller-kpi"
                      onClick={() => {
                        onNavigate("seller-portal");
                        setShowDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-sans text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 flex items-center gap-2 cursor-pointer"
                    >
                      <LayoutDashboard className="w-4 h-4 text-neutral-500" />
                      Seller Console
                    </button>
                  )}

                  <button
                    id="dropdown-logout"
                    onClick={() => {
                      onLogout();
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-sans text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 cursor-pointer border-t border-gray-50 mt-1.5 font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              id="nav-login-trigger"
              onClick={() => onNavigate("login")}
              className="px-4 py-2 rounded-xl bg-neutral-900 text-xs font-sans font-medium text-white/95 hover:bg-neutral-850 shadow-sm transition-all focus:ring-2 focus:ring-neutral-200 cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
