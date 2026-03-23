# 🚜 AgriBid

[![Project Version](https://img.shields.io/badge/version-0.7.0-blue.svg)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Built with Convex](https://img.shields.io/badge/Built%20with-Convex-orange.svg)](https://www.convex.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)

**AgriBid** is a high-integrity, real-time auction platform purpose-built for the agricultural machinery marketplace. It delivers a fast, secure, and transparent bidding experience for heavy equipment, bridging the trust gap in high-value online transactions.

[Explore the Marketplace](https://agribid.vercel.app) • [Read the Docs](docs/) • [Report a Bug](https://github.com/marcojsmith/AgriBid/issues)

---

## 📖 Table of Contents

- [🌟 Why AgriBid?](#-why-agribid)
- [🚀 Key Features](#-key-features)
- [🛠 Tech Stack](#-tech-stack)
- [📂 Project Structure](#-project-structure)
- [🏁 Getting Started](#-getting-started)
- [🌐 Deployment](#-deployment)
- [🧪 Testing & Quality](#-testing--quality)
- [🔒 Security & Integrity](#-security--integrity)
- [🗺 Roadmap](#-roadmap)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## 🌟 Why AgriBid?

In a market where machinery often costs between $50k and $500k, trust is everything. AgriBid solves the common pitfalls of general auction sites:

- **Low Latency**: Optimized for real-time responsiveness (often under 200 ms in typical workloads).
- **Agricultural Focus**: Tailored metadata for tractors, harvesters, and implements.
- **Transparency First**: Mandatory inspection reports, hour-meter tracking, and verified seller profiles.
- **Anti-Sniping**: Automated "Soft Close" extensions to ensure fair market value.

---

## 🚀 Key Features

### 👤 For Buyers

- **Real-Time Bidding**: Instant price updates and outbid notifications via WebSockets.
- **Dynamic Views**: Detailed vs. Compact view toggle for high-density browsing.
- **Advanced Filtering**: Filter by Make, Model, Year, Price, and Maximum Operating Hours.
- **Watchlist & Alerts**: Save auctions and receive toast notifications for status changes.
- **Proxy Bidding**: Set your maximum price and let the system bid on your behalf.

### 🚜 For Sellers

- **Listing Wizard**: Multi-step flow with hierarchical equipment lookup (Category → Make → Model).
- **Inspection Gallery**: Purpose-built slots for Engine, Cabin, Rear, and Front views.
- **Dashboard Analytics**: Track views, bid counts, and conversion rates for your listings.
- **Draft Management**: Save progress and publish when ready.

### 🛡 For Administrators

- **Listing Moderation**: Review and approve equipment listings to maintain quality.
- **KYC Workflows**: Securely review seller business verification documents.
- **Equipment Catalog**: Manage the global hierarchy of categories, makes, and models.
- **Live Monitoring**: Real-time KPI dashboard (GMV, active users, auction states).
- **Audit Trails**: Immutable logs of all administrative actions for dispute resolution.

---

## 🛠 Tech Stack

- **Frontend**: [React 19](https://react.dev/) (Vite) + [TypeScript 5.9](https://www.typescriptlang.org/)
- **Backend & Database**: [Convex](https://www.convex.dev/) (Reactive Queries, ACID Transactions, Cron Jobs, File Storage)
- **Authentication**: [Better Auth](https://www.better-auth.com/) (RBAC, OIDC, Multi-tenant ready)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + [Shadcn/UI](https://ui.shadcn.com/)
- **Testing**: [Vitest](https://vitest.dev/) (Unit & Integration)
- **Deployment**: [Vercel](https://vercel.com/)

---

## 📂 Project Structure

```text
AgriBid/
├── convex/                  # Backend Architecture
│   ├── admin/              # KYC, Stats, Metadata & Moderation
│   ├── auctions/           # Bidding logic, Settlement & Queries
│   ├── lib/                # Auth utilities & Encryption helpers
│   ├── schema.ts           # Type-safe Database Schema
│   └── crons.ts           # Automated Settlement & Cleanup
├── src/                    # Frontend Application (React)
│   ├── components/         # Atomic UI & Compound Business Components
│   ├── contexts/          # State providers (User, Stats, Global)
│   ├── lib/               # Auth client & Shared Utilities
│   └── pages/             # Route-level View Components
├── conductor/              # Spec-Driven Development (Tracks & Plans)
├── docs/                   # Engineering Documentation
│   ├── database/           # ERDs & Table Relationships
│   ├── ui-design/         # Design System & Layouts
│   ├── security/          # Encryption & RBAC Policies
│   └── data-flow/         # Auth & Transaction Sequences
└── ... (Config files: Vite, Vitest, ESLint, Prettier)
```

---

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Latest LTS)
- [Bun](https://bun.sh/) (Recommended package manager)
- A [Convex](https://www.convex.dev/) account

### Installation

1. **Clone & Install**:
   ```bash
   git clone https://github.com/marcojsmith/AgriBid.git
   cd AgriBid
   bun install
   ```
2. **Setup Environment**:
   Create a `.env.local` file (see `.env.example`):
   ```bash
   VITE_CONVEX_URL=your_convex_url
   BETTER_AUTH_SECRET=your_auth_secret
   ```
3. **Launch Backend**:
   ```bash
   bunx convex dev
   ```
4. **Launch Frontend**:
   ```bash
   bun run dev
   ```

### Seeding Data

Populate your environment with Southern African market-focused metadata and mock auctions:

```bash
bunx convex run seed
```

---

## 🌐 Deployment

The project is optimized for deployment on Vercel. Configure your Vercel project with the following settings:

- **Framework Preset**: Vite
- **Root Directory**: `.`
- **Build Command**: `bunx convex deploy --cmd 'bun run build'`
- **Install Command**: `bun install`
- **Output Directory**: `dist`

**Triggering Deployments**:
Deployments are automatically triggered when pushing to the `main` branch (if connected to GitHub) or can be initiated manually via the Vercel Dashboard.

---

## 🧪 Testing & Quality

AgriBid maintains a high standard of code quality through strict linting and comprehensive testing.

- **Run Tests**: `bun run test`
- **Coverage Report**: `bun run test:coverage`
- **Linting**: `bun run lint` (Checks for type-safety, security, and style)

**Naming Conventions**:

- Folders: `hyphen-case`
- React Components: `PascalCase`
- Utils/Hooks: `camelCase`

---

## 🔒 Security & Integrity

- **PII Protection**: Sensitive KYC data is encrypted at rest using **AES-256-GCM**.
- **Role-Based Access**: Granular control for Buyers, Sellers, and Admins.
- **Input Validation**: We enforce strict typing and validate critical inputs using Zod/Convex schemas to ensure data integrity.
- **Anti-Sniping**: Auctions automatically extend by 2 minutes if a bid is placed in the final 2 minutes.
- **Immutable Logs**: Bid history and admin actions are append-only.

---

## 🗺 Roadmap

- [ ] **Phase 4 Integration**: AI-Powered Pricing Suggestions.
- [ ] **Advanced Notifications**: SMS and Email outbid alerts.
- [ ] **Condition Reports**: PDF generation for machine inspections.
- [ ] **Mobile App**: React Native wrapper for on-field bidding.
- [ ] **Multi-Currency Support**: Expand beyond Southern African regional markets.

---

## 🤝 Contributing

We welcome contributions! Please follow our workflow:

1. Check the [ISSUES_CHECKLIST.md](ISSUES_CHECKLIST.md) for open tasks.
2. Create a feature branch (`feature/description`).
3. Follow the commit format specified in [Checklist.md](Checklist.md).
4. Ensure all tests pass (`bun run test`).
5. Submit a Pull Request referencing the issue ID.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

Built with ❤️ for the agricultural community.
