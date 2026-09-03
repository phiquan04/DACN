import type { DictionaryImageItem, User } from "../../../services/api";

interface ImagesCardProps {
  word: string;
  images: DictionaryImageItem[];
  loading: boolean;
  uploading: boolean;
  currentUser: User | null;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: (image: DictionaryImageItem) => void;
}

export default function ImagesCard({ word, images, loading, uploading, currentUser, onUpload, onDelete }: ImagesCardProps) {
  return (
    <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-base font-semibold text-on-surface dark:text-gray-100">Ảnh minh họa</h4>
        {currentUser && (
          <label className="cursor-pointer text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
            {uploading ? "Đang tải lên..." : "+ Thêm ảnh"}
            <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={onUpload} />
          </label>
        )}
      </div>

      {loading && (
        <div className="flex flex-wrap gap-3 animate-pulse">
          <div className="h-40 w-40 bg-surface-container-high dark:bg-gray-700 rounded-xl" />
          <div className="h-40 w-40 bg-surface-container-high dark:bg-gray-700 rounded-xl" />
        </div>
      )}

      {!loading && images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map((img) => (
            <div key={img.id} className="group relative">
              <img
                src={img.image_url}
                alt={img.caption || word}
                title={`${img.caption || ""}${img.caption ? " — " : ""}bởi ${img.uploader_username}`}
                className="h-40 w-40 rounded-xl object-cover border border-outline-variant/60 dark:border-gray-700"
              />
              {currentUser?.id === img.uploaded_by && (
                <button
                  onClick={() => onDelete(img)}
                  title="Xóa ảnh"
                  className="absolute -top-1.5 -right-1.5 hidden h-6 w-6 items-center justify-center rounded-full bg-error text-on-error text-sm group-hover:flex"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && images.length === 0 && (
        <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-lowest text-outline dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
          <p className="text-xs italic">Chưa có ảnh minh họa nào.</p>
        </div>
      )}
    </div>
  );
}
