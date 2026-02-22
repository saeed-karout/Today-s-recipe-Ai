import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  Plus,
  X,
  ChefHat,
  Clock,
  Flame,
  AlertTriangle,
  Globe,
  Languages,
  Loader2,
  UtensilsCrossed,
  Image as ImageIcon,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Language = 'ar' | 'en';

interface Recipe {
  recipeName: string;
  origin: string;
  cuisineType: string;
  prepTime: string;
  cookTime: string;
  difficulty: string;
  ingredients: string[];
  instructions: string[];
  chefTips?: string;
  detectedIngredients?: string[];
}

const translations = {
  ar: {
    title: '🧑‍🍳 مطبخ الشرق والغرب',
    subtitle: 'توليد وصفات ذكية باستخدام الذكاء الاصطناعي',
    warning: '⛔ ممنوع: كوري، تركي، صيني، ياباني، آسيوي',
    imageSection: 'تحليل الصور (المكونات)',
    imagePlaceholder: 'اسحب الصورة هنا أو انقر للتصوير/الاختيار',
    analyzeBtn: 'تحليل الصورة وتوليد وصفة',
    or: 'أو',
    textSection: 'الإدخال النصي للمكونات',
    cuisineLabel: 'نوع المطبخ المفضل:',
    middleEastern: 'شرق أوسطي',
    westernFast: 'غربي سريع',
    ingredientPlaceholder: 'أضف مكوناً (مثلاً: دجاج، أرز...)',
    addBtn: 'إضافة',
    generateBtn: 'توليد وصفة ذكية',
    detectedTitle: 'المكونات المكتشفة في الصورة:',
    recipeTitle: 'الوصفة المقترحة',
    originLabel: 'المنشأ:',
    difficultyLabel: 'الصعوبة:',
    prepLabel: 'التحضير:',
    cookLabel: 'الطهي:',
    ingredientsLabel: 'المكونات:',
    instructionsLabel: 'خطوات التحضير:',
    tipsLabel: 'نصائح الشيف:',
    footerNote: 'هذا التطبيق مخصص فقط للمطابخ الشرق أوسطية والغربية السريعة.',
    errorTitle: 'عذراً، حدث خطأ',
    noIngredients: 'يرجى إضافة مكونات أولاً',
    noImage: 'يرجى اختيار صورة أولاً',
  },
  en: {
    title: '🧑‍🍳 East & West Kitchen',
    subtitle: 'Smart AI-Powered Recipe Generator',
    warning: '⛔ Forbidden: Korean, Turkish, Chinese, Japanese, Asian',
    imageSection: 'Image Analysis (Ingredients)',
    imagePlaceholder: 'Drag image here or click to capture/select',
    analyzeBtn: 'Analyze Image & Generate Recipe',
    or: 'OR',
    textSection: 'Text Ingredient Input',
    cuisineLabel: 'Preferred Cuisine:',
    middleEastern: 'Middle Eastern',
    westernFast: 'Western Fast Food',
    ingredientPlaceholder: 'Add ingredient (e.g., chicken, rice...)',
    addBtn: 'Add',
    generateBtn: 'Generate Smart Recipe',
    detectedTitle: 'Ingredients Detected in Image:',
    recipeTitle: 'Suggested Recipe',
    originLabel: 'Origin:',
    difficultyLabel: 'Difficulty:',
    prepLabel: 'Prep:',
    cookLabel: 'Cook:',
    ingredientsLabel: 'Ingredients:',
    instructionsLabel: 'Instructions:',
    tipsLabel: 'Chef\'s Tips:',
    footerNote: 'This app is strictly for Middle Eastern and Western Fast Food cuisines.',
    errorTitle: 'Sorry, an error occurred',
    noIngredients: 'Please add ingredients first',
    noImage: 'Please select an image first',
  }
};

