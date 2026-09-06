import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { SiteHelpChatProvider } from "../context/SiteHelpChatContext";
import { Outlet, useLocation } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";
import SiteHelpChatWidget from "../components/site-help-chat/SiteHelpChatWidget";
import SelectionMeaningPopup from "../components/site-help-chat/SelectionMeaningPopup";

// Routes whose content should fill the full dashboard width/height instead of
// sitting inside the centered max-width column — the page owns its own
// internal scrolling instead of the document scrolling.
const FULL_BLEED_ROUTES = ["/chat-bot", "/meeting"];

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const { pathname } = useLocation();
  const isFullBleed = FULL_BLEED_ROUTES.some((route) => pathname.startsWith(route));

  return (
    <div className="min-h-screen xl:flex">
      <div>
        <AppSidebar />
        <Backdrop />
      </div>
      <div
        className={`min-w-0 flex-1 transition-all duration-300 ease-in-out ${
          isExpanded || isHovered ? "lg:ml-[290px]" : "lg:ml-[90px]"
        } ${isMobileOpen ? "ml-0" : ""} ${isFullBleed ? "flex h-screen flex-col overflow-hidden" : ""}`}
      >
        <AppHeader />
        <div
          className={
            isFullBleed
              ? "min-h-0 flex-1 overflow-hidden p-4 md:p-6"
              : "p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6"
          }
        >
          <Outlet />
        </div>
      </div>
      {!isFullBleed && (
        <>
          <SiteHelpChatWidget />
          <SelectionMeaningPopup />
        </>
      )}
    </div>
  );
};

const AppLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <SiteHelpChatProvider>
        <LayoutContent />
      </SiteHelpChatProvider>
    </SidebarProvider>
  );
};

export default AppLayout;
