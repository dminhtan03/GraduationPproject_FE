// ===== MOCK DATA CHO TESTING =====

import type { DemoData, User, Room, UserProfile } from "../types";

// Mock users data
export const mockUsers: User[] = [
  {
    id: 1,
    name: "Nguyễn Văn A",
    email: "nguyenvana@example.com",
    avatar: "https://i.pravatar.cc/150?img=1",
    cancellationCount: 0,
    bookingLockedUntil: "",
  },
  {
    id: 2,
    name: "Trần Thị B",
    email: "tranthib@example.com",
    avatar: "https://i.pravatar.cc/150?img=2",
    cancellationCount: 0,
    bookingLockedUntil: "",
  },
  {
    id: 3,
    name: "Lê Văn C",
    email: "levanc@example.com",
    avatar: "https://i.pravatar.cc/150?img=3",
    cancellationCount: 0,
    bookingLockedUntil: "",
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

// ===== MOCK ROOM DATA (Campus Room Inventory) =====
// Replace with API call: e.g. api.get(API_ENDPOINTS.ROOMS.LIST, { params: { page, size, status, minCapacity } })
const roomTemplates: Omit<Room, "id">[] = [
  {
    roomName: "Innovation A1",
    floorInfo: "Floor 2 - Lab",
    building: "North Wing",
    slot: 12,
    status: "AVAILABLE",
  },
  {
    roomName: "Seminar Hall C",
    floorInfo: "Floor 1 - Hall",
    building: "West Block",
    slot: 150,
    status: "OCCUPIED",
  },
  {
    roomName: "Study Pod 04",
    floorInfo: "Lvl 3 - Pod",
    building: "Main Library",
    slot: 4,
    status: "AVAILABLE",
  },
  {
    roomName: "Boardroom 02",
    floorInfo: "Floor 4 - Meeting",
    building: "Admin Bldg",
    slot: 20,
    status: "AVAILABLE",
  },
  {
    roomName: "Lecture Hall 7",
    floorInfo: "Floor 1 - Hall",
    building: "Science Wing",
    slot: 80,
    status: "OCCUPIED",
  },
  {
    roomName: "Lab B3",
    floorInfo: "Floor 2 - Lab",
    building: "North Wing",
    slot: 24,
    status: "AVAILABLE",
  },
  {
    roomName: "Study Pod 12",
    floorInfo: "Lvl 2 - Pod",
    building: "Main Library",
    slot: 6,
    status: "OCCUPIED",
  },
  {
    roomName: "Auditorium East",
    floorInfo: "Floor 1 - Hall",
    building: "West Block",
    slot: 200,
    status: "AVAILABLE",
  },
  {
    roomName: "Meeting Room 5",
    floorInfo: "Floor 3",
    building: "Admin Bldg",
    slot: 10,
    status: "AVAILABLE",
  },
  {
    roomName: "Innovation B2",
    floorInfo: "Floor 2 - Lab",
    building: "Science Wing",
    slot: 16,
    status: "OCCUPIED",
  },
];

/** Expand templates to 42 rooms for pagination demo */
export const mockRooms: Room[] = Array.from({ length: 42 }, (_, i) => {
  const t = roomTemplates[i % roomTemplates.length];
  return { ...t, id: String(i + 1) };
});

/** Total count for pagination (e.g. "Showing 5 of 42 rooms") */
export const MOCK_TOTAL_ROOMS = 42;

/** Demo: fetch room list (simulate API). Set simulateFail=true to test error state "Unable to load room data". */
export const fetchMockRoomList = async (
  options: {
    page?: number;
    pageSize?: number;
    status?: "AVAILABLE" | "OCCUPIED" | "all";
    minCapacity?: number;
    simulateFail?: boolean;
  } = {}
): Promise<{ items: Room[]; total: number }> => {
  if (options.simulateFail) {
    throw new Error("Unable to load room data");
  }
  const page = options.page ?? 0;
  const pageSize = options.pageSize ?? 5;
  let items = [...mockRooms];
  if (options.status && options.status !== "all") {
    items = items.filter((r) => r.status === options.status);
  }
  if (options.minCapacity != null) {
    items = items.filter((r) => r.slot >= options.minCapacity!);
  }
  const total = items.length;
  const start = page * pageSize;
  const paginated = items.slice(start, start + pageSize);
  return { items: paginated, total };
};

// ===== MOCK PROFILE DATA (My Profile / Edit Profile) =====
// TODO: Replace with BE API – e.g. api.get(API_ENDPOINTS.USER.PROFILE) or api.get('/api/v1/user/profile')
export const mockUserProfile: UserProfile = {
  id: "1",
  firstName: "Alex",
  lastName: "Johnson",
  phoneNumber: "+1 234 567 890",
  address: "Campus Dorm A",
  department: "School of Engineering",
  email: "alex.j@university.edu",
  gender: "OTHER",
  cancellationCount: 0,
  bookingLockedUntil: new Date(0),
};

/** For Edit Profile: same user with editable fields (firstName, lastName, phone, campusAddress). */
export const getMockEditProfileInitial = () => ({
  firstName: "Alex",
  lastName: "Thompson",
  studentId: "2024-8891",
  role: "Graduate Student",
  phoneNumber: "+1 (555) 123-4567",
  campusAddress: "Oakwood Hall, Room 402B\nUniversity Drive, West Campus",
  avatar: undefined as string | undefined,
});

/** Fetch profile (simulate API). Set simulateFail=true to test error state. */
export const fetchMockProfile = async (
  simulateFail = false
): Promise<UserProfile> => {
  if (simulateFail) throw new Error("Unable to load profile data");
  return { ...mockUserProfile };
};
