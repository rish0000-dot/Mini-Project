import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import {
  buildHospitalDetail,
  createAppointmentRecord,
  fetchLiveHospitals,
  getNearbyPlaces,
  searchHospitals,
  searchServices,
} from './utils/healthcare.js'
import {
  addAppointment,
  approveAppointment,
  deleteAppointmentForUser,
  listAppointmentsForDoctor,
  listAppointmentsForUser,
  rejectAppointment,
} from './utils/appointments-store.js'
import {
  addFavoriteHospital,
  deleteFavoriteHospitalForUser,
  listFavoriteHospitalsForUser,
} from './utils/favorites-store.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '.env') })

const app = express()
app.use(cors())
app.use(express.json())

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`)
  next()
})

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'healthcare-hub-backend',
    aiProvider: 'ollama',
    ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2:1b',
    time: new Date().toISOString(),
  })
})

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:1b'
const OLLAMA_NUM_PREDICT_RAW = Number.parseInt(process.env.OLLAMA_NUM_PREDICT || '220', 10)
const OLLAMA_NUM_PREDICT = Number.isFinite(OLLAMA_NUM_PREDICT_RAW)
  ? Math.min(512, Math.max(96, OLLAMA_NUM_PREDICT_RAW))
  : 220
const GREETING_ONLY_PATTERN = /^(hi+|hii+|hello+|hey+|hlo+|hlw+|hle+|namaste+|namaskar+|salam+)\b[\s!.?]*$/i
const GREETING_REPLY = 'Hi! How can I assist you today?'

const isGreetingOnlyMessage = (message) => GREETING_ONLY_PATTERN.test(String(message || '').trim())

const buildOllamaMessages = (message) => [
  {
    role: 'system',
    content:
      'You are a healthcare guidance assistant. Give complete and clear responses in markdown with these sections when relevant: **Possible reasons**, **What you can do now**, **Red flags**, **When to see a doctor**. Use short bullet points under each section. Never cut off mid-sentence. Never diagnose with certainty. For emergency symptoms, advise immediate medical help. Answer the user query directly and do not use generic greetings like "Hey sir, how can I assist today" unless the user sent only a greeting.',
  },
  {
    role: 'user',
    content: message,
  },
]

const createOllamaPayload = (message, stream = false) => ({
  model: OLLAMA_MODEL,
  stream,
  keep_alive: '1h',
  options: {
    num_predict: OLLAMA_NUM_PREDICT,
    temperature: 0.1,
    top_p: 0.85,
  },
  messages: buildOllamaMessages(message),
})

const extractOllamaText = async (response) => {
  const payload = await response.json()
  return payload?.message?.content || "I'm not sure how to respond right now."
}

app.post('/api/chat', async (req, res) => {
  const { message } = req.body

  try {
    const lastUserMessage = String(message || '').trim()
    if (!lastUserMessage) {
      return res.status(400).json({ error: 'message is required' })
    }

    if (isGreetingOnlyMessage(lastUserMessage)) {
      return res.json({ reply: GREETING_REPLY })
    }

    const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createOllamaPayload(lastUserMessage, false)),
    })

    if (!ollamaResponse.ok) {
      const details = await ollamaResponse.text()
      return res.status(502).json({
        error: 'Ollama returned a non-success response.',
        details,
      })
    }

    const text = await extractOllamaText(ollamaResponse)

    res.json({ reply: text })
  } catch (error) {
    console.error('Ollama API Error details:', error)
    const isConnectionIssue = /ECONNREFUSED|fetch failed|ENOTFOUND/i.test(String(error?.message || ''))

    res.status(isConnectionIssue ? 503 : 500).json({
      message: 'AI service error',
      details: error.message,
      reply: isConnectionIssue
        ? 'Ollama server is not reachable. Start Ollama and run: ollama pull llama3.2'
        : "I'm having trouble thinking right now. Please try again.",
    })
  }
})

app.post('/api/chat/stream', async (req, res) => {
  const { message } = req.body

  try {
    const lastUserMessage = String(message || '').trim()
    if (!lastUserMessage) {
      return res.status(400).json({ error: 'message is required' })
    }

    if (isGreetingOnlyMessage(lastUserMessage)) {
      res.status(200)
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders?.()
      res.write(GREETING_REPLY)
      res.end()
      return
    }

    const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createOllamaPayload(lastUserMessage, true)),
    })

    if (!ollamaResponse.ok || !ollamaResponse.body) {
      const details = await ollamaResponse.text()
      return res.status(502).json({
        error: 'Ollama returned a non-success response.',
        details,
      })
    }

    res.status(200)
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()

    const reader = ollamaResponse.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        try {
          const chunk = JSON.parse(trimmed)
          const content = chunk?.message?.content || ''
          if (content) {
            res.write(content)
          }
        } catch (parseError) {
          console.error('Failed to parse Ollama stream chunk:', parseError)
        }
      }
    }

    buffer += decoder.decode()

    if (buffer.trim()) {
      try {
        const chunk = JSON.parse(buffer.trim())
        const content = chunk?.message?.content || ''
        if (content) {
          res.write(content)
        }
      } catch (parseError) {
        console.error('Failed to parse final Ollama stream chunk:', parseError)
      }
    }

    res.end()
  } catch (error) {
    console.error('Ollama streaming API Error details:', error)
    const isConnectionIssue = /ECONNREFUSED|fetch failed|ENOTFOUND/i.test(String(error?.message || ''))

    res.status(isConnectionIssue ? 503 : 500).json({
      message: 'AI service error',
      details: error.message,
      reply: isConnectionIssue
        ? 'Ollama server is not reachable. Start Ollama and run: ollama pull llama3.2:1b'
        : "I'm having trouble thinking right now. Please try again.",
    })
  }
})

app.get('/api/hospitals/nearby', async (req, res) => {
  try {
    const lat = Number.parseFloat(req.query.lat)
    const lng = Number.parseFloat(req.query.lng)
    const query = String(req.query.query || '')
    const filter = String(req.query.filter || 'All')

    const hospitals = await searchHospitals({
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
      query,
      filter,
    })

    res.json({ hospitals, count: hospitals.length })
  } catch (error) {
    console.error('Hospital search error:', error)
    res.status(500).json({ error: 'Failed to load nearby hospitals' })
  }
})

app.get('/api/hospitals/detail', async (req, res) => {
  try {
    const name = String(req.query.name || '').trim()
    if (!name) {
      return res.status(400).json({ error: 'name is required' })
    }

    const lat = Number.parseFloat(req.query.lat)
    const lng = Number.parseFloat(req.query.lng)
    const hospitals = await searchHospitals({
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
      query: name,
      filter: 'All',
    })
    const hospital = hospitals.find((item) => item.name.toLowerCase() === name.toLowerCase()) || hospitals[0]
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' })
    }

    res.json({ detail: buildHospitalDetail(hospital) })
  } catch (error) {
    console.error('Hospital detail error:', error)
    res.status(500).json({ error: 'Failed to build hospital detail' })
  }
})

app.get('/api/services/search', async (req, res) => {
  try {
    const lat = Number.parseFloat(req.query.lat)
    const lng = Number.parseFloat(req.query.lng)
    const query = String(req.query.query || '')

    const results = await searchServices({
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
      query,
    })

    res.json({ results, count: results.length })
  } catch (error) {
    console.error('Service search error:', error)
    res.status(500).json({ error: 'Failed to search services' })
  }
})

app.get('/api/places/nearby', async (req, res) => {
  try {
    const lat = Number.parseFloat(req.query.lat)
    const lng = Number.parseFloat(req.query.lng)

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'lat and lng are required' })
    }

    const places = await getNearbyPlaces(lat, lng)
    res.json({ places })
  } catch (error) {
    console.error('Nearby places error:', error)
    res.status(500).json({ error: 'Failed to load nearby places' })
  }
})

app.get('/api/appointments', async (req, res) => {
  try {
    const userId = String(req.query.userId || '').trim()
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    const appointments = await listAppointmentsForUser(userId)
    res.json({ appointments })
  } catch (error) {
    console.error('Appointments fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch appointments' })
  }
})

app.post('/api/appointments', async (req, res) => {
  try {
    const { userId, detail, form } = req.body || {}
    if (!userId || !detail || !form) {
      return res.status(400).json({ error: 'userId, detail, and form are required' })
    }

    const appointment = createAppointmentRecord({ detail, form, userId })
    const savedAppointment = await addAppointment(appointment)
    res.status(201).json({ appointment: savedAppointment || appointment })
  } catch (error) {
    console.error('Appointment create error:', error)
    res.status(500).json({ error: 'Failed to save appointment' })
  }
})

app.delete('/api/appointments/:appointmentId', async (req, res) => {
  try {
    const userId = String(req.query.userId || '').trim()
    const appointmentId = String(req.params.appointmentId || '').trim()

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId is required' })
    }

    const deletedAppointment = await deleteAppointmentForUser({ userId, appointmentId })

    if (!deletedAppointment) {
      return res.status(404).json({ error: 'Appointment not found' })
    }

    res.json({ ok: true, appointment: deletedAppointment })
  } catch (error) {
    console.error('Appointment delete error:', error)
    res.status(500).json({ error: 'Failed to delete appointment' })
  }
})

// Get doctor's pending appointments for approval
app.get('/api/appointments/doctor/pending', async (req, res) => {
  try {
    const doctorName = String(req.query.doctorName || '').trim()
    const hospitalName = String(req.query.hospitalName || '').trim()
    if (!doctorName || !hospitalName) {
      return res.status(400).json({ error: 'doctorName and hospitalName are required' })
    }

    const appointments = await listAppointmentsForDoctor(doctorName, hospitalName)
    const pendingAppointments = appointments.filter((appointment) => {
      const approvalStatus = String(appointment?.approvalStatus || appointment?.approval_status || '').toLowerCase()
      const status = String(appointment?.status || '').toLowerCase()

      if (approvalStatus === 'approved' || approvalStatus === 'rejected') return false
      if (approvalStatus === 'pending') return true

      if (status === 'pending' || status === 'upcoming') return true
      const isFinalizedStatus = ['confirmed', 'completed', 'cancelled', 'rejected'].includes(status)
      return !isFinalizedStatus
    })

    res.json({ appointments: pendingAppointments })
  } catch (error) {
    console.error('Doctor pending appointments error:', error)
    res.status(500).json({ error: 'Failed to fetch pending appointments' })
  }
})

// Get doctor's all appointments
app.get('/api/appointments/doctor/all', async (req, res) => {
  try {
    const doctorName = String(req.query.doctorName || '').trim()
    const hospitalName = String(req.query.hospitalName || '').trim()
    if (!doctorName || !hospitalName) {
      return res.status(400).json({ error: 'doctorName and hospitalName are required' })
    }

    const appointments = await listAppointmentsForDoctor(doctorName, hospitalName)
    res.json({ appointments })
  } catch (error) {
    console.error('Doctor appointments error:', error)
    res.status(500).json({ error: 'Failed to fetch appointments' })
  }
})

// Approve appointment
app.put('/api/appointments/:appointmentId/approve', async (req, res) => {
  try {
    const appointmentId = String(req.params.appointmentId || '').trim()
    const approvedBy = String(req.body?.approvedBy || '').trim()
    
    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId is required' })
    }

    const updatedAppointment = await approveAppointment({ appointmentId, approvedBy })
    
    if (!updatedAppointment) {
      return res.status(404).json({ error: 'Appointment not found' })
    }

    res.json({ ok: true, message: 'Appointment approved', appointment: updatedAppointment })
  } catch (error) {
    console.error('Appointment approve error:', error)
    res.status(500).json({ error: 'Failed to approve appointment' })
  }
})

// Reject appointment
app.put('/api/appointments/:appointmentId/reject', async (req, res) => {
  try {
    const appointmentId = String(req.params.appointmentId || '').trim()
    const approvedBy = String(req.body?.approvedBy || '').trim()
    
    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId is required' })
    }

    const updatedAppointment = await rejectAppointment({ appointmentId, approvedBy })
    
    if (!updatedAppointment) {
      return res.status(404).json({ error: 'Appointment not found' })
    }

    res.json({ ok: true, message: 'Appointment rejected', appointment: updatedAppointment })
  } catch (error) {
    console.error('Appointment reject error:', error)
    res.status(500).json({ error: 'Failed to reject appointment' })
  }
})

app.get('/api/favorites', async (req, res) => {
  try {
    const userId = String(req.query.userId || '').trim()
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    const favorites = await listFavoriteHospitalsForUser(userId)
    res.json({ favorites })
  } catch (error) {
    console.error('Favorites fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch favorites' })
  }
})

app.post('/api/favorites', async (req, res) => {
  try {
    const { userId, hospital } = req.body || {}
    if (!userId || !hospital) {
      return res.status(400).json({ error: 'userId and hospital are required' })
    }

    const favorite = await addFavoriteHospital({ userId, hospital })
    res.status(201).json({ favorite })
  } catch (error) {
    console.error('Favorite create error:', error)
    res.status(500).json({ error: 'Failed to save favorite hospital' })
  }
})

app.delete('/api/favorites/:favoriteId', async (req, res) => {
  try {
    const userId = String(req.query.userId || '').trim()
    const favoriteId = String(req.params.favoriteId || '').trim()

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    if (!favoriteId) {
      return res.status(400).json({ error: 'favoriteId is required' })
    }

    const deletedFavorite = await deleteFavoriteHospitalForUser({ userId, favoriteId })

    if (!deletedFavorite) {
      return res.status(404).json({ error: 'Favorite not found' })
    }

    res.json({ ok: true, favorite: deletedFavorite })
  } catch (error) {
    console.error('Favorite delete error:', error)
    res.status(500).json({ error: 'Failed to remove favorite hospital' })
  }
})

const PORT = process.env.PORT || 5001
app.listen(PORT, () => {
  console.log(`Healthcare Hub backend running on port ${PORT}`)
})
