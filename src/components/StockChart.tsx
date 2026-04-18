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
  validationData?: StockData[];
}

export const StockChart: React.FC<StockChartProps> = ({ data, predictionStartIndex, validationData }) => {
  // Combine all data for consistent X-Axis
  // We need to match validation points to their dates in the actual data
  const chartData = data.map(item => {
    const valPoint = validationData?.find(v => v.date === item.date);
    return {
      ...item,
      validationPrice: valPoint?.price
    };
  });

  return (
    <div className="w-full h-[400px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
            name="实际价格"
            activeDot={{ r: 6 }}
            connectNulls
          />

          {/* Validation Line (AI Simulation of the 30% segment) */}
          {validationData && (
            <Line
              type="monotone"
              dataKey="validationPrice"
              stroke="#fbbf24"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="AI 模拟验证 (回测)"
            />
          )}
          
          {/* Future Prediction Line part is handled by the dataKey="price" where isPrediction is true */}
          {/* But we want to distinguish it. Recharts doesn't handle segment coloring well on one line easily. 
              Instead, let's use a reference line for the split. */}
          
          {predictionStartIndex > 0 && (
            <ReferenceLine 
              x={data[predictionStartIndex]?.date} 
              stroke="#ef4444" 
              label={{ value: '预测开始', position: 'top', fill: '#ef4444', fontSize: 12 }} 
              strokeDasharray="3 3"
            />
          )}

          {/* Let's mark the 70/30 split point if we can calculate it. 
              But usually predictionStartIndex is enough for the main split.
          */}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
