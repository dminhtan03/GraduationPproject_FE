# 🚀 Final Project Frontend Base

Base project React hoàn chỉnh cho **Final Project**. Project tích hợp đầy đủ các công nghệ hiện đại và best practices của React ecosystem.

## 📋 Project Information

- **Repository**: TEL/finalproject_fe
- **Branch**: base
- **Purpose**: Base architecture cho Final Project
- **Level**: Complete starter template

## 🛠️ Tech Stack

- **⚛️ React 19** - UI Library
- **📘 TypeScript** - Type safety
- **🎨 TailwindCSS** - Utility-first CSS framework
- **🐜 Ant Design** - Component library
- **⚡ Vite** - Build tool & dev server
- **🗃️ Redux Toolkit** - State management
- **🌐 React Router** - Client-side routing
- **📡 Axios** - HTTP client
- **🔌 WebSocket** - Real-time communication

## 📁 Project Structure

```
src/
├── components/          # Reusable components
│   ├── common/         # Common components (Loading, ErrorBoundary)
│   ├── Layout/         # Layout components (Header, Sidebar, Footer)
│   └── ui/             # UI components (Button, Card)
├── pages/              # Page components
├── hooks/              # Custom hooks
├── store/              # Redux store & slices
├── services/           # API services
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── constants/          # App constants
└── styles/             # Additional styles
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18
- npm hoặc yarn

### Installation

```bash
# Clone repository
git clone <repository-url>
cd base-fe-react

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 📖 Features Demonstrated

### 1. Redux State Management

- ✅ Counter example với increment/decrement
- ✅ Async data fetching với loading states
- ✅ Error handling trong Redux
- ✅ TypeScript integration

### 2. React Router

- ✅ Lazy loading components
- ✅ Error boundaries cho routes
- ✅ Navigation với layouts

### 3. WebSocket Integration

- ✅ Real-time data updates
- ✅ Auto-reconnection logic
- ✅ Connection status management
- ✅ Live data simulation

### 4. API Integration

- ✅ Axios configuration với interceptors
- ✅ Error handling và retry logic
- ✅ TypeScript types cho API responses
- ✅ Demo API calls với JSONPlaceholder

### 5. Component Architecture

- ✅ Reusable UI components
- ✅ Layout system với Header/Sidebar/Footer
- ✅ Error boundaries
- ✅ Loading states

## 🎯 Pages Overview

### 🏠 Home Page (`/`)

- Redux counter demo
- API data fetching example
- Loading và error states

### ℹ️ About Page (`/about`)

- Project information
- Tech stack overview
- Development guide

### 📊 Dashboard Page (`/dashboard`)

- WebSocket live data demo
- Real-time updates
- Connection status indicator

## 🔧 Development Guidelines

### Code Organization

```typescript
// Import order
import React from "react"; // React imports
import { useSelector } from "react-redux"; // Third party
import { CustomButton } from "@/components"; // Local imports
import "./Component.css"; // Styles

// Component structure
export const Component: React.FC<Props> = ({ prop1, prop2 }) => {
  // Hooks
  const data = useSelector(selectData);

  // Handlers
  const handleClick = () => {
    // Implementation
  };

  // Render
  return <div>{/* JSX */}</div>;
};
```

### Naming Conventions

- **Files**: PascalCase cho components (`UserProfile.tsx`)
- **Variables**: camelCase (`userData`, `isLoading`)
- **Constants**: UPPER_SNAKE_CASE (`API_ENDPOINTS`)
- **Types**: PascalCase (`UserData`, `ApiResponse`)

### TypeScript Best Practices

- Luôn định nghĩa types cho props
- Sử dụng interface thay vì type khi có thể
- Tránh `any`, sử dụng `unknown` thay thế

### State Management

- Sử dụng Redux Toolkit cho global state
- Local state với useState cho component-specific data
- Custom hooks cho reusable logic

## 📚 Learning Resources

### Concepts Covered

- **Component Lifecycle**: Functional components với hooks
- **State Management**: Local state vs Global state
- **Side Effects**: useEffect, API calls, subscriptions
- **Performance**: Lazy loading, memoization
- **Error Handling**: Error boundaries, try-catch patterns
- **TypeScript**: Type safety, interfaces, generics

### Next Steps

- [ ] Add unit tests với Jest & React Testing Library
- [ ] Implement PWA features
- [ ] Add internationalization (i18n)
- [ ] Optimize bundle size
- [ ] Add Storybook for component documentation

## 🐛 Troubleshooting

### Common Issues

**Build Errors:**

```bash
npm run build
# Fix any TypeScript errors shown
```

**Port Already in Use:**

```bash
# Change port in package.json or kill process
lsof -ti:5173 | xargs kill -9
```

**CSS Not Loading:**

```bash
# Ensure TailwindCSS is properly configured
npm run build && npm run preview
```

## 📞 Support

Nếu gặp vấn đề trong quá trình phát triển:

1. Kiểm tra console errors
2. Xem lại documentation
3. Search issues trên GitHub
4. Hỏi team lead/mentor

---

**Happy Coding! 🎉**
files: ["**/*.{ts,tsx}"],
extends: [
// Other configs...
// Enable lint rules for React
reactX.configs["recommended-typescript"],
// Enable lint rules for React DOM
reactDom.configs.recommended,
],
languageOptions: {
parserOptions: {
project: ["./tsconfig.node.json", "./tsconfig.app.json"],
tsconfigRootDir: import.meta.dirname,
},
// other options...
},
},
]);

