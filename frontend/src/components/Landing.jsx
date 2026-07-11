import React, { useState, useEffect, useRef } from 'react'
import Auth from './Auth'
import './Layout.css'
import './Landing.css'
import Hero from './hero/Hero'
import {
  Play, Zap, BarChart2, CheckCircle, Music, Settings,
  ChevronRight, Download, Globe, Layers, Cpu, FileText,
  PieChart, Mic, TrendingUp, Activity, Code, Database,
  ArrowRight, Shield, Award, Sparkles, AudioWaveform,
  Plus, Minus, Lightbulb, Lock
} from 'lucide-react'

// Custom Hook for Intersection Observer (Scroll Animations)
const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const targetRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsIntersecting(true)
        // Optional: Stop observing once it intersects
        if (targetRef.current) observer.unobserve(targetRef.current)
      }
    }, { threshold: 0.1, ...options })

    if (targetRef.current) observer.observe(targetRef.current)

    return () => {
      if (targetRef.current) observer.unobserve(targetRef.current)
    }
  }, [options])

  return [targetRef, isIntersecting]
}

// Animated Counter Component
const AnimatedCounter = ({ end, duration = 2000, prefix = "", suffix = "" }) => {
  const [count, setCount] = useState(0)
  const [ref, isVisible] = useIntersectionObserver()

  useEffect(() => {
    if (!isVisible) return

    let startTime = null
    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime
      const progress = Math.min((currentTime - startTime) / duration, 1)

      // Ease out quart
      const easeOut = 1 - Math.pow(1 - progress, 4)
      setCount(Math.floor(easeOut * end))

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }
    requestAnimationFrame(animate)
  }, [isVisible, end, duration])

  return <span ref={ref}>{prefix}{count}{suffix}</span>
}

