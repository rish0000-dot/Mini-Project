import React, { useState, useEffect, Component } from 'react'
import { supabaseClient } from './utils/supabase'
import LandingPage from './components/LandingPage'
import Dashboard from './components/Dashboard'
import DoctorPanel from './components/DoctorPanel'
import AdminPanel from './components/AdminPanel'
import AuthModal from './components/AuthModal'
import './styles/global.css'

const DASHBOARD_PAGE_STORAGE_PREFIX = 'dashboardActivePage:'
const DASHBOARD_FILTER_STORAGE_PREFIX = 'dashboardActiveFilter:'
const ALLOWED_DASHBOARD_PAGES = new Set([
  'dashboard',
  'search',
  'smart-assist',
  'emergency-mode',
  'hospital-detail',
  'find-service',
  'history',
  'ai',
  'profile',
  'documents',
])
const ALLOWED_FILTERS = new Set(['All', 'Emergency', 'Cardiology', 'Neurology', 'Pediatrics'])

const sanitizeDashboardPage = (value) => (ALLOWED_DASHBOARD_PAGES.has(value) ? value : 'dashboard')
const sanitizeDashboardFilter = (value) => (ALLOWED_FILTERS.has(value) ? value : 'All')

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorMsg: '' }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('App crash:', error, errorInfo)
    this.setState({ errorMsg: error?.toString?.() || 'Unexpected app error' })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: '#06101a', color: '#e8ecf4' }}>
          <div style={{ maxWidth: '760px', width: '100%', background: 'rgba(14,30,43,0.95)', border: '1px solid rgba(255,110,110,0.35)', borderRadius: '16px', padding: '22px' }}>
            <h2 style={{ marginTop: 0, color: '#ff9e9e' }}>Something went wrong</h2>
            <p style={{ color: '#c9d4df' }}>App crashed while rendering. Please reload once. If issue persists, share this error text.</p>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'rgba(0,0,0,0.25)', borderRadius: '10px', padding: '12px', color: '#ffcccc' }}>
              {this.state.errorMsg}
            </pre>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [isAuthChecking, setIsAuthChecking] = useState(true)
  const [isSignUpMode, setIsSignUpMode] = useState(false)
  const [authRole, setAuthRole] = useState('user')
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authError, setAuthError] = useState('')
  const [navScrolled, setNavScrolled] = useState(false)
  const [activePage, setActivePage] = useState('documents')
  const [activeFilter, setActiveFilter] = useState('All')

  const currentUserId = currentUser?.id || null

  const getPageStorageKey = (userId) => `${DASHBOARD_PAGE_STORAGE_PREFIX}${userId}`
  const getFilterStorageKey = (userId) => `${DASHBOARD_FILTER_STORAGE_PREFIX}${userId}`

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

  useEffect(() => {
    if (!currentUserId) return

    try {
      const storedPage = window.localStorage.getItem(getPageStorageKey(currentUserId))
      const storedFilter = window.localStorage.getItem(getFilterStorageKey(currentUserId))

      if (storedPage) {
        setActivePage(sanitizeDashboardPage(storedPage))
      }

      if (storedFilter) {
        setActiveFilter(sanitizeDashboardFilter(storedFilter))
      }
    } catch (error) {
      console.error('Failed to restore dashboard state:', error)
    }
  }, [currentUserId])

  useEffect(() => {
    if (!currentUserId) return

    try {
      window.localStorage.setItem(getPageStorageKey(currentUserId), sanitizeDashboardPage(activePage))
    } catch (error) {
      console.error('Failed to persist dashboard page:', error)
    }
  }, [activePage, currentUserId])

  useEffect(() => {
    if (!currentUserId) return

    try {
      window.localStorage.setItem(getFilterStorageKey(currentUserId), sanitizeDashboardFilter(activeFilter))
    } catch (error) {
      console.error('Failed to persist dashboard filter:', error)
    }
  }, [activeFilter, currentUserId])

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabaseClient.auth.getSession()
      if (error) throw error
      setCurrentUser(session?.user || null)
      const roleFromSession =
        session?.user?.user_metadata?.role ||
        session?.user?.user_metadata?.account_type ||
        'user'
      setAuthRole(roleFromSession === 'doctor' ? 'doctor' : roleFromSession === 'admin' ? 'admin' : 'user')
    } catch (err) {
      console.error('Authentication check failed:', err.message)
      setCurrentUser(null)
      alert('Warning: Could not connect to Supabase authentication server. Please check your network.')
    } finally {
      setIsAuthChecking(false)
    }
  }

  const handleShowAuth = (mode, role = 'user') => {
    setIsSignUpMode(mode === 'signup')
    setAuthRole(role === 'doctor' ? 'doctor' : role === 'admin' ? 'admin' : 'user')
    setShowAuthModal(true)
    setAuthError('')
  }

  const handleCloseAuth = () => {
    setShowAuthModal(false)
    setAuthError('')
  }

  const currentUserRole =
    currentUser?.user_metadata?.role ||
    currentUser?.user_metadata?.account_type ||
    authRole

  return (
    <AppErrorBoundary>
    <div className="app">
      {isAuthChecking ? (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#06101a', color: '#e8ecf4' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', border: '4px solid rgba(0,212,170,0.2)', borderTopColor: '#00d4aa', margin: '0 auto 14px', animation: 'spin 0.9s linear infinite' }} />
            <div>Loading your session...</div>
          </div>
        </div>
      ) : !currentUser ? (
        <>
          <LandingPage 
            navScrolled={navScrolled}
            onShowAuth={handleShowAuth}
          />
        </>
      ) : currentUserRole === 'admin' ? (
        <AdminPanel
          currentUser={currentUser}
          onLogout={() => {
            supabaseClient.auth.signOut()
            setCurrentUser(null)
            setAuthRole('user')
            setActivePage('dashboard')
            setActiveFilter('All')
          }}
        />
      ) : currentUserRole === 'doctor' ? (
        <DoctorPanel
          currentUser={currentUser}
          onUserUpdate={(updatedUser) => {
            if (updatedUser) {
              setCurrentUser(updatedUser)
            }
          }}
          onLogout={() => {
            supabaseClient.auth.signOut()
            setCurrentUser(null)
            setAuthRole('user')
            setActivePage('dashboard')
            setActiveFilter('All')
          }}
        />
      ) : (
        <Dashboard
          currentUser={currentUser}
          activePage={activePage}
          setActivePage={(nextPage) => setActivePage(sanitizeDashboardPage(nextPage))}
          activeFilter={activeFilter}
          setActiveFilter={(nextFilter) => setActiveFilter(sanitizeDashboardFilter(nextFilter))}
          onLogout={() => {
            supabaseClient.auth.signOut()
            setCurrentUser(null)
            setAuthRole('user')
            setActivePage('dashboard')
            setActiveFilter('All')
          }}
        />
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={handleCloseAuth}
        isSignUpMode={isSignUpMode}
        setIsSignUpMode={setIsSignUpMode}
        authRole={authRole}
        setAuthRole={setAuthRole}
        authError={authError}
        setAuthError={setAuthError}
        onAuthSuccess={() => {
          handleCloseAuth()
          checkAuth()
        }}
      />
    </div>
    </AppErrorBoundary>
  )
}

export default App
