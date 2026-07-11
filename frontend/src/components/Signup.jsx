import React, { useState } from 'react'
import { GoogleLogin, useGoogleLogin } from '@react-oauth/google'
import { jwtDecode } from 'jwt-decode'
import './Auth.css'

const BACKEND_URL = import.meta.env.VITE_API_URL || 'https://viralify-backend-506139712110.us-central1.run.app';

export default function Signup({ onSignup, onSwitchToLogin, isDarkMode, onToggleTheme }) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
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
    if (formData.password !== formData.confirmPassword) {
       setError("Passwords do not match");
       return;
    }
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${BACKEND_URL}/api/create-new-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           username: formData.username,
           email: formData.email,
           password: formData.password
        })
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }
      
      if (onSignup) onSignup(data.user);
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
        
        if (onSignup) onSignup(data.user);
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
      <h2>Create account</h2>
      <p className="subtitle">Let's get started with your 30 days trial</p>

      {error && <div className="error-message" style={{color: 'red', marginBottom: '1rem'}}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="username"
          placeholder="Name"
          value={formData.username}
          onChange={handleChange}
          required
          className="clean-input"
        />

        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
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

        <input
          type="password"
          name="confirmPassword"
          placeholder="Confirm Password"
          value={formData.confirmPassword}
          onChange={handleChange}
          required
          className="clean-input"
        />

        <button type="submit" disabled={loading} className="clean-button">
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <div className="login-link-text">
        Already have an account? <span onClick={onSwitchToLogin}>Login</span>
      </div>

      <div className="social-login-row">
        <div className="social-btn" onClick={() => handleGoogleLogin()}>
          <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google" />
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