export default function Landing({ onLogin }) {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState(true) // true for login, false for signup
  const [activeFaq, setActiveFaq] = useState(null)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    // Force dark theme for landing to match premium aesthetic
    document.documentElement.setAttribute('data-theme', 'dark')
  }, [])

  const handleLoginClick = () => {
    setAuthMode(true)
    setShowAuth(true)
  }

  const handleSignupClick = () => {
    setAuthMode(false)
    setShowAuth(true)
  }

  const scrollToSection = (id) => {
    const el = document.getElementById(id)
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 80 // offset for fixed navbar
      window.scrollTo({ top: y, behavior: 'smooth' })
    }
  }

  // Animation Refs
  const [aboutRef, aboutVisible] = useIntersectionObserver()
  const [aboutViralifyRef, aboutViralifyVisible] = useIntersectionObserver()
  const [howItWorksRef, howItWorksVisible] = useIntersectionObserver()
  const [featuresRef, featuresVisible] = useIntersectionObserver()
  const [faqRef, faqVisible] = useIntersectionObserver()


  if (showAuth) {
    return (
      <div className="landing-page">
        <div className="landing-bg">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
          <div className="blob blob-3"></div>
        </div>
        <div className="auth-overlay">
          <Auth onLogin={onLogin} initialIsLogin={authMode} onBack={() => setShowAuth(false)} />
        </div>
      </div>
    )
  }

  return (
    <div className="landing-page">
      {/* Premium Background Effects */}
      <div className="landing-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
        <div className="particles-container">
          {/* Static particles for visual texture */}
          {[...Array(20)].map((_, i) => (
            <div key={i} className="particle" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`
            }}></div>
          ))}
        </div>
      </div>

      {/* Navbar */}
      <header className={`landing-navbar ${isScrolled ? 'scrolled' : ''}`}>
        <div className="nav-container">
          <div className="nav-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AudioWaveform size={24} color="#EC4899" />
            Viralify
          </div>
          <nav className="nav-links">
            <button className={isScrolled ? '' : 'active'} onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setMobileMenuOpen(false); }}>Home</button>
            <button onClick={() => { scrollToSection('about'); setMobileMenuOpen(false); }}>Why Viralify</button>
            <button onClick={() => { scrollToSection('about-viralify'); setMobileMenuOpen(false); }}>About</button>
            <button onClick={() => { scrollToSection('how-it-works'); setMobileMenuOpen(false); }}>Working</button>
            <button onClick={() => { scrollToSection('features'); setMobileMenuOpen(false); }}>Features</button>
            <button onClick={() => { scrollToSection('faq'); setMobileMenuOpen(false); }}>FAQs</button>
          </nav>
          <div className="nav-auth">
            <button className="nav-btn-login" onClick={handleLoginClick}>Login</button>
            <button className="nav-btn-signup" onClick={handleSignupClick}>Sign Up</button>
          </div>
          {/* Mobile Hamburger Toggle */}
          <button 
            className={`mobile-menu-toggle ${mobileMenuOpen ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
        
        {/* Mobile Navigation Drawer */}
        <div className={`mobile-nav-drawer ${mobileMenuOpen ? 'open' : ''}`}>
          <div className="mobile-nav-links">
            <button onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setMobileMenuOpen(false); }}>Home</button>
            <button onClick={() => { scrollToSection('about'); setMobileMenuOpen(false); }}>Why Viralify</button>
            <button onClick={() => { scrollToSection('about-viralify'); setMobileMenuOpen(false); }}>About</button>
            <button onClick={() => { scrollToSection('how-it-works'); setMobileMenuOpen(false); }}>Working</button>
            <button onClick={() => { scrollToSection('features'); setMobileMenuOpen(false); }}>Features</button>
            <button onClick={() => { scrollToSection('faq'); setMobileMenuOpen(false); }}>FAQs</button>
          </div>
          <div className="mobile-nav-auth">
            <button className="nav-btn-login" onClick={() => { handleLoginClick(); setMobileMenuOpen(false); }}>Login</button>
            <button className="nav-btn-signup" onClick={() => { handleSignupClick(); setMobileMenuOpen(false); }}>Sign Up</button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <Hero onLogin={handleLoginClick} onSignup={handleSignupClick} />

      {/* Statistics Section */}
      <section className="stats-section">
        <div className="container">
          <div className="stats-grid">
            <div className="stat-card glass-card hover-lift">
              <h3 className="text-gradient"><AnimatedCounter end={176000} suffix="+" /></h3>
              <p>Songs Analyzed</p>
            </div>
            <div className="stat-card glass-card hover-lift">
              <h3 className="text-gradient"><AnimatedCounter end={35} suffix="+" /></h3>
              <p>Engineered Features</p>
            </div>
            <div className="stat-card glass-card hover-lift">
              <h3 className="text-gradient"><AnimatedCounter end={12} /></h3>
              <p>Core Acoustic Features</p>
            </div>
            <div className="stat-card glass-card hover-lift">
              <h3 className="text-gradient"><AnimatedCounter end={3} /></h3>
              <p>Machine Learning Models</p>
            </div>
            <div className="stat-card glass-card hover-lift">
              <h3 className="text-gradient"><AnimatedCounter end={95} suffix="%" /></h3>
              <p>Prediction Accuracy</p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className={`about-section fade-up ${aboutVisible ? 'visible' : ''}`} ref={aboutRef}>
        <div className="container">
          <div className="about-card glass-card glow-border">
            <div className="about-icon"><Shield size={32} /></div>
            <h2>Why Viralify?</h2>
            <p>
              Thousands of songs are released every day, making it difficult for artists to understand what drives success.
              Viralify combines <strong>Artificial Intelligence, Digital Signal Processing, and Ensemble Machine Learning</strong> to
              analyze acoustic characteristics and estimate a song's viral potential. Instead of relying on guesswork,
              creators receive data-driven insights before releasing their music.
            </p>
          </div>
        </div>
      </section>

      {/* About Viralify Section */}
      <section id="about-viralify" className={`about-viralify-section fade-up ${aboutViralifyVisible ? 'visible' : ''}`} ref={aboutViralifyRef}>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '1500px' }}>
          <div className="section-header text-center" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2>AI-Powered <span className="text-gradient">Music Intelligence</span></h2>
          </div>

          <div className="about-viralify-grid">
            {/* Left Side: Mock Dashboard */}
            <div className="about-viralify-left fade-up-delay-1">
              <div className="mock-dashboard-wrapper">
                <div className="mock-radial-glow"></div>

                {/* Floating Particles */}
                <div className="mock-particles">
                  <div className="m-particle p1"></div>
                  <div className="m-particle p2"></div>
                  <div className="m-particle p3"></div>
                  <div className="m-note n1"><Music size={16} /></div>
                  <div className="m-note n2"><Music size={12} /></div>
                </div>

                <div className="mock-dashboard premium-glass">
                  {/* Top Bar */}
                  <div className="mock-dash-top">
                    <div className="mock-dash-title">Song Analysis</div>
                    <div className="mock-dash-song">
                      <span className="md-label">Song Name:</span>
                      <span className="md-value">Dream Horizon</span>
                    </div>
                    <div className="mock-dash-status">
                      <span className="md-label">Prediction Status:</span>
                      <span className="md-value md-success">Likely Viral</span>
                    </div>
                  </div>

                  {/* Body Grid */}
                  <div className="mock-dash-body">
                    {/* Circle Score */}
                    <div className="mock-dash-score-card">
                      <div className="circular-progress-ring">
                        <svg viewBox="0 0 100 100">
                          <circle className="ring-bg" cx="50" cy="50" r="45"></circle>
                          <circle className="ring-fill" cx="50" cy="50" r="45"></circle>
                        </svg>
                        <div className="ring-text">
                          <span className="rt-val">91</span><span className="rt-pct">%</span>
                        </div>
                      </div>
                      <div className="score-label">Virality Score</div>
                    </div>

                    {/* Features Bars */}
                    <div className="mock-dash-features">
                      <div className="m-feature">
                        <div className="m-feat-header">
                          <span>Energy</span><span>82%</span>
                        </div>
                        <div className="m-feat-bar"><div className="m-feat-fill" style={{ width: '82%' }}></div></div>
                      </div>
                      <div className="m-feature">
                        <div className="m-feat-header">
                          <span>Danceability</span><span>79%</span>
                        </div>
                        <div className="m-feat-bar"><div className="m-feat-fill" style={{ width: '79%' }}></div></div>
                      </div>
                      <div className="m-feature">
                        <div className="m-feat-header">
                          <span>Tempo</span><span>128 BPM</span>
                        </div>
                        <div className="m-feat-bar"><div className="m-feat-fill" style={{ width: '65%' }}></div></div>
                      </div>
                      <div className="m-feature">
                        <div className="m-feat-header">
                          <span>Valence</span><span>72%</span>
                        </div>
                        <div className="m-feat-bar"><div className="m-feat-fill" style={{ width: '72%' }}></div></div>
                      </div>
                    </div>

                    {/* Waveform Box */}
                    <div className="mock-dash-waveform">
                      <div className="m-wave-container">
                        {[...Array(40)].map((_, i) => (
                          <div key={i} className="m-wave-bar" style={{
                            height: `${20 + Math.random() * 80}%`,
                            animationDelay: `${Math.random() * 0.5}s`
                          }}></div>
                        ))}
                      </div>
                      <div className="golden-hook-box">
                        <span className="gh-label">Golden Hook</span>
                        <span className="gh-time">00:48 - 01:03</span>
                        <span className="gh-strength">Strength: Excellent</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom EQ */}
                  <div className="mock-dash-bottom">
                    <div className="mini-eq">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="eq-bar" style={{ animationDelay: `${i * 0.1}s` }}></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side: Content */}
            <div className="about-viralify-right fade-up-delay-2">
              <h3 className="about-v-heading">Who We Are ;)</h3>
              <p className="about-v-desc">"All the features we offer👍"</p>

              <div className="about-highlights-grid">
                {[
                  { icon: <TrendingUp size={20} />, title: "AI Virality Prediction", desc: "Predict the likelihood of a song becoming viral using advanced machine learning." },
                  { icon: <AudioWaveform size={20} />, title: "Digital Signal Processing", desc: "Extract meaningful audio characteristics using Librosa." },
                  { icon: <Zap size={20} />, title: "Viral Hook Detection", desc: "Identify the strongest and most engaging part of a song." },
                  { icon: <PieChart size={20} />, title: "Interactive Audio Analytics", desc: "Visualize important musical insights through modern dashboards." },
                  { icon: <Lightbulb size={20} />, title: "AI-Powered Recommendations", desc: "Receive actionable suggestions to improve your song's viral potential before release." },
                  { icon: <Lock size={20} />, title: "Secure Audio Processing", desc: "Uploaded songs are analyzed securely and are not permanently stored." },
                  {
                    icon: <Mic size={20} />,
                    title: "Live Audio Recording",
                    desc: "Record your song directly from your microphone for instant AI analysis."
                  },
                  {
                    icon: <FileText size={20} />,
                    title: "PDF Report",
                    desc: "Generate and download a comprehensive music analysis PDF report."
                  }
                ].map((hl, i) => (
                  <div key={i} className="a-highlight-item">
                    <div className="ahl-icon">{hl.icon}</div>
                    <div className="ahl-content">
                      <h5>{hl.title}</h5>
                      <p>{hl.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className={`how-section fade-up ${howItWorksVisible ? 'visible' : ''}`} ref={howItWorksRef}>
        <div className="container">
          <div className="how-bg-glow"></div>

          <div className="section-header text-center">
            <h2 className="fade-up-delay-2">How It <span className="text-gradient">Works</span></h2>
            <p className="fade-up-delay-3 subtitle-glow">
              Four simple steps to unlock your track's potential using AI-powered music analysis.
            </p>
          </div>

          <div className="steps-container steps-grid fade-up-delay-4">
            {/* Card 1 */}
            <div className="step-card premium-glass hover-lift-scale">
              <div className="step-number">01</div>
              <div className="step-icon-wrapper"><Music size={52} /></div>
              <h3>Upload Song</h3>
              <div className="step-divider"></div>
              <p>Upload your MP3 or WAV file for AI analysis.</p>
              <div className="step-glow"></div>

              <div className="grid-connector">
                <div className="conn-line"></div>
                <div className="conn-node"><ArrowRight size={16} /></div>
                <div className="conn-line"></div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="step-card premium-glass hover-lift-scale">
              <div className="step-number">02</div>
              <div className="step-icon-wrapper"><AudioWaveform size={52} /></div>
              <h3>Feature Extraction</h3>
              <div className="step-divider"></div>
              <p>Extract tempo, rhythm, MFCCs and acoustic features.</p>
              <div className="step-glow"></div>

              <div className="grid-connector">
                <div className="conn-line"></div>
                <div className="conn-node"><ArrowRight size={16} /></div>
                <div className="conn-line"></div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="step-card premium-glass hover-lift-scale">
              <div className="step-number">03</div>
              <div className="step-icon-wrapper"><Cpu size={52} /></div>
              <h3>AI Prediction</h3>
              <div className="step-divider"></div>
              <p>Our ML ensemble predicts your song's viral potential.</p>
              <div className="step-glow"></div>

              <div className="grid-connector">
                <div className="conn-line"></div>
                <div className="conn-node"><ArrowRight size={16} /></div>
                <div className="conn-line"></div>
              </div>
            </div>

            {/* Card 4 */}
            <div className="step-card premium-glass hover-lift-scale">
              <div className="step-number">04</div>
              <div className="step-icon-wrapper"><FileText size={52} /></div>
              <h3>Detailed Report</h3>
              <div className="step-divider"></div>
              <p>View insights, hook analysis and downloadable reports.</p>
              <div className="step-glow"></div>
            </div>
          </div>

          <div className="how-bottom-note fade-up-delay-5">
            <Shield size={16} className="note-icon" />
            <span>Your audio is processed securely. Uploaded files are never permanently stored.</span>
          </div>

          <div className="how-animated-waveform">
            {[...Array(40)].map((_, i) => (
              <div key={i} className="wave-line" style={{ animationDelay: `${i * 0.1}s` }}></div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className={`features-section fade-up ${featuresVisible ? 'visible' : ''}`} ref={featuresRef}>
        <div className="features-wide-container">
          <div className="section-header text-center">
            <h2>Platform <span className="text-gradient">Features</span></h2>
            <p className="subtitle-glow">Everything you need to engineer a hit</p>
          </div>

          <div className="features-carousel-wrapper">
            <div className="features-carousel">
              {[
                { icon: <TrendingUp size={28} />, title: 'AI Virality Prediction', desc: 'Get a 0-100% score of your hit potential' },
                { icon: <Zap size={28} />, title: 'Viral Hook Detection', desc: 'Identify the exact timestamp of your best hook' },
                { icon: <Music size={28} />, title: 'Audio Feature Analysis', desc: 'Deep dive into 12 core musical DNA traits' },
                { icon: <AudioWaveform size={28} />, title: 'Digital Signal Processing', desc: 'Advanced spectrogram and MFCC extraction' },
                { icon: <Settings size={28} />, title: 'Feature Engineering', desc: '35+ synthesized relationships for accurate ML' },
                { icon: <PieChart size={28} />, title: 'Interactive Dashboard', desc: 'Beautiful, responsive charts and meters' },
                { icon: <Mic size={28} />, title: 'Live Audio Recording', desc: 'Test ideas directly from your microphone' },
                { icon: <Sparkles size={28} />, title: 'AI Recommendations', desc: 'Actionable steps to improve your track' },
                { icon: <Download size={28} />, title: 'PDF Report', desc: 'Export your analysis for your team' },
                { icon: <Globe size={28} />, title: 'Multi-language Support', desc: 'Accessible to creators worldwide' }
              ].map((f, i) => (
                <div key={i} className="feature-card">
                  <div className="f-icon-wrapper">{f.icon}</div>
                  <h4>{f.title}</h4>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>

            {/* Scroll Hint Arrow */}
            <div className="carousel-scroll-hint">
              <ArrowRight size={24} />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className={`faq-section fade-up ${faqVisible ? 'visible' : ''}`} ref={faqRef}>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <div className="section-header text-center" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2>Frequently Asked <span className="text-gradient">Questions</span></h2>
            <p className="subtitle-glow">Find quick answers about how Viralify works, our AI prediction process, and the platform's capabilities.</p>
          </div>

          <div className="faq-grid">
            {[
              {
                q: "How does Viralify predict a song's viral potential?",
                a: "Viralify analyzes acoustic features such as tempo, energy, danceability, loudness, and rhythm using Digital Signal Processing. These features are then evaluated by an Ensemble Machine Learning model to estimate the song's viral potential."
              },
              {
                q: "What audio formats are supported?",
                a: "You can upload songs in MP3 or WAV format. The platform securely processes the audio to extract musical features required for AI analysis."
              },
              {
                q: "What is Viral Hook Detection?",
                a: "Our Viral Hook Detection identifies the most engaging segment of your song by analyzing energy, rhythm, and musical patterns that are likely to capture listener attention."
              },
              {
                q: "Which Machine Learning models are used?",
                a: "Viralify uses an Ensemble Learning approach combining Random Forest, XGBoost, and Logistic Regression to improve prediction accuracy and reliability."
              },
              {
                q: "Does Viralify store my uploaded songs?",
                a: "No. Uploaded audio files are processed only for analysis and are not permanently stored, ensuring your music remains private and secure."
              },
              {
                q: "Can Viralify help improve my song?",
                a: "Yes. Along with the Virality Score, Viralify provides AI-powered insights, feature analysis, and recommendations to help improve your song before release."
              }
            ].map((faq, i) => (
              <div
                key={i}
                className={`faq-card premium-glass ${activeFaq === i ? 'active' : ''}`}
                onClick={() => setActiveFaq(activeFaq === i ? null : i)}
              >
                <div className="faq-question">
                  <h4>{faq.q}</h4>
                  <div className="faq-icon">
                    {activeFaq === i ? <Minus size={20} /> : <Plus size={20} />}
                  </div>
                </div>
                <div className="faq-answer">
                  <p>{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>





      {/* Footer */}
      <footer className="landing-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <div className="nav-logo">Viralify</div>
            <p>Empowering independent creators with data-driven musical insights.</p>
          </div>
          <div className="footer-links">
            <h4>Quick Links</h4>
            <a onClick={() => scrollToSection('about')}>About</a>
            <a onClick={() => scrollToSection('how-it-works')}>How it Works</a>
            <a onClick={() => scrollToSection('features')}>Features</a>
          </div>
          <div className="footer-links">
            <h4>Technology</h4>
            <a href="#">Machine Learning</a>
            <a href="#">Signal Processing</a>
            <a href="#">API Documentation</a>
          </div>
          <div className="footer-links">
            <h4>Connect</h4>
            <a href="#">Contact Us</a>
            <a href="#">GitHub</a>
            <a href="#">Twitter</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Viralify. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
