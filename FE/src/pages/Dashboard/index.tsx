// ===== DASHBOARD PAGE COMPONENT =====

import React, { useEffect, useState } from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Button,
  Tag,
  Alert,
  Table,
  Space,
  Progress,
  Badge,
  Spin,
  Empty,
} from "antd";
import {
  WifiOutlined,
  DisconnectOutlined,
  ReloadOutlined,
  LineChartOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import {
  useAppDispatch,
  useAppSelector,
  selectLiveData,
  fetchLiveData,
  updateLiveData,
} from "../../store";
import websocketService from "../../websocket/websocketService";
import type { DemoData, WebSocketMessage } from "../../types";
import { formatNumber, formatDate } from "../../utils/helpers";

const { Title, Text, Paragraph } = Typography;

// Dashboard page component
const DashboardPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const liveData = useAppSelector(selectLiveData);
  const [connectionTime, setConnectionTime] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);

  // WebSocket connection management
  const connect = async () => {
    try {
      setIsConnecting(true);
      setWsError(null);
      await websocketService.connect();
      setIsConnected(true);
      setConnectionTime(new Date());
    } catch (error) {
      setWsError(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    websocketService.disconnect();
    setIsConnected(false);
    setConnectionTime(null);
  };  // Setup WebSocket listeners
  useEffect(() => {
    const handleDataUpdate = (message: WebSocketMessage) => {
      if (message.type === "update" && message.data) {
        const newData = message.data as DemoData;
        // Update live data in store with single data point
        dispatch(updateLiveData([newData]));
      }
    };

    // Register listener
    websocketService.on("data", handleDataUpdate);

    // Cleanup
    return () => {
      websocketService.off("data", handleDataUpdate);
    };
  }, [dispatch]);

  // Track connection time
  useEffect(() => {
    if (isConnected && !connectionTime) {
      setConnectionTime(new Date());
    } else if (!isConnected) {
      setConnectionTime(null);
    }
  }, [isConnected, connectionTime]);

  // Listen for WebSocket messages
  useEffect(() => {
    // Auto connect on mount
    connect();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, []);

  // Fetch initial data
  useEffect(() => {
    dispatch(fetchLiveData());
  }, [dispatch]);

  // Handle manual refresh
  const handleRefresh = () => {
    dispatch(fetchLiveData());
  };

  // Handle WebSocket connection toggle
  const handleToggleConnection = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  // Table columns cho live data
  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 80,
    },
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
    },
    {
      title: "Value",
      dataIndex: "value",
      key: "value",
      render: (value: number) => (
        <Statistic
          value={value}
          formatter={(val) => formatNumber(val as number)}
          valueStyle={{ fontSize: "14px" }}
        />
      ),
    },
    {
      title: "Progress",
      key: "progress",
      render: (_: unknown, record: DemoData) => (
        <Progress
          percent={Math.min((record.value / 1000) * 100, 100)}
          size="small"
          showInfo={false}
        />
      ),
    },
    {
      title: "Last Updated",
      dataIndex: "timestamp",
      key: "timestamp",
      render: (timestamp: string) => (
        <Text className="text-xs text-gray-500">
          {formatDate(timestamp, "long")}
        </Text>
      ),
    },
  ];

  // Calculate stats
  const totalValue = liveData.items.reduce((sum, item) => sum + item.value, 0);
  const averageValue =
    liveData.items.length > 0 ? totalValue / liveData.items.length : 0;
  const maxValue = Math.max(...liveData.items.map((item) => item.value), 0);

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="mb-6">
        <Title level={1}>📊 Live Dashboard</Title>
        <Paragraph className="text-gray-600">
          Demo real-time data updates với WebSocket. Dữ liệu được cập nhật mỗi 3
          giây.
        </Paragraph>
      </div>

      {/* Connection Status */}
      <Card className="mb-6">
        <Row align="middle" justify="space-between">
          <Col>
            <Space size="large">
              <div>
                <Badge
                  status={isConnected ? "success" : "error"}
                  text={
                    <Text strong>
                      WebSocket Status:{" "}
                      {isConnected ? "Connected" : "Disconnected"}
                    </Text>
                  }
                />
                {connectionTime && (
                  <div className="mt-1">
                    <Text className="text-sm text-gray-500">
                      Connected since: {formatDate(connectionTime, "long")}
                    </Text>
                  </div>
                )}
              </div>

              {wsError && (
                <Alert
                  message="WebSocket Error"
                  description={wsError}
                  type="error"
                  showIcon
                />
              )}
            </Space>
          </Col>

          <Col>
            <Space>
              <Button
                type={isConnected ? "default" : "primary"}
                icon={isConnected ? <DisconnectOutlined /> : <WifiOutlined />}
                onClick={handleToggleConnection}
                loading={isConnecting}
              >
                {isConnected ? "Disconnect" : "Connect"}
              </Button>

              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={liveData.isLoading}
              >
                Refresh
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Records"
              value={liveData.items.length}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: "#3f8600" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Value"
              value={totalValue}
              formatter={(value) => formatNumber(value as number)}
              prefix={<LineChartOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Average Value"
              value={averageValue}
              precision={2}
              formatter={(value) => formatNumber(value as number)}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Max Value"
              value={maxValue}
              formatter={(value) => formatNumber(value as number)}
              valueStyle={{ color: "#cf1322" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Live Data Table */}
      <Card
        title={
          <Space>
            <LineChartOutlined />
            <span>Live Data Stream</span>
            {liveData.lastUpdated && (
              <Tag color="green">
                <ClockCircleOutlined className="mr-1" />
                Updated: {formatDate(liveData.lastUpdated, "long")}
              </Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            {isConnected && (
              <Tag color="success">
                <CheckCircleOutlined className="mr-1" />
                Live
              </Tag>
            )}
            {!isConnected && (
              <Tag color="warning">
                <ExclamationCircleOutlined className="mr-1" />
                Manual
              </Tag>
            )}
          </Space>
        }
      >
        {/* Loading state */}
        {liveData.isLoading && (
          <div className="text-center py-8">
            <Spin size="large" />
            <div className="mt-4">
              <Text>Đang tải dữ liệu...</Text>
            </div>
          </div>
        )}

        {/* Error state */}
        {liveData.error && (
          <Alert
            message="Lỗi khi tải dữ liệu"
            description={liveData.error.message}
            type="error"
            showIcon
            className="mb-4"
            action={
              <Button size="small" onClick={handleRefresh}>
                Thử lại
              </Button>
            }
          />
        )}

        {/* Empty state */}
        {!liveData.isLoading &&
          !liveData.error &&
          liveData.items.length === 0 && (
            <Empty
              description="Chưa có dữ liệu"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" onClick={handleRefresh}>
                Tải dữ liệu
              </Button>
            </Empty>
          )}

        {/* Data table */}
        {!liveData.isLoading &&
          !liveData.error &&
          liveData.items.length > 0 && (
            <Table
              columns={columns}
              dataSource={liveData.items}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 800 }}
            />
          )}
      </Card>

      {/* Info Card */}
      <Card className="mt-6" title="💡 Thông tin WebSocket Demo">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Title level={4}>Cách hoạt động:</Title>
            <ul className="text-gray-600">
              <li>WebSocket kết nối đến mock server (localhost:8080)</li>
              <li>Nhận real-time data updates mỗi 3 giây</li>
              <li>Data được sync với Redux store</li>
              <li>Auto-reconnect khi mất kết nối</li>
              <li>Fallback về manual refresh nếu WS fail</li>
            </ul>
          </Col>
          <Col xs={24} md={12}>
            <Title level={4}>Tech stack:</Title>
            <Space wrap>
              <Tag color="blue">WebSocket API</Tag>
              <Tag color="green">Custom useWebSocket Hook</Tag>
              <Tag color="purple">Redux Integration</Tag>
              <Tag color="orange">Auto Reconnect</Tag>
              <Tag color="red">Error Handling</Tag>
            </Space>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default DashboardPage;
