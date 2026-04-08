/*
Author: Christopher Soule
Date: 03/25/2026
Workout tracking page with calendar, today, summary, stats, and food tabs
Uses Supabase via backend endpoints for persistent storage
STRAVA MIGRATION: See comments marked STRAVA to add Strava API later
*/
import { useState, useEffect, useMemo } from "react"
import styles from "../styles/workout.module.css"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import LoadingSpinner from "../components/loadSpinner"

const WORKOUT_TYPES = ["Run", "Lift", "Hike", "Other"]
const MUSCLE_GROUPS = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Full Body"]
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

const EMPTY_WORKOUT_FORM = {
  type: "Run", date: new Date().toISOString().split("T")[0],
  duration: "", distance: "", pace: "", calories: "", notes: "",
  muscle_groups: [], completed: false
}

const EMPTY_EXERCISE = { name: "", sets: "", reps: "", weight: "" }

// User stats for calorie calculation
const WEIGHT_KG = 77.1  // 170 lbs
const HEIGHT_CM = 177.8 // 5'10"
const AGE = 23

const getMET = (type, form) => {
  if (type === "Run") {
    const pace = form.pace ? parseFloat(form.pace.split(":")[0]) + parseFloat(form.pace.split(":")[1] || 0) / 60 : null
    if (pace) {
      if (pace < 7) return 14.5   // < 7 min/mile, fast run
      if (pace < 8) return 12.5   // 7-8 min/mile
      if (pace < 9) return 11.0   // 8-9 min/mile
      if (pace < 10) return 9.8   // 9-10 min/mile
      if (pace < 12) return 8.3   // 10-12 min/mile, jog
      return 6.0                   // 12+ min/mile, slow jog/walk
    }
    if (form.distance) return 9.8
    return 8.0
  }
  if (type === "Lift") {
    const duration = parseInt(form.duration) || 0
    if (duration > 75) return 6.0  // long heavy session
    if (duration > 45) return 5.0  // moderate session
    return 3.5                      // shorter/lighter session
  }
  if (type === "Hike") return 6.0  // moderate hiking MET
  return 4.5                        // general moderate exercise
}

const calcCalories = (type, form) => {
  const duration = parseInt(form.duration) || 0
  if (!duration) return 0
  const met = getMET(type, form)
  return Math.round(met * WEIGHT_KG * (duration / 60))
}

const FOOD_DATA = {
  Run: {
    before: [
      { name: "Banana", timing: "30-60 min before", why: "Quick carbs for energy, easy to digest" },
      { name: "Oatmeal with honey", timing: "1-2 hrs before", why: "Sustained energy, complex carbs" },
      { name: "Toast with peanut butter", timing: "1-2 hrs before", why: "Carbs + protein balance" },
      { name: "Energy gel or chews", timing: "15 min before long runs", why: "Fast acting carbs" },
    ],
    after: [
      { name: "Chocolate milk", timing: "Within 30 min", why: "Perfect carb to protein ratio for recovery" },
      { name: "Greek yogurt with berries", timing: "Within 1 hr", why: "Protein for muscle repair, antioxidants" },
      { name: "Grilled chicken with rice", timing: "Within 2 hrs", why: "Lean protein + carb replenishment" },
      { name: "Protein smoothie", timing: "Within 30 min", why: "Fast protein absorption" },
    ],
    water: { during: "6-8 oz every 20 min", daily: "Half your body weight in oz + 16 oz per mile run" }
  },
  Lift: {
    before: [
      { name: "Chicken and rice", timing: "1-2 hrs before", why: "Protein to protect muscle, carbs for energy" },
      { name: "Pre-workout shake", timing: "30 min before", why: "Fast protein + carbs" },
      { name: "Greek yogurt with granola", timing: "1 hr before", why: "Protein + sustained carbs" },
      { name: "Eggs on toast", timing: "1-2 hrs before", why: "High quality protein + carbs" },
    ],
    after: [
      { name: "Protein shake", timing: "Within 30 min", why: "Fast protein to start muscle repair" },
      { name: "Salmon with sweet potato", timing: "Within 2 hrs", why: "Omega-3s reduce inflammation, complex carbs" },
      { name: "Cottage cheese", timing: "Before bed on lift days", why: "Casein protein for overnight recovery" },
      { name: "Steak and potatoes", timing: "Within 2 hrs", why: "High protein + carb replenishment" },
    ],
    water: { during: "1 cup every 15-20 min", daily: "Half your body weight in oz + 24 oz per hour lifted" }
  },
  Hike: {
    before: [
      { name: "Trail mix", timing: "30 min before", why: "Sustained energy from nuts and dried fruit" },
      { name: "Peanut butter sandwich", timing: "1 hr before", why: "Protein + carbs for long sustained effort" },
      { name: "Oatmeal", timing: "1-2 hrs before", why: "Slow burning energy" },
    ],
    after: [
      { name: "Nuts and fruit", timing: "Within 30 min", why: "Quick replenishment on the trail" },
      { name: "Chicken wrap", timing: "Within 2 hrs", why: "Protein + carbs for recovery" },
      { name: "Hummus and veggies", timing: "Within 1 hr", why: "Protein + electrolytes" },
    ],
    water: { during: "16-24 oz per hour", daily: "Half your body weight in oz + 24 oz per hour hiked" }
  },
  Other: {
    before: [
      { name: "Banana", timing: "30 min before", why: "Quick energy" },
      { name: "Light snack", timing: "1 hr before", why: "Fuel without feeling heavy" },
    ],
    after: [
      { name: "Protein shake", timing: "Within 30 min", why: "Recovery protein" },
      { name: "Balanced meal", timing: "Within 2 hrs", why: "Replenish energy stores" },
    ],
    water: { during: "6-8 oz every 20 min", daily: "Half your body weight in oz" }
  }
}

