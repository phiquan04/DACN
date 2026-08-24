import PageMeta from "../../components/common/PageMeta";

export default function AdminHome() {
  return (
    <>
      <PageMeta title="Admin | Manabi AI" description="Trang quản trị Manabi AI." />
      <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6">
        <h2 className="text-lg font-semibold text-on-surface">Tổng quan</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          Trang quản trị đang được xây dựng.
        </p>
      </div>
    </>
  );
}
