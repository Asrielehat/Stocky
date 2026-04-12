import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { StockData } from "../types";

interface StockChartProps {
  data: StockData[];
  predictionStartIndex: number;
}

export const StockChart: React.FC<StockChartProps> = ({ data, predictionStartIndex }) => {
  return (
    <div className="w-full h-[400px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12, fill: "#64748b" }}
            tickFormatter={(str) => {
              const date = new Date(str);
              return isNaN(date.getTime()) ? str : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            }}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: "#64748b" }}
            domain={['auto', 'auto']}
          />
          <Tooltip 
            contentStyle={{ 
              borderRadius: '8px', 
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
            }}
          />
          <Legend />
          
          {/* Historical Line */}
          <Line
            type="monotone"
            dataKey="price"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            name="Historical Price"
            activeDot={{ r: 6 }}
            connectNulls
          />
          
          {/* Prediction Line - we'll use a different color or style if we could, 
              but Recharts Line usually applies to the whole set. 
              Instead, we can use a ReferenceLine to mark the start of prediction.
          */}
          {predictionStartIndex > 0 && (
            <ReferenceLine 
              x={data[predictionStartIndex]?.date} 
              stroke="#ef4444" 
              label={{ value: 'Prediction Start', position: 'top', fill: '#ef4444', fontSize: 12 }} 
              strokeDasharray="3 3"
            />
          )}

          {/* To show prediction differently, we can use another Line with only prediction data 
              but that requires data formatting. For now, let's just use one line and the reference line.
          */}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
