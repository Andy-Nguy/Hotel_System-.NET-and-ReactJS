import React, { useEffect, useState, useMemo } from 'react';
import {
  Modal,
  Form,
  Table,
  Input,
  Row,
  Col,
  Divider,
  Space,
  message,
  Typography,
  Card,
  Button,
} from 'antd';
import { DollarCircleOutlined } from '@ant-design/icons';
import checkoutApi from '../../../api/checkout.Api';
import * as serviceApi from '../../../api/serviceApi';

const { Text, Title } = Typography;

interface Props {
  visible: boolean;
  selectedServices: any[];
  servicesTotal?: number;
  form: any;
  onCancel: () => void;
  onSubmit: () => Promise<void> | void;
  bookingId?: string | null;
  readOnly?: boolean;
}

const FormService: React.FC<Props> = ({
  visible,
  selectedServices = [],
  servicesTotal,
  form,
  onCancel,
  onSubmit,
  bookingId,
  readOnly = false,
}) => {
  const [fetchedRows, setFetchedRows] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  // 1) Build rows: READ-ONLY dùng fetchedRows, EDIT dùng selectedServices
  const rows = useMemo(() => {
    if (readOnly) {
      return Array.isArray(fetchedRows) ? fetchedRows : [];
    }

    if (!Array.isArray(selectedServices) || selectedServices.length === 0) {
      return [];
    }

    return selectedServices.map((s: any, idx: number) => {
      const qty = Number(s.quantity ?? s.qty ?? 1) || 1;
      const unitCandidate =
        s?.price ??
        s?.donGia ??
        s?.DonGia ??
        s?.gia ??
        s?.Gia;
      const unit =
        unitCandidate != null
          ? Number(unitCandidate)
          : s?.amount != null
          ? Math.round(Number(s.amount) / Math.max(1, qty))
          : 0;
      const amount =
        s?.amount != null ? Number(s.amount) : unit * qty;

      return {
        key: idx,
        serviceId: s?.serviceId ?? s?.IddichVu ?? s?.iddichVu ?? null,
        serviceName:
          s.serviceName ??
          s.tenDichVu ??
          s.TenDichVu ??
          s.name ??
          `Dịch vụ ${idx + 1}`,
        qty,
        price: Number(unit),
        amount: Number(amount),
        GhiChu: s?.GhiChu ?? s?.ghiChu ?? '',
      };
    });
  }, [readOnly, fetchedRows, selectedServices]);

  const computedTotal = rows.reduce(
    (acc: number, r: any) => acc + Number(r.amount || 0),
    0
  );
  const baseTotal = Number(servicesTotal ?? computedTotal ?? 0);
  const grandTotal = baseTotal; // không VAT trong form này

  // 2) Khi mở modal, set amount theo tổng
  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        amount: grandTotal,
        GhiChu: '',
      });
    }
  }, [visible, grandTotal, form]);

  /**
   * 3) READ-ONLY MODE:
   * Luôn fetch dịch vụ từ Checkout/summary theo bookingId.
   * Không quan tâm selectedServices trong chế độ readOnly.
   */
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!visible) return;
      if (!readOnly) return;
      if (!bookingId) return;

      setLoading(true);
      try {
        const summary = await checkoutApi.getSummary(bookingId as any);

        const svcList =
          summary?.services ??
          summary?.data?.services ??
          summary?.DichVu ??
          summary?.dichVu ??
          summary?.items ??
          [];

        const mapped = Array.isArray(svcList)
          ? svcList.map((s: any, idx: number) => {
              const qty =
                Number(
                  s?.SoLuong ??
                    s?.SoLuongDichVu ??
                    s?.quantity ??
                    1
                ) || 1;

              const unitCandidate =
                s?.DonGia ??
                s?.donGia ??
                s?.DonGiaDichVu ??
                s?.Gia ??
                s?.gia ??
                null;

              const unit =
                unitCandidate != null
                  ? Number(unitCandidate)
                  : s?.TienDichVu != null
                  ? Math.round(
                      Number(s.TienDichVu) / Math.max(1, qty)
                    )
                  : 0;

              const amount =
                s?.TienDichVu ??
                s?.tienDichVu ??
                s?.thanhTien ??
                s?.ThanhTien ??
                unit * qty;

              return {
                key: idx,
                serviceId:
                  s?.IddichVu ??
                  s?.iddichVu ??
                  s?.IDdichVu ??
                  s?.Id ??
                  null,
                serviceName:
                  s?.TenDichVu ??
                  s?.tenDichVu ??
                  s?.Name ??
                  s?.name ??
                  null,
                qty,
                price: Number(unit),
                amount: Number(amount),
                GhiChu: s?.GhiChu ?? s?.ghiChu ?? '',
              };
            })
          : [];

        let finalRows = mapped;

        // Thử enrich tên từ serviceApi nếu thiếu
        try {
          const idsToFetch = Array.from(
            new Set(
              mapped
                .filter(
                  (m: any) => m.serviceId && !m.serviceName
                )
                .map((m: any) => String(m.serviceId))
            )
          );

          if (idsToFetch.length > 0) {
            const fetches = await Promise.all(
              idsToFetch.map((id) =>
                serviceApi
                  .getServiceById(id)
                  .catch(() => null)
              )
            );

            const svcMap: Record<string, any> = {};
            idsToFetch.forEach((id, i) => {
              const raw = fetches[i];
              if (!raw) return;
              const info = (raw as any).data ?? raw;
              svcMap[id] = info;
            });

            const enriched = mapped.map((m: any) => {
              if (!m.serviceId) return m;
              const info = svcMap[String(m.serviceId)];
              if (!info) return m;

              // Chỉ override nếu serviceName đang null
              if (
                m.serviceName &&
                !m.serviceName
                  .toString()
                  .startsWith('Dịch vụ')
              ) {
                return m;
              }

              const name =
                info?.TenDichVu ??
                info?.tenDichVu ??
                info?.Name ??
                info?.name ??
                `Dịch vụ ${m.key + 1}`;

              return { ...m, serviceName: name };
            });

            finalRows = enriched;
          }
        } catch (e) {
          // ignore enrich error, dùng mapped
        }

        if (!mounted) return;
        setFetchedRows(finalRows);
        form.setFieldsValue({
          amount: finalRows.reduce(
            (a: number, b: any) =>
              a + Number(b.amount || 0),
            0
          ),
        });
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [visible, readOnly, bookingId, form]);

  // 4) Lưu DV trong chế độ thêm (không dùng trong readOnly)
  const handleOk = async () => {
    try {
      await form.validateFields();

      if (!bookingId)
        throw new Error(
          'Không xác định đặt phòng để thêm dịch vụ'
        );
      if (!rows || rows.length === 0)
        throw new Error('Không có dịch vụ để lưu');

      const payload = {
        IDDatPhong: bookingId,
        DichVu: (selectedServices || []).map(
          (src: any, idx: number) => ({
            IddichVu: src?.serviceId
              ? String(src.serviceId)
              : null,
            TenDichVu:
              src?.serviceName ??
              src?.tenDichVu ??
              `Dịch vụ ${idx + 1}`,
            DonGia: Math.round(
              Number(src?.price ?? src?.donGia ?? 0) || 0
            ),
            TongTien: Math.round(
              Number(
                src?.amount ??
                  (src?.price ?? 0) *
                    (src?.quantity ?? 1)
              ) || 0
            ),
            TienDichVu: Math.round(
              Number(
                src?.amount ??
                  (src?.price ?? 0) *
                    (src?.quantity ?? 1)
              ) || 0
            ),
            GhiChu: src?.GhiChu ?? '',
          })
        ),
      };

      await checkoutApi.addServiceToInvoice(payload);
      message.success('Thêm dịch vụ thành công');
      if (typeof onSubmit === 'function') await onSubmit();
    } catch (e: any) {
      message.error(
        e?.message || 'Thêm dịch vụ thất bại'
      );
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={onCancel}
      onOk={!readOnly ? handleOk : undefined}
      okText={
        !readOnly ? 'Xác nhận thêm dịch vụ' : undefined
      }
      footer={
        readOnly
          ? [
              <Button key="close" onClick={onCancel}>
                Đóng
              </Button>,
            ]
          : undefined
      }
      cancelText="Hủy bỏ"
      width={900}
      centered
      closeIcon={null}
      maskClosable={false}
      styles={{
        body: {
          padding: '32px 40px',
          backgroundColor: '#fafafa',
        },
        header: { borderBottom: 'none', paddingBottom: 0 },
        footer: { borderTop: 'none', paddingTop: 24 },
      }}
      title={
        <div
          style={{
            textAlign: 'center',
            padding: '16px 0 24px',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              background:
                'linear-gradient(135deg, #1677ff, #40a9ff)',
              borderRadius: '50%',
              marginBottom: 16,
            }}
          >
            <DollarCircleOutlined
              style={{ fontSize: 32, color: '#fff' }}
            />
          </div>
          <Title
            level={3}
            style={{ margin: 0, color: '#1f1f1f' }}
          >
            Thêm dịch vụ bổ sung
          </Title>
          <Text
            type="secondary"
            style={{ fontSize: 14 }}
          >
            Vui lòng kiểm tra lại thông tin trước khi
            xác nhận
          </Text>
        </div>
      }
    >
      <Form form={form} layout="vertical">
        <Card
          bordered={false}
          style={{
            marginBottom: 24,
            borderRadius: 12,
            boxShadow:
              '0 4px 12px rgba(0,0,0,0.05)',
          }}
          bodyStyle={{ padding: 24 }}
        >
          <Title
            level={4}
            style={{ marginBottom: 20, color: '#262626' }}
          >
            Chi tiết dịch vụ
          </Title>

          {loading ? (
            <div
              style={{
                textAlign: 'center',
                padding: '32px 8px',
              }}
            >
              Đang tải dữ liệu dịch vụ...
            </div>
          ) : rows.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 24px',
                backgroundColor: '#f5f5f5',
                borderRadius: 12,
                border: '2px dashed #d9d9d9',
              }}
            >
              <Text
                type="secondary"
                style={{ fontSize: 16 }}
              >
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
              style={{
                borderRadius: 8,
                overflow: 'hidden',
              }}
              columns={[
                {
                  title: (
                    <Text
                      strong
                      style={{ color: '#595959' }}
                    >
                      Tên dịch vụ
                    </Text>
                  ),
                  dataIndex: 'serviceName',
                  render: (text: string) => (
                    <Text
                      strong
                      style={{ fontSize: 15 }}
                    >
                      {text}
                    </Text>
                  ),
                },
                {
                  title: (
                    <Text
                      strong
                      style={{ color: '#595959' }}
                    >
                      SL
                    </Text>
                  ),
                  dataIndex: 'qty',
                  align: 'center',
                  width: 80,
                  render: (v: number) => (
                    <Text strong>{v}</Text>
                  ),
                },
                {
                  title: (
                    <Text
                      strong
                      style={{ color: '#595959' }}
                    >
                      Đơn giá
                    </Text>
                  ),
                  dataIndex: 'price',
                  align: 'right',
                  width: 150,
                  render: (v: number) => (
                    <Text
                      style={{
                        fontFamily:
                          'Roboto Mono, monospace',
                      }}
                    >
                      {Number(v || 0).toLocaleString(
                        'vi-VN'
                      )}{' '}
                      đ
                    </Text>
                  ),
                },
                {
                  title: (
                    <Text
                      strong
                      style={{ color: '#595959' }}
                    >
                      Thành tiền
                    </Text>
                  ),
                  dataIndex: 'amount',
                  align: 'right',
                  width: 180,
                  render: (v: number) => (
                    <Text
                      strong
                      style={{
                        color: '#1677ff',
                        fontSize: 16,
                        fontFamily:
                          'Roboto Mono, monospace',
                      }}
                    >
                      {Number(v || 0).toLocaleString(
                        'vi-VN'
                      )}{' '}
                      đ
                    </Text>
                  ),
                },
              ]}
            />
          )}
        </Card>

        <Card
          bordered={false}
          style={{
            borderRadius: 12,
            background:
              'linear-gradient(135deg, #e6f7ff, #f0f5ff)',
          }}
          bodyStyle={{ padding: '20px 32px' }}
        >
          <Row
            justify="space-between"
            align="middle"
          >
            <Col>
              <Space
                direction="vertical"
                size={4}
              >
                <Text
                  strong
                  style={{
                    fontSize: 16,
                    color: '#262626',
                  }}
                >
                  Tổng tiền dịch vụ
                </Text>
                <Text type="secondary">
                  {rows.length} mục
                </Text>
              </Space>
            </Col>
            <Col>
              <Title
                level={2}
                style={{
                  margin: 0,
                  color: '#1677ff',
                }}
              >
                {Number(
                  grandTotal || 0
                ).toLocaleString('vi-VN')}{' '}
                đ
              </Title>
            </Col>
          </Row>

          <Form.Item
            name="amount"
            style={{ display: 'none' }}
          >
            <Input />
          </Form.Item>
        </Card>

        <Divider style={{ margin: '32px 0 24px' }} />

        <Form.Item
          name="GhiChu"
          label={
            <Text
              strong
              style={{ fontSize: 15 }}
            >
              {readOnly
                ? 'Ghi chú'
                : 'Ghi chú thêm (nếu có)'}
            </Text>
          }
        >
          <Input.TextArea
            rows={4}
            placeholder="Ví dụ: Sử dụng dịch vụ vào 19:00, yêu cầu thêm khăn sạch, phục vụ tại phòng 305..."
            style={{
              borderRadius: 10,
              fontSize: 14,
              resize: 'none' as const,
            }}
            autoSize={{ minRows: 4, maxRows: 6 }}
            readOnly={readOnly}
            disabled={readOnly}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default FormService;