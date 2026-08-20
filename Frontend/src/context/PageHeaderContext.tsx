import { createContext, useContext, useState, ReactNode } from "react";

type PageHeaderContextType = {
  title: string;
  subtitle: string;
  setPageHeader: (title: string, subtitle?: string) => void;
};

const PageHeaderContext = createContext<PageHeaderContextType | undefined>(undefined);

export const usePageHeader = () => {
  const context = useContext(PageHeaderContext);
  if (!context) {
    throw new Error("usePageHeader must be used within a PageHeaderProvider");
  }
  return context;
};

export const PageHeaderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");

  const setPageHeader = (newTitle: string, newSubtitle: string = "") => {
    setTitle(newTitle);
    setSubtitle(newSubtitle);
  };

  return (
    <PageHeaderContext.Provider value={{ title, subtitle, setPageHeader }}>
      {children}
    </PageHeaderContext.Provider>
  );
};
