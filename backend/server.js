require("dotenv").config();
const express = require("express")
const cors = require("cors")
const axios = require("axios")
const app = express()
const PORT = 3000

const STEAM_ID = process.env.STEAM_ID
const API_KEY = process.env.LEETIFY_API_KEY
const { createClient } = require("@supabase/supabase-js")
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

const multer = require("multer")
const upload = multer({ storage: multer.memoryStorage() })

console.log("Supabase URL:", process.env.SUPABASE_URL)
console.log("Supabase Key:", process.env.SUPABASE_KEY?.slice(0, 20))

app.use(cors())
app.use(express.json())

// warm up Supabase connection on server start
supabase.from("accounts").select("count").then(() => {
  console.log("Supabase connection ready")
}).catch(() => {
  console.log("Supabase warmup failed - will retry on first request")
})


// ===================== Recipes =====================

app.post("/recipes/upload-image", upload.single("image"), async (req, res) => {
  try {
    const file = req.file
    const fileName = `${Date.now()}-${file.originalname.replace(/\s/g, "_")}`
    const { data, error } = await supabase.storage
      .from("recipe-images")
      .upload(fileName, file.buffer, { contentType: file.mimetype })
    if (error) return res.status(500).json({ error: error.message })
    const { data: urlData } = supabase.storage
      .from("recipe-images")
      .getPublicUrl(fileName)
    res.json({ url: urlData.publicUrl })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})


app.get("/recipes", async (req, res) => {
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.get("/recipes/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", req.params.id)
    .single()
  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: "Recipe not found" })
  res.json(data)
})

app.post("/recipes", async (req, res) => {
  const { name, description, culture, category, image_url, cook_time,
        price, time_of_year, servings, ingredients, instructions,
        pairings, items_needed, blurb, meal_type } = req.body = req.body
  const { data, error } = await supabase
    .from("recipes")
    .insert([{ name, description, culture, category, image_url, cook_time, price, time_of_year, ingredients, instructions, pairings, items_needed }])
    .select()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data[0])
})

app.patch("/recipes/:id", async (req, res) => {
  const { name, description, culture, category, image_url, cook_time,
        price, time_of_year, servings, ingredients, instructions,
        pairings, items_needed, blurb, meal_type } = req.body = req.body
  const { data, error } = await supabase
    .from("recipes")
    .update({ name, description, culture, category, image_url, cook_time, price, time_of_year, ingredients, instructions, pairings, items_needed })
    .eq("id", req.params.id)
    .select()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data[0])
})

app.delete("/recipes/:id", async (req, res) => {
  const { error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})


app.post("/recipes/upload-image", upload.single("image"), async (req, res) => {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ error: "No file provided" })
    const fileName = `${Date.now()}-${file.originalname.replace(/\s/g, "_")}`
    const { data, error } = await supabase.storage
      .from("recipe-images")
      .upload(fileName, file.buffer, { contentType: file.mimetype })
    if (error) return res.status(500).json({ error: error.message })
    const { data: urlData } = supabase.storage
      .from("recipe-images")
      .getPublicUrl(fileName)
    res.json({ url: urlData.publicUrl })
  } catch (err) {
    console.error("Upload error:", err)
    res.status(500).json({ error: err.message })
  }
})

// ===================== End Recipes =====================


