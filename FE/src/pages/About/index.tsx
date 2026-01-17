// ===== ABOUT PAGE COMPONENT =====

import React from "react";
import {
  Card,
  Typography,
  Row,
  Col,
  Collapse,
  Tag,
  List,
  Avatar,
  Timeline,
  Descriptions,
  Divider,
  Space,
} from "antd";
import {
  CodeOutlined,
  DatabaseOutlined,
  GlobalOutlined,
  ToolOutlined,
  TeamOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";

const { Title, Paragraph, Text } = Typography;
const { Panel } = Collapse;

// Tech stack data
const techStack = [
  {
    category: "Frontend Framework",
    icon: <CodeOutlined />,
    color: "blue",
    technologies: [
      {
        name: "React 18",
        description: "UI library với hooks và concurrent features",
      },
      {
        name: "TypeScript",
        description: "Static type checking cho JavaScript",
      },
      { name: "Vite", description: "Build tool nhanh và hiện đại" },
    ],
  },
  {
    category: "UI & Styling",
    icon: <ToolOutlined />,
    color: "green",
    technologies: [
      {
        name: "Ant Design",
        description: "UI component library enterprise-ready",
      },
      { name: "TailwindCSS", description: "Utility-first CSS framework" },
    ],
  },
  {
    category: "State Management",
    icon: <DatabaseOutlined />,
    color: "purple",
    technologies: [
      {
        name: "Redux Toolkit",
        description: "Modern Redux với less boilerplate",
      },
      { name: "React Redux", description: "Official React bindings cho Redux" },
    ],
  },
  {
    category: "Routing & API",
    icon: <GlobalOutlined />,
    color: "orange",
    technologies: [
      { name: "React Router", description: "Declarative routing cho React" },
      { name: "Axios", description: "HTTP client với interceptors" },
      { name: "WebSocket", description: "Real-time communication" },
    ],
  },
];

// Project structure data
const projectStructure = [
  {
    path: "src/components/",
    description: "Reusable UI components",
    children: ["Layout/", "common/", "ui/"],
  },
  {
    path: "src/pages/",
    description: "Page components",
    children: ["Home/", "About/", "Dashboard/"],
  },
  {
    path: "src/hooks/",
    description: "Custom React hooks",
    children: ["useApi.ts", "useWebSocket.ts", "useLocalStorage.ts"],
  },
  {
    path: "src/store/",
    description: "Redux store và slices",
    children: ["slices/", "store.ts", "index.ts"],
  },
  {
    path: "src/services/",
    description: "API services",
    children: ["api.ts", "demoApi.ts"],
  },
  {
    path: "src/utils/",
    description: "Utility functions",
    children: ["helpers.ts", "errorHandlers.ts"],
  },
];

// Features list
const features = [
  "Redux Toolkit cho state management",
  "TypeScript support đầy đủ",
  "React Router cho navigation",
  "Axios với error handling",
  "WebSocket cho real-time updates",
  "Custom hooks cho reusability",
  "Ant Design components",
  "TailwindCSS utilities",
  "Error boundaries",
  "Loading states",
  "Responsive design",
  "Dark/Light theme support",
];

// Development timeline
const timeline = [
  {
    label: "Setup Project",
    children: "Khởi tạo Vite project với React TypeScript template",
    color: "blue",
  },
  {
    label: "Install Dependencies",
    children: "Cài đặt Redux, Router, Ant Design, TailwindCSS, Axios",
    color: "green",
  },
  {
    label: "Create Architecture",
    children: "Thiết lập cấu trúc thư mục và base components",
    color: "purple",
  },
  {
    label: "Implement Features",
    children: "Redux store, API services, WebSocket, custom hooks",
    color: "orange",
  },
  {
    label: "Demo Pages",
    children: "Tạo các page demo với đầy đủ tính năng",
    color: "red",
  },
];

// About page component
const AboutPage: React.FC = () => {
  return (
    <div className="fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <Title level={1}>📖 Về React Base Project</Title>
        <Paragraph className="text-lg text-gray-600 max-w-4xl mx-auto">
          Đây là một base project React hoàn chỉnh được thiết kế dành cho
          Fresher. Project tích hợp đầy đủ các công nghệ hiện đại và best
          practices của React ecosystem.
        </Paragraph>
      </div>

      {/* Project Info */}
      <Row gutter={[16, 16]} className="mb-8">
        <Col xs={24} lg={16}>
          <Card title="🎯 Mục tiêu Project">
            <List
              dataSource={[
                "Cung cấp base code chất lượng cao cho Fresher",
                "Demo các pattern và best practices",
                "Tích hợp đầy đủ tech stack hiện đại",
                "Code có comment tiếng Việt dễ hiểu",
                "Cấu trúc rõ ràng, dễ mở rộng",
              ]}
              renderItem={(item) => (
                <List.Item>
                  <CheckCircleOutlined className="text-green-500 mr-2" />
                  {item}
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="📊 Project Stats">
            <Descriptions column={1}>
              <Descriptions.Item label="Version">1.0.0</Descriptions.Item>
              <Descriptions.Item label="React">18.x</Descriptions.Item>
              <Descriptions.Item label="TypeScript">5.x</Descriptions.Item>
              <Descriptions.Item label="Build Tool">Vite</Descriptions.Item>
              <Descriptions.Item label="License">MIT</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      {/* Tech Stack */}
      <Card title="🛠️ Tech Stack" className="mb-8">
        <Row gutter={[16, 16]}>
          {techStack.map((category, index) => (
            <Col xs={24} lg={12} xl={6} key={index}>
              <Card
                size="small"
                title={
                  <Space>
                    {category.icon}
                    <Text strong>{category.category}</Text>
                  </Space>
                }
              >
                <List
                  dataSource={category.technologies}
                  renderItem={(tech) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            size="small"
                            style={{
                              backgroundColor: `var(--ant-color-${category.color})`,
                            }}
                          >
                            {tech.name.charAt(0)}
                          </Avatar>
                        }
                        title={
                          <Text strong className="text-sm">
                            {tech.name}
                          </Text>
                        }
                        description={
                          <Text className="text-xs">{tech.description}</Text>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Features */}
      <Row gutter={[16, 16]} className="mb-8">
        <Col xs={24} lg={12}>
          <Card title="✨ Tính năng chính">
            <List
              grid={{ gutter: 8, xs: 1, sm: 2 }}
              dataSource={features}
              renderItem={(feature) => (
                <List.Item>
                  <Tag color="blue" className="w-full text-center">
                    {feature}
                  </Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="📁 Cấu trúc Project">
            <Collapse ghost>
              {projectStructure.map((folder, index) => (
                <Panel
                  header={
                    <Space>
                      <CodeOutlined />
                      <Text strong>{folder.path}</Text>
                    </Space>
                  }
                  key={index}
                >
                  <Paragraph className="text-gray-600 mb-2">
                    {folder.description}
                  </Paragraph>
                  {folder.children && (
                    <List
                      size="small"
                      dataSource={folder.children}
                      renderItem={(child) => (
                        <List.Item>
                          <Text code className="text-xs">
                            {child}
                          </Text>
                        </List.Item>
                      )}
                    />
                  )}
                </Panel>
              ))}
            </Collapse>
          </Card>
        </Col>
      </Row>

      {/* Development Timeline */}
      <Card title="⏱️ Timeline Phát triển" className="mb-8">
        <Timeline items={timeline} mode="left" />
      </Card>

      {/* Getting Started */}
      <Card title="🚀 Hướng dẫn sử dụng">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Card size="small" title="1. Clone & Install">
              <Paragraph>
                <Text code>git clone [repo]</Text>
                <br />
                <Text code>npm install</Text>
                <br />
                <Text code>npm run dev</Text>
              </Paragraph>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card size="small" title="2. Explore Features">
              <Paragraph>
                • Kiểm tra Redux DevTools
                <br />
                • Test API calls ở Network tab
                <br />• Thử WebSocket ở Dashboard
              </Paragraph>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card size="small" title="3. Customize">
              <Paragraph>
                • Thêm pages mới vào /pages
                <br />
                • Tạo slices cho state mới
                <br />• Develop API services riêng
              </Paragraph>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* Footer */}
      <div className="text-center mt-8">
        <Divider />
        <Paragraph className="text-gray-600">
          <TeamOutlined className="mr-2" />
          Được phát triển với ❤️ cho Fresher developers. Chúc các bạn học tập và
          phát triển tốt!
        </Paragraph>
      </div>
    </div>
  );
};

export default AboutPage;
