/*
  Author: Christopher Soule
  Date: 04/08/2026
  Recipe page — browse, filter, add, and view detailed recipes
  Uses Supabase via backend endpoints for persistent storage
*/

import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import styles from "../styles/recipes.module.css"
import LoadingSpinner from "../components/loadSpinner"

const CATEGORIES = ["All", "Soup", "Salad", "Sandwich", "Chicken", "Beef", "Pork", "Other"]
const MEAL_TYPES = ["All Meals", "Breakfast", "Lunch", "Dinner"]
const SORT_OPTIONS = [
  { value: "post_date", label: "Newest" },
  { value: "culture", label: "Culture" },
  { value: "time_of_year", label: "Season" },
]

const EMPTY_FORM = {
  name: "", blurb: "", description: "", culture: "", category: "Other",
  meal_type: "Dinner", image_url: "", cook_time: "", servings: "", price: "",
  time_of_year: "", ingredients: "", instructions: "", pairings: "", items_needed: "",
}

export default function Recipes() {
  const [randomMeal, setRandomMeal] = useState(null)
  const [randomMealType, setRandomMealType] = useState("Any")
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [category, setCategory] = useState("All")
  const [mealType, setMealType] = useState("All Meals")
  const [sortBy, setSortBy] = useState("post_date")
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [uploading, setUploading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/recipes")
        if (!res.ok) throw new Error("Failed to load recipes")
        const data = await res.json()
        setRecipes(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error(err)
        setError("Failed to load recipes")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    let base = [...recipes]
    if (category !== "All") base = base.filter(r => r.category === category)
    if (mealType !== "All Meals") base = base.filter(r => r.meal_type === mealType)
    if (search.trim()) {
      const q = search.toLowerCase()
      base = base.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        r.culture?.toLowerCase().includes(q) ||
        r.blurb?.toLowerCase().includes(q)
      )
    }
    base.sort((a, b) => {
      if (sortBy === "post_date") return new Date(b.created_at) - new Date(a.created_at)
      if (sortBy === "culture") return (a.culture ?? "").localeCompare(b.culture ?? "")
      if (sortBy === "time_of_year") return (a.time_of_year ?? "").localeCompare(b.time_of_year ?? "")
      return 0
    })
    return base
  }, [recipes, category, mealType, sortBy, search])

  const handleSubmit = async () => {
    if (!form.name) return
    setActionError(null)
    const payload = { ...form, cook_time: form.cook_time || null, price: form.price || null }
    try {
      if (editingId) {
        const res = await fetch(`/recipes/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
        if (!res.ok) throw new Error("Failed to update recipe")
        const updated = await res.json()
        setRecipes(prev => prev.map(r => r.id === editingId ? updated : r))
      } else {
        const res = await fetch("/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
        if (!res.ok) throw new Error("Failed to add recipe")
        const saved = await res.json()
        setRecipes(prev => [saved, ...prev])
      }
      setForm(EMPTY_FORM)
      setShowForm(false)
      setEditingId(null)
    } catch (err) {
      console.error(err)
      setActionError(err.message)
    }
  }

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm("Delete this recipe?")) return
    setActionError(null)
    try {
      const res = await fetch(`/recipes/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete recipe")
      setRecipes(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      console.error(err)
      setActionError(err.message)
    }
  }

  const handleEdit = (recipe, e) => {
    e.stopPropagation()
    setEditingId(recipe.id)
    setForm({ ...EMPTY_FORM, ...recipe })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append("image", file)
    try {
      const res = await fetch("/recipes/upload-image", { method: "POST", body: formData })
      const data = await res.json()
      if (data.url) setForm(f => ({ ...f, image_url: data.url }))
    } catch (err) {
      console.error("Upload failed:", err)
    } finally {
      setUploading(false)
    }
  }

    const pickRandom = (mealFilter) => {
        let pool = [...recipes]
            if (mealFilter && mealFilter !== "Any") {
                pool = pool.filter(r => r.meal_type === mealFilter)
            }
            if (pool.length === 0) return
            const pick = pool[Math.floor(Math.random() * pool.length)]
        setRandomMeal(pick)
     }

  const cancelForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setActionError(null)
  }

  if (loading) return <div className={styles.container}><LoadingSpinner text="Loading recipes..." /></div>
  if (error) return <div className={styles.container}><p style={{ color: "#e57373", padding: "2rem" }}>{error}</p></div>

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Recipes</h1>
          <p className={styles.subtitle}>{recipes.length} recipes collected</p>
        </div>
        <button className={styles.addButton} onClick={() => { cancelForm(); setShowForm(s => !s) }}>
          {showForm && !editingId ? "Cancel" : "+ Add Recipe"}
        </button>
      </div>

      <div className={styles.randomSection}>
  <p className={styles.randomLabel}>Not sure what to cook?</p>
  <div className={styles.randomControls}>
    {["Any", "Breakfast", "Lunch", "Dinner"].map(m => (
      <button
        key={m}
        onClick={() => setRandomMealType(m)}
        className={randomMealType === m ? styles.filterActive : styles.filter}
      >
        {m}
      </button>
    ))}
    <button className={styles.randomButton} onClick={() => pickRandom(randomMealType)}>
      Pick for me
    </button>
  </div>
</div>

        {randomMeal && (
        <div className={styles.randomOverlay} onClick={() => setRandomMeal(null)}>
            <div className={styles.randomModal} onClick={e => e.stopPropagation()}>
            <button className={styles.randomClose} onClick={() => setRandomMeal(null)}>✕</button>
            <p className={styles.randomModalLabel}>Tonight you're making</p>
            {randomMeal.image_url && (
                <img src={randomMeal.image_url} alt={randomMeal.name} className={styles.randomModalImg} />
            )}
            <h2 className={styles.randomModalName}>{randomMeal.name}</h2>
            <div className={styles.cardMeta} style={{ justifyContent: "center", marginBottom: "0.75rem" }}>
                {randomMeal.category && <span className={styles.categoryBadge}>{randomMeal.category}</span>}
                {randomMeal.culture && <span className={styles.cultureBadge}>{randomMeal.culture}</span>}
                {randomMeal.meal_type && <span className={styles.mealBadge}>{randomMeal.meal_type}</span>}
            </div>
            {randomMeal.blurb && <p className={styles.randomModalBlurb}>{randomMeal.blurb}</p>}
            <div className={styles.randomModalStats}>
                {randomMeal.cook_time && <span>⏱ {randomMeal.cook_time} min</span>}
                {randomMeal.servings && <span>🍽 {randomMeal.servings} servings</span>}
                {randomMeal.price && <span>💰 ~${parseFloat(randomMeal.price).toFixed(2)}</span>}
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "1.25rem" }}>
                <button className={styles.submitButton} onClick={() => { setRandomMeal(null); navigate(`/recipes/${randomMeal.id}`) }}>
                See Recipe
                </button>
                <button className={styles.cancelButton} onClick={() => pickRandom(randomMealType)}>
                Pick Again
                </button>
            </div>
            </div>
        </div>
        )}

      {actionError && (
        <div className={styles.errorBanner}>
          <p>{actionError}</p>
          <button onClick={() => setActionError(null)}>✕</button>
        </div>
      )}

      {showForm && (
        <div className={styles.form}>
          <h3 className={styles.formTitle}>{editingId ? "Edit Recipe" : "Add Recipe"}</h3>

          {/* Section: Basic Info */}
          <p className={styles.formSectionLabel}>Basic Info</p>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Name *</label>
              <input className={styles.input} placeholder="e.g. French Onion Soup" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Category</label>
              <select className={styles.input} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.filter(c => c !== "All").map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Meal Type</label>
              <select className={styles.input} value={form.meal_type} onChange={e => setForm(f => ({ ...f, meal_type: e.target.value }))}>
                {MEAL_TYPES.filter(m => m !== "All Meals").map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Culture / Origin</label>
              <input className={styles.input} placeholder="e.g. French" value={form.culture} onChange={e => setForm(f => ({ ...f, culture: e.target.value }))} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Cook Time (min)</label>
              <input className={styles.input} type="number" placeholder="45" value={form.cook_time} onChange={e => setForm(f => ({ ...f, cook_time: e.target.value }))} />
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>Servings</label>
                <input className={styles.input} type="number" placeholder="4" value={form.servings} onChange={e => setForm(f => ({ ...f, servings: e.target.value }))} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Estimated Price ($)</label>
              <input className={styles.input} type="number" placeholder="15.00" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Best Time of Year</label>
              <input className={styles.input} placeholder="e.g. Winter, All year" value={form.time_of_year} onChange={e => setForm(f => ({ ...f, time_of_year: e.target.value }))} />
            </div>
          </div>

          {/* Section: Photo */}
          <p className={styles.formSectionLabel}>Photo</p>
          <div className={styles.formGroup} style={{ marginBottom: "1.25rem" }}>
            <label className={styles.label}>Upload Image</label>
            <div className={styles.fileInputWrapper}>
              <label className={styles.fileInputLabel}>
                {uploading ? "Uploading..." : form.image_url ? "Change Photo" : "Choose Photo"}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageUpload} disabled={uploading} />
              </label>
              {form.image_url && <span className={styles.fileInputName}>✓ Photo uploaded</span>}
            </div>
            {form.image_url && (
              <img src={form.image_url} alt="Preview" className={styles.imagePreview} />
            )}
          </div>

          {/* Section: Content */}
          <p className={styles.formSectionLabel}>Content</p>
          <div className={styles.formGroup} style={{ marginBottom: "0.75rem" }}>
            <label className={styles.label}>Card Blurb <span style={{ color: "#bbb", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(shown on card only, not on recipe page)</span></label>
            <input className={styles.input} placeholder="A short teaser shown on the card..." value={form.blurb} onChange={e => setForm(f => ({ ...f, blurb: e.target.value }))} />
          </div>
          <div className={styles.formGroup} style={{ marginBottom: "0.75rem" }}>
            <label className={styles.label}>Drink Pairings</label>
            <input className={styles.input} placeholder="e.g. Burgundy wine, sparkling water" value={form.pairings} onChange={e => setForm(f => ({ ...f, pairings: e.target.value }))} />
          </div>
          <div className={styles.formGroup} style={{ marginBottom: "0.75rem" }}>
            <label className={styles.label}>Ingredients <span style={{ color: "#bbb", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(one per line)</span></label>
            <textarea className={styles.textarea} placeholder={"2 cups flour\n1 tsp salt\n..."} value={form.ingredients} onChange={e => setForm(f => ({ ...f, ingredients: e.target.value }))} rows={5} />
          </div>
          <div className={styles.formGroup} style={{ marginBottom: "0.75rem" }}>
            <label className={styles.label}>Items / Equipment Needed</label>
            <input className={styles.input} placeholder="e.g. Dutch oven, whisk, baking sheet" value={form.items_needed} onChange={e => setForm(f => ({ ...f, items_needed: e.target.value }))} />
          </div>
          <div className={styles.formGroup} style={{ marginBottom: "0.75rem" }}>
            <label className={styles.label}>Instructions</label>
            <textarea className={styles.textarea} placeholder="Step by step instructions..." value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} rows={6} />
          </div>
          <div className={styles.formGroup} style={{ marginBottom: "1.25rem" }}>
            <label className={styles.label}>Description <span style={{ color: "#bbb", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(shown at bottom of recipe page)</span></label>
            <textarea className={styles.textarea} placeholder="Full description, history, notes..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} />
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className={styles.submitButton} onClick={handleSubmit}>
              {editingId ? "Save Changes" : "Add Recipe"}
            </button>
            <button className={styles.cancelButton} onClick={cancelForm}>Cancel</button>
          </div>
        </div>
      )}

      <div className={styles.controls}>
        <input
          className={styles.search}
          placeholder="Search recipes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={styles.filterRow}>
          <span className={styles.sortLabel}>Category</span>
          <div className={styles.filters}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)} className={category === c ? styles.filterActive : styles.filter}>{c}</button>
            ))}
          </div>
        </div>
        <div className={styles.filterRow}>
          <span className={styles.sortLabel}>Meal</span>
          <div className={styles.filters}>
            {MEAL_TYPES.map(m => (
              <button key={m} onClick={() => setMealType(m)} className={mealType === m ? styles.filterActive : styles.filter}>{m}</button>
            ))}
          </div>
        </div>
            {/* 
            
                    <div className={styles.sortRow}>
          <span className={styles.sortLabel}>Sort by</span>
          {SORT_OPTIONS.map(o => (
            <button key={o.value} onClick={() => setSortBy(o.value)} className={sortBy === o.value ? styles.filterActive : styles.filter}>{o.label}</button>
          ))}
        </div>
            

            */}
       
      </div>

      {filtered.length === 0 && (
        <p className={styles.empty}>No recipes found. Add one above!</p>
      )}

      <div className={styles.grid}>
        {filtered.map(recipe => (
          <div key={recipe.id} className={styles.card} onClick={() => navigate(`/recipes/${recipe.id}`)}>
            {recipe.image_url ? (
              <img src={recipe.image_url} alt={recipe.name} className={styles.cardImg} />
            ) : (
              <div className={styles.cardImgPlaceholder}>Add Image</div>
            )}
            <div className={styles.cardBody}>
              <div className={styles.cardMeta}>
                {recipe.category && <span className={styles.categoryBadge}>{recipe.category}</span>}
                {recipe.culture && <span className={styles.cultureBadge}>{recipe.culture}</span>}
                {recipe.meal_type && <span className={styles.mealBadge}>{recipe.meal_type}</span>}
              </div>
              <h2 className={styles.cardName}>{recipe.name}</h2>
              {recipe.blurb && <p className={styles.cardDesc}>{recipe.blurb}</p>}
              <div className={styles.cardStats}>
                {recipe.cook_time && <span>Time: {recipe.cook_time} min</span>}
                {recipe.price && <span>Cost: ${parseFloat(recipe.price).toFixed(2)}</span>}
                {recipe.time_of_year && <span>📅 {recipe.time_of_year}</span>}
              </div>
            </div>
            <div className={styles.cardActions}>
              <button className={styles.editButton} onClick={e => handleEdit(recipe, e)}>Edit</button>
              <button className={styles.deleteButton} onClick={e => handleDelete(recipe.id, e)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}