export default function App() {
  const [lang, setLang] = useState<Language>('ar');
  const [cuisine, setCuisine] = useState('Middle Eastern');
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[lang];
  const isRtl = lang === 'ar';

  useEffect(() => {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang, isRtl]);

  const handleAddIngredient = () => {
    if (currentInput.trim()) {
      setIngredients([...ingredients, currentInput.trim()]);
      setCurrentInput('');
    }
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setRecipe(null);
      setError(null);
    }
  };

  const handleGenerateText = async () => {
    if (ingredients.length === 0) {
      setError(t.noIngredients);
      return;
    }
    setLoading(true);
    setError(null);
    setRecipe(null);
    try {
      const response = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients, cuisineType: cuisine, language: lang }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setRecipe(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeImage = async () => {
    if (!image) {
      setError(t.noImage);
      return;
    }
    setLoading(true);
    setError(null);
    setRecipe(null);
    try {
      const formData = new FormData();
      formData.append('image', image);
      formData.append('language', lang);
      formData.append('cuisineType', cuisine);

      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setRecipe(data);
      if (data.detectedIngredients) {
        setIngredients(prev => [...new Set([...prev, ...data.detectedIngredients])]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-min-h-screen bg-gradient-to-br from-[#667eea] to-[#f093fb] text-slate-900 font-sans selection:bg-pink-200">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-pink-300/20 rounded-full blur-3xl animate-pulse delay-700" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <header className="text-center mb-12">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="inline-block p-3 bg-white/20 backdrop-blur-md rounded-2xl mb-4 border border-white/30"
          >
            <ChefHat className="w-12 h-12 text-white" />
          </motion.div>
          <motion.h1
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-4xl md:text-5xl font-bold text-white mb-2 drop-shadow-lg"
          >
            {t.title}
          </motion.h1>
          <p className="text-white/80 text-lg mb-4">{t.subtitle}</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-full text-red-100 text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            {t.warning}
          </div>
        </header>

        {/* Language Switcher */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/20 backdrop-blur-md p-1 rounded-xl border border-white/30 flex gap-1">
            <button
              onClick={() => setLang('ar')}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${lang === 'ar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-white hover:bg-white/10'}`}
            >
              <Languages className="w-4 h-4" />
              العربية
            </button>
            <button
              onClick={() => setLang('en')}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${lang === 'en' ? 'bg-white text-indigo-600 shadow-sm' : 'text-white hover:bg-white/10'}`}
            >
              <Globe className="w-4 h-4" />
              English
            </button>
          </div>
        </div>

        <main className="space-y-8">
          {/* Image Upload Section */}
          <section className="bg-white/30 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/40 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <ImageIcon className="w-6 h-6" />
              {t.imageSection}
            </h2>

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all hover:bg-white/10 ${imagePreview ? 'border-white/60' : 'border-white/40'}`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                className="hidden"
              />

              {imagePreview ? (
                <div className="relative group">
                  <img src={imagePreview} alt="Preview" className="max-h-64 mx-auto rounded-xl shadow-lg" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                    <Camera className="w-10 h-10 text-white" />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                    <Upload className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-white font-medium">{t.imagePlaceholder}</p>
                </div>
              )}
            </div>

            <button
              onClick={handleAnalyzeImage}
              disabled={loading || !image}
              className="w-full mt-6 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-2xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <UtensilsCrossed className="w-6 h-6" />}
              {t.analyzeBtn}
            </button>
          </section>

          {/* Divider */}
          <div className="flex items-center gap-4 py-4">
            <div className="flex-1 h-px bg-white/30" />
            <span className="text-white font-bold text-lg">{t.or}</span>
            <div className="flex-1 h-px bg-white/30" />
          </div>

          {/* Text Input Section */}
          <section className="bg-white/30 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/40 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Plus className="w-6 h-6" />
              {t.textSection}
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-white font-medium mb-2">{t.cuisineLabel}</label>
                <select
                  value={cuisine}
                  onChange={(e) => setCuisine(e.target.value)}
                  className="w-full bg-white/20 backdrop-blur-md border border-white/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  <option value="Middle Eastern" className="text-slate-900">{t.middleEastern}</option>
                  <option value="Western Fast Food" className="text-slate-900">{t.westernFast}</option>
                </select>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddIngredient()}
                  placeholder={t.ingredientPlaceholder}
                  className="flex-1 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl px-4 py-3 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                />
                <button
                  onClick={handleAddIngredient}
                  className="bg-white text-indigo-600 p-3 rounded-xl hover:bg-indigo-50 transition-colors"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <AnimatePresence>
                  {ingredients.map((ing, idx) => (
                    <motion.span
                      key={`${ing}-${idx}`}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="bg-white/20 backdrop-blur-md border border-white/30 text-white px-3 py-1.5 rounded-full text-sm flex items-center gap-2"
                    >
                      {ing}
                      <button onClick={() => removeIngredient(idx)} className="hover:text-red-300">
                        <X className="w-4 h-4" />
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>

              <button
                onClick={handleGenerateText}
                disabled={loading || ingredients.length === 0}
                className="w-full py-4 bg-pink-500 hover:bg-pink-600 disabled:bg-pink-400 text-white rounded-2xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ChefHat className="w-6 h-6" />}
                {t.generateBtn}
              </button>
            </div>
          </section>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="bg-red-500/20 backdrop-blur-md border border-red-500/30 p-4 rounded-2xl text-red-100 flex items-center gap-3"
              >
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <div>
                  <p className="font-bold">{t.errorTitle}</p>
                  <p className="text-sm opacity-90">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Recipe Result */}
          <AnimatePresence>
            {recipe && (
              <motion.section
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl text-slate-800"
              >
                {recipe.detectedIngredients && recipe.detectedIngredients.length > 0 && (
                  <div className="mb-8 p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
                    <h3 className="text-indigo-900 font-bold mb-3 flex items-center gap-2">
                      <ImageIcon className="w-5 h-5" />
                      {t.detectedTitle}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {recipe.detectedIngredients.map((ing, i) => (
                        <span key={i} className="bg-white px-3 py-1 rounded-full text-sm text-indigo-700 shadow-sm border border-indigo-100">
                          {ing}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div>
                    <h2 className="text-3xl md:text-4xl font-black text-indigo-900 mb-2">{recipe.recipeName}</h2>
                    <div className="flex flex-wrap gap-3">
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-bold">
                        {recipe.cuisineType}
                      </span>
                      <span className="px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-sm font-bold">
                        {t.originLabel} {recipe.origin}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-1">
                        <Flame className="w-6 h-6 text-orange-500" />
                      </div>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{t.difficultyLabel}</p>
                      <p className="font-bold text-slate-700">{recipe.difficulty}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-10">
                  <div className="bg-slate-50 p-4 rounded-3xl flex items-center gap-3">
                    <Clock className="w-6 h-6 text-indigo-500" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{t.prepLabel}</p>
                      <p className="font-bold">{recipe.prepTime}</p>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-3xl flex items-center gap-3">
                    <Flame className="w-6 h-6 text-pink-500" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{t.cookLabel}</p>
                      <p className="font-bold">{recipe.cookTime}</p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-12">
                  <div className="md:col-span-1">
                    <h3 className="text-xl font-bold text-indigo-900 mb-6 pb-2 border-b-2 border-indigo-100">
                      {t.ingredientsLabel}
                    </h3>
                    <ul className="space-y-4">
                      {recipe.ingredients.map((ing, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-pink-400 mt-2 shrink-0" />
                          <span className="text-slate-600 font-medium">{ing}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="md:col-span-2">
                    <h3 className="text-xl font-bold text-indigo-900 mb-6 pb-2 border-b-2 border-indigo-100">
                      {t.instructionsLabel}
                    </h3>
                    <div className="space-y-6">
                      {recipe.instructions.map((step, i) => (
                        <div key={i} className="flex gap-4">
                          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold shrink-0">
                            {i + 1}
                          </span>
                          <p className="text-slate-600 leading-relaxed pt-1">{step}</p>
                        </div>
                      ))}
                    </div>

                    {recipe.chefTips && (
                      <div className="mt-10 p-6 bg-amber-50 rounded-3xl border border-amber-100">
                        <h4 className="text-amber-900 font-bold mb-2 flex items-center gap-2">
                          <ChefHat className="w-5 h-5" />
                          {t.tipsLabel}
                        </h4>
                        <p className="text-amber-800 italic leading-relaxed">{recipe.chefTips}</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </main>

        <footer className="mt-16 text-center text-white/60 text-sm">
          <p className="mb-2">{t.footerNote}</p>
          <p>© {new Date().getFullYear()} {t.title}</p>
        </footer>
      </div>
    </div>
  );
}
