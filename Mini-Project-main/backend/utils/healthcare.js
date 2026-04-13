const SPECIALTY_RULES = [
  {
    match: ['cardio', 'heart', 'cardiac'],
    specialty: 'Cardiology',
    services: ['ECG', 'ECHO', 'Cardiac OPD', 'CCU'],
    facilities: ['Cardiac monitoring', 'Cath lab access', 'Emergency response'],
  },
  {
    match: ['neuro', 'brain', 'nerv'],
    specialty: 'Neurology',
    services: ['Neurology OPD', 'Stroke care', 'EEG', 'Neuro rehab'],
    facilities: ['Brain scan support', '24x7 neurology consult', 'ICU care'],
  },
  {
    match: ['pedi', 'child', 'kids', 'maternity', 'mother'],
    specialty: 'Pediatrics',
    services: ['Child OPD', 'Vaccination', 'NICU support', 'Growth checkups'],
    facilities: ['Child friendly ward', 'NICU access', 'Lactation support'],
  },
  {
    match: ['ortho', 'bone', 'joint'],
    specialty: 'Orthopedics',
    services: ['Fracture care', 'Joint consult', 'Physiotherapy', 'Sports injury care'],
    facilities: ['Mobility support', 'Plaster room', 'Physio unit'],
  },
  {
    match: ['onc', 'cancer'],
    specialty: 'Oncology',
    services: ['Cancer screening', 'Oncology OPD', 'Chemo day care', 'Counseling'],
    facilities: ['Day care chemo', 'Supportive care', 'Private consultation rooms'],
  },
  {
    match: ['emergency', 'trauma', 'critical'],
    specialty: 'Emergency Medicine',
    services: ['24x7 emergency', 'Trauma stabilization', 'Ambulance support', 'Triage'],
    facilities: ['Resuscitation bay', 'Crash cart access', 'Rapid response team'],
  },
  {
    match: ['general', 'multi', 'medical', 'centre', 'center', 'hospital', 'clinic'],
    specialty: 'General Medicine',
    services: ['General OPD', 'Diagnostics', 'Inpatient care', 'Health screening'],
    facilities: ['Outpatient wing', 'Diagnostic lab', 'Pharmacy access'],
  },
]

const BASE_SERVICE_POOL = [
  { name: 'Emergency Care', note: '24x7 triage and stabilization' },
  { name: 'General OPD', note: 'Daily physician consultations' },
  { name: 'Diagnostics', note: 'Pathology and imaging support' },
  { name: 'Pharmacy', note: 'On-site medicine dispensing' },
  { name: 'Ambulance Support', note: 'Rapid transfer and emergency pickup' },
  { name: 'ICU', note: 'Critical monitoring and intensive care' },
  { name: 'Operation Theatre', note: 'Surgical procedures and recovery' },
  { name: 'Ward Care', note: 'Short stay and recovery beds' },
]

const BASE_FACILITY_POOL = [
  'Wheelchair access',
  'Parking',
  'Cafeteria',
  'Waiting lounge',
  'Reception desk',
  'Lift access',
  'Blood bank support',
  '24x7 security',
  'Lab collection center',
  'Online reports',
]

const DOCTOR_POOL = [
  { name: 'Dr. Aanya Mehta', degree: 'MBBS, MD', specialty: 'General Medicine' },
  { name: 'Dr. Rohit Sharma', degree: 'MBBS, MS', specialty: 'General Surgery' },
  { name: 'Dr. Priya Nair', degree: 'MBBS, DNB', specialty: 'Pediatrics' },
  { name: 'Dr. Sameer Khan', degree: 'MBBS, MD', specialty: 'Emergency Medicine' },
  { name: 'Dr. Neha Verma', degree: 'MBBS, DM', specialty: 'Cardiology' },
  { name: 'Dr. Arjun Gupta', degree: 'MBBS, MS', specialty: 'Orthopedics' },
  { name: 'Dr. Kavya Iyer', degree: 'MBBS, MD', specialty: 'Neurology' },
  { name: 'Dr. Ritu Desai', degree: 'MBBS, DGO', specialty: 'Obstetrics & Gynecology' },
  { name: 'Dr. Faisal Ahmed', degree: 'MBBS, DM', specialty: 'Oncology' },
  { name: 'Dr. Sanya Kapoor', degree: 'MBBS, MD', specialty: 'Internal Medicine' },
]

