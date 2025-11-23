import React from "react";
import { Table } from "antd";
import type { TableProps } from "antd";

interface DataTableProps<T> extends TableProps<T> {
  // You can add custom props here if needed in the future
}

const DataTable = <T extends object>(props: DataTableProps<T>) => {
  return (
    <Table
      {...props}
      pagination={
        props.pagination !== false
          ? {
              position: ["bottomCenter"],
              showSizeChanger: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} của ${total} mục`,
              defaultPageSize: 10,
              pageSizeOptions: ["10", "20", "50"],
              ...props.pagination,
            }
          : false
      }
      scroll={{ x: "max-content" }}
      style={{ background: "#fff", borderRadius: 8, overflow: "hidden" }}
    />
  );
};

export default DataTable;
