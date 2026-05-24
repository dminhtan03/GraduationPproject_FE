// ===== SIDEBAR COMPONENT (UniBooking) =====

import React, { useEffect, useState } from "react";
import { Layout, Menu, Typography } from "antd";
import {
  AppstoreOutlined,
  BankOutlined,
  CalendarOutlined,
  RetweetOutlined,
  CheckSquareOutlined,
  VideoCameraOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import { BookOpenIcon } from "@heroicons/react/24/outline";
import { useNavigate, useLocation } from "react-router-dom";
import {
  useAppDispatch,
  useAppSelector,
  selectLayout,
  selectTheme,
  setSidebarCollapsed,
} from "../../store";
import { ROUTES } from "../../constants";

const { Sider } = Layout;
const { Text } = Typography;

const APP_NAME = "UniBooking";

// Sidebar component
const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { sidebarCollapsed } = useAppSelector(selectLayout);
  const { mode } = useAppSelector(selectTheme);
  const [isMobileView, setIsMobileView] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth < 1024 : false,
  );

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobileView(mobile);
      dispatch(setSidebarCollapsed(mobile));
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [dispatch]);

  const menuItems: {
    key: string;
    icon: React.ReactNode;
    label: React.ReactNode;
    children?: { key: string; icon: React.ReactNode; label: React.ReactNode }[];
  }[] = [
    { key: ROUTES.HOME, icon: <HomeOutlined />, label: "Home" },
    { key: ROUTES.ROOM_LIST, icon: <BankOutlined />, label: "Room List" },
    {
      key: ROUTES.AI_ASSISTANT,
      icon: <AppstoreOutlined />,
      label: "AI Assistant",
    },
    {
      key: ROUTES.MY_BOOKINGS,
      icon: <CalendarOutlined />,
      label: "My Bookings",
    },
    // start+ chức năng đặt phòng lặp lại (sidebar tab)
    {
      key: ROUTES.MY_RECURRING_SERIES,
      icon: <RetweetOutlined />,
      label: "Recurring Bookings",
    },
    // end+ chức năng đặt phòng lặp lại (sidebar tab)
    {
      key: ROUTES.TASKS,
      icon: <CheckSquareOutlined />,
      label: "Tasks",
    },
    // {
    //   key: ROUTES.MEETINGS,
    //   icon: <VideoCameraOutlined />,
    //   label: "Meetings",
    // },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
    if (isMobileView) {
      dispatch(setSidebarCollapsed(true));
    }
  };

  const path = location.pathname;
  const selectedKey = path;

  return (
    <>
      {isMobileView && !sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => dispatch(setSidebarCollapsed(true))}
          aria-hidden
        />
      )}

      <Sider
        trigger={null}
        collapsible
        collapsed={sidebarCollapsed}
        width={248}
        collapsedWidth={isMobileView ? 0 : 80}
        theme={mode}
        className={
          isMobileView
            ? "fixed inset-y-0 left-0 z-50"
            : "min-h-screen sticky top-0"
        }
        style={{
          background: mode === "dark" ? "#1f2937" : "#ffffff",
          borderRight: "1px solid #e5e7eb",
        }}
      >
        {/* Logo section - UniBooking */}
        <div className="h-16 flex items-center justify-center border-b border-gray-200 px-2">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "#ff9500" }}
              >
                <BookOpenIcon className="w-5 h-5 text-white" aria-hidden />
              </div>
              <Text strong className="text-lg truncate">
                {APP_NAME}
              </Text>
            </div>
          ) : (
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "#ff9500" }}
            >
              <BookOpenIcon className="w-5 h-5 text-white" aria-hidden />
            </div>
          )}
        </div>

        {/* Navigation menu */}
        <Menu
          theme={mode}
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleMenuClick}
          className="border-r-0 mt-2"
          style={{
            background: mode === "dark" ? "#1f2937" : "#ffffff",
          }}
        />
      </Sider>
    </>
  );
};

export default Sidebar;
