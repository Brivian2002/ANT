# DataGhmart - Smart E-Commerce Platform with Paystack Mobile Money

DataGhmart is a high-performance, responsive, full-stack digital e-commerce web application designed for interactive storefronts, secure client wallets, peer-to-peer commerce, and multi-user interaction.

---

## ✨ Features Offered

-   **Interactive Storefront**: Explore multiple categories of merchandise with live product details, reviews, image galleries, and seller bios.
-   **Secure Customer Wallet Balance**: Top up, verify, and deduct balances instantly.
-   **Integrated Paystack gateway**:
    -   Live initializing of secure checkout URLs.
    -   Secure webhook listener verifies payments asynchronously.
    -   Client callback redirect handler verify token references upon receipt.
-   **P2P Seller Portal**: Register a digital store, list products, upload images, manage fulfillments, update statuses, promote listings, and request secure revenue withdrawals.
-   **Comprehensive Administration Panel**: View real-time system audit logs, handle user accounts, oversee global system settings, publish site announcements, and process withdrawals.

---

## 🛠️ Technology Stack

-   **Frontend**: React (v19) + Vite + Tailwind CSS (v4) + Lucide Icons + custom animations.
-   **Backend**: Express.js server hosted inside standard container runtimes.
-   **Database Engine**: Stateful file-based resource dbManager in `/src/db/db.ts`.

---

## 🚀 Deployment Guide (Vercel Build Error Fix)

If your deployment fails on Vercel with an error like:
`Error: No Next.js version detected. Make sure your package.json has "next" in dependencies...`

Vercel's automated framework detection engine is misidentifying this hybrid Vite-Express app as a Next.js framework project. To resolve this instantly, configure the build settings manually in the Vercel Dashboard:

### 🔧 Fix Instructions

1.  **Open Project Settings**: Log in to your Vercel Account, click on this project, and go to the **Settings** tab.
2.  **Adjust Framework Preset**:
    -   Locate **Build & Development Settings**.
    -   Click the **Framework Preset** dropdown.
    -   Change it from **"Next.js"** to **"Other"** (or **"Vite"**).
3.  **Ensure Correct Commands**:
    -   **Build Command**: Ensure "Override" is enabled and set to `npm run build` or `vite build`.
    -   **Output Directory**: Ensure "Override" is enabled and set to `dist`.
4.  **Redeploy**: Navigate to the **Deployments** tab, select the latest failed run, click the meatball menu (three dots), and select **Redeploy**. It will now build with 100% success!

---

## ⚙️ Environment Variables Setup

Define the following environment variables in your deployment environment or your local `.env` file:

```env
# Server Administration
ADMIN_SECRET="your-admin-secret-here"

# Paystack API Credentials (Use live or test keys)
PAYSTACK_SECRET_KEY="sk_live_..."
PAYSTACK_PUBLIC_KEY="pk_live_..."

# Paystack Callback Redirection URL
PAYSTACK_CALLBACK_URL="https://your-domain.com/payment/callback"
```

---

## 👨‍💻 Local Development

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Launch the development server:
    ```bash
    npm run dev
    ```
4.  To compile the production build:
    ```bash
    npm run build
    ```
5.  To boot the production server:
    ```bash
    npm run start
    ```
