import type { DictionaryCommentItem, User } from "../../../services/api";
import { COMMENTS_PER_PAGE } from "../dictionaryUtils";

interface CommentsCardProps {
  comments: DictionaryCommentItem[];
  loading: boolean;
  currentUser: User | null;
  newComment: string;
  onNewCommentChange: (value: string) => void;
  postingComment: boolean;
  commentsPage: number;
  onPageChange: (page: number) => void;
  onPost: () => void;
  onDelete: (comment: DictionaryCommentItem) => void;
  onVote: (comment: DictionaryCommentItem, voteType: "up" | "down") => void;
}

export default function CommentsCard({
  comments,
  loading,
  currentUser,
  newComment,
  onNewCommentChange,
  postingComment,
  commentsPage,
  onPageChange,
  onPost,
  onDelete,
  onVote,
}: CommentsCardProps) {
  const totalPages = Math.max(1, Math.ceil(comments.length / COMMENTS_PER_PAGE));
  const page = Math.min(commentsPage, totalPages);
  const pageComments = comments.slice((page - 1) * COMMENTS_PER_PAGE, page * COMMENTS_PER_PAGE);

  return (
    <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
      <h4 className="mb-4 text-base font-semibold text-on-surface dark:text-gray-100">Đóng góp ý kiến</h4>

      {currentUser ? (
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-sm font-semibold text-on-primary-fixed">
            {currentUser.username?.[0]?.toUpperCase() ?? "?"}
          </div>
          <input
            type="text"
            value={newComment}
            onChange={(e) => onNewCommentChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onPost()}
            placeholder="Chia sẻ cách hiểu, ví dụ của bạn..."
            disabled={postingComment}
            className="flex-1 rounded-full border border-outline-variant/60 bg-surface-container-lowest px-3 py-1.5 text-sm text-on-surface dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          />
          <button
            type="button"
            disabled={postingComment || !newComment.trim()}
            onClick={onPost}
            className="shrink-0 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-on-primary disabled:opacity-50 dark:bg-primary-container"
          >
            Gửi
          </button>
        </div>
      ) : (
        <p className="mb-3 text-xs text-outline italic">Đăng nhập để đóng góp ý kiến.</p>
      )}

      {loading && (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-surface-container-high dark:bg-gray-700 rounded w-2/3" />
          <div className="h-3 bg-surface-container-high dark:bg-gray-700 rounded w-1/2" />
        </div>
      )}

      {!loading && comments.length > 0 && (
        <>
          <ul className="space-y-3">
            {pageComments.map((c) => (
              <li key={c.id} className="flex items-start gap-2.5 text-sm">
                {c.avatar_url ? (
                  <img
                    src={c.avatar_url}
                    alt={c.username}
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-xs font-semibold text-on-surface-variant dark:bg-gray-700 dark:text-gray-300">
                    {c.username?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-medium text-on-surface dark:text-gray-200">{c.username}</span>{" "}
                      <span className="text-on-surface-variant dark:text-gray-300 break-words">{c.content}</span>
                    </div>
                    {currentUser?.id === c.user_id && (
                      <button
                        onClick={() => onDelete(c)}
                        className="shrink-0 text-xs text-outline-variant hover:text-error dark:text-gray-600"
                        title="Xóa bình luận"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-outline">
                    <button
                      onClick={() => onVote(c, "up")}
                      disabled={!currentUser}
                      className={`hover:text-brand-600 ${c.my_vote === "up" ? "text-brand-600 font-medium" : ""}`}
                    >
                      👍 {c.upvotes}
                    </button>
                    <button
                      onClick={() => onVote(c, "down")}
                      disabled={!currentUser}
                      className={`hover:text-error ${c.my_vote === "down" ? "text-error font-medium" : ""}`}
                    >
                      👎 {c.downvotes}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="rounded-full border border-outline-variant/60 px-3 py-1 font-medium text-on-surface-variant hover:border-brand-500 hover:text-brand-600 disabled:opacity-40 disabled:hover:border-outline-variant/60 disabled:hover:text-on-surface-variant dark:border-gray-700 dark:text-gray-300"
              >
                ‹ Trước
              </button>
              <span className="text-outline dark:text-gray-500">
                Trang {page}/{totalPages}
              </span>
              <button
                type="button"
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="rounded-full border border-outline-variant/60 px-3 py-1 font-medium text-on-surface-variant hover:border-brand-500 hover:text-brand-600 disabled:opacity-40 disabled:hover:border-outline-variant/60 disabled:hover:text-on-surface-variant dark:border-gray-700 dark:text-gray-300"
              >
                Sau ›
              </button>
            </div>
          )}
        </>
      )}

      {!loading && comments.length === 0 && (
        <p className="text-xs text-outline italic">Chưa có ý kiến đóng góp nào.</p>
      )}
    </div>
  );
}
