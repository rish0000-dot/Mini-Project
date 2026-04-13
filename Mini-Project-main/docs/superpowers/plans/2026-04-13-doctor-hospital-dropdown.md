# Doctor Hospital Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the doctor profile modal hospital text field with a searchable dropdown backed by the live nearby hospital list (200m-50km), so doctors must select a valid hospital before profile completion.

**Architecture:** Extract the nearby-hospital normalization and filtering into a shared frontend utility. DoctorPanel will fetch the live nearby hospital list from the existing backend endpoint, cache it locally, and render a searchable combobox with name, distance, and address. Dashboard will also write its fetched list to the same cache so the doctor flow can reuse it when available.

**Tech Stack:** React, Supabase auth metadata, Vite frontend, existing backend nearby-hospital API, browser geolocation, localStorage.

---

### Task 1: Add shared hospital search utility

**Files:**
- Create: `frontend-react/src/utils/doctorHospitalSearch.js`

- [ ] **Step 1: Write the utility functions**

```javascript
export const DOCTOR_NEARBY_HOSPITAL_CACHE_KEY = 'doctorNearbyHospitals:v1'
export const HOSPITAL_MIN_DISTANCE_KM = 0.2
export const HOSPITAL_MAX_DISTANCE_KM = 50

export const normalizeNearbyHospital = (hospital, index) => {
  const tags = hospital?.tags || {}
  const distanceKm = Number.isFinite(Number(hospital?.distanceKm)) ? Number(hospital.distanceKm) : null
  const searchTokens = [
    hospital?.displayName,
    hospital?.displayAddress,
    tags.name,
    tags.operator,
    tags.amenity,
    tags.healthcare,
    tags['healthcare:speciality'],
    tags.phone,
    tags.website,
  ].filter(Boolean).map((value) => String(value).toLowerCase())

  return {
    key: `live-${hospital?.id || index}`,
    name: hospital?.displayName || tags.name || 'Hospital',
    address: hospital?.displayAddress || 'Nearby',
    distanceKm,
    distanceText: distanceKm !== null ? `${distanceKm.toFixed(2)} km away` : 'Nearby',
    rating: hospital?.rating || 'N/A',
    source: 'OpenStreetMap',
    tags: [],
    details: [],
    contact: { phone: tags.phone || '', website: tags.website || '' },
    lat: typeof hospital?.lat === 'number' ? hospital.lat : null,
    lon: typeof hospital?.lon === 'number' ? hospital.lon : null,
    raw: hospital,
    searchTokens,
  }
}

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

export const sortHospitalsByDistance = (hospitals) =>
  [...(Array.isArray(hospitals) ? hospitals : [])].sort((a, b) => {
    if (typeof a.distanceKm === 'number' && typeof b.distanceKm === 'number') return a.distanceKm - b.distanceKm
    if (typeof a.distanceKm === 'number') return -1
    if (typeof b.distanceKm === 'number') return 1
    return 0
  })
```

- [ ] **Step 2: Verify the file is importable**

Run: `npm run build`
Expected: build still succeeds once imports are wired up.

### Task 2: Persist Dashboard nearby hospitals

**Files:**
- Modify: `frontend-react/src/components/Dashboard.jsx`

- [ ] **Step 1: Save the live hospital list to localStorage after fetch**

```javascript
import { DOCTOR_NEARBY_HOSPITAL_CACHE_KEY } from '../utils/doctorHospitalSearch'

const fetchNearbyMapHospitals = async (lat, lng) => {
  try {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) })
    const res = await fetch(apiUrl(`/api/hospitals/nearby?${params.toString()}`))
    if (!res.ok) throw new Error(`Hospital request failed with status ${res.status}`)

    const data = await res.json()
    const normalizedHospitals = Array.isArray(data.hospitals) ? data.hospitals : []

    setNearbyMapHospitals(normalizedHospitals)
    window.localStorage.setItem(DOCTOR_NEARBY_HOSPITAL_CACHE_KEY, JSON.stringify(normalizedHospitals))
  } catch (error) {
    console.error('Failed to fetch hospitals from backend:', error)
    setNearbyMapHospitals([])
  }
}
```

