export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
    >
      <rect width="32" height="32" rx="9" fill="#2563EB" />
      <path
        d="M9 20.5c0-4.2 2.6-7 6.2-7 2.4 0 4.1 1.1 5.2 2.8"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="21.2" cy="12.4" r="3.1" fill="#6EE7B7" />
      <path
        d="M20.2 12.4h2M21.2 11.4v2"
        stroke="#0B1220"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
