import { adminName, isAdmin } from '@/lib/admin';
import { BoardCreateForm } from '@/components/board-create-form';
import { AdminLoginForm } from '@/components/admin-login-form';
import { AdminLogoutButton } from '@/components/admin-logout-button';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  const admin = isAdmin();
  const name = adminName();

  if (!admin) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <AdminLoginForm />
      </div>
    );
  }

  return (
    <div>
      <section className="form-card" style={{ marginBottom: '2rem' }}>
        <h2>환영합니다, {name}님</h2>
        <p>이 페이지에서 보드를 생성하거나 채널을 관리할 수 있습니다.</p>
        <div style={{ marginTop: '1rem' }}>
          <AdminLogoutButton />
        </div>
      </section>
      <BoardCreateForm />
    </div>
  );
}