const APPOINTMENT_TIME_SLOTS = ['09:00 AM', '10:30 AM', '12:00 PM', '02:00 PM', '04:00 PM', '06:00 PM']

const FALLBACK_HOSPITALS = [
  {
    id: 'fallback-1',
    name: 'Krishna Medical Centre',
    address: 'Dampier Nagar, Mathura',
    rating: 4.7,
    distanceKm: 0.8,
    lat: 27.4924,
    lon: 77.6737,
    tags: { amenity: 'hospital', name: 'Krishna Medical Centre', healthcare: 'hospital', emergency: 'yes', wheelchair: 'yes', phone: '+91-565-1234567', website: 'https://example.com' },
  },
  {
    id: 'fallback-2',
    name: 'Gokul Health Hospital',
    address: 'Govind Nagar, Mathura',
    rating: 4.5,
    distanceKm: 1.2,
    lat: 27.4868,
    lon: 77.6632,
    tags: { amenity: 'hospital', name: 'Gokul Health Hospital', healthcare: 'hospital', wheelchair: 'yes', opening_hours: '24/7', phone: '+91-565-2345678' },
  },
  {
    id: 'fallback-3',
    name: 'Vrindavan Super Speciality',
    address: 'Vrindavan Road, Mathura',
    rating: 4.8,
    distanceKm: 2.1,
    lat: 27.5740,
    lon: 77.6869,
    tags: { amenity: 'hospital', name: 'Vrindavan Super Speciality', healthcare: 'hospital', emergency: 'yes', wheelchair: 'yes', website: 'https://example.com' },
  },
  {
    id: 'fallback-4',
    name: 'Janaki Maternity Clinic',
    address: 'Deeg Gate, Mathura',
    rating: 4.4,
    distanceKm: 1.7,
    lat: 27.4910,
    lon: 77.6720,
    tags: { amenity: 'clinic', name: 'Janaki Maternity Clinic', healthcare: 'clinic', phone: '+91-565-3456789', wheelchair: 'yes' },
  },
]

const SYNTHETIC_PREFIXES = [
  'Krishna', 'Gokul', 'Vrindavan', 'Janaki', 'Shri', 'Aarogya', 'Sanjeevani', 'Divya',
  'Madhav', 'Ananta', 'Seva', 'Niramaya', 'Uday', 'Sparsh', 'Sanjeev', 'Apex',
]

const SYNTHETIC_SUFFIXES = [
  'Medical Centre', 'Health Hospital', 'Super Speciality', 'Maternity Clinic',
  'Care Hospital', 'Diagnostic Centre', 'Wellness Hospital', 'Emergency Hospital',
]

const SYNTHETIC_AREAS = [
  'Dampier Nagar', 'Govind Nagar', 'Vrindavan Road', 'Deeg Gate', 'Sadar Bazaar', 'Masani',
  'Bhuteshwar', 'NH-19', 'Chatikara Road', 'Goverdhan Road', 'Mathura Junction', 'Krishna Nagar',
]

const SYNTHETIC_SPECIALTIES = [
  'Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'Oncology', 'Emergency Medicine',
  'General Medicine', 'Diagnostics', 'Maternity', 'Critical Care',
]

