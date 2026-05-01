import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  Button,
  Input,
  Select,
  Modal,
  Tag,
  Space,
  Rate,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { EyeIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

import AdminSidebar from "../../components/Layout/AdminSidebar";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";
import { adminService } from "../../services/adminService";
import { logout } from "../../services/authService";
import { ROUTES } from "../../constants";
import { api } from "../../services/api";
import { API_ENDPOINTS } from "../../constants/endpoints";

const { Text } = Typography;

interface AdminFeedback {
  id: string;
  roomId: string;
  roomName: string;
  userId: string;
  userName: string;
  rating: number;
  description: string;
  createdAt: string;
  buildingName: string;
  floorName: string;
  userEmail: string;
}

const AdminFeedbackManagement: React.FC = () => {
  const navigate = useNavigate();
  const [feedbacks, setFeedbacks] = useState<AdminFeedback[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [total, setTotal] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Filters
  const [filterRating, setFilterRating] = useState<number | undefined>(undefined);
  const [filterEmail, setFilterEmail] = useState<string>("");
  const [searchEmail, setSearchEmail] = useState<string>("");

  // Current admin user info
  const [adminName, setAdminName] = useState<string>("Admin");
  const [adminEmail, setAdminEmail] = useState<string>("");

  // Toast
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(null);

  // Modal
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [selectedFeedback, setSelectedFeedback] = useState<AdminFeedback | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    fetchFeedbacks();
  }, [currentPage, pageSize, filterRating, filterEmail]);

  // Auto search when searchEmail changes (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filterEmail !== searchEmail) {
        setCurrentPage(1);
        setFilterEmail(searchEmail);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchEmail, filterEmail]);

  const loadProfile = async () => {
    try {
      const res = await api.get<any>(API_ENDPOINTS.AUTH.PROFILE);
      const data = res.data?.data || res.data;
      setAdminName([data.firstName, data.lastName].filter(Boolean).join(" ") || "Admin User");
      setAdminEmail(data.email || "");
    } catch {
      // Ignore
    }
  };

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const result = await adminService.getAllFeedbacks(
        currentPage - 1,
        pageSize,
        {
          rating: filterRating,
          email: filterEmail || undefined,
        }
      );
      
      let items: AdminFeedback[] = [];
      if (Array.isArray(result)) {
        items = result;
      } else if (Array.isArray(result?.content)) {
        items = result.content;
      } else if (Array.isArray(result?.data)) {
        items = result.data;
      } else if (Array.isArray(result?.items)) {
        items = result.items;
      }

      const totalItems = result?.totalElements || result?.total || items.length;
      
      setFeedbacks(items);
      setTotal(totalItems);
    } catch (err: any) {
      setToast({
        type: "error",
        message: err?.response?.data?.message || err.message || "Failed to fetch feedbacks",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  const handleRatingChange = (value: number | undefined) => {
    setCurrentPage(1);
    setFilterRating(value);
  };

  const showDetail = async (id: string) => {
    setIsModalVisible(true);
    setDetailLoading(true);
    try {
      const detail = await adminService.getFeedbackDetail(id);
      setSelectedFeedback(detail);
    } catch (err: any) {
      setToast({
        type: "error",
        message: err?.response?.data?.message || "Failed to load feedback detail",
      });
      setIsModalVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const columns: ColumnsType<AdminFeedback> = [
    {
      title: "User",
      key: "user",
      render: (_, record) => (
        <div>
          <div className="text-sm font-semibold text-slate-900">{record.userName || "-"}</div>
          <div className="text-xs text-slate-500">{record.userEmail || "-"}</div>
        </div>
      ),
    },
    {
      title: "Room",
      dataIndex: "roomName",
      key: "roomName",
      render: (text) => (
        <div className="font-medium text-slate-800">{text || "-"}</div>
      ),
    },
    {
      title: "Rating",
      dataIndex: "rating",
      key: "rating",
      align: "center",
      render: (rating: number) => <Rate disabled defaultValue={rating} className="text-sm" />,
    },
    {
      title: "Content",
      dataIndex: "description",
      key: "description",
      render: (text: string) => (
        <div className="max-w-xs truncate text-sm text-slate-600" title={text}>
          {text || <span className="italic text-gray-400">No content</span>}
        </div>
      ),
    },
    {
      title: "Created At",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (dateStr: string) => (
        <span className="text-sm">
          {dateStr ? new Date(dateStr).toLocaleString("vi-VN") : "-"}
        </span>
      ),
    },
    {
      title: "Action",
      key: "action",
      align: "center",
      render: (_, record) => (
        <Button
          type="text"
          icon={<EyeIcon className="h-5 w-5 text-blue-600" />}
          onClick={() => showDetail(record.id)}
          className="flex items-center justify-center hover:bg-blue-50"
        />
      ),
    },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      <AdminSidebar
        adminName={adminName}
        adminEmail={adminEmail}
        onLogout={handleLogout}
        mobileOpen={false}
        onCloseMobile={() => {}}
      />

      <main className="flex-1 lg:pl-72">
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Feedback Management</h1>
              <p className="mt-1 text-sm text-slate-500">
                View user feedbacks across all buildings and rooms.
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Filter & Search</h2>
              {(searchEmail || filterRating !== undefined) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchEmail("");
                    setFilterRating(undefined);
                  }}
                  className="text-xs font-semibold text-orange-600 hover:text-orange-700 underline underline-offset-2 transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Search User Email
                </label>
                <Input
                  placeholder="Enter email to search..."
                  allowClear
                  prefix={<MagnifyingGlassIcon className="mr-1 h-5 w-5 text-slate-400" />}
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  className="flex h-11 w-full items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm transition-colors hover:border-slate-300 focus-within:border-slate-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-100"
                />
              </div>
              <div className="lg:col-span-1">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Filter by Rating
                </label>
                <Select
                  className="w-full [&_.ant-select-selector]:!h-11 [&_.ant-select-selector]:!flex [&_.ant-select-selector]:!items-center [&_.ant-select-selector]:!rounded-xl [&_.ant-select-selector]:!border-slate-200 [&_.ant-select-selector]:!bg-slate-50 [&_.ant-select-selector]:!px-3 [&_.ant-select-selector]:!text-slate-700 [&_.ant-select-selector]:hover:!border-slate-300"
                  placeholder="All Ratings"
                  allowClear
                  value={filterRating}
                  onChange={handleRatingChange}
                  options={[
                    { value: 5, label: "⭐⭐⭐⭐⭐ (5)" },
                    { value: 4, label: "⭐⭐⭐⭐ (4)" },
                    { value: 3, label: "⭐⭐⭐ (3)" },
                    { value: 2, label: "⭐⭐ (2)" },
                    { value: 1, label: "⭐ (1)" },
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <Table
              columns={columns}
              dataSource={feedbacks}
              rowKey="id"
              loading={loading}
              pagination={{
                current: currentPage,
                pageSize: pageSize,
                total: total,
                showSizeChanger: true,
                onChange: (page, size) => {
                  setCurrentPage(page);
                  setPageSize(size);
                },
                showTotal: (total) => `Total ${total} items`,
                className: "px-4",
              }}
              className="ant-table-striped overflow-hidden"
            />
          </div>
        </div>

        {/* Detail Modal */}
        <Modal
          title={<div className="text-lg font-bold text-slate-800">Feedback Detail</div>}
          open={isModalVisible}
          onCancel={() => setIsModalVisible(false)}
          footer={[
            <Button key="close" type="primary" onClick={() => setIsModalVisible(false)}>
              Close
            </Button>
          ]}
          width={600}
        >
          {detailLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
            </div>
          ) : selectedFeedback ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Text className="text-xs font-semibold uppercase text-slate-500">User</Text>
                    <div className="font-medium text-slate-900">{selectedFeedback.userName || "-"}</div>
                    <div className="text-sm text-slate-500">{selectedFeedback.userEmail || "-"}</div>
                  </div>
                  <div>
                    <Text className="text-xs font-semibold uppercase text-slate-500">Date</Text>
                    <div className="text-sm text-slate-800">
                      {selectedFeedback.createdAt ? new Date(selectedFeedback.createdAt).toLocaleString("vi-VN") : "-"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Text className="text-xs font-semibold uppercase text-slate-500">Location</Text>
                    <div className="font-medium text-slate-900">{selectedFeedback.roomName || "-"}</div>
                    <div className="text-sm text-slate-500">
                      {selectedFeedback.buildingName || "-"} &bull; {selectedFeedback.floorName || "-"}
                    </div>
                  </div>
                  <div>
                    <Text className="text-xs font-semibold uppercase text-slate-500">Rating</Text>
                    <div className="mt-1">
                      <Rate disabled defaultValue={selectedFeedback.rating} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 shadow-sm">
                <Text className="text-xs font-semibold uppercase text-slate-500 mb-2 block">Content</Text>
                <div className="whitespace-pre-wrap text-sm text-slate-700 min-h-[80px]">
                  {selectedFeedback.description || <span className="italic text-gray-400">No content provided by the user.</span>}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-500 py-8">No detail available</div>
          )}
        </Modal>

        {toast && (
          <CustomMessage
            type={toast.type}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        )}
      </main>
    </div>
  );
};

export default AdminFeedbackManagement;
