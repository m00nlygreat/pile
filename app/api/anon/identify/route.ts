import { NextResponse } from 'next/server';

import { getOrCreateAnonUser } from '@/lib/anon';

export async function POST() {
  const anon = await getOrCreateAnonUser();
  return NextResponse.json({ user: anon });
}
