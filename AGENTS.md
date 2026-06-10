# AI Agent Rules and Development Instructions (AGENTS.md)

This instructions file is dynamically loaded by AI Studio agents to maintain project consistency and prevent architectural regressions.

---

## 🚀 1. ARCHITECTURAL OVERVIEW

DataGhmart is a full-stack, rapid-commerce application built on React 19 (Vite) and Express.js, configured to run in containers (binds to `0.0.0.0:3000`) and fully compatible with Vercel serverless deployment.

*   **Frontend**: React (v19) + Vite + Tailwind CSS (v4) + Lucide Icons and standard React hooks.
*   **Backend / API**: Express Server / Serverless endpoints (Vite + Vercel) fully integrated with the Supabase Client SDK.
*   **Database & Auth**: Supabase (PostgreSQL with Google OAuth Provider). No local SQL databases or client-exposed admin secrets.
*   **File Storage**: Supabase Storage (Buckets: `product-images`, `avatars`).

---

## 🗄️ 2. DATABASE SYSTEM & SCHEMAS (SUPABASE)

The persistent database backend runs on PostgreSQL via Supabase. All schemas must use clean queries using the `@supabase/supabase-js` client.

### Primary Operational Tables:
*   `profiles`: (id UUID PK references auth.users, email, full_name, role, seller_approved, avatar_url, balance, sign_in_count, last_sign_in_at, created_at)
*   `categories`: (id serial PK, name, slug unique, image_url)
*   `products`: (id serial PK, seller_id UUID, name, description, price, stock, category_id, location, free_shipping, delivery_days, is_visible, is_featured, boosted_until, average_rating, review_count, created_at, updated_at)
*   `product_images`: (id serial PK, product_id, url text, is_primary boolean, sort_order int)
*   `carts`: (id serial PK, user_id UUID references auth.users unique)
*   `cart_items`: (id serial PK, cart_id, product_id, quantity)
*   `orders`: (id serial PK, user_id UUID, status, shipping_address JSONB, subtotal, discount, total, payment_method, tracking_number, platform_commission, created_at, updated_at)
*   `order_items`: (id serial PK, order_id, product_id, seller_id UUID, product_name, price, quantity)
*   `order_status_history`: (id serial PK, order_id, status, comment, changed_by, created_at)
*   `boosts`: (id serial PK, product_id, seller_id, amount, duration_type, start_date, end_date, payment_ref)
*   `withdrawal_requests`: (id serial PK, seller_id, amount, status, created_at)
*   `sign_in_logs`: (id serial PK, user_id, sign_in_at, ip)

---

## 💳 3. TRANSACTION & WALLET CREDIT POLICIES

Wallet balance transactions are strictly audited to safeguard digital currencies on the platform:

1.  **Deposits & Boost Transactions (Paystack Live)**:
    *   Initialize payment via `/api/payment/initialize` payload matching customer metadata context (`userId`, `userName`).
    *   Verify references via `/api/payment/callback` or asynchronous paystack webhooks returning success signatures on `/api/payment/webhook`.
    *   Amounts passed to Paystack are in **pesewas** (amount in GHS * 100).
    *   Maintain platform commission (5%) upon transaction confirmation. Deduct from product price during seller profit updates.
2.  **Audit & Safety Guard**:
    *   To prevent state race conditions, check if a transaction reference has already been processed in `order_status_history` or related tables before crediting wallets or fulfilling orders.

---

## 🛡️ 4. EXIGENT RUNTIME & ENVIRONMENT RULES

*   **API Key Safeguards**:
    *   Never expose `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`, or `ADMIN_SECRET` to the client. Keep them server-side.
    *   Client-side variables must be prefixed with `VITE_` (e.g. `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
*   **Vercel Configuration**:
    *   `vercel.json` provides translation fallback to `index.html` for client-side React routes and routes API paths to the serverless function handler recursively.

---

## 🛠️ 5. CONTROLS & COMMANDS

*   `npm run dev` launches the active TS dev server using `tsx`.
*   `npm run build` compiles Vite assets to `/dist` and compiles server entrypoints.
*   `npm run start` launches the fast-loading production app.
