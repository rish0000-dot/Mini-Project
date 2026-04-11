import React from 'react'

function LandingPage({ navScrolled, onShowAuth }) {
  React.useEffect(() => {
    // Reveal animation observer
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible')
      })
    }, { threshold: 0.1 })

    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el))

    return () => revealObserver.disconnect()
  }, [])

  return (
    <>
      {/* NAVBAR */}
      <nav id="main-nav" className={`navbar ${navScrolled ? 'scrolled' : ''}`}>
        <div className="container nav-container">
          <a href="#" className="nav-logo">Healthcare<span>Hub</span></a>
          <div className="nav-links">
            <a href="#features" className="nav-link">Features</a>
            <a href="#how" className="nav-link">How It Works</a>
            <button 
              className="btn-text" 
              style={{ background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }}
              onClick={() => onShowAuth('login')}
            >
              Login
            </button>
            <button 
              className="btn btn-primary" 
              style={{ padding: '10px 20px' }}
              onClick={() => onShowAuth('signup')}
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* LANDING PAGE */}
      <main id="landing-page" className="view">
        {/* HERO SECTION */}
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-content reveal">
              <div className="hero-badge">
                <span className="dot"></span> AI-Powered Health Platform
              </div>
              <h1>Your Journey to <i>Healthcare</i> Excellence.</h1>
              <p className="hero-subtext">Discover nearby hospitals, analyze symptoms with AI, and manage your health journey in one beautiful, secure platform.</p>
              <div className="hero-btns">
                <button className="btn btn-primary" onClick={() => onShowAuth('signup')}>Get Started Free</button>
                <a href="#features" className="btn btn-outline" style={{ textDecoration: 'none' }}>Explore Features</a>
              </div>
              <div className="hero-stats">
                <div className="stat-item"><h3>2.4K+</h3><p>Hospitals</p></div>
                <div className="stat-item"><h3>98%</h3><p>AI Accuracy</p></div>
                <div className="stat-item"><h3>500K</h3><p>Happy Users</p></div>
              </div>
            </div>
            <div className="hero-visuals">
              <div className="blob" style={{ top: '-100px', right: '-100px' }}></div>
              <img src="https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800&q=80" alt="Modern Hospital" className="hero-main-img" />
              <div className="img-overlay"></div>
              <div className="floating-card card-1">
                <div className="card-icon" style={{ background: '#e0f2fe', color: '#0369a1' }}>🏥</div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>City Health Hospital</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>⭐ 4.9 Rating</p>
                </div>
              </div>
              <div className="floating-card card-2">
                <div className="card-icon" style={{ background: '#ecfdf5', color: '#065f46' }}>🤖</div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>AI Diagnosis Ready</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active Now</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DARK RIBBON */}
        <div className="ribbon-bar">
          <div className="ribbon-content">
            <span>SIMPLE ✦ FUNCTIONAL ✦ SECURE ✦ AI-POWERED ✦ 24/7 SUPPORT</span>
          </div>
        </div>

        {/* FEATURES SECTION */}
        <section id="features" className="section">
          <div className="container" style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '3rem', marginBottom: '16px' }}>Intelligent Features</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto 60px' }}>Experience the next generation of healthcare technology at your fingertips.</p>
            <div className="features-grid">
              <div className="feature-card reveal">
                <div className="feature-img-box">
                  <img src="https://images.unsplash.com/photo-1516549655169-df83a0774514?w=600&q=80" alt="Hospital Search" />
                </div>
                <h3>Nearby Discovery</h3>
                <p>Instantly locate top-rated hospitals and clinics near you with precise geolocation.</p>
                <a href="#" className="learn-more" onClick={(e) => { e.preventDefault(); onShowAuth('signup') }}>Learn more <span>→</span></a>
              </div>
              <div className="feature-card reveal" style={{ animationDelay: '0.2s' }}>
                <div className="feature-img-box">
                  <img src="https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=600&q=80" alt="AI Agent" />
                </div>
                <h3>AI Assistant</h3>
                <p>Our intelligent AI analyzes symptoms and provides instant preliminary guidance.</p>
                <a href="#" className="learn-more" onClick={(e) => { e.preventDefault(); onShowAuth('signup') }}>Learn more <span>→</span></a>
              </div>
              <div className="feature-card reveal" style={{ animationDelay: '0.4s' }}>
                <div className="feature-img-box">
                  <img src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&q=80" alt="Doctor Profiles" />
                </div>
                <h3>Doctor Profiles</h3>
                <p>Access detailed information about specialists, including degrees and contact details.</p>
                <a href="#" className="learn-more" onClick={(e) => { e.preventDefault(); onShowAuth('signup') }}>Learn more <span>→</span></a>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="section how-it-works">
          <div className="container" style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '3rem', marginBottom: '60px' }}>How It Works</h2>
            <div className="steps-grid">
              <div className="step-card reveal">
                <div className="step-number">1</div>
                <h3>Provide Location</h3>
                <p>Allow browser location or enter your city manually to filter local results.</p>
              </div>
              <div className="step-card reveal" style={{ animationDelay: '0.2s' }}>
                <div className="step-number">2</div>
                <h3>Search Service</h3>
                <p>Type the service you need—from general checkups to specialized surgery.</p>
              </div>
              <div className="step-card reveal" style={{ animationDelay: '0.4s' }}>
                <div className="step-number">3</div>
                <h3>Get Details</h3>
                <p>Instantly view doctor details, contact numbers, and complete addresses.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA BANNER */}
        <section className="section cta-banner">
          <div className="container">
            <div className="cta-container reveal">
              <div className="cta-left">
                <h2>Ready to take control?</h2>
                <p>Join thousands of users managing their health more effectively.</p>
              </div>
              <div className="cta-right">
                <button className="btn btn-white" onClick={() => onShowAuth('signup')}>Create Free Account</button>
                <button className="btn btn-outline-white" onClick={() => onShowAuth('login')}>Login Now</button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer id="main-footer" className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <h4>Healthcare<span style={{ color: 'var(--accent)' }}>Hub</span></h4>
              <p>Your trusted digital health companion for discovering healthcare solutions and managing your wellness journey.</p>
              <div className="social-links">
                <a href="#" className="social-btn">f</a>
                <a href="#" className="social-btn">𝕏</a>
                <a href="#" className="social-btn">in</a>
              </div>
            </div>
            <div className="footer-col">
              <h5>Product</h5>
              <ul>
                <li><a href="#">Features</a></li>
                <li><a href="#">Pricing</a></li>
                <li><a href="#">Security</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h5>Company</h5>
              <ul>
                <li><a href="#">About</a></li>
                <li><a href="#">Blog</a></li>
                <li><a href="#">Careers</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h5>Legal</h5>
              <ul>
                <li><a href="#">Privacy</a></li>
                <li><a href="#">Terms</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2024 Healthcare Hub. All rights reserved.</p>
            <p>Made with ❤️ by the Health Team</p>
          </div>
        </div>
      </footer>
    </>
  )
}

export default LandingPage
