import { getStoredUser } from "../../../services/api";
import { useSearchHistory } from "./useSearchHistory";
import { useWordImages } from "./useWordImages";
import { useWordComments } from "./useWordComments";
import { useDictionaryLookup } from "./useDictionaryLookup";

/**
 * Wires the dictionary page's four concerns together: a word lookup resolves
 * to a `currentWord`, which drives loading that word's images/comments, and
 * a saved history entry refreshes the sidebar.
 */
export function useVocabularyPage() {
  const currentUser = getStoredUser();

  const history = useSearchHistory(currentUser);
  const images = useWordImages(currentUser);
  const comments = useWordComments(currentUser);

  const lookup = useDictionaryLookup({
    currentUser,
    historyItems: history.history,
    onWordResolved: (word) => {
      images.load(word);
      comments.load(word);
    },
    onWordReset: () => {
      images.reset();
      comments.reset();
    },
    onSaved: () => {
      history.load();
    },
  });

  return { currentUser, history, images, comments, lookup };
}
