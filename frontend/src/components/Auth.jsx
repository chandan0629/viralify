import React, { useState, useEffect } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import Login from './Login'
import Signup from './Signup'

export default function Auth({ onLogin, initialIsLogin = true, onBack }) {
  const [isLogin, setIsLogin] = useState(initialIsLogin)
  const [user, setUser] = useState(null)
  const [isDarkMode, setIsDarkMode] = useState(true)

  // Check for existing user session and theme on component mount
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('sv_user')
      if (savedUser) {
        const userData = JSON.parse(savedUser)
        setUser(userData)
        if (onLogin) onLogin(userData)
      }
      
      // Load theme preference
      const savedTheme = localStorage.getItem('sv_theme')
      if (savedTheme) {
        setIsDarkMode(savedTheme === 'dark')
      }
    } catch (error) {
      console.error('Error loading user session:', error)
      localStorage.removeItem('sv_user')
    }
  }, [onLogin])

  const toggleTheme = () => {
    const newTheme = !isDarkMode
    setIsDarkMode(newTheme)
    localStorage.setItem('sv_theme', newTheme ? 'dark' : 'light')
  }

  const handleLogin = (userData) => {
    try {
      // Save user data to localStorage
      localStorage.setItem('sv_user', JSON.stringify(userData))
      setUser(userData)
      if (onLogin) onLogin(userData)
    } catch (error) {
      console.error('Error saving user session:', error)
    }
  }

  const handleSignup = (userData) => {
    try {
      // Save user data to localStorage
      localStorage.setItem('sv_user', JSON.stringify(userData))
      setUser(userData)
      if (onLogin) onLogin(userData)
    } catch (error) {
      console.error('Error saving user session:', error)
    }
  }

  const switchToSignup = () => setIsLogin(false)
  const switchToLogin = () => setIsLogin(true)

  // If user is already logged in, don't show auth forms
  if (user) {
    return null
  }

  const GOOGLE_CLIENT_ID = "627390059882-dnp1bqaj69cvjrfenmbjhm339tsmlion.apps.googleusercontent.com"

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className={`auth-split-wrapper ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
        <div className="auth-left-pane">
          {onBack && (
            <button onClick={onBack} className="back-btn">
              ← Back
            </button>
          )}
          <div className="auth-form-wrapper">
            {isLogin ? (
              <Login 
                onLogin={handleLogin} 
                onSwitchToSignup={switchToSignup}
                isDarkMode={isDarkMode}
                onToggleTheme={toggleTheme}
              />
            ) : (
              <Signup 
                onSignup={handleSignup} 
                onSwitchToLogin={switchToLogin}
                isDarkMode={isDarkMode}
                onToggleTheme={toggleTheme}
              />
            )}
          </div>
        </div>
        
        <div className="auth-right-pane" style={{ backgroundImage: "url('/auth-bg.png')" }}>
          <div className="auth-right-overlay">
            <h2>ViraliFY</h2>
            <p>
              Discover if your next track has what it takes to go viral. 
              Our advanced machine learning models analyze your audio DNA to predict its success 
              before you even hit publish.
            </p>
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  )
}
