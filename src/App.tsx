/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from "react";
import Papa from "papaparse";
import { Upload, TrendingUp, AlertCircle, Loader2, FileText, BarChart3, Search, Calendar, Newspaper, ExternalLink, Star, Trash2, RefreshCw, ChevronLeft } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { StockChart } from "./components/StockChart";
import { Watchlist } from "./components/Watchlist";
import { predictStockPrice } from "./lib/gemini";
import { StockData, PredictionResult } from "./types";

export default function App() {
  const [historicalData, setHistoricalData] = useState<StockData[]>([]);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [news, setNews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [symbol, setSymbol] = useState("");
  
  // Watchlist states
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    const saved = localStorage.getItem("watchlist");
    return saved ? JSON.parse(saved) : ["AAPL", "TSLA", "NVDA"];
  });
  const [watchlistData, setWatchlistData] = useState<any[]>([]);
  const [isRefreshingWatchlist, setIsRefreshingWatchlist] = useState(false);

  // Date range states
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Load watchlist data on mount
  React.useEffect(() => {
    refreshWatchlist();
  }, []);

  // Save watchlist to localStorage
  React.useEffect(() => {
    localStorage.setItem("watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  const refreshWatchlist = async () => {
    if (watchlist.length === 0) {
      setWatchlistData([]);
      return;
    }
    setIsRefreshingWatchlist(true);
    try {
      const res = await fetch(`/api/quotes?symbols=${watchlist.join(",")}`);
      if (res.ok) {
        const data = await res.json();
        setWatchlistData(data);
      }
    } catch (err) {
      console.error("Failed to refresh watchlist", err);
    } finally {
      setIsRefreshingWatchlist(false);
    }
  };

  const addToWatchlist = (s: string) => {
    const sym = s.toUpperCase().trim();
    if (sym && !watchlist.includes(sym)) {
      const newWatchlist = [...watchlist, sym];
      setWatchlist(newWatchlist);
      // Immediately fetch data for the new list
      fetch(`/api/quotes?symbols=${newWatchlist.join(",")}`)
        .then(res => res.json())
        .then(data => setWatchlistData(data))
        .catch(err => console.error(err));
    }
  };

  const removeFromWatchlist = (e: React.MouseEvent, s: string) => {
    e.stopPropagation(); // Prevent triggering the row click
    const newWatchlist = watchlist.filter(item => item !== s);
    setWatchlist(newWatchlist);
    setWatchlistData(prev => prev.filter(item => item.symbol !== s));
  };

  const handleBack = () => {
    setHistoricalData([]);
    setPrediction(null);
    setNews([]);
    setFileName(null);
    setSymbol("");
  };

  const fetchStockData = async (e?: React.FormEvent, targetSymbol?: string) => {
    if (e) e.preventDefault();
    const sym = targetSymbol || symbol;
    if (!sym) return;

    setIsLoading(true);
    setError(null);
    setPrediction(null);
    setNews([]);
    setFileName(sym.toUpperCase());
    if (!targetSymbol) setSymbol(sym.toUpperCase());

    try {
      // Fetch Price Data
      const priceRes = await fetch(`/api/stock/${sym}?start=${startDate}&end=${endDate}`);
      if (!priceRes.ok) {
        const data = await priceRes.json();
        throw new Error(data.error || "获取股价失败");
      }
      const priceData = await priceRes.json();
      setHistoricalData(priceData);

      // Fetch News
      const newsRes = await fetch(`/api/news/${sym}`);
      if (newsRes.ok) {
        const newsData = await newsRes.json();
        setNews(newsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取数据失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsLoading(true);
    setError(null);
    setPrediction(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsedData: StockData[] = results.data
            .map((row: any) => {
              const dateKey = Object.keys(row).find(k => k.toLowerCase().includes("date"));
              const priceKey = Object.keys(row).find(k => 
                k.toLowerCase().includes("close") || 
                k.toLowerCase().includes("price") ||
                k.toLowerCase().includes("adj close")
              );

              if (!dateKey || !priceKey) return null;

              const price = parseFloat(row[priceKey].replace(/[$,]/g, ""));
              if (isNaN(price)) return null;

              return {
                date: row[dateKey],
                price: price,
              };
            })
            .filter((item): item is StockData => item !== null)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          if (parsedData.length < 10) {
            throw new Error("CSV must contain at least 10 rows of valid stock data.");
          }

          setHistoricalData(parsedData);
          setIsLoading(false);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to parse CSV file.");
          setIsLoading(false);
        }
      },
      error: (err) => {
        setError("Error reading file: " + err.message);
        setIsLoading(false);
      }
    });
  }, []);

  const handlePredict = async () => {
    if (historicalData.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await predictStockPrice(historicalData, news);
      setPrediction(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const combinedData = prediction 
    ? [...historicalData, ...prediction.predictions]
    : historicalData;

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {historicalData.length > 0 && (
              <Button variant="ghost" size="icon" onClick={handleBack} className="rounded-full">
                <ChevronLeft className="w-6 h-6" />
              </Button>
            )}
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-8 h-8 text-primary" />
                Stocky
              </h1>
              <p className="text-slate-500 mt-1">
                上传历史数据或搜索股票代码，获取 AI 驱动的趋势分析。
              </p>
            </div>
          </div>
        </header>

        <div className="flex flex-col md:flex-row items-end gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500 ml-1">股票代码</Label>
            <div className="relative">
              <Input
                placeholder="如 AAPL 或 600519"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-40 pl-8"
              />
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500 ml-1">开始日期</Label>
            <div className="relative">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40 pl-8"
              />
              <Calendar className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500 ml-1">结束日期</Label>
            <div className="relative">
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40 pl-8"
              />
              <Calendar className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <Button onClick={fetchStockData} variant="secondary" disabled={isLoading || !symbol}>
            导入数据
          </Button>

          <div className="h-8 w-px bg-slate-200 hidden md:block mx-1" />

          <label className="relative cursor-pointer">
            <input
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={handleFileUpload}
            />
            <Button variant="outline" className="gap-2">
              <Upload className="w-4 h-4" />
              {fileName && fileName.endsWith(".csv") ? "更换 CSV" : "上传 CSV"}
            </Button>
          </label>
          
          {historicalData.length > 0 && (
            <Button 
              onClick={handlePredict} 
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <BarChart3 className="w-4 h-4" />
              )}
              生成预测
            </Button>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>错误</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {historicalData.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Chart Area */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    价格走势
                  </CardTitle>
                  <CardDescription>
                    正在查看 {fileName} 的历史数据 {prediction ? "及 AI 预测结果" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <StockChart 
                    data={combinedData} 
                    predictionStartIndex={historicalData.length} 
                    validationData={prediction?.validationData}
                  />
                </CardContent>
              </Card>

              {prediction && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      AI 趋势分析 (70/30 验证模式)
                    </CardTitle>
                    {prediction.validationAccuracy && (
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[10px] uppercase text-slate-400 font-bold">回测准确度</p>
                          <p className={`text-sm font-mono font-bold ${prediction.validationAccuracy.score > 80 ? "text-emerald-600" : "text-amber-600"}`}>
                            {prediction.validationAccuracy.score}%
                          </p>
                        </div>
                        <div className="h-8 w-px bg-slate-200" />
                        <div className="text-right">
                          <p className="text-[10px] uppercase text-slate-400 font-bold">平均误差 (MAE)</p>
                          <p className="text-sm font-mono font-bold text-slate-700">
                            ${prediction.validationAccuracy.mae.toFixed(3)}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-700 leading-relaxed">
                      {prediction.analysis}
                    </p>
                  </CardContent>
                </Card>
              )}

              {news.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Newspaper className="w-5 h-5 text-primary" />
                      相关新闻
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {news.map((item, idx) => (
                      <div key={idx} className="group border-b border-slate-100 last:border-0 pb-4 last:pb-0">
                        <a 
                          href={item.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex justify-between items-start gap-4 hover:text-primary transition-colors"
                        >
                          <div className="space-y-1">
                            <h3 className="font-medium text-slate-900 line-clamp-2">{item.title}</h3>
                            <div className="flex items-center gap-3 text-xs text-slate-400">
                              <span>{item.publisher}</span>
                              <span>•</span>
                              <span>{new Date(item.providerPublishTime * 1000).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar Info */}
            <div className="space-y-6">
              <Watchlist 
                watchlistData={watchlistData}
                isRefreshing={isRefreshingWatchlist}
                onRefresh={refreshWatchlist}
                onSelect={(s) => fetchStockData(undefined, s)}
                onRemove={removeFromWatchlist}
                onAddCurrent={() => addToWatchlist(symbol)}
                currentSymbol={symbol}
                isInWatchlist={watchlist.includes(symbol.toUpperCase())}
              />

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                    数据摘要
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-bottom border-slate-100">
                    <span className="text-slate-600">总数据点</span>
                    <span className="font-mono font-medium">{historicalData.length}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-bottom border-slate-100">
                    <span className="text-slate-600">日期范围</span>
                    <span className="text-xs font-medium">
                      {historicalData[0].date} - {historicalData[historicalData.length - 1].date}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-bottom border-slate-100">
                    <span className="text-slate-600">最新价格</span>
                    <span className="font-mono font-medium text-primary">
                      ${historicalData[historicalData.length - 1].price.toFixed(3)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                    操作指南
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600 space-y-2">
                  <p>1. 输入股票代码（如美股 AAPL 或 A股 600519/000001）并点击导入，或上传 CSV 文件。</p>
                  <p>2. 系统将解析并可视化历史趋势。</p>
                  <p>3. 点击“生成预测”，Gemini AI 将分析模式并预测未来 10 天的走势。</p>
                  <p className="text-xs italic text-slate-400 mt-4">
                    注：预测结果仅供参考，不构成任何投资建议。
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-200 rounded-3xl bg-white/50">
              <div className="bg-primary/10 p-4 rounded-full mb-4">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900">暂无数据</h2>
              <p className="text-slate-500 mt-2 max-w-sm text-center">
                请输入股票代码导入数据，或上传包含历史股价的 CSV 文件。
              </p>
              <div className="mt-6 flex flex-col items-center gap-4 w-full max-w-md px-6">
                <form onSubmit={fetchStockData} className="flex items-center gap-2 w-full">
                  <Input
                    placeholder="代码 (如 TSLA 或 600519)"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={isLoading || !symbol}>
                    导入数据
                  </Button>
                </form>
                <div className="flex items-center gap-4 w-full">
                  <div className="h-px bg-slate-200 flex-1" />
                  <span className="text-slate-400 text-sm">或者</span>
                  <div className="h-px bg-slate-200 flex-1" />
                </div>
                <label className="relative cursor-pointer w-full">
                  <input
                    type="file"
                    accept=".csv"
                    className="sr-only"
                    onChange={handleFileUpload}
                  />
                  <Button variant="outline" className="w-full">选择 CSV 文件</Button>
                </label>
              </div>
            </div>

            <div className="space-y-6">
              <Watchlist 
                watchlistData={watchlistData}
                isRefreshing={isRefreshingWatchlist}
                onRefresh={refreshWatchlist}
                onSelect={(s) => fetchStockData(undefined, s)}
                onRemove={removeFromWatchlist}
              />
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                    快速入门
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600 space-y-3">
                  <p>🚀 <b>搜索代码</b>：支持全球主流股市，输入代码即可获取实时行情与历史数据。</p>
                  <p>📈 <b>AI 预测</b>：基于 Google Gemini 模型，结合历史趋势与最新新闻进行深度分析。</p>
                  <p>⭐ <b>关注列表</b>：将心仪的股票加入关注，主界面随时掌握动态。</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
