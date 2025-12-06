import React, { useEffect } from 'react';
import { Modal, Form, Table, Input, Row, Col, Divider, Space, message, Typography, Card } from 'antd';
import { DollarCircleOutlined } from '@ant-design/icons';
import checkoutApi from '../../../api/checkout.Api';

const { Text, Title } = Typography;

interface Props {
  visible: boolean;
  selectedServices: any[];
  servicesTotal?: number;
  form: any;
  onCancel: () => void;
  onSubmit: () => Promise<void> | void;
  bookingId?: string | null;
}

const FormService: React.FC<Props> = ({
  visible,
  selectedServices = [],
  servicesTotal,
  form,
  onCancel,
  onSubmit,
  bookingId
}) => {
  const rows = Array.isArray(selectedServices)
    ? selectedServices.map((s: any, idx: number) => ({
        key: idx,
        serviceName: s.serviceName ?? s.tenDichVu ?? s.name ?? `Dịch vụ ${idx + 1}`,
        qty: Number(s.quantity ?? s.qty ?? 1),
        price: Number(s.price ?? s.donGia ?? 0),
        amount: Number(s.amount ?? (s.price ?? 0) * (s.quantity ?? 1))
      }))
    : [];

  const computedTotal = rows.reduce((acc: number, r: any) => acc + Number(r.amount || 0), 0);
  // base total prefers parent-provided servicesTotal, otherwise computed from rows
  const baseTotal = Number(servicesTotal ?? computedTotal ?? 0);
  // No VAT on this form: use service base total only
  const vat = 0;
  const grandTotal = baseTotal; // renamed but holds base total (no VAT)
  const total = baseTotal;

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        // amount holds the total service amount (no VAT)
        amount: grandTotal,
        GhiChu: ''
      });
    }
  }, [visible, total, form]);

  const handleOk = async () => {
    try {
      await form.validateFields();

      if (!bookingId) throw new Error('Không xác định đặt phòng để thêm dịch vụ');
      if (!rows || rows.length === 0) throw new Error('Không có dịch vụ để lưu');

      const payload = {
        IDDatPhong: bookingId,
        DichVu: (selectedServices || []).map((src: any, idx: number) => ({
          IddichVu: src?.serviceId ? String(src.serviceId) : null,
          TenDichVu: src?.serviceName ?? src?.tenDichVu ?? `Dịch vụ ${idx + 1}`,
          DonGia: Math.round(Number(src?.price ?? src?.donGia ?? 0) || 0),
          TongTien: Math.round(Number(src?.amount ?? (src?.price ?? 0) * (src?.quantity ?? 1)) || 0),
          TienDichVu: Math.round(Number(src?.amount ?? (src?.price ?? 0) * (src?.quantity ?? 1)) || 0),
          GhiChu: src?.GhiChu ?? ''
        }))
      };

      await checkoutApi.addServiceToInvoice(payload);
      message.success('Thêm dịch vụ thành công');
      if (typeof onSubmit === 'function') await onSubmit();
    } catch (e: any) {
      message.error(e?.message || 'Thêm dịch vụ thất bại');
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={onCancel}
      onOk={handleOk}
      okText="Xác nhận thêm dịch vụ"
      cancelText="Hủy bỏ"
      width={900}
      centered
      closeIcon={null}
      maskClosable={false}
      styles={{
        body: { padding: '32px 40px', backgroundColor: '#fafafa' },
        header: { borderBottom: 'none', paddingBottom: 0 },
        footer: { borderTop: 'none', paddingTop: 24 }
      }}
      title={
        <div style={{ textAlign: 'center', padding: '16px 0 24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            background: 'linear-gradient(135deg, #1677ff, #40a9ff)',
            borderRadius: '50%',
            marginBottom: 16
          }}>
            <DollarCircleOutlined style={{ fontSize: 32, color: '#fff' }} />
          </div>
          <Title level={3} style={{ margin: 0, color: '#1f1f1f' }}>
            Thêm dịch vụ bổ sung
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Vui lòng kiểm tra lại thông tin trước khi xác nhận
          </Text>
        </div>
      }
    >
      <Form form={form} layout="vertical">
        {/* Danh sách dịch vụ - dùng Card để nổi bật */}
        <Card
          bordered={false}
          style={{ marginBottom: 24, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
          bodyStyle={{ padding: 24 }}
        >
          <Title level={4} style={{ marginBottom: 20, color: '#262626' }}>
            Chi tiết dịch vụ
          </Title>

          {rows.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 24px',
              backgroundColor: '#f5f5f5',
              borderRadius: 12,
              border: '2px dashed #d9d9d9'
            }}>
              <Text type="secondary" style={{ fontSize: 16 }}>
                Chưa có dịch vụ nào được chọn
              </Text>
            </div>
          ) : (
            <Table
              dataSource={rows}
              pagination={false}
              size="large"
              showHeader={true}
              rowKey="key"
              style={{ borderRadius: 8, overflow: 'hidden' }}
              columns={[
                {
                  title: <Text strong style={{ color: '#595959' }}>Tên dịch vụ</Text>,
                  dataIndex: 'serviceName',
                  render: (text: string) => <Text strong style={{ fontSize: 15 }}>{text}</Text>
                },
                {
                  title: <Text strong style={{ color: '#595959' }}>SL</Text>,
                  dataIndex: 'qty',
                  align: 'center',
                  width: 80,
                  render: (v: number) => <Text strong>{v}</Text>
                },
                {
                  title: <Text strong style={{ color: '#595959' }}>Đơn giá</Text>,
                  dataIndex: 'price',
                  align: 'right',
                  width: 150,
                  render: (v: number) => (
                    <Text style={{ fontFamily: 'Roboto Mono, monospace' }}>
                      {Number(v || 0).toLocaleString('vi-VN')} đ
                    </Text>
                  )
                },
                {
                  title: <Text strong style={{ color: '#595959' }}>Thành tiền</Text>,
                  dataIndex: 'amount',
                  align: 'right',
                  width: 180,
                  render: (v: number) => (
                    <Text strong style={{ color: '#1677ff', fontSize: 16, fontFamily: 'Roboto Mono, monospace' }}>
                      {Number(v || 0).toLocaleString('vi-VN')} đ
                    </Text>
                  )
                }
              ]}
            />
          )}
        </Card>

        {/* Tổng tiền - nổi bật hơn */}
        <Card
          bordered={false}
          style={{ borderRadius: 12, background: 'linear-gradient(135deg, #e6f7ff, #f0f5ff)' }}
          bodyStyle={{ padding: '20px 32px' }}
        >
          <Row justify="space-between" align="middle">
            <Col>
                <Space direction="vertical" size={4}>
                <Text strong style={{ fontSize: 16, color: '#262626' }}>Tổng tiền dịch vụ</Text>
                <Text type="secondary">{rows.length} mục</Text>
              </Space>
            </Col>
            <Col>
              <Title level={2} style={{ margin: 0, color: '#1677ff' }}>
                {Number(grandTotal || 0).toLocaleString('vi-VN')} đ
              </Title>
            </Col>
          </Row>

          {/* Hidden field */}
          {/* amount holds the total including VAT */}
          <Form.Item name="amount" style={{ display: 'none' }}>
            <Input />
          </Form.Item>
        </Card>

        <Divider style={{ margin: '32px 0 24px' }} />

        {/* Ghi chú */}
        <Form.Item
          name="GhiChu"
          label={<Text strong style={{ fontSize: 15 }}>Ghi chú thêm (nếu có)</Text>}
        >
          <Input.TextArea
            rows={4}
            placeholder="Ví dụ: Sử dụng dịch vụ vào 19:00, yêu cầu thêm khăn sạch, phục vụ tại phòng 305..."
            style={{
              borderRadius: 10,
              fontSize: 14,
              resize: 'none' as const
            }}
            autoSize={{ minRows: 4, maxRows: 6 }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default FormService;