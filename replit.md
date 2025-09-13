# Sports Direct Microsite

## Overview

A mobile-first Sports Direct promotional microsite featuring a 3D penalty shootout game built with React, TypeScript, and Three.js. The application allows users to register, play an interactive penalty game, and win vouchers for store opening events. The site follows Sports Direct's brand aesthetic with a bold, sporty design using their signature red, blue, black, and white color palette.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The application uses a modern React-based architecture with TypeScript for type safety:

- **Framework**: Vite + React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: React Hook Form for form handling, TanStack Query for server state
- **Styling**: Tailwind CSS with custom Sports Direct brand colors and Shadcn/ui component library
- **3D Graphics**: Three.js for the penalty shootout game mechanics
- **PWA Support**: Service worker implementation with manifest for mobile app-like experience

### Backend Architecture
Simple Express.js server with modular design:

- **Server Framework**: Express.js with TypeScript
- **Data Layer**: Abstract storage interface with in-memory implementation (MemStorage)
- **Development**: Vite integration for HMR and development server
- **Build Process**: ESBuild for server bundling, Vite for client bundling

### Component Structure
- **Pages**: Landing (registration), Game (3D penalty), Win (voucher display)
- **Shared Components**: Header with Sports Direct branding, BrandButton with custom styling
- **UI Components**: Complete Shadcn/ui component library for consistent design system
- **Utilities**: Storage management, voucher generation, form validation with Zod

### Data Storage Solutions
- **Client Storage**: localStorage for user registration data and voucher information
- **Server Storage**: Modular storage interface allowing easy migration from in-memory to database
- **Database Schema**: Drizzle ORM with PostgreSQL schema defined for users table

### Game Architecture
- **3D Engine**: Three.js for rendering football penalty game
- **Game Logic**: State-driven game mechanics with attempt tracking and scoring
- **Responsive Design**: Canvas-based rendering optimized for mobile devices
- **Sound Integration**: Optional sound effects with user controls

### Authentication and Authorization
Currently implements client-side data persistence without server authentication. User registration data is stored locally and can be extended to include server-side validation and user management.

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Neon database connectivity for PostgreSQL
- **drizzle-orm & drizzle-kit**: Type-safe database ORM and migration tools
- **three**: 3D graphics library for penalty game
- **@tanstack/react-query**: Server state management and caching
- **wouter**: Lightweight React routing
- **react-hook-form & @hookform/resolvers**: Form handling with Zod validation

### UI and Styling
- **@radix-ui/***: Comprehensive set of accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Type-safe variant API for component styling
- **lucide-react**: Icon library

### Development Tools
- **vite**: Build tool and development server
- **typescript**: Static type checking
- **eslint & prettier**: Code linting and formatting
- **@replit/vite-plugin-***: Replit-specific development enhancements

### Database and Session Management
- **connect-pg-simple**: PostgreSQL session store for Express sessions
- **drizzle-zod**: Integration between Drizzle ORM and Zod validation

The application is designed to be easily deployable to Replit with minimal configuration, featuring automatic database provisioning through Neon and comprehensive PWA capabilities for mobile users.