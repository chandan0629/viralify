import React, { useState, useEffect } from 'react'
import { AudioWaveform } from 'lucide-react'
import './Layout.css'

// Lazy load components to avoid import errors
const LiveSongTest = React.lazy(() => import('./LiveSongTestIntegrated'))
const Recommendations = React.lazy(() => import('./Recommendations'))
const GameDashboard = React.lazy(() => import('./GameDashboard'))
const LiveRecording = React.lazy(() => import('./LiveRecording'))
const ModelSettings = React.lazy(() => import('./ModelSettings'))

export default function Layout({ score, logs, onResult, user, onLogout }) {
  const [currentPage, setCurrentPage] = useState('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [isDarkTheme, setIsDarkTheme] = useState(true)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme) {
      setIsDarkTheme(savedTheme === 'dark')
      document.documentElement.setAttribute('data-theme', savedTheme)
    } else {
      document.documentElement.setAttribute('data-theme', 'dark')
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = !isDarkTheme
    setIsDarkTheme(newTheme)
    const themeValue = newTheme ? 'dark' : 'light'
    localStorage.setItem('theme', themeValue)
    document.documentElement.setAttribute('data-theme', themeValue)
  }

  const toggleMenu = () => setMenuOpen(!menuOpen)
  const closeMenu = () => setMenuOpen(false)

  const navigate = (page) => {
    setCurrentPage(page)
    closeMenu()
  }

  return (
    <div className="layout">
      {/* Animated 3D Background */}
      <div className="background">
        <div className="music-symbol">♪</div>
        <div className="gradient-orbs">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="orb orb-3"></div>
        </div>
      </div>

      {/* Hamburger Menu */}
      <button
        className={`hamburger ${menuOpen ? 'active' : ''}`}
        onClick={toggleMenu}
        aria-label="Toggle menu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* Theme Toggle Button */}
      <button
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        <span className="theme-icon">{isDarkTheme ? '☀️' : '🌙'}</span>
      </button>

      {/* Sidebar Menu */}
      <nav className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="menu-header">
          <h1>Viralify</h1>
          {user && (
            <div className="user-info">
              <div className="user-avatar">
                {user.username?.charAt(user.username.length - 1) || 'U'}
              </div>
              <div className="user-details">
                <span className="user-name">{user.name || user.username}</span>
                <span className="user-id">@{user.username}</span>
              </div>
            </div>
          )}
        </div>
        <ul className="menu-items">
          <li>
            <button
              className={`menu-link ${currentPage === 'home' ? 'active' : ''}`}
              onClick={() => navigate('home')}
            >
              Home
            </button>
          </li>
          <li>
            <button
              className={`menu-link ${currentPage === 'live' ? 'active' : ''}`}
              onClick={() => navigate('live')}
            >
              Live Song Test
            </button>
          </li>
          <li>
            <button
              className={`menu-link ${currentPage === 'record' ? 'active' : ''}`}
              onClick={() => navigate('record')}
            >
              Live Recording
            </button>
          </li>
          <li>
            <button
              className={`menu-link ${currentPage === 'recommend' ? 'active' : ''}`}
              onClick={() => navigate('recommend')}
            >
              Insights
            </button>
          </li>
          <li>
            <button
              className={`menu-link ${currentPage === 'settings' ? 'active' : ''}`}
              onClick={() => navigate('settings')}
            >
              Settings
            </button>
          </li>
        </ul>
        <div className="menu-footer">
          {user && (
            <button className="logout-btn" onClick={onLogout}>
              <span>🚪</span>
              Logout
            </button>
          )}
          <p>Made with music passion</p>
        </div>
      </nav>

      {/* Overlay for menu */}
      {menuOpen && (
        <div className="menu-overlay" onClick={closeMenu}></div>
      )}

      {/* Main Content */}
      <main className="main-content">
        {currentPage === 'home' && (
          <div className="home-page">
            <div className="welcome-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '20px' }}>
                <AudioWaveform size={64} color="#EC4899" />
                <h1 className="title-3d" style={{ marginBottom: 0 }}>Viralify</h1>
              </div>
              <p className="subtitle">Predict Your Song's Potential</p>
              <p className="description">
                Use AI-powered machine learning to analyze your song's potential to go viral.
                Our ensemble model is trained on 176,000+ tracks from multiple Spotify datasets.
              </p>
              <div className="quick-buttons">
                <button className="btn primary large" onClick={() => navigate('live')}>
                  Start Analyzing →
                </button>
              </div>
            </div>
          </div>
        )}

        {currentPage === 'live' && (
          <div className="live-page">
            <React.Suspense fallback={<div>Loading...</div>}>
              <LiveSongTest />
            </React.Suspense>
          </div>
        )}

        {currentPage === 'record' && (
          <div className="record-page">
            <React.Suspense fallback={<div>Loading...</div>}>
              <LiveRecording />
            </React.Suspense>
          </div>
        )}

        {currentPage === 'recommend' && (
          <div className="recommend-page">
            <React.Suspense fallback={<div>Loading...</div>}>
              <Recommendations />
            </React.Suspense>
          </div>
        )}

        {currentPage === 'settings' && (
          <div className="settings-page">
            <React.Suspense fallback={<div>Loading...</div>}>
              <ModelSettings />
            </React.Suspense>
          </div>
        )}
      </main>

    </div>
  )
}