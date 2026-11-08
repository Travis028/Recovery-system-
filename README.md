# LDRS Web Application (v1.0)

A secure, enterprise-grade Lost and Found Tracking and Recovery Asset System designed to seamlessly manage item lifecycle states, verification criteria, and cross-party handover tracking workflows.

---

## ?? Key Value Operations & Features

The platform provides end-to-end management systems tailored to four distinct internal workflows:

*   **Asset Registration**: Rich form wizards allowing asset owners and finders to report lost/found items with detailed attributes, locations, metadata tags, and documentation.
*   **Intelligent Property Matching**: An asynchronous state-machine algorithm that analyzes, filters, cross-references, and ranks properties to flag automated pairings.
*   **Verification Verification Checks**: Integrated Optical Character Recognition (OCR) systems designed to parse textual strings from digital document receipts to match legal ownership.
*   **Secure Multi-Tier Handovers**: Chain-of-custody protocols tracking item location states, secure multi-digit OTP generation, identity confirmation checks, and signed electronic digital receipts.
*   **Telemetry Auditing & Logs**: Comprehensive platform logging that streams transaction history, administrative settings mutations, access control shifts, and user interaction logs into an absolute system ledger.

---

## ??? Architecture & Tech Stack

This modern web application relies on a decoupled, responsive design system pipeline:

| Layer | Technologies Used | Key System Module |
| :--- | :--- | :--- |
| **Frontend Framework** | React (v18), Vite, SPA Router | Core execution, modular lifecycle rendering hooks |
| **Styling & Theme Engine** | Tailwind CSS, PostCSS, Lucide Icons | Design system tokens (`tokens.css`), persistent Dark-Mode |
| **Interface Elements** | Radix UI, Shadcn Primitives, Data-Table | Paginated search viewport arrays, overlay sheets, dialog modals |
| **Core Client State** | In-Memory Volatile Microdatabase | Simulated reactive API handlers (`src/api/db.js`), mock seeds |
| **Security Engineering** | Secure Cryptography Hashing / OTP | Privacy component canvases, asymmetric personal telemetry safety |

---

## ?? Multi-Tier Access Control Structure

The application secures specialized administrative dashboards matching discrete system permission gates:

*   **Owner Console**: View active loss filings, trace match progress alerts, submit verification paperwork, and view personal security logs.
*   **Finder Portal**: Log found item coordinates, complete instant automated match lookups, and trace drop-off checkpoint configurations.
*   **Officer Dashboard**: Back-office document processing center to verify uploaded item receipts, run custom search filters, evaluate match conflicts, and orchestrate secure handovers.
*   **System Admin Console**: System-wide telemetry viewports tracking live audit ledgers, site metric analytics dashboards, database properties config, and global user management charts.

---

## ?? Codebase Directory Layout

```text
LDRS_Web_App_v1.0/
+-- src/
¦   +-- api/             # Microdatabase mock engine, crypto, permissions, & seeds
¦   +-- components/      # UI Atoms, layout frames, error boundaries, & dashboard consoles
¦   ¦   +-- ui/          # Low-level responsive design elements (buttons, inputs, cards)
¦   ¦   +-- layout/      # App structural sidebars, nav drawer matrices, and headers
¦   ¦   +-- security/    # Multi-factor authentication challenges and verification modules
¦   +-- hooks/           # State monitoring custom hooks tracking session idle cleanups
¦   +-- lib/             # Core engines (OCR processing, tracking match state-machines, CSV generators)
¦   +-- pages/           # Workflow viewports, item wizards, login gates, and metric settings sheets
¦   +-- styles/          # Tailwind setup layers and global design tokens variables
¦   +-- theme/           # Context Providers managing user screen contrast adjustments
+-- public/              # Global framework branding vector matrices and visual layouts
+-- deploy/              # Cloud production server profile settings and traffic headers
+-- docs/                # Setup manuals, validation blueprints, and architectural performance logs
```

---

## ?? Local Workspace Development Setup

Follow these steps to activate your workspace pipeline locally:

### 1. Pre-requisites
Ensure you have **Node.js** (v18+ recommended) and **npm** installed on your system.

### 2. Dependency Installation
Step into your project root folder and load the node modules matrix:
```bash
npm install
```

### 3. Local Server Execution
Fire up the Vite local server runner:
```bash
npm run dev
```
Open the provided local network address (typically `http://localhost:5173`) in your browser to interact with the application shell.

### 4. Code Quality & Standards
To evaluate codebase compliance and analyze layout formats, run your syntax linters:
```bash
# Run linting check
npm run lint

# Execute structural test specs
npm run test
```
