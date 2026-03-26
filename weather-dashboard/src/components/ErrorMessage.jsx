export default function ErrorMessage({ message }) {
  return (
    <div className="error-message" role="alert" aria-live="polite">
      <span className="error-icon" aria-hidden="true">⚠</span>
      <p>{message}</p>
    </div>
  );
}
