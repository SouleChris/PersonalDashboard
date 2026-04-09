/*
  Author: Christopher Soule
  Date: 04/08/2026
  Recipe detail page — full view of a single recipe
*/

import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import styles from "../styles/recipes.module.css"
import LoadingSpinner from "../components/loadSpinner"

export default function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/recipes/${id}`)
        if (!res.ok) throw new Error("Recipe not found")
        const data = await res.json()
        setRecipe(data)
      } catch (err) {
        console.error(err)
        setError("Failed to load recipe")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) return <div className={styles.container}><LoadingSpinner text="Loading recipe..." /></div>
  if (error) return <div className={styles.container}><p style={{ color: "#e57373", padding: "2rem" }}>{error}</p></div>
  if (!recipe) return null

  const ingredients = recipe.ingredients?.split("\n").filter(Boolean) ?? []
  const instructions = recipe.instructions?.split("\n").filter(Boolean) ?? []
  const pairings = recipe.pairings?.split(",").map(s => s.trim()).filter(Boolean) ?? []
  const items = recipe.items_needed?.split(",").map(s => s.trim()).filter(Boolean) ?? []

  return (
    <div className={styles.detailContainer}>
      <button className={styles.backButton} onClick={() => navigate("/recipes")}>
        ← Back to Recipes
      </button>

      {recipe.image_url && (
        <img src={recipe.image_url} alt={recipe.name} className={styles.detailImg} />
      )}

      <div className={styles.detailHeader}>
        <div className={styles.detailMeta}>
          {recipe.category && <span className={styles.categoryBadge}>{recipe.category}</span>}
          {recipe.culture && <span className={styles.cultureBadge}>{recipe.culture}</span>}
          {recipe.meal_type && <span className={styles.mealBadge}>{recipe.meal_type}</span>}
        </div>
        <h1 className={styles.detailTitle}>{recipe.name}</h1>

        {/* Pairings right below title */}
        {pairings.length > 0 && (
          <div className={styles.pairingRow}>
            <span className={styles.pairingRowLabel}>🍷 Pairs with</span>
            <div className={styles.pairingList}>
              {pairings.map((p, i) => (
                <span key={i} className={styles.pairingTag}>{p}</span>
              ))}
            </div>
          </div>
        )}

        <div className={styles.detailStats}>
          {recipe.cook_time && (
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Cook Time</span>
              <span className={styles.statVal}>{recipe.cook_time} min</span>
            </div>
          )}
          {recipe.price && (
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Est. Price</span>
              <span className={styles.statVal}>${parseFloat(recipe.price).toFixed(2)}</span>
            </div>
          )}
          {recipe.time_of_year && (
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Best Season</span>
              <span className={styles.statVal}>{recipe.time_of_year}</span>
            </div>
          )}

          {/* Servings  */}
          {recipe.servings && (
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Servings</span>
            <span className={styles.statVal}>{recipe.servings}</span>
          </div>
)}
        </div>

        
      </div>

      <div className={styles.detailGrid}>
        {ingredients.length > 0 && (
          <div className={styles.detailSection}>
            <h2 className={styles.detailSectionTitle}>Ingredients</h2>
            <ul className={styles.ingredientList}>
              {ingredients.map((ing, i) => (
                <li key={i} className={styles.ingredientItem}>{ing}</li>
              ))}
            </ul>
          </div>
        )}

        {items.length > 0 && (
          <div className={styles.detailSection}>
            <h2 className={styles.detailSectionTitle}>Equipment Needed</h2>
            <ul className={styles.ingredientList}>
              {items.map((item, i) => (
                <li key={i} className={styles.ingredientItem}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {instructions.length > 0 && (
        <div className={styles.detailSection}>
          <h2 className={styles.detailSectionTitle}>Instructions</h2>
          <ol className={styles.instructionList}>
            {instructions.map((step, i) => (
              <li key={i} className={styles.instructionItem}>
                <span className={styles.stepNum}>{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Description at the bottom */}
      {recipe.description && (
        <div className={styles.detailSection}>
          <h2 className={styles.detailSectionTitle}>About this dish</h2>
          <p className={styles.detailDesc}>{recipe.description}</p>
        </div>
      )}
    </div>
  )
}