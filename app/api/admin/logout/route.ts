import { NextResponse } from 'next/server';

import { clearAdminCookie } from '@/lib/admin';

export async function POST() {
  clearAdminCookie();
  return NextResponse.json({ ok: true });
}
