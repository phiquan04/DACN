# Manabi AI — Hướng dẫn chạy dự án

Nền tảng học tiếng Nhật bằng AI. Backend: FastAPI (Python) + các model ML (BERT sửa ngữ pháp, faster-whisper chấm phát âm, gTTS). Frontend: React + Vite + TailwindCSS.

## Yêu cầu

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (bắt buộc, dùng cho Postgres — và cho backend/frontend nếu chạy full Docker)
- Node.js 20+ (nếu chạy frontend local)
- Python 3.10 (nếu chạy backend local)
- File `Backend/.env` — xem mục [Biến môi trường](#biến-môi-trường) bên dưới

## Cách 1: Chạy toàn bộ bằng Docker (đơn giản nhất)

```
docker compose up -d --build
```

- Frontend: http://localhost:5173
- Backend API docs: http://localhost:8080/docs
- Adminer (xem DB qua web): http://localhost:8081

Sau lần đầu, các lần sau chỉ cần đổi service nào có code mới:
```
docker compose up -d --build backend   # chỉ backend
docker compose up -d --build frontend  # chỉ frontend
```
Không cần `docker compose down` trước — `up -d --build` tự rebuild/recreate đúng phần cần thiết, các service khác không bị động tới.

> **Lưu ý dung lượng**: image backend nặng (~5.3GB, do TensorFlow/PyTorch/faster-whisper) nên full-Docker phù hợp để *chạy thử/demo*, không lý tưởng để *code hàng ngày* — mỗi lần đổi code backend phải rebuild + khởi động lại (nạp model mất 1-3 phút). Nếu code thường xuyên, dùng **Cách 2**.

## Cách 2: Hybrid — chỉ Postgres chạy Docker, backend/frontend chạy local (khuyên dùng khi code)

Tránh hoàn toàn việc build lại image nặng mỗi khi đổi code, và không tốn ổ C cho build cache/image.

**1. Bật database:**
```
docker compose up -d db
```
(Postgres publish ra `localhost:5432`, `Backend/.env` đã trỏ sẵn `DATABASE_URL` về `localhost` nên không cần sửa gì.)

**2. Chạy backend:**
```powershell
cd Backend
.\venv\Scripts\activate
uvicorn main:app --factory --reload --host 127.0.0.1 --port 8080
```
(Nếu chưa có `venv`: `python -m venv venv` rồi `pip install -r requirements.txt`.)

**3. Chạy frontend:**
```powershell
cd Frontend
npm install   # lần đầu hoặc khi package.json đổi
npm run dev
```
→ Mở http://localhost:5173 (Vite tự chuyển sang 5174 nếu 5173 đang bận — cả hai đã có trong CORS allow-list).

Muốn dừng: `Ctrl+C` ở 2 terminal backend/frontend, và `docker compose stop db` nếu cần.

## Biến môi trường (`Backend/.env`)

File này không nằm trong git (`.gitignore`), cần tự tạo. Các key cần có:

| Key | Mô tả |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:qazplmdcm@localhost:5432/Japanese_App` (local) |
| `OPENROUTER_API_KEY` | Dùng cho Chatbot (gọi LLM qua OpenRouter) |
| `GEMINI_API_KEY` | Dùng cho tính năng tra từ theo nghĩa tiếng Việt |
| `OPENAI_API_KEY` | (nếu tính năng nào dùng trực tiếp OpenAI) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Upload ảnh (avatar...) |
| `YOUTUBE_API_KEY` | Tìm kiếm video luyện nghe |
| `ALLOWED_ORIGINS` | Danh sách origin frontend được phép gọi API (CORS), phân tách bởi dấu phẩy — mặc định đã gồm `http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174` |
| `ENVIRONMENT` | `development` hoặc `production` |

Khi chạy **full Docker**, `docker-compose.yml` tự override `DATABASE_URL` thành `postgresql://postgres:qazplmdcm@db:5432/Japanese_App` (dùng tên service `db` thay vì `localhost`) — không cần sửa `.env` khi đổi qua lại giữa 2 cách chạy.

## Migration database (Alembic)

Schema DB được quản lý bằng [Alembic](https://alembic.sqlalchemy.org/) (`Backend/alembic/`). `init_db()` vẫn tự `create_all` các bảng chưa tồn tại mỗi lần khởi động backend (không hại gì), nhưng **thay đổi trên bảng đã tồn tại (thêm/sửa cột...) phải đi qua migration**, không tự viết `ALTER TABLE` tay nữa.

Sau khi sửa model trong `Backend/app/models/`:
```powershell
cd Backend
.\venv\Scripts\activate
alembic revision --autogenerate -m "mô tả ngắn gọn thay đổi"
```
Kiểm tra lại file sinh ra trong `alembic/versions/` rồi áp dụng:
```powershell
alembic upgrade head
```

- **DB mới hoàn toàn** (vừa `docker compose up -d db` lần đầu): chạy `alembic upgrade head` trước, hoặc cứ chạy backend để `create_all` tự tạo bảng rồi chạy `alembic stamp head` một lần để đánh dấu đã ở baseline.
- **DB đã có sẵn từ trước** (đã pull nhánh này, DB đã có đủ bảng/cột qua `create_all` cũ): chạy `alembic stamp head` một lần duy nhất để đánh dấu đang ở baseline mà không chạy lại `CREATE TABLE`, sau đó từ giờ dùng `alembic upgrade head` như bình thường cho các migration tiếp theo.

## Lệnh dọn dẹp / bảo trì Docker

Build nhiều lần khiến build cache phình to, chiếm ổ C (WSL2 virtual disk trên Windows không tự co lại). Dọn định kỳ:
```
docker builder prune -f     # xóa cache build cũ (an toàn, không đụng volume/DB)
docker image prune -f       # xóa image không còn dùng
```
Kiểm tra dung lượng Docker đang chiếm: `docker system df`

## Xử lý sự cố thường gặp

**Build lỗi `no such host` / DNS khi kéo image** (`production.cloudfront.docker.com` hoặc tương tự): lỗi mạng nội bộ của Docker Desktop (WSL2), không phải do code. Thử lại `docker compose up -d --build`; nếu vẫn lỗi, khởi động lại Docker Desktop, hoặc `wsl --shutdown` rồi mở lại Docker Desktop.

**Frontend báo "Không thể kết nối tới máy chủ"**: kiểm tra origin trang đang mở (thanh địa chỉ trình duyệt) có khớp với `ALLOWED_ORIGINS` trong `Backend/.env` không — nếu chạy local mà Vite tự đổi sang cổng khác 5173/5174, thêm origin đó vào `ALLOWED_ORIGINS` rồi khởi động lại backend.

**Chạy cả Docker lẫn local cùng lúc bị xung đột cổng 5173/8080**: chỉ nên chạy 1 trong 2 cách ở mục trên tại một thời điểm — dừng bên còn lại bằng `docker compose stop backend frontend` (nếu ưu tiên local) hoặc tắt các tiến trình `npm run dev`/`uvicorn` local (nếu ưu tiên Docker).
