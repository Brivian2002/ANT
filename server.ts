import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// Import your database and other route handlers here

dotenv.config();
const app = express();

// --- CORS Configuration ---
// Allow requests only from your specific frontend origins
const allowedOrigins = [
    process.env.FRONTEND_URL,    // Your production URL on Vercel
    'http://localhost:5173'       // Your local development URL
].filter((origin): origin is string => !!origin);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Your API Routes ---
// app.use('/api/auth', authRoutes);
// app.use('/api/products', productRoutes);
// ... rest of your routes

// --- Start Server ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Backend server is running on port ${PORT}`);
});
