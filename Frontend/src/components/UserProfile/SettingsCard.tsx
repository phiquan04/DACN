import { useNavigate } from "react-router";
import { useTheme } from "../../context/ThemeContext";
import { logout } from "../../services/api";

const MoonIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M9.99998 1.5415C10.4142 1.5415 10.75 1.87729 10.75 2.2915V3.5415C10.75 3.95572 10.4142 4.2915 9.99998 4.2915C9.58577 4.2915 9.24998 3.95572 9.24998 3.5415V2.2915C9.24998 1.87729 9.58577 1.5415 9.99998 1.5415ZM10.0009 6.79327C8.22978 6.79327 6.79402 8.22904 6.79402 10.0001C6.79402 11.7712 8.22978 13.207 10.0009 13.207C11.772 13.207 13.2078 11.7712 13.2078 10.0001C13.2078 8.22904 11.772 6.79327 10.0009 6.79327ZM5.29402 10.0001C5.29402 7.40061 7.40135 5.29327 10.0009 5.29327C12.6004 5.29327 14.7078 7.40061 14.7078 10.0001C14.7078 12.5997 12.6004 14.707 10.0009 14.707C7.40135 14.707 5.29402 12.5997 5.29402 10.0001ZM15.9813 5.08035C16.2742 4.78746 16.2742 4.31258 15.9813 4.01969C15.6884 3.7268 15.2135 3.7268 14.9207 4.01969L14.0368 4.90357C13.7439 5.19647 13.7439 5.67134 14.0368 5.96423C14.3297 6.25713 14.8045 6.25713 15.0974 5.96423L15.9813 5.08035ZM18.4577 10.0001C18.4577 10.4143 18.1219 10.7501 17.7077 10.7501H16.4577C16.0435 10.7501 15.7077 10.4143 15.7077 10.0001C15.7077 9.58592 16.0435 9.25013 16.4577 9.25013H17.7077C18.1219 9.25013 18.4577 9.58592 18.4577 10.0001ZM14.9207 15.9806C15.2135 16.2735 15.6884 16.2735 15.9813 15.9806C16.2742 15.6877 16.2742 15.2128 15.9813 14.9199L15.0974 14.036C14.8045 13.7431 14.3297 13.7431 14.0368 14.036C13.7439 14.3289 13.7439 14.8038 14.0368 15.0967L14.9207 15.9806ZM9.99998 15.7088C10.4142 15.7088 10.75 16.0445 10.75 16.4588V17.7088C10.75 18.123 10.4142 18.4588 9.99998 18.4588C9.58577 18.4588 9.24998 18.123 9.24998 17.7088V16.4588C9.24998 16.0445 9.58577 15.7088 9.99998 15.7088ZM5.96356 15.0972C6.25646 14.8043 6.25646 14.3295 5.96356 14.0366C5.67067 13.7437 5.1958 13.7437 4.9029 14.0366L4.01902 14.9204C3.72613 15.2133 3.72613 15.6882 4.01902 15.9811C4.31191 16.274 4.78679 16.274 5.07968 15.9811L5.96356 15.0972ZM4.29224 10.0001C4.29224 10.4143 3.95645 10.7501 3.54224 10.7501H2.29224C1.87802 10.7501 1.54224 10.4143 1.54224 10.0001C1.54224 9.58592 1.87802 9.25013 2.29224 9.25013H3.54224C3.95645 9.25013 4.29224 9.58592 4.29224 10.0001ZM4.9029 5.9637C5.1958 6.25659 5.67067 6.25659 5.96356 5.9637C6.25646 5.6708 6.25646 5.19593 5.96356 4.90303L5.07968 4.01915C4.78679 3.72626 4.31191 3.72626 4.01902 4.01915C3.72613 4.31204 3.72613 4.78692 4.01902 5.07981L4.9029 5.9637Z"
      fill="currentColor"
    />
  </svg>
);

const SunIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M17.4547 11.97C17.1885 11.1934 17.5538 11.1551 17.8401 11.3266C18.1265 11.4982 18.265 11.8383 18.1799 12.1611C17.2249 15.7853 13.9257 18.4586 10.0003 18.4586C5.32892 18.4586 1.54199 14.6717 1.54199 10.0003C1.54199 6.07486 4.21532 2.77574 7.83948 1.82066C8.16227 1.73559 8.50243 1.8741 8.67398 2.16046C8.84554 2.44682 8.80718 2.81209 8.57989 3.05657C7.5971 4.11366 6.99707 5.52854 6.99707 7.08524C6.99707 10.3538 9.64678 13.0035 12.9154 13.0035C14.4721 13.0035 15.8869 12.4035 16.944 11.4207L17.4547 11.97Z"
      fill="currentColor"
    />
  </svg>
);

const LogoutIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"
    />
  </svg>
);

export default function SettingsCard() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/signin");
  };

  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
      <h4 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Cài đặt khác</h4>

      <button
        type="button"
        onClick={toggleTheme}
        className="flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.03]"
      >
        <span className="flex items-center gap-2.5">
          {theme === "dark" ? <MoonIcon /> : <SunIcon />}
          Chế độ giao diện
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">{theme === "dark" ? "Tối" : "Sáng"}</span>
      </button>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2 py-2.5 text-sm text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10"
      >
        <LogoutIcon />
        Đăng xuất
      </button>
    </div>
  );
}
