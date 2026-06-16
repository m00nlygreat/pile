const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#f7f3eb"/>
  <rect x="20" y="18" width="30" height="8" rx="4" fill="#b76542" opacity=".55"/>
  <rect x="14" y="28" width="38" height="8" rx="4" fill="#b76542" opacity=".78"/>
  <rect x="10" y="38" width="44" height="8" rx="4" fill="#b76542"/>
</svg>`;

export function GET() {
  return new Response(icon, {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": "image/svg+xml",
    },
  });
}