// ===================== Workouts =====================
app.get("/workouts", async (req, res) => {
  const { data, error } = await supabase.from("workouts").select("*").order("date", { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.post("/workouts", async (req, res) => {
  const { id, date, type, duration, distance, pace, calories, notes, muscle_groups, source } = req.body
  const { data, error } = await supabase.from("workouts").insert([{ id, date, type, duration, distance, pace, calories, notes, muscle_groups, source }]).select()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data[0])
})

app.patch("/workouts/:id", async (req, res) => {
  const { date, type, duration, distance, pace, calories, notes, muscle_groups } = req.body
  const { data, error } = await supabase.from("workouts").update({ date, type, duration, distance, pace, calories, notes, muscle_groups }).eq("id", req.params.id).select()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data[0])
})

app.delete("/workouts/:id", async (req, res) => {
  // Delete exercises first to avoid orphaned rows (also handled by ON DELETE CASCADE in Supabase if configured)
  const { error: exError } = await supabase.from("workout_exercises").delete().eq("workout_id", req.params.id)
  if (exError) return res.status(500).json({ error: exError.message })

  const { error } = await supabase.from("workouts").delete().eq("id", req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

app.get("/workouts/exercises/:workoutId", async (req, res) => {
  const { data, error } = await supabase.from("workout_exercises").select("*").eq("workout_id", req.params.workoutId)
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.post("/workouts/exercises", async (req, res) => {
  const { id, workout_id, name, sets, reps, weight } = req.body
  const { data, error } = await supabase.from("workout_exercises").insert([{ id, workout_id, name, sets, reps, weight }]).select()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data[0])
})

app.delete("/workouts/exercises/:id", async (req, res) => {
  const { error } = await supabase.from("workout_exercises").delete().eq("id", req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})
// ===================== End Workouts =====================

// ===================== Steam CS2 Inventory endpoint (NOT IN USE) =====================
/*
let cachedSteamInventory = null
let lastFetchedSteamInventory = null

app.get("/steam/inventory", async (req, res) => {
  if (cachedSteamInventory && lastFetchedSteamInventory && (Date.now() - lastFetchedSteamInventory) < 30 * 60 * 1000) {
    return res.json(cachedSteamInventory)
  }
  try {
    const STEAM_ID = process.env.STEAM_ID
    const response = await axios.get(
      `https://steamcommunity.com/inventory/${STEAM_ID}/730/2?l=english&count=5000`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    )
    cachedSteamInventory = response.data
    lastFetchedSteamInventory = Date.now()
    res.json(cachedSteamInventory)
    console.log("Steam inventory:", JSON.stringify(response.data).slice(0, 2000))
  } catch (error) {
    console.error(error.response?.status, error.response?.data || error.message)
    res.status(500).json({ error: error.response?.data || error.message })
  }
})
*/
// ===================== End Steam CS2 Inventory endpoint =================

// ===================== Finance - Accounts =====================
app.get("/finance/accounts", async (req, res) => {
  const { data, error } = await supabase.from("accounts").select("*").order("created_at", { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.post("/finance/accounts", async (req, res) => {
  const { id, name, type, balance } = req.body
  const { data, error } = await supabase.from("accounts").insert([{ id, name, type, balance }]).select()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data[0])
})

app.patch("/finance/accounts/:id", async (req, res) => {
  const { name, type, balance } = req.body
  const { data, error } = await supabase.from("accounts").update({ name, type, balance }).eq("id", req.params.id).select()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data[0])
})

app.delete("/finance/accounts/:id", async (req, res) => {
  // Delete transactions for this account first to avoid orphaned rows
  const { error: txError } = await supabase.from("transactions").delete().eq("account_id", req.params.id)
  if (txError) return res.status(500).json({ error: txError.message })
  const { error } = await supabase.from("accounts").delete().eq("id", req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})
// ===================== End Finance - Accounts =====================

// ===================== Finance - Transactions =====================
app.get("/finance/transactions", async (req, res) => {
  const { data, error } = await supabase.from("transactions").select("*").order("date", { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.post("/finance/transactions", async (req, res) => {
  const { id, account_id, business, amount, date, notes, needs_venmo, was_venmoed, category, tx_type } = req.body
  const { data, error } = await supabase.from("transactions").insert([{ id, account_id, business, amount, date, notes, needs_venmo, was_venmoed, category, tx_type }]).select()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data[0])
})

app.patch("/finance/transactions/:id", async (req, res) => {
  const { account_id, business, amount, date, notes, needs_venmo, was_venmoed, category, tx_type } = req.body
  const { data, error } = await supabase.from("transactions").update({ account_id, business, amount, date, notes, needs_venmo, was_venmoed, category, tx_type }).eq("id", req.params.id).select()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data[0])
})

app.delete("/finance/transactions/:id", async (req, res) => {
  const { error } = await supabase.from("transactions").delete().eq("id", req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})
// ===================== End Finance - Transactions =====================

// ===================== Finance - Subscriptions =====================
app.get("/finance/subscriptions", async (req, res) => {
  const { data, error } = await supabase.from("subscriptions").select("*").order("created_at", { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.post("/finance/subscriptions", async (req, res) => {
  const { id, name, cost, cycle, next_date, category, notes } = req.body
  const { data, error } = await supabase.from("subscriptions").insert([{ id, name, cost, cycle, next_date, category, notes }]).select()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data[0])
})

app.patch("/finance/subscriptions/:id", async (req, res) => {
  const { name, cost, cycle, next_date, category, notes } = req.body
  const { data, error } = await supabase.from("subscriptions").update({ name, cost, cycle, next_date, category, notes }).eq("id", req.params.id).select()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data[0])
})

app.delete("/finance/subscriptions/:id", async (req, res) => {
  const { error } = await supabase.from("subscriptions").delete().eq("id", req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})
// ===================== End Finance - Subscriptions =====================

// ===================== Finance - Budgets =====================
app.get("/finance/budgets", async (req, res) => {
  const { data, error } = await supabase.from("budgets").select("*")
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.post("/finance/budgets", async (req, res) => {
  const { id, amount } = req.body
  const { data, error } = await supabase.from("budgets").upsert([{ id, amount }]).select()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data[0])
})
// ===================== End Finance - Budgets =====================


// ===================== CSFloat Inventory endpoint =====================
/* 
let cachedInventory = null
let lastFetchedInventory = null

app.get("/csfloat/inventory", async (req, res) => {
  if (cachedInventory && lastFetchedInventory && (Date.now() - lastFetchedInventory) < 30 * 60 * 1000) {
    return res.json(cachedInventory)
  }
  try {
    const response = await axios.get("https://csfloat.com/api/v1/me/inventory", {
      headers: { Authorization: process.env.CSFLOAT_API_KEY }
    })
    cachedInventory = response.data
    lastFetchedInventory = Date.now()
    res.json(cachedInventory)
  } catch (error) {
    console.error(error.response?.status, error.response?.data || error.message)
    res.status(500).json({ error: error.response?.data || error.message })
  }
})
*/
// ===================== End CSFloat Inventory endpoint =================

// ================   Yahoo Stock endpoint.  ============================
app.get("/stock/:symbol", async (req, res) => {
  const { symbol } = req.params
  try {
    const response = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
      {
        headers: { "User-Agent": "Mozilla/5.0" }
      }
    )
    res.json(response.data)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stock data" })
  }
})
// ====================== End of Yahoo Stock Endpoint ====================

// =====================   Leetify API endpoint ==========================
let cachedData = null
let lastFetched = null

app.get("/leetify", async (req, res) => {
  if (cachedData && lastFetched && (Date.now() - lastFetched) < 5 * 60 * 1000) {
    return res.json(cachedData)
  }
  try {
    const response = await axios.get(
      `https://api-public.cs-prod.leetify.com/v3/profile`,
      {
        params: { steam64_id: STEAM_ID },
        headers: {
          "X-Api-Key": API_KEY,
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0"
        }
      }
    )
    cachedData = response.data
    lastFetched = Date.now()
    res.json(cachedData)
  } catch (error) {
    console.error(error.response?.status, error.response?.data || error.message)
    res.status(500).json({ error: error.response?.data || error.message })
  }
})
// =====================   End of Leetify API endpoint =================================

// =====================   Start of Leetify Matches API endpoint =================================
let cachedMatches = null
let lastFetchedMatches = null

app.get("/leetify/matches", async (req, res) => {
  if (cachedMatches && lastFetchedMatches && (Date.now() - lastFetchedMatches) < 5 * 60 * 1000) {
    return res.json(cachedMatches)
  }
  try {
    const response = await axios.get(
      `https://api-public.cs-prod.leetify.com/v3/profile/matches`,
      {
        params: { steam64_id: STEAM_ID },
        headers: {
          "X-Api-Key": API_KEY,
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0"
        }
      }
    )
    cachedMatches = response.data
    lastFetchedMatches = Date.now()
    res.json(cachedMatches)
  } catch (error) {
    console.error(error.response?.status, error.response?.data || error.message)
    res.status(500).json({ error: error.response?.data || error.message })
  }
})
// =====================   End of Leetify Matches API endpoint =================================


// ===================== Wishlist endpoints =====================
app.get("/wishlist/:category", async (req, res) => {
  console.log("Hitting wishlist endpoint, category:", req.params.category)
  console.log("Supabase URL:", process.env.SUPABASE_URL)
  const { category } = req.params
  const { data, error } = await supabase
    .from("wishlist")
    .select("*")
    .eq("category", category)
    .order("created_at", { ascending: false })
  console.log("Supabase data:", data, "error:", error)
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.post("/wishlist", async (req, res) => {
  const { category, name, brand, price, image_url, link, notes } = req.body
  const { data, error } = await supabase
    .from("wishlist")
    .insert([{ category, name, brand, price, image_url, link, notes }])
    .select()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data[0])
})

app.delete("/wishlist/:id", async (req, res) => {
  const { error } = await supabase
    .from("wishlist")
    .delete()
    .eq("id", req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})
// ===================== End Wishlist endpoints =====================

// ===================== Matches sync endpoint =====================
app.post("/matches/sync", async (req, res) => {
  try {
    const response = await axios.get(
      "https://api-public.cs-prod.leetify.com/v3/profile/matches",
      {
        params: { steam64_id: STEAM_ID },
        headers: {
          "X-Api-Key": API_KEY,
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0"
        }
      }
    )
    const matches = response.data
    const toInsert = matches.map(m => ({
      id: m.id,
      finished_at: m.finished_at,
      map_name: m.map_name,
      data_source: m.data_source,
      replay_url: m.replay_url,
      team_scores: m.team_scores,
      stats: m.stats
    }))
    const { error } = await supabase
      .from("matches")
      .upsert(toInsert, { onConflict: "id" })
    if (error) return res.status(500).json({ error: error.message })
    res.json({ synced: toInsert.length })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get("/matches/all", async (req, res) => {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .order("finished_at", { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})
// ===================== End Matches sync endpoint =====================

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})