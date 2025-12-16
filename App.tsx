import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FoodItem, Category, ScannedFoodData, ReceiptData, Recipe } from './types';
import { analyzeFridgeItem, identifyShopItem, parseReceipt, suggestRecipes, generateRecipeImage } from './services/geminiService';
import Camera from './components/Camera';
import RetroCard from './components/RetroCard';
import { getCategoryEmoji } from './components/CategoryIcon';
import { differenceInDays, parseISO, format, addDays } from 'date-fns';

type View = 'fridge' | 'add' | 'shop' | 'receipt-review' | 'recipes';
type Language = 'en' | 'zh';

// Translation Dictionary
const translations = {
  en: {
    appTitle: "What's in my fridge",
    cook: "Cook!",
    items: "Items",
    emptyTitle: "Empty...",
    emptyDesc: "The soot sprites stole your food! Add some items.",
    buyDate: "Buy Date",
    expiry: "Expiry",
    daysLeft: "days left",
    dead: "Expired",
    delete: "Toss",
    receiptFound: "Receipt Found",
    purchaseDate: "Purchase Date",
    shelfLife: "Shelf Life (Days)",
    discard: "Discard",
    confirmAll: "Confirm All",
    recipeNo: "Recipe #",
    ingredients: "Ingredients",
    have: "You Have",
    need: "You Need to Buy",
    instructions: "Steps",
    watchVideo: "Watch Video",
    backToFridge: "Back to Fridge",
    newChallenger: "New Item",
    name: "Name",
    type: "Type",
    weight: "Weight",
    prodDate: "Prod. Date",
    expDate: "Exp. Date",
    cancel: "Cancel",
    save: "Save",
    scanning: "Scanning:",
    duplicateFound: "Already in fridge!",
    newItem: "It's new!",
    safeContinue: "Continue",
    captureFood: "Capture Food",
    captureReceipt: "Capture Receipt",
    scanStore: "Scan Store Item",
    fridge: "Fridge",
    add: "Add",
    bill: "Bill",
    scan: "Scan",
    processing: "Thinking...",
    error: "Oh no! Something went wrong.",
    noRecipes: "Fridge is too empty to cook!",
    recipeFail: "Couldn't find recipes.",
    clickToOpen: "Click to Open",
  },
  zh: {
    appTitle: "冰箱里有什么",
    cook: "做饭!",
    items: "物品",
    emptyTitle: "空空如也...",
    emptyDesc: "灰尘精灵偷走了你的食物！快添加一些吧。",
    buyDate: "购买日",
    expiry: "保质期",
    daysLeft: "天剩余",
    dead: "已过期",
    delete: "丢弃",
    receiptFound: "发现小票",
    purchaseDate: "购买日期",
    shelfLife: "保质期 (天)",
    discard: "放弃",
    confirmAll: "确认所有",
    recipeNo: "食谱 #",
    ingredients: "食材",
    have: "已有食材",
    need: "需要购买",
    instructions: "烹饪步骤",
    watchVideo: "观看教程",
    backToFridge: "回冰箱",
    newChallenger: "新物品",
    name: "名称",
    type: "种类",
    weight: "重量",
    prodDate: "生产日期",
    expDate: "过期日期",
    cancel: "取消",
    save: "保存",
    scanning: "正在扫描:",
    duplicateFound: "冰箱里已经有了!",
    newItem: "这是新东西!",
    safeContinue: "继续",
    captureFood: "拍食物",
    captureReceipt: "拍小票",
    scanStore: "扫商品",
    fridge: "我的冰箱",
    add: "添加",
    bill: "账单",
    scan: "扫描",
    processing: "思考中...",
    error: "哎呀！出错了。",
    noRecipes: "冰箱太空了，无法做菜！",
    recipeFail: "无法获取食谱。",
    clickToOpen: "点击打开",
  }
};

const categoryMap: Record<Category, string> = {
  [Category.VEGETABLE]: 'Vegetable',
  [Category.FRUIT]: 'Fruit',
  [Category.MEAT]: 'Meat',
  [Category.DAIRY]: 'Dairy',
  [Category.DRINK]: 'Drink',
  [Category.SNACK]: 'Snack',
  [Category.CONDIMENT]: 'Condiment',
  [Category.OTHER]: 'Other',
};

