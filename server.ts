import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import yahooFinance from "yahoo-finance2";

const yf = new (yahooFinance as any)();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to fetch stock data with date range
  app.get("/api/stock/:symbol", async (req, res) => {
    const symbol = req.params.symbol?.trim().toUpperCase();
    const { start, end } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: "请输入有效的股票代码。" });
    }

    try {
      const endDate = end ? new Date(end as string) : new Date();
      const startDate = start ? new Date(start as string) : new Date();
      
      if (!start) {
        startDate.setFullYear(endDate.getFullYear() - 2);
      }

      const queryOptions = {
        period1: startDate,
        period2: endDate,
        interval: "1d" as const,
      };

      const result = await yf.chart(symbol, queryOptions);
      
      if (!result || !result.quotes || result.quotes.length === 0) {
        return res.status(404).json({ error: `未找到股票代码 "${symbol}" 的数据。` });
      }

      const formattedData = result.quotes
        .filter((item: any) => item.close !== null && item.close !== undefined && item.date !== undefined)
        .map((item: any) => ({
          date: item.date instanceof Date ? item.date.toISOString().split("T")[0] : new Date(item.date).toISOString().split("T")[0],
          price: Number(item.close.toFixed(3)),
        }));

      res.json(formattedData);
    } catch (error: any) {
      console.error(`Yahoo Finance Error for ${symbol}:`, error);
      res.status(500).json({ error: "获取股价数据失败。" });
    }
  });

  // API Route to fetch stock news
  app.get("/api/news/:symbol", async (req, res) => {
    const symbol = req.params.symbol?.trim().toUpperCase();
    if (!symbol) return res.status(400).json({ error: "缺少股票代码" });

    try {
      const result = await yf.search(symbol, { newsCount: 5 });
      res.json(result.news || []);
    } catch (error) {
      console.error(`News Error for ${symbol}:`, error);
      res.status(500).json({ error: "获取新闻失败。" });
    }
  });

  // API Route to fetch multiple stock quotes for watchlist
  app.get("/api/quotes", async (req, res) => {
    const symbols = (req.query.symbols as string || "").split(",").filter(Boolean);
    if (symbols.length === 0) return res.json([]);

    try {
      const results = await yf.quote(symbols);
      const formatted = Array.isArray(results) ? results : [results];
      res.json(formatted.map((q: any) => ({
        symbol: q.symbol,
        price: Number(q.regularMarketPrice?.toFixed(3)),
        change: Number(q.regularMarketChangePercent?.toFixed(3)),
        name: q.shortName || q.longName
      })));
    } catch (error) {
      console.error("Quotes Error:", error);
      res.status(500).json({ error: "获取行情失败。" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
