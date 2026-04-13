import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.join(__dirname, '..', 'data')
const appointmentsPath = path.join(dataDir, 'appointments.json')
const APPOINTMENTS_TABLE = process.env.SUPABASE_APPOINTMENTS_TABLE || 'appointments'

let cachedSupabaseClient = null
let hasWarnedMissingSupabaseEnv = false

const getSupabaseClient = () => {
  if (cachedSupabaseClient) return cachedSupabaseClient

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    if (!hasWarnedMissingSupabaseEnv) {
      console.warn('Supabase env missing (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY). Using file-based appointment store.')
      hasWarnedMissingSupabaseEnv = true
    }
    return null
  }

  cachedSupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return cachedSupabaseClient
}

const mapAppointmentToRow = (appointment) => ({
  id: appointment.id,
  user_id: appointment.userId,
  date: appointment.date,
  time: appointment.time,
  hospital: appointment.hospital,
  patient_name: appointment.patientName || null,
  phone: appointment.phone || null,
  doctor: appointment.doctor || null,
  specialty: appointment.specialty || null,
  status: appointment.status || 'Pending',
  notes: appointment.notes || null,
  created_at: appointment.createdAt || new Date().toISOString(),
})

const mapRowToAppointment = (row) => ({
  id: row.id,
  userId: row.user_id,
  date: row.date,
  time: row.time,
  hospital: row.hospital,
  patientName: row.patient_name || '',
  phone: row.phone || '',
  email: row.email || row.patient_email || '',
  doctor: row.doctor || '',
  specialty: row.specialty || '',
  status: row.status || 'Pending',
  notes: row.notes || '',
  createdAt: row.created_at,
  doctorId: row.doctor_id || null,
  approvalStatus: row.approval_status || '',
  approvedAt: row.approved_at || null,
  approvedBy: row.approved_by || null,
})

const ensureStore = async () => {
  await fs.mkdir(dataDir, { recursive: true })
  try {
    await fs.access(appointmentsPath)
  } catch {
    await fs.writeFile(appointmentsPath, '[]', 'utf8')
  }
}

const readAppointments = async () => {
  await ensureStore()
  const raw = await fs.readFile(appointmentsPath, 'utf8')
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeAppointments = async (appointments) => {
  await ensureStore()
  await fs.writeFile(appointmentsPath, JSON.stringify(appointments, null, 2), 'utf8')
}

const normalizeDoctorName = (value = '') =>
  String(value)
    .replace(/^dr\.?\s*/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()

const listAllAppointments = async () => {
  const supabaseClient = getSupabaseClient()

  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from(APPOINTMENTS_TABLE)
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase list all appointments failed, falling back to file store:', error.message)
    } else {
      return (data || []).map(mapRowToAppointment)
    }
  }

  const appointments = await readAppointments()
  return appointments.sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0))
}

const listAppointmentsForUser = async (userId) => {
  const supabaseClient = getSupabaseClient()

  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from(APPOINTMENTS_TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase list appointments failed, falling back to file store:', error.message)
    } else {
      return (data || []).map(mapRowToAppointment)
    }
  }

  const appointments = await readAppointments()
  return appointments
    .filter((appointment) => appointment.userId === userId)
    .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0))
}

const listAppointmentsForDoctor = async (doctorName, hospitalName) => {
  const normalizedDoctorName = normalizeDoctorName(doctorName)
  const normalizedHospitalName = String(hospitalName || '').trim().toLowerCase()
  if (!normalizedDoctorName || !normalizedHospitalName) return []

  const allAppointments = await listAllAppointments()
  return allAppointments.filter(
    (appointment) =>
      normalizeDoctorName(appointment?.doctor || '') === normalizedDoctorName &&
      String(appointment?.hospital || '').trim().toLowerCase() === normalizedHospitalName
  )
}

const addAppointment = async (appointment) => {
  const supabaseClient = getSupabaseClient()

  if (supabaseClient) {
    const row = mapAppointmentToRow(appointment)
    const { data, error } = await supabaseClient
      .from(APPOINTMENTS_TABLE)
      .upsert(row, { onConflict: 'id' })
      .select()
      .single()

    if (error) {
      console.error('Supabase add appointment failed, falling back to file store:', error.message)
    } else {
      return mapRowToAppointment(data)
    }
  }

  const appointments = await readAppointments()
  appointments.push(appointment)
  await writeAppointments(appointments)
  return appointment
}

const deleteAppointmentForUser = async ({ userId, appointmentId }) => {
  const supabaseClient = getSupabaseClient()

  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from(APPOINTMENTS_TABLE)
      .delete()
      .eq('id', appointmentId)
      .eq('user_id', userId)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Supabase delete appointment failed, falling back to file store:', error.message)
    } else {
      return data ? mapRowToAppointment(data) : null
    }
  }

  const appointments = await readAppointments()
  const index = appointments.findIndex(
    (appointment) => appointment.id === appointmentId && appointment.userId === userId,
  )

  if (index === -1) {
    return null
  }

  const [deletedAppointment] = appointments.splice(index, 1)
  await writeAppointments(appointments)
  return deletedAppointment
}

const approveAppointment = async ({ appointmentId, approvedBy }) => {
  const supabaseClient = getSupabaseClient()

  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from(APPOINTMENTS_TABLE)
      .update({
        status: 'Confirmed',
      })
      .eq('id', appointmentId)
      .select()
      .single()

    if (error) {
      console.error('Supabase approve appointment failed, falling back to file store:', error.message)
    } else {
      return data ? mapRowToAppointment(data) : null
    }
  }

  const appointments = await readAppointments()
  const index = appointments.findIndex((apt) => apt.id === appointmentId)

  if (index === -1) {
    return null
  }

  appointments[index].approvalStatus = 'approved'
  appointments[index].approvedAt = new Date().toISOString()
  appointments[index].approvedBy = approvedBy
  appointments[index].status = 'Confirmed'

  await writeAppointments(appointments)
  return appointments[index]
}

const rejectAppointment = async ({ appointmentId, approvedBy }) => {
  const supabaseClient = getSupabaseClient()

  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from(APPOINTMENTS_TABLE)
      .update({
        status: 'Rejected',
      })
      .eq('id', appointmentId)
      .select()
      .single()

    if (error) {
      console.error('Supabase reject appointment failed, falling back to file store:', error.message)
    } else {
      return data ? mapRowToAppointment(data) : null
    }
  }

  const appointments = await readAppointments()
  const index = appointments.findIndex((apt) => apt.id === appointmentId)

  if (index === -1) {
    return null
  }

  appointments[index].approvalStatus = 'rejected'
  appointments[index].approvedAt = new Date().toISOString()
  appointments[index].approvedBy = approvedBy
  appointments[index].status = 'Rejected'

  await writeAppointments(appointments)
  return appointments[index]
}

export {
  addAppointment,
  approveAppointment,
  deleteAppointmentForUser,
  listAllAppointments,
  listAppointmentsForDoctor,
  listAppointmentsForUser,
  readAppointments,
  rejectAppointment,
}