import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n';
import { Zap, LogIn } from 'lucide-react';

export default function LoginPage() {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(t('auth.loginError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <Zap size={28} color="var(--primary)" />
          <h1>{t('app.title')}</h1>
          <p className="auth-subtitle">{t('auth.loginTitle')}</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <div className="form-group">
            <label>{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>{t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
              required
            />
          </div>

          <button type="submit" className="btn-primary auth-submit" disabled={loading}>
            <LogIn size={16} />
            {loading ? t('auth.loggingIn') : t('auth.login')}
          </button>
        </form>

        <p className="auth-footer">
          {t('auth.noAccount')} <Link to="/signup">{t('auth.signup')}</Link>
        </p>
      </div>
    </div>
  );
}
