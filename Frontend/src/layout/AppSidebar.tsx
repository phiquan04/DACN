import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router";

// Assume these icons are imported from an icon library
import Logo from "../components/common/Logo";
import { useSidebar } from "../context/SidebarContext";
import {
  AudioIcon,
  CalenderIcon,
  ChatIcon,
  CheckLineIcon,
  ChevronDownIcon,
  DocsIcon,
  GroupIcon,
  HorizontaLDots,
  ListIcon,
  PageIcon,
  TaskIcon,
  UserCircleIcon,
  VideoIcon,
} from "../icons";
import SidebarWidget from "./SidebarWidget";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

const navItems: NavItem[] = [
  {
    icon: <PageIcon />,
    name: "Từ điển",
    path: "/dictionary",
  },
  {
    icon: <DocsIcon />,
    name: "Kho từ vựng",
    path: "/vocabulary",
  },
  {
    icon: <CheckLineIcon />,
    name: "Kiểm tra ngữ pháp",
    path: "/fixgrammar",
  },
  {
    icon: <ListIcon />,
    name: "Kho ngữ pháp",
    path: "/grammar-bank",
  },
  {
    icon: <AudioIcon />,
    name: "Kiểm tra phát âm",
    path: "/check-pronunciation",
  },
  {
    icon: <GroupIcon />,
    name: "Cuộc họp",
    path: "/meeting",
  },
  {
    name: "Luyện hội thoại AI",
    icon: <ChatIcon />,
    path: "/chat-bot",
  },
  {
    name: "Học qua Youtube",
    icon: <VideoIcon />,
    path: "/line-chart",
  },
  {
    name: "Luyện đề JLPT",
    icon: <TaskIcon />,
    path: "/jlpt-practice",
  },
  {
    icon: <CalenderIcon />,
    name: "Lịch",
    path: "/calendar",
  },
  {
    icon: <UserCircleIcon />,
    name: "Hồ sơ cá nhân",
    path: "/profile",
  },
];

const othersItems: NavItem[] = [
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "others";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  interface SakuraPetal {
    id: number;
    left: number;
    top: number;
    delay: number;
    duration: number;
    size: number;
    drift: number;
  }
  const [sakuraPetals, setSakuraPetals] = useState<SakuraPetal[]>([]);

  const handleLogoClick = () => {
    const petals: SakuraPetal[] = Array.from({ length: 55 }, (_, i) => ({
      id: Date.now() + i,
      // Spawn off the top-left, outside the visible viewport (px, since the
      // portal container below spans the whole screen, not just the
      // sidebar's own width), so petals fly in rather than fading in already
      // on-screen.
      left: -40 + Math.random() * 220,
      top: -10 + Math.random() * -160,
      delay: Math.random() * 1.2,
      duration: 6 + Math.random() * 3,
      size: 4 + Math.random() * 4,
      // Horizontal travel in vw (scales to any screen size) — kept modest so
      // the steep vertical fall below reads as a steep diagonal rather than
      // a flat sideways sweep.
      drift: 70 + Math.random() * 40,
    }));
    setSakuraPetals(petals);
    window.setTimeout(() => setSakuraPetals([]), 10800);
  };

  const isActive = useCallback(
    (path: string) =>
      location.pathname === path ||
      (path === "/dictionary" && location.pathname === "/"),
    [location.pathname]
  );

  useEffect(() => {
    let submenuMatched = false;
    ["main", "others"].forEach((menuType) => {
      const items = menuType === "main" ? navItems : othersItems;
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (isActive(subItem.path)) {
              setOpenSubmenu({
                type: menuType as "main" | "others",
                index,
              });
              submenuMatched = true;
            }
          });
        }
      });
    });

    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [location, isActive]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  const renderMenuItems = (items: NavItem[], menuType: "main" | "others") => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
            >
              <span
                className={`menu-item-icon-size  ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className="menu-item-text">{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? "rotate-180 text-brand-500"
                      : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                to={nav.path}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`menu-item-icon-size ${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text">{nav.name}</span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      to={subItem.path}
                      className={`menu-dropdown-item ${
                        isActive(subItem.path)
                          ? "menu-dropdown-item-active"
                          : "menu-dropdown-item-inactive"
                      }`}
                    >
                      {subItem.name}
                      <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge`}
                          >
                            new
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge`}
                          >
                            pro
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-surface-container-lowest dark:bg-gray-900 dark:border-gray-800 text-on-surface h-screen transition-all duration-300 ease-in-out z-50 border-r border-outline-variant/60
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {sakuraPetals.length > 0 &&
        createPortal(
          <div className="pointer-events-none fixed inset-0 z-[100000]">
            {sakuraPetals.map((p) => (
              <span
                key={p.id}
                className="sakura-petal absolute"
                style={
                  {
                    left: `${p.left}px`,
                    top: `${p.top}px`,
                    width: p.size,
                    height: p.size,
                    animationDuration: `${p.duration}s`,
                    animationDelay: `${p.delay}s`,
                    "--sakura-drift": `${p.drift}vw`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>,
          document.body
        )}

      <div
        className={`relative -mx-5 flex h-[100px] shrink-0 items-center gap-3 overflow-hidden px-5 ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <div
          className="absolute inset-0 bg-center bg-no-repeat"
          style={{
            backgroundImage:
              "url('/images/13d90ef1-c8ef-4e12-b2e9-f4f49b32aa72.png')",
            backgroundSize: "cover",
            WebkitMaskImage: "radial-gradient(ellipse 75% 85% at center, black 55%, transparent 92%)",
            maskImage: "radial-gradient(ellipse 75% 85% at center, black 55%, transparent 92%)",
          }}
        />
        <div className="absolute inset-0 bg-white/45 dark:bg-gray-900/55" />
        <Link
          to="/dictionary"
          onClick={handleLogoClick}
          className="relative flex items-center gap-3 shrink-0"
        >
          <Logo size={36} />
          {(isExpanded || isHovered || isMobileOpen) && (
            <span className="flex flex-col leading-tight">
              <span className="text-base font-bold text-on-surface">
                <span className="text-primary">Manabi</span>{" "}
                <span className="text-secondary">Nihongo</span>
              </span>
            </span>
          )}
        </Link>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mt-3 mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-outline dark:text-gray-500 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  ""
                ) : (
                  <HorizontaLDots className="size-6" />
                )}
              </h2>
              {renderMenuItems(navItems, "main")}
            </div>
            <div className="">
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-outline dark:text-gray-500 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  ""
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(othersItems, "others")}
            </div>
          </div>
        </nav>
        {isExpanded || isHovered || isMobileOpen ? <SidebarWidget /> : null}
      </div>
    </aside>
  );
};

export default AppSidebar;
