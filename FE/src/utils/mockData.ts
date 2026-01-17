// ===== MOCK DATA CHO TESTING =====

import type { DemoData, User } from "../types";

// Mock users data
export const mockUsers: User[] = [
  {
    id: 1,
    name: "Nguyễn Văn A",
    email: "nguyenvana@example.com",
    avatar: "https://i.pravatar.cc/150?img=1",
  },
  {
    id: 2,
    name: "Trần Thị B",
    email: "tranthib@example.com",
    avatar: "https://i.pravatar.cc/150?img=2",
  },
  {
    id: 3,
    name: "Lê Văn C",
    email: "levanc@example.com",
    avatar: "https://i.pravatar.cc/150?img=3",
  },
];

// Mock demo data
export const mockDemoData: DemoData[] = [
  {
    id: 1,
    title: "Sales Revenue",
    value: 15420,
    timestamp: new Date().toISOString(),
  },
  {
    id: 2,
    title: "Active Users",
    value: 8250,
    timestamp: new Date().toISOString(),
  },
  {
    id: 3,
    title: "Page Views",
    value: 45300,
    timestamp: new Date().toISOString(),
  },
  {
    id: 4,
    title: "Conversions",
    value: 1420,
    timestamp: new Date().toISOString(),
  },
  {
    id: 5,
    title: "Bounce Rate",
    value: 65,
    timestamp: new Date().toISOString(),
  },
];

// Function để generate random data
export const generateRandomData = (count: number = 5): DemoData[] => {
  const titles = [
    "Sales Revenue",
    "Active Users",
    "Page Views",
    "Conversions",
    "Orders",
    "Downloads",
    "Signups",
    "Revenue",
  ];

  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    title: titles[index % titles.length],
    value: Math.floor(Math.random() * 50000) + 1000,
    timestamp: new Date().toISOString(),
  }));
};

// Function để simulate live updates
export const generateLiveUpdate = (previousData: DemoData[]): DemoData[] => {
  return previousData.map((item) => ({
    ...item,
    value: Math.max(0, item.value + Math.floor(Math.random() * 2000) - 1000),
    timestamp: new Date().toISOString(),
  }));
};
