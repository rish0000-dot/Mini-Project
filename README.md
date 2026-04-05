# Healthcare Hub (Mini Project) !!

**This project is a refined version of an initially unstructured AI-generated system, transformed into a clean, secure, and fully functional healthcare mini application.**

A professional, streamlined healthcare platform built with a modern stack for security and scalability. This project simplifies patient-doctor interactions, medical record management, and AI-driven symptom analysis.

## 🚀 Teck Stack
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend (Storage/DB/Auth)**: Supabase
- **AI Backend**: Node.js + Express (OpenAI API Proxy)
- **Maps**: Google Maps JS API

## ✨ Key Features
1. **Seamless Auth**: Complete landing page to dashboard flow via `/auth`.
2. **Auto-Profile Creation**: Instant profile generation on signup using SQL triggers.
3. **Smart Document Vault**: Secure file uploads (PDF/Images) with strict validation and owner-based RLS.
4. **AI Health Assistant**: Symptom analysis and hospital recommendations via a secure Node.js proxy.
5. **Interactive Booking**: Multi-step appointment scheduling with real-time feedback.
6. **Live Location**: Automatic city detection for finding regional healthcare services.

## 🛠️ Setup Instructions

### 1. Prerequisites
- Node.js (v18+)
- Supabase Project
- OpenAI API Key
- Google Maps API Key

### 2. Database Setup (Supabase)
Run the following SQL in your Supabase SQL Editor:
- [SQL Schema](database/schema.sql)

### 3. Environment Configuration
Create a `.env` file in the root using the template in `config/.env.example`.

### 4. Installation & Development

**Backend (AI Proxy):**
```bash
cd backend
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## 🔒 Security
- **RLS Policies**: Every table (`profiles`, `documents`, `appointments`) is protected. Users can ONLY access their own data.
- **Key Protection**: The OpenAI API key is hidden behind the Node.js proxy.
- **File Validation**: Uploads are restricted to specific types and a 5MB size limit.

---
