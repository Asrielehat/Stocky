import { GoogleGenAI, Type } from "@google/genai";
import { StockData, PredictionResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function predictStockPrice(historicalData: StockData[], news: any[] = []): Promise<PredictionResult> {
  // Take the last 50 points to avoid token limits and focus on recent trends
  const recentData = historicalData.slice(-50);
  
  const newsContext = news.map(n => n.title).join("\n");
  
  const prompt = `
    你是一位专业的金融分析师。请分析以下历史股价数据和近期相关新闻，并预测未来 10 天的价格走势。
    
    历史数据（最近 50 天）：
    ${JSON.stringify(recentData)}
    
    近期新闻摘要：
    ${newsContext || "暂无相关新闻"}
    
    根据这些数据中的趋势、波动、模式以及新闻反映的市场情绪，提供：
    1. 未来 10 天的 10 个预测数据点。
    2. 对趋势（看涨、看跌或中性）的简短专业分析及理由。请务必结合新闻内容（如果有）进行分析。
    
    请务必使用中文进行分析。
    以 JSON 格式返回响应。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            predictions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                },
                required: ["date", "price"],
              },
            },
            analysis: { type: Type.STRING },
          },
          required: ["predictions", "analysis"],
        },
      },
    });

    if (!response.text) {
      throw new Error("Empty response from AI model");
    }

    const result = JSON.parse(response.text);
    return {
      predictions: result.predictions.map((p: any) => ({ ...p, isPrediction: true })),
      analysis: result.analysis,
    };
  } catch (error: any) {
    console.error("Gemini Prediction Error:", error);
    const message = error?.message || "未知错误";
    throw new Error(`AI 预测失败: ${message}。请确保您的 API 密钥有效。`);
  }
}
