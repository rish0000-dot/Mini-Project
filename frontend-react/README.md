# Healthcare Hub - React Version

This is a complete React conversion of the Healthcare Hub project. All logic, UI, and functionality remain exactly the same as the original HTML/CSS/JavaScript version.

## Project Structure

```
frontend-react/
├── src/
│   ├── components/
│   │   ├── App.jsx           # Main app component with state management
│   │   ├── LandingPage.jsx   # Landing page, hero, features, footer
│   │   ├── AuthModal.jsx     # Login/Signup modal with Supabase auth
│   │   └── Dashboard.jsx     # Dashboard with hospital search and AI chat
│   ├── styles/
│   │   └── global.css        # All CSS (same as original)
│   ├── utils/
│   │   ├── supabase.js       # Supabase client configuration
│   │   └── constants.js      # Mock hospital data
│   ├── main.jsx              # React entry point
│   └── App.jsx               # Root component
├── index.html                # HTML template
├── package.json              # Dependencies
├── vite.config.js           # Vite configuration
└── .gitignore
```

## Installation & Setup

### 1. Install Dependencies

```bash
cd frontend-react
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

This will start the Vite dev server at `http://localhost:5173` and automatically open it in your browser.

### 3. Keep Backend Running

Make sure your Express backend is also running:

```bash
cd backend
npm install
npm start
```

The backend runs on `http://localhost:5001` (or your configured port).

## What's Converted

✅ **HTML Structure** → React Components
- Landing page with hero, features, how-it-works, CTA sections
- Navigation, footer, and all sections
- Auth modal with sign-up and login forms
- Dashboard with sidebar and multiple pages

✅ **CSS Styling** → Moved to `global.css`
- All original CSS preserved (colors, animations, layouts)
- Responsive design maintained
- Dark dashboard theme

✅ **JavaScript Logic** → React Hooks & State
- Supabase authentication (OAuth, email/password)
- User profile management with avatar upload
- Hospital search with filtering
- AI chat with backend integration
- Navigation between pages

✅ **Features**
- Real-time authentication state
- Avatar upload to Supabase Storage
- Hospital search and filtering
- AI chat interface
- Date formatting and animations

## Key Files

### Components

- **App.jsx** - Main component managing global state (user, auth modal, page navigation)
- **LandingPage.jsx** - Hero section, features, how-it-works, CTA, footer
- **AuthModal.jsx** - Login/signup form with Supabase integration
- **Dashboard.jsx** - Dashboard pages: home, hospital search, AI chat

### Utilities

- **supabase.js** - Supabase client initialization
- **constants.js** - Mock hospital data

## No Changes Made To

- ❌ No UI modifications
- ❌ No logic changes
- ❌ No functionality removed
- ❌ Same API endpoints
- ❌ Same authentication flow
- ❌ Same data handling

## Build for Production

```bash
npm run build
npm run preview
```

This creates an optimized production build in the `dist` folder.

## Environment Configuration

The app uses the same Supabase credentials as the original:
- **Supabase URL**: `https://yrwjqzbpdigjzzxmmqnm.supabase.co`
- **Supabase Anonymous Key**: Pre-configured in `src/utils/supabase.js`

## Dependencies

- **React** 18.3.1 - UI framework
- **Vite** 5.0.8 - Build tool
- **@supabase/supabase-js** 2.39.0 - Backend authentication & storage
- **@vitejs/plugin-react** 4.2.1 - React plugin for Vite

## Notes

- All functionality is identical to the original
- CSS is completely preserved
- No breaking changes
- Ready for production deployment
- Fully responsive design maintained
