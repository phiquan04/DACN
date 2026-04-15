import { useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import InputField from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import { lookupWord, DictionaryResult } from "../../services/api";

export default function Vocabulary() {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<DictionaryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchPerformed, setSearchPerformed] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim();
    
    if (!term) {
      setResults([]);
      setSearchPerformed(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    setSearchPerformed(true);

    try {
      // Search for all possible word forms
      const result = await lookupWord(term);
      
      if (result.word && result.definitions.length > 0) {
        setResults([result]);
      } else {
        setResults([]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to lookup word"
      );
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageMeta
        title="Tra cứu từ vựng tiếng Nhật"
        description="Trang tra cứu từ điển Nhật - Việt (JMdict-EDICT)"
      />
      <div className="space-y-6">
        <form onSubmit={handleSearch} className="flex gap-3 items-end">
          <div className="flex-1">
            <label
              htmlFor="search"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Tìm kiếm từ vựng (JMdict-EDICT)
            </label>
            <InputField
              id="search"
              type="text"
              placeholder="Nhập từ tiếng Nhật (kanji, hiragana)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button 
            size="sm"
            disabled={loading}
          >
            {loading ? "Đang tìm..." : "Tra cứu"}
          </Button>
        </form>

        {/* Error message */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {results.map((item, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"
              >
                {/* Word and Reading */}
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {item.word}
                  </h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {item.reading}
                  </span>
                </div>

                {/* JLPT Level & Frequency */}
                <div className="mb-3 flex gap-2">
                  {item.jlpt && item.jlpt !== "N/A" && (
                    <span className="inline-block rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      JLPT {item.jlpt}
                    </span>
                  )}
                  {item.frequency && item.frequency !== "N/A" && (
                    <span className="inline-block rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                      #{item.frequency}
                    </span>
                  )}
                </div>

                {/* Definitions */}
                <div className="space-y-2">
                  {item.definitions.map((def, defIdx) => (
                    <div key={defIdx} className="text-sm">
                      <p className="text-gray-800 dark:text-gray-200">
                        {def.meaning}
                      </p>
                      {def.pos && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          ({def.pos})
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {searchPerformed && results.length === 0 && !loading && (
          <div className="py-10 text-center text-gray-500 dark:text-gray-400">
            {error ? "Lỗi khi tra cứu từ" : "Không tìm thấy từ vựng phù hợp."}
          </div>
        )}

        {/* Placeholder when no search performed */}
        {!searchPerformed && (
          <div className="py-10 text-center text-gray-400">
            Nhập từ tiếng Nhật để bắt đầu tra cứu...
          </div>
        )}
      </div>
    </>
  );
}