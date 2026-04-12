import React, { useState, useRef, useEffect, useMemo, Component } from 'react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { Map, MapControls, Marker, Popup, hospitalIcon } from '../components/ui/map'
import HospitalDetailPage from './HospitalDetailPage'
import { 
  Trash2, 
  FileText,
  File, 
  Image as ImageIcon, 
  Plus, 
  Calendar, 
  Edit2, 
  FileCode,
  Download
} from 'lucide-react'
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

class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorMsg: '' }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Section crash:', error, errorInfo)
    this.setState({ errorMsg: error?.toString?.() || 'Unexpected section error' })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="hospital-card-dark" style={{ marginTop: '20px', borderColor: 'rgba(255,107,107,0.45)' }}>
          <h3 style={{ color: '#ff8f8f', marginBottom: '8px' }}>Hospital Search crashed</h3>
          <p className="h-address" style={{ color: '#ffd2d2' }}>
            Something went wrong while loading hospitals. Please reload and try again.
          </p>
          <p style={{ color: '#ffb3b3', fontSize: '0.8rem', marginTop: '10px' }}>{this.state.errorMsg}</p>
        </div>
      )
    }

    return this.props.children
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

const getLiveHospitalRating = (hospital) => {
  const tags = hospital?.tags || {}
  const rawRating = tags.stars || tags.rating || tags['healthcare:rating']
  const parsedRating = Number.parseFloat(String(rawRating || '').replace(/[^0-9.]/g, ''))

  if (Number.isFinite(parsedRating)) {
    return Math.max(3.0, Math.min(5.0, parsedRating)).toFixed(1)
  }

  const seedText = `${hospital?.displayName || tags.name || hospital?.id || 'hospital'}`
  const hash = seedText.split('').reduce((acc, char) => ((acc * 33 + char.charCodeAt(0)) >>> 0), 11)
  return (3.9 + (hash % 10) * 0.1).toFixed(1)
}

const normalizeHospitalForSearch = (hospital, index) => {
  if (!hospital || typeof hospital !== 'object') {
    return {
      key: `invalid-${index}`,
      name: 'Unknown Hospital',
      address: 'Address unavailable',
      distanceText: '',
      distanceKm: null,
      rating: 'N/A',
      source: 'Unknown',
      tags: [],
      details: [],
      contact: {
        phone: '',
        website: '',
      },
      raw: null,
      searchTokens: [],
    }
  }

  if (hospital?.displayName || typeof hospital?.distanceKm === 'number') {
    const tags = hospital?.tags || {}
    const parsedDistance =
      typeof hospital?.distanceKm === 'number'
        ? hospital.distanceKm
        : Number.parseFloat(hospital?.distanceKm)
    const safeDistanceKm = Number.isFinite(parsedDistance) ? parsedDistance : null
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
      distanceText: safeDistanceKm !== null ? `${safeDistanceKm.toFixed(2)} km away` : 'Nearby',
      distanceKm: safeDistanceKm,
      rating: getLiveHospitalRating(hospital),
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
    name: hospital.name || 'Hospital',
    address: hospital.address || 'Address unavailable',
    distanceText: hospital.distance || '',
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

const toTitleCase = (value = '') =>
  value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

const getStableHash = (value = '') =>
  value.split('').reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) >>> 0), 7)

const getServiceBasePrice = (serviceName = '') => {
  const service = serviceName.toLowerCase()

  if (service.includes('mri')) return 4500
  if (service.includes('ct')) return 3800
  if (service.includes('x-ray') || service.includes('xray')) return 800
  if (service.includes('ecg')) return 700
  if (service.includes('icu')) return 6500
  if (service.includes('blood')) return 600
  if (service.includes('cardio')) return 2200
  if (service.includes('neuro')) return 2800
  if (service.includes('consult')) return 900

  return 1600
}

const estimateServicePrice = ({ serviceName, hospitalName, rating }) => {
  const basePrice = getServiceBasePrice(serviceName)
  const ratingNumber = Number.parseFloat(String(rating || '').replace(/[^0-9.]/g, ''))
  const normalizedRating = Number.isFinite(ratingNumber) ? Math.max(3.0, Math.min(5.0, ratingNumber)) : 4.2

  // Price is mainly decided by hospital rating.
  const ratingFactor =
    normalizedRating >= 4.8 ? 1.30 :
    normalizedRating >= 4.6 ? 1.22 :
    normalizedRating >= 4.4 ? 1.15 :
    normalizedRating >= 4.2 ? 1.08 :
    normalizedRating >= 4.0 ? 1.00 :
    normalizedRating >= 3.8 ? 0.93 :
    0.86

  const noiseHash = getStableHash(`${hospitalName}-${serviceName}`)
  const minorVariation = 0.97 + ((noiseHash % 7) / 100)

  const estimated = Math.round((basePrice * ratingFactor * minorVariation) / 10) * 10
  return Math.max(estimated, 300)
}

const toDistanceLabel = (distanceKm) => {
  if (typeof distanceKm === 'number' && Number.isFinite(distanceKm)) {
    return `${distanceKm.toFixed(2)} km`
  }

  const parsed = Number.parseFloat(distanceKm)
  if (Number.isFinite(parsed)) {
    return `${parsed.toFixed(2)} km`
  }

  return null
}

const includesAny = (text, terms) => terms.some((term) => text.includes(term))

const getHospitalMetaBlob = (hospital) => {
  const tagsText = Array.isArray(hospital?.tags) ? hospital.tags.join(' ') : ''
  const searchTokensText = Array.isArray(hospital?.searchTokens) ? hospital.searchTokens.join(' ') : ''
  const detailsText = Array.isArray(hospital?.details) ? hospital.details.join(' ') : ''
  return `${hospital?.name || ''} ${hospital?.address || ''} ${tagsText} ${searchTokensText} ${detailsText}`.toLowerCase()
}

const buildTriageAssessment = ({ symptomsText, severityLevel, durationDays }) => {
  const text = String(symptomsText || '').trim().toLowerCase()
  const safeDuration = Math.max(0, Number(durationDays) || 0)
  const severity = Math.min(10, Math.max(1, Number(severityLevel) || 1))

  if (!text) {
    return {
      score: 10,
      urgency: 'Low',
      color: '#5dd39e',
      reasons: ['Add symptoms to generate a smarter triage score.'],
      recommendation: 'Track symptoms for 24 hours. If they worsen, consult a doctor.',
    }
  }

  const emergencyTerms = ['chest pain', 'breathless', 'shortness of breath', 'stroke', 'unconscious', 'seizure', 'heavy bleeding', 'heart attack']
  const moderateTerms = ['fever', 'vomit', 'dizzy', 'migraine', 'abdominal', 'infection', 'persistent cough']

  let score = 15 + severity * 6 + Math.min(20, safeDuration * 2)
  const reasons = []

  if (includesAny(text, emergencyTerms)) {
    score += 45
    reasons.push('Emergency symptoms detected in your input.')
  }

  if (includesAny(text, moderateTerms)) {
    score += 15
    reasons.push('Moderate-risk symptoms suggest medical consultation soon.')
  }

  if (safeDuration >= 4) {
    score += 10
    reasons.push('Symptoms lasting multiple days raise risk.')
  }

  score = Math.max(0, Math.min(100, score))

  if (score >= 80) {
    return {
      score,
      urgency: 'High',
      color: '#ff6b6b',
      reasons: reasons.length ? reasons : ['High-severity symptom pattern detected.'],
      recommendation: 'Seek emergency care immediately and keep a trusted contact informed.',
    }
  }

  if (score >= 50) {
    return {
      score,
      urgency: 'Medium',
      color: '#f7b955',
      reasons: reasons.length ? reasons : ['Symptoms need timely medical attention.'],
      recommendation: 'Book a hospital consultation in the next 12-24 hours.',
    }
  }

  return {
    score,
    urgency: 'Low',
    color: '#5dd39e',
    reasons: reasons.length ? reasons : ['Current signals look low-risk but still monitor progression.'],
    recommendation: 'Hydrate, rest, and monitor symptoms. Consult if symptoms increase.',
  }
}

