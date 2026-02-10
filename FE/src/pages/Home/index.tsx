import React, { useEffect } from "react";
import {
  Card,
  Button,
  Space,
  Statistic,
  Row,
  Col,
  Typography,
  List,
  Tag,
  Spin,
  Alert,
  Divider,
} from "antd";
import {
  PlusOutlined,
  MinusOutlined,
  ReloadOutlined,
  ApiOutlined,
  DatabaseOutlined,
  RocketOutlined,
} from "@ant-design/icons";
import {
  useAppDispatch,
  useAppSelector,
  selectCounter,
  selectPosts,
  increment,
  decrement,
  incrementByAmount,
  resetCounter,
  fetchPosts,
  clearPostsError,
} from "../../store";

const { Title, Paragraph, Text } = Typography;

// Home page component
const HomePage: React.FC = () => {
  const dispatch = useAppDispatch();
  const counter = useAppSelector(selectCounter);
  const posts = useAppSelector(selectPosts);

  // Fetch posts khi component mount
  useEffect(() => {
    dispatch(fetchPosts(5)); // Lấy 5 posts đầu tiên
  }, [dispatch]);

  // Handlers cho counter
  const handleIncrement = () => {
    dispatch(increment());
  };

  const handleDecrement = () => {
    dispatch(decrement());
  };

  const handleIncrementByFive = () => {
    dispatch(incrementByAmount(5));
  };

  const handleReset = () => {
    dispatch(resetCounter());
  };

  // Handler cho retry posts
  const handleRetryPosts = () => {
    dispatch(clearPostsError());
    dispatch(fetchPosts(5));
  };

  return (
    <div className="fade-in">
      {/* Header Section */}
      <div className="mb-8">
        <Title level={1} className="text-center mb-4">
          🚀 Chào mừng đến với React Base!
        </Title>
        <Paragraph className="text-center text-lg text-gray-600 max-w-3xl mx-auto">
          Đây là base React hoàn chỉnh với TypeScript, Redux, React Router,
          WebSocket, Axios và Ant Design. Dưới đây là demo các tính năng chính.
        </Paragraph>
      </div>

      {/* Features Overview */}
      <Row gutter={[16, 16]} className="mb-8">
        <Col xs={24} sm={8}>
          <Card className="text-center h-full">
            <RocketOutlined className="text-4xl text-blue-500 mb-4" />
            <Title level={4}>Modern Tech Stack</Title>
            <Text className="text-gray-600">
              React 18, TypeScript, Vite, TailwindCSS
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="text-center h-full">
            <DatabaseOutlined className="text-4xl text-green-500 mb-4" />
            <Title level={4}>State Management</Title>
            <Text className="text-gray-600">
              Redux Toolkit với TypeScript support
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="text-center h-full">
            <ApiOutlined className="text-4xl text-purple-500 mb-4" />
            <Title level={4}>API Integration</Title>
            <Text className="text-gray-600">
              Axios với interceptors và error handling
            </Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Redux Counter Demo */}
        <Col xs={24} lg={12}>
          <Card
            title="📊 Redux Counter Demo"
            className="h-full"
            extra={<Tag color="blue">Redux Toolkit</Tag>}
          >
            <div className="text-center">
              <Statistic
                title="Counter Value"
                value={counter.value}
                className="mb-6"
              />

              <Space wrap className="mb-4">
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleIncrement}
                >
                  +1
                </Button>
                <Button icon={<MinusOutlined />} onClick={handleDecrement}>
                  -1
                </Button>
                <Button type="dashed" onClick={handleIncrementByFive}>
                  +5
                </Button>
                <Button danger onClick={handleReset}>
                  Reset
                </Button>
              </Space>

              <Divider />
              <Text className="text-gray-600 text-sm">
                💡 Sử dụng Redux Toolkit để quản lý state counter. Kiểm tra
                Redux DevTools để xem actions!
              </Text>
            </div>
          </Card>
        </Col>

        {/* API Data Demo */}
        <Col xs={24} lg={12}>
          <Card
            title="🌐 API Data Demo"
            className="h-full"
            extra={
              <Space>
                <Tag color="green">Axios</Tag>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={handleRetryPosts}
                  loading={posts.isLoading}
                >
                  Retry
                </Button>
              </Space>
            }
          >
            {/* Loading state */}
            {posts.isLoading && (
              <div className="text-center py-8">
                <Spin size="large" />
                <div className="mt-4">
                  <Text>Đang tải dữ liệu từ API...</Text>
                </div>
              </div>
            )}

            {/* Error state */}
            {posts.error && (
              <Alert
                message="Lỗi khi tải dữ liệu"
                description={posts.error.message}
                type="error"
                showIcon
                className="mb-4"
                action={
                  <Button size="small" onClick={handleRetryPosts}>
                    Thử lại
                  </Button>
                }
              />
            )}

            {/* Success state */}
            {!posts.isLoading && !posts.error && posts.items.length > 0 && (
              <>
                <List
                  dataSource={posts.items}
                  renderItem={(
                    post: { id: number; title: string; userId: number },
                    index: number,
                  ) => (
                    <List.Item key={post.id}>
                      <List.Item.Meta
                        title={
                          <Text strong className="text-sm">
                            {index + 1}. {post.title.substring(0, 50)}...
                          </Text>
                        }
                        description={
                          <Text className="text-xs text-gray-600">
                            User ID: {post.userId} | Post ID: {post.id}
                          </Text>
                        }
                      />
                    </List.Item>
                  )}
                />
                <Divider />
                <Text className="text-gray-600 text-sm">
                  💡 Dữ liệu từ JSONPlaceholder API với Axios interceptors. Xem
                  Network tab để theo dõi requests!
                </Text>
              </>
            )}
          </Card>
        </Col>
      </Row>

      {/* Next Steps */}
      <Card className="mt-8">
        <Title level={3} className="text-center mb-4">
          🎯 Các bước tiếp theo
        </Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <div className="text-center">
              <Title level={4}>Dashboard</Title>
              <Paragraph>
                Xem live data updates với WebSocket tại trang Dashboard
              </Paragraph>
              <Button type="primary" href="/dashboard">
                Đến Dashboard
              </Button>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div className="text-center">
              <Title level={4}>About</Title>
              <Paragraph>
                Tìm hiểu thêm về tech stack và cấu trúc project
              </Paragraph>
              <Button href="/about">Xem thông tin</Button>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div className="text-center">
              <Title level={4}>Source Code</Title>
              <Paragraph>Khám phá source code để hiểu cách implement</Paragraph>
              <Button type="dashed">View on GitHub</Button>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default HomePage;
