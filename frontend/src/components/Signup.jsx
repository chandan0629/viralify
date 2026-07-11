import React, { useState } from 'react'
import { AudioWaveform } from 'lucide-react'
import './Auth.css'

export default function Signup({ onSignup, onSwitchToLogin, isDarkMode, onToggleTheme, onBack }) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const BACKEND_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:5005')

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

    if (!formData.username || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('Please fill in all fields')
      setLoading(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/create-new-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed')
      }

      if (onSignup) {
        onSignup(data.user)
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`auth-container ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
      <div style={{ position: 'absolute', top: '30px', left: '40px', zIndex: 100 }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: '8px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>
          ← Back
        </button>
      </div>

      <div className="auth-background">
        <div className="music-symbol">♪</div>
        <div className="dna-helix"></div>
        <div className="floating-notes">
          <div className="note" style={{'--x': '10%', '--duration': '8s'}}>♫</div>
          <div className="note" style={{'--x': '20%', '--duration': '12s'}}>♪</div>
          <div className="note" style={{'--x': '80%', '--duration': '10s'}}>♬</div>
          <div className="note" style={{'--x': '90%', '--duration': '14s'}}>♩</div>
        </div>
        <div className="gradient-orbs">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
        </div>
      </div>

      <div className="auth-content">
        <div className="auth-card">
          <div className="auth-header">
            <div className="header-top" style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div className="logo" onClick={onBack} style={{cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px'}}>
                <AudioWaveform size={32} color="#EC4899" />
                <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Viralify</h1>
              </div>
              <button className="theme-toggle" onClick={onToggleTheme} title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'} style={{ position: 'absolute', right: 0 }}>
                <div className={`toggle-slider ${isDarkMode ? 'dark' : 'light'}`}>
                  <div className="toggle-icon">
                    {isDarkMode ? '🌙' : '☀️'}
                  </div>
                </div>
              </button>
            </div>
            <h2>Create Account</h2>
            <p>Join Viralify to discover your next viral hit</p>
          </div>
          
          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}
          
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="username">Username <span className="required">*</span></label>
              <input
                id="username"
                name="username"
                type="text"
                placeholder="Choose a username"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email <span className="required">*</span></label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password <span className="required">*</span></label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Create a password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password <span className="required">*</span></label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
            
            <button
              type="submit"
              className="auth-button primary"
              disabled={loading || !formData.username || !formData.email || !formData.password}
            >
              {loading ? <div className="loading-spinner"></div> : 'Create Account'}
            </button>
          </form>
          
          <div className="auth-footer">
            <p>
              Ready to login?{' '}
              <button 
                className="switch-auth"
                onClick={onSwitchToLogin}
                disabled={loading}
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
