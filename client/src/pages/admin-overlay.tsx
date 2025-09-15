import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";
import type { Currency } from "@/lib/currency";
import { useRoute } from "wouter";

// Enhanced overlay with new design matching user's reference image
export default function AdminOverlay() {
  const [match, params] = useRoute("/overlay/:adminKey");
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!params?.adminKey) return;

    const fetchData = async () => {
      try {
        const response = await fetch(`/api/obs-overlay/admin/${params.adminKey}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Error fetching OBS data:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [params?.adminKey]);

  if (!match || !params?.adminKey) {
    return <div className="p-8 text-red-500">Invalid overlay URL</div>;
  }

  if (!data?.hunt) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-white text-2xl">No active hunt</div>
      </div>
    );
  }

  const { hunt, bonuses } = data;
  const openedBonuses = bonuses?.filter((b: any) => b.isPlayed) || [];
  const totalBonuses = bonuses?.length || 0;
  const nextBonus = hunt.isPlaying ? bonuses?.find((b: any) => !b.isPlayed) : null;
  
  const totalWin = openedBonuses.reduce((sum: number, b: any) => sum + (Number(b.winAmount) || 0), 0);
  
  // Find best win and best multiplier
  const bestWin = openedBonuses.reduce((best: any, current: any) => {
    const currentWin = Number(current.winAmount || 0);
    const bestWin = Number(best?.winAmount || 0);
    return currentWin > bestWin ? current : best;
  }, openedBonuses[0] || null);

  const bestMulti = openedBonuses.reduce((best: any, current: any) => {
    const currentMulti = Number(current.multiplier || 0);
    const bestMulti = Number(best?.multiplier || 0);
    return currentMulti > bestMulti ? current : best;
  }, openedBonuses[0] || null);

  const bestWinAmount = bestWin ? Number(bestWin.winAmount || 0) : 0;
  const bestMultiplier = bestMulti ? Number(bestMulti.multiplier || 0) : 0;
  
  // Calculate run average (average of all played multipliers)
  const playedMultipliers = openedBonuses
    .map((b: any) => Number(b.multiplier || 0))
    .filter((m: number) => m > 0);
  const runAvg = playedMultipliers.length > 0 
    ? playedMultipliers.reduce((sum: number, m: number) => sum + m, 0) / playedMultipliers.length 
    : 0;

  // Calculate req average: (Starting balance - Total won) / sum of unopened bet sizes
  const unplayedBonuses = bonuses?.filter((b: any) => !b.isPlayed) || [];
  const remainingBetSum = unplayedBonuses.reduce((sum: number, b: any) => sum + (Number(b.betAmount) || 0), 0);
  const startingBalance = Number(hunt.startBalance || 0);
  const reqAvg = remainingBetSum > 0 
    ? Math.max(0, (startingBalance - totalWin) / remainingBetSum)
    : 0;
  
  // Calculate progress percentage
  const progressPercentage = totalBonuses > 0 ? (openedBonuses.length / totalBonuses) * 100 : 0;

  const remaining = totalBonuses - openedBonuses.length;

  return (
    <div className="min-h-screen w-full text-white overflow-hidden flex flex-col" style={{ background: 'transparent' }}>
      <div className="w-full h-full p-4 flex flex-col border-4 border-white rounded-lg" style={{ background: 'transparent' }}>
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-6xl font-black text-white drop-shadow-lg" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>{hunt.title}</h1>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <span className="text-white font-bold text-2xl">BONUSES OPENED</span>
            <span className="text-white font-bold text-2xl">{openedBonuses.length}/{totalBonuses}</span>
          </div>
          <div className="w-full bg-black rounded-full h-6 border-2 border-white">
            <div 
              className="bg-gradient-to-r from-green-400 to-blue-500 h-6 rounded-full transition-all duration-500" 
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Single Stats Box */}
        <div className="mb-8">
          <div className="bg-black border-2 border-white p-8 rounded-lg">
            <div className="grid grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-xl text-white mb-2">START</div>
                <div className="text-4xl font-bold text-white">
                  {formatCurrency(startingBalance, hunt.currency as Currency)}
                </div>
              </div>
              <div>
                <div className="text-xl text-white mb-2">WINNINGS</div>
                <div className="text-4xl font-bold text-white">
                  {formatCurrency(totalWin, hunt.currency as Currency)}
                </div>
              </div>
              <div>
                <div className="text-xl text-white mb-2">BEST WIN</div>
                <div className="text-4xl font-bold text-white">
                  {formatCurrency(bestWinAmount, hunt.currency as Currency)}
                </div>
              </div>
              <div>
                <div className="text-xl text-white mb-2">BEST MULTI</div>
                <div className="text-4xl font-bold text-white">
                  {bestMultiplier > 0 ? `${bestMultiplier.toFixed(0)}X` : "0X"}
                </div>
              </div>
              <div>
                <div className="text-xl text-white mb-2">RUN AVG</div>
                <div className="text-4xl font-bold text-white">
                  {runAvg > 0 ? `${runAvg.toFixed(0)}X` : "0X"}
                </div>
              </div>
              <div>
                <div className="text-xl text-white mb-2">REQ AVG</div>
                <div className="text-4xl font-bold text-white">
                  {reqAvg > 0 ? `${reqAvg.toFixed(0)}X` : "0X"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Slots List */}
        <div className="bg-black border-2 border-white rounded-lg p-4 flex-1">
          <div className="relative overflow-hidden flex-1" style={{ height: 'calc(100vh - 350px)' }}>
            <div className="space-y-2 animate-scroll">
              {bonuses?.map((bonus: any, index: number) => {
                const isNext = hunt.isPlaying && !bonus.isPlayed && 
                              bonuses.findIndex((b: any) => !b.isPlayed) === index;
                
                return (
                  <div 
                    key={`slot-${bonus.id}-${index}`}
                    className={`
                      flex items-center justify-between p-9 rounded-lg transition-all
                      ${isNext ? 'bg-yellow-500/20 animate-pulse' : bonus.isPlayed ? 'bg-green-500/10' : 'bg-gray-800/30'}
                    `}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`text-3xl font-bold w-16 text-center ${
                        isNext ? 'text-yellow-400' : bonus.isPlayed ? 'text-green-400' : 'text-gray-400'
                      }`}>
                        {bonus.order}
                      </div>
                      
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-20 h-20 rounded overflow-hidden flex-shrink-0">
                          <img 
                            src={bonus.imageUrl} 
                            alt={bonus.slotName}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-white font-medium text-2xl">{bonus.slotName}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-green-400 font-mono text-2xl">
                        {formatCurrency(Number(bonus.betAmount), hunt.currency as Currency)}
                      </div>
                      
                      <div className="text-right min-w-[120px]">
                        {bonus.isPlayed ? (
                          <>
                            <div className="text-yellow-400 font-bold text-2xl">
                              {Number(bonus.multiplier || 0).toFixed(0)}X
                            </div>
                            <div className="text-white font-bold text-2xl">
                              {formatCurrency(Number(bonus.winAmount || 0), hunt.currency as Currency)}
                            </div>
                          </>
                        ) : (
                          <div className="text-gray-500 text-2xl">-</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
