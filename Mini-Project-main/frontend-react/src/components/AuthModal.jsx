import React, { useState, useEffect, useRef } from 'react'
import { supabaseClient } from '../utils/supabase'

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Syne:wght@400;600;700;800&family=Space+Grotesk:wght@300;400;500;600;700&family=Italiana&display=swap');

:root {
  --auth-bg: #03070f;
  --auth-c: #00e5ff;
  --auth-c2: #7b2fff;
  --auth-c3: #ff2d78;
  --auth-cg: linear-gradient(135deg, #00e5ff, #7b2fff);
  --auth-card: rgba(6, 14, 30, 0.95);
  --auth-border: rgba(0, 229, 255, 0.18);
  --auth-muted: rgba(180, 210, 255, 0.5);
  --auth-white: #eef4ff;
  --auth-input-bg: rgba(255, 255, 255, 0.04);
  --auth-input-border: rgba(0, 229, 255, 0.2);
  --auth-input-focus: rgba(0, 229, 255, 0.6);
}

.auth-overlay {
  position: fixed; inset: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  opacity: 0; pointer-events: none;
  transition: opacity 0.4s ease;
}
.auth-overlay.open {
  opacity: 1; pointer-events: all;
}
.auth-overlay-bg {
  position: absolute; inset: 0;
  background: rgba(3, 7, 15, 0.85);
  backdrop-filter: blur(12px);
}

.auth-canvas {
  position: absolute; inset: 0; pointer-events: none; z-index: 0;
}

.auth-scene {
  position: relative; z-index: 2;
  perspective: 1200px;
  width: 100%; max-width: 920px;
  animation: sceneIn 0.6s cubic-bezier(0.23,1,0.32,1) both;
}
@keyframes sceneIn {
  from { transform: translateY(60px) scale(0.9); opacity: 0; }
  to   { transform: translateY(0) scale(1); opacity: 1; }
}

.auth-flip {
  position: relative;
  transform-style: preserve-3d;
  transition: none;
  min-height: 600px;
}
.auth-flip.flipped { transform: rotateY(180deg); }

.auth-face {
  position: absolute; inset: 0;
  backface-visibility: hidden;
  display: grid; grid-template-columns: 1fr 1fr;
  border-radius: 28px; overflow: hidden;
  border: 1px solid var(--auth-border);
  box-shadow: 0 0 80px rgba(0,229,255,0.1), 0 40px 100px rgba(0,0,0,0.6);
}
.auth-face.back {
  transform: rotateY(180deg);
}

.auth-left {
  background: linear-gradient(160deg, rgba(0,229,255,0.12), rgba(123,47,255,0.15));
  position: relative; overflow: hidden;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 50px 40px; text-align: center;
}
.auth-left::before {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at 30% 20%, rgba(0,229,255,0.15), transparent 60%),
              radial-gradient(ellipse at 70% 80%, rgba(123,47,255,0.2), transparent 60%);
}
.auth-left-grid {
  position: absolute; inset: 0; opacity: 0.07;
  background-image: linear-gradient(rgba(0,229,255,0.8) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0,229,255,0.8) 1px, transparent 1px);
  background-size: 32px 32px;
}
.left-emoji-3d {
  font-size: 4.5rem; position: relative; z-index: 2; margin-bottom: 28px;
  animation: none;
  filter: drop-shadow(0 0 20px rgba(0,229,255,0.6));
  display: block; transform-style: preserve-3d;
}
@keyframes floatEmoji {
  0%,100% { transform: translateY(0) rotateY(0deg); }
  25%      { transform: translateY(-12px) rotateY(20deg); }
  75%      { transform: translateY(-6px) rotateY(-15deg); }
}
.left-heading {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 2.6rem; letter-spacing: 3px; line-height: 1;
  color: var(--auth-white); position: relative; z-index: 2; margin-bottom: 14px;
}
.left-heading span {
  font-family: 'Italiana', serif;
  color: var(--auth-c); font-style: italic; display: block;
  font-size: 2rem; letter-spacing: 1px;
}
.left-sub {
  color: var(--auth-muted); font-family: 'Space Grotesk', sans-serif;
  font-size: 0.9rem; line-height: 1.75; position: relative; z-index: 2; margin-bottom: 32px;
}
.left-features { position: relative; z-index: 2; width: 100%; }
.left-feat {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; border-radius: 12px;
  border: 1px solid rgba(0,229,255,0.12);
  background: rgba(0,229,255,0.05);
  margin-bottom: 10px; text-align: left;
  animation: featSlide 0.6s ease both;
}
.left-feat:nth-child(2) { animation-delay: .1s; }
.left-feat:nth-child(3) { animation-delay: .2s; }
@keyframes featSlide { from{opacity:0;transform:translateX(-20px)} to{opacity:1;transform:translateX(0)} }
.lf-icon { font-size: 1.3rem; flex-shrink: 0; }
.lf-text { font-family: 'Space Grotesk', sans-serif; font-size: .82rem; color: var(--auth-white); font-weight: 500; }

