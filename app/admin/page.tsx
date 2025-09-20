import type { Metadata } from "next";

import { AdminLoginForm } from "./AdminLoginForm";
import { AdminLogoutPanel } from "./AdminLogoutPanel";

import { getAdminDisplayName } from "@/lib/admin";
import { isAdminRequest } from "@/lib/anon-server";

export const metadata: Metadata = {
  title: "관리자 로그인 | pile",
  description: "비밀번호로 관리자 권한을 활성화합니다.",
};

export default function AdminPage() {
  const adminName = getAdminDisplayName();
  const isAdmin = isAdminRequest();

  return (
    <main className="shell">
      <section className="panel">
        <h1>관리자 설정</h1>
        <p>
          비밀번호를 입력하면 이 브라우저에서 관리자 권한이 활성화되어 채널/아이템 관리 기능을
          사용할 수 있습니다.
        </p>
      </section>

      {isAdmin ? (
        <AdminLogoutPanel adminName={adminName} />
      ) : (
        <AdminLoginForm adminName={adminName} />
      )}
    </main>
  );
}
