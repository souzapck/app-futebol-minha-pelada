export default function CampoIcon({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
    >
      <rect x="10" y="10" width="236" height="236" rx="20" fill="#6FC04A" />

      {/* Linhas */}
      <rect x="40" y="30" width="176" height="196" stroke="#E8F5E9" strokeWidth="6" fill="none" />

      {/* Meio campo */}
      <line x1="40" y1="128" x2="216" y2="128" stroke="#E8F5E9" strokeWidth="6" />

      {/* Círculo central */}
      <circle cx="128" cy="128" r="30" stroke="#E8F5E9" strokeWidth="6" fill="none" />

      {/* Áreas */}
      <rect x="78" y="30" width="100" height="40" stroke="#E8F5E9" strokeWidth="6" fill="none" />
      <rect x="78" y="186" width="100" height="40" stroke="#E8F5E9" strokeWidth="6" fill="none" />
    </svg>
  );
}