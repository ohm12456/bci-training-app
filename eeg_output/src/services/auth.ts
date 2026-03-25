import { supabase, API_BASE_URL } from '../utils/supabase';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  user: User | null;
  accessToken: string | null;
  error: string | null;
  needsEmailConfirm?: boolean;
}

/** Convert Supabase/network errors to user-friendly messages */
function friendlyError(error: any): string {
  if (!error) return '';
  const msg: string = error?.message || String(error);
  if (msg.includes('User already registered') || msg.includes('already been registered'))
    return 'An account with this email already exists. Please sign in instead.';
  if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials'))
    return 'Incorrect email or password. Please check your credentials and try again.';
  if (msg.includes('Email not confirmed'))
    return 'Please confirm your email address before signing in. Check your inbox for the confirmation link.';
  if (msg.includes('rate limit') || msg.includes('too many requests'))
    return 'Too many attempts. Please wait a moment and try again.';
  if (msg.includes('Password should be at least') || msg.includes('password'))
    return 'Password must be at least 6 characters long.';
  if (msg.includes('Unable to validate email address') || msg.includes('invalid email'))
    return 'Please enter a valid email address.';
  if (msg.toLowerCase().includes('network') || msg.includes('Failed to fetch'))
    return 'Network error. Please check your connection and try again.';
  return msg || 'An unexpected error occurred. Please try again.';
}

/** After a new user signs up with auto-confirm, seed sample data for them */
async function seedNewUserData(accessToken: string): Promise<void> {
  try {
    // The GET /patients endpoint auto-seeds data for users with no patients.
    // We just call it here to trigger seeding immediately after signup.
    await fetch(`${API_BASE_URL}/patients`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    console.log('Seeded initial sample data for new user');
  } catch (err) {
    console.warn('Could not seed initial data — will retry on first load:', err);
  }
}

export const authService = {
  /**
   * Sign up with email/password using Supabase Auth directly.
   * Returns a session immediately if email confirmation is disabled,
   * or sets needsEmailConfirm=true if confirmation is required.
   */
  async signup(email: string, password: string, name: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });

      if (error) {
        console.error('Signup error from Supabase:', error);
        return { user: null, accessToken: null, error: friendlyError(error) };
      }

      if (!data.user) {
        return { user: null, accessToken: null, error: 'Signup failed. Please try again.' };
      }

      // Session exists → email_confirm is disabled (or user already confirmed)
      if (data.session) {
        const user: User = {
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.name || name,
        };
        // Seed sample data for the new user in the background
        seedNewUserData(data.session.access_token);
        return { user, accessToken: data.session.access_token, error: null };
      }

      // No session → email confirmation required
      console.log('Signup successful — email confirmation required for:', email);
      return { user: null, accessToken: null, error: null, needsEmailConfirm: true };
    } catch (err) {
      console.error('Signup exception:', err);
      return {
        user: null,
        accessToken: null,
        error: 'Network error during signup. Please check your connection and try again.',
      };
    }
  },

  /** Sign in with email/password */
  async loginWithPassword(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error || !data.session) {
        console.error('Login error:', error);
        return {
          user: null,
          accessToken: null,
          error: friendlyError(error) || 'Sign-in failed. Please try again.',
        };
      }

      return {
        user: {
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.name || data.user.email!.split('@')[0],
        },
        accessToken: data.session.access_token,
        error: null,
      };
    } catch (err) {
      console.error('Login exception:', err);
      return {
        user: null,
        accessToken: null,
        error: 'Network error during sign-in. Please try again.',
      };
    }
  },

  /**
   * Initiate Google OAuth sign-in.
   * Shows a friendly message if the provider is not configured.
   */
  async loginWithGoogle(): Promise<AuthResponse> {
    try {
      // Complete setup at: https://supabase.com/docs/guides/auth/social-login/auth-google
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        console.error('Google OAuth error:', error);
        return {
          user: null,
          accessToken: null,
          error:
            'Google sign-in is not yet configured for this system. Please use email and password to sign in, or contact your administrator.',
        };
      }

      // Redirect initiated — no immediate user/token response
      return { user: null, accessToken: null, error: null };
    } catch (err) {
      console.error('Google login exception:', err);
      return {
        user: null,
        accessToken: null,
        error: 'Network error during Google sign-in. Please try again.',
      };
    }
  },

  /** Restore an existing session (called on app mount) */
  async getSession(): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        return { user: null, accessToken: null, error: null };
      }

      return {
        user: {
          id: data.session.user.id,
          email: data.session.user.email!,
          name:
            data.session.user.user_metadata?.name ||
            data.session.user.email!.split('@')[0],
        },
        accessToken: data.session.access_token,
        error: null,
      };
    } catch (err) {
      console.error('getSession exception:', err);
      return { user: null, accessToken: null, error: null };
    }
  },

  /** Sign out the current user */
  async logout(): Promise<void> {
    await supabase.auth.signOut();
  },
};