const scoreHospitalFit = (hospital, preferences) => {
  const blob = getHospitalMetaBlob(hospital)
  const distanceKm = typeof hospital?.distanceKm === 'number' ? hospital.distanceKm : 25
  const rating = Number.parseFloat(String(hospital?.rating || '').replace(/[^0-9.]/g, '')) || 4.1

  let score = 0
  const reasons = []

  const distanceScore = Math.max(0, 35 - distanceKm)
  score += distanceScore
  reasons.push(distanceKm <= 5 ? 'Very close to your location.' : 'Distance is acceptable for planned visit.')

  score += Math.max(0, Math.min(20, (rating - 3) * 10))
  reasons.push(`Hospital rating around ${rating.toFixed(1)}.`)

  if (preferences.needsEmergency && includesAny(blob, ['emergency', '24/7', 'icu'])) {
    score += 18
    reasons.push('Emergency-capable signals found.')
  }

  if (preferences.needsWheelchair && includesAny(blob, ['wheelchair', 'accessible'])) {
    score += 12
    reasons.push('Accessibility support appears available.')
  }

  if (preferences.hospitalType !== 'any') {
    const typeMatch = includesAny(blob, [preferences.hospitalType])
    if (typeMatch) {
      score += 10
      reasons.push(`Matches preferred ${preferences.hospitalType} care.`)
    }
  }

  const estimatedCost = estimateServicePrice({
    serviceName: preferences.serviceName || 'Consultation',
    hospitalName: hospital?.name || 'Hospital',
    rating,
  })

  if (preferences.maxBudget >= estimatedCost) {
    score += 15
    reasons.push(`Estimated cost INR ${estimatedCost} fits your budget.`)
  } else {
    score -= 8
    reasons.push(`Estimated cost INR ${estimatedCost} may exceed your budget.`)
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
    estimatedCost,
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
import { apiUrl, API_BASE_URL } from '../utils/api'
import { buildHospitalDetail, createAppointmentRecord } from '../utils/hospitalDetails'

function Dashboard({ currentUser, activePage, setActivePage, activeFilter, setActiveFilter, onLogout }) {
  const suggestedServices = ['X-Ray', 'MRI', 'CT Scan', 'ECG', 'ICU Bed', 'Blood Test']
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [profileDraft, setProfileDraft] = useState({
    fullName: '',
    phone: '',
    city: '',
    bio: '',
    password: '',
  })
  const [hospitalSearchQuery, setHospitalSearchQuery] = useState('')
  const [serviceSearchQuery, setServiceSearchQuery] = useState('')
  const [filteredHospitals, setFilteredHospitals] = useState(MOCK_HOSPITALS)
  const [appointmentHistory, setAppointmentHistory] = useState(DEFAULT_APPOINTMENTS)
  const [favoriteHospitals, setFavoriteHospitals] = useState([])
  const [favoriteHospitalKeysPending, setFavoriteHospitalKeysPending] = useState([])
  const [activityHistory, setActivityHistory] = useState([])
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isSending, setChatIsSending] = useState(false)
  const [isProfileEditing, setIsProfileEditing] = useState(false)
  const [profileMemberId, setProfileMemberId] = useState('')
  const [profilePassword, setProfilePassword] = useState('')
  const [serviceSearchResults, setServiceSearchResults] = useState([])
  const [serviceSearchLoading, setServiceSearchLoading] = useState(false)
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert', // 'alert' or 'confirm'
    onConfirm: null,
  })
  const chatContainerRef = useRef(null)
  const fileInputRef = useRef(null)
  const [userLocation, setUserLocation] = useState(null)
  const [locationError, setLocationError] = useState('')
  const [nearbyMapHospitals, setNearbyMapHospitals] = useState([])
  const [nearbyPlaces, setNearbyPlaces] = useState([])
  const [showHospitalMarkers, setShowHospitalMarkers] = useState(true)
  const [mapZoom, setMapZoom] = useState(13)
  const [currentDateString, setCurrentDateString] = useState('')
  const [locationLoading, setLocationLoading] = useState(true)
  const [selectedHospital, setSelectedHospital] = useState(null)
  const [hospitalDetailBackPage, setHospitalDetailBackPage] = useState('search')
  const [appointmentContext, setAppointmentContext] = useState(null)
  const [pendingDeleteAppointmentId, setPendingDeleteAppointmentId] = useState('')
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false)
  const [triageSymptoms, setTriageSymptoms] = useState('')
  const [triageSeverity, setTriageSeverity] = useState(4)
  const [triageDurationDays, setTriageDurationDays] = useState(1)
  const [isEmergencyMode, setIsEmergencyMode] = useState(false)
  const [fitPreferences, setFitPreferences] = useState({
    serviceName: 'Consultation',
    maxBudget: 2000,
    hospitalType: 'any',
    needsEmergency: false,
    needsWheelchair: false,
  })
  const watchLocationRef = useRef(null)
  const lastHospitalFetchRef = useRef(null)

  // Document Vault State
  const [documents, setDocuments] = useState([])
  const [selectedDocumentDate, setSelectedDocumentDate] = useState(null)
  const [pendingUploads, setPendingUploads] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [editingDocId, setEditingDocId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editNote, setEditNote] = useState('')
  const [reUploadingDocId, setReUploadingDocId] = useState(null)

  const safeFavoriteHospitals = useMemo(
    () => (Array.isArray(favoriteHospitals) ? favoriteHospitals.filter((favorite) => favorite && typeof favorite === 'object') : []),
    [favoriteHospitals],
  )

  const favoriteIdByHospitalKey = useMemo(() => {
    const pairs = safeFavoriteHospitals
      .filter((favorite) => favorite.hospitalKey && favorite.id)
      .map((favorite) => [favorite.hospitalKey, favorite.id])
    return new Map(pairs)
  }, [safeFavoriteHospitals])

  const getFavoriteIdForHospitalKey = (hospitalKey) => {
    if (favoriteIdByHospitalKey instanceof Map) {
      return favoriteIdByHospitalKey.get(hospitalKey)
    }

    if (favoriteIdByHospitalKey && typeof favoriteIdByHospitalKey === 'object') {
      return favoriteIdByHospitalKey[hospitalKey]
    }

    return undefined
  }

  const hasFavoriteForHospital = (hospital) => {
    const hospitalKey = getHospitalFavoriteKey(hospital)
    return Boolean(getFavoriteIdForHospitalKey(hospitalKey))
  }

  const getHospitalFavoriteKey = (hospital) =>
    String(
      hospital?.key ||
        hospital?.id ||
        hospital?.name ||
        `${hospital?.address || 'unknown-address'}-${hospital?.distanceText || ''}`,
    )

  const addHistoryItem = (item) => {
    setActivityHistory((prev) => [
      { ...item, id: `${item.key}-${Date.now()}` },
      ...prev.filter((entry) => entry.key !== item.key),
    ].slice(0, 5))
  }

  const showAlert = (title, message) => {
    setModalState({ isOpen: true, title, message, type: 'alert', onConfirm: null })
  }

  const showConfirm = (title, message, onConfirm) => {
    setModalState({ isOpen: true, title, message, type: 'confirm', onConfirm })
  }

  const closeModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }))
  }

  const handleModalConfirm = () => {
    if (modalState.onConfirm) {
      modalState.onConfirm()
    }
    closeModal()
  }

  const getFallbackMemberId = (userId) => {
    if (!userId) return 'HUB-UNASSIGNED'
    const compact = String(userId).replace(/-/g, '').toUpperCase()
    return `HUB-${compact.slice(-8)}`
  }

  const getRandomPassword = () => {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
    const bytes = new Uint8Array(16)
    window.crypto.getRandomValues(bytes)
    return Array.from(bytes, (byte) => charset[byte % charset.length]).join('')
  }

  useEffect(() => {
    if (!currentUser?.id) return

    let isMounted = true

    const loadAppointments = async () => {
      try {
        const res = await fetch(apiUrl(`/api/appointments?userId=${encodeURIComponent(currentUser.id)}`))
        if (!res.ok) {
          throw new Error(`Appointments request failed with status ${res.status}`)
        }

        const data = await res.json()
        if (!isMounted) return

        if (Array.isArray(data.appointments) && data.appointments.length > 0) {
          setAppointmentHistory(data.appointments)
        } else {
          setAppointmentHistory(DEFAULT_APPOINTMENTS)
        }
      } catch (error) {
        console.error('Failed to load appointment history from backend:', error)
        if (isMounted) {
          setAppointmentHistory(DEFAULT_APPOINTMENTS)
        }
      }
    }

    loadAppointments()

    return () => {
      isMounted = false
    }
  }, [currentUser?.id])

  useEffect(() => {
    if (!currentUser?.id) return

    const fetchDocuments = async () => {
      try {
        const { data, error } = await supabaseClient
          .from('documents')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false })

        if (error) throw error

        const formattedDocs = (data || []).map((doc) => ({
          id: doc.id,
          title: doc.title,
          note: doc.note,
          uploadedAt: doc.created_at,
          fileName: doc.title, 
          fileSize: doc.file_size || 0,
          fileType: doc.file_url.split('.').pop(),
          status: 'Synced',
          url: doc.file_url,
          filePath: doc.file_path,
          history: Array.isArray(doc.history) ? doc.history : [],
          groupId: doc.group_id,
        }))

        setDocuments(formattedDocs)

        if (formattedDocs.length > 0) {
          const firstDocDate = new Date(formattedDocs[0].uploadedAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
          setSelectedDocumentDate(firstDocDate)
        }
      } catch (error) {
        console.error('Failed to load documents from Supabase:', error)
        setDocuments([])
      }
    }

    fetchDocuments()
  }, [currentUser?.id])

  useEffect(() => {
    if (!currentUser?.id) return

    let isMounted = true

    const loadFavoriteHospitals = async () => {
      try {
        const res = await fetch(apiUrl(`/api/favorites?userId=${encodeURIComponent(currentUser.id)}`))
        if (!res.ok) {
          throw new Error(`Favorites request failed with status ${res.status}`)
        }

        const data = await res.json()
        if (!isMounted) return

        if (Array.isArray(data.favorites)) {
          setFavoriteHospitals(data.favorites.filter((favorite) => favorite && typeof favorite === 'object'))
        } else {
          setFavoriteHospitals([])
        }
      } catch (error) {
        console.error('Failed to load favorite hospitals from backend:', error)
        if (isMounted) {
          setFavoriteHospitals([])
        }
      }
    }

    loadFavoriteHospitals()

    return () => {
      isMounted = false
    }
  }, [currentUser?.id])

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
          password: parsedProfile.password || '',
        }))
        return
      }

      const initialProfile = {
        fullName: fullName !== 'User' ? fullName : firstName,
        phone: '',
        city: '',
        bio: 'Keeping your healthcare details organized.',
        password: '',
      }
      setProfileDraft(initialProfile)
      window.localStorage.setItem(profileStorageKey, JSON.stringify({
        fullName: initialProfile.fullName,
        phone: initialProfile.phone,
        city: initialProfile.city,
        bio: initialProfile.bio,
        password: initialProfile.password,
      }))
    } catch (error) {
      console.error('Failed to load profile draft:', error)
    }
  }, [profileStorageKey, fullName, firstName])

  useEffect(() => {
    if (!profileStorageKey || !profileDraft.fullName) return
    try {
      window.localStorage.setItem(profileStorageKey, JSON.stringify({
        fullName: profileDraft.fullName,
        phone: profileDraft.phone,
        city: profileDraft.city,
        bio: profileDraft.bio,
        password: profileDraft.password,
      }))
    } catch (error) {
      console.error('Failed to save profile draft:', error)
    }
  }, [profileStorageKey, profileDraft])

  useEffect(() => {
    const formatDate = () =>
      new Date().toLocaleString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })

    setCurrentDateString(formatDate())
    const intervalId = window.setInterval(() => {
      setCurrentDateString(formatDate())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

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

  useEffect(() => {
    if (!serviceSearchQuery.trim()) {
      setServiceSearchResults([])
      setServiceSearchLoading(false)
      return
    }

    let isMounted = true
    const timer = window.setTimeout(async () => {
      setServiceSearchLoading(true)
      try {
        const params = new URLSearchParams({ query: serviceSearchQuery.trim() })
        if (userLocation?.lat && userLocation?.lng) {
          params.set('lat', String(userLocation.lat))
          params.set('lng', String(userLocation.lng))
        }

        const res = await fetch(apiUrl(`/api/services/search?${params.toString()}`))
        if (!res.ok) {
          throw new Error(`Service search request failed with status ${res.status}`)
        }

        const data = await res.json()
        if (isMounted) {
          setServiceSearchResults(Array.isArray(data.results) ? data.results : [])
        }
      } catch (error) {
        console.error('Service search failed:', error)
        if (isMounted) setServiceSearchResults([])
      } finally {
        if (isMounted) setServiceSearchLoading(false)
      }
    }, 250)

    return () => {
      isMounted = false
      window.clearTimeout(timer)
    }
  }, [serviceSearchQuery, userLocation?.lat, userLocation?.lng])

  const fetchNearbyMapHospitals = async (lat, lng) => {
    try {
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng) })
      const res = await fetch(apiUrl(`/api/hospitals/nearby?${params.toString()}`))
      if (!res.ok) {
        throw new Error(`Hospital request failed with status ${res.status}`)
      }

      const data = await res.json()
      const normalizedHospitals = Array.isArray(data.hospitals) ? data.hospitals : []

      setNearbyMapHospitals(normalizedHospitals)
      setShowHospitalMarkers(true)
      addHistoryItem({
        key: 'hospitals',
        icon: '🏥',
        title: 'Hospitals loaded',
        note: `${normalizedHospitals.length} found within 200m-50km`,
      })
    } catch (error) {
      console.error('Failed to fetch hospitals from backend:', error)
      setNearbyMapHospitals([])
    }
  }

  const fetchNearbyPlaces = async (lat, lng) => {
    try {
      const res = await fetch(apiUrl(`/api/places/nearby?lat=${lat}&lng=${lng}`))
      if (!res.ok) {
        throw new Error(`Nearby places request failed with status ${res.status}`)
      }

      const data = await res.json()
      setNearbyPlaces(Array.isArray(data.places) ? data.places.slice(0, 5) : [])
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

    const resolveAvatarFromStorage = async (avatarPathHint = '') => {
      try {
        if (avatarPathHint) {
          const { data: hintedUrlData } = supabaseClient.storage
            .from('avatars')
            .getPublicUrl(avatarPathHint)

          if (hintedUrlData?.publicUrl) {
            return hintedUrlData.publicUrl
          }
        }

        const { data: files, error: listError } = await supabaseClient.storage
          .from('avatars')
          .list(currentUser.id, {
            limit: 20,
            sortBy: { column: 'updated_at', order: 'desc' },
          })

        if (listError || !Array.isArray(files) || files.length === 0) {
          return ''
        }

        const preferredFile =
          files.find((item) => String(item.name || '').toLowerCase().startsWith('avatar.')) || files[0]

        if (!preferredFile?.name) {
          return ''
        }

        const filePath = `${currentUser.id}/${preferredFile.name}`
        const { data: listedUrlData } = supabaseClient.storage
          .from('avatars')
          .getPublicUrl(filePath)

        return listedUrlData?.publicUrl || ''
      } catch (storageError) {
        console.error('Avatar storage fallback failed:', storageError)
        return ''
      }
    }

    try {
      const authAvatarUrl = currentUser?.user_metadata?.avatar_url || currentUser?.app_metadata?.avatar_url || ''
      const authAvatarPath = currentUser?.user_metadata?.avatar_path || ''
      const authPassword = currentUser?.user_metadata?.login_password || ''

      if (authAvatarUrl) {
        setAvatarUrl(authAvatarUrl)
      }

      const { data, error } = await supabaseClient
        .from('profiles')
        .select('avatar_url, member_id, login_password')
        .eq('id', currentUser.id)
        .maybeSingle()

      if (error) {
        throw error
      }

      let savedAvatarUrl = data?.avatar_url || authAvatarUrl
      if (!savedAvatarUrl) {
        savedAvatarUrl = await resolveAvatarFromStorage(authAvatarPath)
      }

      if (savedAvatarUrl) {
        setAvatarUrl(savedAvatarUrl)
      }

      setProfileMemberId(data?.member_id || getFallbackMemberId(currentUser.id))

      const provider = currentUser?.app_metadata?.provider || currentUser?.user_metadata?.provider
      const storedPassword = String(data?.login_password || authPassword || profileDraft.password || '')

      if (provider === 'google' && !storedPassword) {
        const generatedPassword = getRandomPassword()
        setProfilePassword(generatedPassword)
        setProfileDraft((prev) => ({ ...prev, password: generatedPassword }))

        try {
          const { error: authUpdateError } = await supabaseClient.auth.updateUser({
            password: generatedPassword,
          })

          if (authUpdateError) {
            throw authUpdateError
          }

          const { error: profileUpdateError } = await supabaseClient
            .from('profiles')
            .upsert(
              {
                id: currentUser.id,
                login_password: generatedPassword,
                name: profileDraft.fullName || fullName,
              },
              { onConflict: 'id' },
            )

          await supabaseClient.auth.updateUser({
            data: {
              login_password: generatedPassword,
            },
          })

          if (profileUpdateError) {
            throw profileUpdateError
          }
        } catch (syncError) {
          console.error('Failed to sync generated Google password:', syncError)
        }

        return
      }

      setProfilePassword(storedPassword)
      setProfileDraft((prev) => ({ ...prev, password: storedPassword }))
    } catch (err) {
      console.error('Load avatar failed:', err.message)
      setProfileMemberId(getFallbackMemberId(currentUser?.id))

      const authAvatarPath = currentUser?.user_metadata?.avatar_path || ''
      const fallbackAvatarUrl = await resolveAvatarFromStorage(authAvatarPath)
      if (fallbackAvatarUrl) {
        setAvatarUrl(fallbackAvatarUrl)
      }

      const localPassword = String(profileDraft.password || '')
      if (localPassword) {
        setProfilePassword(localPassword)
      }
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

      const { error: profileUpsertError } = await supabaseClient
        .from('profiles')
        .upsert({ id: currentUser.id, avatar_url: publicUrl }, { onConflict: 'id' })

      if (profileUpsertError) {
        console.error('Avatar profile upsert failed:', profileUpsertError.message)
      }

      const { error: metadataError } = await supabaseClient.auth.updateUser({
        data: { avatar_url: publicUrl, avatar_path: filePath },
      })

      if (metadataError) {
        console.error('Avatar metadata update failed:', metadataError.message)
      }

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
        const nextPassword = String(profileDraft.password || profilePassword || '').trim()

        if (nextPassword && nextPassword !== profilePassword) {
          const { error: authUpdateError } = await supabaseClient.auth.updateUser({
            password: nextPassword,
          })

          if (authUpdateError) {
            throw authUpdateError
          }
        }

        const { error: profileUpsertError } = await supabaseClient
          .from('profiles')
          .upsert(
            {
              id: currentUser.id,
              avatar_url: avatarUrl,
              login_password: nextPassword || null,
              name: profileDraft.fullName || fullName,
            },
            { onConflict: 'id' },
          )

        if (profileUpsertError) {
          throw profileUpsertError
        }

        // Optional profile columns might not exist in every schema; ignore if unavailable.
        await supabaseClient
          .from('profiles')
          .update({
            full_name: profileDraft.fullName,
            phone: profileDraft.phone,
            city: profileDraft.city,
            bio: profileDraft.bio,
          })
          .eq('id', currentUser.id)

        if (avatarUrl) {
          await supabaseClient.auth.updateUser({
            data: {
              avatar_url: avatarUrl,
              login_password: nextPassword || profilePassword || '',
            },
          })
        }

          if (nextPassword) {
            setProfilePassword(nextPassword)
            setProfileDraft((prev) => ({ ...prev, password: nextPassword }))
          }
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

  const updateFitPreference = (key, value) => {
    setFitPreferences((prev) => ({ ...prev, [key]: value }))
  }

  const filterHospitals = () => {
    try {
      const query = String(hospitalSearchQuery || '').toLowerCase()
      const sourceHospitals = nearbyMapHospitals.length > 0 ? nearbyMapHospitals : MOCK_HOSPITALS
      let filtered = (Array.isArray(sourceHospitals) ? sourceHospitals : [])
        .map(normalizeHospitalForSearch)
        .filter(Boolean)

      if (activeFilter !== 'All') {
        const activeFilterLower = String(activeFilter || '').toLowerCase()
        filtered = filtered.filter((hospital) =>
          (Array.isArray(hospital.searchTokens) && hospital.searchTokens.some((token) => token.includes(activeFilterLower))) ||
          (Array.isArray(hospital.tags) && hospital.tags.some((tag) => String(tag).toLowerCase().includes(activeFilterLower)))
        )
      }

      if (query) {
        filtered = filtered.filter((hospital) =>
          String(hospital.name || '').toLowerCase().includes(query) ||
          String(hospital.address || '').toLowerCase().includes(query) ||
          (Array.isArray(hospital.tags) && hospital.tags.some((tag) => String(tag).toLowerCase().includes(query))) ||
          (Array.isArray(hospital.searchTokens) && hospital.searchTokens.some((token) => token.includes(query)))
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
    } catch (error) {
      console.error('Hospital filter failed:', error)
      setFilteredHospitals((Array.isArray(MOCK_HOSPITALS) ? MOCK_HOSPITALS : []).map(normalizeHospitalForSearch))
    }
  }

  const activeHospitalDetail = useMemo(() => {
    if (!selectedHospital) return null
    return buildHospitalDetail(selectedHospital)
  }, [selectedHospital])

  const openHospitalDetail = (hospital, sourcePage = activePage, nextAppointmentContext = null) => {
    const safeBackPage = sourcePage && sourcePage !== 'hospital-detail' ? sourcePage : 'search'
    setHospitalDetailBackPage(safeBackPage)
    setAppointmentContext(nextAppointmentContext)
    setSelectedHospital(hospital)
    setActivePage('hospital-detail')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const buildHospitalFromServiceResult = (result, selectedServiceName = '') => {
    const distanceLabel = toDistanceLabel(result?.distanceKm)
    const services = Array.isArray(result?.matchedServices) ? result.matchedServices : []
    const matchedServiceTag = selectedServiceName ? `Matched service: ${selectedServiceName}` : ''
    const serviceTags = services.slice(0, 4).map((service) => String(service?.name || '').trim()).filter(Boolean)
    const servicePriceDetails = services
      .slice(0, 3)
      .map((service) => {
        const serviceName = String(service?.name || '').trim()
        if (!serviceName) return null
        const priceLabel = typeof service?.price === 'number' ? `INR ${service.price.toLocaleString('en-IN')}` : 'Price on request'
        return `${serviceName}: ${priceLabel}`
      })
      .filter(Boolean)

    return {
      key: `service-${String(result?.hospital || 'hospital').toLowerCase().replace(/\s+/g, '-')}`,
      name: result?.hospital || 'Hospital',
      address: result?.address || 'Address unavailable',
      distanceText: distanceLabel ? `${distanceLabel} away` : 'Nearby',
      distanceKm: typeof result?.distanceKm === 'number' ? result.distanceKm : null,
      rating: result?.rating || 'N/A',
      source: 'Service Search',
      tags: [matchedServiceTag, ...serviceTags].filter(Boolean),
      details: servicePriceDetails,
      contact: {
        phone: '',
        website: '',
      },
      raw: null,
      searchTokens: [
        String(result?.hospital || '').toLowerCase(),
        String(result?.address || '').toLowerCase(),
        String(selectedServiceName || '').toLowerCase(),
      ].filter(Boolean),
    }
  }

  const openServiceResultHospitalDetail = async (result, selectedServiceName = '', action = 'details') => {
    const fallbackHospital = buildHospitalFromServiceResult(result, selectedServiceName || serviceSearchQuery.trim())
    let hospitalForDetail = fallbackHospital

    try {
      const params = new URLSearchParams({ name: String(result?.hospital || '') })
      if (userLocation?.lat && userLocation?.lng) {
        params.set('lat', String(userLocation.lat))
        params.set('lng', String(userLocation.lng))
      }

      const res = await fetch(apiUrl(`/api/hospitals/detail?${params.toString()}`))
      if (res.ok) {
        const data = await res.json()
        if (data?.detail) {
          hospitalForDetail = data.detail
        }
      }
    } catch (error) {
      console.error('Failed to load full hospital detail from service result:', error)
    }

    addHistoryItem({
      key: `service-${action}-${fallbackHospital.key}-${Date.now()}`,
      icon: action === 'book' ? '📅' : '📘',
      title: action === 'book' ? 'Appointment flow opened' : 'Hospital details opened',
      note: `${fallbackHospital.name}${selectedServiceName ? ` • ${selectedServiceName}` : ''}`,
    })

    const nextAppointmentContext =
      action === 'book'
        ? {
            mode: 'service-quick',
            intent: 'book',
            serviceName: selectedServiceName || serviceSearchQuery.trim(),
            email: currentEmail || '',
          }
        : null

    openHospitalDetail(hospitalForDetail, 'find-service', nextAppointmentContext)
  }

  const handleBookAppointment = async ({ detail, form }) => {
    try {
      const appointmentPreview = createAppointmentRecord(detail, form)
      const res = await fetch(apiUrl('/api/appointments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          detail,
          form,
        }),
      })

      if (!res.ok) {
        throw new Error(`Appointment save failed with status ${res.status}`)
      }

      const data = await res.json()
      const appointment = data.appointment || appointmentPreview
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
    } catch (error) {
      console.error('Appointment save failed:', error)
      const fallbackAppointment = createAppointmentRecord(detail, form)
      setAppointmentHistory((prev) => [fallbackAppointment, ...prev])
      setSelectedHospital(null)
      setActivePage('history')
    }
  }

  const handleDeleteAppointment = (appointmentId) => {
    setPendingDeleteAppointmentId(appointmentId)
  }

  const resolveHospitalCoordinates = (hospital) => {
    const directLat = Number.parseFloat(hospital?.raw?.lat ?? hospital?.lat)
    const directLon = Number.parseFloat(hospital?.raw?.lon ?? hospital?.lon)
    if (Number.isFinite(directLat) && Number.isFinite(directLon)) {
      return { lat: directLat, lon: directLon }
    }

    const matched = nearbyMapHospitals.find((candidate) => {
      if (!candidate) return false

      const candidateName = String(candidate.displayName || candidate.tags?.name || '').toLowerCase()
      const hospitalName = String(hospital?.name || hospital?.displayName || '').toLowerCase()
      if (candidateName && hospitalName && candidateName === hospitalName) {
        return true
      }

      const candidateStreet = String(candidate.tags?.['addr:street'] || '').toLowerCase()
      const hospitalAddress = String(hospital?.address || hospital?.displayAddress || '').toLowerCase()
      return candidateStreet && hospitalAddress && hospitalAddress.includes(candidateStreet)
    })

    if (!matched) return null

    const matchedLat = Number.parseFloat(matched.lat)
    const matchedLon = Number.parseFloat(matched.lon)
    if (Number.isFinite(matchedLat) && Number.isFinite(matchedLon)) {
      return { lat: matchedLat, lon: matchedLon }
    }

    return null
  }

  const handleShowDirections = (hospital) => {
    const coords = resolveHospitalCoordinates(hospital)
    if (!coords) {
      alert('Directions unavailable for this hospital right now.')
      return
    }

    const destinationLabel = hospital?.name || hospital?.displayName || 'Hospital'
    const origin =
      userLocation?.lat && userLocation?.lng
        ? `${userLocation.lat},${userLocation.lng}`
        : null

    const queryParams = new URLSearchParams({
      api: '1',
      destination: `${coords.lat},${coords.lon}`,
      travelmode: 'driving',
    })

    if (origin) {
      queryParams.set('origin', origin)
    }

    const googleMapsUrl = `https://www.google.com/maps/dir/?${queryParams.toString()}`
    window.open(googleMapsUrl, '_blank', 'noopener,noreferrer')

    addHistoryItem({
      key: `google-directions-${hospital?.key || hospital?.id || Date.now()}`,
      icon: '🧭',
      title: 'Opened Google Maps directions',
      note: destinationLabel,
    })
  }

  const handleToggleFavoriteHospital = async (hospital) => {
    if (!currentUser?.id) return

    const hospitalKey = getHospitalFavoriteKey(hospital)
    const existingFavoriteId = getFavoriteIdForHospitalKey(hospitalKey)

    setFavoriteHospitalKeysPending((prev) => [...new Set([...prev, hospitalKey])])

    try {
      if (existingFavoriteId) {
        const res = await fetch(
          apiUrl(
            `/api/favorites/${encodeURIComponent(existingFavoriteId)}?userId=${encodeURIComponent(currentUser.id)}`,
          ),
          { method: 'DELETE' },
        )

        if (!res.ok && res.status !== 404) {
          throw new Error(`Favorite remove failed with status ${res.status}`)
        }

        setFavoriteHospitals((prev) => prev.filter((favorite) => favorite.id !== existingFavoriteId))
        addHistoryItem({
          key: `favorite-remove-${hospitalKey}`,
          icon: '💔',
          title: 'Removed from saved hospitals',
          note: hospital.name || 'Hospital removed from favorites',
        })
        return
      }

      const res = await fetch(apiUrl('/api/favorites'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          hospital,
        }),
      })

      if (!res.ok) {
        throw new Error(`Favorite save failed with status ${res.status}`)
      }

      const data = await res.json()
      if (data.favorite) {
        setFavoriteHospitals((prev) => {
          const filtered = prev.filter((item) => item.id !== data.favorite.id)
          return [data.favorite, ...filtered]
        })
      }

      addHistoryItem({
        key: `favorite-add-${hospitalKey}`,
        icon: '❤️',
        title: 'Saved hospital',
        note: hospital.name || 'Hospital saved to favorites',
      })
    } catch (error) {
      console.error('Favorite toggle failed:', error)
      alert('Failed to update saved hospitals. Please try again.')
    } finally {
      setFavoriteHospitalKeysPending((prev) => prev.filter((key) => key !== hospitalKey))
    }
  }

  const openFavoriteHospitalDetail = (favorite) => {
    if (!favorite?.hospital) return
    openHospitalDetail(favorite.hospital)
  }

  const handleRemoveFavoriteHospital = async (favorite) => {
    if (!currentUser?.id || !favorite?.id) return

    const hospital = favorite.hospital || {}
    const hospitalKey = favorite.hospitalKey || getHospitalFavoriteKey(hospital)

    setFavoriteHospitalKeysPending((prev) => [...new Set([...prev, hospitalKey])])

    try {
      const res = await fetch(
        apiUrl(`/api/favorites/${encodeURIComponent(favorite.id)}?userId=${encodeURIComponent(currentUser.id)}`),
        { method: 'DELETE' },
      )

      if (!res.ok && res.status !== 404) {
        throw new Error(`Favorite remove failed with status ${res.status}`)
      }

      setFavoriteHospitals((prev) => prev.filter((item) => item.id !== favorite.id))
      addHistoryItem({
        key: `favorite-remove-${hospitalKey}`,
        icon: '💔',
        title: 'Removed from saved hospitals',
        note: hospital?.name || 'Hospital removed from favorites',
      })
    } catch (error) {
      console.error('Favorite remove failed:', error)
      alert('Failed to remove saved hospital. Please try again.')
    } finally {
      setFavoriteHospitalKeysPending((prev) => prev.filter((key) => key !== hospitalKey))
    }
  }

  const handleCancelDeleteAppointment = () => {
    if (isDeleteSubmitting) return
    setPendingDeleteAppointmentId('')
  }

  const handleConfirmDeleteAppointment = async () => {
    const appointmentId = pendingDeleteAppointmentId
    if (!appointmentId) return
    setIsDeleteSubmitting(true)

    try {
      if (currentUser?.id && appointmentId) {
        const res = await fetch(
          apiUrl(
            `/api/appointments/${encodeURIComponent(appointmentId)}?userId=${encodeURIComponent(currentUser.id)}`,
          ),
          {
            method: 'DELETE',
          },
        )

        if (!res.ok && res.status !== 404) {
          throw new Error(`Appointment delete failed with status ${res.status}`)
        }
      }

      setAppointmentHistory((prev) => prev.filter((appointment) => appointment.id !== appointmentId))
      addHistoryItem({
        key: `appointment-delete-${appointmentId}`,
        icon: '🗑️',
        title: 'Appointment deleted',
        note: 'Removed from your appointment history.',
      })
      setPendingDeleteAppointmentId('')
    } catch (error) {
      console.error('Appointment delete failed:', error)
      alert('Failed to delete appointment. Please try again.')
    } finally {
      setIsDeleteSubmitting(false)
    }
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
      const res = await fetch(apiUrl('/api/chat'), {
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

  const visibleHospitals = useMemo(
    () => (Array.isArray(filteredHospitals) ? filteredHospitals.filter(Boolean) : []),
    [filteredHospitals],
  )

  const smartAssistHospitals = useMemo(() => {
    const sourceHospitals =
      visibleHospitals.length > 0
        ? visibleHospitals
        : (Array.isArray(nearbyMapHospitals) && nearbyMapHospitals.length > 0 ? nearbyMapHospitals : MOCK_HOSPITALS)

    return (Array.isArray(sourceHospitals) ? sourceHospitals : [])
      .map((hospital, index) => normalizeHospitalForSearch(hospital, index))
      .filter(Boolean)
  }, [visibleHospitals, nearbyMapHospitals])

  const triageAssessment = useMemo(
    () => buildTriageAssessment({ symptomsText: triageSymptoms, severityLevel: triageSeverity, durationDays: triageDurationDays }),
    [triageSymptoms, triageSeverity, triageDurationDays],
  )

  const emergencyHospitals = useMemo(() => {
    return smartAssistHospitals
      .map((hospital) => {
        const metaBlob = getHospitalMetaBlob(hospital)
        const emergencySignals = includesAny(metaBlob, ['emergency', '24/7', 'icu'])
        const distanceBonus = typeof hospital.distanceKm === 'number' ? Math.max(0, 15 - hospital.distanceKm) : 2
        return {
          hospital,
          priorityScore: (emergencySignals ? 70 : 35) + distanceBonus,
        }
      })
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 5)
  }, [smartAssistHospitals])

  const fitMatches = useMemo(() => {
    return smartAssistHospitals
      .map((hospital) => {
        const fit = scoreHospitalFit(hospital, fitPreferences)
        return { hospital, ...fit }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
  }, [smartAssistHospitals, fitPreferences])

  const getFileIcon = (fileType = '') => {
    const type = String(fileType).toLowerCase()
    if (type.includes('pdf')) return <FileText size={20} />
    if (type.includes('image') || type.includes('png') || type.includes('jpg') || type.includes('jpeg')) return <ImageIcon size={20} />
    if (type.includes('word') || type.includes('doc') || type.includes('text')) return <File size={20} />
    return <File size={20} />
  }

  const handleDocumentUpload = (event) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    const newPending = files.map(file => ({
      file,
      title: file.name,
      note: '',
      id: Math.random().toString(36).slice(2, 9)
    }))

    setPendingUploads(prev => [...prev, ...newPending])
    event.target.value = ''
  }

  const handleProcessUploads = async () => {
    if (!currentUser?.id || !pendingUploads.length) return

    setIsUploading(true)
    try {
      const uploadedDocs = []
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      
      for (const item of pendingUploads) {
        const { file, title, note } = item
        const fileExt = file.name.split('.').pop()
        const fileName = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabaseClient.storage
          .from('documentUpload')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabaseClient.storage
          .from('documentUpload')
          .getPublicUrl(filePath)

        const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        
        const initialHistory = [{ 
          event: 'created', 
          time: currentTime, 
          filename: file.name 
        }]

        const { data: dbData, error: dbError } = await supabaseClient
          .from('documents')
          .insert([
            {
              user_id: currentUser.id,
              file_url: publicUrl,
              file_path: filePath,
              title: title || file.name,
              note: note || '',
              history: initialHistory,
              group_id: sessionId,
              file_size: file.size,
            },
          ])
          .select()

        if (dbError) throw dbError

        if (dbData && dbData[0]) {
          const newDoc = dbData[0]
          uploadedDocs.push({
            id: newDoc.id,
            title: newDoc.title,
            note: newDoc.note,
            uploadedAt: newDoc.created_at,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type || 'application/octet-stream',
            status: 'Uploaded',
            url: newDoc.file_url,
            filePath: newDoc.file_path,
            history: newDoc.history,
            groupId: newDoc.group_id,
          })
        }
      }

      setDocuments((prev) => [...uploadedDocs, ...prev].sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)))
      setPendingUploads([])
      
      const newDateKey = new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
      setSelectedDocumentDate(newDateKey)
      showAlert('Success', 'Documents uploaded successfully!')
    } catch (error) {
      console.error('Failed to upload documents:', error)
      showAlert('Upload Error', `Unable to upload documents: ${error.message || 'Unknown error'}`)
    } finally {
      setIsUploading(false)
    }
  }

  const handleEditDocument = (doc) => {
    setEditingDocId(doc.id)
    setEditTitle(doc.title)
    setEditNote(doc.note)
  }

  const handleCancelEditDocument = () => {
    setEditingDocId(null)
    setEditTitle('')
    setEditNote('')
  }

  const handleSaveDocument = async () => {
    if (!editingDocId) return
    
    const docToUpdate = documents.find(d => d.id === editingDocId)
    if (!docToUpdate) return

    try {
      const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      const newHistory = [...(docToUpdate.history || []), { 
        event: 'updated', 
        time: currentTime, 
        filename: editTitle || docToUpdate.title 
      }]

      const { error } = await supabaseClient
        .from('documents')
        .update({
          title: editTitle,
          note: editNote,
          history: newHistory,
        })
        .eq('id', editingDocId)

      if (error) throw error

      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === editingDocId
            ? { 
                ...doc, 
                title: editTitle || doc.title, 
                note: editNote || doc.note, 
                status: 'Updated',
                history: newHistory 
              }
            : doc,
        ),
      )
      handleCancelEditDocument()
      showAlert('Success', 'Document updated successfully.')
    } catch (error) {
      console.error('Failed to update document:', error)
      showAlert('Error', 'Failed to update document.')
    }
  }

  const handleDeleteDocument = async (id) => {
    showConfirm(
      'Delete Document',
      'Are you sure you want to delete this document?',
      async () => {
        try {
          const { error } = await supabaseClient
            .from('documents')
            .delete()
            .eq('id', id)

          if (error) throw error

          setDocuments((prev) => prev.filter((doc) => doc.id !== id))
          showAlert('Deleted', 'Document deleted successfully.')
        } catch (error) {
          console.error('Failed to delete document:', error)
          showAlert('Error', 'Failed to delete document.')
        }
      }
    )
  }

  const handleDeleteBatch = async (sessionId, dateKey) => {
    showConfirm(
      'Delete Batch',
      'Are you sure you want to delete all documents in this batch?',
      async () => {
        try {
          const docsToDelete = documentsByDate[dateKey][sessionId]
          const docIds = docsToDelete.map(doc => doc.id)

          const { error } = await supabaseClient
            .from('documents')
            .delete()
            .in('id', docIds)

          if (error) throw error

          setDocuments(prev => prev.filter(doc => !docIds.includes(doc.id)))
          showAlert('Deleted', 'Batch deleted successfully.')
        } catch (error) {
          console.error('Failed to delete batch:', error)
          showAlert('Error', 'Failed to delete batch.')
        }
      }
    )
  }

  const handleDeleteAllByDate = async (dateKey) => {
    showConfirm(
      'Delete All',
      `Are you sure you want to delete ALL documents from ${dateKey}?`,
      async () => {
        try {
          const docsToDelete = documentsByDate[dateKey]
          const docIds = Object.values(docsToDelete).flat().map(doc => doc.id)

          const { error } = await supabaseClient
            .from('documents')
            .delete()
            .in('id', docIds)

          if (error) throw error

          setDocuments((prev) => prev.filter((doc) => !docIds.includes(doc.id)))
          if (selectedDocumentDate === dateKey) {
            setSelectedDocumentDate(null)
          }
          showAlert('Deleted', 'All documents deleted.')
        } catch (error) {
          console.error('Failed to delete documents by date:', error)
          showAlert('Error', 'Failed to delete documents.')
        }
      }
    )
  }

  const handleDownloadDocument = async (doc) => {
    if (!doc.url) {
      showAlert('Download Error', 'Download URL not available.')
      return
    }

    try {
      const response = await fetch(doc.url)
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = doc.fileName || doc.title || 'document'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('Download failed:', error)
      window.open(doc.url, '_blank')
    }
  }

  const handleDownloadBatch = async (sessionId, dateKey) => {
    const docsToDownload = documentsByDate[dateKey][sessionId]
    if (!docsToDownload || !docsToDownload.length) return

    showAlert('Preparing ZIP', `Gathering ${docsToDownload.length} files for download...`)
    
    try {
      const zip = new JSZip()
      const folderName = `Medical_Records_${dateKey.replace(/\s+/g, '_')}`
      const folder = zip.folder(folderName)

      for (const doc of docsToDownload) {
        if (!doc.url) continue
        try {
          const response = await fetch(doc.url)
          const blob = await response.blob()
          const fileName = doc.fileName || doc.title || `document_${doc.id}`
          folder.file(fileName, blob)
        } catch (err) {
          console.error(`Failed to add file ${doc.title} to zip:`, err)
        }
      }

      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `${folderName}.zip`)
      showAlert('Success', 'ZIP file downloaded successfully.')
    } catch (error) {
      console.error('Batch download failed:', error)
      showAlert('Download Error', 'Failed to create ZIP file. Trying individual downloads...')
      for (const doc of docsToDownload) {
        await handleDownloadDocument(doc)
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
  }

  const handleReplaceDocument = async (documentId, file) => {
    if (!file || !currentUser?.id) return
    setReUploadingDocId(documentId)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabaseClient.storage
        .from('documentUpload')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabaseClient.storage
        .from('documentUpload')
        .getPublicUrl(filePath)

      const docToReplace = documents.find(d => d.id === documentId)
      const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      const newHistory = [...(docToReplace?.history || []), { 
        event: 're-uploaded', 
        time: currentTime, 
        filename: file.name 
      }]

      const { error: dbError } = await supabaseClient
        .from('documents')
        .update({
          file_url: publicUrl,
          file_path: filePath,
          title: file.name,
          history: newHistory,
          file_size: file.size,
        })
        .eq('id', documentId)

      if (dbError) throw dbError

      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === documentId
            ? {
                ...doc,
                title: file.name,
                fileName: file.name,
                fileType: file.type || doc.fileType,
                fileSize: file.size,
                uploadedAt: new Date().toISOString(),
                status: 'Re-uploaded',
                url: publicUrl,
                filePath: filePath,
                history: newHistory,
              }
            : doc,
        ),
      )
      showAlert('Success', 'Document replaced successfully.')
    } catch (error) {
      console.error('Failed to replace document:', error)
      showAlert('Error', 'Failed to replace document.')
    } finally {
      setReUploadingDocId(null)
    }
  }

  const filteredDocuments = documents // Could add local search here if needed

  const documentsByDate = useMemo(() => {
    return filteredDocuments.reduce((groups, doc) => {
      const dateKey = new Date(doc.uploadedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
      groups[dateKey] = groups[dateKey] || {}
      
      const sessionId = doc.groupId || 'single'
      groups[dateKey][sessionId] = groups[dateKey][sessionId] || []
      groups[dateKey][sessionId].push(doc)
      return groups
    }, {})
  }, [filteredDocuments])

  const documentDates = useMemo(() => Object.keys(documentsByDate).sort((a, b) => new Date(b) - new Date(a)), [documentsByDate])

  return (
    <div className="dashboard-layout">
      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">⚕️</div>
          <div className="logo-text">HealthCare <span>Hub</span></div>
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
            className={`nav-item ${activePage === 'smart-assist' ? 'active' : ''}`}
            onClick={() => setActivePage('smart-assist')}
          >
            <span>🧠</span> Smart Assist
          </button>
          <button
            className={`nav-item ${activePage === 'find-service' ? 'active' : ''}`}
            onClick={() => setActivePage('find-service')}
          >
            <span>🧾</span> Find Service
          </button>
          <button
            className={`nav-item ${activePage === 'history' ? 'active' : ''}`}
            onClick={() => setActivePage('history')}
            title="View your appointment history and upcoming visits"
          >
            <span>📅</span> Appointment History
          </button>
          <button
            className={`nav-item ${activePage === 'documents' ? 'active' : ''}`}
            onClick={() => setActivePage('documents')}
            title="Manage your uploaded medical records and reports"
          >
            <span>📄</span> Documents
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
              <div className="date-badge">
                <span className="date-badge-icon" aria-hidden="true">📅</span>
                <span>{currentDateString}</span>
              </div>
            </div>

            {/* Hero Banner */}
            <div className="hero-banner-dark">
              <span className="hero-tag"><span style={{ color: '#ff5d5d', marginRight: '6px' }}>🔴</span>🚨 Safety First</span>
              <h2>Emergency mode is now one tap away</h2>
              <p style={{ color: '#7a8ba7', marginBottom: '24px' }}>
                Instant emergency support with nearby hospital shortlist, ambulance quick call, and fastest directions.
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  className="hero-cta"
                  style={{
                    background: 'linear-gradient(135deg, #ff4d4f, #d9363e)',
                    color: '#ffffff',
                    boxShadow: '0 12px 30px rgba(217,54,62,0.35)',
                  }}
                  onClick={() => {
                    setIsEmergencyMode(true)
                    setActivePage('emergency-mode')
                  }}
                >
                  Enable Emergency Mode
                </button>
                <button className="h-dir-btn" onClick={() => setActivePage('search')}>Start Exploring</button>
              </div>
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
          <SectionErrorBoundary>
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

            <h3 className="section-title-dark" style={{ marginBottom: '8px' }}>{visibleHospitals.length} Live Hospitals Found</h3>
            <div style={{ marginBottom: '16px', color: '#7a8ba7', fontSize: '0.9rem' }}>
              Sorted by nearest distance from your live location
            </div>
            <div className="hospital-grid-dark" style={{
              perspective: 'none',
              transform: 'none',
            }}>
              {visibleHospitals.map((hospital, idx) => {
                const tags = Array.isArray(hospital.tags) ? hospital.tags : []
                const details = Array.isArray(hospital.details) ? hospital.details : []
                const contact = hospital.contact || {}
                const distanceLabel = toDistanceLabel(hospital.distanceKm)
                const safeName = String(hospital.name || 'Hospital')
                const safeAddress = String(hospital.address || 'Address unavailable')
                const safeSource = String(hospital.source || 'Unknown')
                const safeDistanceText = String(hospital.distanceText || 'Distance not available')
                const safeRating = String(hospital.rating || 'Live')

                return (
                <div
                  key={hospital.key || hospital.id || idx}
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
                    <div className="h-rating">{safeRating}</div>
                  </div>
                  <h3>{safeName}</h3>
                  <p className="h-address">{safeAddress}</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    <span className="h-tag">{safeSource}</span>
                    {hospital.distanceText && <span className="h-tag">{safeDistanceText}</span>}
                    {distanceLabel && (
                      <span className="h-tag">{distanceLabel}</span>
                    )}
                  </div>
                  {tags.length > 0 && (
                    <div className="h-tags">
                      {tags.slice(0, 6).map((tag, tagIdx) => (
                        <span key={tagIdx} className="h-tag">{String(tag)}</span>
                      ))}
                    </div>
                  )}
                  {details.length > 0 && (
                    <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', fontSize: '0.8rem', color: '#a0b5c7' }}>
                      {details.map((detail, detailIdx) => (
                        <div key={detailIdx} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,212,170,0.15)', borderRadius: '10px', padding: '8px 10px' }}>
                          {String(detail)}
                        </div>
                      ))}
                    </div>
                  )}
                  {(contact.phone || contact.website) && (
                    <div style={{ marginTop: '12px', fontSize: '0.8rem', color: '#a0b5c7', lineHeight: 1.6 }}>
                      {contact.phone && <div>Phone: {contact.phone}</div>}
                      {contact.website && <div>Website: {contact.website}</div>}
                    </div>
                  )}
                  <div className="h-bottom">
                    <span className="h-distance">📍 {safeDistanceText}</span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button
                        className="h-dir-btn"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleShowDirections(hospital)
                        }}
                      >
                        Directions
                      </button>
                      <button
                        className="h-dir-btn"
                        onClick={(event) => {
                          event.stopPropagation()
                          openHospitalDetail(hospital)
                        }}
                      >
                        View Full Details
                      </button>
                      <button
                        className="h-dir-btn"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleToggleFavoriteHospital(hospital)
                        }}
                        disabled={favoriteHospitalKeysPending.includes(getHospitalFavoriteKey(hospital))}
                        style={{
                          borderColor: hasFavoriteForHospital(hospital)
                            ? 'rgba(255, 110, 168, 0.45)'
                            : undefined,
                          color: hasFavoriteForHospital(hospital)
                            ? '#ff8fbc'
                            : undefined,
                        }}
                      >
                        {favoriteHospitalKeysPending.includes(getHospitalFavoriteKey(hospital))
                          ? 'Saving...'
                          : hasFavoriteForHospital(hospital)
                            ? 'Unsave'
                            : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          </div>
          </SectionErrorBoundary>
        )}

        {/* FIND SERVICE PAGE */}
        {activePage === 'find-service' && (
          <div className="dash-page active-page">
            <button className="back-btn-dark" onClick={() => setActivePage('dashboard')}>← Back</button>

            <div className="search-banner-dark">
              <h2>Find Service</h2>
              <div className="location-pill">Search any service with live prices</div>
              <div style={{ marginTop: '10px', color: '#a0b5c7', fontSize: '0.9rem' }}>
                Service ka naam dalo, matching hospitals aur per-service pricing mil jayegi.
              </div>
            </div>

            <div className="hospital-card-dark" style={{ marginBottom: '20px' }}>
              <h3 style={{ color: '#e8ecf4', marginBottom: '10px' }}>Service Price Finder</h3>
              <p style={{ color: '#7a8ba7', marginBottom: '14px', fontSize: '0.9rem' }}>
                Example: MRI, ICU Bed, ECG, Cardiology Consultation
              </p>
              <input
                type="text"
                className="dark-input"
                placeholder="Type a service name..."
                value={serviceSearchQuery}
                onChange={(e) => setServiceSearchQuery(e.target.value)}
              />

              <div style={{ marginTop: '14px' }}>
                <div style={{ color: '#7a8ba7', fontSize: '0.85rem', marginBottom: '8px' }}>Suggestions:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {suggestedServices.map((service) => (
                    <button
                      key={service}
                      type="button"
                      className={`chip ${serviceSearchQuery.trim().toLowerCase() === service.toLowerCase() ? 'active' : ''}`}
                      onClick={() => setServiceSearchQuery(service)}
                    >
                      {service}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {serviceSearchQuery.trim().length > 0 && (
              <>
                <h3 className="section-title-dark" style={{ marginBottom: '10px' }}>
                  {serviceSearchResults.length} Hospitals Offering "{serviceSearchQuery}"
                </h3>

                {serviceSearchLoading ? (
                  <div className="hospital-card-dark" style={{ color: '#a0b5c7' }}>
                    Searching backend for matching hospitals...
                  </div>
                ) : serviceSearchResults.length === 0 ? (
                  <div className="hospital-card-dark" style={{ color: '#ffb4b4', borderColor: 'rgba(255,77,77,0.35)' }}>
                    Is service ke liye koi hospital match nahi hua.
                  </div>
                ) : (
                  <div className="hospital-grid-dark" style={{ perspective: 'none', transform: 'none' }}>
                    {serviceSearchResults.map((result) => (
                      <div key={result.hospital} className="hospital-card-dark">
                        <div className="h-top">
                          <div className="h-icon-box">🧾</div>
                          <div className="h-rating">⭐ {result.rating}</div>
                        </div>
                        <h3>{result.hospital}</h3>
                        <p className="h-address">{result.address}</p>

                        <div style={{ marginTop: '14px', display: 'grid', gap: '8px' }}>
                          {result.matchedServices.map((service) => (
                            <div
                              key={`${result.hospital}-${service.name}`}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '10px',
                                padding: '10px 12px',
                                background: 'rgba(7,21,31,0.45)',
                                gap: '10px',
                              }}
                            >
                              <div style={{ display: 'grid', gap: '2px' }}>
                                <span style={{ color: '#c8d5e3', fontSize: '0.9rem' }}>{service.name}</span>
                                <span style={{ color: '#7a8ba7', fontSize: '0.72rem' }}>{service.availability || 'Estimated'}</span>
                              </div>
                              <span style={{ color: '#00d4aa', fontWeight: '700', whiteSpace: 'nowrap' }}>
                                {typeof service.price === 'number' ? `₹${service.price.toLocaleString('en-IN')}` : 'Price on request'}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="h-bottom" style={{ marginTop: '16px' }}>
                          <span className="h-distance">Use actions from this card</span>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="h-dir-btn"
                              onClick={() => openServiceResultHospitalDetail(result, result.matchedServices?.[0]?.name || '', 'details')}
                            >
                              View Details
                            </button>
                            <button
                              type="button"
                              className="h-dir-btn"
                              onClick={() => openServiceResultHospitalDetail(result, result.matchedServices?.[0]?.name || '', 'book')}
                            >
                              Book Appointment
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* HOSPITAL DETAIL PAGE */}
        {activePage === 'hospital-detail' && selectedHospital && activeHospitalDetail && (
          <HospitalDetailPage
            hospital={selectedHospital}
            appointmentContext={appointmentContext}
            onBack={() => {
              setSelectedHospital(null)
              setAppointmentContext(null)
              setActivePage(hospitalDetailBackPage || 'search')
            }}
            onBookAppointment={handleBookAppointment}
            onViewHistory={() => {
              setSelectedHospital(null)
              setAppointmentContext(null)
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
                  <div style={{ color: '#9de9d8', fontSize: '0.82rem', lineHeight: 1.6 }}>
                    Unique ID: {profileMemberId || getFallbackMemberId(currentUser?.id)}
                  </div>
                  <div style={{ color: '#9de9d8', fontSize: '0.82rem', lineHeight: 1.6 }}>
                    Password: {profileDraft.password ? 'Saved in profile' : 'Not set yet'}
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

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#e8ecf4' }}>
                    <span style={{ fontSize: '0.85rem', color: '#7a8ba7' }}>Password</span>
                    <input
                      type="text"
                      className="dark-input"
                      value={profileDraft.password}
                      onChange={(e) => handleProfileFieldChange('password', e.target.value)}
                      placeholder="Generate or edit your login password"
                      disabled={!isProfileEditing}
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

            <div style={{ marginTop: '24px' }}>
              <h3 style={{ color: '#e8ecf4', marginBottom: '10px' }}>Saved Hospitals</h3>
              <p style={{ color: '#7a8ba7', marginBottom: '18px' }}>
                Hospital Search page se save kiye hue hospitals yahan quick access ke liye milenge.
              </p>

              <div className="hospital-grid-dark" style={{ perspective: 'none', transform: 'none' }}>
                {safeFavoriteHospitals.length === 0 ? (
                  <div className="hospital-card-dark" style={{ gridColumn: '1 / -1' }}>
                    <div className="h-top">
                      <div className="h-icon-box">❤️</div>
                      <div className="h-rating">Empty</div>
                    </div>
                    <h3>No saved hospitals yet</h3>
                    <p className="h-address">Hospital Search page se Save button dabao to hospitals yahan appear honge.</p>
                  </div>
                ) : (
                  safeFavoriteHospitals.map((favorite) => {
                    const hospital = favorite.hospital || {}
                    const hospitalKey = favorite.hospitalKey || getHospitalFavoriteKey(hospital)
                    return (
                      <div
                        key={favorite.id}
                        className="hospital-card-dark hospital-card-clickable"
                        onClick={() => openFavoriteHospitalDetail(favorite)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            openFavoriteHospitalDetail(favorite)
                          }
                        }}
                      >
                        <div className="h-top">
                          <div className="h-icon-box">🏥</div>
                          <div className="h-rating">{hospital.rating || 'Saved'}</div>
                        </div>
                        <h3>{hospital.name || 'Hospital'}</h3>
                        <p className="h-address">{hospital.address || 'Address not available'}</p>
                        <div className="h-tags">
                          {hospital.source && <span className="h-tag">{hospital.source}</span>}
                          {hospital.distanceText && <span className="h-tag">{hospital.distanceText}</span>}
                          <span className="h-tag">Saved</span>
                        </div>
                        <div className="h-bottom">
                          <span className="h-distance">📍 Quick access</span>
                          <button
                            className="h-dir-btn"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleRemoveFavoriteHospital(favorite)
                            }}
                            disabled={favoriteHospitalKeysPending.includes(hospitalKey)}
                          >
                            {favoriteHospitalKeysPending.includes(hospitalKey) ? 'Removing...' : 'Remove'}
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
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
                      <button className="h-dir-btn" onClick={() => handleDeleteAppointment(item.id)}>
                        Delete Appointment
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* DOCUMENTS PAGE */}
        {activePage === 'documents' && (
          <div className="dash-page active-page">
            <button className="back-btn-dark" onClick={() => setActivePage('dashboard')}>← Back</button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '18px', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ color: '#e8ecf4', marginBottom: '10px' }}>Document Vault</h2>
                <p style={{ color: '#7a8ba7', marginBottom: '18px', maxWidth: '620px' }}>
                  Upload, organize, and search your healthcare documents from appointment summaries, prescriptions, and reports.
                </p>
              </div>
            </div>
            
            <div className="doc-vault-container" style={{ background: 'transparent' }}>
              <div className="doc-header">
                {pendingUploads.length > 0 && (
                  <div className="hospital-card-dark" style={{ padding: '24px', marginBottom: '24px', width: '100%', textAlign: 'left' }}>
                    <h3 style={{ color: '#e8ecf4', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Plus size={20} />
                      Pending Uploads ({pendingUploads.length})
                    </h3>
                    <div style={{ display: 'grid', gap: '16px' }}>
                      {pendingUploads.map((item, index) => (
                        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr auto', gap: '16px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <div className="doc-type-icon" style={{ color: '#00e5ff' }}>
                            {getFileIcon(item.file.type || item.file.name)}
                          </div>
                          <input
                            type="text"
                            className="dark-input"
                            value={item.title}
                            onChange={(e) => {
                              const newPending = [...pendingUploads]
                              newPending[index].title = e.target.value
                              setPendingUploads(newPending)
                            }}
                            placeholder="File Title"
                            title="Enter document title"
                          />
                          <input
                            type="text"
                            className="dark-input"
                            value={item.note}
                            onChange={(e) => {
                              const newPending = [...pendingUploads]
                              newPending[index].note = e.target.value
                              setPendingUploads(newPending)
                            }}
                            placeholder="Add a description..."
                            title="Enter document description"
                          />
                          <button 
                            className="action-icon-btn delete-btn"
                            style={{ color: '#ff6b6b' }}
                            onClick={() => setPendingUploads(prev => prev.filter(p => p.id !== item.id))}
                            title="Remove this file from pending list"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                      <button className="btn btn-outline" style={{ borderColor: 'rgba(255,255,255,0.2)', color: '#7a8ba7' }} onClick={() => setPendingUploads([])} disabled={isUploading} title="Cancel all pending uploads">Cancel</button>
                      <button className="btn btn-primary" style={{ background: '#00e5ff', color: '#03070f' }} onClick={handleProcessUploads} disabled={isUploading} title="Upload all files">
                        {isUploading ? 'Uploading...' : 'Start Uploading All'}
                      </button>
                    </div>
                  </div>
                )}

                <label className="upload-btn-new" style={{ background: 'rgba(0, 229, 255, 0.1)', border: '1px solid rgba(0, 229, 255, 0.2)', color: '#00e5ff', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', width: 'fit-content' }} title="Select files from your device to upload">
                  <Plus size={20} />
                  {isUploading ? 'Uploading...' : 'Upload New File'}
                  <input
                    type="file"
                    accept="application/pdf,image/*,.doc,.docx,text/*"
                    multiple
                    onChange={handleDocumentUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              <div className="doc-layout" style={{ marginTop: '30px', display: 'flex', gap: '24px' }}>
                <aside className="doc-sidebar-dark" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '16px', minWidth: '220px' }}>
                  {documentDates.length === 0 ? (
                    <p style={{ color: '#7a8ba7', fontSize: '0.9rem', padding: '0 12px' }}>No documents yet.</p>
                  ) : (
                    documentDates.map((dateKey) => (
                      <button
                        key={dateKey}
                        className={`date-item ${selectedDocumentDate === dateKey ? 'active' : ''}`}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '10px', 
                          width: '100%', 
                          padding: '12px', 
                          borderRadius: '10px', 
                          background: selectedDocumentDate === dateKey ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
                          color: selectedDocumentDate === dateKey ? '#00e5ff' : '#7a8ba7',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          marginBottom: '4px',
                          transition: '0.2s'
                        }}
                        onClick={() => setSelectedDocumentDate(dateKey)}
                      >
                        <Calendar size={18} />
                        {dateKey}
                      </button>
                    ))
                  )}
                </aside>

                <main className="doc-main-dark" style={{ flex: 1 }}>
                  {(!selectedDocumentDate || !documentsByDate[selectedDocumentDate]) ? (
                    <div className="hospital-card-dark" style={{ textAlign: 'center', padding: '60px 20px' }}>
                      <FileText size={48} strokeWidth={1} style={{ marginBottom: '16px', opacity: 0.3, color: '#00e5ff' }} />
                      <p style={{ color: '#7a8ba7' }}>Select a date to view documents or upload a new file.</p>
                    </div>
                  ) : (
                    <>
                      <div className="doc-date-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#e8ecf4', fontSize: '1.2rem', fontWeight: '600' }} title={`Documents for ${selectedDocumentDate}`}>
                          <Calendar size={22} style={{ color: '#00e5ff' }} />
                          {selectedDocumentDate}
                        </div>
                        <button 
                          className="btn btn-outline" 
                          style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '6px 12px', fontSize: '0.85rem' }}
                          onClick={() => handleDeleteAllByDate(selectedDocumentDate)}
                          title={`Permanently delete all documents from ${selectedDocumentDate}`}
                        >
                          <Trash2 size={16} />
                          Delete All
                        </button>
                      </div>

                      <div className="doc-list" style={{ display: 'grid', gap: '20px' }}>
                        {Object.entries(documentsByDate[selectedDocumentDate]).map(([sessionId, sessionDocs]) => (
                          <div key={sessionId} className={sessionDocs.length > 1 ? "doc-session-group" : "doc-single-item"} style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            {sessionDocs.length > 1 && (
                              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px', gap: '8px' }}>
                                <button 
                                  className="btn btn-outline" 
                                  style={{ borderColor: 'rgba(0, 229, 255, 0.3)', color: '#00e5ff', padding: '4px 10px', fontSize: '0.75rem', borderRadius: '8px' }}
                                  onClick={() => handleDownloadBatch(sessionId, selectedDocumentDate)}
                                  title="Download all files in this batch as ZIP"
                                >
                                  <Download size={14} />
                                  Download All
                                </button>
                                <button 
                                  className="btn btn-outline" 
                                  style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '4px 10px', fontSize: '0.75rem', borderRadius: '8px' }}
                                  onClick={() => handleDeleteBatch(sessionId, selectedDocumentDate)}
                                  title="Permanently delete all files in this batch"
                                >
                                  <Trash2 size={14} />
                                  Delete All Files
                                </button>
                              </div>
                            )}
                            <div style={{ display: 'grid', gap: '12px' }}>
                              {sessionDocs.map((doc) => (
                                <div key={doc.id} className="hospital-card-dark" style={{ padding: '16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div 
                                      className="doc-item-info" 
                                      style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} 
                                      onClick={() => window.open(doc.url, '_blank')}
                                      title="View document in new window"
                                    >
                                      <div className="doc-type-icon" style={{ color: '#00e5ff', background: 'rgba(0, 229, 255, 0.1)', padding: '10px', borderRadius: '10px' }}>
                                        {getFileIcon(doc.fileType || doc.fileName)}
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ color: '#e8ecf4', fontWeight: '500' }}>{doc.title || doc.fileName}</span>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                          {doc.fileSize > 0 && <span style={{ color: '#5a6b87', fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{(doc.fileSize / 1024).toFixed(1)} KB</span>}
                                          {doc.note && <span style={{ color: '#7a8ba7', fontSize: '0.85rem' }}>{doc.note}</span>}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="doc-item-actions" style={{ display: 'flex', gap: '8px' }}>
                                      <button className="action-icon-btn edit-btn" style={{ color: '#7a8ba7' }} title="Edit document title and description" onClick={() => handleEditDocument(doc)}><Edit2 size={18} /></button>
                                      <button className="action-icon-btn download-btn" style={{ color: '#00e5ff' }} title="Download document to your device" onClick={() => handleDownloadDocument(doc)}><Download size={18} /></button>
                                      <button className="action-icon-btn delete-btn" style={{ color: '#ef4444' }} title="Permanently delete this document" onClick={() => handleDeleteDocument(doc.id)}><Trash2 size={18} /></button>
                                    </div>
                                  </div>

                                  {editingDocId === doc.id && (
                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', marginTop: '16px', display: 'grid', gap: '12px' }}>
                                      <input type="text" className="dark-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Document title" title="Edit title" />
                                      <textarea className="dark-input" rows={2} value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Add a note..." title="Edit description" />
                                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                        <label className="btn btn-outline" style={{ borderColor: 'rgba(255,255,255,0.2)', color: '#7a8ba7', padding: '8px 16px', fontSize: '0.85rem', cursor: 'pointer' }} title="Replace this file with a new one">
                                          Re-upload
                                          <input type="file" accept="application/pdf,image/*,.doc,.docx,text/*" style={{ display: 'none' }} onChange={(e) => handleReplaceDocument(doc.id, e.target.files?.[0])} />
                                        </label>
                                        <button className="btn btn-outline" style={{ borderColor: 'rgba(255,255,255,0.2)', color: '#7a8ba7', padding: '8px 16px', fontSize: '0.85rem' }} onClick={handleCancelEditDocument} title="Discard changes">Cancel</button>
                                        <button className="btn btn-primary" style={{ background: '#00e5ff', color: '#03070f', padding: '8px 16px', fontSize: '0.85rem' }} onClick={handleSaveDocument} title="Save all changes">Save Changes</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="history-section-dark" style={{ marginTop: '40px', padding: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#e8ecf4', marginBottom: '20px', fontSize: '1.1rem', fontWeight: '600' }} title="Timeline of all actions performed on these documents">
                          <FileText size={20} style={{ color: '#00e5ff' }} />
                          Activity History
                        </div>
                        <div className="history-list" style={{ display: 'grid', gap: '12px' }}>
                          {Object.values(documentsByDate[selectedDocumentDate]).flat().flatMap(doc => 
                            (doc.history || []).map((h, idx) => ({ ...h, docId: doc.id, idx }))
                          ).sort((a, b) => b.time.localeCompare(a.time)).map((h) => (
                            <div key={`history-${h.docId}-${h.idx}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#7a8ba7', fontSize: '0.9rem' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00e5ff' }}></div>
                              <span style={{ color: '#e8ecf4' }}>{h.filename}</span>
                              <span>{h.event} at {h.time}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </main>
              </div>
            </div>
          </div>
        )}

        {/* SMART ASSIST PAGE */}
        {activePage === 'smart-assist' && (
          <div className="dash-page active-page">
            <button className="back-btn-dark" onClick={() => setActivePage('dashboard')}>← Back</button>
            <h2 style={{ color: '#e8ecf4', marginBottom: '10px' }}>Smart Assist</h2>
            <p style={{ color: '#7a8ba7', marginBottom: '24px' }}>
              AI-powered triage guidance, emergency-first shortlist, and best-fit hospital matcher for faster decisions.
            </p>

            <div style={{ marginBottom: '18px' }}>
              <div className="hospital-card-dark">
                <div className="h-top">
                  <div className="h-icon-box">🩺</div>
                  <div className="h-rating">Triage</div>
                </div>
                <h3 style={{ marginBottom: '8px' }}>Symptom Triage Score</h3>
                <textarea
                  className="dark-input"
                  rows={4}
                  placeholder="Example: chest pain with dizziness for 2 days"
                  value={triageSymptoms}
                  onChange={(event) => setTriageSymptoms(event.target.value)}
                  style={{ width: '100%', resize: 'vertical', marginBottom: '12px' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <label style={{ color: '#a0b5c7', fontSize: '0.85rem' }}>
                    Severity (1-10)
                    <input
                      className="dark-input"
                      type="number"
                      min={1}
                      max={10}
                      value={triageSeverity}
                      onChange={(event) => setTriageSeverity(Math.max(1, Math.min(10, Number(event.target.value) || 1)))}
                    />
                  </label>
                  <label style={{ color: '#a0b5c7', fontSize: '0.85rem' }}>
                    Duration (days)
                    <input
                      className="dark-input"
                      type="number"
                      min={0}
                      max={30}
                      value={triageDurationDays}
                      onChange={(event) => setTriageDurationDays(Math.max(0, Math.min(30, Number(event.target.value) || 0)))}
                    />
                  </label>
                </div>
                <div style={{ border: `1px solid ${triageAssessment.color}66`, background: `${triageAssessment.color}14`, borderRadius: '12px', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ color: triageAssessment.color }}>Urgency: {triageAssessment.urgency}</strong>
                    <span style={{ color: '#e8ecf4' }}>Score: {triageAssessment.score}/100</span>
                  </div>
                  <p style={{ color: '#d2dbea', marginBottom: '8px' }}>{triageAssessment.recommendation}</p>
                  <ul style={{ margin: 0, paddingLeft: '18px', color: '#9ab0c7' }}>
                    {triageAssessment.reasons.slice(0, 3).map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              </div>

            </div>

            <div className="hospital-card-dark" style={{ marginBottom: '18px' }}>
              <div className="h-top">
                <div className="h-icon-box">⚙️</div>
                <div className="h-rating">Fit Match</div>
              </div>
              <h3 style={{ marginBottom: '10px' }}>Personalized Hospital Match</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <label style={{ color: '#a0b5c7', fontSize: '0.85rem' }}>
                  Service
                  <input
                    className="dark-input"
                    value={fitPreferences.serviceName}
                    onChange={(event) => updateFitPreference('serviceName', event.target.value)}
                    placeholder="Consultation"
                  />
                </label>
                <label style={{ color: '#a0b5c7', fontSize: '0.85rem' }}>
                  Max Budget (INR)
                  <input
                    className="dark-input"
                    type="number"
                    min={300}
                    max={50000}
                    value={fitPreferences.maxBudget}
                    onChange={(event) => updateFitPreference('maxBudget', Math.max(300, Number(event.target.value) || 300))}
                  />
                </label>
                <label style={{ color: '#a0b5c7', fontSize: '0.85rem' }}>
                  Hospital Type
                  <select
                    className="dark-input"
                    value={fitPreferences.hospitalType}
                    onChange={(event) => updateFitPreference('hospitalType', event.target.value)}
                  >
                    <option value="any">Any</option>
                    <option value="speciality">Speciality</option>
                    <option value="emergency">Emergency</option>
                    <option value="cardiology">Cardiology</option>
                    <option value="neurology">Neurology</option>
                  </select>
                </label>
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                <label style={{ color: '#9ab0c7', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={fitPreferences.needsEmergency}
                    onChange={(event) => updateFitPreference('needsEmergency', event.target.checked)}
                  />
                  Need emergency support
                </label>
                <label style={{ color: '#9ab0c7', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={fitPreferences.needsWheelchair}
                    onChange={(event) => updateFitPreference('needsWheelchair', event.target.checked)}
                  />
                  Need wheelchair access
                </label>
              </div>
            </div>

            <div className="hospital-grid-dark" style={{ perspective: 'none', transform: 'none' }}>
              {fitMatches.map((entry, idx) => {
                const hospital = entry.hospital
                const matchScore = typeof entry.score === 'number' ? entry.score : Math.round(entry.priorityScore || 0)
                const reasons = Array.isArray(entry.reasons) ? entry.reasons : ['Prioritized for emergency readiness and distance.']
                const costLabel = entry.estimatedCost ? `INR ${entry.estimatedCost}` : 'N/A'

                return (
                  <div key={`${hospital.key}-${idx}`} className="hospital-card-dark">
                    <div className="h-top">
                      <div className="h-icon-box">🏥</div>
                      <div className="h-rating">Match {matchScore}%</div>
                    </div>
                    <h3>{hospital.name}</h3>
                    <p className="h-address">{hospital.address}</p>
                    <div className="h-tags">
                      <span className="h-tag">{hospital.distanceText || 'Distance pending'}</span>
                      <span className="h-tag">Rating {hospital.rating || 'N/A'}</span>
                      <span className="h-tag">Est. {costLabel}</span>
                    </div>
                    <div style={{ color: '#8fa3bb', fontSize: '0.86rem', marginTop: '8px', marginBottom: '12px' }}>
                      {reasons.slice(0, 2).join(' ')}
                    </div>
                    <div className="h-bottom">
                      <span className="h-distance">🎯 Fit shortlist</span>
                      <button className="h-dir-btn" onClick={() => handleShowDirections(hospital)}>Directions</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* EMERGENCY MODE PAGE */}
        {activePage === 'emergency-mode' && (
          <div className="dash-page active-page">
            <button
              className="back-btn-dark"
              onClick={() => {
                setIsEmergencyMode(false)
                setActivePage('dashboard')
              }}
            >
              ← Exit Emergency Mode
            </button>
            <h2 style={{ color: '#ffb3b3', marginBottom: '10px' }}>Emergency Mode</h2>
            <p style={{ color: '#9fb1c6', marginBottom: '24px' }}>
              Nearby priority hospitals sorted for emergency response. Call and route actions are ready.
            </p>

            <div className="hospital-card-dark" style={{ marginBottom: '18px', borderColor: 'rgba(255,107,107,0.45)' }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  className="h-dir-btn"
                  style={{ background: 'rgba(255,107,107,0.85)' }}
                  onClick={() => window.open('tel:108', '_self')}
                >
                  Call Ambulance (108)
                </button>
                {emergencyHospitals[0]?.hospital && (
                  <button className="h-dir-btn" onClick={() => handleShowDirections(emergencyHospitals[0].hospital)}>
                    Route To Nearest Priority Hospital
                  </button>
                )}
              </div>
            </div>

            <div className="hospital-grid-dark" style={{ perspective: 'none', transform: 'none' }}>
              {emergencyHospitals.length === 0 ? (
                <div className="hospital-card-dark" style={{ gridColumn: '1 / -1' }}>
                  <div className="h-top">
                    <div className="h-icon-box">🚨</div>
                    <div className="h-rating">No Data</div>
                  </div>
                  <h3>Nearby emergency hospitals unavailable</h3>
                  <p className="h-address">Please enable location to get nearby emergency hospitals.</p>
                </div>
              ) : (
                emergencyHospitals.map((entry, idx) => {
                  const hospital = entry.hospital
                  const emergencyScore = Math.round(entry.priorityScore || 0)
                  return (
                    <div key={`${hospital.key || hospital.name}-${idx}`} className="hospital-card-dark">
                      <div className="h-top">
                        <div className="h-icon-box">🏥</div>
                        <div className="h-rating">Priority {emergencyScore}</div>
                      </div>
                      <h3>{hospital.name}</h3>
                      <p className="h-address">{hospital.address}</p>
                      <div className="h-tags">
                        <span className="h-tag">{hospital.distanceText || 'Distance pending'}</span>
                        <span className="h-tag">Rating {hospital.rating || 'N/A'}</span>
                        <span className="h-tag">Emergency Ready</span>
                      </div>
                      <div className="h-bottom">
                        <span className="h-distance">🚨 Emergency shortlist</span>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button className="h-dir-btn" onClick={() => openHospitalDetail(hospital, 'emergency-mode')}>
                            View Details
                          </button>
                          <button className="h-dir-btn" onClick={() => handleShowDirections(hospital)}>
                            Directions
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
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

        {pendingDeleteAppointmentId && (
          <div className="delete-confirm-overlay" onClick={handleCancelDeleteAppointment}>
            <div className="delete-confirm-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title">
              <div className="delete-confirm-tab">Confirm Delete</div>
              <h3 id="delete-confirm-title">Delete this appointment?</h3>
              <p>
                This will remove the appointment from your history and cannot be undone.
              </p>
              <div className="delete-confirm-actions">
                <button type="button" className="delete-cancel-btn" onClick={handleCancelDeleteAppointment} disabled={isDeleteSubmitting}>
                  Cancel
                </button>
                <button type="button" className="delete-confirm-btn" onClick={handleConfirmDeleteAppointment} disabled={isDeleteSubmitting}>
                  {isDeleteSubmitting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOM CURVED MODAL (ALERTS & CONFIRMS) */}
        {modalState.isOpen && (
          <div className="custom-modal-overlay">
            <div className="custom-modal-card">
              <div className="modal-icon-box">
                {modalState.type === 'confirm' ? <Trash2 size={24} /> : <FileText size={24} />}
              </div>
              <h3 className="modal-title">{modalState.title}</h3>
              <p className="modal-message">{modalState.message}</p>
              
              <div className="modal-actions">
                {modalState.type === 'confirm' && (
                  <button className="btn btn-outline modal-btn" onClick={closeModal}>
                    Cancel
                  </button>
                )}
                <button 
                  className="btn btn-primary modal-btn" 
                  style={{ background: modalState.type === 'confirm' ? '#ef4444' : '#71a850' }}
                  onClick={handleModalConfirm}
                >
                  {modalState.type === 'confirm' ? 'Delete' : 'OK'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
