import React, { useState, useRef, useEffect, useMemo, Component } from 'react'
import { Map, MapControls, Marker, Popup, hospitalIcon } from '../components/ui/map'
import HospitalDetailPage from './HospitalDetailPage'
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

const HOSPITAL_MIN_DISTANCE_KM = 0.2
const HOSPITAL_MAX_DISTANCE_KM = 50
const LIVE_LOCATION_ZOOM = 15

const toRadians = (value) => (value * Math.PI) / 180

const getDistanceKm = (from, to) => {
  const earthRadiusKm = 6371
  const dLat = toRadians(to.lat - from.lat)
  const dLng = toRadians(to.lng - from.lng)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const formatHospitalAddress = (hospital) => {
  const tags = hospital?.tags || {}
  return [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'],
    tags['addr:city'],
    tags['addr:state'],
  ].filter(Boolean).join(', ') || tags['addr:full'] || 'Nearby'
}

const getHospitalSearchTokens = (hospital) => {
  if (Array.isArray(hospital?.tags)) {
    return hospital.tags.map((tag) => String(tag).toLowerCase())
  }

  const tags = hospital?.tags || {}
  return [
    hospital?.displayName,
    hospital?.displayAddress,
    tags.name,
    tags.operator,
    tags.amenity,
    tags.healthcare,
    tags['healthcare:speciality'],
    tags['healthcare:speciality'] && 'speciality',
    tags.emergency && 'emergency',
    tags.wheelchair && 'wheelchair',
    tags.opening_hours && 'hours',
    tags.emergency,
    tags.wheelchair,
    tags.opening_hours,
    tags.phone,
    tags.website,
    tags['addr:city'],
    tags['addr:state'],
    tags['addr:suburb'],
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
}

const normalizeHospitalForSearch = (hospital, index) => {
  if (hospital?.displayName || typeof hospital?.distanceKm === 'number') {
    const tags = hospital?.tags || {}
    const liveTags = [
      tags.amenity && `Type: ${tags.amenity}`,
      tags.operator && `Operator: ${tags.operator}`,
      tags['healthcare:speciality'] && `Speciality: ${tags['healthcare:speciality']}`,
      tags.emergency && `Emergency: ${tags.emergency}`,
      tags.wheelchair && `Wheelchair: ${tags.wheelchair}`,
      tags.opening_hours && `Hours: ${tags.opening_hours}`,
      tags.phone && `Phone: ${tags.phone}`,
      tags.website && `Website: ${tags.website}`,
      tags['addr:full'] || [tags['addr:housenumber'], tags['addr:street'], tags['addr:city'], tags['addr:state']].filter(Boolean).join(', '),
    ].filter(Boolean)

    return {
      key: `live-${hospital.id || index}`,
      name: hospital.displayName || tags.name || 'Hospital',
      address: hospital.displayAddress || 'Nearby',
      distanceText: `${hospital.distanceKm.toFixed(2)} km away`,
      distanceKm: hospital.distanceKm,
      rating: 'Live',
      source: 'OpenStreetMap',
      tags: liveTags.length > 0 ? liveTags : ['Live data'],
      details: liveTags.slice(0, 4),
      contact: {
        phone: tags.phone || '',
        website: tags.website || '',
      },
      raw: hospital,
      searchTokens: getHospitalSearchTokens(hospital),
    }
  }

  return {
    key: `mock-${index}`,
    name: hospital.name,
    address: hospital.address,
    distanceText: hospital.distance,
    distanceKm: null,
    rating: hospital.rating,
    source: 'Mock data',
    tags: Array.isArray(hospital.tags) ? hospital.tags : [],
    details: [],
    contact: {
      phone: '',
      website: '',
    },
    raw: hospital,
    searchTokens: getHospitalSearchTokens(hospital),
  }
}

const DEFAULT_APPOINTMENTS = [
  {
    id: 'apt-1',
    date: '2026-04-10',
    time: '10:30 AM',
    hospital: 'Krishna Medical Centre',
    doctor: 'Dr. A. Sharma',
    specialty: 'Cardiology',
    status: 'Completed',
    notes: 'Routine follow-up and ECG check.',
  },
  {
    id: 'apt-2',
    date: '2026-04-14',
    time: '02:00 PM',
    hospital: 'Gokul Health Hospital',
    doctor: 'Dr. Neha Verma',
    specialty: 'Neurology',
    status: 'Upcoming',
    notes: 'Consultation for headache and sleep issues.',
  },
  {
    id: 'apt-3',
    date: '2026-04-18',
    time: '11:15 AM',
    hospital: 'Vrindavan Super Speciality',
    doctor: 'Dr. Rahul Singh',
    specialty: 'General Medicine',
    status: 'Cancelled',
    notes: 'Rescheduled by patient.',
  },
]

import { supabaseClient } from '../utils/supabase'
import { MOCK_HOSPITALS } from '../utils/constants'
import { buildHospitalDetail, createAppointmentRecord } from '../utils/hospitalDetails'

function Dashboard({ currentUser, activePage, setActivePage, activeFilter, setActiveFilter, onLogout }) {
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [profileDraft, setProfileDraft] = useState({
    fullName: '',
    phone: '',
    city: '',
    bio: '',
  })
  const [hospitalSearchQuery, setHospitalSearchQuery] = useState('')
  const [filteredHospitals, setFilteredHospitals] = useState(MOCK_HOSPITALS)
  const [appointmentHistory, setAppointmentHistory] = useState(DEFAULT_APPOINTMENTS)
  const [activityHistory, setActivityHistory] = useState([])
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isSending, setChatIsSending] = useState(false)
  const [isProfileEditing, setIsProfileEditing] = useState(false)
  const chatContainerRef = useRef(null)
  const fileInputRef = useRef(null)
  const [userLocation, setUserLocation] = useState(null)
  const [locationError, setLocationError] = useState('')
  const [nearbyMapHospitals, setNearbyMapHospitals] = useState([])
  const [nearbyPlaces, setNearbyPlaces] = useState([])
  const [showHospitalMarkers, setShowHospitalMarkers] = useState(true)
  const [mapZoom, setMapZoom] = useState(13)
  const [selectedMarker, setSelectedMarker] = useState(null)
  const [locationLoading, setLocationLoading] = useState(true)
  const [selectedHospital, setSelectedHospital] = useState(null)
  const watchLocationRef = useRef(null)
  const lastHospitalFetchRef = useRef(null)

  const addHistoryItem = (item) => {
    setActivityHistory((prev) => [
      { ...item, id: `${item.key}-${Date.now()}` },
      ...prev.filter((entry) => entry.key !== item.key),
    ].slice(0, 5))
  }

  useEffect(() => {
    try {
      const savedAppointments = window.localStorage.getItem('appointmentHistory')
      if (savedAppointments) {
        const parsedAppointments = JSON.parse(savedAppointments)
        if (Array.isArray(parsedAppointments) && parsedAppointments.length > 0) {
          setAppointmentHistory(parsedAppointments)
          return
        }
      }

      window.localStorage.setItem('appointmentHistory', JSON.stringify(DEFAULT_APPOINTMENTS))
    } catch (error) {
      console.error('Failed to load appointment history:', error)
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem('appointmentHistory', JSON.stringify(appointmentHistory))
    } catch (error) {
      console.error('Failed to save appointment history:', error)
    }
  }, [appointmentHistory])

  // Get user display info
  const metadata = currentUser?.user_metadata || {}
  const fullName = metadata.full_name || metadata.name || 'User'
  let firstName = metadata.first_name || metadata.given_name || fullName.split(' ')[0]

  if (firstName === 'User') {
    firstName = currentUser.email.split('@')[0]
    firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1)
  }

  const avatarInitial = (firstName[0] || 'U').toUpperCase()
  const currentEmail = currentUser?.email || ''

  const profileStorageKey = currentUser?.id ? `profileDraft:${currentUser.id}` : null

  useEffect(() => {
    try {
      if (!profileStorageKey) return
      const savedProfile = window.localStorage.getItem(profileStorageKey)
      if (savedProfile) {
        const parsedProfile = JSON.parse(savedProfile)
        setProfileDraft((prev) => ({
          ...prev,
          ...parsedProfile,
          fullName: parsedProfile.fullName || fullName,
        }))
        return
      }

      const initialProfile = {
        fullName: fullName !== 'User' ? fullName : firstName,
        phone: '',
        city: '',
        bio: 'Keeping your healthcare details organized.',
      }
      setProfileDraft(initialProfile)
      window.localStorage.setItem(profileStorageKey, JSON.stringify(initialProfile))
    } catch (error) {
      console.error('Failed to load profile draft:', error)
    }
  }, [profileStorageKey, fullName, firstName])

  useEffect(() => {
    if (!profileStorageKey || !profileDraft.fullName) return
    try {
      window.localStorage.setItem(profileStorageKey, JSON.stringify(profileDraft))
    } catch (error) {
      console.error('Failed to save profile draft:', error)
    }
  }, [profileStorageKey, profileDraft])

  // Get current date
  const now = new Date()
  const dateString = '📅 ' + now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })

  // Load saved avatar and location
  useEffect(() => {
    loadSavedAvatar()

    const handleLocationSuccess = (position) => {
      const lat = position.coords.latitude
      const lng = position.coords.longitude
      const accuracy = position.coords.accuracy || null
      const nextLocation = { lat, lng, accuracy }

      setUserLocation(nextLocation)
      setLocationError('')
      setLocationLoading(false)
      setShowHospitalMarkers(true)
      setMapZoom((currentZoom) => Math.max(currentZoom, LIVE_LOCATION_ZOOM))
      addHistoryItem({
        key: 'location',
        icon: '📍',
        title: 'Live location updated',
        note: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      })

      const previousLocation = lastHospitalFetchRef.current
      const shouldRefresh =
        !previousLocation || getDistanceKm(previousLocation, nextLocation) >= 0.25

      if (shouldRefresh) {
        lastHospitalFetchRef.current = nextLocation
        fetchNearbyMapHospitals(lat, lng)
        fetchNearbyPlaces(lat, lng)
      }
    }

    const handleLocationError = (error) => {
      console.error('Location error:', error)
      setLocationLoading(false)
      setLocationError('Location access denied. Please allow location permission to see live hospitals.')
    }

    if ('geolocation' in navigator) {
      const geoOptions = {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      }

      navigator.geolocation.getCurrentPosition(handleLocationSuccess, handleLocationError, geoOptions)
      watchLocationRef.current = navigator.geolocation.watchPosition(handleLocationSuccess, handleLocationError, geoOptions)
    } else {
      setLocationLoading(false)
      setLocationError('Geolocation is not supported by this browser.')
    }

    return () => {
      if (watchLocationRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchLocationRef.current)
      }
    }
  }, [])

  const fetchNearbyMapHospitals = async (lat, lng) => {
    const query = `
      [out:json][timeout:60];
      (
        nwr["amenity"="hospital"](around:${HOSPITAL_MAX_DISTANCE_KM * 1000},${lat},${lng});
      );
      out center tags;
    `
    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ]

    let lastError = null

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`)
        if (!res.ok) {
          throw new Error(`Overpass request failed with status ${res.status}`)
        }

        const data = await res.json()
        const rawHospitals = Array.isArray(data.elements) ? data.elements : []
        const seenHospitals = new Set()
        const normalizedHospitals = rawHospitals
          .map((hospital) => {
            const latValue = hospital.lat ?? hospital.center?.lat
            const lonValue = hospital.lon ?? hospital.center?.lon

            if (typeof latValue !== 'number' || typeof lonValue !== 'number') return null

            const distanceKm = getDistanceKm({ lat, lng }, { lat: latValue, lng: lonValue })
            if (distanceKm < HOSPITAL_MIN_DISTANCE_KM || distanceKm > HOSPITAL_MAX_DISTANCE_KM) return null

            const key = `${hospital.type || 'node'}-${hospital.id || `${latValue}-${lonValue}`}`
            if (seenHospitals.has(key)) return null
            seenHospitals.add(key)

            return {
              ...hospital,
              lat: latValue,
              lon: lonValue,
              distanceKm,
              displayName: hospital.tags?.name || hospital.tags?.operator || 'Hospital',
              displayAddress: formatHospitalAddress(hospital),
            }
          })
          .filter(Boolean)
          .sort((a, b) => a.distanceKm - b.distanceKm)

        setNearbyMapHospitals(normalizedHospitals)
        setShowHospitalMarkers(true)
        addHistoryItem({
          key: 'hospitals',
          icon: '🏥',
          title: 'Hospitals loaded',
          note: `${normalizedHospitals.length} found within 200m-50km`,
        })
        return
      } catch (e) {
        lastError = e
      }
    }

    console.error('Failed to fetch hospitals from OSM:', lastError)
    setNearbyMapHospitals([])
  }

  const fetchNearbyPlaces = async (lat, lng) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=15&addressdetails=1`);
      const data = await res.json();
      const address = data.address || {};
      const places = [];
      
      // Extract nearby places
      if (address.village) places.push({ name: address.village, type: '🏘️' });
      if (address.suburb) places.push({ name: address.suburb, type: '🏙️' });
      if (address.neighbourhood) places.push({ name: address.neighbourhood, type: '📍' });
      if (address.road) places.push({ name: address.road, type: '🛣️' });
      if (address.city) places.push({ name: address.city, type: '🏛️' });
      if (address.county) places.push({ name: address.county, type: '🗺️' });
      if (address.state) places.push({ name: address.state, type: '📌' });
      
      setNearbyPlaces(places.slice(0, 5));
    } catch (e) {
      console.error('Failed to fetch nearby places:', e);
    }
  }

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatMessages])

  // Filter hospitals when query or filter changes
  useEffect(() => {
    filterHospitals()
  }, [hospitalSearchQuery, activeFilter, nearbyMapHospitals])

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

  const handleProfileFieldChange = (field, value) => {
    setProfileDraft((prev) => ({ ...prev, [field]: value }))
  }

  const saveProfileDetails = async () => {
    try {
      if (currentUser && supabaseClient) {
        await supabaseClient
          .from('profiles')
          .update({
            avatar_url: avatarUrl,
            full_name: profileDraft.fullName,
            phone: profileDraft.phone,
            city: profileDraft.city,
            bio: profileDraft.bio,
          })
          .eq('id', currentUser.id)
      }

      addHistoryItem({
        key: 'profile',
        icon: '👤',
        title: 'Profile updated',
        note: `${profileDraft.fullName || fullName} saved`,
      })
      setIsProfileEditing(false)
    } catch (error) {
      console.error('Failed to save profile details:', error)
    }
  }

  const handleProfileAction = async () => {
    if (isProfileEditing) {
      await saveProfileDetails()
      return
    }

    setIsProfileEditing(true)
  }

  const filterHospitals = () => {
    const query = hospitalSearchQuery.toLowerCase()
    const sourceHospitals = nearbyMapHospitals.length > 0 ? nearbyMapHospitals : MOCK_HOSPITALS
    let filtered = sourceHospitals.map(normalizeHospitalForSearch)

    if (activeFilter !== 'All') {
      const activeFilterLower = activeFilter.toLowerCase()
      filtered = filtered.filter((hospital) =>
        hospital.searchTokens.some((token) => token.includes(activeFilterLower)) ||
        hospital.tags.some((tag) => String(tag).toLowerCase().includes(activeFilterLower))
      )
    }

    if (query) {
      filtered = filtered.filter((hospital) =>
        hospital.name.toLowerCase().includes(query) ||
        hospital.address.toLowerCase().includes(query) ||
        hospital.tags.some((tag) => String(tag).toLowerCase().includes(query)) ||
        hospital.searchTokens.some((token) => token.includes(query))
      )
    }

    if (activePage === 'search' || query || activeFilter !== 'All' || nearbyMapHospitals.length > 0) {
      filtered = filtered.sort((a, b) => {
        if (typeof a.distanceKm === 'number' && typeof b.distanceKm === 'number') {
          return a.distanceKm - b.distanceKm
        }
        if (typeof a.distanceKm === 'number') return -1
        if (typeof b.distanceKm === 'number') return 1
        return 0
      })
    }

    setFilteredHospitals(filtered)
  }

  const activeHospitalDetail = useMemo(() => {
    if (!selectedHospital) return null
    return buildHospitalDetail(selectedHospital)
  }, [selectedHospital])

  const openHospitalDetail = (hospital) => {
    setSelectedHospital(hospital)
    setActivePage('hospital-detail')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBookAppointment = ({ detail, form }) => {
    const appointment = createAppointmentRecord(detail, form)
    setAppointmentHistory((prev) => [appointment, ...prev])
    addHistoryItem({
      key: `appointment-${appointment.id}`,
      icon: '📅',
      title: 'Appointment booked',
      note: `${detail.name} on ${appointment.date} at ${appointment.time}`,
    })
    setSelectedHospital(null)
    setActivePage('history')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleHospitalSearch = () => {
    addHistoryItem({
      key: 'search',
      icon: '🔎',
      title: 'Hospital search',
      note: hospitalSearchQuery?.trim()
        ? hospitalSearchQuery.trim()
        : `${activeFilter} hospitals`,
    })
    filterHospitals()
  }

  const handleAIChat = async () => {
    const message = chatInput.trim()
    if (!message) return

    addHistoryItem({
      key: 'chat',
      icon: '🤖',
      title: 'AI message sent',
      note: message.length > 34 ? `${message.slice(0, 34)}...` : message,
    })

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

  const mapBounds = useMemo(() => {
    const visibleHospitals = nearbyMapHospitals.filter(
      (hospital) => typeof hospital?.lat === 'number' && typeof hospital?.lon === 'number'
    )

    if (!userLocation || visibleHospitals.length === 0) return null

    return [
      [
        Math.min(userLocation.lat, ...visibleHospitals.map((hospital) => hospital.lat)),
        Math.min(userLocation.lng, ...visibleHospitals.map((hospital) => hospital.lon)),
      ],
      [
        Math.max(userLocation.lat, ...visibleHospitals.map((hospital) => hospital.lat)),
        Math.max(userLocation.lng, ...visibleHospitals.map((hospital) => hospital.lon)),
      ],
    ]
  }, [userLocation, nearbyMapHospitals])

  return (
    <div className="dashboard-layout">
      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">⚕️</div>
          <div className="logo-text">Health<span>Pulse</span></div>
        </div>

        <div className="sidebar-header" onClick={() => setActivePage('profile')} style={{ cursor: 'pointer' }}>
          <div
            className="avatar-wrapper"
            onClick={(e) => {
              e.stopPropagation()
              fileInputRef.current?.click()
            }}
          >
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
            <h4>{profileDraft.fullName || (fullName !== 'User' ? fullName : firstName)}</h4>
            <p>{currentEmail}</p>
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
            className={`nav-item ${activePage === 'history' ? 'active' : ''}`}
            onClick={() => setActivePage('history')}
          >
            <span>📅</span> Appointment History
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
            <div className="stats-row" style={{
              perspective: 'none',
              transform: 'none',
            }}>
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
              <div className="quick-grid" style={{
                perspective: 'none',
                transform: 'none',
              }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '15px', flexWrap: 'wrap' }}>
                <h3 className="section-title-dark" style={{ margin: 0 }}>📍 Nearby Hospitals Map</h3>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button 
                    onClick={() => setShowHospitalMarkers(!showHospitalMarkers)}
                    className="map-toggle-btn"
                    style={{
                      background: showHospitalMarkers ? 'linear-gradient(135deg, #00d4aa, #00b894)' : 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      border: '1px solid rgba(0,212,170,0.3)',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {showHospitalMarkers ? '👁️ Hide' : '👁️ Show'} Hospitals
                  </button>
                  <button 
                    onClick={() => userLocation && setMapZoom(Math.min(18, mapZoom + 1))}
                    className="map-control-btn"
                    style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.3)', color: '#00d4aa', cursor: 'pointer', fontSize: '0.9rem' }}
                  >
                    🔍+
                  </button>
                </div>
                {locationError && <span style={{ fontSize: '0.85rem', color: '#ff6b6b' }}>{locationError}</span>}
              </div>
              {locationLoading && !userLocation && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 120, color: '#e8ecf4', fontSize: '0.95rem', background: 'rgba(10,32,46,0.2)' }}>
                  Acquiring live location...
                </div>
              )}
              <div style={{ borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(0,212,170,0.3)', boxShadow: '0 20px 60px rgba(0,212,170,0.15), 0 0 40px rgba(0,212,170,0.1)', height: '500px', position: 'relative', background: 'linear-gradient(135deg, rgba(13,31,45,0.8) 0%, rgba(10,32,46,0.9) 100%)' }}>
                {userLocation ? (
                  <Map
                    center={[userLocation.lat, userLocation.lng]}
                    zoom={mapZoom}
                    bounds={showHospitalMarkers ? mapBounds : null}
                  >
                    {/* User Location Marker */}
                    <Marker
                      position={[userLocation.lat, userLocation.lng]}
                      title="Your Location"
                    >
                      <Popup>
                        <div style={{ background: 'rgba(13,31,45,0.98)', border: '1px solid rgba(0,212,170,0.3)', borderRadius: '8px', padding: '10px', color: '#e8ecf4', fontSize: '0.9rem' }}>
                          <div style={{ fontWeight: '600', color: '#00d4aa', marginBottom: '5px' }}>📍 Your Location</div>
                          <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Lat: {userLocation.lat.toFixed(4)}</div>
                          <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Lng: {userLocation.lng.toFixed(4)}</div>
                          {userLocation.accuracy && (
                            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Accuracy: {Math.round(userLocation.accuracy)} m</div>
                          )}
                        </div>
                      </Popup>
                    </Marker>

                    {/* Hospital Markers */}
                    {showHospitalMarkers && nearbyMapHospitals.map((hospital, idx) => {
                      if (!hospital || !hospital.lat || !hospital.lon) return null;
                      return (
                        <Marker
                          key={hospital.id || idx}
                          position={[hospital.lat, hospital.lon]}
                          title={hospital.displayName || hospital.tags?.name || 'Hospital'}
                          icon={hospitalIcon}
                        >
                          <Popup>
                            <div style={{ background: 'rgba(13,31,45,0.98)', border: '1px solid rgba(0,212,170,0.3)', borderRadius: '8px', padding: '12px', color: '#e8ecf4', fontSize: '0.9rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <span style={{ fontSize: '1.3rem' }}>🏥</span>
                                <strong>{hospital.displayName || hospital.tags?.name || 'Hospital'}</strong>
                              </div>
                              <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '6px' }}>📍 {hospital.tags?.['addr:street'] || 'Nearby'}</div>
                              <div style={{ fontSize: '0.75rem', color: '#00d4aa', marginTop: '6px' }}>✓ Available</div>
                            </div>
                          </Popup>
                        </Marker>
                      )
                    })}
                  </Map>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'linear-gradient(135deg, #0a1f2e 0%, #1a3a4a 100%)', color: '#7a8ba7', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ fontSize: '2.5rem', opacity: 0.6 }}>📍</div>
                    {locationError || "Waiting for location access..."}
                  </div>
                )}
                {showHospitalMarkers && nearbyMapHospitals.length > 0 && (
                  <div style={{ position: 'absolute', bottom: '15px', left: '15px', background: 'rgba(13,31,45,0.95)', border: '1px solid rgba(0,212,170,0.3)', borderRadius: '12px', padding: '12px 16px', fontSize: '0.8rem', zIndex: 100, backdropFilter: 'blur(10px)' }}>
                    <div style={{ color: '#00d4aa', fontWeight: '600', marginBottom: '6px' }}>🗺️ Map Info</div>
                    <div style={{ color: '#a0b5c7', marginBottom: '4px' }}>📍 Hospitals nearby: <span style={{ color: '#00d4aa', fontWeight: '600' }}>{nearbyMapHospitals.length}</span></div>
                    <div style={{ fontSize: '0.7rem', color: '#7a8ba7', marginTop: '6px' }}>Click markers for details</div>
                  </div>
                )}
                {nearbyPlaces.length > 0 && (
                  <div style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(13,31,45,0.95)', border: '1px solid rgba(0,212,170,0.3)', borderRadius: '12px', padding: '14px 16px', fontSize: '0.85rem', zIndex: 100, backdropFilter: 'blur(10px)', maxWidth: '220px' }}>
                    <div style={{ color: '#00d4aa', fontWeight: '600', marginBottom: '10px' }}>📍 Nearby Locations</div>
                    {nearbyPlaces.map((place, idx) => (
                      <div key={idx} style={{ color: '#a0b5c7', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                        <span>{place.type}</span>
                        <span style={{ color: '#00d4aa', fontWeight: '500' }}>{place.name}</span>
                      </div>
                    ))}
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
              <div className="location-pill">Live hospitals near you</div>
              <div style={{ marginTop: '10px', color: '#a0b5c7', fontSize: '0.9rem' }}>
                {nearbyMapHospitals.length > 0
                  ? `${nearbyMapHospitals.length} hospitals found within 200m to 50km`
                  : 'Loading live hospital data...'}
              </div>
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
              <button className="search-btn-dark" onClick={handleHospitalSearch}>Search</button>
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

            <h3 className="section-title-dark" style={{ marginBottom: '8px' }}>{filteredHospitals.length} Live Hospitals Found</h3>
            <div style={{ marginBottom: '16px', color: '#7a8ba7', fontSize: '0.9rem' }}>
              Sorted by nearest distance from your live location
            </div>
            <div className="hospital-grid-dark" style={{
              perspective: 'none',
              transform: 'none',
            }}>
              {filteredHospitals.map((hospital, idx) => (
                <div
                  key={hospital.key || idx}
                  className="hospital-card-dark hospital-card-clickable"
                  onClick={() => openHospitalDetail(hospital)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openHospitalDetail(hospital)
                    }
                  }}
                >
                  <div className="h-top">
                    <div className="h-icon-box">{hospital.source === 'OpenStreetMap' ? '📍' : '🏥'}</div>
                    <div className="h-rating">{hospital.rating || 'Live'}</div>
                  </div>
                  <h3>{hospital.name}</h3>
                  <p className="h-address">{hospital.address}</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    <span className="h-tag">{hospital.source}</span>
                    {hospital.distanceText && <span className="h-tag">{hospital.distanceText}</span>}
                    {hospital.distanceKm !== null && hospital.distanceKm !== undefined && (
                      <span className="h-tag">{hospital.distanceKm.toFixed(2)} km</span>
                    )}
                  </div>
                  {hospital.tags.length > 0 && (
                    <div className="h-tags">
                      {hospital.tags.slice(0, 6).map((tag, tagIdx) => (
                        <span key={tagIdx} className="h-tag">{tag}</span>
                      ))}
                    </div>
                  )}
                  {hospital.details.length > 0 && (
                    <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', fontSize: '0.8rem', color: '#a0b5c7' }}>
                      {hospital.details.map((detail, detailIdx) => (
                        <div key={detailIdx} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,212,170,0.15)', borderRadius: '10px', padding: '8px 10px' }}>
                          {detail}
                        </div>
                      ))}
                    </div>
                  )}
                  {(hospital.contact.phone || hospital.contact.website) && (
                    <div style={{ marginTop: '12px', fontSize: '0.8rem', color: '#a0b5c7', lineHeight: 1.6 }}>
                      {hospital.contact.phone && <div>Phone: {hospital.contact.phone}</div>}
                      {hospital.contact.website && <div>Website: {hospital.contact.website}</div>}
                    </div>
                  )}
                  <div className="h-bottom">
                    <span className="h-distance">📍 {hospital.distanceText || 'Distance not available'}</span>
                    <button
                      className="h-dir-btn"
                      onClick={(event) => {
                        event.stopPropagation()
                        openHospitalDetail(hospital)
                      }}
                    >
                      View Full Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HOSPITAL DETAIL PAGE */}
        {activePage === 'hospital-detail' && selectedHospital && activeHospitalDetail && (
          <HospitalDetailPage
            hospital={selectedHospital}
            userName={profileDraft.fullName || fullName}
            userPhone={profileDraft.phone}
            onBack={() => {
              setSelectedHospital(null)
              setActivePage('search')
            }}
            onBookAppointment={handleBookAppointment}
            onViewHistory={() => {
              setSelectedHospital(null)
              setActivePage('history')
            }}
          />
        )}

        {/* PROFILE PAGE */}
        {activePage === 'profile' && (
          <div className="dash-page active-page">
            <button className="back-btn-dark" onClick={() => setActivePage('dashboard')}>← Back</button>
            <h2 style={{ color: '#e8ecf4', marginBottom: '10px' }}>My Profile</h2>
            <p style={{ color: '#7a8ba7', marginBottom: '24px' }}>
              Keep your personal details and profile photo updated.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
              <div className="hospital-card-dark" style={{ minHeight: '100%' }}>
                <div className="h-top">
                  <div className="h-icon-box">👤</div>
                  <div className="h-rating">Profile</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
                  <div style={{ width: '108px', height: '108px', borderRadius: '28px', overflow: 'hidden', background: 'linear-gradient(135deg, #00d4aa, #00b894)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: '800', color: '#07151f', boxShadow: '0 18px 40px rgba(0,212,170,0.25)' }}>
                    {avatarUrl ? <img src={avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : avatarInitial}
                  </div>
                  <div>
                    <h3 style={{ marginBottom: '6px' }}>{profileDraft.fullName || fullName}</h3>
                    <p className="h-address" style={{ marginBottom: '4px' }}>{currentEmail}</p>
                    <p style={{ color: '#7a8ba7', fontSize: '0.85rem' }}>{profileDraft.city || 'Add your city'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button className="h-dir-btn" onClick={() => fileInputRef.current?.click()}>Change Photo</button>
                    <button className="h-dir-btn" onClick={handleProfileAction}>
                      {isProfileEditing ? 'Save Profile' : 'Edit Info'}
                    </button>
                  </div>
                  <div style={{ color: '#7a8ba7', fontSize: '0.82rem', lineHeight: 1.6 }}>
                    Your details stay private and are saved locally on this device.
                  </div>
                </div>
              </div>

              <div className="hospital-card-dark">
                <div className="h-top">
                  <div className="h-icon-box">📝</div>
                  <div className="h-rating">{isProfileEditing ? 'Editing' : 'View Mode'}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#e8ecf4' }}>
                    <span style={{ fontSize: '0.85rem', color: '#7a8ba7' }}>Full Name</span>
                    <input
                      type="text"
                      className="dark-input"
                      value={profileDraft.fullName}
                      onChange={(e) => handleProfileFieldChange('fullName', e.target.value)}
                      placeholder="Your full name"
                      disabled={!isProfileEditing}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#e8ecf4' }}>
                    <span style={{ fontSize: '0.85rem', color: '#7a8ba7' }}>Phone Number</span>
                    <input
                      type="text"
                      className="dark-input"
                      value={profileDraft.phone}
                      onChange={(e) => handleProfileFieldChange('phone', e.target.value)}
                      placeholder="+91 98765 43210"
                      disabled={!isProfileEditing}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#e8ecf4' }}>
                    <span style={{ fontSize: '0.85rem', color: '#7a8ba7' }}>City</span>
                    <input
                      type="text"
                      className="dark-input"
                      value={profileDraft.city}
                      onChange={(e) => handleProfileFieldChange('city', e.target.value)}
                      placeholder="Mathura"
                      disabled={!isProfileEditing}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#e8ecf4' }}>
                    <span style={{ fontSize: '0.85rem', color: '#7a8ba7' }}>Email</span>
                    <input
                      type="text"
                      className="dark-input"
                      value={currentEmail}
                      disabled
                      style={{ opacity: 0.85 }}
                    />
                  </label>
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#e8ecf4', marginTop: '16px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#7a8ba7' }}>About You</span>
                  <textarea
                    className="dark-input"
                    rows={4}
                    value={profileDraft.bio}
                    onChange={(e) => handleProfileFieldChange('bio', e.target.value)}
                    placeholder="Write a short bio or health preference note..."
                    style={{ resize: 'vertical', minHeight: '120px' }}
                    disabled={!isProfileEditing}
                  />
                </label>

                <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,212,170,0.12)', borderRadius: '14px', padding: '14px' }}>
                    <div style={{ color: '#7a8ba7', fontSize: '0.8rem', marginBottom: '6px' }}>Profile Status</div>
                    <div style={{ color: '#00d4aa', fontWeight: '700' }}>Active</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,212,170,0.12)', borderRadius: '14px', padding: '14px' }}>
                    <div style={{ color: '#7a8ba7', fontSize: '0.8rem', marginBottom: '6px' }}>Saved On</div>
                    <div style={{ color: '#e8ecf4', fontWeight: '700' }}>{new Date().toLocaleDateString('en-IN')}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,212,170,0.12)', borderRadius: '14px', padding: '14px' }}>
                    <div style={{ color: '#7a8ba7', fontSize: '0.8rem', marginBottom: '6px' }}>Phone</div>
                    <div style={{ color: '#e8ecf4', fontWeight: '700' }}>{profileDraft.phone || 'Not added'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* APPOINTMENT HISTORY PAGE */}
        {activePage === 'history' && (
          <div className="dash-page active-page">
            <button className="back-btn-dark" onClick={() => setActivePage('dashboard')}>← Back</button>
            <h2 style={{ color: '#e8ecf4', marginBottom: '10px' }}>Appointment History</h2>
            <p style={{ color: '#7a8ba7', marginBottom: '24px' }}>
              View your past and upcoming appointments in one place.
            </p>

            <div className="hospital-grid-dark" style={{ perspective: 'none', transform: 'none' }}>
              {appointmentHistory.length === 0 ? (
                <div className="hospital-card-dark" style={{ gridColumn: '1 / -1' }}>
                  <div className="h-top">
                    <div className="h-icon-box">📅</div>
                    <div className="h-rating">Empty</div>
                  </div>
                  <h3>No appointments yet</h3>
                  <p className="h-address">Your appointment history will appear here once you book a visit.</p>
                </div>
              ) : (
                appointmentHistory.map((item) => (
                  <div key={item.id} className="hospital-card-dark">
                    <div className="h-top">
                      <div className="h-icon-box">🏥</div>
                      <div className="h-rating">{item.status}</div>
                    </div>
                    <h3>{item.hospital}</h3>
                    <p className="h-address">{item.doctor} • {item.specialty}</p>
                    <div className="h-tags">
                      <span className="h-tag">{item.date}</span>
                      <span className="h-tag">{item.time}</span>
                    </div>
                    <div style={{ color: '#a0b5c7', fontSize: '0.85rem', marginBottom: '14px', lineHeight: 1.6 }}>
                      {item.notes}
                      {(item.patientName || item.phone) && (
                        <div style={{ marginTop: '8px', color: '#7a8ba7' }}>
                          {item.patientName && <div>Patient: {item.patientName}</div>}
                          {item.phone && <div>Phone: {item.phone}</div>}
                        </div>
                      )}
                    </div>
                    <div className="h-bottom">
                      <span className="h-distance">📍 Appointment record</span>
                      <button className="h-dir-btn">View Details →</button>
                    </div>
                  </div>
                ))
              )}
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
