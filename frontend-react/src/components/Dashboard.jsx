import React, { useState, useRef, useEffect, useMemo, Component } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { DivIcon } from 'leaflet'
import 'leaflet/dist/leaflet.css'

class MapErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Map crash:", error, errorInfo);
    this.setState({ errorMsg: error.toString() });
  }
  render() {
    if (this.state.hasError) {
      return <div style={{ padding: '20px', color: '#ff6b6b' }}>Map failed to load. Error: {this.state.errorMsg}</div>;
    }
    return this.props.children;
  }
}
import { supabaseClient } from '../utils/supabase'
import { MOCK_HOSPITALS } from '../utils/constants'

function Dashboard({ currentUser, activePage, setActivePage, activeFilter, setActiveFilter, onLogout }) {
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [hospitalSearchQuery, setHospitalSearchQuery] = useState('')
  const [filteredHospitals, setFilteredHospitals] = useState(MOCK_HOSPITALS)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isSending, setChatIsSending] = useState(false)
  const chatContainerRef = useRef(null)
  const fileInputRef = useRef(null)
  const [userLocation, setUserLocation] = useState(null)
  const [locationError, setLocationError] = useState('')
  const [nearbyMapHospitals, setNearbyMapHospitals] = useState([])

  // Get user display info
  const metadata = currentUser?.user_metadata || {}
  const fullName = metadata.full_name || metadata.name || 'User'
  let firstName = metadata.first_name || metadata.given_name || fullName.split(' ')[0]

  if (firstName === 'User') {
    firstName = currentUser.email.split('@')[0]
    firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1)
  }

  const avatarInitial = (firstName[0] || 'U').toUpperCase()

  // Get current date
  const now = new Date()
  const dateString = '📅 ' + now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })

  // Load saved avatar and location
  useEffect(() => {
    loadSavedAvatar()

    // Fetch User Location on Dashboard load
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserLocation({ lat, lng });
          fetchNearbyMapHospitals(lat, lng);
        },
        (error) => {
          setLocationError("Location access denied. Showing default location.");
        }
      );
    } else {
      setLocationError("Geolocation is not supported. Showing default location.");
    }
  }, [])

  const fetchNearbyMapHospitals = async (lat, lng) => {
    const query = `
      [out:json];
      node["amenity"="hospital"](around:20000,${lat},${lng});
      out 20;
    `;
    try {
      const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      const data = await res.json();
      setNearbyMapHospitals(data.elements || []);
    } catch (e) {
      console.error('Failed to fetch hospitals from OSM:', e);
    }
  }

  const customMarkerIcon = useMemo(() => new DivIcon({
    className: 'custom-avatar-marker',
    html: `<div class="marker-pin">${avatarUrl ? `<img src="${avatarUrl}" />` : `<div class="avatar-initial">${avatarInitial}</div>`}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 44]
  }), [avatarUrl, avatarInitial]);

  const hospitalIcon = useMemo(() => new DivIcon({
    className: 'hospital-marker',
    html: `<div style="font-size: 24px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">🏥</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30]
  }), []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatMessages])

  // Filter hospitals when query or filter changes
  useEffect(() => {
    filterHospitals()
  }, [hospitalSearchQuery, activeFilter])

  const loadSavedAvatar = async () => {
    if (!currentUser || !supabaseClient) return
    try {
      const { data } = await supabaseClient
        .from('profiles')
        .select('avatar_url')
        .eq('id', currentUser.id)
        .single()

      if (data && data.avatar_url) {
        setAvatarUrl(data.avatar_url)
      }
    } catch (err) {
      console.error('Load avatar failed:', err.message)
    }
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !currentUser || !supabaseClient) return

    const fileExt = file.name.split('.').pop()
    const filePath = `${currentUser.id}/avatar.${fileExt}`

    try {
      const { error: uploadError } = await supabaseClient.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabaseClient.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const publicUrl = urlData.publicUrl + '?t=' + Date.now()

      await supabaseClient
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', currentUser.id)

      setAvatarUrl(publicUrl)
    } catch (err) {
      console.error('Avatar upload failed:', err.message)
    }
  }

  const filterHospitals = () => {
    const query = hospitalSearchQuery.toLowerCase()
    let filtered = MOCK_HOSPITALS

    if (activeFilter !== 'All') {
      filtered = filtered.filter(h => h.tags.some(t => t === activeFilter))
    }

    if (query) {
      filtered = filtered.filter(h =>
        h.name.toLowerCase().includes(query) ||
        h.address.toLowerCase().includes(query) ||
        h.tags.some(t => t.toLowerCase().includes(query))
      )
    }

    setFilteredHospitals(filtered)
  }

  const handleAIChat = async () => {
    const message = chatInput.trim()
    if (!message) return

    // Add user message
    const newMessages = [...chatMessages, { type: 'user', text: message }]
    setChatMessages(newMessages)
    setChatInput('')
    setChatIsSending(true)

    try {
      const res = await fetch('http://localhost:5001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      })

      if (!res.ok) {
        throw new Error(`Proxy error: ${res.status}`)
      }

      const data = await res.json()
      setChatMessages(prev => [...prev, { type: 'bot', text: data.reply || data.message || "I don't know what to say." }])
    } catch (err) {
      console.error('AI Chat Error:', err)
      setChatMessages(prev => [...prev, {
        type: 'bot',
        text: '⚠️ Our AI service is currently taking a break. In a health emergency, please contact a doctor immediately!',
        isError: true
      }])
    } finally {
      setChatIsSending(false)
    }
  }

  const sendSuggestion = (text) => {
    setChatInput(text)
    setTimeout(() => {
      setChatInput('')
      const newMessages = [...chatMessages, { type: 'user', text }]
      setChatMessages(newMessages)
    }, 100)
  }

  return (
    <div className="dashboard-layout">
      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">⚕️</div>
          <div className="logo-text">Health<span>Pulse</span></div>
        </div>

        <div className="sidebar-header">
          <div className="avatar-wrapper">
            <div className="user-avatar">
              {avatarUrl ? <img src={avatarUrl} alt="Profile" /> : avatarInitial}
            </div>
            <div className="avatar-overlay">📷</div>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarUpload}
            accept="image/*"
            style={{ display: 'none' }}
          />
          <div className="user-info">
            <h4>{fullName !== 'User' ? fullName : firstName}</h4>
            <p>{currentUser?.email}</p>
          </div>
        </div>

        <div className="sidebar-nav">
          <button
            className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActivePage('dashboard')}
          >
            <span>📊</span> Dashboard
          </button>
          <button
            className={`nav-item ${activePage === 'search' ? 'active' : ''}`}
            onClick={() => setActivePage('search')}
          >
            <span>🔍</span> Hospital Search
          </button>
          <button
            className={`nav-item ${activePage === 'ai' ? 'active' : ''}`}
            onClick={() => setActivePage('ai')}
          >
            <span>🤖</span> AI Assistant
          </button>
        </div>

        <div className="sidebar-footer">
          <button className="logout-btn-sidebar" onClick={onLogout}>
            <span>🚪</span> Logout
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="dashboard-content">
        {/* HOME PAGE */}
        {activePage === 'dashboard' && (
          <div className="dash-page active-page">
            <div className="dash-header">
              <h1>Welcome back, <span className="wave">👋</span> {firstName}</h1>
              <div className="date-badge">{dateString}</div>
            </div>

            {/* Hero Banner */}
            <div className="hero-banner-dark">
              <span className="hero-tag">⭐ Pro Tip</span>
              <h2>Your health journey starts here</h2>
              <p style={{ color: '#7a8ba7', marginBottom: '24px' }}>Discover nearby hospitals, get instant AI health insights, and manage your wellness all in one place.</p>
              <button className="hero-cta" onClick={() => setActivePage('search')}>Start Exploring</button>
            </div>

            {/* Stats */}
            <div className="stats-row">
              <div className="stat-card-dark">
                <div className="stat-icon-dark emerald-bg">🏥</div>
                <div>
                  <h3>2.4K+</h3>
                  <p>Active Hospitals</p>
                </div>
              </div>
              <div className="stat-card-dark">
                <div className="stat-icon-dark gold-bg">⚙️</div>
                <div>
                  <h3>98%</h3>
                  <p>AI Accuracy</p>
                </div>
              </div>
              <div className="stat-card-dark">
                <div className="stat-icon-dark blue-bg">👥</div>
                <div>
                  <h3>500K+</h3>
                  <p>Happy Users</p>
                </div>
              </div>
            </div>

            {/* Quick Access */}
            <div style={{ marginBottom: '40px' }}>
              <h3 className="section-title-dark">Quick Actions</h3>
              <div className="quick-grid">
                <div className="quick-card" onClick={() => setActivePage('search')}>
                  <div className="q-icon">🏥</div>
                  <h3>Find Hospitals</h3>
                  <p>Discover top-rated hospitals near you with detailed information.</p>
                  <span className="q-badge">Popular</span>
                  <div className="q-arrow">→</div>
                </div>
                <div className="quick-card" onClick={() => setActivePage('ai')}>
                  <div className="q-icon">🤖</div>
                  <h3>AI Health Check</h3>
                  <p>Get instant preliminary health insights powered by AI.</p>
                  <span className="q-badge">Fast</span>
                  <div className="q-arrow">→</div>
                </div>
              </div>
            </div>

            {/* Hospital Map Section */}
            <div style={{ marginBottom: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 className="section-title-dark" style={{ margin: 0 }}>📍 Nearby Hospitals Map</h3>
                {locationError && <span style={{ fontSize: '0.85rem', color: '#ff6b6b' }}>{locationError}</span>}
              </div>
              <div style={{ borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(0,212,170,0.2)', boxShadow: '0 12px 40px rgba(0,0,0,0.2)', height: '450px' }}>
                {userLocation ? (
                  <MapErrorBoundary>
                    <MapContainer center={[userLocation.lat, userLocation.lng]} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                      <TileLayer
                        attribution='&copy; OpenStreetMap contributors'
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                      />
                      <Marker position={[userLocation.lat, userLocation.lng]} icon={customMarkerIcon}>
                        <Popup>You are exactly here!</Popup>
                      </Marker>
                      {nearbyMapHospitals.map(hospital => {
                        if (!hospital || !hospital.lat || !hospital.lon) return null;
                        return (
                          <Marker key={hospital.id || Math.random()} position={[hospital.lat, hospital.lon]} icon={hospitalIcon}>
                            <Popup>
                              <strong>{hospital.tags?.name || 'Hospital/Clinic'}</strong>
                              <br />
                              {hospital.tags?.['addr:street'] || 'Nearby'}
                            </Popup>
                          </Marker>
                        )
                      })}
                    </MapContainer>
                  </MapErrorBoundary>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#0a1f2e', color: '#7a8ba7' }}>
                    {locationError || "Waiting for location access..."}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* HOSPITAL SEARCH PAGE */}
        {activePage === 'search' && (
          <div className="dash-page active-page">
            <button className="back-btn-dark" onClick={() => setActivePage('dashboard')}>← Back</button>

            <div className="search-banner-dark">
              <h2>Find Healthcare Services</h2>
              <div className="location-pill">📍 Mathura, India</div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <input
                type="text"
                className="dark-input"
                placeholder="Search hospitals, services, or specialties..."
                value={hospitalSearchQuery}
                onChange={(e) => setHospitalSearchQuery(e.target.value)}
                style={{ marginBottom: '16px' }}
              />
              <button className="search-btn-dark" onClick={filterHospitals}>Search</button>
            </div>

            <div className="filter-chips">
              {['All', 'Emergency', 'Cardiology', 'Neurology', 'Pediatrics'].map(tag => (
                <button
                  key={tag}
                  className={`chip ${activeFilter === tag ? 'active' : ''}`}
                  onClick={() => setActiveFilter(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>

            <h3 className="section-title-dark" style={{ marginBottom: '16px' }}>{filteredHospitals.length} Results Found</h3>
            <div className="hospital-grid-dark">
              {filteredHospitals.map((hospital, idx) => (
                <div key={idx} className="hospital-card-dark">
                  <div className="h-top">
                    <div className="h-icon-box">🏥</div>
                    <div className="h-rating">⭐ {hospital.rating}</div>
                  </div>
                  <h3>{hospital.name}</h3>
                  <p className="h-address">{hospital.address}</p>
                  <div className="h-tags">
                    {hospital.tags.map((tag, tagIdx) => (
                      <span key={tagIdx} className="h-tag">{tag}</span>
                    ))}
                  </div>
                  <div className="h-bottom">
                    <span className="h-distance">📍 {hospital.distance}</span>
                    <button className="h-dir-btn">Get Directions →</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI CHAT PAGE */}
        {activePage === 'ai' && (
          <div className="dash-page active-page">
            <button className="back-btn-dark" onClick={() => setActivePage('dashboard')}>← Back</button>
            <h2 style={{ color: '#e8ecf4', marginBottom: '24px' }}>AI Health Assistant</h2>

            <div className="chat-container" ref={chatContainerRef}>
              {chatMessages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#7a8ba7', padding: '40px 20px' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🤖</div>
                  <p>Start a conversation with our AI health assistant</p>
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div key={idx} className={`chat-msg ${msg.type}`}>
                    <div className="chat-avatar">{msg.type === 'user' ? '👤' : '🤖'}</div>
                    <div className={`chat-bubble ${msg.isError ? 'error' : ''}`}>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="ai-input-group">
              <input
                type="text"
                className="ai-input"
                placeholder="Ask about your health concerns..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAIChat()}
                disabled={isSending}
              />
              <button className="ai-send-btn" onClick={handleAIChat} disabled={isSending}>
                {isSending ? '...' : 'Send'}
              </button>
            </div>

            {chatMessages.length === 0 && (
              <div style={{ marginTop: '24px' }}>
                <p style={{ color: '#7a8ba7', marginBottom: '12px', fontSize: '0.9rem' }}>Quick suggestions:</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="suggestion-btn" onClick={() => sendSuggestion('What are common symptoms of flu?')}>
                    Flu symptoms
                  </button>
                  <button className="suggestion-btn" onClick={() => sendSuggestion('I have a headache and fever')}>
                    Headache & fever
                  </button>
                  <button className="suggestion-btn" onClick={() => sendSuggestion('How to stay healthy?')}>
                    Health tips
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
