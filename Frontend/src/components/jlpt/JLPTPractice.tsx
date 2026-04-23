import { useState } from "react";

export default function ImportExam() {
  const [examFile, setExamFile] = useState<File | null>(null);
  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async () => {
    if (!examFile || !answerFile) {
      setMessage("❌ Vui lòng chọn đủ file");
      return;
    }

    const form = new FormData();
    form.append("exam", examFile);
    form.append("answer", answerFile);

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("http://127.0.0.1:8080/api/import-exam", {
        method: "POST",
        body: form,
      });

      const data = await res.json();

      if (data.success) {
        setMessage(`✅ Import thành công (${data.questions} câu)`);
      } else {
        setMessage("❌ " + data.error);
      }
    } catch (err) {
      setMessage("❌ Lỗi server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white shadow-xl rounded-2xl">
      <h2 className="text-xl font-bold mb-4">📄 Import đề thi</h2>

      {/* Upload Exam */}
      <div className="mb-4">
        <label className="block mb-1 font-medium">File đề</label>
        <input
          type="file"
          className="w-full border p-2 rounded-lg"
          onChange={(e) => setExamFile(e.target.files?.[0] || null)}
        />
        {examFile && (
          <p className="text-sm text-green-600 mt-1">
            ✔ {examFile.name}
          </p>
        )}
      </div>

      {/* Upload Answer */}
      <div className="mb-4">
        <label className="block mb-1 font-medium">File đáp án</label>
        <input
          type="file"
          className="w-full border p-2 rounded-lg"
          onChange={(e) => setAnswerFile(e.target.files?.[0] || null)}
        />
        {answerFile && (
          <p className="text-sm text-green-600 mt-1">
            ✔ {answerFile.name}
          </p>
        )}
      </div>

      {/* Button */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
      >
        {loading ? "Đang xử lý..." : "Import"}
      </button>

      {/* Message */}
      {message && (
        <div className="mt-4 text-center text-sm">{message}</div>
      )}
    </div>
  );
}