```

## 📋 Tech Stack

### Core Technologies

- **React 18** - UI library với hooks và concurrent features
- **TypeScript** - Static type checking cho JavaScript
- **Vite** - Build tool nhanh và hiện đại

### UI & Styling

- **Ant Design** - UI component library enterprise-ready
- **TailwindCSS** - Utility-first CSS framework

### State Management & Routing

- **Redux Toolkit** - Modern Redux với less boilerplate
- **React Router** - Declarative routing cho React

### API & Real-time

- **Axios** - HTTP client với interceptors và error handling
- **WebSocket** - Real-time communication

## 🎯 Tính năng chính

✅ **Redux Toolkit** cho state management
✅ **TypeScript** support đầy đủ
✅ **React Router** cho navigation
✅ **Axios** với error handling
✅ **WebSocket** cho real-time updates
✅ **Custom hooks** cho reusability
✅ **Ant Design** components
✅ **TailwindCSS** utilities
✅ **Error boundaries**
✅ **Loading states**
✅ **Responsive design**
✅ **Dark/Light theme support**

## 📁 Cấu trúc Project

```

src/
├── components/ # Reusable UI components
│ ├── Layout/ # Header, Sidebar, Footer, MainLayout
│ ├── common/ # Loading, ErrorBoundary, etc.
│ └── ui/ # Custom UI components
├── pages/ # Page components
│ ├── Home/ # Trang chủ với Redux demo
│ ├── About/ # Thông tin về project
│ └── Dashboard/ # Live data với WebSocket
├── hooks/ # Custom React hooks
│ ├── useApi.ts # Hook cho API calls
│ ├── useWebSocket.ts # Hook cho WebSocket
│ └── useLocalStorage.ts # Hook cho localStorage
├── store/ # Redux store và slices
│ ├── slices/ # Redux slices
│ └── store.ts # Store configuration
├── services/ # API services
│ ├── api.ts # Axios configuration
│ └── demoApi.ts # Demo API calls
├── router/ # React Router configuration
├── utils/ # Utility functions
├── types/ # TypeScript type definitions
├── constants/ # App constants và config
├── websocket/ # WebSocket service
└── styles/ # Global styles

````

## 🚀 Quick Start

### 1. Clone và Install

```bash
git clone [repository-url]
cd base-fe-react
npm install
````

### 2. Development

```bash
npm run dev
```

Mở [http://localhost:5173](http://localhost:5173) để xem ứng dụng.

### 3. Build Production

```bash
npm run build
```

## 🎯 Demo Features

### 1. **Home Page** - Redux Demo

- Counter với các actions (increment, decrement, reset)
- API calls với loading states
- Error handling
- Posts data từ JSONPlaceholder API

### 2. **Dashboard Page** - WebSocket Demo

- Real-time data updates mỗi 3 giây
- Connection status monitoring
- Auto-reconnect khi mất kết nối
- Fallback về manual refresh

### 3. **About Page** - Project Info

- Tech stack overview
- Project structure
- Development timeline
- Getting started guide

## 🛠️ Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

## 🔧 Configuration

### Environment Variables

Tạo file `.env` từ `.env.example`:

```bash
# API Configuration
VITE_API_URL=https://jsonplaceholder.typicode.com
VITE_WS_URL=ws://localhost:8080

# App Configuration
VITE_APP_NAME=React Base App
VITE_APP_VERSION=1.0.0

# Development flags
VITE_ENABLE_REDUX_DEVTOOLS=true
VITE_ENABLE_MOCK_API=false
```

## 📖 Hướng dẫn Development cho Fresher

### 1. Explore Redux DevTools

- Cài extension Redux DevTools
- Theo dõi actions và state changes
- Time-travel debugging

### 2. Check Network Tab

- Xem API requests/responses
- Monitor loading times
- Debug failed requests

### 3. Use React Developer Tools

- Inspect component props/state
- Profile performance
- Debug hooks

### 4. Read the Code

- Mọi file đều có comment tiếng Việt
- Follow import/export patterns
- Hiểu folder structure

**Happy coding! 🎉**

## 🎯 Final Project Usage

### Sử dụng Base này cho Final Project

1. **Clone repo về máy local**:
```bash
git clone https://wire.lgcns.com/bitbucket/scm/tel/finalproject_fe.git
cd finalproject_fe
```

2. **Checkout base branch**:
```bash
git checkout base
```

3. **Tạo nhánh mới cho team**:
```bash
git checkout -b team-[team-name]
# Ví dụ: git checkout -b team-alpha
```

4. **Install dependencies và start development**:
```bash
npm install
npm run dev
```

### 📝 Hướng dẫn Development

1. **Tạo components mới** trong `src/components/`
2. **Tạo pages mới** trong `src/pages/`
3. **Thêm API services** trong `src/services/`
4. **Quản lý state** với Redux trong `src/store/`
5. **Styling** với TailwindCSS + Ant Design

### 🔄 Git Workflow

```bash
# Làm việc trên team branch
git checkout team-[team-name]

# Tạo feature branch
git checkout -b feature/[feature-name]

# Development...
git add .
git commit -m "feat: add [feature description]"

# Push feature
git push origin feature/[feature-name]

# Tạo Pull Request để merge vào team branch
```
