export interface StockData {
  date: string;
  price: number;
  isPrediction?: boolean;
}

export interface PredictionResult {
  predictions: StockData[];
  analysis: string;
  validationAccuracy?: {
    mae: number;
    rmse: number;
    score: number; // 0-100
  };
  validationData?: StockData[];
}
