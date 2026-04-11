import React, { useState, useEffect } from 'react'
import { supabaseClient } from './utils/supabase'
import LandingPage from './components/LandingPage'
import Dashboard from './components/Dashboard'
import AuthModal from './components/AuthModal'
import './styles/global.css'

function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [isSignUpMode, setIsSignUpMode] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authError, setAuthError] = useState('')
  const [navScrolled, setNavScrolled] = useState(false)
  const [activePage, setActivePage] = useState('dashboard')
  const [activeFilter, setActiveFilter] = useState('All')

  // Check authentication on mount
  useEffect(() => {
    checkAuth()
  }, [])

  // Handle scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      setNavScrolled(window.scrollY > 50)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabaseClient.auth.getSession()
      if (error) throw error
      setCurrentUser(session?.user || null)
    } catch (err) {
      console.error('Authentication check failed:', err.message)
      setCurrentUser(null)
      alert('Warning: Could not connect to Supabase authentication server. Please check your network.')
    }
  }

  const handleShowAuth = (mode) => {
    setIsSignUpMode(mode === 'signup')
    setShowAuthModal(true)
    setAuthError('')
  }

  const handleCloseAuth = () => {
    setShowAuthModal(false)
    setAuthError('')
  }

  return (
    <div className="app">
      {!currentUser ? (
        <>
          <LandingPage 
            navScrolled={navScrolled}
            onShowAuth={handleShowAuth}
          />
        </>
      ) : (
        <Dashboard
          currentUser={currentUser}
          activePage={activePage}
          setActivePage={setActivePage}
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          onLogout={() => {
            supabaseClient.auth.signOut()
            setCurrentUser(null)
          }}
        />
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={handleCloseAuth}
        isSignUpMode={isSignUpMode}
        setIsSignUpMode={setIsSignUpMode}
        authError={authError}
        setAuthError={setAuthError}
        onAuthSuccess={() => {
          handleCloseAuth()
          checkAuth()
        }}
      />
    </div>
  )
}

export default App
