# Gemini Development & Integration Manual (GEMINI.md)

This guidebook details specific instructions, patterns, and conventions tailored for the Gemini model to safely enhance, build, and support the DataGhmart application.

---

## 🎨 1. CORE VISUAL DESIGN & THEME

When developing UI elements or widgets, adhere to the following:
*   **Theme**: Clean, high-contrast, modern layout.
*   **Dominant Palette**: Sophisticated grays, deep blacks, slate backgrounds, paired with fine modern borders (`border-neutral-150` or similar), soft pill-shaped shadows, and vivid functional status highlights (e.g., green for deposits, emerald for authorizations, neutral amber for pending withdraws).
*   **Typography**: Clean sans-serif headers (`Inter` or similar) paired with `JetBrains Mono` for alphanumeric transaction references, IDs, monetary statistics, and system logs.
*   **Animations**: Introduce smooth, subtle micro-animations (e.g., hover scaling, subtle gradient pulses during gateway loading, slide-over transition drawers).

---

## 🔒 2. SECURE PAYMENT ENGINE GUIDELINES

When writing code that interacts with the wallet, orders, or payment flows, the following guidelines are mandatory:

```typescript
// ✅ RECOMMENDED: Always check previous references via Supabase to prevent duplicate processing
const { data: alreadyProcessed } = await supabase
  .from("order_status_history")
  .select("id")
  .eq("order_id", orderId)
  .eq("status", "payment_received");

if (!alreadyProcessed || alreadyProcessed.length === 0) {
  // Fulfill order, update balances, and log status history securely
  await supabase.from("orders").update({ status: "payment_received" }).eq("id", orderId);
}
```

---

## 🔌 3. PERSISTENT INTEGRATION PATTERNS

Every Supabase call in backend API paths must follow this schema:
1.  Verify authenticated parameters using Google Auth context.
2.  Wrap database queries inside clean exception blocks `try { ... } catch (err) { ... }`.
3.  Respond with explicit JSON status data.
4.  Prevent state race conditions by updating state after credit allocations.

---

## 💡 4. DETAILED VERCEL RESOLUTION MANUAL

If configuring Vercel builds or if a build produces a "No Next.js version detected" error:
*   **Reason**: Vercel auto-detected the project framework incorrectly as Next.js.
*   **Fix**:
    1.  Navigate to the **Vercel Dashboard** and select your project.
    2.  Go to **Project Settings** > **Build & Development Settings**.
    3.  In the **Framework Preset** dropdown, override "Next.js" and change it to **"Other"** (or **"Vite"** if available).
    4.  Verify the **Build Command** is set to: `npm run build` or `vite build`.
    5.  Verify the **Output Directory** is set to: `dist`.
    6.  Re-run the deployment.
