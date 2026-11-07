// Chạy test trong cùng process để không phụ thuộc việc spawn tiến trình con
// (một số môi trường sandbox chặn piped stdio).
import './app.test.js';
