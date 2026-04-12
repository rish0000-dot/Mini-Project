import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.join(__dirname, '..', 'data')
const favoritesPath = path.join(dataDir, 'hospital-favorites.json')
const FAVORITES_TABLE = process.env.SUPABASE_FAVORITES_TABLE || 'hospital_favorites'

let cachedSupabaseClient = null
let hasWarnedMissingSupabaseEnv = false

const getSupabaseClient = () => {
  if (cachedSupabaseClient) return cachedSupabaseClient

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    if (!hasWarnedMissingSupabaseEnv) {
      console.warn('Supabase env missing (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY). Using file-based favorites store.')
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

const makeStableHash = (value = '') => {
  let hash = 0
  const input = String(value)
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0
  }
  return hash.toString(16)
}

const getHospitalKey = (hospital = {}) =>
  String(
    hospital.key ||
      hospital.id ||
      hospital.name ||
      `${hospital.address || 'unknown-address'}-${hospital.distanceText || ''}`,
  )

const ensureStore = async () => {
  await fs.mkdir(dataDir, { recursive: true })
  try {
    await fs.access(favoritesPath)
  } catch {
    await fs.writeFile(favoritesPath, '[]', 'utf8')
  }
}

const readFavorites = async () => {
  await ensureStore()
  const raw = await fs.readFile(favoritesPath, 'utf8')
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeFavorites = async (favorites) => {
  await ensureStore()
  await fs.writeFile(favoritesPath, JSON.stringify(favorites, null, 2), 'utf8')
}

const mapRowToFavorite = (row) => ({
  id: row.id,
  userId: row.user_id,
  hospitalKey: row.hospital_key,
  hospital: row.hospital_data || {},
  createdAt: row.created_at,
})

const listFavoriteHospitalsForUser = async (userId) => {
  const supabaseClient = getSupabaseClient()

  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from(FAVORITES_TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase list favorites failed, falling back to file store:', error.message)
    } else {
      return (data || []).map(mapRowToFavorite)
    }
  }

  const favorites = await readFavorites()
  return favorites
    .filter((favorite) => favorite.userId === userId)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
}

const addFavoriteHospital = async ({ userId, hospital }) => {
  const hospitalKey = getHospitalKey(hospital)
  const favoriteId = `fav-${makeStableHash(`${userId}-${hospitalKey}`)}`
  const createdAt = new Date().toISOString()

  const supabaseClient = getSupabaseClient()

  if (supabaseClient) {
    const row = {
      id: favoriteId,
      user_id: userId,
      hospital_key: hospitalKey,
      hospital_data: hospital,
      created_at: createdAt,
    }

    const { data, error } = await supabaseClient
      .from(FAVORITES_TABLE)
      .upsert(row, { onConflict: 'id' })
      .select('*')
      .single()

    if (error) {
      console.error('Supabase add favorite failed, falling back to file store:', error.message)
    } else {
      return mapRowToFavorite(data)
    }
  }

  const favorites = await readFavorites()
  const index = favorites.findIndex((favorite) => favorite.id === favoriteId)
  const nextFavorite = {
    id: favoriteId,
    userId,
    hospitalKey,
    hospital,
    createdAt,
  }

  if (index === -1) {
    favorites.push(nextFavorite)
  } else {
    favorites[index] = nextFavorite
  }

  await writeFavorites(favorites)
  return nextFavorite
}

const deleteFavoriteHospitalForUser = async ({ userId, favoriteId }) => {
  const supabaseClient = getSupabaseClient()

  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from(FAVORITES_TABLE)
      .delete()
      .eq('id', favoriteId)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle()

    if (error) {
      console.error('Supabase delete favorite failed, falling back to file store:', error.message)
    } else {
      return data ? mapRowToFavorite(data) : null
    }
  }

  const favorites = await readFavorites()
  const index = favorites.findIndex(
    (favorite) => favorite.id === favoriteId && favorite.userId === userId,
  )

  if (index === -1) {
    return null
  }

  const [deletedFavorite] = favorites.splice(index, 1)
  await writeFavorites(favorites)
  return deletedFavorite
}

export { addFavoriteHospital, deleteFavoriteHospitalForUser, listFavoriteHospitalsForUser }