import React, { useState } from 'react'
import { GoogleLogin, useGoogleLogin } from '@react-oauth/google'
import { jwtDecode } from 'jwt-decode'
import './Auth.css'

const BACKEND_URL = import.meta.env.VITE_API_URL || 'https://viralify-backend-li673hdf6q-uc.a.run.app';

export default function Login({ onLogin, onSwitchToSignup, isDarkMode, onToggleTheme }) {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${BACKEND_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      if (onLogin) onLogin(data.user);
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError('');
      try {
        // Fetch user info using the access token
        const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        }).then(res => res.json());
        
        const response = await fetch(`${BACKEND_URL}/api/google-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userInfo.email,
            name: userInfo.name,
            google_id: userInfo.sub
          })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Google login failed');
        
        if (onLogin) onLogin(data.user);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    onError: () => setError('Google sign in failed')
  });

  return (
    <div className="clean-form-container">
      <h2>Welcome back</h2>
      <p className="subtitle">Please enter your details to sign in</p>

      {error && <div className="error-message" style={{color: 'red', marginBottom: '1rem'}}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="username"
          placeholder="Email or Username"
          value={formData.username}
          onChange={handleChange}
          required
          className="clean-input"
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          required
          className="clean-input"
        />

        <button type="submit" disabled={loading} className="clean-button">
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div className="login-link-text">
        Don't have an account? <span onClick={onSwitchToSignup}>Create one</span>
      </div>

      <div className="social-login-row">
        <div className="social-btn" onClick={() => handleGoogleLogin()}>
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        </div>
        <div className="social-btn">
          <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" alt="Apple" />
        </div>
        <div className="social-btn">
          <img src="https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg" alt="Facebook" />
        </div>
      </div>
    </div>
  )
}
