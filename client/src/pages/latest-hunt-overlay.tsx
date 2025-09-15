import { useQuery } from "@tanstack/react-query";

type Currency = 'USD' | 'CAD' | 'AUD';

function formatCurrency(amount: number, currency: Currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function LatestHuntOverlay() {
  const { data: obsData } = useQuery({
    queryKey: ["/api/obs-overlay/latest"],
    refetchInterval: 2000,
  });

  if (!obsData?.hunt || !obsData?.bonuses) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: 'transparent' }}>
        <div className="text-white text-2xl border-4 border-white p-8 rounded-lg" style={{ background: 'transparent' }}>No active hunt found</div>
      </div>
    );
  }

  const { hunt, bonuses } = obsData;
  const totalBonuses = bonuses?.length || 0;
  const openedBonuses = bonuses?.filter((b: any) => b.isPlayed) || [];

  // Next bonus to open
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

  // Calculate req average: (Starting balance - Total won) / sum of remaining bet sizes
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
    <div className="h-screen w-full text-white flex flex-col" style={{ background: 'gray' }}>
      <div className="w-full h-full p-4 flex flex-col border-4 border-white rounded-lg min-h-0" style={{ background: 'gray' }}>
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
        <div className="bg-black border-2 border-white rounded-lg p-4 flex-1 min-h-0">
          <div className="relative h-full overflow-hidden">
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
              
              {/* Duplicate entries for seamless scrolling */}
              {bonuses?.map((bonus: any, index: number) => {
                const isNext = hunt.isPlaying && !bonus.isPlayed && 
                              bonuses.findIndex((b: any) => !b.isPlayed) === index;
                
                return (
                  <div 
                    key={`slot-duplicate-${bonus.id}-${index}`}
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
      
      <style>{`
        @keyframes scroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        .animate-scroll {
          animation: scroll 20s linear infinite;
        }
      `}</style>
    </div>
  );
}
