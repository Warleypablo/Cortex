import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

interface PageContextType {
  title: string;
  subtitle: string;
  setPageInfo: (title: string, subtitle?: string) => void;
}

const PageContext = createContext<PageContextType | undefined>(undefined);

export function PageProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");

  const setPageInfo = useCallback((newTitle: string, newSubtitle?: string) => {
    setTitle(newTitle);
    setSubtitle(newSubtitle || "");
  }, []);

  return (
    <PageContext.Provider value={{ title, subtitle, setPageInfo }}>
      {children}
    </PageContext.Provider>
  );
}

export function usePageInfo() {
  const context = useContext(PageContext);
  if (!context) {
    throw new Error("usePageInfo must be used within a PageProvider");
  }
  return context;
}

export function useSetPageInfo(title: string, subtitle?: string) {
  const { setPageInfo } = usePageInfo();
  
  useEffect(() => {
    setPageInfo(title, subtitle);
  }, [title, subtitle, setPageInfo]);
}
