import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { GoogleGenerativeAI } from '@google/generative-ai'
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
import { addAppointment, deleteAppointmentForUser, listAppointmentsForUser } from './utils/appointments-store.js'
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
  res.json({ ok: true, service: 'healthcare-hub-backend', time: new Date().toISOString() })
})

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null
const model = genAI
  ? genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction:
        'You are a basic health assistant. Give only general advice. Do not provide medical diagnosis. Always suggest consulting a doctor for any health concerns or emergencies.',
    })
  : null

app.post('/api/chat', async (req, res) => {
  const { message } = req.body

  try {
    if (!process.env.GEMINI_API_KEY || !model) {
      return res.status(500).json({ error: 'Gemini API key is not configured on the server.' })
    }

    const lastUserMessage = message || 'Hello'
    const result = await model.generateContent(lastUserMessage)
    const response = await result.response
    const text = response.text()

    res.json({ reply: text })
  } catch (error) {
    console.error('Gemini API Error details:', error)
    res.status(500).json({
      message: 'AI service error',
      details: error.message,
      reply: "I'm having trouble thinking right now. Please try again.",
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
    await addAppointment(appointment)
    res.status(201).json({ appointment })
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
