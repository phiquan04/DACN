import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { useSidebar } from "../context/SidebarContext";
import { logout } from "../services/api";
import { GridIcon, GroupIcon, DocsIcon, ListIcon, ChatIcon, VideoIcon, ChevronDownIcon, TableIcon, FolderIcon, CheckLineIcon } from "../icons";
import { UploadIcon } from "../components/admin-jlpt/icons";
import Logo from "../components/common/Logo";

type SubItem = { name: string; path: string; icon: React.ReactNode };

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path: string;
  subItems?: SubItem[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Quản lý",
    items: [
      { icon: <GridIcon />, name: "Tổng quan", path: "/admin" },
      { icon: <GroupIcon />, name: "Quản lý người dùng", path: "/admin/users" },
      {
        icon: <DocsIcon />,
        name: "Ngân hàng đề JLPT",
        path: "/admin/jlpt-content",
        subItems: [
          { name: "Cấu trúc đề", path: "/admin/jlpt-content/structure", icon: <TableIcon /> },
          { name: "Import đề", path: "/admin/jlpt-content/import", icon: <UploadIcon /> },
          { name: "Duyệt đề", path: "/admin/jlpt-content/review", icon: <CheckLineIcon /> },
        ],
      },
      {
        icon: <ListIcon />,
        name: "Kho từ vựng",
        path: "/admin/vocabulary-content",
        subItems: [
          { name: "Giáo trình & Danh mục", path: "/admin/vocabulary-content/lookups", icon: <FolderIcon /> },
          { name: "Import bộ từ vựng", path: "/admin/vocabulary-content/import", icon: <UploadIcon /> },
          { name: "Duyệt bộ từ vựng", path: "/admin/vocabulary-content/review", icon: <CheckLineIcon /> },
        ],
      },
      { icon: <ChatIcon />, name: "Kịch bản chat", path: "/admin/chat-scenarios" },
      { icon: <VideoIcon />, name: "Bản dịch video", path: "/admin/video-transcripts" },
    ],
  },
];

const SettingsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M15.1007 19.247C14.6865 19.247 14.3507 18.9112 14.3507 18.497L14.3507 14.245H12.8507V18.497C12.8507 19.7396 13.8581 20.747 15.1007 20.747H18.5007C19.7434 20.747 20.7507 19.7396 20.7507 18.497L20.7507 5.49609C20.7507 4.25345 19.7433 3.24609 18.5007 3.24609H15.1007C13.8581 3.24609 12.8507 4.25345 12.8507 5.49609V9.74501L14.3507 9.74501V5.49609C14.3507 5.08188 14.6865 4.74609 15.1007 4.74609L18.5007 4.74609C18.9149 4.74609 19.2507 5.08188 19.2507 5.49609L19.2507 18.497C19.2507 18.9112 18.9149 19.247 18.5007 19.247H15.1007ZM3.25073 11.9984C3.25073 12.2144 3.34204 12.4091 3.48817 12.546L8.09483 17.1556C8.38763 17.4485 8.86251 17.4487 9.15549 17.1559C9.44848 16.8631 9.44863 16.3882 9.15583 16.0952L5.81116 12.7484L16.0007 12.7484C16.4149 12.7484 16.7507 12.4127 16.7507 11.9984C16.7507 11.5842 16.4149 11.2484 16.0007 11.2484L5.81528 11.2484L9.15585 7.90554C9.44864 7.61255 9.44847 7.13767 9.15547 6.84488C8.86248 6.55209 8.3876 6.55226 8.09481 6.84525L3.52309 11.4202C3.35673 11.5577 3.25073 11.7657 3.25073 11.9984Z"
      fill="currentColor"
    />
  </svg>
);

const allNavItems = navGroups.flatMap((group) => group.items);

const AdminSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;
  const isParentActive = (nav: NavItem) =>
    nav.subItems ? nav.subItems.some((s) => isActive(s.path)) : isActive(nav.path);

  const [openDropdown, setOpenDropdown] = useState<string | null>(
    () => allNavItems.find((nav) => nav.subItems && isParentActive(nav))?.name ?? null
  );

  useEffect(() => {
    const activeParent = allNavItems.find((nav) => nav.subItems && isParentActive(nav));
    setOpenDropdown(activeParent ? activeParent.name : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const showLabel = isExpanded || isHovered || isMobileOpen;

  const handleLogout = () => {
    logout();
    navigate("/signin");
  };

  const navRowClass = (active: boolean) =>
    `flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors ${
      showLabel ? "" : "lg:justify-center"
    } ${active ? "bg-admin-50 text-admin-600 font-semibold" : "text-admin-body hover:bg-admin-fill hover:text-admin-900"}`;

  const navIconClass = (active: boolean) => `shrink-0 [&>svg]:size-5 ${active ? "text-admin-500" : "text-admin-meta"}`;

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 left-0 h-screen border-r border-admin-border bg-white text-admin-body transition-all duration-300 ease-in-out z-50
        ${isExpanded || isMobileOpen ? "w-[264px]" : isHovered ? "w-[264px]" : "w-[78px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`flex h-16 shrink-0 items-center gap-3 px-5 border-b border-admin-border ${
          showLabel ? "justify-start" : "lg:justify-center"
        }`}
      >
        <Link to="/admin" className="flex items-center gap-3 shrink-0">
          <Logo size={28} />
          {showLabel && (
            <span className="flex flex-col leading-tight">
              <span className="text-base font-bold text-admin-ink">Manabi</span>
              <span className="text-[11px] font-semibold uppercase tracking-[1px] text-admin-meta">Trang quản trị</span>
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5 no-scrollbar">
        <div className="flex flex-col gap-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              {showLabel && (
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[1.2px] text-admin-meta">
                  {group.label}
                </p>
              )}
              <ul className="flex flex-col gap-1">
                {group.items.map((nav) =>
                  nav.subItems ? (
                    <li key={nav.name}>
                      <button
                        type="button"
                        onClick={() => setOpenDropdown((prev) => (prev === nav.name ? null : nav.name))}
                        className={`w-full ${navRowClass(isParentActive(nav))}`}
                      >
                        <span className={navIconClass(isParentActive(nav))}>{nav.icon}</span>
                        {showLabel && <span className="flex-1 truncate text-left">{nav.name}</span>}
                        {showLabel && (
                          <ChevronDownIcon
                            className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                              openDropdown === nav.name ? "rotate-180" : ""
                            }`}
                          />
                        )}
                      </button>
                      {showLabel && (
                        <ul
                          className={`ml-9 mt-1 flex flex-col gap-1 overflow-hidden transition-all duration-200 ${
                            openDropdown === nav.name ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                          }`}
                        >
                          {nav.subItems.map((sub) => (
                            <li key={sub.path}>
                              <Link
                                to={sub.path}
                                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                                  isActive(sub.path)
                                    ? "bg-admin-50 text-admin-600 font-medium"
                                    : "text-admin-meta hover:bg-admin-fill hover:text-admin-900"
                                }`}
                              >
                                <span className="shrink-0 [&>svg]:size-4">{sub.icon}</span>
                                {sub.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ) : (
                    <li key={nav.name}>
                      <Link to={nav.path} className={navRowClass(isActive(nav.path))}>
                        <span className={navIconClass(isActive(nav.path))}>{nav.icon}</span>
                        {showLabel && <span className="truncate">{nav.name}</span>}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}

          <div>
            {showLabel && (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[1.2px] text-admin-meta">
                Hệ thống
              </p>
            )}
            <ul className="flex flex-col gap-1">
              <li>
                <Link to="/admin/settings" className={navRowClass(isActive("/admin/settings"))}>
                  <span className={navIconClass(isActive("/admin/settings"))}>
                    <SettingsIcon />
                  </span>
                  {showLabel && <span className="truncate">Cài đặt</span>}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      <div className="border-t border-admin-border px-3 py-4">
        <button onClick={handleLogout} className={`w-full ${navRowClass(false)}`}>
          <span className={navIconClass(false)}>
            <LogoutIcon />
          </span>
          {showLabel && <span>Đăng xuất</span>}
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
