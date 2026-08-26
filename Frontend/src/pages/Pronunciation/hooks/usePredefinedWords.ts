import { useEffect, useState } from "react";
import { fetchHistoryWords, type User } from "../../../services/api";
import { BASE_URL, type HistoryWord } from "../pronunciationUtils";

/** Word list for PredefinedMode: loaded from search history, plus a word handed off from the dictionary page and Vietnamese-meaning search. */
export function usePredefinedWords(currentUser: User | null) {
  const [wordList, setWordList] = useState<HistoryWord[]>([]);
  const [selectedWord, setSelectedWord] = useState<HistoryWord | null>(null);
  const [loadingWords, setLoadingWords] = useState(true);

  const [vietSearch, setVietSearch] = useState("");
  const [searchResults, setSearchResults] = useState<HistoryWord[]>([]);
  const [searchingMeaning, setSearchingMeaning] = useState(false);

  // Tải danh sách từ từ history khi mount
  useEffect(() => {
    if (!currentUser) {
      setLoadingWords(false);
      return;
    }
    const loadWords = async () => {
      try {
        const words = await fetchHistoryWords(currentUser.id);
        setWordList(words);
        if (words.length > 0) setSelectedWord(words[0]);
      } catch (err) {
        console.error("Failed to load history words", err);
      } finally {
        setLoadingWords(false);
      }
    };
    loadWords();
  }, [currentUser?.id]);

  // Đọc từ được chọn từ sessionStorage (khi từ trang từ điển chuyển sang)
  useEffect(() => {
    const stored = sessionStorage.getItem("practiceWord");
    if (stored) {
      try {
        const { word, reading, meaning } = JSON.parse(stored);
        const newWord = { word, reading, meaning };
        setWordList((prev) => {
          const exists = prev.some((w) => w.word === word);
          if (exists) return prev;
          return [newWord, ...prev];
        });
        setSelectedWord(newWord);
        sessionStorage.removeItem("practiceWord");
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Tìm kiếm từ theo nghĩa tiếng Việt (gọi Gemini)
  const searchByVietnameseMeaning = async () => {
    if (!vietSearch.trim()) return;
    setSearchingMeaning(true);
    try {
      const res = await fetch(`${BASE_URL}/api/dictionary/search-by-meaning`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vietnamese: vietSearch }),
      });
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      alert("Không thể tìm từ theo nghĩa.");
    } finally {
      setSearchingMeaning(false);
    }
  };

  const addWordFromSearch = (item: HistoryWord) => {
    setWordList((prev) => {
      const exists = prev.some((w) => w.word === item.word);
      if (exists) return prev;
      return [item, ...prev];
    });
    setSelectedWord(item);
    setSearchResults([]);
    setVietSearch("");
  };

  return {
    wordList,
    selectedWord,
    setSelectedWord,
    loadingWords,
    vietSearch,
    setVietSearch,
    searchResults,
    searchingMeaning,
    searchByVietnameseMeaning,
    addWordFromSearch,
  };
}
