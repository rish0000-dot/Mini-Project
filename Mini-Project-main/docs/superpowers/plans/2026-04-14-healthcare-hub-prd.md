# Product Requirements Document (PRD)

**Project Name:** Healthcare Hub
**Date:** 2026-04-14

---

## 1. Project Overview
Healthcare Hub is a full-stack healthcare platform designed to simplify medical discovery, hospital search, appointment booking, and provide AI-powered health assistance. The platform aims to deliver a seamless, secure, and user-friendly experience for patients seeking healthcare services.

## 2. Target Audience
- General public seeking hospitals, doctors, and healthcare services
- Patients needing to book appointments or consult with verified doctors
- Users looking for AI-based health information and triage
- Mobile and desktop users (responsive design)

## 3. Core Features
- **User Authentication:** Secure sign-up/login using Supabase (OAuth, email/password)
- **Profile Management:** User onboarding, profile editing, avatar upload
- **Location-Based Hospital Search:** Real-time, filterable search for nearby hospitals
- **Hospital Details:** Detailed view with specialties, doctors, services, reviews, and ratings
- **Appointment Management:** Book, list, and cancel appointments; persistent storage
- **Favorites:** Add/remove favorite hospitals per user
- **AI Health Assistant:** Chat interface powered by Gemini for health queries and triage
- **Admin/Doctor Panel:** (If implemented) For hospital/doctor verification and management
- **Security:** Row-Level Security (RLS) for user data, no secrets in git, input validation

## 4. Technical Requirements
- **Frontend:** React (Vite), Axios, Leaflet, responsive CSS
- **Backend:** Node.js, Express, CORS, Dotenv, file-based JSON storage for appointments
- **Database/Auth:** Supabase (Auth, SQL, RLS, Storage)
- **AI Integration:** Google Gemini API for chat/triage
- **Tooling:** Nodemon, Concurrently, environment variable isolation

## 5. Security & Compliance
- No secrets or sensitive data in git history
- RLS policies enforced for all user data
- API keys handled server-side only
- Input validation and error handling on all endpoints

## 6. Success Criteria
- Users can discover and view hospitals based on location and filters
- Users can securely sign up, log in, and manage their profiles
- Users can book, view, and cancel appointments
- AI assistant provides relevant health information and triage
- All data is protected with RLS and no security leaks
- Platform is responsive and works on all major devices

---

**End of PRD**
