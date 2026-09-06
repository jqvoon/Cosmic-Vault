import "./SSOButton.css";

export function SSOButton({ icon, label, onClick }) {
  return (
    <button className="sso-button" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
