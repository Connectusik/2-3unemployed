import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { parse } from "csv-parse";
import jwt from "jsonwebtoken";
import db from "./src/db.ts";
import { calculateNYTax, isWithinNY } from "./src/taxService.ts";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = "betterme-jwt-secret-key";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.get("/healthz", (req, res) => res.status(200).send("OK"));
  app.get("/api/healthz", (req, res) => res.status(200).json({ status: "ok" }));
  app.get("/test-alive", (req, res) => res.status(200).send("Server is alive and responding"));

  const upload = multer({ dest: "uploads/" });

  const distPath = path.resolve(__dirname, "dist");
  const indexPath = path.resolve(distPath, "index.html");

  console.log(`Server starting...`);
  console.log(`__dirname: ${__dirname}`);
  console.log(`distPath: ${distPath}`);
  console.log(`indexPath: ${indexPath}`);
  console.log(`indexPath exists: ${fs.existsSync(indexPath)}`);

  app.use(express.json());

  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  const isAuthenticated = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      (req as any).user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid or expired token" });
    }
  };

  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password) as any;
    
    if (user) {
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "24h" });
      res.json({ 
        message: "Logged in successfully", 
        token,
        user: { id: user.id, username: user.username } 
      });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.get("/api/auth/me", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      res.json({ user: decoded });
    } catch (err) {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

  app.post("/api/orders/import", isAuthenticated, upload.single("file"), async (req, res) => {
    console.log("Import request received");
    if (!req.file) {
      console.log("No file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("Processing file:", req.file.path);
    const results: any[] = [];
    let skippedCount = 0;
    
    try {
      const parser = fs.createReadStream(req.file.path).pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
        })
      );

      for await (const record of parser) {
        const lat = parseFloat(record.latitude);
        const lon = parseFloat(record.longitude);
        const subtotal = parseFloat(record.subtotal);
        const timestamp = record.timestamp || new Date().toISOString();

        if (isNaN(lat) || isNaN(lon) || isNaN(subtotal)) {
          db.prepare("INSERT INTO failed_requests (latitude, longitude, subtotal, reason, source) VALUES (?, ?, ?, ?, ?)").run(
            isNaN(lat) ? null : lat, 
            isNaN(lon) ? null : lon, 
            isNaN(subtotal) ? null : subtotal, 
            "Invalid numeric data", 
            "csv"
          );
          skippedCount++;
          continue;
        }

        if (!isWithinNY(lat, lon)) {
          const reason = `Outside NY State boundaries (Lat: ${lat}, Lon: ${lon})`;
          if (lon > 0 && isWithinNY(lat, -lon)) {
            const correctedLon = -lon;
            const taxData = calculateNYTax(lat, correctedLon, subtotal);
            const specialRateTotal = taxData.breakdown.special_rates.reduce((sum, item) => sum + item.rate, 0);
            const stmt = db.prepare(`
              INSERT INTO orders (
                latitude, longitude, subtotal, composite_tax_rate, tax_amount, 
                total_amount, state_rate, county_rate, city_rate, special_rate, special_rates, special_rate_total,
                jurisdictions, timestamp
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            stmt.run(
              lat, correctedLon, subtotal, taxData.composite_tax_rate, taxData.tax_amount,
              taxData.total_amount, taxData.breakdown.state_rate, taxData.breakdown.county_rate,
              taxData.breakdown.city_rate, specialRateTotal, JSON.stringify(taxData.breakdown.special_rates), specialRateTotal,
              JSON.stringify(taxData.jurisdictions), timestamp
            );
            results.push({ ...record, longitude: correctedLon, ...taxData });
            continue;
          }
          
          db.prepare("INSERT INTO failed_requests (latitude, longitude, subtotal, reason, source) VALUES (?, ?, ?, ?, ?)").run(
            lat, lon, subtotal, reason, "csv"
          );
          skippedCount++;
          continue;
        }

        const taxData = calculateNYTax(lat, lon, subtotal);
        const specialRateTotal = taxData.breakdown.special_rates.reduce((sum, item) => sum + item.rate, 0);
        const stmt = db.prepare(`
          INSERT INTO orders (
            latitude, longitude, subtotal, composite_tax_rate, tax_amount, 
            total_amount, state_rate, county_rate, city_rate, special_rate, special_rates, special_rate_total,
            jurisdictions, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
          lat, lon, subtotal, taxData.composite_tax_rate, taxData.tax_amount,
          taxData.total_amount, taxData.breakdown.state_rate, taxData.breakdown.county_rate,
          taxData.breakdown.city_rate, specialRateTotal, JSON.stringify(taxData.breakdown.special_rates), specialRateTotal,
          JSON.stringify(taxData.jurisdictions), timestamp
        );
        results.push({ ...record, ...taxData });
      }

      fs.unlinkSync(req.file.path);
      res.json({ 
        message: `Imported ${results.length} orders successfully. ${skippedCount} orders skipped (invalid or outside NY).`, 
        count: results.length,
        skipped: skippedCount
      });
    } catch (error) {
      console.error("Import error:", error);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: "Failed to process CSV: " + (error as Error).message });
    }
  });

  app.post("/api/orders", isAuthenticated, (req, res) => {
    const { latitude, longitude, subtotal, timestamp } = req.body;
    
    if (latitude === undefined || longitude === undefined || subtotal === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!isWithinNY(latitude, longitude)) {
      let errorMsg = "Coordinates must be within New York State boundaries.";
      if (longitude > 0 && isWithinNY(latitude, -longitude)) {
        errorMsg += " Did you mean longitude " + (-longitude) + "? (Longitude in NY should be negative)";
      }
      
      db.prepare("INSERT INTO failed_requests (latitude, longitude, subtotal, reason, source) VALUES (?, ?, ?, ?, ?)").run(
        latitude, longitude, subtotal, errorMsg, "manual"
      );
      
      return res.status(400).json({ error: errorMsg });
    }

    const taxData = calculateNYTax(latitude, longitude, subtotal);
    const specialRateTotal = taxData.breakdown.special_rates.reduce((sum, item) => sum + item.rate, 0);
    
    const stmt = db.prepare(`
      INSERT INTO orders (
        latitude, longitude, subtotal, composite_tax_rate, tax_amount, 
        total_amount, state_rate, county_rate, city_rate, special_rate, special_rates, special_rate_total,
        jurisdictions, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      latitude, longitude, subtotal, taxData.composite_tax_rate, taxData.tax_amount,
      taxData.total_amount, taxData.breakdown.state_rate, taxData.breakdown.county_rate,
      taxData.breakdown.city_rate, specialRateTotal, JSON.stringify(taxData.breakdown.special_rates), specialRateTotal,
      JSON.stringify(taxData.jurisdictions), timestamp || new Date().toISOString()
    );

    res.json({ id: info.lastInsertRowid, ...taxData });
  });

  app.get("/api/orders", isAuthenticated, (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    
    const orders = db.prepare(`
      SELECT * FROM orders 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const stats = db.prepare("SELECT COUNT(*) as count, SUM(subtotal) as total_revenue, SUM(tax_amount) as total_tax FROM orders").get() as any;

    res.json({
      data: orders.map((o: any) => ({
        ...o,
        jurisdictions: JSON.parse(o.jurisdictions),
        special_rate_total: o.special_rate_total ?? o.special_rate ?? 0,
        breakdown: {
          state_rate: o.state_rate,
          county_rate: o.county_rate,
          city_rate: o.city_rate,
          special_rate: o.special_rate_total ?? o.special_rate ?? 0,
          special_rates: (() => {
            if (o.special_rates) {
              try {
                return JSON.parse(o.special_rates);
              } catch {
              }
            }
            const legacyRate = o.special_rate_total ?? o.special_rate ?? 0;
            return legacyRate > 0 ? [{ name: "MCTD", rate: legacyRate }] : [];
          })()
        }
      })),
      stats: {
        total_revenue: stats.total_revenue || 0,
        total_tax: stats.total_tax || 0,
        count: stats.count
      },
      pagination: {
        page,
        limit,
        total: stats.count,
        pages: Math.ceil(stats.count / limit)
      }
    });
  });

  app.get("/api/failed-requests", isAuthenticated, (req, res) => {
    const failed = db.prepare("SELECT * FROM failed_requests ORDER BY timestamp DESC LIMIT 50").all();
    res.json(failed);
  });

  app.delete("/api/history", isAuthenticated, (req, res) => {
    try {
      db.prepare("DELETE FROM orders").run();
      db.prepare("DELETE FROM failed_requests").run();
      res.json({ message: "History cleared successfully" });
    } catch (error) {
      console.error("Clear history error:", error);
      res.status(500).json({ error: "Failed to clear history" });
    }
  });

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(err.status || 500).json({
      error: err.message || "Internal Server Error"
    });
  });

  if (process.env.NODE_ENV !== "production" && !fs.existsSync(distPath)) {
    console.log("Starting server in DEVELOPMENT mode (using Vite)");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode (serving dist)");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Frontend build not found. Please run npm run build.");
      }
    });
  }

  const finalPort = parseInt(process.env.PORT || "3000", 10);
  app.listen(finalPort, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${finalPort}`);
  });
}

startServer();
