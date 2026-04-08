// Shared loading component used across all pages
// Usage: <LoadingSpinner text="Loading workouts..." />
export default function LoadingSpinner({ text = "Loading..." }) {
  return (
    <div className="loadingContainer">
      <div className="loadingSpinner" />
      <p className="loadingText">{text}</p>
    </div>
  )
}