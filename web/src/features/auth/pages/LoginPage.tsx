import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Wallet, AlertCircle, Phone, ArrowLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { AppApiError } from '@/utils/error';
import { sendPhoneOtp, verifyPhoneOtp, PhoneOtpSession } from '@/services/firebase';

export const LoginPage: React.FC = () => {
  // Phone & OTP state
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpStep, setOtpStep] = useState<'PHONE_INPUT' | 'OTP_INPUT'>('PHONE_INPUT');
  const [otpSession, setOtpSession] = useState<PhoneOtpSession | null>(null);
  const [countdown, setCountdown] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const { loginWithPhone } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const fromPath = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  // Resend countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Handle Send OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorBanner(null);

    const cleanNumber = phoneNumber.trim().replace(/\s+/g, '');
    if (!cleanNumber) {
      setErrorBanner('Please enter your mobile phone number.');
      return;
    }
    if (cleanNumber.length < 7) {
      setErrorBanner('Please enter a valid mobile phone number.');
      return;
    }

    const fullPhone = `${countryCode}${cleanNumber.startsWith('+') ? cleanNumber.slice(countryCode.length) : cleanNumber}`;

    setIsLoading(true);
    try {
      const session = await sendPhoneOtp(fullPhone, 'recaptcha-container');
      setOtpSession(session);
      setOtpStep('OTP_INPUT');
      setCountdown(30);
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to send OTP. Please check the number and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Verify OTP
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorBanner(null);

    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      setErrorBanner('Please enter the complete 6-digit verification code.');
      return;
    }

    if (!otpSession) {
      setErrorBanner('Verification session expired. Please request a new code.');
      setOtpStep('PHONE_INPUT');
      return;
    }

    setIsLoading(true);
    try {
      const idToken = await verifyPhoneOtp(otpSession, cleanOtp);
      await loginWithPhone({ idToken });
      navigate(fromPath, { replace: true });
    } catch (err: any) {
      if (err instanceof AppApiError) {
        setErrorBanner(err.message);
      } else {
        setErrorBanner(err.message || 'Invalid or expired OTP code.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Auto submit when 6 digits are typed
  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtpCode(val);
    if (val.length === 6) {
      setTimeout(() => {
        const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
        handleVerifyOtp(fakeEvent);
      }, 50);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      {/* Invisible reCAPTCHA container for Firebase */}
      <div id="recaptcha-container"></div>

      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-primary-600 text-white flex items-center justify-center mx-auto mb-3 shadow-card">
            <Wallet className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">ExpenseFlow</h2>
          <p className="text-xs text-slate-500 mt-1">
            {otpStep === 'PHONE_INPUT'
              ? 'Sign in or register instantly with your mobile number'
              : 'Enter the 6-digit verification code sent to your phone'}
          </p>
        </div>

        {/* Main Phone Card */}
        <Card className="p-6 sm:p-8">
          {errorBanner && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-start gap-3 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{errorBanner}</span>
            </div>
          )}

          {otpStep === 'PHONE_INPUT' ? (
            /* Step 1: Mobile Number Input */
            <form className="space-y-4" onSubmit={handleSendOtp} noValidate>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mobile Number
                </label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="px-3 py-2 text-sm font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-slate-800"
                    disabled={isLoading}
                  >
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+971">🇦🇪 +971</option>
                    <option value="+966">🇸🇦 +966</option>
                    <option value="+65">🇸🇬 +65</option>
                  </select>
                  <input
                    type="tel"
                    placeholder="98765 43210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="flex-1 px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-slate-900 placeholder:text-slate-400 font-medium"
                    autoComplete="tel-national"
                    autoFocus
                    disabled={isLoading}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  We'll send a 6-digit OTP code to verify your phone.
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full mt-3"
                isLoading={isLoading}
              >
                <Phone className="w-4 h-4 mr-2" />
                Send OTP Code
              </Button>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                No password required • Automatic account creation
              </div>
            </form>
          ) : (
            /* Step 2: OTP Verification */
            <form className="space-y-5" onSubmit={handleVerifyOtp} noValidate>
              <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-500">Code sent to </span>
                <span className="text-xs font-semibold text-slate-800">
                  {otpSession?.phoneNumber || `${countryCode} ${phoneNumber}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setOtpStep('PHONE_INPUT');
                    setOtpCode('');
                    setErrorBanner(null);
                  }}
                  className="ml-2 text-xs text-primary-600 hover:text-primary-700 font-semibold underline"
                  disabled={isLoading}
                >
                  Edit
                </button>
              </div>

              <div>
                <label className="block text-center text-xs font-semibold text-slate-700 mb-2">
                  Enter 6-Digit OTP Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={otpCode}
                  onChange={handleOtpChange}
                  className="w-full text-center text-2xl font-bold tracking-[0.4em] py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-slate-900"
                  autoFocus
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full"
                isLoading={isLoading}
                disabled={otpCode.length < 6}
              >
                Verify & Continue
              </Button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setOtpStep('PHONE_INPUT');
                    setErrorBanner(null);
                  }}
                  className="text-slate-500 hover:text-slate-700 flex items-center gap-1 font-medium"
                  disabled={isLoading}
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>

                {countdown > 0 ? (
                  <span className="text-slate-400">Resend in {countdown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    className="text-primary-600 hover:text-primary-700 font-semibold"
                    disabled={isLoading}
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};
