import React, { useEffect, useMemo, useState } from "react";
import { Card, List, Space, Tag, Typography, Select, Skeleton, Empty, Tooltip } from "antd";
import { PercentageOutlined, CalendarOutlined, AppstoreOutlined } from "@ant-design/icons";
import { getAllPromotions, type PromotionResponse } from "../api/promotionApi";

const { Text } = Typography;

type FilterMode = "room" | "season" | "all";

interface Props {
  roomIds: (string | number)[];
  title?: string;
  compact?: boolean;
}

const seasonOptions = [
  { label: "Tất cả", value: "all" },
  { label: "Xuân (3-5)", value: "spring", months: [3, 4, 5] },
  { label: "Hè (6-8)", value: "summer", months: [6, 7, 8] },
  { label: "Thu (9-11)", value: "autumn", months: [9, 10, 11] },
  { label: "Đông (12-2)", value: "winter", months: [12, 1, 2] },
];

function dateOnlyToDate(iso: string) {
  // Accept both ISO date or DateOnly-like 'yyyy-MM-dd'
  const d = new Date(iso as any);
  return isNaN(d.getTime()) ? new Date(`${iso}T00:00:00`) : d;
}

function overlapsSeason(p: PromotionResponse, months: number[]) {
  const start = dateOnlyToDate(p.ngayBatDau);
  const end = dateOnlyToDate(p.ngayKetThuc);
  // Iterate months between start and end and check if any month is in season
  const cur = new Date(start);
  while (cur <= end) {
    const m = cur.getMonth() + 1; // 1..12
    if (months.includes(m)) return true;
    // move to first day of next month
    cur.setMonth(cur.getMonth() + 1, 1);
  }
  return false;
}

const PromotionsAvailable: React.FC<Props> = ({ roomIds, title = "Khuyến mãi hiện có", compact }) => {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<PromotionResponse[]>([]);
  const [mode, setMode] = useState<FilterMode>("room");
  const [season, setSeason] = useState<string>("all");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getAllPromotions(roomIds.map(String));
        setList(data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [roomIds.join(",")]);

  const filtered = useMemo(() => {
    if (mode === "all") return list;
    if (mode === "room") {
        // show active or applicable promos for these rooms
        const mappedRoomIds = roomIds.map(String);
        return list.filter(p => p.danhSachPhongApDung?.some((id: string) => mappedRoomIds.includes(id)) || p.isApplicable);
      }
    // season filter
    const opt = seasonOptions.find(o => o.value === season);
    if (!opt || !("months" in opt)) return list;
    return list.filter(p => overlapsSeason(p, (opt as any).months));
  }, [list, mode, season, roomIds]);

  return (
    <Card title={<Space size={8}><AppstoreOutlined /> <span>{title}</span></Space>} size={compact ? "small" : undefined}>
      <Space style={{ marginBottom: 8 }} wrap>
        <Select
          value={mode}
          onChange={setMode}
          options={[
            { label: "Theo phòng", value: "room" },
            { label: "Theo mùa", value: "season" },
            { label: "Tất cả", value: "all" },
          ]}
          size={compact ? "small" : "middle"}
        />
        {mode === "season" && (
          <Select
            value={season}
            onChange={setSeason}
            options={seasonOptions}
            size={compact ? "small" : "middle"}
          />
        )}
        <Tooltip title="Khuyến mãi theo dịch vụ sẽ hiển thị khi backend cung cấp dữ liệu liên kết dịch vụ.">
          <Tag>Khuyến mãi theo dịch vụ: chưa hỗ trợ</Tag>
        </Tooltip>
      </Space>

      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : filtered.length === 0 ? (
        <Empty description="Không có khuyến mãi phù hợp" />
      ) : (
        <List
          size={compact ? "small" : "large"}
          dataSource={filtered}
          renderItem={(p: PromotionResponse) => (
            <List.Item>
              <Space direction="vertical" size={2} style={{ width: "100%" }}>
                <Space wrap>
                  <Tag color={p.loaiGiamGia === 'percent' ? 'volcano' : 'green'}>
                    {p.loaiGiamGia === 'percent' ? <><PercentageOutlined /> {p.giaTriGiam}%</> : `-${p.giaTriGiam.toLocaleString()}đ`}
                  </Tag>
                  <Tag color={p.trangThai === 'active' ? 'blue' : p.trangThai === 'upcoming' ? 'gold' : 'default'}>
                    {p.trangThai}
                  </Tag>
                  {p.isApplicable && <Tag color="geekblue">Áp dụng</Tag>}
                </Space>
                <Text strong>{p.tenKhuyenMai}</Text>
                {p.moTa && <Text type="secondary" style={{ fontSize: 12 }}>{p.moTa}</Text>}
                <Space size={8} style={{ fontSize: 12, color: '#666' }}>
                  <CalendarOutlined />
                  <span>{p.ngayBatDau} → {p.ngayKetThuc}</span>
                </Space>
              </Space>
            </List.Item>
          )}
        />
      )}
    </Card>
  );
};

export default PromotionsAvailable;
