import React, { useState } from 'react'
import { supabaseClient } from '../utils/supabase'

function AuthModal({ isOpen, onClose, isSignUpMode, setIsSignUpMode, authError, setAuthError, onAuthSuccess }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [showForm, setShowForm] = useState(true)

  const handlePasswordToggle = () => {
    setShowPassword(!showPassword)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (isSignUpMode && !agreeTerms) {
      setAuthError('Please agree to the terms.')
      return
    }

    setIsLoading(true)
    setAuthError('')

    try {
      let result
      if (isSignUpMode) {
        result = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              full_name: `${firstName} ${lastName}`
            }
          }
        })

        if (result.error) throw result.error

        if (result.data.user && !result.data.session) {
          setSuccessMessage('Account created! Please check your email for confirmation.')
          setShowForm(false)
          return
        } else {
          setSuccessMessage('Account created successfully!')
        }
      } else {
        result = await supabaseClient.auth.signInWithPassword({ email, password })
        if (result.error) throw result.error
        setSuccessMessage('Login successful!')
      }

      setTimeout(() => {
        onAuthSuccess()
      }, 1500)
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            prompt: 'select_account'
          }
        }
      })
      if (error) throw error
    } catch (error) {
      setAuthError(error.message)
    }
  }

  const handleSwitchMode = () => {
    setIsSignUpMode(!isSignUpMode)
    setAuthError('')
    setSuccessMessage('')
    setShowForm(true)
    setFirstName('')
    setLastName('')
    setEmail('')
    setPassword('')
    setAgreeTerms(false)
  }

  return (
    <div className={`modal-overlay ${isOpen ? 'active' : ''}`} onClick={(e) => {
      if (e.target === e.currentTarget) onClose()
    }}>
      <div className="modal-card">
        <button className="modal-close" onClick={onClose}>✕</button>

        {showForm ? (
          <>
            <h2 style={{ marginBottom: '8px' }}>{isSignUpMode ? 'Sign Up' : 'Login'}</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
              {isSignUpMode ? 'Create your account to get started.' : 'Welcome back! Please enter your details.'}
            </p>

            {authError && (
              <div className="error-text" style={{ marginBottom: '16px', fontSize: '0.9rem' }}>
                {authError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {isSignUpMode && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }}
                      required
                    />
                  </div>
                </>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: '100%', padding: '12px', paddingRight: '40px', border: '1px solid #ddd', borderRadius: '8px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={handlePasswordToggle}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                  >
                    {showPassword ? '🔒' : '👁️'}
                  </button>
                </div>
              </div>

              {isSignUpMode && (
                <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="auth-terms"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                  />
                  <label htmlFor="auth-terms" style={{ fontSize: '0.85rem' }}>
                    I agree to the Terms and Conditions
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary"
                style={{ width: '100%', marginBottom: '16px' }}
              >
                {isLoading ? 'Loading...' : (isSignUpMode ? 'Sign Up' : 'Login')}
              </button>
            </form>

            <div style={{ textAlign: 'center', color: '#ccc', margin: '16px 0' }}>or</div>

            <button
              onClick={handleGoogleLogin}
              className="btn btn-outline"
              style={{ width: '100%', marginBottom: '16px' }}
            >
              Sign in with Google
            </button>

            <div style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              {isSignUpMode ? "Already have an account?" : "Don't have an account?"}
              {' '}
              <button
                onClick={handleSwitchMode}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '700', cursor: 'pointer' }}
              >
                {isSignUpMode ? 'Login' : 'Sign Up'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--accent)', marginBottom: '16px' }}>{successMessage}</p>
            <button
              onClick={onClose}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AuthModal