.ring-orbit {
  position: absolute; border-radius: 50%;
  border: 1px solid rgba(0,229,255,0.15);
  pointer-events: none;
  animation: none;
}
.ring1 { width: 200px; height: 200px; top: -60px; right: -60px; animation-duration: 20s; }
.ring2 { width: 140px; height: 140px; bottom: -40px; left: -40px; animation-duration: 15s; reverse; }
.ring3 { width: 90px; height: 90px; top: 60%; right: -20px; animation-duration: 10s; }
@keyframes orbitSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.auth-right {
  background: var(--auth-card);
  padding: 48px 44px;
  display: flex; flex-direction: column; justify-content: center;
  font-family: 'Space Grotesk', sans-serif;
  max-height: min(86vh, 680px);
  overflow-y: scroll;
  scrollbar-width: thin;
  scrollbar-color: rgba(0,229,255,0.6) rgba(255,255,255,0.06);
}

.auth-right::-webkit-scrollbar {
  width: 10px;
}

.auth-right::-webkit-scrollbar-track {
  background: rgba(255,255,255,0.06);
  border-radius: 999px;
}

.auth-right::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(0,229,255,0.85), rgba(123,47,255,0.8));
  border-radius: 999px;
  border: 2px solid rgba(6,14,30,0.9);
}

.auth-right::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(0,229,255,1), rgba(123,47,255,0.95));
}
.auth-close {
  position: absolute; top: 18px; right: 18px; z-index: 10;
  width: 36px; height: 36px; border-radius: 50%;
  background: rgba(255,255,255,0.06); border: 1px solid var(--auth-border);
  color: var(--auth-muted); font-size: 1rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.3s; font-family: 'Space Grotesk', sans-serif;
}
.auth-close:hover { background: rgba(255,45,120,0.15); border-color: #ff2d78; color: #ff2d78; transform: none; }

.form-emoji { font-size: 2.8rem; margin-bottom: 14px; display: block;
  animation: bounceDrop 0.8s cubic-bezier(0.34,1.56,0.64,1) both;
  filter: drop-shadow(0 0 14px rgba(0,229,255,0.5));
}
@keyframes bounceDrop {
  from { transform: translateY(-30px) scale(0.5); opacity: 0; }
  to   { transform: translateY(0) scale(1); opacity: 1; }
}
.form-title {
  font-family: 'Syne', sans-serif; font-size: 1.9rem; font-weight: 800;
  color: var(--auth-white); margin-bottom: 6px; line-height: 1.1;
}
.form-subtitle { color: var(--auth-muted); font-size: .88rem; margin-bottom: 28px; line-height: 1.6; }

.input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 0; }
.inp-group { margin-bottom: 16px; }
.inp-label {
  display: flex; align-items: center; gap: 6px;
  font-size: .78rem; font-weight: 600; letter-spacing: .5px;
  color: var(--auth-c); text-transform: uppercase; margin-bottom: 8px;
}
.inp-label .lbl-icon { font-size: .9rem; }
.inp-wrap { position: relative; }
.auth-input {
  width: 100%; padding: 13px 16px; padding-left: 44px;
  background: var(--auth-input-bg);
  border: 1px solid var(--auth-input-border);
  border-radius: 12px; color: var(--auth-white);
  font-family: 'Space Grotesk', sans-serif; font-size: .9rem;
  transition: all 0.3s ease; outline: none;
}
.auth-input::placeholder { color: rgba(180,210,255,0.3); }
.auth-input:focus {
  border-color: var(--auth-c);
  background: rgba(0,229,255,0.06);
  box-shadow: 0 0 0 3px rgba(0,229,255,0.12), 0 0 20px rgba(0,229,255,0.08);
}
.auth-input:focus + .inp-icon { color: var(--auth-c); }
.inp-icon {
  position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
  font-size: 1rem; color: rgba(180,210,255,0.35); pointer-events: none;
  transition: color 0.3s;
}
.eye-btn {
  position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; font-size: 1rem;
  color: var(--auth-muted); transition: color 0.3s; padding: 0;
}
.eye-btn:hover { color: var(--auth-c); }

