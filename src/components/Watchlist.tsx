import React from "react";
import { Star, Trash2, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface WatchlistProps {
  watchlistData: any[];
  isRefreshing: boolean;
  onRefresh: () => void;
  onSelect: (symbol: string) => void;
  onRemove: (e: React.MouseEvent, symbol: string) => void;
  onAddCurrent?: () => void;
  currentSymbol?: string;
  isInWatchlist?: boolean;
}

export function Watchlist({
  watchlistData,
  isRefreshing,
  onRefresh,
  onSelect,
  onRemove,
  onAddCurrent,
  currentSymbol,
  isInWatchlist
}: WatchlistProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          特别关注 (实时)
        </CardTitle>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8" 
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {watchlistData.length === 0 && !isRefreshing && (
          <p className="text-xs text-slate-400 text-center py-4">暂无关注股票</p>
        )}
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
          {watchlistData.map((item) => (
            <div key={item.symbol} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 group transition-colors border border-transparent hover:border-slate-100">
              <div 
                className="flex-1 cursor-pointer" 
                onClick={() => onSelect(item.symbol)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{item.symbol}</span>
                  <span className="text-[10px] text-slate-400 truncate max-w-[80px]">{item.name}</span>
                </div>
                <div className="text-xs font-mono text-slate-600">
                  ${item.price?.toFixed(3)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${item.change >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {item.change >= 0 ? "+" : ""}{item.change?.toFixed(3)}%
                </span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"
                  onClick={(e) => onRemove(e, item.symbol)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        {onAddCurrent && (
          <div className="pt-2 border-t border-slate-100 mt-2">
            <Button 
              variant="ghost" 
              className="w-full text-xs text-primary hover:bg-primary/5 gap-1.5 h-8"
              onClick={onAddCurrent}
              disabled={!currentSymbol || isInWatchlist}
            >
              <Star className="h-3 w-3" />
              关注当前股票
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
