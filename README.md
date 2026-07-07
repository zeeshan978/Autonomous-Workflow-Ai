<div align="center">
  
# 🤖 Autonomous Workflow AI
  
**A production-ready, drag-and-drop Visual Programming Environment for AI Agents**

[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5-purple.svg)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-green.svg)](https://supabase.io/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg)](https://tailwindcss.com/)
[![Status](https://img.shields.io/badge/Status-Production_Ready-success.svg)]()

</div>

---

## 📖 Vision & Elevator Pitch
**Autonomous Workflow AI** is a state-of-the-art visual node editor that allows teams to seamlessly drag, drop, and connect AI-powered automation sequences. It abstracts away the complexity of traditional coding and replaces it with a beautiful, infinite canvas where conditional logic, AI prompts, emails, and database queries become simple graphical nodes. 

Whether you are automating customer onboarding, chaining Large Language Models for data synthesis, or building complex webhook integrations, this platform executes your logic at edge speed with zero server management.

---

## ✨ Core Features Designed for Judges
- 🎨 **Infinite Canvas Builder**: Powered by `React Flow`, users can drag-and-drop nodes to build multi-branched execution paths.
- 🧠 **AI-Native Nodes**: Built-in nodes to prompt LLMs, evaluate decisions, and synthesize dynamic responses.
- ⚡ **Production-Grade Architecture**: Fully optimized React context architecture with zero duplicate renders, offline-resilience, and instant UI painting.
- 🔐 **Robust Authentication**: Powered by Supabase Auth with Role-Based Access Control and resilient session recovery logic.
- 📊 **Real-Time Analytics Dashboard**: Monitor execution success rates, latency, and AI usage metrics in real-time.
- 🌙 **Modern Glassmorphism UI**: High-end visual aesthetics using Tailwind CSS and Framer Motion micro-animations.

---

## 🛠️ Technology Stack
- **Frontend Framework**: React 18 & Vite (TypeScript)
- **Node Engine**: React Flow
- **Styling & UI**: Tailwind CSS, Shadcn UI, Lucide React
- **Animations**: Framer Motion
- **Backend & Database**: Supabase (PostgreSQL, Edge Functions, Auth)
- **State Management**: React Query (Tanstack), Context API

---

## 🚀 How to Run Locally

If you are a judge testing this application locally, follow these simple steps to spin up the environment:

### 1. Clone the repository
```bash
git clone https://github.com/zeeshan978/Autonomous-Workflow-Ai.git
cd Autonomous-Workflow-Ai
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env` file in the root directory and add your Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Start the Development Server
```bash
npm run dev
```

The application will start blazing fast on `http://localhost:5173`.

---

## 🛡️ Production Stability 
During development, extensive auditing was performed to ensure **enterprise-grade reliability**:
- **Offline Resilience**: The application safely degrades to offline-mode if the network drops out, without randomly logging the user out.
- **Vite Fast-Refresh Compliant**: Complete separation of React Context, Providers, and Hooks to strictly guarantee Hot Module Replacement reliability.
- **Race Condition Eradication**: Strict dependency arrays and asynchronous background initialization ensure that rapid tab-switching or React Strict Mode never causes infinite loops.

---

<div align="center">
  <i>Built with passion for the Hackathon. 🚀</i>
</div>
