import { useEffect } from "react";

/** Makes the page fill the viewport edge-to-edge (no scroll, no margin) for as long as it's mounted, restoring the previous document/body styles on unmount. Used by the meeting room so the Zego call fills the screen instead of sitting inside the dashboard chrome. */
export function useFullscreenLayout() {
  useEffect(() => {
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyMargin = document.body.style.margin;
    const originalBodyPadding = document.body.style.padding;
    const originalHtmlHeight = document.documentElement.style.height;
    const originalBodyHeight = document.body.style.height;

    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.height = "100%";
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.height = "100%";

    const root = document.getElementById("root");
    if (root) {
      root.style.margin = "0";
      root.style.padding = "0";
      root.style.height = "100%";
    }

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.documentElement.style.height = originalHtmlHeight;
      document.body.style.margin = originalBodyMargin;
      document.body.style.padding = originalBodyPadding;
      document.body.style.height = originalBodyHeight;
      if (root) {
        root.style.margin = "";
        root.style.padding = "";
        root.style.height = "";
      }
    };
  }, []);
}