.terms-row {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 20px; cursor: pointer;
}
.custom-check {
  width: 20px; height: 20px; border-radius: 6px;
  border: 1.5px solid var(--auth-input-border);
  background: var(--auth-input-bg);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all 0.3s; font-size: .8rem;
}
.custom-check.checked { background: var(--auth-c); border-color: var(--auth-c); color: #000; box-shadow: 0 0 12px rgba(0,229,255,.4); }
.terms-text { font-size: .82rem; color: var(--auth-muted); }
.terms-text a { color: var(--auth-c); text-decoration: none; }

.auth-submit {
  width: 100%; padding: 15px;
  background: var(--auth-cg);
  border: none; border-radius: 14px;
  color: #000; font-family: 'Syne', sans-serif;
  font-weight: 700; font-size: 1rem; letter-spacing: .5px;
  cursor: pointer; position: relative; overflow: hidden;
  transition: transform 0.2s, box-shadow 0.3s;
  margin-bottom: 16px;
}
.auth-submit::before {
  content: ''; position: absolute; inset: 0;
  background: rgba(255,255,255,0.25);
  transform: translateX(-110%) skewX(-20deg);
  transition: transform 0.5s;
}
.auth-submit:hover::before { transform: translateX(120%) skewX(-20deg); }
.auth-submit:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,229,255,.4), 0 0 60px rgba(0,229,255,.15); }
.auth-submit:active { transform: scale(0.98); }
.auth-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
.btn-spinner {
  display: inline-block; width: 16px; height: 16px;
  border: 2px solid rgba(0,0,0,0.3); border-top-color: #000;
  border-radius: 50%; animation: spin .7s linear infinite;
  margin-right: 8px; vertical-align: middle;
}
@keyframes spin { to { transform: rotate(360deg); } }

.auth-divider { display: flex; align-items: center; gap: 12px; margin: 4px 0 16px; }
.auth-divider-line { flex: 1; height: 1px; background: var(--auth-border); }
.auth-divider-txt { font-size: .78rem; color: var(--auth-muted); letter-spacing: 1px; }

.google-btn {
  width: 100%; padding: 13px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 14px; color: var(--auth-white);
  font-family: 'Space Grotesk', sans-serif; font-weight: 600;
  font-size: .9rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  transition: all 0.3s; margin-bottom: 20px;
}
.google-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.25); transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,.3); }
.google-icon { width: 20px; height: 20px; flex-shrink: 0; }

.auth-switch { text-align: center; font-size: .85rem; color: var(--auth-muted); }
.switch-btn {
  background: none; border: none; cursor: pointer;
  font-weight: 700; font-size: .85rem; color: var(--auth-c);
  font-family: 'Space Grotesk', sans-serif;
  transition: text-shadow 0.3s;
}
.switch-btn:hover { text-shadow: 0 0 14px rgba(0,229,255,.7); }

.auth-error {
  padding: 12px 16px; border-radius: 12px;
  background: rgba(255,45,120,0.1); border: 1px solid rgba(255,45,120,.3);
  color: #ff6ba8; font-size: .85rem; margin-bottom: 16px;
  display: flex; align-items: center; gap: 8px;
  animation: shakeErr 0.4s ease;
}
@keyframes shakeErr {
  0%,100% {transform:translateX(0)} 25% {transform:translateX(-6px)} 75% {transform:translateX(6px)}
}
.auth-success {
  text-align: center; padding: 32px 16px;
  animation: successPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both;
}
@keyframes successPop { from{transform:scale(.7);opacity:0} to{transform:scale(1);opacity:1} }
.success-icon { font-size: 4rem; display: block; margin-bottom: 16px;
  animation: none;
  filter: drop-shadow(0 0 20px rgba(0,229,255,.6));
}
@keyframes spin3d { from{transform:rotateY(0deg) scale(.5)} to{transform:rotateY(360deg) scale(1)} }
.success-h { font-family: 'Syne',sans-serif; font-size: 1.5rem; font-weight: 800; margin-bottom: 10px; }
.success-p { color: var(--auth-muted); font-size: .9rem; margin-bottom: 24px; line-height: 1.7; }

