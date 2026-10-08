import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || (
  process.env.NODE_ENV === 'production'
    ? 'https://ai-devops-incident-management.onrender.com/api'
    : 'http://127.0.0.1:5000/api'
);
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

function storeSession(data) {
  localStorage.setItem('token', data.token);
  localStorage.setItem('username', data.username);
  localStorage.setItem('role', data.role);
  localStorage.setItem('email', data.email || '');
  if (data.user_id !== null && data.user_id !== undefined) {
    localStorage.setItem('user_id', String(data.user_id));
  } else {
    localStorage.removeItem('user_id');
  }
}

function Login() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('user');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const googleButtonRef = useRef(null);
  const navigate = useNavigate();

  const completeLogin = (data) => {
    storeSession(data);
    navigate('/dashboard');
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleButtonRef.current) return undefined;

    let attempts = 0;
    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) {
        attempts += 1;
        if (attempts >= 40) window.clearInterval(interval);
        return;
      }

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          setError('');
          setIsSubmitting(true);
          try {
            const response = await axios.post(`${API_BASE_URL}/auth/google`, { credential });
            storeSession(response.data);
            navigate('/dashboard');
          } catch (err) {
            setError(err.response?.data?.error || 'Google sign-in could not be completed.');
          } finally {
            setIsSubmitting(false);
          }
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        width: Math.min(420, googleButtonRef.current.clientWidth || 400),
        text: 'continue_with',
      });
      window.clearInterval(interval);
    };

    const interval = window.setInterval(renderGoogleButton, 250);
    renderGoogleButton();
    return () => window.clearInterval(interval);
  }, [navigate]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (isSignUp && password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/${isSignUp ? 'signup' : 'login'}`, {
        username,
        password,
        ...(isSignUp && { email }),
        ...(!isSignUp && { role }),
      });
      completeLogin(res.data);
    } catch (err) {
      setError(err.response?.data?.error || (err.response?.status === 401
        ? 'Those credentials do not match the selected role.'
        : 'Unable to reach the account service. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchAuthMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true">IM</span>
          <span>FIELD OPERATIONS / 01</span>
        </div>
        <div className="login-heading">
          <p className="login-kicker">Incident response workspace</p>
          <h1 id="login-title">{isSignUp ? <>Create your<br />account.</> : <>Good to have you<br />back.</>}</h1>
          <p className="login-intro">
            {isSignUp
              ? 'Create a user account to report and track incidents.'
              : 'Sign in to review incidents and keep your team moving.'}
          </p>
        </div>

        <form className="login-form" onSubmit={handleAuthSubmit}>
          {!isSignUp && (
            <fieldset className="role-picker">
              <legend>Sign in as</legend>
              <div className="role-options">
                <button
                  className={`role-option ${role === 'user' ? 'is-selected' : ''}`}
                  type="button"
                  aria-pressed={role === 'user'}
                  onClick={() => setRole('user')}
                >
                  <span className="role-indicator" aria-hidden="true">U</span>
                  <span><strong>User</strong><small>Report and track incidents</small></span>
                </button>
                <button
                  className={`role-option ${role === 'administrator' ? 'is-selected' : ''}`}
                  type="button"
                  aria-pressed={role === 'administrator'}
                  onClick={() => setRole('administrator')}
                >
                  <span className="role-indicator" aria-hidden="true">A</span>
                  <span><strong>Administrator</strong><small>Manage incident status</small></span>
                </button>
                <button
                  className={`role-option ${role === 'technician' ? 'is-selected' : ''}`}
                  type="button"
                  aria-pressed={role === 'technician'}
                  onClick={() => setRole('technician')}
                >
                  <span className="role-indicator" aria-hidden="true">T</span>
                  <span><strong>Technician</strong><small>Work assigned incidents</small></span>
                </button>
                <button
                  className={`role-option ${role === 'manager' ? 'is-selected' : ''}`}
                  type="button"
                  aria-pressed={role === 'manager'}
                  onClick={() => setRole('manager')}
                >
                  <span className="role-indicator" aria-hidden="true">M</span>
                  <span><strong>Manager</strong><small>Monitor team response</small></span>
                </button>
              </div>
            </fieldset>
          )}

          <label className="field-label" htmlFor="username">{isSignUp ? 'Username' : 'Username or email'}</label>
          <input
            className="login-input"
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder={isSignUp ? 'Choose a username' : 'Enter your username or email'}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          {isSignUp && (
            <>
              <label className="field-label" htmlFor="email">Email address</label>
              <input
                className="login-input"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </>
          )}
          {isSignUp && (
            <div className="signup-role" aria-label="Your initial account role is User or Reporter">
              <span>INITIAL ACCOUNT ROLE</span>
              <strong>User / Reporter</strong>
              <small>An administrator can assign Technician or Manager after signup.</small>
            </div>
          )}
          <label className="field-label" htmlFor="password">Password</label>
          <input
            className="login-input"
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={isSignUp ? 12 : undefined}
            required
          />
          {isSignUp && (
            <>
              <label className="field-label" htmlFor="confirm-password">Confirm password</label>
              <input
                className="login-input"
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="Enter your password again"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={12}
                required
              />
              <p className="password-hint">Use at least 12 characters. New accounts have the User role.</p>
            </>
          )}
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'Sign up' : 'Sign in')}
            <span aria-hidden="true">&#8594;</span>
          </button>
          <div className="auth-divider"><span>OR CONTINUE WITH</span></div>
          {GOOGLE_CLIENT_ID ? (
            <div className="google-button" ref={googleButtonRef} />
          ) : (
            <div className="google-unavailable">
              <button className="google-button google-button-unconfigured" type="button" disabled>
                <span className="google-mark" aria-hidden="true">G</span>
                Continue with Google
              </button>
              <p role="note">Google sign-in is unavailable until OAuth is configured on this app.</p>
            </div>
          )}
          <p className="auth-switch">
            {isSignUp ? 'Already have an account?' : 'New to the workspace?'}
            <button type="button" onClick={switchAuthMode}>
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </form>
        <p className="login-footer">AI DEVOPS INCIDENT MANAGEMENT <span>SECURE ACCESS</span></p>
      </section>
      <aside className="login-aside" aria-label="Incident operations overview">
        <div className="aside-topline"><span>LIVE OPERATIONS</span><span className="live-status">● SYSTEM READY</span></div>
        <div className="ops-visual" aria-hidden="true">
          <div className="ops-grid" />
          <div className="signal-ring signal-ring-outer" />
          <div className="signal-ring signal-ring-inner" />
          <div className="signal-core"><span>24</span><small>HRS</small></div>
          <span className="signal-point point-one" />
          <span className="signal-point point-two" />
          <span className="signal-point point-three" />
          <div className="signal-label signal-label-top">INCIDENT<br />DETECTION</div>
          <div className="signal-label signal-label-bottom">RESPONSE<br />COORDINATION</div>
        </div>
        <div className="aside-caption">
          <span className="caption-index">01 / 03</span>
          <h2>Clarity when<br />systems go quiet.</h2>
          <p>One place to surface issues, coordinate response, and restore service.</p>
        </div>
        <div className="aside-bottom"><span>OPERATIONS CENTER</span><span>EST. 2024</span></div>
      </aside>
    </main>
  );
}

export default Login;