# Dream Workplace - Company Career Directory 🚀

An AI-powered official career portals directory and job application hub. Quickly curate, organize, and access verified company career pages with automated Google Gemini AI link discovery and category classification.

![Dream Workplace Banner](https://raw.githubusercontent.com/TechWorldAjit/DW/main/dist/index.html) <!-- Visual Anchor -->

---

## ✨ Features

- 🔍 **AI-Powered Discovery with Google Gemini**: Paste a comma-separated list of company names (e.g., `Google, Microsoft, Stripe, NVIDIA`), and Gemini AI automatically discovers direct official job portals and assigns 1–3 standardized industry categories.
- 🛡️ **Anti-Aggregator Verification**: Built-in verification logic rejects third-party job aggregators (Indeed, LinkedIn, Glassdoor, Naukri) to ensure direct links to official company careers portals.
- 📌 **Pin & Favorite**: Pin critical dream employers to the top of your board and toggle favorite status for quick filtering.
- 🏷️ **Dynamic Category Filtering**: Browse companies by industry pills (e.g., *Product-Based Companies, IT Services, Finance, Semiconductors, Healthcare*).
- 🌓 **Sleek Light & Dark Modes**: Complete dark mode support with system preference detection and zero-flash theme initialization.
- 👥 **Role-Based Access Control (RBAC)**:
  - First registered user automatically promoted to **Administrator**.
  - **Admin Control Panel**: Provision student accounts, generate temporary passwords, toggle account access, and enable/disable public self-registration.
- 🔒 **Security First**: HTTP-only secure cookie JWT session handling, Bcrypt password hashing, and express-rate-limit protection.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide React
- **Backend**: Node.js, Express 5, TypeScript, MongoDB Atlas (`mongodb` native driver)
- **AI Integration**: Google Generative AI (Gemini Flash Models)
- **Deployment**: Vercel Serverless (`api/index.ts` + static frontend distribution)

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster URI
- A [Google AI Studio Gemini API Key](https://aistudio.google.com/)

### 1. Clone the Repository

```bash
git clone https://github.com/TechWorldAjit/DW.git
cd DW
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create a `.env` file in the root directory (based on `.env.example`):

```env
PORT=5001
NODE_ENV=development
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/company_career_directory?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key
GEMINI_API_KEY=your_gemini_api_key
```

### 4. Run Locally

Start both client and server concurrently in development mode:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5001`

---

## ☁️ Deployment on Vercel

This repository is pre-configured with `vercel.json` and a serverless entrypoint (`api/index.ts`).

1. Install the Vercel CLI:
   ```bash
   npm i -g vercel
   ```
2. Deploy:
   ```bash
   vercel
   ```
3. Set your production environment variables in the Vercel Project Dashboard:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `GEMINI_API_KEY`
   - `NODE_ENV=production`

---

## 📄 License

ISC © [Ajit Prasad](https://github.com/TechWorldAjit)
