// src/components/Login.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Lock, LogIn, UserPlus, Loader2 } from 'lucide-react';
import { auth } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider 
} from 'firebase/auth';

interface LoginProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ar' | 'en';
}

const translations = {
  ar: {
    login: 'تسجيل الدخول',
    signup: 'إنشاء حساب',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    confirmPassword: 'تأكيد كلمة المرور',
    loginBtn: 'دخول',
    signupBtn: 'إنشاء حساب',
    google: 'الدخول بـ Google',
    noAccount: 'ليس لديك حساب؟',
    hasAccount: 'لديك حساب بالفعل؟',
    createAccount: 'إنشاء حساب جديد',
    error: {
      'auth/invalid-email': 'بريد إلكتروني غير صالح',
      'auth/user-not-found': 'المستخدم غير موجود',
      'auth/wrong-password': 'كلمة مرور خاطئة',
      'auth/email-already-in-use': 'البريد الإلكتروني مستخدم مسبقاً',
      'auth/weak-password': 'كلمة المرور ضعيفة (6 أحرف على الأقل)',
      'passwords-dont-match': 'كلمات المرور غير متطابقة'
    }
  },
  en: {
    login: 'Login',
    signup: 'Sign Up',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    loginBtn: 'Login',
    signupBtn: 'Sign Up',
    google: 'Continue with Google',
    noAccount: 'Don\'t have an account?',
    hasAccount: 'Already have an account?',
    createAccount: 'Create new account',
    error: {
      'auth/invalid-email': 'Invalid email address',
      'auth/user-not-found': 'User not found',
      'auth/wrong-password': 'Wrong password',
      'auth/email-already-in-use': 'Email already in use',
      'auth/weak-password': 'Password is too weak (min 6 characters)',
      'passwords-dont-match': 'Passwords do not match'
    }
  }
};

export const LoginModal: React.FC<LoginProps> = ({ isOpen, onClose, lang }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const t = translations[lang];
  const isRtl = lang === 'ar';

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onClose();
    } catch (err: any) {
      setError(t.error[err.code as keyof typeof t.error] || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    setError(null);
    
    if (mode === 'signup' && password !== confirmPassword) {
      setError(t.error['passwords-dont-match']);
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      onClose();
    } catch (err: any) {
      setError(t.error[err.code as keyof typeof t.error] || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
              {mode === 'login' ? t.login : t.signup}
            </h2>

            <div className="space-y-4">
              <input
                type="email"
                placeholder={t.email}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              
              <input
                type="password"
                placeholder={t.password}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              
              {mode === 'signup' && (
                <input
                  type="password"
                  placeholder={t.confirmPassword}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}

              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleEmailAuth}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-pink-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-pink-700 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {mode === 'login' ? t.loginBtn : t.signupBtn}
              </button>

              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                <img src="/google-icon.svg" className="w-5 h-5" alt="Google" />
                {t.google}
              </button>

              <div className="text-center text-sm text-gray-500">
                {mode === 'login' ? t.noAccount : t.hasAccount}
                <button
                  onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                  className="text-indigo-600 hover:text-indigo-800 mr-1"
                >
                  {mode === 'login' ? t.createAccount : t.login}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};