import React, { useState } from 'react';
import { Button, Input, message, Spin, Card, Rate, Checkbox, Progress } from 'antd';
import { SendOutlined, CheckCircleOutlined } from '@ant-design/icons';
// Giả định reviewApi và ReviewSubmitPayload đã được định nghĩa
// import reviewApi, { ReviewSubmitPayload } from '../api/review.Api';

// Giả định các kiểu dữ liệu cho môi trường này
interface ReviewSubmitPayload {
  IddatPhong: string;
  Rating: number;
  Title: string;
  Content: string;
  IsAnonym: 1 | 0;
}

// Giả lập API submission
const reviewApi = {
    submitReview: (payload: ReviewSubmitPayload) => new Promise((resolve, reject) => {
        // Giả lập độ trễ API 1.5s
        setTimeout(() => {
            if (Math.random() < 0.95) { // 95% thành công
                resolve({ success: true, payload });
            } else {
                reject(new Error('Lỗi kết nối hoặc dữ liệu không hợp lệ.'));
            }
        }, 1500);
    })
};


const ReviewPage: React.FC = () => {
  // Màu vàng đồng làm màu chủ đạo cho sự sang trọng
  const PRIMARY_COLOR = '#C9A043';
  const ACCENT_BG = '#fefcf5'; // Nền sáng nhẹ nhàng

  // Extract bookingId from URL pathname or hash
  const resolveBookingId = (): string | null => {
    try {
      const p = window.location.pathname;
      const m = p.match(/\/review\/(.+?)(?:$|\/)/);
      if (m) return m[1];
    } catch {}
    try {
      const h = window.location.hash;
      const m = h.match(/\/review\/(.+?)(?:$|\/)/);
      if (m) return m[1];
    } catch {}
    return "DH20251120"; // Giả lập ID cho mục đích demo
  };

  const bookingId = resolveBookingId();

  // Form state
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isAnonym, setIsAnonym] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const contentLength = content.length;
  const contentMax = 500;
  const isValid = rating > 0 && title.trim().length > 0 && contentLength > 0 && contentLength <= contentMax;

  const handleSubmit = async () => {
    if (!bookingId) {
      message.error('Không tìm thấy mã đặt phòng');
      return;
    }

    if (!isValid) {
      message.warning('Vui lòng điền đầy đủ thông tin: đánh giá, tiêu đề, và nội dung (tối đa 500 ký tự)');
      return;
    }

    setLoading(true);
    try {
      const payload: ReviewSubmitPayload = {
        IddatPhong: bookingId,
        Rating: rating,
        Title: title.trim(),
        Content: content.trim(),
        IsAnonym: isAnonym ? 1 : 0,
      };

      // Giả lập gửi API
      await reviewApi.submitReview(payload);
      
      message.success('Cảm ơn bạn đã đánh giá! Ý kiến của bạn rất quý giá với chúng tôi.');
      setSubmitted(true);
      
    } catch (e: any) {
      message.error(e?.message || 'Gửi đánh giá thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // --- UI Lỗi ---
  if (!bookingId) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f9f9f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Card style={{ width: 400, textAlign: 'center', borderRadius: 12, boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }}>
          <h2 style={{ color: '#CC0000' }}>Lỗi</h2>
          <p>Không tìm thấy mã đặt phòng. Vui lòng kiểm tra lại liên kết.</p>
        </Card>
      </div>
    );
  }

  // --- UI Chính ---
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9f9f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 0' }}>
      <Card
        style={{
          width: '100%',
          maxWidth: 550,
          borderRadius: 12,
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.08)',
          padding: 0,
        }}
        bodyStyle={{ padding: 32 }}
      >
        {submitted ? (
          // --- Trạng thái ĐÃ GỬI (Submitted State) ---
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <CheckCircleOutlined style={{ fontSize: 48, color: PRIMARY_COLOR, marginBottom: 16 }} />
            <h2 style={{ margin: 0, fontWeight: 300, fontSize: 26, color: PRIMARY_COLOR, letterSpacing: '1px' }}>
              Đánh giá thành công!
            </h2>
            <p style={{ color: '#666', marginTop: 12, fontSize: 16 }}>
              Cảm ơn bạn đã dành thời gian chia sẻ trải nghiệm.
            </p>

            <div style={{ background: ACCENT_BG, borderLeft: `3px solid ${PRIMARY_COLOR}`, padding: 16, borderRadius: 6, margin: '24px 0' }}>
              <h4 style={{ marginTop: 0, marginBottom: 8, fontWeight: 500 }}>Thông tin đặt phòng</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#666', marginBottom: 6 }}>
                <div>Mã đặt phòng:</div>
                <div style={{ color: '#333', fontWeight: 600 }}>{bookingId}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#666' }}>
                <div>Trạng thái:</div>
                <div style={{ color: PRIMARY_COLOR, fontWeight: 700 }}>Đã gửi đánh giá</div>
              </div>
            </div>
            
            <Button type="default" size="large" onClick={() => (window.location.href = '/')}
              style={{ 
                  borderColor: PRIMARY_COLOR, 
                  color: PRIMARY_COLOR, 
                  fontWeight: 600, 
                  marginTop: 10,
                  borderRadius: 4
              }}>
              Quay về trang chủ
            </Button>
          </div>
        ) : (
          // --- FORM ĐÁNH GIÁ (Review Form) ---
          <Spin spinning={loading}>
            <div>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: 30, borderBottom: '1px solid #eee', paddingBottom: 16 }}>
                <h1 style={{ fontSize: 32, fontWeight: 300, marginBottom: 8, color: '#333', letterSpacing: '1px' }}>
                  Chia sẻ ý kiến của bạn
                </h1>
                <p style={{ color: '#666', fontSize: 14 }}>
                  Mã đặt phòng: <strong>{bookingId}</strong>
                </p>
              </div>

              {/* Rating Section */}
              <div style={{ marginBottom: 30, textAlign: 'center' }}>
                <div style={{ marginBottom: 12, fontWeight: 500, fontSize: 16 }}>
                  Đánh giá tổng thể trải nghiệm (⭐)
                </div>
                <Rate
                  value={rating}
                  onChange={setRating}
                  allowClear={true}
                  style={{ fontSize: 36, color: PRIMARY_COLOR }} // Màu vàng đồng cho Rate
                  tooltips={['Tệ', 'Không tốt', 'Bình thường', 'Tốt', 'Rất tốt']}
                />
              </div>

              {/* Title Section */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>Tiêu đề đánh giá <span style={{ color: PRIMARY_COLOR }}>*</span></div>
                <Input
                  placeholder="Ấn tượng chính của bạn là gì?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  showCount
                  size="large"
                  style={{ borderRadius: 4 }}
                />
              </div>

              {/* Content Section */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>Nội dung chi tiết <span style={{ color: PRIMARY_COLOR }}>*</span></div>
                <Input.TextArea
                  placeholder="Chia sẻ trải nghiệm chi tiết về phòng, dịch vụ,..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={contentMax}
                  rows={5}
                  showCount
                  style={{ borderRadius: 4 }}
                />
                <Progress
                  percent={(contentLength / contentMax) * 100}
                  size="small"
                  status={contentLength > contentMax ? 'exception' : 'normal'}
                  style={{ marginTop: 4, visibility: contentLength > 0 ? 'visible' : 'hidden' }}
                  showInfo={false}
                  strokeColor={contentLength > contentMax ? '#ff4d4f' : PRIMARY_COLOR}
                />
              </div>

              {/* Anonymous Checkbox */}
              <div style={{ marginBottom: 25, textAlign: 'left' }}>
                <Checkbox checked={isAnonym} onChange={(e) => setIsAnonym(e.target.checked)} style={{ color: '#666' }}>
                  Gửi đánh giá ẩn danh
                </Checkbox>
              </div>

              {/* Submit Button */}
              <Button
                type="primary"
                size="large"
                block
                onClick={handleSubmit}
                disabled={!isValid || loading}
                style={{
                  background: isValid ? PRIMARY_COLOR : '#ccc',
                  borderColor: isValid ? PRIMARY_COLOR : '#ccc',
                  height: 48,
                  fontSize: 18,
                  fontWeight: 600,
                  borderRadius: 4,
                  boxShadow: isValid ? `0 4px 8px rgba(201, 160, 67, 0.4)` : 'none'
                }}
                icon={<SendOutlined />}
              >
                GỬI ĐÁNH GIÁ CỦA BẠN
              </Button>

              {/* Help text */}
              <p style={{ marginTop: 15, fontSize: 12, color: '#999', textAlign: 'center' }}>
                Đánh giá của bạn giúp Khách sạn nâng cao chất lượng dịch vụ.
              </p>
            </div>
          </Spin>
        )}
      </Card>
    </div>
  );
};

export default ReviewPage;