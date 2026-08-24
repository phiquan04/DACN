import { Navigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { getStoredUser } from "../../services/api";

export default function AdminHome() {
  const user = getStoredUser();

  if (!user || user.role !== "admin") {
    return <Navigate to="/signin" replace />;
  }

  return (
    <>
      <PageMeta title="Admin | Manabi AI" description="Trang quản trị Manabi AI." />
      <div className="flex min-h-screen items-center justify-center">
        <h1 className="text-2xl font-bold">ADMIN</h1>
      </div>
    </>
  );
}
