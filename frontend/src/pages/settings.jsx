import styles from "../styles/settings.module.css"
 
export default function Settings({ darkMode, setDarkMode }) {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Settings</h1>
 
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Appearance</h2>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <p className={styles.settingLabel}>Dark Mode</p>
            <p className={styles.settingDescription}>Switch between light and dark theme</p>
          </div>
          <button
            className={`${styles.toggle} ${darkMode ? styles.toggleOn : ""}`}
            onClick={() => setDarkMode(prev => !prev)}
            aria-label="Toggle dark mode"
          >
            <span className={styles.toggleThumb} />
          </button>
        </div>
      </section>
    </div>
  )
}
 