import React from 'react'
import '../styles/landing-v2.css'

const tabPanels = [
  {
    title: 'Find Hospitals Near You - Instantly',
    image: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=700&q=80',
    tags: ['Geolocation', 'Real-time', 'Ratings', 'Directions'],
    description:
      'Type a service, allow your location, and instantly see ranked hospitals with distance, ratings, and available specialists.',
    cta: 'Try Hospital Search',
  },
  {
    title: 'AI-Powered Symptom Analysis',
    image: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=700&q=80',
    tags: ['98% Accuracy', 'Instant', 'Private', 'Multi-language'],
    description:
      'Describe your symptoms in plain language. Our AI model provides clear, actionable guidance with a recommendation to consult a doctor.',
    cta: 'Try AI Assistant',
  },
  {
    title: 'Connect With Verified Doctors',
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=700&q=80',
    tags: ['Verified', 'Reviews', 'Direct Contact', 'Specialties'],
    description:
      'Browse detailed profiles of verified doctors including specialization, patient reviews, and direct contact information.',
    cta: 'Find a Doctor',
  },
]

function LandingPage({ navScrolled, onShowAuth, currentUser, onContinueToDashboard }) {
  const [activeTab, setActiveTab] = React.useState(0)
  const [typedText, setTypedText] = React.useState('EXCELLENCE.')
  const [scrollProgress, setScrollProgress] = React.useState(0)
  const [counts, setCounts] = React.useState({ c1: 0, c2: 0, c3: 0, sc1: 0, sc2: 0, sc3: 0, sc4: 0 })

  React.useEffect(() => {
    const words = ['EXCELLENCE.', 'INNOVATION.', 'WELLNESS.', 'THE FUTURE.']
    let wi = 0
    let ci = 0
    let del = false

    const tick = () => {
      const current = words[wi]
      if (!del && ci < current.length) {
        ci += 1
        setTypedText(current.slice(0, ci))
        return window.setTimeout(tick, 80)
      }
      if (!del && ci === current.length) {
        del = true
        return window.setTimeout(tick, 1200)
      }
      if (del && ci > 0) {
        ci -= 1
        setTypedText(current.slice(0, ci))
        return window.setTimeout(tick, 40)
      }

      del = false
      wi = (wi + 1) % words.length
      return window.setTimeout(tick, 240)
    }

    const timer = tick()
    return () => window.clearTimeout(timer)
  }, [])

  React.useEffect(() => {
    const handleScroll = () => {
      const doc = document.documentElement
      const max = doc.scrollHeight - doc.clientHeight
      if (max <= 0) {
        setScrollProgress(0)
        return
      }
      setScrollProgress((window.scrollY / max) * 100)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  React.useEffect(() => {
    const revealTargets = Array.from(document.querySelectorAll('.landing-v2 .reveal, .landing-v2 .step'))

    if (typeof window.IntersectionObserver === 'undefined') {
      revealTargets.forEach((el) => el.classList.add('vis'))
      return undefined
    }

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('vis')
        revealObserver.unobserve(entry.target)
      })
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' })

    revealTargets.forEach((el) => revealObserver.observe(el))

    // Fallback: ensure sections are visible even if observer does not fire.
    const revealFallbackTimer = window.setTimeout(() => {
      revealTargets.forEach((el) => el.classList.add('vis'))
    }, 1500)

    const statsObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return

        const animate = (key, target, suffix = '', duration = 1800) => {
          let start = null
          const run = (ts) => {
            if (!start) start = ts
            const progress = Math.min((ts - start) / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            const value = Math.round(eased * target)
            setCounts((prev) => ({ ...prev, [key]: value }))
            if (progress < 1) window.requestAnimationFrame(run)
          }
          window.requestAnimationFrame(run)
          return suffix
        }

        if (entry.target.id === 'hero-stats') {
          animate('c1', 2400)
          animate('c2', 98)
          animate('c3', 500)
        }

        if (entry.target.id === 'stats-band') {
          animate('sc1', 2400)
          animate('sc2', 98)
          animate('sc3', 500)
          animate('sc4', 120)
        }

        statsObserver.unobserve(entry.target)
      })
    }, { threshold: 0.2 })

    const heroStats = document.getElementById('hero-stats')
    const statsBand = document.getElementById('stats-band')
    if (heroStats) statsObserver.observe(heroStats)
    if (statsBand) statsObserver.observe(statsBand)

    return () => {
      window.clearTimeout(revealFallbackTimer)
      revealObserver.disconnect()
      statsObserver.disconnect()
    }
  }, [])

  const activePanel = tabPanels[activeTab]
  const hasSessionUser = Boolean(currentUser)
  const handlePrimaryAction = () => {
    if (hasSessionUser) {
      onContinueToDashboard?.()
      return
    }
    onShowAuth('signup')
  }
  const handleSecondaryAction = () => {
    if (hasSessionUser) {
      onContinueToDashboard?.()
      return
    }
    onShowAuth('login')
  }

  return (
    <div className="landing-v2">
      <div className="progress" style={{ width: `${scrollProgress}%` }}></div>

      <nav className={`v2-nav ${navScrolled ? 'scrolled' : ''}`}>
        <a href="#" className="v2-logo">Healthcare<span>Hub</span></a>
        <div className="v2-links">
          <a href="#features" className="v2-link">Features</a>
          <a href="#how" className="v2-link">How It Works</a>
          <a href="#about" className="v2-link">About</a>
          <button className="v2-link" onClick={handleSecondaryAction}>{hasSessionUser ? 'Open Dashboard' : 'Login'}</button>
          <button className="mag-btn btn-glow" onClick={handlePrimaryAction}>{hasSessionUser ? 'Continue' : 'Get Started'}</button>
        </div>
      </nav>

      <section className="hero-v2">
        <div className="orb orb1"></div>
        <div className="orb orb2"></div>
        <div className="orb orb3"></div>
        <div className="hero-inner">
          <div>
            <div className="hero-badge"><span className="pulse"></span>AI-Powered Health Platform</div>
            <h1 className="h1">
              YOUR JOURNEY<br />TO
              <span className="h1-accent">{typedText}<span className="cursor-blink"></span></span>
            </h1>
            <p className="hero-sub">Discover nearby hospitals, analyze symptoms with AI, and manage your health journey in one beautiful, secure platform.</p>
            <div className="hero-btns">
              <button className="mag-btn btn-glow btn-hero" onClick={handlePrimaryAction}>{hasSessionUser ? 'Continue to Dashboard' : 'Get Started Free'}</button>
              <a href="#features" className="mag-btn btn-ghost btn-hero">Explore Features</a>
            </div>
            <div className="hero-stats" id="hero-stats">
              <div className="stat"><h3>{counts.c1}+</h3><p>Hospitals</p></div>
              <div className="stat"><h3>{counts.c2}%</h3><p>AI Accuracy</p></div>
              <div className="stat"><h3>{counts.c3}K</h3><p>Happy Users</p></div>
            </div>
          </div>

          <div className="hero-vis reveal">
            <div className="hero-img-wrap">
              <div className="scan-line"></div>
              <img src="https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=900&q=80" alt="Hospital" className="hero-img" />
            </div>
            <div className="chip chip1">
              <div className="chip-icon">🏥</div>
              <div><p className="chip-name">City Health Hospital</p><p className="chip-sub">4.9 · 2.3km away</p></div>
            </div>
            <div className="chip chip2">
              <div className="chip-icon">🤖</div>
              <div><p className="chip-name">AI Diagnosis</p><p className="chip-sub green">Active Now</p></div>
            </div>
          </div>
        </div>
      </section>

      <div className="ribbon"><div className="ribbon-inner"><span className="ribbon-text">SIMPLE ✦ FUNCTIONAL ✦ SECURE ✦ AI-POWERED ✦ 24/7 SUPPORT ✦ SIMPLE ✦ FUNCTIONAL ✦ SECURE ✦ AI-POWERED ✦ 24/7 SUPPORT ✦</span></div></div>

      <section className="section" id="features">
        <div className="section-inner">
          <div className="centered">
            <span className="sec-label">What We Offer</span>
            <h2 className="sec-title">Intelligent Features</h2>
            <div className="divider"></div>
            <p className="sec-sub">Experience the next generation of healthcare technology, designed for everyone.</p>
          </div>
          <div className="feat-grid">
            <div className="feat-card reveal">
              <img src="https://images.unsplash.com/photo-1516549655169-df83a0774514?w=600&q=80" alt="Hospital Search" className="feat-card-img" />
              <div className="feat-body">
                <div className="feat-num">01</div>
                <h3 className="feat-title">Nearby Discovery</h3>
                <p className="feat-desc">Instantly locate top-rated hospitals and clinics near you with precise geolocation technology.</p>
                <button className="feat-arrow" onClick={handlePrimaryAction}>Explore <span>→</span></button>
              </div>
            </div>
            <div className="feat-card reveal">
              <img src="https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=600&q=80" alt="AI" className="feat-card-img" />
              <div className="feat-body">
                <div className="feat-num">02</div>
                <h3 className="feat-title">AI Assistant</h3>
                <p className="feat-desc">Our intelligent AI analyzes your symptoms and provides instant, reliable preliminary guidance.</p>
                <button className="feat-arrow" onClick={handlePrimaryAction}>Explore <span>→</span></button>
              </div>
            </div>
            <div className="feat-card reveal">
              <img src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&q=80" alt="Doctors" className="feat-card-img" />
              <div className="feat-body">
                <div className="feat-num">03</div>
                <h3 className="feat-title">Doctor Profiles</h3>
                <p className="feat-desc">Access detailed specialist info including reviews, availability, and contact details.</p>
                <button className="feat-arrow" onClick={handlePrimaryAction}>Explore <span>→</span></button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="toggle-section" id="about">
        <div className="section-inner">
          <span className="sec-label">Deep Dive</span>
          <h2 className="sec-title reveal">Explore Every Capability</h2>
          <div className="tab-row">
            <button className={`tab ${activeTab === 0 ? 'active' : ''}`} onClick={() => setActiveTab(0)}>Hospital Search</button>
            <button className={`tab ${activeTab === 1 ? 'active' : ''}`} onClick={() => setActiveTab(1)}>AI Diagnosis</button>
            <button className={`tab ${activeTab === 2 ? 'active' : ''}`} onClick={() => setActiveTab(2)}>Doctor Connect</button>
          </div>
          <div className="panel active">
            <img src={activePanel.image} className="panel-img" alt={activePanel.title} />
            <div>
              <h3 className="panel-title">{activePanel.title}</h3>
              <div className="panel-tag">
                {activePanel.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
              </div>
              <p className="panel-desc">{activePanel.description}</p>
              <button className="mag-btn btn-glow" onClick={handlePrimaryAction}>{hasSessionUser ? 'Continue to Dashboard' : `${activePanel.cta} →`}</button>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="section-inner centered">
          <span className="sec-label">The Process</span>
          <h2 className="sec-title">How It Works</h2>
          <div className="steps">
            <div className="step"><div className="step-ring"><span className="step-num-txt">01</span></div><h3 className="step-title">Provide Location</h3><p className="step-desc">Allow browser location or enter your city manually to filter local results instantly.</p></div>
            <div className="step"><div className="step-ring"><span className="step-num-txt">02</span></div><h3 className="step-title">Search Service</h3><p className="step-desc">Type the service you need from general checkups to specialist care.</p></div>
            <div className="step"><div className="step-ring"><span className="step-num-txt">03</span></div><h3 className="step-title">Get Details</h3><p className="step-desc">View doctor profiles, contact info, ratings, and complete addresses instantly.</p></div>
          </div>
        </div>
      </section>

      <div className="stats-band" id="stats-band">
        <div className="stats-inner">
          <div className="stat-block"><div className="stat-val">{counts.sc1}+</div><div className="stat-lbl">Hospitals Listed</div></div>
          <div className="stat-block"><div className="stat-val">{counts.sc2}%</div><div className="stat-lbl">AI Accuracy Rate</div></div>
          <div className="stat-block"><div className="stat-val">{counts.sc3}K</div><div className="stat-lbl">Active Users</div></div>
          <div className="stat-block"><div className="stat-val">{counts.sc4}+</div><div className="stat-lbl">Cities Covered</div></div>
        </div>
      </div>

      <section className="section cta-section">
        <div className="cta-grid">
          <div>
            <h2 className="cta-h">Ready to take control of your health?</h2>
            <p className="cta-p">Join users making smarter health decisions every day.</p>
          </div>
          <div className="cta-btns">
            <button className="mag-btn btn-glow" onClick={handlePrimaryAction}>{hasSessionUser ? 'Continue to Dashboard' : 'Create Free Account'}</button>
            <button className="mag-btn btn-ghost" onClick={handleSecondaryAction}>{hasSessionUser ? 'Open Dashboard' : 'Login Now'}</button>
          </div>
        </div>
      </section>

      <footer>
        <div className="footer-grid">
          <div>
            <p className="foot-logo">Healthcare<span>Hub</span></p>
            <p className="foot-desc">Your trusted digital health companion for discovering healthcare solutions and managing your wellness journey with AI.</p>
          </div>
          <div className="foot-col"><h5>Product</h5><ul><li><a href="#features">Features</a></li><li><a href="#">Pricing</a></li><li><a href="#">Security</a></li></ul></div>
          <div className="foot-col"><h5>Company</h5><ul><li><a href="#about">About</a></li><li><a href="#">Blog</a></li><li><a href="#">Careers</a></li></ul></div>
          <div className="foot-col"><h5>Legal</h5><ul><li><a href="#">Privacy</a></li><li><a href="#">Terms</a></li><li><a href="#">Contact</a></li></ul></div>
        </div>
        <div className="foot-bottom">
          <p>© 2026 HealthcareHub. All rights reserved.</p>
          <p>Made for healthier lives</p>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
