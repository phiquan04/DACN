import { useEffect } from "react";
import { HelmetProvider, Helmet } from "react-helmet-async";
import { PageHeaderProvider, usePageHeader } from "../../context/PageHeaderContext";
import { ToastProvider } from "../../context/ToastContext";
import ApiErrorBridge from "./ApiErrorBridge";

const PageMeta = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => {
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader(title, description);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description]);

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
    </Helmet>
  );
};

export const AppWrapper = ({ children }: { children: React.ReactNode }) => (
  <HelmetProvider>
    <ToastProvider>
      <ApiErrorBridge />
      <PageHeaderProvider>{children}</PageHeaderProvider>
    </ToastProvider>
  </HelmetProvider>
);

export default PageMeta;
