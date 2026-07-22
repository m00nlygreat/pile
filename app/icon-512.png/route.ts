import { createPwaIcon } from "@/lib/pwa-icon";

export const revalidate = 86400;

export function GET() {
  return createPwaIcon(512);
}
