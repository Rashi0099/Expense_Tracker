import React, { createContext, useContext, useState, useEffect } from 'react';
import { Shield, Eye } from 'lucide-react';

const STORAGE_KEY = '@expenseflow/privacy_shield_enabled';

interface WebPrivacyContextValue {
  isPrivacyShieldEnabled: boolean;
  setPrivacyShieldEnabled: (enabled: boolean) => void;
}

const WebPrivacyContext = createContext<WebPrivacyContextValue>({
  isPrivacyShieldEnabled: true,
  setPrivacyShieldEnabled: () => {},
});

export const useWebPrivacy = () => useContext(WebPrivacyContext);

interface WebPrivacyShieldProps {
  children: React.ReactNode;
}

export const WebPrivacyShield: React.FC<WebPrivacyShieldProps> = ({ children }) => {
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const [isShieldActive, setIsShieldActive] = useState(false);

  useEffect(() => {
    if (!isEnabled) {
      setIsShieldActive(false);
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsShieldActive(true);
      } else {
        setIsShieldActive(false);
      }
    };

    const handleBlur = () => {
      // Blur can fire during screen shares or window switching
      setIsShieldActive(true);
    };

    const handleFocus = () => {
      setIsShieldActive(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isEnabled]);

  const handleSetEnabled = (enabled: boolean) => {
    setIsEnabled(enabled);
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // Ignored
    }
    if (!enabled) {
      setIsShieldActive(false);
    }
  };

  return (
    <WebPrivacyContext.Provider
      value={{
        isPrivacyShieldEnabled: isEnabled,
        setPrivacyShieldEnabled: handleSetEnabled,
      }}
    >
      <div className="relative min-h-screen">
        {children}

        {isShieldActive && isEnabled && (
          <div
            onClick={() => setIsShieldActive(false)}
            className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center cursor-pointer animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-label="Financial Privacy Shield Active"
          >
            <div className="w-16 h-16 rounded-3xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 mb-4 shadow-xl shadow-indigo-950/50">
              <Shield className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2 tracking-tight">
              ExpenseFlow — Protected View
            </h2>
            <p className="text-sm text-slate-300 max-w-sm mb-6 leading-relaxed">
              Financial figures and transaction details are shielded while the tab is inactive or during screen-sharing presentations.
            </p>
            <button
              onClick={() => setIsShieldActive(false)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-slate-900 font-semibold text-xs shadow-lg hover:bg-slate-100 transition-all hover:scale-105"
            >
              <Eye className="w-4 h-4" />
              <span>Click to reveal details</span>
            </button>
          </div>
        )}
      </div>
    </WebPrivacyContext.Provider>
  );
};
