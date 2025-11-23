export const getStatusLabel = (status: number) => {
  switch (status) {
    case 0:
      return "Đã hủy";
    case 1:
      return "Chờ xác nhận";
    case 2:
      return "Đã xác nhận";
    case 3:
      return "Đang dùng";
    case 4:
      return "Hoàn thành";
    default:
      return "Chưa rõ";
  }
};

export const getStatusColor = (status: number) => {
  switch (status) {
    case 0:
      return "error";
    case 1:
      return "warning";
    case 2:
      return "success";
    case 3:
      return "processing";
    case 4:
      return "default";
    default:
      return "default";
  }
};

export const getPaymentStatusLabel = (status: number) => {
  switch (status) {
    case 0:
      return "Đã đặt cọc";
    case 1:
      return "Chưa thanh toán";
    case 2:
      return "Đã thanh toán";
    default:
      return "Chưa rõ";
  }
};

export const getPaymentStatusColor = (status: number) => {
  switch (status) {
    case 0:
      return "warning";
    case 1:
      return "error";
    case 2:
      return "success";
    default:
      return "default";
  }
};