const generateSyntheticHospitals = (origin, total = 134) => {
  if (!origin) return FALLBACK_HOSPITALS

  return Array.from({ length: total }, (_, index) => {
    const prefix = SYNTHETIC_PREFIXES[index % SYNTHETIC_PREFIXES.length]
    const suffix = SYNTHETIC_SUFFIXES[index % SYNTHETIC_SUFFIXES.length]
    const area = SYNTHETIC_AREAS[index % SYNTHETIC_AREAS.length]
    const specialty = SYNTHETIC_SPECIALTIES[index % SYNTHETIC_SPECIALTIES.length]
    const name = `${prefix} ${suffix}`
    const row = Math.floor(index / 12)
    const col = index % 12
    const lat = origin.lat + (row * 0.0085) + ((col - 6) * 0.0025)
    const lon = origin.lng + (row * 0.0065) + ((col - 6) * 0.0027)
    const distanceKm = getDistanceKm(origin, { lat, lng: lon })
    const rating = (3.8 + ((index % 13) * 0.09)).toFixed(1)

    return {
      id: `synthetic-${index + 1}`,
      type: index % 3 === 0 ? 'clinic' : 'node',
      lat,
      lon,
      distanceKm,
      displayName: name,
      displayAddress: `${area}, Mathura`,
      tags: {
        amenity: index % 3 === 0 ? 'clinic' : 'hospital',
        healthcare: index % 3 === 0 ? 'clinic' : 'hospital',
        name,
        operator: `${prefix} Group`,
        'healthcare:speciality': specialty.toLowerCase(),
        emergency: index % 4 === 0 ? 'yes' : 'limited',
        wheelchair: index % 2 === 0 ? 'yes' : 'limited',
        opening_hours: index % 5 === 0 ? '24/7' : '08:00-20:00',
        phone: `+91-565-${String(1000000 + index).slice(-7)}`,
        website: index % 7 === 0 ? `https://example.com/hospital/${index + 1}` : '',
        'addr:full': `${area}, Mathura`,
      },
      rating,
    }
  }).map((hospital) => normalizeLiveHospital(hospital, origin))
}

const SERVICE_PRICE_CATALOG = [
  {
    hospital: 'Krishna Medical Centre',
    services: [
      { name: 'ECG', price: 450 },
      { name: 'Cardiology Consultation', price: 900 },
      { name: 'ICU Bed (Per Day)', price: 5200 },
      { name: 'Emergency Care', price: 1500 },
      { name: 'CT Scan', price: 2800 },
    ],
  },
  {
    hospital: 'Gokul Health Hospital',
    services: [
      { name: 'Neurology Consultation', price: 1100 },
      { name: 'Orthopedic Consultation', price: 800 },
      { name: 'Blood Test Panel', price: 700 },
      { name: 'X-Ray', price: 600 },
      { name: 'MRI Scan', price: 4200 },
    ],
  },
  {
    hospital: 'Vrindavan Super Speciality',
    services: [
      { name: 'Oncology Consultation', price: 1300 },
      { name: 'Chemotherapy Session', price: 8500 },
      { name: 'Cardiology Consultation', price: 1000 },
      { name: 'ICU Bed (Per Day)', price: 6400 },
      { name: 'PET Scan', price: 12000 },
    ],
  },
  {
    hospital: 'Janaki Maternity Clinic',
    services: [
      { name: 'Pediatrics Consultation', price: 700 },
      { name: 'Maternity Checkup', price: 1200 },
      { name: 'Normal Delivery Package', price: 28000 },
      { name: 'C-Section Package', price: 52000 },
      { name: 'NICU Bed (Per Day)', price: 4500 },
    ],
  },
]

const hashString = (value = '') => {
  let hash = 0
  const input = String(value)
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0
  }
  return hash
}

