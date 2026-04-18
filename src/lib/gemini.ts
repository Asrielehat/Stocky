import { GoogleGenAI, Type } from "@google/genai";
import { StockData, PredictionResult } from "../types";

export async function predictStockPrice(historicalData: StockData[], news: any[] = [], stockName: string = ""): Promise<PredictionResult> {
  try {
    const response = await fetch("/api/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        historicalData,
        news,
        stockName
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "预测请求失败");
    }

    return await response.json();
  } catch (error: any) {
    console.error("Prediction Error:", error);
    const message = error?.message || "网络请求失败，请检查服务器运行状态。";
    throw new Error(`AI 服务异常: ${message}`);
  }
}
