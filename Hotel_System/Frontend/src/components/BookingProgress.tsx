import React from "react";
import { Steps } from "antd";
import { CreditCardOutlined, CheckCircleOutlined } from "@ant-design/icons";

interface BookingProgressProps {
  totalRooms?: number;
  // 'select' = user is selecting rooms; 'checkout' = payment page; 'complete' = finished
  currentStage?: "select" | "checkout" | "complete";
  currentRoom?: number; // 1-based current room when selecting
  selectedRoomNumbers?: number[]; // list of selected room numbers (1-based)
}

const BookingProgress: React.FC<BookingProgressProps> = ({
  totalRooms = 1,
  currentStage = "select",
  currentRoom = 1,
  selectedRoomNumbers = [],
}) => {
  const items: any[] = [];

  for (let i = 1; i <= totalRooms; i++) {
    const finished = selectedRoomNumbers.includes(i);
    const isCurrent = currentStage === "select" && currentRoom === i;
    const status = finished ? "finish" : isCurrent ? "process" : "wait";
    items.push({
      title: `Phòng ${i}`,
      status,
      icon: finished ? <CheckCircleOutlined /> : undefined,
    });
  }

  // Thanh toán
  const paymentStatus =
    currentStage === "checkout"
      ? "process"
      : currentStage === "complete"
      ? "finish"
      : "wait";
  items.push({
    title: "Thanh toán",
    status: paymentStatus,
    icon: <CreditCardOutlined />,
  });

  // Hoàn tất
  items.push({
    title: "Hoàn tất",
    status: currentStage === "complete" ? "finish" : "wait",
    icon: <CheckCircleOutlined />,
  });

  // Determine current index for Steps component (first non-finished step)
  let currentIndex = items.findIndex((it) => it.status === "process");
  if (currentIndex === -1) {
    // fallback: first wait item
    currentIndex = items.findIndex((it) => it.status === "wait");
    if (currentIndex === -1) currentIndex = items.length - 1;
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto 24px auto" }}>
      <Steps current={currentIndex} items={items} />
    </div>
  );
};

export default BookingProgress;