const categoryMapZh: Record<Category, string> = {
  [Category.VEGETABLE]: '蔬菜',
  [Category.FRUIT]: '水果',
  [Category.MEAT]: '肉类',
  [Category.DAIRY]: '乳制品',
  [Category.DRINK]: '饮品',
  [Category.SNACK]: '零食',
  [Category.CONDIMENT]: '调味品',
  [Category.OTHER]: '其他',
};

// --- Sub Components ---

const SootSprite = ({ delay = 0, style }: { delay?: number, style?: React.CSSProperties }) => (
    <div className="soot-sprite animate-float" style={{ animationDelay: `${delay}s`, ...style }}>
        <div className="eye left"><div className="pupil"></div></div>
        <div className="eye right"><div className="pupil"></div></div>
    </div>
);

export default function App() {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [currentView, setCurrentView] = useState<View>('fridge');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'add' | 'shop' | 'receipt'>('add');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>('en');
  
  // Fridge State
  const [isFridgeOpen, setIsFridgeOpen] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  
  const t = translations[language];

  // Staging state
  const [stagedItem, setStagedItem] = useState<Partial<FoodItem> | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [unitInput, setUnitInput] = useState('g');
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [defaultShelfLife, setDefaultShelfLife] = useState(7);
  const [searchResult, setSearchResult] = useState<{
    foundItem: FoodItem | null;
    scannedNameEn: string;
    scannedNameZh: string;
  } | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('fridgeItems');
    if (saved) setItems(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('fridgeItems', JSON.stringify(items));
  }, [items]);

  const getName = (item: FoodItem) => {
      if (language === 'zh') return item.nameZh || item.name;
      return item.nameEn || item.name;
  };

  const handleCapture = async (base64Images: string[]) => {
    setLoading(true);
    setError(null);
    setIsCameraOpen(false);

    try {
      if (cameraMode === 'add') {
        const data = await analyzeFridgeItem(base64Images); // No lang param needed
        let wNum = '';
        let wUnit = 'g';
        if (data.weight) {
          const match = data.weight.match(/^(\d*\.?\d+)\s*([a-zA-Z]+)$/);
          if (match) { wNum = match[1]; wUnit = match[2].toLowerCase(); }
          else {
             const numMatch = data.weight.match(/^(\d*\.?\d+)$/);
             if (numMatch) wNum = numMatch[1];
          }
        }
        setWeightInput(wNum);
        if (['g', 'kg', 'ml', 'l'].includes(wUnit)) setUnitInput(wUnit);
        else if (wUnit === 'liter') setUnitInput('L');
        else setUnitInput('g');

        setStagedItem({
          name: data.nameEn, // Default to EN for ID purposes
          nameEn: data.nameEn,
          nameZh: data.nameZh,
          category: data.category,
          productionDate: data.productionDate,
          expiryDate: data.expiryDate,
          weight: data.weight, 
          purchaseDate: format(new Date(), 'yyyy-MM-dd'),
          remainingPercentage: 100,
          emoji: getCategoryEmoji(data.category),
        });
        setCurrentView('add');

      } else if (cameraMode === 'receipt') {
        const data = await parseReceipt(base64Images); // No lang param
        setReceiptData({
            date: data.date || format(new Date(), 'yyyy-MM-dd'),
            items: data.items
        });
        setCurrentView('receipt-review');

      } else {
        const data = await identifyShopItem(base64Images);
        const scannedEn = data.nameEn.toLowerCase();
        const scannedZh = data.nameZh.toLowerCase();

        const existing = items.find(item => 
          (item.nameEn && item.nameEn.toLowerCase().includes(scannedEn)) || 
          (item.nameZh && item.nameZh.toLowerCase().includes(scannedZh)) ||
          item.name.toLowerCase().includes(scannedEn)
        );
        setSearchResult({
          foundItem: existing || null,
          scannedNameEn: data.nameEn,
          scannedNameZh: data.nameZh,
        });
        setCurrentView('shop');
      }
    } catch (err) {
      console.error(err);
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  const saveItem = () => {
    if (stagedItem && stagedItem.nameEn && stagedItem.nameZh && stagedItem.category) {
      const finalWeight = weightInput ? `${weightInput}${unitInput}` : undefined;
      const newItem: FoodItem = {
        id: uuidv4(),
        name: stagedItem.nameEn, // Primary
        nameEn: stagedItem.nameEn,
        nameZh: stagedItem.nameZh,
        category: stagedItem.category,
        purchaseDate: stagedItem.purchaseDate || format(new Date(), 'yyyy-MM-dd'),
        remainingPercentage: 100,
        emoji: getCategoryEmoji(stagedItem.category),
        productionDate: stagedItem.productionDate,
        expiryDate: stagedItem.expiryDate,
        weight: finalWeight
      };
      setItems(prev => [...prev, newItem]);
      setStagedItem(null);
      setCurrentView('fridge');
    }
  };

  const saveReceiptItems = () => {
    if (!receiptData) return;
    const newItems: FoodItem[] = receiptData.items.map(item => {
        const purchaseDate = receiptData.date || format(new Date(), 'yyyy-MM-dd');
        const expiryDate = format(addDays(parseISO(purchaseDate), defaultShelfLife), 'yyyy-MM-dd');
        
        return {
            id: uuidv4(),
            name: item.nameEn,
            nameEn: item.nameEn,
            nameZh: item.nameZh,
            category: item.category,
            purchaseDate: purchaseDate,
            productionDate: undefined,
            expiryDate: expiryDate,
            weight: item.quantity,
            remainingPercentage: 100,
            emoji: getCategoryEmoji(item.category)
        };
    });
    setItems(prev => [...prev, ...newItems]);
    setReceiptData(null);
    setCurrentView('fridge');
  };

  const updateConsumption = (id: string, newPercentage: number) => {
    if (newPercentage <= 0) {
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

  const handleGetRecipes = async () => {
    setLoading(true);
    setCurrentView('recipes');
    setRecipes([]);

    try {
        const expiringItems = items
            .filter(item => {
                const days = getDaysUntilExpiry(item.expiryDate);
                return days !== null && days <= 3 && days >= 0; 
            })
            .sort((a, b) => {
                 const da = getDaysUntilExpiry(a.expiryDate) || 999;
                 const db = getDaysUntilExpiry(b.expiryDate) || 999;
                 return da - db;
            });

        // Use localized names for recipe search prompt
        let ingredients = expiringItems.map(i => language === 'zh' ? (i.nameZh || i.name) : (i.nameEn || i.name));
        if (ingredients.length < 2) {
             const others = items.filter(i => !ingredients.includes(language === 'zh' ? (i.nameZh || i.name) : (i.nameEn || i.name)))
                                  .slice(0, 3)
                                  .map(i => language === 'zh' ? (i.nameZh || i.name) : (i.nameEn || i.name));
             ingredients = [...ingredients, ...others];
        }
        
        if (ingredients.length === 0) {
            setError(t.noRecipes);
            setLoading(false);
            setCurrentView('fridge');
            return;
        }

        const suggestedRecipes = await suggestRecipes(ingredients, language);
        
        // Optimistic UI update - if search returned images, use them, otherwise mark as loading
        setRecipes(suggestedRecipes.map(r => ({ 
            ...r, 
            imageLoading: !r.imageUrl // Load if no image returned
        })));
        setLoading(false);

        // Fallback generation for recipes with no search image
        suggestedRecipes.forEach(async (recipe, index) => {
            if (!recipe.imageUrl) {
                const imgUrl = await generateRecipeImage(recipe.name, recipe.description);
                setRecipes(prev => prev.map((r, i) => 
                    i === index ? { ...r, imageUrl: imgUrl, imageLoading: false } : r
                ));
            }
        });

    } catch (e) {
        console.error(e);
        setError(t.recipeFail);
        setLoading(false);
        setCurrentView('fridge');
    }
  };

  const openFridge = () => {
      setIsOpening(true);
      setTimeout(() => {
          setIsFridgeOpen(true);
      }, 1400); // Wait for animation
  };

  if (!isFridgeOpen) {
      return (
          <div className="min-h-screen bg-totoro-bg flex items-center justify-center overflow-hidden relative perspective-1000">
               {/* Background Elements */}
               <SootSprite style={{ top: '10%', left: '10%' }} delay={0} />
               <SootSprite style={{ top: '20%', right: '15%' }} delay={1} />
               <SootSprite style={{ bottom: '15%', left: '20%' }} delay={2} />
               
               {/* Totoro Placeholder (CSS Art or URL) */}
               <div className="absolute bottom-0 right-[-20px] w-48 h-64 opacity-80 pointer-events-none z-0">
                  {/* Simple CSS Totoro Silhouette */}
                  <div className="w-full h-full bg-totoro-grey rounded-t-[100px] rounded-b-[40px] relative">
                       <div className="absolute top-10 left-8 w-8 h-8 bg-white rounded-full"><div className="w-2 h-2 bg-black rounded-full absolute top-3 left-3"></div></div>
                       <div className="absolute top-10 right-8 w-8 h-8 bg-white rounded-full"><div className="w-2 h-2 bg-black rounded-full absolute top-3 left-3"></div></div>
                       <div className="absolute top-[80px] left-[50%] translate-x-[-50%] w-6 h-3 bg-black rounded-full opacity-60"></div>
                       <div className="absolute bottom-4 left-[50%] translate-x-[-50%] w-32 h-36 bg-totoro-belly rounded-full flex flex-col items-center pt-4">
                           <span className="text-totoro-grey text-xl">^ ^ ^</span>
                           <span className="text-totoro-grey text-xl mt-[-10px]">^ ^ ^</span>
                       </div>
                  </div>
               </div>

               {/* The Fridge Container */}
               <div 
                  className="relative w-80 h-[500px] cursor-pointer group perspective-1000"
                  onClick={openFridge}
                >
                   {/* Shadow */}
                   <div className="absolute -bottom-10 left-4 w-[90%] h-10 bg-black/20 blur-xl rounded-full"></div>

                   {/* Fridge Body (Inner visible after open, but here primarily acts as frame) */}
                   <div className="w-full h-full bg-ginger-dark rounded-3xl relative flex flex-col p-2">
                       {/* Top Door */}
                       <div className={`
                          fridge-door relative w-full h-[35%] bg-ginger-yellow rounded-t-2xl rounded-b-md shadow-lg border-b-4 border-ginger-dark/20 z-20 mb-1
                          ${isOpening ? 'door-open-top' : ''}
                       `}>
                           <div className="absolute top-1/2 right-4 w-3 h-16 bg-gray-100 rounded-full shadow-md border-l-2 border-gray-300"></div>
                           <div className="absolute top-4 left-4 text-ginger-dark/30 font-display font-bold text-xl rotate-[-5deg]">Satsuki</div>
                       </div>

                       {/* Bottom Door */}
                       <div className={`
                          fridge-door relative w-full h-[64%] bg-ginger-yellow rounded-t-md rounded-b-2xl shadow-lg z-10
                          ${isOpening ? 'door-open-bottom' : ''}
                       `}>
                            <div className="absolute top-8 right-4 w-3 h-24 bg-gray-100 rounded-full shadow-md border-l-2 border-gray-300"></div>
                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-ginger-dark/30 font-display font-bold">
                                {t.clickToOpen}
                            </div>
                            
                            {/* Decorative stickers */}
                            <div className="absolute bottom-20 left-8 text-2xl rotate-12 opacity-80">🌽</div>
                            <div className="absolute top-20 left-10 text-2xl -rotate-12 opacity-80">🍄</div>
                       </div>
                   </div>
               </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen pb-32 font-body text-gray-800 relative selection:bg-leaf-green selection:text-white animate-fade-in">
      
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/60 backdrop-blur-md px-6 py-4 flex justify-between items-center shadow-soft mb-6 rounded-b-3xl mx-2 mt-2 border border-white/40">
         <div className="flex flex-col">
            <h1 className="text-2xl font-display font-bold text-forest-green tracking-tight flex items-center gap-2">
               <span>🍃</span> {t.appTitle}
            </h1>
         </div>
         <button 
           onClick={() => setLanguage(l => l === 'en' ? 'zh' : 'en')}
           className="bg-white/80 border border-gray-200 px-3 py-1 rounded-full text-xs font-bold shadow-sm hover:bg-white transition-colors"
         >
           {language === 'en' ? '中文' : 'English'}
         </button>
      </header>

      {/* Main Content */}
      <main className="px-4 max-w-2xl mx-auto relative z-0">
        
        {loading && (
          <div className="fixed inset-0 bg-forest-green/20 backdrop-blur-sm z-50 flex items-center justify-center">
            <RetroCard className="animate-bounce flex flex-col items-center p-8" color="white">
              <span className="text-6xl mb-4 animate-spin">🌰</span>
              <span className="text-xl font-display text-forest-green">{t.processing}</span>
            </RetroCard>
          </div>
        )}

        {error && (
          <RetroCard color="red" className="mb-6 flex justify-between items-center">
            <p className="font-bold text-lg">{error}</p>
            <button onClick={() => setError(null)} className="ml-4 bg-white/50 px-3 py-1 rounded-full text-sm">OK</button>
          </RetroCard>
        )}

        {/* View: Fridge Inventory */}
        {currentView === 'fridge' && (
          <>
             <div className="flex justify-between items-end mb-6">
                 <div className="bg-white/80 px-4 py-2 rounded-2xl shadow-sm text-forest-green font-bold text-sm border border-gray-100 backdrop-blur-sm">
                    🌱 {t.items}: {items.length}
                 </div>
                 <button 
                  onClick={handleGetRecipes}
                  className="bg-ginger-yellow text-white px-6 py-3 rounded-full font-display font-bold shadow-soft hover:shadow-soft-lg active:scale-95 transition-all flex items-center gap-2 border-2 border-white/30"
                >
                    <span>🍳</span> {t.cook}
                </button>
             </div>

            <div className="grid grid-cols-1 gap-4">
              {items.length === 0 ? (
                <div className="col-span-full text-center py-20 bg-white/40 backdrop-blur-sm rounded-3xl border-2 border-dashed border-gray-300/50">
                  <span className="text-6xl opacity-50 block mb-4">👻</span>
                  <p className="text-xl font-display text-totoro-grey">{t.emptyTitle}</p>
                  <p className="text-gray-500 mt-2">{t.emptyDesc}</p>
                </div>
              ) : (
                items
                .sort((a, b) => (getDaysUntilExpiry(a.expiryDate) || 999) - (getDaysUntilExpiry(b.expiryDate) || 999))
                .map((item) => {
                  const daysLeft = getDaysUntilExpiry(item.expiryDate);
                  const isExpired = daysLeft !== null && daysLeft < 0;
                  const isUrgent = daysLeft !== null && daysLeft <= 3 && daysLeft >= 0;
                  const displayName = getName(item);

                  return (
                    <RetroCard key={item.id} className="relative group overflow-hidden" color="white">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-4">
                          <div className="text-4xl bg-totoro-bg rounded-2xl w-14 h-14 flex items-center justify-center shadow-inner-soft">
                            {item.emoji}
                          </div>
                          <div>
                            <h3 className="font-display text-xl font-bold text-gray-800">{displayName}</h3>
                            <span className="text-xs font-bold uppercase tracking-wider text-totoro-grey bg-gray-100 px-2 py-1 rounded-lg">
                                {language === 'zh' ? categoryMapZh[item.category] : categoryMap[item.category]}
                            </span>
                          </div>
                        </div>
                        {item.weight && (
                            <span className="text-xs bg-leaf-green/20 text-forest-green px-3 py-1 rounded-full font-bold">
                                {item.weight}
                            </span>
                        )}
                      </div>

                      <div className="flex gap-4 my-3 text-sm">
                         <div className="flex flex-col">
                           <span className="text-xs text-gray-400 uppercase">{t.buyDate}</span>
                           <span className="font-bold text-gray-600">{item.purchaseDate}</span>
                         </div>
                         {item.expiryDate && (
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-400 uppercase">{t.expiry}</span>
                                <span className={`font-bold ${isExpired ? 'text-red-500' : isUrgent ? 'text-orange-500' : 'text-gray-600'}`}>
                                    {isExpired ? t.dead : `${daysLeft} ${t.daysLeft}`}
                                </span>
                            </div>
                         )}
                      </div>

                      {/* HP Bar */}
                      <div className="mt-4 bg-gray-100 rounded-full h-3 w-full overflow-hidden flex cursor-pointer">
                          <div 
                            className="bg-leaf-green h-full transition-all duration-500" 
                            style={{width: `${item.remainingPercentage}%`}}
                          ></div>
                      </div>
                      
                      <div className="flex justify-between mt-2">
                         <div className="flex gap-1">
                            {[25, 50, 75, 100].map(pct => (
                                <button 
                                    key={pct}
                                    onClick={() => updateConsumption(item.id, pct)}
                                    className={`w-6 h-6 rounded-full text-[10px] flex items-center justify-center transition-colors ${item.remainingPercentage >= pct ? 'bg-forest-green text-white' : 'bg-gray-200 text-gray-400'}`}
                                >
                                    {pct}
                                </button>
                            ))}
                         </div>
                         <button onClick={() => updateConsumption(item.id, 0)} className="text-xs text-red-400 hover:text-red-600 font-bold px-2 py-1">
                            ✕ {t.delete}
                         </button>
                      </div>
                    </RetroCard>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* View: Receipt Review */}
        {currentView === 'receipt-review' && receiptData && (
            <div className="animate-fade-in">
                <RetroCard color="cream" className="mb-4">
                    <h2 className="text-xl font-display mb-6 text-center text-forest-green">🧾 {t.receiptFound}</h2>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t.purchaseDate}</label>
                            <input 
                                type="date"
                                value={receiptData.date || ''}
                                onChange={(e) => setReceiptData({...receiptData, date: e.target.value})}
                                className="w-full bg-white border-none rounded-xl p-3 shadow-inner-soft text-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t.shelfLife}</label>
                            <input 
                                type="number"
                                value={defaultShelfLife}
                                onChange={(e) => setDefaultShelfLife(parseInt(e.target.value) || 0)}
                                className="w-full bg-white border-none rounded-xl p-3 shadow-inner-soft text-lg"
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-4 max-h-[40vh] overflow-y-auto mb-6 shadow-inner-soft space-y-2">
                        {receiptData.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">{getCategoryEmoji(item.category)}</span>
                                    <div>
                                        <div className="font-bold text-gray-800">
                                            {language === 'zh' ? item.nameZh : item.nameEn}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            {language === 'zh' ? categoryMapZh[item.category] : categoryMap[item.category]} 
                                            {item.quantity ? ` • ${item.quantity}` : ''}
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setReceiptData({...receiptData, items: receiptData.items.filter((_, i) => i !== idx)})}
                                    className="text-red-400 hover:bg-red-50 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-4">
                        <button onClick={() => setCurrentView('fridge')} className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-600 font-bold text-sm">{t.discard}</button>
                        <button onClick={saveReceiptItems} className="flex-1 py-3 rounded-xl bg-forest-green text-white font-bold text-sm shadow-soft hover:shadow-soft-lg transition-all">{t.confirmAll}</button>
                    </div>
                </RetroCard>
            </div>
        )}

        {/* View: Recipes */}
        {currentView === 'recipes' && (
            <div className="animate-fade-in space-y-8">
                 {recipes.map((recipe, idx) => (
                     <RetroCard key={idx} color="white" className="relative overflow-visible">
                         <div className="absolute -top-3 -right-3 bg-catbus-orange text-white text-xs font-bold px-3 py-1 rounded-full shadow-soft rotate-3">
                             {t.recipeNo} {idx + 1}
                         </div>
                         
                         {/* Cover Image */}
                         <div className="w-full h-56 bg-gray-100 rounded-2xl mb-6 flex items-center justify-center overflow-hidden shadow-inner-soft relative group">
                             {recipe.imageLoading ? (
                                 <div className="text-gray-400 font-display text-sm animate-pulse text-center">
                                     🎨 {t.processing}
                                 </div>
                             ) : recipe.imageUrl ? (
                                 <img 
                                    src={recipe.imageUrl} 
                                    alt={recipe.name} 
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                                    onError={(e) => {
                                        // Hide broken images from search
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                             ) : (
                                 <div className="text-gray-300">NO IMAGE</div>
                             )}
                         </div>

                         <h2 className="text-2xl font-display font-bold text-forest-green mb-2">{recipe.name}</h2>
                         <p className="text-gray-600 italic text-lg mb-6 border-l-4 border-catbus-orange pl-4">{recipe.description}</p>
                         
                         {/* Ingredients Section */}
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                            <div className="bg-green-50 p-3 rounded-xl">
                                <h3 className="font-bold text-xs uppercase text-green-700 mb-2 tracking-wider">✅ {t.have}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {recipe.ingredientsUsed.map((ing, i) => (
                                        <span key={i} className="text-sm font-bold text-green-800 bg-white px-2 py-1 rounded border border-green-200">
                                            {ing}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-orange-50 p-3 rounded-xl">
                                <h3 className="font-bold text-xs uppercase text-orange-700 mb-2 tracking-wider">🛒 {t.need}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {recipe.missingIngredients.map((ing, i) => (
                                        <span key={i} className="text-sm font-bold text-orange-800 bg-white px-2 py-1 rounded border border-orange-200">
                                            {ing}
                                        </span>
                                    ))}
                                    {recipe.missingIngredients.length === 0 && (
                                        <span className="text-sm text-gray-400 italic">None!</span>
                                    )}
                                </div>
                            </div>
                         </div>

                         {/* Steps */}
                         <div className="mb-6">
                             <h3 className="font-bold text-xs uppercase text-gray-400 mb-3 tracking-wider">{t.instructions}</h3>
                             <ol className="list-decimal list-inside space-y-2 text-gray-700 text-lg">
                                {recipe.instructions.map((step, i) => (
                                    <li key={i} className="leading-relaxed pl-2">
                                        {/* Strip leading numbers/bullets like "1.", "Step 1" to avoid "1. 1." */}
                                        {step.replace(/^[\d\.\s]+|^(Step\s\d+[:.]\s*)/i, '')}
                                    </li>
                                ))}
                             </ol>
                         </div>

                         {/* Video Links */}
                         {recipe.videoLinks && recipe.videoLinks.length > 0 && (
                             <div className="border-t border-gray-100 pt-4">
                                 {recipe.videoLinks.map((link, i) => (
                                     <a 
                                        key={i} 
                                        href={link.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="block w-full text-center bg-red-400 hover:bg-red-500 text-white font-bold py-3 rounded-xl shadow-soft transition-colors mb-2"
                                     >
                                        📺 {t.watchVideo} ({link.platform})
                                     </a>
                                 ))}
                             </div>
                         )}
                     </RetroCard>
                 ))}
                 
                 <button onClick={() => setCurrentView('fridge')} className="w-full py-4 rounded-full bg-totoro-grey text-white font-bold text-lg shadow-soft hover:shadow-soft-lg transition-all">
                     {t.backToFridge}
                 </button>
            </div>
        )}

        {/* View: Add Item Form */}
        {currentView === 'add' && stagedItem && (
          <div className="animate-fade-in">
             <div className="text-center mb-6">
                <span className="text-4xl animate-bounce inline-block">🌱</span>
                <h2 className="text-2xl font-display font-bold text-forest-green">{t.newChallenger}</h2>
             </div>
             
             <RetroCard color="white" className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{t.name}</label>
                  <input 
                    type="text" 
                    value={language === 'zh' ? stagedItem.nameZh : stagedItem.nameEn} 
                    onChange={(e) => {
                         if (language === 'zh') setStagedItem({...stagedItem, nameZh: e.target.value});
                         else setStagedItem({...stagedItem, nameEn: e.target.value});
                    }}
                    className="w-full bg-totoro-bg border-none rounded-xl p-4 text-xl font-bold text-forest-green shadow-inner-soft focus:ring-2 focus:ring-forest-green outline-none"
                  />
                  {/* Hidden field for secondary language to allow manual editing if desired, currently simplified */}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{t.type}</label>
                    <select 
                      value={stagedItem.category} 
                      onChange={(e) => setStagedItem({...stagedItem, category: e.target.value as Category, emoji: getCategoryEmoji(e.target.value as Category)})}
                      className="w-full bg-gray-50 border-none rounded-xl p-3 text-lg text-gray-700 shadow-sm"
                    >
                      {Object.values(Category).map(c => (
                        <option key={c} value={c}>
                            {language === 'zh' ? categoryMapZh[c] : categoryMap[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{t.weight}</label>
                    <div className="flex gap-2">
                        <input 
                        type="number" 
                        value={weightInput} 
                        onChange={(e) => setWeightInput(e.target.value)}
                        className="w-full bg-gray-50 border-none rounded-xl p-3 text-lg text-gray-700 shadow-sm"
                        placeholder="0"
                        />
                        <select
                            value={unitInput}
                            onChange={(e) => setUnitInput(e.target.value)}
                            className="bg-gray-100 rounded-xl px-2 text-sm font-bold text-gray-500"
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
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{t.prodDate}</label>
                    <input 
                      type="date" 
                      value={stagedItem.productionDate || ''} 
                      onChange={(e) => setStagedItem({...stagedItem, productionDate: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-xl p-3 text-gray-700 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{t.expDate}</label>
                    <input 
                      type="date" 
                      value={stagedItem.expiryDate || ''} 
                      onChange={(e) => setStagedItem({...stagedItem, expiryDate: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-xl p-3 text-gray-700 shadow-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button onClick={() => setCurrentView('fridge')} className="flex-1 py-4 rounded-2xl bg-gray-100 text-gray-500 font-bold hover:bg-gray-200 transition-colors">{t.cancel}</button>
                  <button onClick={saveItem} className="flex-1 py-4 rounded-2xl bg-forest-green text-white font-bold shadow-soft hover:shadow-soft-lg hover:translate-y-[-2px] transition-all">{t.save}</button>
                </div>
             </RetroCard>
          </div>
        )}

        {/* View: Shopping Result */}
        {currentView === 'shop' && searchResult && (
           <div className="animate-fade-in flex flex-col items-center">
             <div className="text-6xl mb-6 animate-bounce">{searchResult.foundItem ? '🤔' : '✨'}</div>
             <h2 className="text-xl font-display mb-6 text-center text-forest-green">
               {t.scanning} <br/><span className="text-3xl">{language === 'zh' ? searchResult.scannedNameZh : searchResult.scannedNameEn}</span>
             </h2>

             {searchResult.foundItem ? (
               <RetroCard color="yellow" className="w-full mb-6">
                 <h3 className="text-lg font-bold mb-4 text-center pb-2 border-b border-yellow-200">{t.duplicateFound}</h3>
                 <div className="bg-white/50 rounded-xl p-4">
                    <p className="mb-2"><strong>{t.name}:</strong> {getName(searchResult.foundItem)}</p>
                    <p className="mb-2"><strong>{t.buyDate}:</strong> {searchResult.foundItem.purchaseDate}</p>
                    <p><strong>{t.expiry}:</strong> {getDaysUntilExpiry(searchResult.foundItem.expiryDate)} {t.daysLeft}</p>
                 </div>
               </RetroCard>
             ) : (
               <RetroCard color="green" className="w-full mb-6">
                 <h3 className="text-xl font-bold text-center mb-2">{t.newItem}</h3>
                 <p className="text-center opacity-80">{t.safeContinue}</p>
               </RetroCard>
             )}
             <button onClick={() => { setSearchResult(null); setCurrentView('fridge'); }} className="bg-forest-green text-white font-bold py-4 px-10 rounded-full shadow-soft hover:shadow-soft-lg transition-all">{t.safeContinue}</button>
           </div>
        )}

      </main>

      {/* Camera Overlay */}
      {isCameraOpen && (
        <Camera 
          label={cameraMode === 'add' ? t.captureFood : cameraMode === 'receipt' ? t.captureReceipt : t.scanStore}
          onCapture={handleCapture}
          onClose={() => setIsCameraOpen(false)}
        />
      )}

      {/* Sticky Bottom Nav (Floating) */}
      <nav className="fixed bottom-6 left-6 right-6 bg-white/80 backdrop-blur-md rounded-full shadow-soft-lg p-2 flex justify-between items-center z-40 border border-white/50">
         <button 
           onClick={() => setCurrentView('fridge')}
           className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-full transition-all ${currentView === 'fridge' ? 'text-forest-green bg-green-50' : 'text-gray-400 hover:text-gray-600'}`}
         >
           <span className="text-2xl">❄️</span>
           <span className="text-[10px] font-bold uppercase">{t.fridge}</span>
         </button>

         <div className="flex gap-2 mx-2">
            <button 
                onClick={() => { setCameraMode('add'); setIsCameraOpen(true); }}
                className="bg-forest-green text-white w-14 h-14 rounded-full flex items-center justify-center shadow-soft hover:scale-105 transition-all group relative border-4 border-white"
            >
                <span className="text-2xl">🍎</span>
                <span className="absolute -bottom-6 text-[10px] font-bold text-gray-500 bg-white/80 px-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{t.add}</span>
            </button>
            <button 
                onClick={() => { setCameraMode('receipt'); setIsCameraOpen(true); }}
                className="bg-catbus-orange text-white w-14 h-14 rounded-full flex items-center justify-center shadow-soft hover:scale-105 transition-all group relative border-4 border-white"
            >
                <span className="text-2xl">🧾</span>
                <span className="absolute -bottom-6 text-[10px] font-bold text-gray-500 bg-white/80 px-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{t.bill}</span>
            </button>
         </div>

         <button 
           onClick={() => {
              setCameraMode('shop');
              setIsCameraOpen(true);
           }}
           className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-full transition-all ${currentView === 'shop' ? 'text-catbus-orange bg-orange-50' : 'text-gray-400 hover:text-gray-600'}`}
         >
           <span className="text-2xl">🛒</span>
           <span className="text-[10px] font-bold uppercase">{t.scan}</span>
         </button>
      </nav>
    </div>
  );
}