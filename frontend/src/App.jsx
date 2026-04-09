/* App.jsx */
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { useState, useEffect } from "react"
import Footer from "./components/footer"
import Navbar from "./components/navbar"
import Home from "./pages/home"
import About from "./pages/about"
import Stocks from "./pages/stocks"
import Page4 from "./pages/clothing"
import Recipes from "./pages/recipes"
import RecipeDetail from "./pages/recipedetail"
import Counterstrike from "./pages/counterstrike"
import Finances from "./pages/finances"
import Workout from "./pages/workout"
import Settings from "./pages/settings"

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("darkMode") === "true"
  })

  useEffect(() => {
    localStorage.setItem("darkMode", darkMode)
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light")
  }, [darkMode])

  return (
    <BrowserRouter>
      <Navbar />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/stocks" element={<Stocks />} />
          <Route path="/clothing" element={<Page4 />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/recipes/:id" element={<RecipeDetail />} />
          <Route path="/counterstrike" element={<Counterstrike />} />
          <Route path="/finances" element={<Finances />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/settings" element={<Settings darkMode={darkMode} setDarkMode={setDarkMode} />} />
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  )
}