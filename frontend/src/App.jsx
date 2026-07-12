import React, { useState, useEffect } from 'react'

export default function App(){
  const [mounted, setMounted] = useState(false)
  const [Layout, setLayout] = useState(null)
  const [Landing, setLanding] = useState(null)
  const [FavoriteArtistsStep, setFavoriteArtistsStep] = useState(null)
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  const [onboardingComplete, setOnboardingComplete] = useState(() => {
    try {
      return localStorage.getItem('sv_onboarded') === 'true'
    } catch {
      return false
    }
  })
  const [score, setScore] = useState(() => {
    try {
      return Number(localStorage.getItem('sv_score') || 0)
    } catch {
      return 0
    }
  })
  const [logs, setLogs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sv_logs') || '[]')
    } catch {
      return []
    }
  })

  // Check for existing user session
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('sv_user')
      if (savedUser) {
        const userData = JSON.parse(savedUser)
        setUser(userData)
      }
    } catch (error) {
      console.error('Error loading user session:', error)
      localStorage.removeItem('sv_user')
    }
  }, [])

  // Lazy load components
  useEffect(() => {
    const loadComponents = async () => {
      try {
        const [layoutMod, landingMod, favoriteArtistsMod] = await Promise.all([
          import('./components/Layout'),
          import('./components/Landing'),
          import('./components/FavoriteArtistsStep')
        ])
        setLayout(() => layoutMod.default)
        setLanding(() => landingMod.default)
        setFavoriteArtistsStep(() => favoriteArtistsMod.default)
        setMounted(true)
      } catch (err) {
        console.error('Failed to load components:', err)
        setError(err.message)
        setMounted(true)
      }
    }
    
    loadComponents()
  }, [])

  useEffect(()=>{
    try {
      localStorage.setItem('sv_score', score)
    } catch (e) {
      console.error('Failed to save score:', e)
    }
  },[score])

  useEffect(()=>{
    try {
      localStorage.setItem('sv_logs', JSON.stringify(logs))
    } catch (e) {
      console.error('Failed to save logs:', e)
    }
  },[logs])

  function handleResult({hit_probability, confidence, features, songName}){
    const points = Math.round(hit_probability * 100)
    const bonus = confidence > 0.75 ? 25 : confidence > 0.5 ? 10 : 0
    const total = points + bonus
    setScore(s => s + total)
    const entry = {time: new Date().toISOString(), probability: hit_probability, confidence, points: total, features, songName}
    setLogs(l => [entry, ...l].slice(0,50))
  }

  const handleLogin = (userData) => {
    setUser(userData)
    // User data is already saved to localStorage in Auth component
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('sv_user')
  }

  if (!mounted) {
    return <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0a0a0a', color: 'white', flexDirection: 'column'}}>
        <div style={{fontSize: '24px', marginBottom: '20px'}}>🎵 Loading ViraliFY...</div>
        <div style={{width: '40px', height: '40px', border: '3px solid rgba(255,122,182,0.3)', borderTopColor: '#ff7ab6', borderRadius: '50%', animation: 'spin 1s linear infinite'}}></div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
  }

  if (error) {
    return <div style={{color: '#ff6b6b', padding: '40px', textAlign: 'center', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #071029 0%, #071a2a 100%)'}}>
      <div>
        <div style={{fontSize: '24px', marginBottom: '20px'}}>⚠️ Error Loading App</div>
        <div style={{fontFamily: 'monospace', background: 'rgba(255,0,0,0.1)', padding: '20px', borderRadius: '8px'}}>{error}</div>
      </div>
    </div>
  }

  if (!Layout || !Landing || !FavoriteArtistsStep) {
    return <div style={{color: '#fff', padding: '40px', textAlign: 'center', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #071029 0%, #071a2a 100%)'}}>
      <div>
        <div style={{fontSize: '24px', marginBottom: '20px'}}>🎵 Loading Components...</div>
      </div>
    </div>
  }

  // Show landing page if user is not logged in
  if (!user) {
    return <Landing onLogin={handleLogin} />
  }

  // Show onboarding if not complete
  if (!onboardingComplete) {
    return <FavoriteArtistsStep 
      onNext={() => {
        setOnboardingComplete(true)
        localStorage.setItem('sv_onboarded', 'true')
      }}
      onSkip={() => {
        setOnboardingComplete(true)
        localStorage.setItem('sv_onboarded', 'true')
      }}
    />
  }

  // Show main app if user is logged in
  return (
    <Layout 
      score={score} 
      logs={logs} 
      onResult={handleResult} 
      user={user} 
      onLogout={handleLogout} 
    />
  )
}