- [ ] **Step 2: Verify Dashboard still builds**

Run: `npm run build`
Expected: dashboard compiles with the cache write in place.

### Task 3: Replace doctor hospital input with searchable dropdown

**Files:**
- Modify: `frontend-react/src/components/DoctorPanel.jsx`
- Create if needed: `frontend-react/src/utils/doctorHospitalSearch.js`

- [ ] **Step 1: Add live nearby hospital state and fetch logic**

```javascript
const [hospitalOptions, setHospitalOptions] = useState([])
const [hospitalQuery, setHospitalQuery] = useState('')
const [selectedHospital, setSelectedHospital] = useState(null)
const [isHospitalDropdownOpen, setIsHospitalDropdownOpen] = useState(false)
const [hospitalLookupLoading, setHospitalLookupLoading] = useState(false)
const [hospitalLookupError, setHospitalLookupError] = useState('')
```

```javascript
useEffect(() => {
  if (!showProfileModal) return

  const loadNearbyHospitals = async () => {
    setHospitalLookupLoading(true)
    setHospitalLookupError('')

    try {
      const cached = window.localStorage.getItem(DOCTOR_NEARBY_HOSPITAL_CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHospitalOptions(parsed)
          return
        }
      }

      const position = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) reject(new Error('Geolocation is not supported in this browser.'))
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 })
      })

      const { data } = await fetchNearbyHospitalsByLocation(position.coords.latitude, position.coords.longitude)
      setHospitalOptions(data)
      window.localStorage.setItem(DOCTOR_NEARBY_HOSPITAL_CACHE_KEY, JSON.stringify(data))
    } catch (error) {
      setHospitalLookupError(error?.message || 'Unable to load nearby hospitals.')
    } finally {
      setHospitalLookupLoading(false)
    }
  }

  loadNearbyHospitals()
}, [showProfileModal])
```

- [ ] **Step 2: Swap the hospital text input for a combobox dropdown**

```jsx
<div className="dp-field dp-hospital-field">
  <label>Hospital Name</label>
  <div className="dp-combobox">
    <input
      name="hospital_name"
      value={hospitalQuery}
      onChange={(event) => {
        setHospitalQuery(event.target.value)
        setSelectedHospital(null)
      }}
      onFocus={() => setIsHospitalDropdownOpen(true)}
      placeholder="Search hospital name"
      required
    />
    {isHospitalDropdownOpen && filteredHospitalOptions.length > 0 && (
      <div className="dp-combobox-menu">
        {filteredHospitalOptions.map((hospital) => (
          <button
            key={hospital.key}
            type="button"
            onClick={() => {
              setSelectedHospital(hospital)
              setHospitalQuery(hospital.name)
              setFormState((prev) => ({ ...prev, hospital_name: hospital.name }))
              setIsHospitalDropdownOpen(false)
            }}
          >
            <strong>{hospital.name}</strong>
            <span>{hospital.address}</span>
            <small>{hospital.distanceText}</small>
          </button>
        ))}
      </div>
    )}
  </div>
</div>
```

- [ ] **Step 3: Block submit until a hospital from the dropdown is selected**

```javascript
const handleProfileSubmit = async (event) => {
  event.preventDefault()
  if (!selectedHospital && !hospitalOptions.some((hospital) => hospital.name.toLowerCase() === hospitalQuery.trim().toLowerCase())) {
    setProfileError('Please select a hospital from the dropdown.')
    return
  }
  // keep the existing profile save payload, but use the selected hospital name
}
```

- [ ] **Step 4: Verify the UI compiles and the dropdown filters live hospitals**

Run: `npm run build`
Expected: build succeeds and the doctor modal shows searchable hospital suggestions with distance labels.

### Task 4: Final validation

**Files:**
- None

- [ ] **Step 1: Validate the touched flow end-to-end**

Run: `npm run build`
Expected: pass.

Run: open doctor profile modal and confirm nearby hospitals appear in the dropdown.
Expected: suggestions include live nearby hospitals and selecting one fills the field.
```
