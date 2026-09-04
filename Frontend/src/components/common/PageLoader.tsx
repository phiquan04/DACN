import Spinner from "../ui/spinner/Spinner";

export default function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-surface">
      <Spinner size="lg" className="border-brand-100 border-t-primary" />
    </div>
  );
}
