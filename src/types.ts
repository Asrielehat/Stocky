export interface StockData {
  date: string;
  price: number;
  isPrediction?: boolean;
}

export interface PredictionResult {
  predictions: StockData[];
  analysis: string;
}
