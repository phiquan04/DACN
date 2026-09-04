import { useEffect } from "react";
import { Navigate, Outlet } from "react-router";
import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { getStoredUser } from "../services/api";
import AdminHeader from "./AdminHeader";
import AdminSidebar from "./AdminSidebar";
import Backdrop from "./Backdrop";

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  return (
    <div className="min-h-screen bg-admin-bg xl:flex">
      <div>
        <AdminSidebar />
        <Backdrop />
      </div>
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isExpanded || isHovered ? "lg:ml-[264px]" : "lg:ml-[78px]"
        } ${isMobileOpen ? "ml-0" : ""}`}
      >
        <AdminHeader />
        <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

const AdminLayout: React.FC = () => {
  const user = getStoredUser();

  useEffect(() => {
    const wasDark = document.documentElement.classList.contains("dark");
    document.documentElement.classList.remove("dark");
    return () => {
      if (wasDark) {
        document.documentElement.classList.add("dark");
      }
    };
  }, []);

  if (!user || user.role !== "admin") {
    return <Navigate to="/signin" replace />;
  }

  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
};

export default AdminLayout;
