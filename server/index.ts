import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { registerMarketingRoutes } from "../Marketing/server/routes/marketing";
import { registerAdminRoutes } from "../Marketing/server/routes/admin";
import { registerStakeholderRoutes } from "../Marketing/server/routes/stakeholders";
import { registerCaseRoutes } from "../Marketing/server/routes/cases";
import { registerIntegrationRoutes } from "../Marketing/server/routes/integrations";
import { registerCommunicationRoutes } from "../Marketing/server/routes/communications";
import { registerSimulationRoutes } from "../Marketing/server/routes/simulation";
import { registerProfileRoutes } from "../Marketing/server/routes/profile";
import { registerSatisfactionRoutes } from "../Marketing/server/routes/satisfaction-routes";
import metaOauthRouter from "../Marketing/server/routes/meta-oauth";
import webhooksRouter from "../Marketing/server/routes/webhooks";
import { registerInboxRoutes } from "../Marketing/server/routes/inbox";
import { registerSocialRoutes } from "../Marketing/server/routes/social";
import { aiRouter } from "../Marketing/server/routes/ai";
import { marketingAuth } from "../Marketing/server/middleware/marketingAuth";
// import { registerAccreditationRoutes } from "../Marketing/server/routes/accreditation";
import { registerWhatsappWebhookRoutes } from "../Marketing/server/routes/whatsapp-webhook";
import { registerWorkforceRoutes } from "../Marketing/server/routes/workforce";

const app = express();

app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://kasneb-crm.onrender.com", "ws:", "wss:"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(compression());

// Important: webhooks router uses express.raw() for signature verification, so it must be mounted BEFORE express.json()
app.use(webhooksRouter);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? ["https://kasneb-crm.onrender.com", "https://cic-crm.onrender.com"]
    : ["http://localhost:5001", "http://localhost:5173", "http://127.0.0.01:5001", "ws://localhost:24678"],
  credentials: true,
}));
app.use(cookieParser());

// Static route for case attachments
app.use("/attached_assets", express.static(path.resolve(import.meta.dirname, "../attached_assets")));

// Ensure uploads directory exists and serve it
const uploadsDir = path.resolve(import.meta.dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests, please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later." },
});

app.use("/api/marketing/auth/login", authLimiter);
app.use("/api/marketing/auth/forgot-password", authLimiter);
app.use("/api/marketing/auth/reset-password", authLimiter);
app.use("/api/marketing/auth/register", authLimiter);
app.use("/api/", apiLimiter);

registerMarketingRoutes(app);
registerAdminRoutes(app);
registerStakeholderRoutes(app);
registerCaseRoutes(app);
registerIntegrationRoutes(app);
registerCommunicationRoutes(app);
registerSimulationRoutes(app);
registerProfileRoutes(app);
registerSatisfactionRoutes(app);
registerInboxRoutes(app);
registerSocialRoutes(app);
registerWhatsappWebhookRoutes(app);
registerWorkforceRoutes(app);
app.use("/api/ai", aiLimiter, marketingAuth, aiRouter);

app.use(metaOauthRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

const isProd = process.env.NODE_ENV === "production";

async function startServer() {
  if (isProd) {
    const staticPath = path.resolve(import.meta.dirname, "../dist/public");
    app.use(express.static(staticPath, {
      maxAge: "1d",
      etag: true,
    }));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(staticPath, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  const PORT = 5001;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Global error handler to ensure JSON responses for API errors
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("SERVER ERROR:", err);
  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message: err.message || "An unexpected error occurred",
    details: process.env.NODE_ENV === "development" ? err : undefined
  });
});

startServer();
