/* Navbar.jsx */

import { Link } from "react-router-dom"
import styles from "../styles/Navbar.module.css"
import { Settings } from "lucide-react"

export default function Navbar() {
  return (
    <nav className={styles.navbar}>
      <Link to="/" className={styles.logo}>Christopher Soule</Link>
      <Link to="/" className={styles.link}>Home</Link>
      <Link to="/about" className={styles.link}>About</Link>
      <Link to="/stocks" className={styles.link}>Stocks</Link>
      <Link to="/counterstrike" className={styles.link}>Counterstrike</Link>
      <Link to="/finances" className={styles.link}>Finances</Link>
      <Link to="/clothing" className={styles.link}>Clothing</Link>
      <Link to="/watches" className={styles.link}>Watches</Link>
      <Link to="/workout" className={styles.link}>Workout</Link>
      <Link to="/settings" className={styles.settingsLink} aria-label="Settings">
        <Settings size={20} />
      </Link>
    </nav>
  )
}