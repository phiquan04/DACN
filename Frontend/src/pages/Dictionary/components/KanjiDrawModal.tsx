import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "../../../components/ui/modal";
import { recognizeHandwriting } from "../../../services/api";

type Point = [number, number];

interface KanjiDrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with a candidate character the user picked — appended to the search bar,
   * not searched yet, since the next character may still be drawn here. */
  onSelectCharacter: (char: string) => void;
}

const CANVAS_SIZE = 320;

/** Canvas for drawing a kanji you don't know how to read/type, recognized via
 * the backend's handwriting-recognition proxy. No stroke scoring — this is a
 * lookup aid, not a writing-practice exercise. */
export default function KanjiDrawModal({ isOpen, onClose, onSelectCharacter }: KanjiDrawModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Point[][]>([]);
  const drawingRef = useRef(false);

  const [hasInk, setHasInk] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const paintBackground = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    paintBackground(ctx, canvas);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0][0], stroke[0][1]);
      for (const [x, y] of stroke.slice(1)) ctx.lineTo(x, y);
      ctx.stroke();
    }
  }, [paintBackground]);

  const reset = useCallback(() => {
    strokesRef.current = [];
    setHasInk(false);
    setCandidates([]);
    setSearched(false);
    redraw();
  }, [redraw]);

  useEffect(() => {
    if (isOpen) reset();
    // Only reset when the modal opens, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    strokesRef.current = [...strokesRef.current, [pointFromEvent(e)]];
    setCandidates([]);
    setSearched(false);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    strokesRef.current[strokesRef.current.length - 1].push(pointFromEvent(e));
    redraw();
  };

  const handlePointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    setHasInk(strokesRef.current.length > 0);
  };

  const handleUndo = () => {
    strokesRef.current = strokesRef.current.slice(0, -1);
    setHasInk(strokesRef.current.length > 0);
    setCandidates([]);
    setSearched(false);
    redraw();
  };

  const handleRecognize = async () => {
    if (strokesRef.current.length === 0) return;
    setLoading(true);
    setSearched(true);
    try {
      const result = await recognizeHandwriting(strokesRef.current);
      setCandidates(result);
    } catch {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (char: string) => {
    onSelectCharacter(char);
    // Không đóng modal — người dùng có thể vẽ tiếp chữ kế tiếp rồi mới bấm "Tra cứu".
    reset();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="m-4 max-w-md p-6">
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Vẽ chữ Hán để tìm kiếm</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Dùng khi không biết cách đọc — vẽ chữ bằng chuột hoặc chạm rồi bấm "Nhận diện".
          </p>
        </div>

        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="mx-auto touch-none rounded-xl border border-gray-200 dark:border-gray-700"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!hasInk}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-700 transition hover:border-teal-500 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
          >
            Xóa nét cuối
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={!hasInk}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-700 transition hover:border-teal-500 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
          >
            Xóa hết
          </button>
          <button
            type="button"
            onClick={handleRecognize}
            disabled={!hasInk || loading}
            className="rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-1.5 text-sm font-semibold text-white shadow-theme-xs transition hover:from-brand-600 hover:to-brand-700 disabled:opacity-50"
          >
            {loading ? "Đang nhận diện..." : "Nhận diện"}
          </button>
        </div>

        {searched && !loading && (
          <div>
            <p className="mb-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
              {candidates.length > 0 ? "Chọn chữ đúng:" : "Không nhận diện được, hãy vẽ lại rõ nét hơn."}
            </p>
            {candidates.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {candidates.map((char, idx) => (
                  <button
                    key={`${char}-${idx}`}
                    type="button"
                    lang="ja"
                    onClick={() => handleSelect(char)}
                    className="flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200 text-2xl text-gray-800 transition hover:border-teal-500 hover:shadow-theme-xs dark:border-gray-700 dark:text-white/90"
                  >
                    {char}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
