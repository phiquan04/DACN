import { Modal } from "../ui/modal";
import type { AdminDictionaryCommentItem } from "../../services/adminDictionaryApi";
import { formatApiDateTime } from "../../utils/datetime";
import ModerationStatusBadge from "./ModerationStatusBadge";

interface Props {
  comment: AdminDictionaryCommentItem;
  onClose: () => void;
}

export default function CommentDetailModal({ comment, onClose }: Props) {
  return (
    <Modal isOpen onClose={onClose} className="m-4 max-w-lg p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 lang="ja" className="text-lg font-semibold text-admin-ink">
          {comment.word}
        </h2>
        <ModerationStatusBadge status={comment.status} />
      </div>

      <p className="mt-4 whitespace-pre-wrap text-sm text-admin-body">{comment.content}</p>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-[1.2px] text-admin-meta">Người đăng</dt>
          <dd className="mt-0.5 font-medium text-admin-ink">{comment.username}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[1.2px] text-admin-meta">Đăng lúc</dt>
          <dd className="mt-0.5 font-medium text-admin-ink">{formatApiDateTime(comment.created_at)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[1.2px] text-admin-meta">Vote</dt>
          <dd className="mt-0.5 font-medium text-admin-ink">
            👍 {comment.upvotes} · 👎 {comment.downvotes} · Điểm net: {comment.score}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-[9px] border border-admin-border-input px-4 py-2 text-sm font-medium text-admin-body hover:bg-admin-fill"
        >
          Đóng
        </button>
      </div>
    </Modal>
  );
}
