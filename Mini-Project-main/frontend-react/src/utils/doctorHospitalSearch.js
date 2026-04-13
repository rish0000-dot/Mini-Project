import { apiUrl } from './api'

export const DOCTOR_NEARBY_HOSPITAL_CACHE_KEY = 'doctorNearbyHospitals:v1'
export const HOSPITAL_MIN_DISTANCE_KM = 0.2
export const HOSPITAL_MAX_DISTANCE_KM = 50

const readStorage = (key) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const writeStorage = (key, value) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    window.localStorage.setItem(key, value)
  } catch {
    // Ignore storage issues and keep the live flow working.
  }
}

export const readNearbyHospitalCache = () => {
  const raw = readStorage(DOCTOR_NEARBY_HOSPITAL_CACHE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const writeNearbyHospitalCache = (hospitals) => {
  if (!Array.isArray(hospitals)) return
  writeStorage(DOCTOR_NEARBY_HOSPITAL_CACHE_KEY, JSON.stringify(hospitals))
}

const getSearchTokens = (hospital) => {
  const tags = hospital?.tags || hospital?.raw?.tags || {}
  return [
    hospital?.displayName,
    hospital?.displayAddress,
    hospital?.name,
    hospital?.address,
    tags.name,
    tags.operator,
    tags.amenity,
    tags.healthcare,
    tags['healthcare:speciality'],
    tags.phone,
    tags.website,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
}

const getDistanceText = (distanceKm) => {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) return 'Nearby'
  return `${distanceKm.toFixed(2)} km away`
}

export const normalizeNearbyHospital = (hospital, index = 0) => {
  if (!hospital || typeof hospital !== 'object') {
    return null
  }

  const tags = hospital?.tags || hospital?.raw?.tags || {}
  const parsedDistance = Number.parseFloat(hospital?.distanceKm ?? hospital?.distance)
  const distanceKm = Number.isFinite(parsedDistance) ? parsedDistance : null
  const lat = Number.isFinite(Number(hospital?.lat)) ? Number(hospital.lat) : Number.isFinite(Number(hospital?.location?.lat)) ? Number(hospital.location.lat) : null
  const lon = Number.isFinite(Number(hospital?.lon)) ? Number(hospital.lon) : Number.isFinite(Number(hospital?.lng)) ? Number(hospital.lng) : Number.isFinite(Number(hospital?.location?.lon)) ? Number(hospital.location.lon) : Number.isFinite(Number(hospital?.location?.lng)) ? Number(hospital.location.lng) : null

  return {
    key: `live-${hospital.id || hospital.key || index}`,
    name: hospital.displayName || hospital.name || tags.name || 'Hospital',
    address: hospital.displayAddress || hospital.address || tags['addr:full'] || 'Nearby',
    distanceKm,
    distanceText: getDistanceText(distanceKm),
    rating: hospital.rating || hospital.liveRating || 'N/A',
    source: 'OpenStreetMap',
    tags: [],
    details: [],
    contact: {
      phone: tags.phone || '',
      website: tags.website || '',
    },
    lat,
    lon,
    raw: hospital,
    searchTokens: getSearchTokens(hospital),
  }
}

export const normalizeNearbyHospitals = (hospitals) =>
  (Array.isArray(hospitals) ? hospitals : [])
    .map((hospital, index) => normalizeNearbyHospital(hospital, index))
    .filter(Boolean)

export const sortHospitalsByDistance = (hospitals) =>
  [...(Array.isArray(hospitals) ? hospitals : [])].sort((a, b) => {
    if (typeof a.distanceKm === 'number' && typeof b.distanceKm === 'number') return a.distanceKm - b.distanceKm
    if (typeof a.distanceKm === 'number') return -1
    if (typeof b.distanceKm === 'number') return 1
    return 0
  })

export const filterNearbyHospitals = (hospitals, query) => {
  const normalizedQuery = String(query || '').trim().toLowerCase()
  const list = Array.isArray(hospitals) ? hospitals.filter(Boolean) : []

  if (!normalizedQuery) return list

  return list.filter((hospital) =>
    String(hospital.name || '').toLowerCase().includes(normalizedQuery) ||
    String(hospital.address || '').toLowerCase().includes(normalizedQuery) ||
    (Array.isArray(hospital.searchTokens) && hospital.searchTokens.some((token) => token.includes(normalizedQuery)))
  )
}

export const fetchNearbyHospitalsByLocation = async (lat, lng) => {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) })
  const res = await fetch(apiUrl(`/api/hospitals/nearby?${params.toString()}`))

  if (!res.ok) {
    throw new Error(`Hospital request failed with status ${res.status}`)
  }

  const data = await res.json()
  const hospitals = normalizeNearbyHospitals(data.hospitals)
  return hospitals
}