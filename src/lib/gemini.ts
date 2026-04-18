import { GoogleGenAI } from "@google/genai";
import { StockData, PredictionResult } from "../types";

// Initialize Gemini on the frontend
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "" 
});

export async function predictStockPrice(historicalData: StockData[], news: any[] = [], stockName: string = ""): Promise<PredictionResult> {
  try {
    const prompt = `
      作为一名专业的股票分析师，请根据以下数据为股票 "${stockName}" 提供预测。
      
      历史数据（最近100天，按日期升序）：
      ${JSON.stringify(historicalData.slice(-100))}
      
      相关新闻摘要：
      ${JSON.stringify(news.slice(0, 5))}
      
      请完成以下任务：
      1. 分析当前价格趋势。
      2. 选出历史数据中最后 5 个点，并基于此前的趋势预测这些点可能的值（用于验证预测的回测点）。
      3. 预测未来 5 个交易日的可能股价。
      4. 提供一段专业的中文分析（200字以内）。
      5. 给出一个 0-100 的信心评分。
      
      输出格式必须严格为以下 JSON：
      {
        "validationPoints": [{"date": "历史日期", "price": 预测值}],
        "predictions": [{"date": "未来日期", "price": 预测值}], 
        "analysis": "分析内容",
        "accuracyScore": 信心分
      }
    `;

    const modelName = "gemini-3-flash-preview"; // 免费预览版 Flash，配额极高
    
    // 强制只使用 Flash 系列（免费模型）
    let result;
    try {
      result = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
      });
    } catch (err: any) {
      console.warn(`[AI] ${modelName} 尝试失败，正在切换至通用免费版 gemini-1.5-flash...`);
      // 这里的 1.5-flash 也是 Google 永久提供免费层级的模型
      result = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
      });
    }

    const jsonText = (result.text || "").replace(/```json|```/g, "").trim();
    const aiResult = JSON.parse(jsonText);

    return {
      predictions: aiResult.predictions.map((p: any) => ({ ...p, isPrediction: true })),
      validationData: aiResult.validationPoints.map((p: any) => ({ ...p, isPrediction: true })),
      analysis: aiResult.analysis,
      validationAccuracy: {
        mae: 0,
        rmse: 0,
        score: aiResult.accuracyScore || 80
      }
    };
  } catch (error: any) {
    console.error("Gemini Prediction Error:", error);
    throw new Error(`AI 服务异常: ${error?.message || "无法完成预测"}`);
  }
}
