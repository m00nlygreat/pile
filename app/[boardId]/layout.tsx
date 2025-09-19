import type { Metadata } from "next";
import type { ReactNode } from "react";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { boards } from "@/db/schema";

type BoardLayoutProps = {
  children: ReactNode;
  params: {
    boardId: string;
  };
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { boardId: string };
}): Promise<Metadata> {
  const boardSlug = decodeURIComponent(params.boardId);
  const boardRecord = db
    .select({
      name: boards.name,
      description: boards.description,
    })
    .from(boards)
    .where(eq(boards.slug, boardSlug))
    .limit(1)
    .all()[0];

  if (!boardRecord) {
    return {
      title: "보드를 찾을 수 없습니다 | pile",
      description: "요청한 보드를 찾을 수 없습니다.",
    };
  }

  return {
    title: `${boardRecord.name} | pile`,
    description:
      boardRecord.description ?? "pile에서 진행 중인 강의 보드입니다.",
  };
}

export default function BoardLayout({ children }: BoardLayoutProps) {
  return <>{children}</>;
}
