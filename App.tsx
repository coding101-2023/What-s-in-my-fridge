import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FoodItem, Category, ScannedFoodData } from './types';
import { analyzeFridgeItem, identifyShopItem } from './services/geminiService';
import Camera from './components/Camera';
import RetroCard from './components/RetroCard';
import { CategoryIcon, getCategoryEmoji } from './components/CategoryIcon';
import { differenceInDays, parseISO, format } from 'date-fns';

type View = 'fridge' | 'add' | 'shop';

// Chinese translation map for categories
const categoryMap: Record<Category, string> = {
  [Category.VEGETABLE]: '蔬菜',
  [Category.FRUIT]: '水果',
  [Category.MEAT]: '肉类',
  [Category.DAIRY]: '乳制品',
  [Category.DRINK]: '饮品',
  [Category.SNACK]: '零食',
  [Category.CONDIMENT]: '调味品',
  [Category.OTHER]: '其他',
};

export default function App() {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [currentView, setCurrentView] = useState<View>('fridge');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'add' | 'shop'>('add');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Staging state for adding items
  const [stagedItem, setStagedItem] = useState<Partial<FoodItem> | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [unitInput, setUnitInput] = useState('g');

  // Staging state for shopping search result
  const [searchResult, setSearchResult] = useState<{
    foundItem: FoodItem | null;
    scannedName: string;
  } | null>(null);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('fridgeItems');
    if (saved) {
      setItems(JSON.parse(saved));
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem('fridgeItems', JSON.stringify(items));
  }, [items]);

  const handleCapture = async (base64Images: string[]) => {
    setLoading(true);
    setError(null);
    setIsCameraOpen(false);

    try {
      if (cameraMode === 'add') {
        const data = await analyzeFridgeItem(base64Images);
        
        // Parse weight string to separate number and unit
        let wNum = '';
        let wUnit = 'g';
        
        if (data.weight) {
          const match = data.weight.match(/^(\d*\.?\d+)\s*([a-zA-Z]+)$/);
          if (match) {
             wNum = match[1];
             wUnit = match[2].toLowerCase();
          } else {
             // Try just number
             const numMatch = data.weight.match(/^(\d*\.?\d+)$/);
             if (numMatch) {
                wNum = numMatch[1];
             }
          }
        }
        
        setWeightInput(wNum);
        // Map to supported units or default to 'g'
        if (['g', 'kg', 'ml', 'l'].includes(wUnit)) {
             setUnitInput(wUnit);
        } else if (wUnit === 'liter') {
            setUnitInput('L');
        } else {
             setUnitInput('g');
        }

        setStagedItem({
          name: data.name,
          category: data.category,
          productionDate: data.productionDate,
          expiryDate: data.expiryDate,
          weight: data.weight, 
          purchaseDate: format(new Date(), 'yyyy-MM-dd'),
          remainingPercentage: 100,
          emoji: getCategoryEmoji(data.category),
        });
        setCurrentView('add');
      } else {
        // Shop mode
        const data = await identifyShopItem(base64Images);
        
        // Fuzzy search logic
        const existing = items.find(item => 
          item.name.toLowerCase().includes(data.name.toLowerCase()) || 
          data.name.toLowerCase().includes(item.name.toLowerCase())
        );

        setSearchResult({
          foundItem: existing || null,
          scannedName: data.name
        });
        setCurrentView('shop');
      }
    } catch (err) {
      setError('哎呀！无法识别该物品。请重试。');
    } finally {
      setLoading(false);
    }
  };

  const saveItem = () => {
    if (stagedItem && stagedItem.name && stagedItem.category) {
      const finalWeight = weightInput ? `${weightInput}${unitInput}` : undefined;

      const newItem: FoodItem = {
        id: uuidv4(),
        name: stagedItem.name,
        category: stagedItem.category,
        purchaseDate: stagedItem.purchaseDate || format(new Date(), 'yyyy-MM-dd'),
        remainingPercentage: 100,
        emoji: getCategoryEmoji(stagedItem.category),
        productionDate: stagedItem.productionDate,
        expiryDate: stagedItem.expiryDate,
        weight: finalWeight
      };
      setItems([...items, newItem]);
      setStagedItem(null);
      setCurrentView('fridge');
    }
  };

  const updateConsumption = (id: string, newPercentage: number) => {
    if (newPercentage <= 0) {
      // Delete item
      setItems(items.filter(i => i.id !== id));
    } else {
      setItems(items.map(i => i.id === id ? { ...i, remainingPercentage: newPercentage } : i));
    }
  };

  const getDaysUntilExpiry = (dateStr?: string) => {
    if (!dateStr) return null;
    const days = differenceInDays(parseISO(dateStr), new Date());
    return days;
  };

  return (
    <div className="min-h-screen pb-24 font-body text-black bg-mario-bg relative">
      {/* Background clouds pattern overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(circle, white 2px, transparent 2.5px)', backgroundSize: '24px 24px' }}></div>

      {/* Header */}
      <header className="sticky top-0 z-10 bg-mario-red border-b-4 border-black p-4 shadow-pixel">
        <div className="flex items-center justify-center gap-2">
           <span className="text-2xl animate-bounce">🍄</span>
           <h1 className="text-xl sm:text-2xl font-display text-center text-white drop-shadow-[4px_4px_0_rgba(0,0,0,1)] tracking-widest uppercase">
             冰箱里有什么
           </h1>
           <span className="text-2xl animate-bounce">⭐</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 max-w-2xl mx-auto relative z-0">
        
        {loading && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
            <RetroCard className="animate-pulse flex flex-col items-center" color="cream">
              <span className="text-6xl mb-4">⏳</span>
              <span className="text-xl font-display text-mario-red">LOADING...</span>
            </RetroCard>
          </div>
        )}

        {error && (
          <RetroCard color="red" className="mb-4">
            <p className="font-bold text-lg font-body">{error}</p>
            <button onClick={() => setError(null)} className="mt-2 text-sm underline font-display">DISMISS</button>
          </RetroCard>
        )}

        {/* View: Fridge Inventory */}
        {currentView === 'fridge' && (
          <>
             {/* Stats Bar */}
             <div className="bg-black text-white p-2 mb-4 border-2 border-white font-display text-xs flex justify-between uppercase">
                <span>ITEMS: {items.length}</span>
                <span>WORLD: 1-1</span>
             </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {items.length === 0 ? (
                <div className="col-span-full text-center py-20 bg-mario-blue/50 rounded-xl border-4 border-black border-dashed">
                  <span className="text-6xl filter grayscale">🕸️</span>
                  <p className="mt-4 text-2xl font-display text-white text-shadow">EMPTY!</p>
                  <p className="text-white font-body text-xl">Press Start to add items</p>
                </div>
              ) : (
                items.map((item) => {
                  const daysLeft = getDaysUntilExpiry(item.expiryDate);
                  const isExpired = daysLeft !== null && daysLeft < 0;
                  const isUrgent = daysLeft !== null && daysLeft <= 3 && daysLeft >= 0;

                  return (
                    <RetroCard key={item.id} className="relative overflow-hidden group hover:bg-yellow-50" color="white">
                      <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-2 border-dashed">
                        <div className="flex items-center gap-3">
                          <div className="text-3xl bg-mario-bg/20 rounded border-2 border-black w-10 h-10 flex items-center justify-center">
                            {item.emoji}
                          </div>
                          <div>
                            <h3 className="font-display text-sm leading-tight text-mario-blue">{item.name}</h3>
                            <span className="text-xs font-bold uppercase tracking-wider bg-black text-white px-1">{categoryMap[item.category] || item.category}</span>
                          </div>
                        </div>
                        {item.weight && <span className="text-xs bg-mario-yellow text-black px-2 py-1 border-2 border-black font-bold font-display shadow-pixel-sm transform rotate-3">{item.weight}</span>}
                      </div>

                      <div className="space-y-2 text-lg font-body">
                         {/* Purchase Date */}
                         <div className="flex justify-between items-center">
                          <span className="text-gray-600 text-sm">BUY DATE</span>
                          <span className="font-bold">{item.purchaseDate}</span>
                        </div>
                        
                        {/* Expiry Status */}
                        {item.expiryDate && (
                          <div className={`flex justify-between items-center p-1 border-2 border-black ${isExpired ? 'bg-mario-red text-white' : isUrgent ? 'bg-mario-yellow' : 'bg-gray-100'}`}>
                            <span className="text-sm">EXPIRY</span>
                            <span className="font-bold font-display text-sm">
                              {isExpired ? 'DEAD' : `-${daysLeft} DAYS`}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Consumption Slider */}
                      <div className="mt-4 pt-2">
                        <div className="flex justify-between text-xs font-display mb-1 text-mario-blue">
                          <span>HP</span>
                          <span>{item.remainingPercentage}%</span>
                        </div>
                        <div className="flex gap-1 h-4">
                          {[25, 50, 75, 100].map((pct) => (
                             <button
                               key={pct}
                               onClick={() => updateConsumption(item.id, pct)}
                               className={`flex-1 border-2 border-black transition-all ${item.remainingPercentage >= pct ? 'bg-mario-green' : 'bg-gray-300'}`}
                             />
                          ))}
                        </div>
                        <div className="flex justify-between text-sm mt-2 font-display">
                           <button onClick={() => updateConsumption(item.id, 0)} className="text-mario-red hover:underline">DELETE</button>
                        </div>
                      </div>
                    </RetroCard>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* View: Add Item Form */}
        {currentView === 'add' && stagedItem && (
          <div className="animate-fade-in">
             <div className="bg-black text-white text-center p-2 mb-4 font-display border-4 border-white shadow-pixel">
                NEW CHALLENGER!
             </div>
             <RetroCard color="white" className="space-y-4">
                <div>
                  <label className="block font-display text-xs mb-2 text-mario-blue">NAME</label>
                  <input 
                    type="text" 
                    value={stagedItem.name} 
                    onChange={(e) => setStagedItem({...stagedItem, name: e.target.value})}
                    className="w-full border-4 border-black p-3 font-body text-2xl bg-mario-cream text-black shadow-inner"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-display text-xs mb-2 text-mario-blue">TYPE</label>
                    <select 
                      value={stagedItem.category} 
                      onChange={(e) => setStagedItem({...stagedItem, category: e.target.value as Category, emoji: getCategoryEmoji(e.target.value as Category)})}
                      className="w-full border-4 border-black p-2 bg-white text-black font-body text-xl"
                    >
                      {Object.values(Category).map(c => <option key={c} value={c}>{categoryMap[c]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block font-display text-xs mb-2 text-mario-blue">WEIGHT</label>
                    <div className="flex gap-2">
                        <input 
                        type="number" 
                        value={weightInput} 
                        onChange={(e) => setWeightInput(e.target.value)}
                        className="w-full border-4 border-black p-2 bg-white text-black font-body text-xl"
                        placeholder="0"
                        />
                        <select
                            value={unitInput}
                            onChange={(e) => setUnitInput(e.target.value)}
                            className="border-4 border-black p-2 bg-white text-black font-display text-sm min-w-[70px]"
                        >
                            <option value="g">g</option>
                            <option value="kg">kg</option>
                            <option value="ml">ml</option>
                            <option value="L">L</option>
                        </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-display text-xs mb-2 text-mario-blue">PROD. DATE</label>
                    <input 
                      type="date" 
                      value={stagedItem.productionDate || ''} 
                      onChange={(e) => setStagedItem({...stagedItem, productionDate: e.target.value})}
                      className="w-full border-4 border-black p-2 bg-white text-black font-body text-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-display text-xs mb-2 text-mario-blue">EXP. DATE</label>
                    <input 
                      type="date" 
                      value={stagedItem.expiryDate || ''} 
                      onChange={(e) => setStagedItem({...stagedItem, expiryDate: e.target.value})}
                      className="w-full border-4 border-black p-2 bg-white text-black font-body text-xl"
                    />
                  </div>
                </div>

                <div className="flex gap-4 mt-6">
                  <button onClick={() => setCurrentView('fridge')} className="flex-1 py-4 border-4 border-black bg-gray-200 text-black font-display text-sm hover:bg-gray-300">CANCEL</button>
                  <button onClick={saveItem} className="flex-1 py-4 bg-mario-green text-white border-4 border-black font-display text-sm shadow-pixel hover:translate-y-1 hover:shadow-none transition-all">SAVE GAME</button>
                </div>
             </RetroCard>
          </div>
        )}

        {/* View: Shopping Result */}
        {currentView === 'shop' && searchResult && (
           <div className="animate-fade-in flex flex-col items-center">
             <div className="text-6xl mb-4 animate-bounce">{searchResult.foundItem ? '🍄' : '⭐'}</div>
             <h2 className="text-xl font-display mb-4 text-center text-white text-shadow">
               SCANNING: <br/><span className="text-mario-yellow text-2xl">{searchResult.scannedName}</span>
             </h2>

             {searchResult.foundItem ? (
               <RetroCard color="yellow" className="w-full mb-6">
                 <h3 className="text-lg font-display mb-4 text-center border-b-4 border-black pb-2">DUPLICATE FOUND!</h3>
                 <div className="bg-white border-4 border-black p-4 mb-4">
                    <p className="text-2xl font-body mb-2"><strong>ITEM:</strong> {searchResult.foundItem.name}</p>
                    <p className="text-xl font-body"><strong>BOUGHT:</strong> {searchResult.foundItem.purchaseDate}</p>
                    <p className="text-xl font-body"><strong>EXPIRY:</strong> {getDaysUntilExpiry(searchResult.foundItem.expiryDate)} DAYS LEFT</p>
                    <div className="mt-4">
                       <strong className="font-display text-xs">HP LEVEL:</strong>
                       <div className="w-full bg-black h-6 border-2 border-white mt-1 overflow-hidden relative">
                          <div className="bg-mario-green h-full" style={{ width: `${searchResult.foundItem.remainingPercentage}%` }}></div>
                          <div className="absolute inset-0 text-white text-center text-xs leading-6 font-display mix-blend-difference">{searchResult.foundItem.remainingPercentage}%</div>
                       </div>
                    </div>
                 </div>
                 <p className="text-center font-display text-xs text-red-600">SAVE YOUR COINS! 🪙</p>
               </RetroCard>
             ) : (
               <RetroCard color="green" className="w-full mb-6">
                 <h3 className="text-xl font-display text-white mb-2 text-center text-shadow">IT'S SAFE!</h3>
                 <p className="text-white text-2xl font-body text-center">New Item Discovered!</p>
               </RetroCard>
             )}

             <button 
                onClick={() => {
                  setSearchResult(null);
                  setCurrentView('fridge');
                }}
                className="bg-black text-white font-display text-sm py-4 px-8 border-4 border-white shadow-hard hover:translate-y-1 hover:shadow-none"
             >
               CONTINUE
             </button>
           </div>
        )}

      </main>

      {/* Camera Overlay */}
      {isCameraOpen && (
        <Camera 
          label={cameraMode === 'add' ? "CAPTURE FOOD" : "SCAN STORE ITEM"}
          onCapture={handleCapture}
          onClose={() => setIsCameraOpen(false)}
        />
      )}

      {/* Sticky Bottom Nav (Pipe Style) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-mario-ground border-t-4 border-black p-4 pb-6 flex justify-around shadow-[0_-4px_0_rgba(0,0,0,0.2)]">
         <button 
           onClick={() => setCurrentView('fridge')}
           className={`flex flex-col items-center active:scale-95 transition-transform ${currentView === 'fridge' ? 'opacity-100' : 'opacity-70'}`}
         >
           <div className="w-12 h-12 bg-mario-blue border-4 border-black flex items-center justify-center text-2xl shadow-pixel-sm mb-1 text-white">❄️</div>
           <span className="font-display text-[10px] text-white tracking-wide">MY FRIDGE</span>
         </button>

         <button 
           onClick={() => {
             setCameraMode('add');
             setIsCameraOpen(true);
           }}
           className="relative -top-10 bg-mario-green text-white w-20 h-20 rounded-xl border-4 border-black flex items-center justify-center shadow-pixel transition-transform active:translate-y-2 active:shadow-none group"
         >
           <span className="text-4xl group-hover:animate-spin">📸</span>
           <div className="absolute -bottom-6 font-display text-[10px] text-white bg-black px-2 py-1 border-2 border-white">ADD</div>
         </button>

         <button 
           onClick={() => {
              setCameraMode('shop');
              setIsCameraOpen(true);
           }}
           className={`flex flex-col items-center active:scale-95 transition-transform ${currentView === 'shop' ? 'opacity-100' : 'opacity-70'}`}
         >
           <div className="w-12 h-12 bg-mario-yellow border-4 border-black flex items-center justify-center text-2xl shadow-pixel-sm mb-1 text-black">🛒</div>
           <span className="font-display text-[10px] text-white tracking-wide">SCAN</span>
         </button>
      </nav>
    </div>
  );
}