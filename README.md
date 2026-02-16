# AgriBid - High-Integrity Farming Equipment Auction Platform

AgriBid is a real-time auction platform purpose-built for the agricultural machinery marketplace. It leverages modern web technologies to deliver a fast, secure, and transparent bidding experience for buyers and sellers of heavy equipment.

## 🚀 Key Features

- **Real-Time Bidding**: Powered by Convex's reactive architecture for sub-200ms latency.
- **Auction Lifecycle Management**:
  - **Soft Close (Anti-Sniping)**: Automatically extends auctions by 2 minutes if a bid is placed in the final 2 minutes.
  - **Automated Settlement**: Integrated cron jobs to finalize auctions as "Sold" (if reserve is met) or "Unsold".
- **Advanced Listing Wizard**: Multi-step flow for equipment details, condition reports, image slot management (Front, Engine, Cabin, Rear), and pricing.
- **User Dashboards**:
  - **Buyer Dashboard**: Track active bids, winning items, and lost auctions.
  - **Seller Dashboard**: Manage equipment inventory, track listing status, and view sales.
- **Watchlist Functionality**: Save and monitor auctions with real-time status updates.
- **Live Notifications**: Instant toast notifications for outbids, auction extensions, and final settlement results.
- **Admin Moderation**: Dedicated dashboard for reviewing and approving/rejecting equipment listings.
- **Security & Integrity**: 
  - Role-Based Access Control (RBAC).
  - Open Redirect protection on all authentication flows.
  - Immutable bid history logs.

## 🛠 Tech Stack

- **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Backend & Database**: [Convex](https://www.convex.dev/) (Real-time synchronization & ACID transactions)
- **Authentication**: [Better Auth](https://www.better-auth.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [Shadcn/UI](https://ui.shadcn.com/)
- **Testing**: [Vitest](https://vitest.dev/)
- **Deployment**: [Vercel](https://vercel.com/)

## 📂 Project Structure

```text
AgriBid/
├── app/                  # Main application code
│   ├── convex/           # Backend schema, queries, mutations, and crons
│   └── src/              # React frontend
│       ├── components/   # Reusable UI & business logic components
│       ├── lib/          # Utilities and Auth client
│       └── pages/        # Page components (Home, Dashboards, Details)
├── conductor/            # Spec-driven development tracks and project docs
├── Brief.md              # Project specification
├── Checklist.md          # Feature implementation tracker
└── README.md             # Project overview
```

## 🏁 Getting Started

### Prerequisites

- Node.js (Latest LTS recommended)
- A Convex account (for backend hosting)

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/marcojsmith/AgriBid.git
    cd AgriBid
    ```

2.  **Install dependencies**:
    ```bash
    cd app
    npm install
    ```

3.  **Configure Environment Variables**:
    Create a `.env.local` file in the `app/` directory (see `.env.example` for required keys):
    - `VITE_CONVEX_URL`
    - `BETTER_AUTH_SECRET`
    - (Other Auth provider keys as needed)

4.  **Launch Backend (Convex)**:
    ```bash
    npx convex dev
    ```

5.  **Run Development Server**:
    In a new terminal window:
    ```bash
    npm run dev
    ```

### Seeding Data

To populate your local environment with mock equipment and auctions:
```bash
npx convex run seed
```

## 🏗 Development Workflow

This project follows a **Spec-Driven Development** (Conductor) approach. Major features are tracked in the `conductor/tracks/` directory, each with its own specification and implementation plan.

### Testing

Run the test suite using Vitest:
```bash
npm run test
```

## 🌐 Deployment

The project is optimized for deployment on Vercel:
1.  Connect your repository to Vercel.
2.  Set the Root Directory to `app/`.
3.  Add your environment variables to the Vercel dashboard.
4.  Vercel will automatically handle the Convex deployment and frontend build.

---

Built with ❤️ for the farming community.
