// components/UnderConstruction.tsx

import React from 'react';
import { motion } from 'framer-motion';
import { Construction, Hammer, Clock, Sparkles } from 'lucide-react';

interface UnderConstructionProps {
  title?: string;
  message?: string;
  expectedDate?: string;
  className?: string;
}

const UnderConstruction: React.FC<UnderConstructionProps> = ({
  title = "جاري التطوير",
  message = "سوف يتم عرض التصميم الجديد قريباً بشكل احترافي",
  expectedDate,
  className = "",
}) => {
  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-950 flex items-center justify-center p-6 ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-2xl w-full text-center space-y-8"
      >
        {/* الأيقونة المتحركة */}
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
          className="inline-flex items-center justify-center w-24 h-24 mx-auto bg-amber-500/10 rounded-full border border-amber-500/30 backdrop-blur-sm"
        >
          <Construction className="w-12 h-12 text-amber-400" />
        </motion.div>

        {/* العنوان */}
        <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400">
            {title}
          </span>
        </h1>

        {/* الرسالة */}
        <p className="text-xl md:text-2xl text-gray-300 leading-relaxed max-w-3xl mx-auto">
          {message}
        </p>

        {/* التاريخ المتوقع (اختياري) */}
        {expectedDate && (
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-gray-800/60 rounded-full border border-gray-700 backdrop-blur-sm">
            <Clock className="w-5 h-5 text-amber-400" />
            <span className="text-gray-200 font-medium">
              متوقع الإطلاق: <span className="text-amber-300">{expectedDate}</span>
            </span>
          </div>
        )}

        {/* عناصر تزيينية متحركة */}
        <div className="flex justify-center gap-6 mt-10">
          <motion.div
            animate={{ y: [0, -15, 0] }}
            transition={{ duration: 3, repeat: Infinity, delay: 0 }}
          >
            <Hammer className="w-8 h-8 text-amber-500/70" />
          </motion.div>
          <motion.div
            animate={{ y: [0, -15, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, delay: 0.4 }}
          >
            <Sparkles className="w-8 h-8 text-yellow-400/70" />
          </motion.div>
          <motion.div
            animate={{ y: [0, -15, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, delay: 0.8 }}
          >
            <Construction className="w-8 h-8 text-amber-600/70" />
          </motion.div>
        </div>

        {/* رسالة إضافية اختيارية */}
        <p className="text-gray-500 mt-12 text-sm">
          نحن نعمل بجد لنقدم لك تجربة أفضل... شكراً لصبرك ❤️
        </p>
      </motion.div>
    </div>
  );
};

export default UnderConstruction;