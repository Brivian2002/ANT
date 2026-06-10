// api/index.js
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname; // e.g. /api/config, /api/products

  // ---------- Mock data ----------
  const mockCategories = [
    { id: "1", name: "Electronics", slug: "electronics", imageUrl: "https://picsum.photos/400/300?random=1", description: "Gadgets & gear" },
    { id: "2", name: "Home", slug: "home", imageUrl: "https://picsum.photos/400/300?random=2", description: "Minimalist decor" },
  ];

  const mockProducts = [
    { id: "p1", name: "Wireless Headphones", price: 99, salePrice: null, stock: 10, primaryImage: "https://picsum.photos/400/300?random=101", sellerName: "AudioLab", rating: 4.5 },
    { id: "p2", name: "Mechanical Keyboard", price: 149, salePrice: 129, stock: 5, primaryImage: "https://picsum.photos/400/300?random=102", sellerName: "KeyCraft", rating: 4.8 },
  ];

  // Route handling – return JSON always
  if (path === '/api/config') {
    return res.status(200).json({
      settings: {
        platformName: "DemoHub",
        heroHeadline: "Demo Store on Vercel",
        heroSubheadline: "Frontend only – backend not deployed",
        promoText: "🚀 Mock data – full version requires separate backend"
      }
    });
  }

  if (path === '/api/categories') {
    return res.status(200).json(mockCategories);
  }

  if (path === '/api/products') {
    const search = url.searchParams.get('q') || '';
    let filtered = mockProducts;
    if (search) filtered = filtered.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    return res.status(200).json(filtered);
  }

  if (path === '/api/auth/me' && req.method === 'GET') {
    // Return dummy user if token present (or just unauth)
    const auth = req.headers.authorization;
    if (auth) {
      return res.status(200).json({ id: "demo", name: "Demo User", email: "demo@example.com", role: "customer" });
    } else {
      return res.status(401).json({ error: "Not authenticated" });
    }
  }

  if (path === '/api/auth/login' && req.method === 'POST') {
    return res.status(200).json({
      token: "demo-token-123",
      user: { id: "1", name: "Demo User", email: "demo@example.com", role: "customer" }
    });
  }

  if (path === '/api/auth/register' && req.method === 'POST') {
    return res.status(200).json({
      token: "demo-token-123",
      user: { id: "2", name: "New User", email: "new@example.com", role: "customer" }
    });
  }

  if (path === '/api/cart' && req.method === 'GET') {
    return res.status(200).json({ items: [], subtotal: 0, total: 0 });
  }

  if (path === '/api/wishlist' && req.method === 'GET') {
    return res.status(200).json([]);
  }

  if (path === '/api/orders' && req.method === 'GET') {
    return res.status(200).json([]);
  }

  // Fallback for any other /api/* route
  return res.status(200).json({ message: `Mock API: ${path}`, note: "Backend not deployed" });
}
