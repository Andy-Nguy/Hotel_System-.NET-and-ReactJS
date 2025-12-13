import React, { useState } from 'react';
import { Modal, Form, Select, Descriptions, Button, Space, message, Spin, Radio } from 'antd';

interface Props {
  visible: boolean;
  bookingId: string | null;
  bookingData: any | null;
  loading?: boolean;
  onSubmit: (data: {
    bookingId: string;
    reason: string;
    depositHandling: 'refund' | 'partial' | 'keep';
    depositPartialAmount?: number;
    notes?: string;
  }) => Promise<void>;
  onCancel: () => void;
}

const ForceCheckoutCancelModal: React.FC<Props> = ({
  visible,
  bookingId,
  bookingData,
  loading = false,
  onSubmit,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      
      await onSubmit({
        bookingId: bookingId || '',
        reason: values.reason,
        depositHandling: values.depositHandling,
        depositPartialAmount: values.depositPartialAmount,
        notes: values.notes,
      });

      form.resetFields();
    } catch (err: any) {
      message.error(err?.message || 'Xác nhận hủy lưu trú thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  // Extract financial info from bookingData
  const roomTotal = Number(bookingData?.money?.roomTotal ?? bookingData?.TongTien ?? 0);
  const serviceTotal = Number(bookingData?.money?.serviceTotal ?? 0);
  const lateFee = Number(bookingData?.money?.lateFee ?? 0);
  const deposit = Number(bookingData?.money?.deposit ?? bookingData?.TienCoc ?? 0);
  const paidAmount = Number(bookingData?.money?.paidAmount ?? 0);
  const unpaidAmount = Math.max(0, (roomTotal + serviceTotal + lateFee) - paidAmount);

  return (
    <Modal
      title="Hủy lưu trú do khách không trả phòng"
      open={visible}
      onCancel={handleCancel}
      width={700}
      centered
      footer={[
        <Button key="cancel" onClick={handleCancel} disabled={submitting}>
          Đóng
        </Button>,
        <Button
          key="submit"
          type="primary"
          danger
          onClick={handleSubmit}
          loading={submitting}
          disabled={submitting || loading}
        >
          Xác nhận Hủy Lưu Trú
        </Button>,
      ]}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : (
        <Spin spinning={submitting}>
          <Form form={form} layout="vertical" disabled={submitting}>
            {/* Lý do hủy */}
            <Form.Item
              label="Lý do hủy lưu trú"
              name="reason"
              rules={[{ required: true, message: 'Vui lòng chọn lý do hủy' }]}
            >
              <Select placeholder="Chọn lý do">
                <Select.Option value="no_checkout">Khách không trả phòng đúng giờ</Select.Option>
                <Select.Option value="no_response">Không phản hồi sau khi liên hệ</Select.Option>
                <Select.Option value="force_process">Xử lý cưỡng chế theo quy trình</Select.Option>
                <Select.Option value="other">Lý do khác</Select.Option>
              </Select>
            </Form.Item>

            {/* Ghi chú bổ sung */}
            <Form.Item label="Ghi chú bổ sung (tuỳ chọn)" name="notes">
              <textarea
                placeholder="Nhập ghi chú thêm (nếu cần)"
                rows={3}
                style={{
                  width: '100%',
                  padding: 8,
                  border: '1px solid #d9d9d9',
                  borderRadius: 6,
                  fontFamily: 'inherit',
                }}
              />
            </Form.Item>

            {/* Thông tin tiền */}
            <div style={{ background: '#fafafa', padding: 16, borderRadius: 8, marginBottom: 16 }}>
              <h4 style={{ marginBottom: 12 }}>Thông tin tiền</h4>
              <Descriptions size="small" column={1} bordered style={{ marginBottom: 12 }}>
                <Descriptions.Item label="Tổng tiền phòng gốc">
                  {roomTotal.toLocaleString()} đ
                </Descriptions.Item>
                <Descriptions.Item label="Tiền dịch vụ">
                  {serviceTotal.toLocaleString()} đ
                </Descriptions.Item>
                <Descriptions.Item label="Phí quá hạn">
                  {lateFee.toLocaleString()} đ
                </Descriptions.Item>
                <Descriptions.Item label="Tiền khách đã thanh toán">
                  {paidAmount.toLocaleString()} đ
                </Descriptions.Item>
                {unpaidAmount > 0 && (
                  <Descriptions.Item label="Số tiền chưa thanh toán (ghi nợ)">
                    <span style={{ color: '#d4380d', fontWeight: 600 }}>
                      {unpaidAmount.toLocaleString()} đ
                    </span>
                  </Descriptions.Item>
                )}
              </Descriptions>

              <h4 style={{ marginBottom: 12 }}>Tiền cọc: {deposit.toLocaleString()} đ</h4>
            </div>

            {/* Xử lý tiền cọc */}
            <Form.Item
              label="Tùy chọn xử lý tiền cọc"
              name="depositHandling"
              initialValue="refund"
              rules={[{ required: true, message: 'Vui lòng chọn cách xử lý tiền cọc' }]}
            >
              <Radio.Group>
                <Space direction="vertical">
                  <Radio value="refund">Hoàn lại cọc</Radio>
                  <Radio value="partial">
                    Giữ lại một phần
                  </Radio>
                  <Radio value="keep">Giữ lại toàn bộ</Radio>
                </Space>
              </Radio.Group>
            </Form.Item>

            {/* Giữ lại một phần - nhập số tiền */}
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) =>
                prevValues.depositHandling !== currentValues.depositHandling
              }
            >
              {({ getFieldValue }) =>
                getFieldValue('depositHandling') === 'partial' ? (
                  <Form.Item
                    label="Số tiền giữ lại"
                    name="depositPartialAmount"
                    rules={[
                      { required: true, message: 'Vui lòng nhập số tiền' },
                      {
                        validator: (_, value) => {
                          const num = Number(value);
                          if (isNaN(num) || num < 0 || num > deposit) {
                            return Promise.reject(new Error(`Nhập số tiền từ 0 đến ${deposit}`));
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <input
                      type="number"
                      placeholder={`0 - ${deposit}`}
                      min={0}
                      max={deposit}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d9d9d9',
                        borderRadius: 6,
                      }}
                    />
                  </Form.Item>
                ) : null
              }
            </Form.Item>
          </Form>
        </Spin>
      )}
    </Modal>
  );
};

export default ForceCheckoutCancelModal;
