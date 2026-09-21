# 🚜 AgriBid

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
- [🛠 Tech Stack & Architecture](#-tech-stack--architecture)
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

## 🛠 Tech Stack & Architecture

React 19 + Vite + TypeScript on the front end, Convex (reactive database, cron jobs, file storage) on the back end, Clerk for authentication, Tailwind CSS v4 + shadcn/ui for styling, Vitest for tests and Vercel for hosting.

The stack with versions, the repository map and how a request flows through the system live in [`docs/architecture/overview.md`](docs/architecture/overview.md); it is the single source, so this README does not repeat it.

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
   VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   ```
   Then set the JWT issuer domain server-side on your Convex deployment (not in
   `.env.local` — Convex reads this from its own deployment environment):
   ```bash
   bunx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-instance.clerk.accounts.dev
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

- **Run Tests**: `bun run test`
- **Coverage Report**: `bun run test:coverage`
- **Linting**: `bun run lint` (type-safety, security and style)
- **Type check / build**: `bun run type-check`, `bun run build`

Coding rules, naming conventions and the full command list are in [`AGENTS.md`](AGENTS.md).

---

## 🔒 Security & Integrity

- **PII Protection**: Sensitive KYC data is encrypted at rest using **AES-256-GCM**.
- **Role-Based Access**: Granular control for Buyers, Sellers, and Admins.
- **Input Validation**: We enforce strict typing and validate critical inputs using Zod/Convex schemas to ensure data integrity.
- **Anti-Sniping**: Auctions automatically extend by 2 minutes if a bid is placed in the final 2 minutes.
- **Immutable Logs**: Bid history and admin actions are append-only.

---

## 🗺 Roadmap

See [`docs/product/roadmap.md`](docs/product/roadmap.md). Open work and bugs are tracked in [GitHub Issues](https://github.com/marcojsmith/AgriBid/issues); current status is in [`docs/STATUS.md`](docs/STATUS.md).

---

## 🤝 Contributing

1. Pick or open a [GitHub issue](https://github.com/marcojsmith/AgriBid/issues).
2. Read [`AGENTS.md`](AGENTS.md) (rules, workflow, commit format) and [`docs/STATUS.md`](docs/STATUS.md).
3. Create a branch (`feature/description` or `bugfix/description`); never commit to `main`.
4. Ensure `bun run lint`, `bun run test` and `bun run build` pass.
5. Open a Pull Request referencing the issue and complete the docs checklist.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

Built with ❤️ for the agricultural community.
