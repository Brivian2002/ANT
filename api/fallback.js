// Create this file at: api-fallback.js
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Return a valid JSON response to prevent parsing errors
  res.status(200).json({ 
    status: 'ok', 
    message: 'Vercel frontend is running',
    note: 'Backend API needs to be deployed separately for full functionality',
    timestamp: new Date().toISOString()
  });
}
