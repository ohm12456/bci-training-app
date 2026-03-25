import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Activity, CheckCircle2, Mail } from 'lucide-react';
import { authService } from '../../services/auth';

interface SignupScreenProps {
  onSignup: (accessToken: string, user: { id: string; email: string; name: string }) => void;
  onSwitchToLogin: () => void;
}

export function SignupScreen({ onSignup, onSwitchToLogin }: SignupScreenProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailConfirmNeeded, setEmailConfirmNeeded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    const result = await authService.signup(email.trim(), password, name.trim());

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (result.needsEmailConfirm) {
      // Email confirmation required — show message, do not log in yet
      setEmailConfirmNeeded(true);
      setLoading(false);
      return;
    }

    if (result.user && result.accessToken) {
      // Auto-confirm enabled — log in immediately
      onSignup(result.accessToken, result.user);
    } else {
      setError('Account created but could not sign in. Please try logging in manually.');
    }

    setLoading(false);
  };

  // ── Email confirm state ────────────────────────────────────────────────────
  if (emailConfirmNeeded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 via-white to-blue-50">
        <div className="w-full max-w-md px-8">
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
            <h1 className="text-2xl text-gray-900 mb-2">Check Your Email</h1>
            <p className="text-sm text-gray-600 mb-4">
              We sent a confirmation link to <strong>{email}</strong>.
            </p>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-left mb-6">
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-blue-800 font-medium">Next steps</p>
                  <ol className="text-xs text-blue-700 mt-1 space-y-1 list-decimal list-inside">
                    <li>Open the confirmation email from Supabase</li>
                    <li>Click the "Confirm your email" link</li>
                    <li>Return here and sign in with your credentials</li>
                  </ol>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Didn't receive the email? Check your spam folder or contact your administrator.
            </p>
            <Button
              onClick={onSwitchToLogin}
              className="w-full h-11 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white"
            >
              Go to Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Sign-up form ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 via-white to-blue-50">
      <div className="w-full max-w-md px-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-2xl mb-4">
              <Activity className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl text-gray-900 mb-2">Create Account</h1>
            <p className="text-sm text-gray-600">Join the BCI Training System</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm text-gray-700">
                Full Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11"
                required
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-gray-700">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-gray-700">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password (min. 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
                required
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm text-gray-700">
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-11"
                required
                autoComplete="new-password"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white mt-6"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Account…
                </span>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-cyan-600 hover:text-cyan-700 font-medium"
              >
                Sign In
              </button>
            </p>
            <p className="text-xs text-gray-500 mt-4">
              Central Medical Center — Neurology Department
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
