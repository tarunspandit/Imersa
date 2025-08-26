# Imersa React UI

Modern React-based user interface for the Imersa lighting control system.

## Features

- 🎨 Modern React 18 with TypeScript
- ⚡ Vite for fast development and building
- 🎯 Zustand for state management
- 🎨 Tailwind CSS for styling
- 🧩 Radix UI components for accessibility
- 🎭 Framer Motion for animations
- 📱 Responsive design (mobile-first)
- 🌙 Dark/light theme support
- 🔐 Authentication system
- 🚀 Performance optimized

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components (Button, Card, etc.)
│   ├── layout/         # Layout components (Header, Sidebar, etc.)
│   └── features/       # Feature-specific components
├── pages/              # Page components
├── stores/             # Zustand stores
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
└── styles/             # Global styles and themes
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Navigate to the react-ui directory:
```bash
cd react-ui
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and visit `http://localhost:3001`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run test:ui` - Run tests with UI

## Architecture

### State Management

The application uses Zustand for state management with multiple stores:

- **authStore**: User authentication and profile management
- **lightsStore**: Lights, groups, and scenes management
- **appStore**: Global app state, theme, and notifications

### Routing

React Router is used for client-side routing with protected routes for authenticated users.

### Styling

- **Tailwind CSS**: Utility-first CSS framework
- **CSS Custom Properties**: For theme variables
- **Responsive Design**: Mobile-first approach
- **Dark/Light Themes**: Automatic system theme detection

### Components

- **UI Components**: Reusable, accessible components built with Radix UI
- **Layout Components**: Header, Sidebar, Footer for consistent layout
- **Feature Components**: Domain-specific components for lights, scenes, etc.

### API Integration

- RESTful API calls with fetch
- Error handling and loading states
- Automatic retry mechanisms
- Real-time updates support

## Development Guidelines

### Code Style

- Use functional components with hooks
- Implement proper TypeScript types
- Follow React best practices
- Write clean, documented code
- Ensure accessibility (WCAG 2.1)

### Component Guidelines

- Keep components small and focused
- Use composition over inheritance
- Implement proper error boundaries
- Handle loading and error states
- Make components reusable

### Performance

- Use React.memo for expensive components
- Implement proper key props for lists
- Lazy load routes and heavy components
- Optimize images and assets
- Monitor bundle size

## Features Overview

### Dashboard
- System overview and statistics
- Quick actions and shortcuts
- Recent lights and scenes
- System status monitoring

### Lights Management
- Light discovery and pairing
- Individual light control
- Brightness and color adjustment
- Effect selection and customization

### Groups & Scenes
- Create and manage light groups
- Scene creation and editing
- Schedule and automation
- Import/export functionality

### Entertainment
- Entertainment group setup
- Screen sync configuration
- Audio visualization
- Real-time color mapping

### WLED Integration
- WLED device discovery
- Effect management
- Segment control
- Custom effect creation

### Gradients
- Gradient effect designer
- Multi-color transitions
- Speed and direction control
- Preview functionality

## Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Follow the existing code style and conventions
2. Write tests for new features
3. Update documentation as needed
4. Ensure accessibility compliance
5. Test on multiple devices and browsers

## License

This project is part of the Imersa lighting control system.