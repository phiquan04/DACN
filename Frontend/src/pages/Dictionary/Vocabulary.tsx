import { useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import InputField from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";

// Mock dữ liệu từ vựng
const mockVocabulary = [
  {
    id: 1,
    word: "日本語",
    reading: "にほんご",
    meaning: "tiếng Nhật",
    example: "日本語を勉強します。",
    exampleMeaning: "Tôi học tiếng Nhật.",
  },
  {
    id: 2,
    word: "勉強",
    reading: "べんきょう",
    meaning: "học tập",
    example: "毎日勉強します。",
    exampleMeaning: "Học mỗi ngày.",
  },
  {
    id: 3,
    word: "食べる",
    reading: "たべる",
    meaning: "ăn",
    example: "ご飯を食べます。",
    exampleMeaning: "Ăn cơm.",
  },
  {
    id: 4,
    word: "可愛い",
    reading: "かわいい",
    meaning: "dễ thương",
    example: "この猫は可愛いです。",
    exampleMeaning: "Con mèo này dễ thương.",
  },
  {
    id: 5,
    word: "綺麗",
    reading: "きれい",
    meaning: "đẹp, sạch sẽ",
    example: "綺麗な部屋ですね。",
    exampleMeaning: "Căn phòng đẹp nhỉ.",
  },
];

export default function Vocabulary() {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState(mockVocabulary);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      setResults(mockVocabulary);
      return;
    }
    const filtered = mockVocabulary.filter(
      (item) =>
        item.word.includes(searchTerm) ||
        item.reading.includes(searchTerm) ||
        item.meaning.includes(searchTerm)
    );
    setResults(filtered);
  };

  return (
    <>
      <PageMeta
        title="Tra cứu từ vựng tiếng Nhật"
        description="Trang tra cứu từ điển Nhật - Việt"
      />
      <div className="space-y-6">
        <form onSubmit={handleSearch} className="flex gap-3 items-end">
          <div className="flex-1">
            <label
              htmlFor="search"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Tìm kiếm từ vựng
            </label>
            <InputField
              id="search"
              type="text"
              placeholder="Nhập từ, phiên âm hoặc nghĩa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {/* Sửa: bỏ prop type, thêm onClick để submit form */}
          <Button 
            size="sm"
            onClick={() => handleSearch} // Hoặc có thể dùng form's onSubmit thay vì onClick
          >
            Tra cứu
          </Button>
        </form>

        {/* Kết quả */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {results.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {item.word}
                </h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {item.reading}
                </span>
              </div>
              <p className="mb-2 text-base text-gray-800 dark:text-gray-200">
                {item.meaning}
              </p>
              <div className="mt-3 rounded-md bg-gray-50 p-3 dark:bg-gray-800">
                <p className="text-sm italic text-gray-700 dark:text-gray-300">
                  “{item.example}”
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {item.exampleMeaning}
                </p>
              </div>
            </div>
          ))}
        </div>

        {results.length === 0 && (
          <div className="py-10 text-center text-gray-500">
            Không tìm thấy từ vựng phù hợp.
          </div>
        )}
      </div>
    </>
  );
}