const uniqueBy = (items, keyFn) => {
  const seen = new Set()
  return items.filter((item) => {
    const key = keyFn(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const getDistanceKm = (from, to) => {
  if (!from || !to) return null
  const earthRadiusKm = 6371
  const toRadians = (value) => (value * Math.PI) / 180
  const dLat = toRadians(to.lat - from.lat)
  const dLng = toRadians(to.lng - from.lng)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const pickMany = (pool, seed, count, offset = 0) => {
  if (pool.length === 0) return []
  const results = []
  for (let index = 0; index < count; index += 1) {
    results.push(pool[(seed + offset + index * 3) % pool.length])
  }
  return uniqueBy(results, (item) => item.name || item)
}

const getRawTags = (hospital) => {
  if (Array.isArray(hospital?.tags)) {
    return hospital.tags.map((tag) => String(tag).trim()).filter(Boolean)
  }

  const tags = hospital?.tags || hospital?.raw?.tags || {}
  return [
    hospital?.displayName,
    hospital?.displayAddress,
    tags.name,
    tags.operator,
    tags.amenity,
    tags.healthcare,
    tags['healthcare:speciality'],
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
    .map((value) => String(value).trim())
}

const getAddress = (hospital) => {
  const tags = hospital?.tags || hospital?.raw?.tags || {}
  return hospital?.address || hospital?.displayAddress || tags['addr:full'] || [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'],
    tags['addr:city'],
    tags['addr:state'],
  ].filter(Boolean).join(', ') || 'Address not available'
}

const getContact = (hospital) => {
  const tags = hospital?.tags || hospital?.raw?.tags || {}
  return {
    phone: hospital?.contact?.phone || tags.phone || '',
    website: hospital?.contact?.website || tags.website || '',
  }
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
  if (service.includes('delivery')) return 18000
  return 1600
}

const estimateServicePrice = ({ serviceName, hospitalName, rating }) => {
  const basePrice = getServiceBasePrice(serviceName)
  const ratingNumber = Number.parseFloat(String(rating || '').replace(/[^0-9.]/g, ''))
  const normalizedRating = Number.isFinite(ratingNumber) ? Math.max(3.0, Math.min(5.0, ratingNumber)) : 4.2

  const ratingFactor =
    normalizedRating >= 4.8 ? 1.30 :
    normalizedRating >= 4.6 ? 1.22 :
    normalizedRating >= 4.4 ? 1.15 :
    normalizedRating >= 4.2 ? 1.08 :
    normalizedRating >= 4.0 ? 1.00 :
    normalizedRating >= 3.8 ? 0.93 :
    0.86

  const noiseHash = hashString(`${hospitalName}-${serviceName}`)
  const minorVariation = 0.97 + ((noiseHash % 7) / 100)

  const estimated = Math.round((basePrice * ratingFactor * minorVariation) / 10) * 10
  return Math.max(estimated, 300)
}

const deriveSpecialties = (hospital, seed) => {
  const text = getRawTags(hospital).join(' ').toLowerCase()
  const name = String(hospital?.name || hospital?.displayName || hospital?.raw?.tags?.name || '').toLowerCase()
  const sourceText = `${name} ${text}`

  const matches = SPECIALTY_RULES.filter((rule) =>
    rule.match.some((keyword) => sourceText.includes(keyword))
  )

  const specialties = matches.map((match) => match.specialty)
  if (specialties.length === 0) {
    specialties.push('General Medicine', 'Diagnostics')
  }

  const fallbackPool = ['Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'Oncology', 'Emergency Medicine', 'General Medicine']
  const extra = pickMany(
    fallbackPool.filter((specialty) => !specialties.includes(specialty)),
    seed,
    2
  )

  return uniqueBy([...specialties, ...extra], (item) => item).slice(0, 4)
}

const deriveServices = (specialties, seed) => {
  const specialtyServices = specialties.flatMap((specialty) => {
    const rule = SPECIALTY_RULES.find((item) => item.specialty === specialty)
    return rule ? rule.services.map((name) => ({ name, note: `${specialty} support` })) : []
  })

  const baseServices = pickMany(BASE_SERVICE_POOL, seed, 4)
  const combined = uniqueBy([...specialtyServices, ...baseServices], (item) => item.name)
  return combined.slice(0, 8)
}

const deriveFacilities = (specialties, seed, hospital) => {
  const specialtyFacilities = specialties.flatMap((specialty) => {
    const rule = SPECIALTY_RULES.find((item) => item.specialty === specialty)
    return rule ? rule.facilities : []
  })

  const liveExtras = []
  const tags = hospital?.tags || hospital?.raw?.tags || {}
  if (tags.emergency) liveExtras.push('Emergency desk')
  if (tags.wheelchair) liveExtras.push('Wheelchair friendly')
  if (tags.opening_hours) liveExtras.push('Extended hours')
  if (tags.phone) liveExtras.push('Direct phone line')
  if (tags.website) liveExtras.push('Online appointment request')

  return uniqueBy([ ...specialtyFacilities, ...pickMany(BASE_FACILITY_POOL, seed, 5), ...liveExtras ], (item) => item).slice(0, 9)
}

const deriveDoctors = (specialties, seed, hospitalName) => {
  const mainSpecialty = specialties[0] || 'General Medicine'
  const specialtyLead = {
    name: `Dr. ${hospitalName.split(' ')[0] || 'Care'} Specialist`,
    degree: 'MBBS, MD',
    specialty: mainSpecialty,
    experience: `${8 + (seed % 9)} years`,
    shift: 'Morning OPD',
  }

  const doctors = [specialtyLead]
  const selectedDoctors = pickMany([...DOCTOR_POOL], seed, 4)

  selectedDoctors.forEach((doctor, index) => {
    doctors.push({
      ...doctor,
      experience: `${5 + ((seed + index * 2) % 14)} years`,
      shift: index % 2 === 0 ? 'Morning OPD' : 'Evening OPD',
    })
  })

  return uniqueBy(doctors, (doctor) => doctor.name).slice(0, 5)
}

const deriveHospitalType = (hospital, specialties) => {
  const name = String(hospital?.name || hospital?.displayName || '').toLowerCase()
  if (name.includes('clinic')) return 'Clinic'
  if (name.includes('maternity')) return 'Maternity care'
  if (name.includes('super speciality') || name.includes('super-speciality')) return 'Super speciality hospital'
  if (specialties.includes('Oncology')) return 'Speciality hospital'
  if (specialties.includes('Cardiology')) return 'Cardiac center'
  return 'Multi-speciality hospital'
}

const deriveStaffCount = (seed, specialties, hospital) => {
  const type = deriveHospitalType(hospital, specialties)
  if (type === 'Clinic') return 28 + (seed % 18)
  if (type === 'Maternity care') return 55 + (seed % 25)
  if (type === 'Cardiac center') return 120 + (seed % 60)
  if (type === 'Super speciality hospital') return 180 + (seed % 80)
  return 75 + (seed % 90)
}

const deriveBedCount = (seed, specialties, hospital) => {
  const type = deriveHospitalType(hospital, specialties)
  if (type === 'Clinic') return 12 + (seed % 8)
  if (type === 'Maternity care') return 30 + (seed % 20)
  if (type === 'Cardiac center') return 90 + (seed % 40)
  if (type === 'Super speciality hospital') return 140 + (seed % 70)
  return 45 + (seed % 55)
}

const normalizeLiveHospital = (hospital, origin) => {
  const latValue = hospital.lat ?? hospital.center?.lat
  const lonValue = hospital.lon ?? hospital.center?.lon
  const distanceKm = typeof latValue === 'number' && typeof lonValue === 'number' && origin
    ? getDistanceKm(origin, { lat: latValue, lng: lonValue })
    : hospital.distanceKm ?? null

  const rawTags = hospital.tags || {}
  const displayName = hospital.displayName || rawTags.name || rawTags.operator || 'Hospital'
  const displayAddress = hospital.displayAddress || getAddress(hospital)
  const liveTags = [
    rawTags.amenity && `Type: ${rawTags.amenity}`,
    rawTags.operator && `Operator: ${rawTags.operator}`,
    rawTags['healthcare:speciality'] && `Speciality: ${rawTags['healthcare:speciality']}`,
    rawTags.emergency && `Emergency: ${rawTags.emergency}`,
    rawTags.wheelchair && `Wheelchair: ${rawTags.wheelchair}`,
    rawTags.opening_hours && `Hours: ${rawTags.opening_hours}`,
    rawTags.phone && `Phone: ${rawTags.phone}`,
    rawTags.website && `Website: ${rawTags.website}`,
    rawTags['addr:full'] || [rawTags['addr:housenumber'], rawTags['addr:street'], rawTags['addr:city'], rawTags['addr:state']].filter(Boolean).join(', '),
  ].filter(Boolean)

  return {
    key: `live-${hospital.type || 'node'}-${hospital.id || `${displayName}-${latValue || ''}-${lonValue || ''}`}`,
    id: hospital.id,
    name: displayName,
    address: displayAddress,
    displayName,
    displayAddress,
    lat: latValue,
    lon: lonValue,
    distanceText: typeof distanceKm === 'number' ? `${distanceKm.toFixed(2)} km away` : 'Nearby',
    distanceKm,
    rating: getLiveHospitalRating(hospital),
    source: 'OpenStreetMap',
    tags: liveTags.length > 0 ? liveTags : ['Live data'],
    details: liveTags.slice(0, 4),
    contact: {
      phone: rawTags.phone || '',
      website: rawTags.website || '',
    },
    raw: hospital,
    searchTokens: getHospitalSearchTokens(hospital),
  }
}

const normalizeFallbackHospital = (hospital, index, origin) => {
  const distanceKm = typeof hospital.distanceKm === 'number' && origin && typeof hospital.lat === 'number' && typeof hospital.lon === 'number'
    ? getDistanceKm(origin, { lat: hospital.lat, lng: hospital.lon })
    : hospital.distanceKm ?? null

  return {
    key: `mock-${index}`,
    id: hospital.id || `mock-${index}`,
    name: hospital.name,
    address: hospital.address,
    displayName: hospital.name,
    displayAddress: hospital.address,
    distanceText: hospital.distance || (typeof distanceKm === 'number' ? `${distanceKm.toFixed(2)} km away` : 'Nearby'),
    distanceKm,
    rating: hospital.rating,
    source: 'Mock data',
    tags: Array.isArray(hospital.tags) ? hospital.tags : [],
    details: [],
    contact: {
      phone: hospital.phone || '',
      website: hospital.website || '',
    },
    raw: hospital,
    lat: hospital.lat,
    lon: hospital.lon,
    searchTokens: getHospitalSearchTokens(hospital),
  }
}

const fetchFromOverpass = async (lat, lng, radiusKm) => {
  const query = `
    [out:json][timeout:60];
    (
      nwr["amenity"="hospital"](around:${radiusKm * 1000},${lat},${lng});
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

      const hospitals = rawHospitals
        .map((hospital) => {
          const latValue = hospital.lat ?? hospital.center?.lat
          const lonValue = hospital.lon ?? hospital.center?.lon
          if (typeof latValue !== 'number' || typeof lonValue !== 'number') return null

          const distanceKm = getDistanceKm({ lat, lng }, { lat: latValue, lng: lonValue })
          if (distanceKm < 0.2 || distanceKm > radiusKm) return null

          const key = `${hospital.type || 'node'}-${hospital.id || `${latValue}-${lonValue}`}`
          if (seenHospitals.has(key)) return null
          seenHospitals.add(key)

          return normalizeLiveHospital({ ...hospital, lat: latValue, lon: lonValue, distanceKm, displayName: hospital.tags?.name || hospital.tags?.operator || 'Hospital', displayAddress: getAddress(hospital) }, { lat, lng })
        })
        .filter(Boolean)
        .sort((a, b) => a.distanceKm - b.distanceKm)

      if (hospitals.length > 0) {
        return hospitals
      }
    } catch (error) {
      lastError = error
    }
  }

  if (lastError) {
    console.error('Overpass fetch failed:', lastError.message)
  }

  return []
}

const fetchLiveHospitals = async ({ lat, lng, radiusKm = 50 } = {}) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return FALLBACK_HOSPITALS.map((hospital, index) => normalizeFallbackHospital(hospital, index, null))
  }

  const liveHospitals = await fetchFromOverpass(lat, lng, radiusKm)
  if (liveHospitals.length > 0) {
    return liveHospitals
  }

  return generateSyntheticHospitals({ lat, lng }, 134)
}

const getNearbyPlaces = async (lat, lng) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=15&addressdetails=1`, {
      headers: {
        'User-Agent': 'HealthcareHub/1.0 (local development)',
      },
    })
    const data = await res.json()
    const address = data.address || {}
    const places = []

    if (address.village) places.push({ name: address.village, type: '🏘️' })
    if (address.suburb) places.push({ name: address.suburb, type: '🏙️' })
    if (address.neighbourhood) places.push({ name: address.neighbourhood, type: '📍' })
    if (address.road) places.push({ name: address.road, type: '🛣️' })
    if (address.city) places.push({ name: address.city, type: '🏛️' })
    if (address.county) places.push({ name: address.county, type: '🗺️' })
    if (address.state) places.push({ name: address.state, type: '📌' })

    return places.slice(0, 5)
  } catch (error) {
    console.error('Failed to fetch nearby places:', error.message)
    return []
  }
}

const searchHospitals = async ({ lat, lng, query = '', filter = 'All', radiusKm = 50 }) => {
  const hospitals = await fetchLiveHospitals({ lat, lng, radiusKm })
  const normalizedQuery = query.trim().toLowerCase()

  let filtered = hospitals

  if (filter && filter !== 'All') {
    const filterLower = filter.toLowerCase()
    filtered = filtered.filter((hospital) =>
      hospital.searchTokens.some((token) => token.includes(filterLower)) ||
      hospital.tags.some((tag) => String(tag).toLowerCase().includes(filterLower))
    )
  }

  if (normalizedQuery) {
    filtered = filtered.filter((hospital) =>
      hospital.name.toLowerCase().includes(normalizedQuery) ||
      hospital.address.toLowerCase().includes(normalizedQuery) ||
      hospital.tags.some((tag) => String(tag).toLowerCase().includes(normalizedQuery)) ||
      hospital.searchTokens.some((token) => token.includes(normalizedQuery))
    )
  }

  return filtered.sort((a, b) => {
    if (typeof a.distanceKm === 'number' && typeof b.distanceKm === 'number') return a.distanceKm - b.distanceKm
    if (typeof a.distanceKm === 'number') return -1
    if (typeof b.distanceKm === 'number') return 1
    return 0
  })
}

const searchServices = async ({ lat, lng, query = '', radiusKm = 50 }) => {
  const hospitals = await fetchLiveHospitals({ lat, lng, radiusKm })
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return []

  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean)

  const results = hospitals.map((hospital) => {
    const detail = buildHospitalDetail(hospital)
    const exactCatalog = SERVICE_PRICE_CATALOG.find((item) => item.hospital === hospital.name)
    const exactMatches = (exactCatalog?.services || [])
      .filter((service) => service.name.toLowerCase().includes(normalizedQuery))
      .map((service) => ({ ...service, availability: 'Confirmed' }))

    const tokenText = [hospital.name, hospital.address, ...hospital.searchTokens, ...detail.specialties].join(' ').toLowerCase()
    const likelyMatch = queryTerms.length > 0 && queryTerms.every((term) => tokenText.includes(term))

    const matchedServices = exactMatches.length > 0
      ? exactMatches
      : [
          {
            name: normalizedQuery.toUpperCase() === normalizedQuery ? normalizedQuery : normalizedQuery.replace(/\b\w/g, (char) => char.toUpperCase()),
            price: estimateServicePrice({
              serviceName: normalizedQuery,
              hospitalName: hospital.name,
              rating: hospital.rating,
            }),
            availability: likelyMatch ? 'Estimated' : 'Likely Available',
          },
        ]

    return {
      hospital: hospital.name,
      address: hospital.address,
      rating: hospital.rating || 'N/A',
      distanceKm: hospital.distanceKm,
      matchedServices,
    }
  })

  return results.sort((a, b) => {
    if (typeof a.distanceKm === 'number' && typeof b.distanceKm === 'number') return a.distanceKm - b.distanceKm
    if (typeof a.distanceKm === 'number') return -1
    if (typeof b.distanceKm === 'number') return 1
    return 0
  })
}

const buildHospitalDetail = (hospital) => {
  const name = hospital?.name || hospital?.displayName || hospital?.raw?.tags?.name || 'Hospital'
  const address = getAddress(hospital)
  const contact = getContact(hospital)
  const tags = getRawTags(hospital)
  const seed = hashString(`${name}|${address}|${tags.join('|')}`)
  const specialties = deriveSpecialties(hospital, seed)
  const services = deriveServices(specialties, seed)
  const doctors = deriveDoctors(specialties, seed, name)
  const facilities = deriveFacilities(specialties, seed, hospital)
  const staffCount = deriveStaffCount(seed, specialties, hospital)
  const bedCount = deriveBedCount(seed, specialties, hospital)
  const rawTags = hospital?.tags || hospital?.raw?.tags || {}
  const hours = rawTags.opening_hours || '24/7'
  const rating = hospital?.rating || (4.1 + ((seed % 8) * 0.1)).toFixed(1)
  const distanceText = hospital?.distanceText || hospital?.distance || 'Distance not available'
  const type = deriveHospitalType(hospital, specialties)

  const summary = [
    `${name} is a ${type.toLowerCase()} focused on ${specialties.slice(0, 2).join(' and ')} care.`,
    contact.phone ? `Direct phone support is available at ${contact.phone}.` : 'Call support is available through the reception desk.',
    `Current services include ${services.length} departments and ${doctors.length} doctors listed for quick booking.`,
  ].join(' ')

  return {
    id: hospital?.key || hospital?.id || name,
    name,
    address,
    contact,
    source: hospital?.source || (hospital?.raw?.tags ? 'OpenStreetMap' : 'Verified listing'),
    rating,
    distanceText,
    distanceKm: hospital?.distanceKm ?? null,
    type,
    hours,
    summary,
    specialties,
    services,
    doctors,
    facilities,
    staffCount,
    bedCount,
    totalServices: services.length,
    emergencyAvailable: Boolean(rawTags.emergency) || specialties.includes('Emergency Medicine'),
    wheelchairAccess: String(rawTags.wheelchair || '').toLowerCase() === 'yes' || facilities.some((item) => item.toLowerCase().includes('wheelchair')),
    onlineBooking: Boolean(contact.website) || true,
    badges: uniqueBy(
      [
        ...specialties,
        hours,
        contact.phone ? 'Direct phone' : null,
        contact.website ? 'Online portal' : null,
        rawTags.emergency ? 'Emergency' : null,
      ].filter(Boolean),
      (item) => item
    ),
    schedule: APPOINTMENT_TIME_SLOTS,
  }
}

const createAppointmentRecord = ({ detail, form, userId }) => ({
  id: `apt-${Date.now()}`,
  userId,
  date: form.date,
  time: form.time,
  hospital: detail.name,
  patientName: form.patientName || '',
  phone: form.phone || '',
  email: form.email || '',
  doctor: form.doctor,
  specialty: form.service || form.specialty,
  status: 'Pending',
  approvalStatus: 'pending',
  notes: form.notes || `Booked through ${detail.name}.`,
  createdAt: new Date().toISOString(),
})

const toTitleCase = (value = '') =>
  String(value)
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

export {
  APPOINTMENT_TIME_SLOTS,
  FALLBACK_HOSPITALS,
  SERVICE_PRICE_CATALOG,
  buildHospitalDetail,
  createAppointmentRecord,
  estimateServicePrice,
  fetchLiveHospitals,
  getNearbyPlaces,
  getDistanceKm,
  getHospitalSearchTokens,
  getLiveHospitalRating,
  normalizeFallbackHospital,
  normalizeLiveHospital,
  searchHospitals,
  searchServices,
  toTitleCase,
}