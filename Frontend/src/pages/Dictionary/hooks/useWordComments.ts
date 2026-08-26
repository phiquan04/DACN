import { useCallback, useState } from "react";
import {
  fetchComments,
  postComment as postCommentApi,
  deleteComment as deleteCommentApi,
  voteComment as voteCommentApi,
  type DictionaryCommentItem,
  type User,
} from "../../../services/api";

/** Community comments/votes attached to whichever word is currently being viewed. */
export function useWordComments(currentUser: User | null) {
  const [comments, setComments] = useState<DictionaryCommentItem[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [commentsPage, setCommentsPage] = useState(1);

  const load = useCallback(
    async (word: string) => {
      if (!word) return;
      setLoadingComments(true);
      setCommentsPage(1);
      try {
        setComments(await fetchComments(word, currentUser?.id));
      } catch {
        setComments([]);
      } finally {
        setLoadingComments(false);
      }
    },
    [currentUser]
  );

  const reset = useCallback(() => {
    setComments([]);
    setNewComment("");
  }, []);

  const post = useCallback(
    async (word: string) => {
      const content = newComment.trim();
      if (!content || !currentUser || !word) return;
      setPostingComment(true);
      try {
        const comment = await postCommentApi({ word, content });
        setComments((prev) => [comment, ...prev]);
        setCommentsPage(1);
        setNewComment("");
      } catch (err) {
        console.error("Failed to post comment:", err);
      } finally {
        setPostingComment(false);
      }
    },
    [newComment, currentUser]
  );

  const remove = useCallback(
    async (comment: DictionaryCommentItem) => {
      if (!currentUser) return;
      try {
        await deleteCommentApi(comment.id);
        setComments((prev) => prev.filter((c) => c.id !== comment.id));
      } catch {
        // silent
      }
    },
    [currentUser]
  );

  const vote = useCallback(
    async (comment: DictionaryCommentItem, voteType: "up" | "down") => {
      if (!currentUser) return;
      try {
        const updated = await voteCommentApi(comment.id, voteType);
        setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } catch (err) {
        console.error("Failed to vote:", err);
      }
    },
    [currentUser]
  );

  return {
    comments,
    loadingComments,
    newComment,
    setNewComment,
    postingComment,
    commentsPage,
    setCommentsPage,
    load,
    reset,
    post,
    remove,
    vote,
  };
}
