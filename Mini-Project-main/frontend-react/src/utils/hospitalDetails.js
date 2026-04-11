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
    return hospital.tags
      .map((tag) => String(tag).trim())
      .filter(Boolean)
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
  const combined = uniqueBy(
    [
      ...specialtyServices,
      ...baseServices,
    ],
    (item) => item.name
  )

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

  return uniqueBy(
    [
      ...specialtyFacilities,
      ...pickMany(BASE_FACILITY_POOL, seed, 5),
      ...liveExtras,
    ],
    (item) => item
  ).slice(0, 9)
}

const deriveDoctors = (specialties, seed, hospitalName) => {
  const mainSpecialty = specialties[0] || 'General Medicine'
  const pool = [...DOCTOR_POOL]

  const specialtyLead = {
    name: `Dr. ${hospitalName.split(' ')[0] || 'Care'} Specialist`,
    degree: 'MBBS, MD',
    specialty: mainSpecialty,
    experience: `${8 + (seed % 9)} years`,
    shift: 'Morning OPD',
  }

  const doctors = [specialtyLead]
  const selectedDoctors = pickMany(pool, seed, 4)

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

export const buildHospitalDetail = (hospital) => {
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

export const createAppointmentRecord = (detail, form) => ({
  id: `apt-${Date.now()}`,
  date: form.date,
  time: form.time,
  hospital: detail.name,
  patientName: form.patientName || '',
  phone: form.phone || '',
  doctor: form.doctor,
  specialty: form.specialty,
  status: 'Upcoming',
  notes: form.notes || `Booked through ${detail.name}.`,
})

export const getDefaultAppointmentForm = (detail, userName = '', userPhone = '') => {
  const preferredDoctor = detail?.doctors?.[0]?.name || ''
  const preferredSpecialty = detail?.doctors?.[0]?.specialty || detail?.specialties?.[0] || 'General Medicine'
  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + 2)

  return {
    patientName: userName || '',
    phone: userPhone || '',
    date: nextDate.toISOString().slice(0, 10),
    time: detail?.schedule?.[1] || APPOINTMENT_TIME_SLOTS[1],
    doctor: preferredDoctor,
    specialty: preferredSpecialty,
    notes: '',
  }
}

export { APPOINTMENT_TIME_SLOTS }
