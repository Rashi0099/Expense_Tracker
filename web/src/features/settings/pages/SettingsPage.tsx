import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getClientDeviceMetadata } from '@/utils/device';
import { formatDate } from '@/utils/date';
import { parseApiError } from '@/utils/error';
import {
  User,
  ShieldCheck,
  Laptop,
  Coins,
  CheckCircle2,
  LogOut,
  Shield,
} from 'lucide-react';
import { useWebPrivacy } from '@/components/common/WebPrivacyShield';

const SUPPORTED_CURRENCIES = [
  { label: 'USD ($) - US Dollar', value: 'USD' },
  { label: 'EUR (€) - Euro', value: 'EUR' },
  { label: 'GBP (£) - British Pound', value: 'GBP' },
  { label: 'INR (₹) - Indian Rupee', value: 'INR' },
  { label: 'CAD ($) - Canadian Dollar', value: 'CAD' },
  { label: 'AUD ($) - Australian Dollar', value: 'AUD' },
  { label: 'JPY (¥) - Japanese Yen', value: 'JPY' },
];

export const SettingsPage: React.FC = () => {
  const { user, updateUser, logout } = useAuth();
  const { isPrivacyShieldEnabled, setPrivacyShieldEnabled } = useWebPrivacy();
  const device = getClientDeviceMetadata();

  const [selectedCurrency, setSelectedCurrency] = useState(user?.baseCurrency || 'USD');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user?.baseCurrency) {
      setSelectedCurrency(user.baseCurrency);
    }
  }, [user?.baseCurrency]);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await updateUser({ baseCurrency: selectedCurrency });
      setSuccessMsg(`Base currency successfully updated to ${selectedCurrency}.`);
    } catch (err) {
      const parsed = parseApiError(err);
      setErrorMsg(parsed.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Settings</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Manage your account preferences, base currency, and security
        </p>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-2xl text-xs">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {/* Currency & Account Preferences */}
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Financial Preferences</h3>
              <p className="text-xs text-slate-500">Configure your primary reporting currency</p>
            </div>
          </div>

          <form onSubmit={handleSavePreferences} className="space-y-4 max-w-md">
            <div>
              <Select
                label="Primary Base Currency"
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                options={SUPPORTED_CURRENCIES}
              />
              <p className="text-xs text-slate-400 mt-1">
                This currency is used for dashboard reconciliations and overall budget ceilings.
              </p>
            </div>

            <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
              Save Currency
            </Button>
          </form>
        </Card>

        {/* User Identity Details */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">User Identity</h3>
              <p className="text-xs text-slate-500">Authoritative profile details</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <span className="text-slate-400 block mb-1">Email Address</span>
              <span className="font-semibold text-slate-800">{user?.email}</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <span className="text-slate-400 block mb-1">Member Since</span>
              <span className="font-semibold text-slate-800">{formatDate(user?.createdAt || '')}</span>
            </div>
          </div>
        </Card>

        {/* Screen Protection & Tab Privacy Shield (Section 40 Parity) */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Screen & Presentation Privacy</h3>
                <p className="text-xs text-slate-500">
                  Protect balances when tab is inactive or during screen-sharing
                </p>
              </div>
            </div>
            <Button
              variant={isPrivacyShieldEnabled ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setPrivacyShieldEnabled(!isPrivacyShieldEnabled)}
            >
              {isPrivacyShieldEnabled ? 'Shield Active 🔒' : 'Disabled'}
            </Button>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            When enabled, switching tabs or sharing your browser window automatically obscures sensitive account numbers and transaction amounts.
          </p>
        </Card>

        {/* Active Device & Security Session */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600">
                <Laptop className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Active Device Session</h3>
                <p className="text-xs text-slate-500">Hardware-bound session metadata</p>
              </div>
            </div>
            <Badge variant="success" dot size="sm">
              Current Device
            </Badge>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Device Name</span>
              <span className="font-semibold text-slate-800">{device.deviceName}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Platform</span>
              <Badge variant="neutral" size="sm">{device.platform}</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Device ID</span>
              <span className="font-mono text-slate-600 text-[11px] select-all">{device.id}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-500">Client Version</span>
              <span className="font-semibold text-slate-800">{device.clientVersion}</span>
            </div>
          </div>

          {/* Security architecture highlights */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3 mt-4">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 space-y-1 leading-relaxed">
              <p className="font-semibold text-slate-800">Bank-Grade Token Isolation</p>
              <p className="text-[11px] text-slate-500">
                Your access token is kept in-memory to prevent XSS theft, refreshed through single-use rotating tokens (RTR), and bound to this device ID.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout()}
              leftIcon={<LogOut className="w-4 h-4 text-rose-600" />}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
            >
              Sign Out of Session
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
