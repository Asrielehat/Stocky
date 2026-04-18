import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import yahooFinance from "yahoo-finance2";
import Parser from "rss-parser";
import iconv from "iconv-lite";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { ProxyAgent, setGlobalDispatcher } from "undici";

dotenv.config();

// Fix for Node.js fetch not respecting HTTPS_PROXY in local dev
if (process.env.HTTPS_PROXY) {
  try {
    const proxyUrl = process.env.HTTPS_PROXY;
    console.log(`[Proxy] Detected HTTPS_PROXY, setting global dispatcher: ${proxyUrl}`);
    const dispatcher = new ProxyAgent(proxyUrl);
    setGlobalDispatcher(dispatcher);
  } catch (err) {
    console.error("[Proxy] Failed to set global proxy dispatcher:", err);
  }
}

const yf = new (yahooFinance as any)();
const rssParser = new Parser();

// Lazy Gemini initialization to prevent startup crashes
let _model: any = null;
function getGenModel() {
  if (!_model) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in environment variables.");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    _model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }
  return _model;
}

// Helper to convert Yahoo symbol to Sina symbol (e.g., 600519.SS -> sh600519)
const toSinaSymbol = (symbol: string) => {
  const clean = symbol.toUpperCase();
  if (clean.endsWith(".SS")) return `sh${clean.replace(".SS", "")}`;
  if (clean.endsWith(".SZ")) return `sz${clean.replace(".SZ", "")}`;
  if (/^\d{6}$/.test(clean)) {
    return (clean.startsWith("6") || clean.startsWith("5")) ? `sh${clean}` : `sz${clean}`;
  }
  return clean;
};

// Fetch A-share historical data from Sina
async function fetchSinaHistorical(symbol: string) {
  const sinaSym = toSinaSymbol(symbol);
  // scale=240 means daily data
  const url = `http://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${sinaSym}&scale=240&ma=no&datalen=500`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error("Sina API response error");
  
  const data = await response.json();
  if (!Array.isArray(data)) return null;

  return data.map((item: any) => ({
    date: item.day.split(" ")[0],
    price: parseFloat(item.close)
  }));
}