.strength-wrap { margin-top: 6px; }
.strength-bars { display: flex; gap: 4px; margin-bottom: 4px; }
.sb { flex: 1; height: 3px; border-radius: 999px; background: rgba(255,255,255,.1); transition: background .3s; }
.sb.weak   { background: #ff2d78; }
.sb.medium { background: #ffaa00; }
.sb.strong { background: #00ff9d; }
.strength-label { font-size: .72rem; color: var(--auth-muted); }

.confetti-dot {
  position: absolute; width: 8px; height: 8px; border-radius: 50%;
  animation: confettiFly 1.2s ease-out forwards;
  pointer-events: none;
}
@keyframes confettiFly {
  0%   { transform: translate(0,0) scale(1); opacity: 1; }
  100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
}

@media (max-width: 680px) {
  .auth-face { grid-template-columns: 1fr; min-height: unset; }
  .auth-left  { display: none; }
  .auth-right { padding: 40px 28px; min-height: 580px; max-height: 84vh; }
  .input-row  { grid-template-columns: 1fr; }
}
`

function PasswordStrength({ password }) {
  const score = password.length === 0 ? 0
    : password.length < 6 ? 1
    : password.length < 10 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) ? 2
    : 3
  const labels = ['', 'Weak', 'Medium', 'Strong']
  const actualClass = score === 1 ? 'weak' : score === 2 ? 'medium' : score === 3 ? 'strong' : ''
  return (
    <div className="strength-wrap">
      <div className="strength-bars">
        {[0, 1, 2].map(i => (
          <div key={i} className={`sb ${i < score ? actualClass : ''}`} />
        ))}
      </div>
      {password.length > 0 && <span className="strength-label">{labels[score]} password</span>}
    </div>
  )
}

function ParticleCanvas({ canvasRef }) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let W = canvas.width = canvas.offsetWidth
    let H = canvas.height = canvas.offsetHeight
    const pts = Array.from({ length: 50 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .4, vy: (Math.random() - .5) * .4,
      r: Math.random() * 1.2 + .3
    }))
    let raf
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,229,255,0.45)'; ctx.fill()
      })
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < 100) {
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y)
            ctx.strokeStyle = `rgba(0,229,255,${.1 * (1 - d / 100)})`
            ctx.lineWidth = .5; ctx.stroke()
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [canvasRef])
  return <canvas ref={canvasRef} className="auth-canvas" style={{ width: '100%', height: '100%' }} />
}

export default function AuthModal({ isOpen, onClose, isSignUpMode, setIsSignUpMode, authError, setAuthError, onAuthSuccess }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)

  useEffect(() => {
    const tag = document.createElement('style')
    tag.textContent = STYLES
    document.head.appendChild(tag)
    return () => document.head.removeChild(tag)
  }, [])

  const resetForm = () => {
    setFirstName(''); setLastName(''); setEmail('')
    setPassword(''); setAgreeTerms(false); setShowPassword(false)
    setAuthError(''); setSuccessMessage(''); setShowSuccess(false)
  }

  useEffect(() => {
    if (!isOpen) {
      resetForm()
    }
  }, [isOpen])

  const handleSwitchMode = (e) => {
    if (e) e.preventDefault()
    resetForm()
    setIsSignUpMode((prev) => !prev)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSignUpMode && !agreeTerms) { setAuthError('Please agree to the terms.'); return }
    setIsLoading(true); setAuthError('')
    try {
      let result
      if (isSignUpMode) {
        result = await supabaseClient.auth.signUp({
          email, password,
          options: { data: { first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}` } }
        })
        if (result.error) throw result.error
        if (result.data.user && !result.data.session) {
          setSuccessMessage('Check your email to confirm your account!')
          setShowSuccess(true); return
        }
        setSuccessMessage('Account created successfully!')
      } else {
        result = await supabaseClient.auth.signInWithPassword({ email, password })
        if (result.error) throw result.error
        setSuccessMessage('Welcome back!')
      }
      setShowSuccess(true)
      setTimeout(() => { onAuthSuccess() }, 1800)
    } catch (err) {
      const message = String(err?.message || '')
      const isDuplicateEmail = /already registered|already exists|user exists|duplicate/i.test(message)
      if (isDuplicateEmail) {
        setIsSignUpMode(false)
        setShowSuccess(false)
        setSuccessMessage('')
      }
      setAuthError(
        isDuplicateEmail
          ? 'This email is already registered. Ek email se sirf ek hi account banega, please login karein.'
          : message,
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogle = async () => {
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } }
      })
      if (error) throw error
    } catch (err) { setAuthError(err.message) }
  }

  const leftContent = {
    login: {
      emoji: '🏥', heading: 'WELCOME', accent: 'Back.',
      sub: 'Your health journey continues. Sign in to access hospitals, AI guidance, and more.',
      feats: [
        { icon: '📍', text: 'Find hospitals nearby instantly' },
        { icon: '🤖', text: 'AI-powered symptom analysis' },
        { icon: '👨‍⚕️', text: 'Verified doctor profiles' },
      ]
    },
    signup: {
      emoji: '✨', heading: 'JOIN THE', accent: 'Revolution.',
      sub: 'Create your free account and unlock AI-powered healthcare at your fingertips.',
      feats: [
        { icon: '🔒', text: 'Secure & private by design' },
        { icon: '⚡', text: 'Instant access, zero wait time' },
        { icon: '💊', text: 'Personalized health insights' },
      ]
    }
  }

  const confettiColors = ['#00e5ff', '#7b2fff', '#ff2d78', '#ffaa00', '#00ff9d']
  const confettiDots = Array.from({ length: 16 }, (_, i) => ({
    id: i,
    color: confettiColors[i % confettiColors.length],
    tx: `${(Math.random() - 0.5) * 200}px`,
    ty: `${-(Math.random() * 150 + 50)}px`,
    delay: `${Math.random() * 0.4}s`,
    left: `${20 + Math.random() * 60}%`,
    top: `${30 + Math.random() * 40}%`,
  }))

  return (
    <div className={`auth-overlay ${isOpen ? 'open' : ''}`} ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}>
      <div className="auth-overlay-bg" />
      <ParticleCanvas canvasRef={canvasRef} />

      <div className="auth-scene">
        <div className="auth-flip">
          <div className="auth-face" style={{ position: 'relative' }}>
            <div className="auth-left">
              <div className="ring-orbit ring1" />
              <div className="ring-orbit ring2" />
              <div className="ring-orbit ring3" />
              <div className="auth-left-grid" />
              <span className="left-emoji-3d">{isSignUpMode ? leftContent.signup.emoji : leftContent.login.emoji}</span>
              <h2 className="left-heading">
                {isSignUpMode ? leftContent.signup.heading : leftContent.login.heading}
                <span>{isSignUpMode ? leftContent.signup.accent : leftContent.login.accent}</span>
              </h2>
              <p className="left-sub">{isSignUpMode ? leftContent.signup.sub : leftContent.login.sub}</p>
              <div className="left-features">
                {(isSignUpMode ? leftContent.signup.feats : leftContent.login.feats).map((f, i) => (
                  <div className="left-feat" key={i}>
                    <span className="lf-icon">{f.icon}</span>
                    <span className="lf-text">{f.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="auth-right" style={{ position: 'relative' }}>
              <button type="button" className="auth-close" onClick={onClose}>✕</button>
              {showSuccess ? (
                <div className="auth-success" style={{ position: 'relative' }}>
                  {confettiDots.map(d => (
                    <div key={d.id} className="confetti-dot"
                      style={{ background: d.color, left: d.left, top: d.top,
                        '--tx': d.tx, '--ty': d.ty, animationDelay: d.delay }} />
                  ))}
                  <span className="success-icon">{isSignUpMode ? '🚀' : '🎉'}</span>
                  <h3 className="success-h">{isSignUpMode ? "You're all set!" : "You're in!"}</h3>
                  <p className="success-p">{successMessage}</p>
                  <button type="button" className="auth-submit" onClick={isSignUpMode ? onClose : onAuthSuccess}>
                    {isSignUpMode ? "Let's Go →" : 'Continue to Dashboard →'}
                  </button>
                </div>
              ) : (
                <>
                  <span className="form-emoji">{isSignUpMode ? '🌟' : '👋'}</span>
                  <h2 className="form-title">{isSignUpMode ? 'Create Account' : 'Welcome Back'}</h2>
                  <p className="form-subtitle">
                    {isSignUpMode
                      ? 'Join 500K+ users managing their health smarter.'
                      : 'Sign in to your account and continue your health journey.'}
                  </p>

                  {authError && <div className="auth-error"><span>⚠️</span>{authError}</div>}

                  <form onSubmit={handleSubmit} autoComplete="off" noValidate>
                    <input
                      type="text"
                      name="prevent_autofill_username"
                      autoComplete="username"
                      tabIndex={-1}
                      aria-hidden="true"
                      style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }}
                    />
                    <input
                      type="password"
                      name="prevent_autofill_password"
                      autoComplete="current-password"
                      tabIndex={-1}
                      aria-hidden="true"
                      style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }}
                    />
                    {isSignUpMode && (
                      <div className="input-row">
                        <div className="inp-group" style={{ marginBottom: 0 }}>
                          <label className="inp-label"><span className="lbl-icon">👤</span>First Name</label>
                          <div className="inp-wrap">
                            <input className="auth-input" type="text" placeholder="John"
                              value={firstName} onChange={e => setFirstName(e.target.value)} required />
                            <span className="inp-icon">🪪</span>
                          </div>
                        </div>
                        <div className="inp-group" style={{ marginBottom: 0 }}>
                          <label className="inp-label"><span className="lbl-icon">👤</span>Last Name</label>
                          <div className="inp-wrap">
                            <input className="auth-input" type="text" placeholder="Doe"
                              value={lastName} onChange={e => setLastName(e.target.value)} required />
                            <span className="inp-icon">🪪</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="inp-group" style={{ marginTop: isSignUpMode ? '16px' : 0 }}>
                      <label className="inp-label"><span className="lbl-icon">📧</span>Email Address</label>
                      <div className="inp-wrap">
                        <input className="auth-input" type="email" placeholder="you@example.com"
                          name={isSignUpMode ? 'signup_email' : 'login_email'}
                          autoComplete="off"
                          value={email} onChange={e => setEmail(e.target.value)} required />
                        <span className="inp-icon">✉️</span>
                      </div>
                    </div>

                    <div className="inp-group">
                      <label className="inp-label"><span className="lbl-icon">🔑</span>Password</label>
                      <div className="inp-wrap">
                        <input className="auth-input" type={showPassword ? 'text' : 'password'}
                          name={isSignUpMode ? 'signup_password' : 'login_password'}
                          autoComplete="new-password"
                          placeholder={isSignUpMode ? 'Create a strong password' : '••••••••'}
                          value={password}
                          onChange={e => setPassword(e.target.value)} required
                          style={{ paddingRight: '44px' }} />
                        <span className="inp-icon">{isSignUpMode ? '🔐' : '🔒'}</span>
                        <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? '🙈' : '👁️'}
                        </button>
                      </div>
                      {isSignUpMode && <PasswordStrength password={password} />}
                    </div>

                    {isSignUpMode && (
                      <div className="terms-row" onClick={() => setAgreeTerms(!agreeTerms)}>
                        <div className={`custom-check ${agreeTerms ? 'checked' : ''}`}>{agreeTerms ? '✓' : ''}</div>
                        <span className="terms-text">I agree to the <a href="#" onClick={e=>e.preventDefault()}>Terms</a> & <a href="#" onClick={e=>e.preventDefault()}>Privacy Policy</a></span>
                      </div>
                    )}

                    <button type="submit" className="auth-submit" disabled={isLoading}>
                      {isLoading
                        ? <><span className="btn-spinner" />{isSignUpMode ? 'Creating account...' : 'Signing in...'}</>
                        : (isSignUpMode ? 'Create Free Account 🚀' : 'Sign In →')}
                    </button>
                  </form>

                  <div className="auth-divider">
                    <div className="auth-divider-line" /><span className="auth-divider-txt">OR</span><div className="auth-divider-line" />
                  </div>

                  <button type="button" className="google-btn" onClick={handleGoogle}>
                    <svg className="google-icon" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </button>

                  <div className="auth-switch">
                    {isSignUpMode ? 'Already have an account? ' : "Don't have an account? "}
                    <button type="button" className="switch-btn" onClick={handleSwitchMode}>
                      {isSignUpMode ? 'Sign In →' : 'Sign Up Free ✨'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