export default function Workout() {
  const [view, setView] = useState("today")
  const [workouts, setWorkouts] = useState([])
  const [exercises, setExercises] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const today = new Date()
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth())
  const [calendarYear, setCalendarYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedWorkout, setSelectedWorkout] = useState(null)

  const [showForm, setShowForm] = useState(false)
  const [editingWorkout, setEditingWorkout] = useState(null)
  const [workoutForm, setWorkoutForm] = useState(EMPTY_WORKOUT_FORM)
  const [exercises_form, setExercisesForm] = useState([])

  const [summaryPeriod, setSummaryPeriod] = useState("week")
  const [foodType, setFoodType] = useState("Run")

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/workouts")
        if (!res.ok) {
          const err = await res.json()
          console.error("Failed to load workouts:", err)
          setError("Failed to load workouts: " + (err.error || "unknown"))
          return
        }
        const data = await res.json()
        setWorkouts(Array.isArray(data) ? data : [])
      } catch {
        setError("Failed to load workouts")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const loadExercises = async (workoutId) => {
    if (exercises[workoutId]) return
    try {
      const res = await fetch(`/workouts/exercises/${workoutId}`)
      const data = await res.json()
      setExercises(prev => ({ ...prev, [workoutId]: data }))
    } catch { }
  }

  const handleAddWorkout = async () => {
    if (!workoutForm.type || !workoutForm.date) return
    setError(null) // clear any previous error
    const estCalories = workoutForm.calories || calcCalories(workoutForm.type, workoutForm)
    const newWorkout = {
      id: Date.now().toString(),
      ...workoutForm,
      calories: estCalories,
      source: "manual",
      duration: workoutForm.duration === "" ? null : workoutForm.duration,
      distance: workoutForm.distance === "" ? null : workoutForm.distance,
      pace: workoutForm.pace === "" ? null : workoutForm.pace,
    }
    try {
      const res = await fetch("/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWorkout)
      })
      if (!res.ok) {
        const err = await res.json()
        console.error("Save failed:", err)
        setError("Failed to save workout: " + (err.error || "unknown"))
        return
      }
      const saved = await res.json()
      setWorkouts(prev => [saved, ...prev])

      if (exercises_form.length > 0) {
        const savedExercises = []
        for (const ex of exercises_form) {
          if (!ex.name) continue
          const newEx = { id: Date.now().toString() + Math.random(), workout_id: saved.id, ...ex }
          const exRes = await fetch("/workouts/exercises", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newEx)
          })
          if (!exRes.ok) {
            const exErr = await exRes.json()
            console.error("Failed to save exercise:", exErr)
            continue
          }
          const savedEx = await exRes.json()
          savedExercises.push(savedEx)
        }
        setExercises(prev => ({ ...prev, [saved.id]: savedExercises }))
      }

      setWorkoutForm(EMPTY_WORKOUT_FORM)
      setExercisesForm([])
      setShowForm(false)
    } catch (err) {
      console.error("Failed to save workout:", err)
      setError("Failed to save workout")
    }
  }

  const handleEditWorkout = async () => {
    if (!workoutForm.type || !workoutForm.date) return
    setError(null) // clear any previous error
    const estCalories = workoutForm.calories || calcCalories(workoutForm.type, workoutForm)
    const updated = {
      ...workoutForm,
      calories: estCalories,
      duration: workoutForm.duration === "" ? null : workoutForm.duration,
      distance: workoutForm.distance === "" ? null : workoutForm.distance,
      pace: workoutForm.pace === "" ? null : workoutForm.pace,
    }
    try {
      const res = await fetch(`/workouts/${editingWorkout}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      })
      if (!res.ok) {
        const err = await res.json()
        console.error("Update failed:", err)
        setError("Failed to update workout: " + (err.error || "unknown"))
        return
      }
      setWorkouts(prev => prev.map(w => w.id === editingWorkout ? { ...w, ...updated } : w))
      setEditingWorkout(null)
      setWorkoutForm(EMPTY_WORKOUT_FORM)
      setShowForm(false)
      setSelectedWorkout(null)
    } catch {
      setError("Failed to update workout")
    }
  }

  const handleDeleteWorkout = async (id) => {
    setError(null) // clear any previous error
    try {
      const res = await fetch(`/workouts/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json()
        setError("Failed to delete workout: " + (err.error || "unknown"))
        return
      }
      setWorkouts(prev => prev.filter(w => w.id !== id))
      setExercises(prev => { const next = { ...prev }; delete next[id]; return next })
      setSelectedWorkout(null)
      setSelectedDate(null)
    } catch {
      setError("Failed to delete workout")
    }
  }

  const startEdit = (workout) => {
    setEditingWorkout(workout.id)
    setWorkoutForm({ ...workout })
    setShowForm(true)
  }

  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate()
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay()

  const workoutsByDate = useMemo(() => {
    const map = {}
    workouts.forEach(w => {
      if (!map[w.date]) map[w.date] = []
      map[w.date].push(w)
    })
    return map
  }, [workouts])

  const getWorkoutsForDate = (dateStr) => workoutsByDate[dateStr] ?? []

  const formatDate = (year, month, day) => {
    const m = String(month + 1).padStart(2, "0")
    const d = String(day).padStart(2, "0")
    return `${year}-${m}-${d}`
  }

  const buildCalendarDays = () => {
    const days = []
    const firstDay = getFirstDayOfMonth(calendarMonth, calendarYear)
    const daysInMonth = getDaysInMonth(calendarMonth, calendarYear)
    const prevMonth = calendarMonth === 0 ? 11 : calendarMonth - 1
    const prevYear = calendarMonth === 0 ? calendarYear - 1 : calendarYear
    const daysInPrevMonth = getDaysInMonth(prevMonth, prevYear)

    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i
      days.push({ day, month: prevMonth, year: prevYear, current: false })
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, month: calendarMonth, year: calendarYear, current: true })
    }
    const remaining = 42 - days.length
    const nextMonth = calendarMonth === 11 ? 0 : calendarMonth + 1
    const nextYear = calendarMonth === 11 ? calendarYear + 1 : calendarYear
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, month: nextMonth, year: nextYear, current: false })
    }
    return days
  }

  const summaryData = useMemo(() => {
    const now = new Date()

    if (summaryPeriod === "week") {
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      const lastWeekStart = new Date(startOfWeek)
      lastWeekStart.setDate(lastWeekStart.getDate() - 7)

      const filtered = workouts.filter(w => {
        const d = new Date(w.date)
        return d >= startOfWeek && d <= now
      })
      const lastWeek = workouts.filter(w => {
        const d = new Date(w.date)
        return d >= lastWeekStart && d < startOfWeek
      })

      return {
        count: filtered.length,
        milesRan: filtered.filter(w => w.type === "Run").reduce((s, w) => s + (parseFloat(w.distance) || 0), 0),
        hoursLifting: filtered.filter(w => w.type === "Lift").reduce((s, w) => s + (parseInt(w.duration) || 0), 0) / 60,
        calories: filtered.reduce((s, w) => s + (parseInt(w.calories) || 0), 0),
        milesChartData: [
          { label: "Last week", miles: lastWeek.filter(w => w.type === "Run").reduce((s, w) => s + (parseFloat(w.distance) || 0), 0) },
          { label: "This week", miles: filtered.filter(w => w.type === "Run").reduce((s, w) => s + (parseFloat(w.distance) || 0), 0) }
        ]
      }
    } else {
      const filtered = workouts.filter(w => {
        const d = new Date(w.date)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      const dailyMiles = {}
      filtered.filter(w => w.type === "Run").forEach(w => {
        dailyMiles[w.date] = (dailyMiles[w.date] || 0) + (parseFloat(w.distance) || 0)
      })
      return {
        count: filtered.length,
        milesRan: filtered.filter(w => w.type === "Run").reduce((s, w) => s + (parseFloat(w.distance) || 0), 0),
        hoursLifting: filtered.filter(w => w.type === "Lift").reduce((s, w) => s + (parseInt(w.duration) || 0), 0) / 60,
        calories: filtered.reduce((s, w) => s + (parseInt(w.calories) || 0), 0),
        milesChartData: Object.entries(dailyMiles)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, miles]) => ({ label: date.slice(5), miles }))
      }
    }
  }, [workouts, summaryPeriod])

  const heaviestLift = useMemo(() => {
    let max = { weight: 0, name: "—" }
    Object.values(exercises).flat().forEach(ex => {
      if ((parseFloat(ex.weight) || 0) > max.weight) max = { weight: ex.weight, name: ex.name }
    })
    return max
  }, [exercises])

  const mileTimes = useMemo(() =>
    workouts.filter(w => w.type === "Run" && w.pace).slice(0, 5).map(w => ({ date: w.date, pace: w.pace }))
  , [workouts])

  const todayStr = today.toISOString().split("T")[0]
  const todayWorkouts = workouts.filter(w => w.date === todayStr)

  if (loading) return <div className={styles.container}><LoadingSpinner text="Loading workouts..." /></div>
  if (error) return <div className={styles.container}><p style={{ color: "#e57373", padding: "2rem" }}>{error}</p></div>

  const calendarDays = buildCalendarDays()

  const sharedFormProps = {
    form: workoutForm,
    setForm: setWorkoutForm,
    exercises_form,
    setExercisesForm,
    onSave: () => editingWorkout ? handleEditWorkout() : handleAddWorkout(),
    onCancel: () => { setShowForm(false); setEditingWorkout(null); setWorkoutForm({ ...EMPTY_WORKOUT_FORM }) },
    editing: !!editingWorkout,
    styles
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Workout Tracker</h1>

      <div className={styles.nav}>
        {["today", "calendar", "summary", "stats", "food"].map(v => (
          <button key={v} onClick={() => setView(v)} className={view === v ? styles.activeButton : styles.button}>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* ── TODAY ── */}
      {view === "today" && (
        <div className={styles.todayLayout}>
          <div className={styles.todayCard}>
            <div className={styles.todayDate}>
              {today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </div>

            {todayWorkouts.length === 0 && !showForm && (
              <div className={styles.todayEmpty}>
                <p>No workout planned for today.</p>
                <button type="button" className={styles.addButton} onClick={() => { setShowForm(true); setWorkoutForm({ ...EMPTY_WORKOUT_FORM, date: todayStr }) }}>
                  + Add Workout
                </button>
              </div>
            )}

            {todayWorkouts.map(w => (
              <div key={w.id} className={styles.todayWorkout}>
                <div className={styles.todayWorkoutHeader}>
                  <span className={`${styles.workoutTypeBadge} ${styles[w.type.toLowerCase()]}`}>{w.type}</span>
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button type="button" className={styles.editButton} onClick={() => startEdit(w)}>Edit</button>
                    <button type="button" className={styles.deleteButton} onClick={() => handleDeleteWorkout(w.id)}>Remove</button>
                  </div>
                </div>
                <div className={styles.todayStats}>
                  {w.duration && <div className={styles.todayStat}><span className={styles.todayStatLabel}>Duration</span><span className={styles.todayStatVal}>{w.duration} min</span></div>}
                  {w.distance && <div className={styles.todayStat}><span className={styles.todayStatLabel}>Distance</span><span className={styles.todayStatVal}>{w.distance} mi</span></div>}
                  {w.pace && <div className={styles.todayStat}><span className={styles.todayStatLabel}>Pace</span><span className={styles.todayStatVal}>{w.pace}/mi</span></div>}
                  {w.calories && <div className={styles.todayStat}><span className={styles.todayStatLabel}>Calories</span><span className={styles.todayStatVal}>{w.calories}</span></div>}
                </div>
                {w.muscle_groups?.length > 0 && (
                  <div className={styles.muscleGroups}>
                    {w.muscle_groups.map(mg => <span key={mg} className={styles.muscleTag}>{mg}</span>)}
                  </div>
                )}
                {w.notes && <p className={styles.workoutNotes}>{w.notes}</p>}
              </div>
            ))}

            {todayWorkouts.length > 0 && !showForm && (
              <button type="button" className={styles.addButton} style={{ marginTop: "1rem" }} onClick={() => { setShowForm(true); setWorkoutForm({ ...EMPTY_WORKOUT_FORM, date: todayStr }) }}>
                + Add Another
              </button>
            )}

            {showForm && <WorkoutForm {...sharedFormProps} />}
          </div>
        </div>
      )}

      {/* ── CALENDAR ── */}
      {view === "calendar" && (
        <div className={styles.calendarLayout}>
          <div className={styles.calendarSection}>
            <div className={styles.calendarHeader}>
              <button type="button" className={styles.calNavBtn} onClick={() => {
                if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1) }
                else setCalendarMonth(m => m - 1)
              }}>←</button>
              <h2 className={styles.calendarTitle}>{MONTHS[calendarMonth]} {calendarYear}</h2>
              <button type="button" className={styles.calNavBtn} onClick={() => {
                if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1) }
                else setCalendarMonth(m => m + 1)
              }}>→</button>
            </div>

            <div className={styles.calendarGrid}>
              {DAYS.map(d => (
                <div key={d} className={styles.calendarDayLabel}>{d}</div>
              ))}
              {calendarDays.map((day, i) => {
                const dateStr = formatDate(day.year, day.month, day.day)
                const dayWorkouts = getWorkoutsForDate(dateStr)
                const isToday = dateStr === todayStr
                const isSelected = dateStr === selectedDate
                return (
                  <div
                    key={i}
                    className={`${styles.calendarDay} ${!day.current ? styles.calendarDayOtherMonth : ""} ${isToday ? styles.calendarDayToday : ""} ${isSelected ? styles.calendarDaySelected : ""}`}
                    onClick={() => { setSelectedDate(dateStr); setSelectedWorkout(null); setShowForm(false) }}
                  >
                    <span className={styles.calendarDayNum}>{day.day}</span>
                    <div className={styles.calendarDots}>
                      {dayWorkouts.slice(0, 2).map((w, j) => (
                        <span key={j} className={styles.calendarIcon}>
                          {w.type === "Run" ? "🏃" : w.type === "Lift" ? "🏋️" : w.type === "Hike" ? "🥾" : "⚡"}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className={styles.calendarLegend}>
              <span className={styles.legendItem}>🏃 Run</span>
              <span className={styles.legendItem}>🏋️ Lift</span>
              <span className={styles.legendItem}>🥾 Hike</span>
              <span className={styles.legendItem}>⚡ Other</span>
            </div>
          </div>

          <div className={styles.calendarPanel}>
            {!selectedDate && <p className={styles.empty}>Select a day to view or add workouts.</p>}

            {selectedDate && (
              <>
                <div className={styles.calendarPanelHeader}>
                  <h3 className={styles.calendarPanelTitle}>
                    {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </h3>
                  <button type="button" className={styles.addButton} onClick={() => {
                    setShowForm(s => !s)
                    setEditingWorkout(null)
                    setWorkoutForm({ ...EMPTY_WORKOUT_FORM, date: selectedDate })
                  }}>
                    {showForm ? "Cancel" : "+ Add"}
                  </button>
                </div>

                {showForm && <WorkoutForm {...sharedFormProps} />}

                {getWorkoutsForDate(selectedDate).length === 0 && !showForm && (
                  <p className={styles.empty}>No workouts on this day.</p>
                )}

                {getWorkoutsForDate(selectedDate).map(w => (
                  <div key={w.id}
                    className={`${styles.workoutCard} ${selectedWorkout === w.id ? styles.workoutCardSelected : ""}`}
                    onClick={() => { setSelectedWorkout(selectedWorkout === w.id ? null : w.id); loadExercises(w.id) }}>
                    <div className={styles.workoutCardHeader}>
                      <span className={`${styles.workoutTypeBadge} ${styles[w.type.toLowerCase()]}`}>{w.type}</span>
                      <div style={{ display: "flex", gap: "0.75rem" }}>
                        <button type="button" className={styles.editButton} onClick={e => { e.stopPropagation(); startEdit(w) }}>Edit</button>
                        <button type="button" className={styles.deleteButton} onClick={e => { e.stopPropagation(); handleDeleteWorkout(w.id) }}>Remove</button>
                      </div>
                    </div>
                    <div className={styles.workoutCardStats}>
                      {w.duration && <span>{w.duration} min</span>}
                      {w.distance && <span>{w.distance} mi</span>}
                      {w.pace && <span>{w.pace}/mi</span>}
                      {w.calories && <span>{w.calories} cal</span>}
                    </div>
                    {w.muscle_groups?.length > 0 && (
                      <div className={styles.muscleGroups}>
                        {w.muscle_groups.map(mg => <span key={mg} className={styles.muscleTag}>{mg}</span>)}
                      </div>
                    )}
                    {w.notes && <p className={styles.workoutNotes}>{w.notes}</p>}
                    {selectedWorkout === w.id && exercises[w.id]?.length > 0 && (
                      <div className={styles.exerciseList}>
                        <p className={styles.exerciseListTitle}>Exercises</p>
                        {exercises[w.id].map(ex => (
                          <div key={ex.id} className={styles.exerciseItem}>
                            <span className={styles.exerciseName}>{ex.name}</span>
                            <span className={styles.exerciseDetails}>{ex.sets} sets × {ex.reps} reps @ {ex.weight} lbs</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── SUMMARY ── */}
      {view === "summary" && (
        <>
          <div className={styles.summaryToggle}>
            <button type="button" onClick={() => setSummaryPeriod("week")} className={summaryPeriod === "week" ? styles.activeButton : styles.button}>This Week</button>
            <button type="button" onClick={() => setSummaryPeriod("month")} className={summaryPeriod === "month" ? styles.activeButton : styles.button}>This Month</button>
          </div>
          <div className={styles.summaryGrid}>
            <div className={styles.metricCard}><p className={styles.metricLabel}>Workouts</p><p className={styles.metricVal}>{summaryData.count}</p></div>
            <div className={styles.metricCard}><p className={styles.metricLabel}>Miles Ran</p><p className={styles.metricVal}>{summaryData.milesRan.toFixed(1)}</p></div>
            <div className={styles.metricCard}><p className={styles.metricLabel}>Hours Lifting</p><p className={styles.metricVal}>{summaryData.hoursLifting.toFixed(1)}</p></div>
            <div className={styles.metricCard}><p className={styles.metricLabel}>Calories Burned</p><p className={styles.metricVal}>{summaryData.calories.toLocaleString()}</p></div>
          </div>
          <div className={styles.summaryBottom}>
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>{summaryPeriod === "week" ? "This Week vs Last Week — Miles" : "Daily Miles This Month"}</h2>
              {summaryData.milesChartData.length === 0
                ? <p className={styles.empty}>No running data yet.</p>
                : <div style={{ width: "100%", height: 240 }}>
                  <ResponsiveContainer>
                    <BarChart data={summaryData.milesChartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" />
                      <XAxis dataKey="label" tick={{ fill: "#888", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#888", fontSize: 12 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #eeeeee", borderRadius: "8px" }} formatter={v => [`${v.toFixed(2)} mi`, "Miles"]} />
                      <Bar dataKey="miles" fill="#a8b8a0" radius={[4, 4, 0, 0]}>
                        {summaryData.milesChartData.map((_, i) => (
                          <Cell key={i} fill={i === summaryData.milesChartData.length - 1 ? "#a8b8a0" : "#e0e8dc"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              }
            </div>
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Recent Mile Paces</h2>
              {mileTimes.length === 0
                ? <p className={styles.empty}>No pace data yet.</p>
                : mileTimes.map((m, i) => (
                  <div key={i} className={styles.mileTimeRow}>
                    <span className={styles.mileTimeDate}>{m.date}</span>
                    <span className={styles.mileTimePace}>{m.pace}/mi</span>
                  </div>
                ))}
              <h2 className={styles.sectionTitle} style={{ marginTop: "1.5rem" }}>Heaviest Lift</h2>
              <p className={styles.heaviestLift}>{heaviestLift.name === "—" ? "No lift data yet" : `${heaviestLift.name} — ${heaviestLift.weight} lbs`}</p>
            </div>
          </div>
        </>
      )}

      {/* ── STATS ── */}
      {view === "stats" && (
        <>
          <div className={styles.summaryGrid}>
            <div className={styles.metricCard}><p className={styles.metricLabel}>Total Workouts</p><p className={styles.metricVal}>{workouts.length}</p></div>
            <div className={styles.metricCard}><p className={styles.metricLabel}>Total Miles</p><p className={styles.metricVal}>{workouts.filter(w => w.type === "Run").reduce((s, w) => s + (parseFloat(w.distance) || 0), 0).toFixed(1)}</p></div>
            <div className={styles.metricCard}><p className={styles.metricLabel}>Total Hours</p><p className={styles.metricVal}>{(workouts.reduce((s, w) => s + (parseInt(w.duration) || 0), 0) / 60).toFixed(1)}</p></div>
            <div className={styles.metricCard}><p className={styles.metricLabel}>Total Calories</p><p className={styles.metricVal}>{workouts.reduce((s, w) => s + (parseInt(w.calories) || 0), 0).toLocaleString()}</p></div>
          </div>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Workouts by Type</h2>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={WORKOUT_TYPES.map(t => ({ type: t, count: workouts.filter(w => w.type === t).length }))} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" />
                  <XAxis dataKey="type" tick={{ fill: "#888", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#888", fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #eeeeee", borderRadius: "8px" }} formatter={v => [v, "Workouts"]} />
                  <Bar dataKey="count" fill="#a8b8a0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>All Workouts</h2>
            {workouts.length === 0 && <p className={styles.empty}>No workouts yet.</p>}
            {workouts.slice(0, 20).map(w => (
              <div key={w.id} className={styles.workoutCard}>
                <div className={styles.workoutCardHeader}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span className={`${styles.workoutTypeBadge} ${styles[w.type.toLowerCase()]}`}>{w.type}</span>
                    <span className={styles.workoutDate}>{w.date}</span>
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button type="button" className={styles.editButton} onClick={() => startEdit(w)}>Edit</button>
                    <button type="button" className={styles.deleteButton} onClick={() => handleDeleteWorkout(w.id)}>Remove</button>
                  </div>
                </div>
                <div className={styles.workoutCardStats}>
                  {w.duration && <span>{w.duration} min</span>}
                  {w.distance && <span>{w.distance} mi</span>}
                  {w.calories && <span>{w.calories} cal</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── FOOD ── */}
      {view === "food" && (
        <>
          <div className={styles.foodTypeSelector}>
            {WORKOUT_TYPES.map(t => (
              <button type="button" key={t} onClick={() => setFoodType(t)} className={foodType === t ? styles.activeButton : styles.button}>{t}</button>
            ))}
          </div>
          <div className={styles.foodGrid}>
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Before Your {foodType}</h2>
              {FOOD_DATA[foodType].before.map((f, i) => (
                <div key={i} className={styles.foodItem}>
                  <div className={styles.foodItemLeft}><p className={styles.foodName}>{f.name}</p><p className={styles.foodWhy}>{f.why}</p></div>
                  <span className={styles.foodTiming}>{f.timing}</span>
                </div>
              ))}
            </div>
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>After Your {foodType}</h2>
              {FOOD_DATA[foodType].after.map((f, i) => (
                <div key={i} className={styles.foodItem}>
                  <div className={styles.foodItemLeft}><p className={styles.foodName}>{f.name}</p><p className={styles.foodWhy}>{f.why}</p></div>
                  <span className={styles.foodTiming}>{f.timing}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Water Intake</h2>
            <div className={styles.waterGrid}>
              <div className={styles.waterCard}><p className={styles.waterLabel}>During {foodType}</p><p className={styles.waterVal}>{FOOD_DATA[foodType].water.during}</p></div>
              <div className={styles.waterCard}><p className={styles.waterLabel}>Daily Goal</p><p className={styles.waterVal}>{FOOD_DATA[foodType].water.daily}</p></div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Workout Form Component ────────────────────────────────────
function WorkoutForm({ form, setForm, exercises_form, setExercisesForm, onSave, onCancel, editing, styles }) {
  const toggleMuscleGroup = (mg) => {
    setForm(f => ({
      ...f,
      muscle_groups: f.muscle_groups?.includes(mg)
        ? f.muscle_groups.filter(m => m !== mg)
        : [...(f.muscle_groups ?? []), mg]
    }))
  }

  const addExercise = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setExercisesForm(prev => [...prev, { ...EMPTY_EXERCISE, id: Date.now().toString() }])
  }

  const removeExercise = (e, id) => {
    e.preventDefault()
    e.stopPropagation()
    setExercisesForm(prev => prev.filter(ex => ex.id !== id))
  }

  const updateExercise = (id, field, value) => {
    setExercisesForm(prev => prev.map(ex => ex.id === id ? { ...ex, [field]: value } : ex))
  }

  const estimatedCalories = form.calories || calcCalories(form.type, form)

  return (
    <div className={styles.form}>
      <h3 className={styles.formTitle}>{editing ? "Edit Workout" : "Add Workout"}</h3>
      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Type</label>
          <select className={styles.input} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            {WORKOUT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Date</label>
          <input className={styles.input} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Duration (min)</label>
          <input className={styles.input} type="number" placeholder="45" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} />
        </div>

        <div className={styles.formGroup} style={{ display: form.type === "Run" || form.type === "Hike" ? "flex" : "none", flexDirection: "column", gap: "0.3rem" }}>
          <label className={styles.label}>Distance (mi)</label>
          <input className={styles.input} type="number" placeholder="3.1" value={form.distance} onChange={e => setForm(f => ({ ...f, distance: e.target.value }))} />
        </div>
        <div className={styles.formGroup} style={{ display: form.type === "Run" || form.type === "Hike" ? "flex" : "none", flexDirection: "column", gap: "0.3rem" }}>
          <label className={styles.label}>Pace (min/mi)</label>
          <input className={styles.input} placeholder="9:30" value={form.pace} onChange={e => setForm(f => ({ ...f, pace: e.target.value }))} />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Calories {form.duration && !form.calories ? `(est. ${estimatedCalories})` : ""}</label>
          <input className={styles.input} type="number" placeholder={estimatedCalories || "0"} value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value }))} />
        </div>
      </div>

      <div style={{ display: form.type === "Lift" ? "block" : "none" }}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Muscle Groups</label>
          <div className={styles.checkboxGroup}>
            {MUSCLE_GROUPS.map(mg => (
              <label key={mg} className={styles.checkboxLabel}>
                <input type="checkbox" checked={form.muscle_groups?.includes(mg) ?? false} onChange={() => toggleMuscleGroup(mg)} className={styles.checkbox} />
                {mg}
              </label>
            ))}
          </div>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Exercises</label>
          {exercises_form.map(ex => (
            <div key={ex.id} className={styles.exerciseFormRow}>
              <input className={styles.input} placeholder="Exercise name" value={ex.name} onChange={e => updateExercise(ex.id, "name", e.target.value)} style={{ flex: 2 }} />
              <input className={styles.input} type="number" placeholder="Sets" value={ex.sets} onChange={e => updateExercise(ex.id, "sets", e.target.value)} style={{ flex: 1 }} />
              <input className={styles.input} type="number" placeholder="Reps" value={ex.reps} onChange={e => updateExercise(ex.id, "reps", e.target.value)} style={{ flex: 1 }} />
              <input className={styles.input} type="number" placeholder="lbs" value={ex.weight} onChange={e => updateExercise(ex.id, "weight", e.target.value)} style={{ flex: 1 }} />
              <button type="button" className={styles.deleteButton} onClick={(e) => removeExercise(e, ex.id)} style={{ padding: "0.5rem" }}>✕</button>
            </div>
          ))}
          <button type="button" className={styles.addExerciseBtn} onClick={addExercise}>+ Add Exercise</button>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>Notes</label>
        <input className={styles.input} placeholder="Optional notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="button" className={styles.submitButton} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSave() }}>
          {editing ? "Save Changes" : "Add Workout"}
        </button>
        <button type="button" className={styles.cancelButton} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel() }}>
          Cancel
        </button>
      </div>
    </div>
  )
}