// Fetch A-share name and realtime quote from Sina
async function fetchSinaQuote(symbol: string) {
  const sinaSym = toSinaSymbol(symbol);
  const url = `http://hq.sinajs.cn/list=${sinaSym}`;
  
  const response = await fetch(url, {
    headers: { "Referer": "http://finance.sina.com.cn" }
  });
  
  const arrayBuffer = await response.arrayBuffer();
  const text = iconv.decode(Buffer.from(arrayBuffer), "gbk");
  
  const match = text.match(/\"(.*)\"/);
  if (!match || !match[1]) return null;
  
  const parts = match[1].split(",");
  return {
    name: parts[0], // Chinese Name
    price: parseFloat(parts[3]),
    change: ((parseFloat(parts[3]) - parseFloat(parts[2])) / parseFloat(parts[2])) * 100
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper to check if it's an A-share symbol
  const isAShare = (symbol: string) => /\.SS$|\.SZ$/.test(symbol) || /^\d{6}$/.test(symbol);

  // Helper to get a better name (especially Chinese names for A-shares)
  const getBetterName = async (symbol: string, defaultName: string) => {
    if (!isAShare(symbol)) return defaultName;
    try {
      const searchResult = await yf.search(symbol);
      const bestMatch = searchResult.quotes.find((q: any) => q.symbol === symbol);
      return bestMatch?.shortname || bestMatch?.longname || defaultName;
    } catch (e) {
      return defaultName;
    }
  };

  // API Route to fetch stock data with date range
  app.get("/api/stock/:symbol", async (req, res) => {
    let symbol = req.params.symbol?.trim().toUpperCase();
    const { start, end } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: "请输入有效的股票代码。" });
    }

    // Handle A-share numeric codes
    if (/^\d{6}$/.test(symbol)) {
      if (symbol.startsWith("6") || symbol.startsWith("5") || symbol.startsWith("8") || symbol.startsWith("9")) {
        symbol = `${symbol}.SS`; // Shanghai
      } else if (symbol.startsWith("0") || symbol.startsWith("3")) {
        symbol = `${symbol}.SZ`; // Shenzhen
      }
    }

    try {
      const endDate = end ? new Date(end as string) : new Date();
      const startDate = start ? new Date(start as string) : new Date();
      
      if (!start) {
        startDate.setFullYear(endDate.getFullYear() - 2);
      }

      // If A-Share, use Sina as primary source for stability in China
      if (isAShare(symbol)) {
        try {
          const [sinaData, sinaQuote] = await Promise.all([
            fetchSinaHistorical(symbol),
            fetchSinaQuote(symbol)
          ]);
          
          if (sinaData && sinaData.length > 0) {
            // Filter Sina data by date range
            const filteredSinaData = sinaData.filter((item: any) => {
              const itemDate = new Date(item.date);
              return itemDate >= startDate && itemDate <= endDate;
            });

            return res.json({
              symbol: symbol,
              name: sinaQuote?.name || symbol,
              data: filteredSinaData
            });
          }
        } catch (sinaErr) {
          console.warn("Sina Engine failed, falling back to Yahoo:", sinaErr);
        }
      }

      const queryOptions = {
        period1: startDate,
        period2: endDate,
        interval: "1d" as const,
      };

      // Fetch both chart data and quote for the name
      const [chartResult, quoteResult] = await Promise.all([
        yf.chart(symbol, queryOptions),
        yf.quote(symbol).catch(() => null)
      ]);
      
      if (!chartResult || !chartResult.quotes || chartResult.quotes.length === 0) {
        return res.status(404).json({ error: `未找到股票代码 "${symbol}" 的数据。` });
      }

      const formattedData = chartResult.quotes
        .filter((item: any) => item.close !== null && item.close !== undefined && item.date !== undefined)
        .map((item: any) => ({
          date: item.date instanceof Date ? item.date.toISOString().split("T")[0] : new Date(item.date).toISOString().split("T")[0],
          price: Number(item.close.toFixed(3)),
        }))
        // Ensure accurate filtering even for Yahoo results
        .filter((item: any) => {
          const itemDate = new Date(item.date);
          return itemDate >= startDate && itemDate <= endDate;
        });

      // For A-shares, try to get the Chinese name if possible
      let finalName = quoteResult?.shortName || quoteResult?.longName || symbol;
      if (isAShare(symbol)) {
        finalName = await getBetterName(symbol, finalName);
      }

      res.json({
        symbol: symbol,
        name: finalName,
        data: formattedData
      });
    } catch (error: any) {
      console.error(`Yahoo Finance Error for ${symbol}:`, error);
      res.status(500).json({ error: "获取股价数据失败。" });
    }
  });

  // API Route to fetch stock news
  app.get("/api/news/:symbol", async (req, res) => {
    let symbol = req.params.symbol?.trim().toUpperCase();
    if (!symbol) return res.status(400).json({ error: "缺少股票代码" });

    // Handle A-share numeric codes
    if (/^\d{6}$/.test(symbol)) {
      if (symbol.startsWith("6") || symbol.startsWith("5") || symbol.startsWith("8") || symbol.startsWith("9")) {
        symbol = `${symbol}.SS`;
      } else if (symbol.startsWith("0") || symbol.startsWith("3")) {
        symbol = `${symbol}.SZ`;
      }
    }

    try {
      if (isAShare(symbol)) {
        // Fetch Chinese news from Google News RSS for A-shares
        const name = await getBetterName(symbol, symbol);
        const searchQuery = encodeURIComponent(`${name} 股票`);
        const rssUrl = `https://news.google.com/rss/search?q=${searchQuery}+when:30d&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
        
        const feed = await rssParser.parseURL(rssUrl);
        const chineseNews = feed.items.slice(0, 5).map(item => ({
          title: item.title,
          link: item.link,
          publisher: item.creator || item.source?.["_"] || "相关新闻",
          providerPublishTime: new Date(item.pubDate || Date.now()).getTime() / 1000
        }));
        
        return res.json(chineseNews);
      }

      // Default to Yahoo news for US stocks
      const result = await yf.search(symbol, { newsCount: 5 });
      res.json(result.news || []);
    } catch (error) {
      console.error(`News Error for ${symbol}:`, error);
      res.status(500).json({ error: "获取新闻失败。" });
    }
  });

  // API Route to fetch multiple stock quotes for watchlist
  app.get("/api/quotes", async (req, res) => {
    const symbols = (req.query.symbols as string || "").split(",").filter(Boolean).map(s => {
      let sym = s.trim().toUpperCase();
      // Handle A-share numeric codes
      if (/^\d{6}$/.test(sym)) {
        if (sym.startsWith("6") || sym.startsWith("5") || sym.startsWith("8") || sym.startsWith("9")) {
          return `${sym}.SS`;
        } else if (sym.startsWith("0") || sym.startsWith("3")) {
          return `${sym}.SZ`;
        }
      }
      return sym;
    });

    if (symbols.length === 0) return res.json([]);

    try {
      // Split symbols into A-shares and Others
      const aShareSymbols = symbols.filter(s => isAShare(s));
      const otherSymbols = symbols.filter(s => !isAShare(s));

      let aShareResults: any[] = [];
      if (aShareSymbols.length > 0) {
        aShareResults = await Promise.all(aShareSymbols.map(async (s) => {
          try {
            const q = await fetchSinaQuote(s);
            return q ? {
              symbol: s,
              price: Number(q.price.toFixed(3)),
              change: Number(q.change.toFixed(3)),
              name: q.name
            } : null;
          } catch (e) { return null; }
        }));
      }

      let otherResults: any[] = [];
      if (otherSymbols.length > 0) {
        const results = await yf.quote(otherSymbols);
        const formatted = Array.isArray(results) ? results : [results];
        otherResults = await Promise.all(formatted.map(async (q: any) => {
          let name = q.shortName || q.longName || q.symbol;
          return {
            symbol: q.symbol,
            price: Number(q.regularMarketPrice?.toFixed(3)),
            change: Number(q.regularMarketChangePercent?.toFixed(3)),
            name: name
          };
        }));
      }

      res.json([...aShareResults, ...otherResults].filter(Boolean));
    } catch (error) {
      console.error("Quotes Error:", error);
      res.status(500).json({ error: "获取行情失败。" });
    }
  });

  // API Route for AI Prediction
  app.post("/api/predict", async (req, res) => {
    const { historicalData, news, stockName } = req.body;
    
    if (!historicalData || !Array.isArray(historicalData)) {
      return res.status(400).json({ error: "缺少历史数据" });
    }

    try {
      // Logic from gemini.ts migrated to server
      const dataForSplit = historicalData.slice(-60);
      const splitIndex = Math.floor(dataForSplit.length * 0.7);
      const trainingData = dataForSplit.slice(0, splitIndex);
      const testData = dataForSplit.slice(splitIndex);
      
      const newsContext = (news || []).map((n: any) => n.title).join("\n");
      const identifier = stockName ? `${stockName} (${historicalData[0]?.date}至今)` : "该股票";
      
      const prompt = `
        你是一位资深的金融量化分析师。我们将针对 ${identifier} 执行一个“回测+预测”的复合流程。
        
        第一步：回测验证 (Backtesting Context)
        这是前 70% 的训练数据：
        ${JSON.stringify(trainingData)}
        
        这是另外 30% 的真实测试数据（仅供你分析误差用）：
        ${JSON.stringify(testData)}
        
        近期新闻背景：
        ${newsContext || "暂无相关新闻"}
        
        你的任务：
        1. 模拟回测：请模拟分析如果仅凭前 70% 的数据，你会如何预测那段时期的走势？请提供那 30% 期间的模拟点。
        2. 误差分析：将你的模拟观点与真实的 30% 数据对比，分析为什么会产生误差（是受到新闻影响、市场波动还是模式转变？）。
        3. 未来预测：结合所有历史数据和分析心得，预测未来 10 天的价格走势。
        
        请按以下 JSON 格式返回：
        {
          "validationPoints": [{"date": "...", "price": ...}], 
          "predictions": [{"date": "...", "price": ...}], 
          "analysis": "核心分析内容，需包含对误差的复盘和对未来的展望。请确保提到股票的具体名称（如果有）。",
          "accuracyScore": 85 
        }
        
        请务必使用中文进行分析，且输出必须是合法的 JSON。
      `;

      const aiModel = getGenModel();
      const result = await aiModel.generateContent(prompt);
      const response = await result.response;
      const jsonText = response.text().replace(/```json|```/g, "").trim();
      const aiResult = JSON.parse(jsonText);

      // MAE calculation logic
      let mae = 0;
      if (aiResult.validationPoints.length > 0 && testData.length > 0) {
        const minLen = Math.min(aiResult.validationPoints.length, testData.length);
        let sumAbsError = 0;
        for (let i = 0; i < minLen; i++) {
          sumAbsError += Math.abs(aiResult.validationPoints[i].price - testData[i].price);
        }
        mae = sumAbsError / minLen;
      }

      res.json({
        predictions: aiResult.predictions.map((p: any) => ({ ...p, isPrediction: true })),
        validationData: aiResult.validationPoints.map((p: any) => ({ ...p, isPrediction: true })),
        analysis: aiResult.analysis,
        validationAccuracy: {
          mae: mae,
          rmse: Math.sqrt(mae * mae),
          score: aiResult.accuracyScore || 80
        }
      });
    } catch (error: any) {
      console.error("Gemini API Error Detail:", error);
      let errorMsg = error.message;
      if (errorMsg.includes("fetch failed") || errorMsg.includes("UND_ERR_CONNECT_TIMEOUT")) {
        errorMsg = "网络连接失败。提示：请检查本地是否开启科学上网代理，并在启动终端执行 set HTTPS_PROXY=http://127.0.0.1:您的代理端口";
      }
      res.status(500).json({ error: `AI 预测服务异常: ${errorMsg}` });
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
