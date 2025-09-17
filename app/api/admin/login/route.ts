import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { adminName, setAdminCookie } from '@/lib/admin';

const loginSchema = z.object({ password: z.string().min(1) });

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ message: '비밀번호를 입력하세요.' }, { status: 400 });
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || parsed.data.password !== expected) {
    return NextResponse.json({ message: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
  }

  setAdminCookie();
  return NextResponse.json({ name: adminName() });
}
