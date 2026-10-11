# CareerPilot

CareerPilot is a local-first AI job-search dashboard for Windows. It uses:

- React and Vite for the frontend
- n8n for workflow orchestration
- Ollama for local AI inference
- Qwen `qwen2.5:7b` for resume profiling, experience classification, and application drafts

CareerPilot discovers job listings, separates confirmed early-career roles from roles that need verification, and prepares application material for review. It **does not submit applications automatically**.

## Contents

1. [How it works](#how-it-works)
2. [Prerequisites](#prerequisites)
3. [Project structure](#project-structure)
4. [Installation](#installation)
5. [Configure Ollama](#configure-ollama)
6. [Configure n8n](#configure-n8n)
7. [Start CareerPilot](#start-careerpilot)
8. [Use the dashboard](#use-the-dashboard)
9. [Search filters](#search-filters)
10. [Generated files](#generated-files)
11. [Troubleshooting](#troubleshooting)
12. [Security and privacy](#security-and-privacy)
13. [License](#license)
14. [Development commands](#development-commands)

## How it works

CareerPilot has two n8n workflows:

### Resume workflow

1. The dashboard sends a PDF as `multipart/form-data`.
2. The upload field is named `resume`.
3. n8n extracts the PDF text.
4. Ollama/Qwen creates and validates a candidate profile.
5. n8n saves the profile to `D:\job-agent\candidate-profile.json`.

### Search workflow

1. The dashboard sends the selected filters as JSON.
2. n8n queries the configured public job feeds and company career boards.
3. The workflow prefilters and classifies roles.
4. Qwen separates confirmed, likely entry-level, manual-review, and excluded roles.
5. n8n writes the report to `D:\job-agent\entry-level-job-report.json`.
6. The report is returned to the dashboard.

The frontend communicates with n8n through the Vite development proxy, so browser CORS configuration is not required for local development.

## Prerequisites

Install the following before configuring the project:

1. **Windows 10 or Windows 11**
2. **Node.js LTS**, including npm
3. **n8n**
4. **Ollama for Windows**
5. Sufficient disk space for Node dependencies and the Qwen model
6. A PDF resume, if you want to build a candidate profile

Recommended versions:

- Node.js 20 LTS or newer
- npm 10 or newer
- Current n8n release
- Current Ollama release

Check the installations in PowerShell:

```powershell
node --version
npm --version
n8n --version
ollama --version
```

## Project structure

```text
careerpilot-local-ai-job-agent/
├── n8n/
│   ├── careerpilot-entry-level-search-webhook.json
│   └── careerpilot-resume-upload-webhook.json
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── README.md
└── vite.config.js
```

Do not edit files inside `node_modules` or `dist`. They are generated locally and are ignored by Git.

## Installation

### 1. Open PowerShell

Open PowerShell and move to the project directory:

```powershell
cd D:\careerpilot-local-ai-job-agent
```

If the project is stored somewhere else, use that path instead.

### 2. Install frontend dependencies

```powershell
npm install
```

This installs React, React DOM, Vite, and the Vite React plugin from `package-lock.json`.

### 3. Create the local data directory

The workflows use `D:\job-agent` for local profile and report files:

```powershell
New-Item -ItemType Directory -Force D:\job-agent
```

The n8n process must have permission to read and write this directory.

## Configure Ollama

### 1. Start Ollama

Ollama normally runs as a Windows background service. If it is not running, start it from the Ollama application or run:

```powershell
ollama serve
```

Keep that PowerShell window open if you start it manually.

### 2. Download the required model

```powershell
ollama pull qwen2.5:7b
```

Verify that the model is available:

```powershell
ollama list
```

The workflows expect Ollama at:

```text
http://127.0.0.1:11434
```

If Ollama is configured to use another host or port, update the Ollama HTTP Request nodes in both imported n8n workflows.

## Configure n8n

### 1. Start n8n

If n8n is installed globally:

```powershell
n8n start
```

Open the n8n editor at:

```text
http://127.0.0.1:5678
```

You can also start n8n with:

```powershell
n8n
```

### 2. Import the workflows

In n8n:

1. Open the project/workspace where you want to keep the workflows.
2. Choose **Import from File**.
3. Import `n8n\careerpilot-resume-upload-webhook.json`.
4. Import `n8n\careerpilot-entry-level-search-webhook.json`.
5. Save both workflows.

### 3. Confirm the webhook paths

The frontend expects these paths:

| Purpose | Method | Path |
|---|---:|---|
| Resume upload | `POST` | `/webhook/ai-job-agent-upload-resume` |
| Job search | `POST` | `/webhook/ai-job-agent-search` |

The Vite proxy maps frontend requests as follows:

```text
/n8n-api/webhook/ai-job-agent-upload-resume
    -> http://127.0.0.1:5678/webhook/ai-job-agent-upload-resume

/n8n-api/webhook/ai-job-agent-search
    -> http://127.0.0.1:5678/webhook/ai-job-agent-search
```

### 4. Activate only the correct workflows

Activate both imported workflows.

Before activating the search workflow, deactivate any older workflow that also registers:

```text
POST /webhook/ai-job-agent-search
```

Only one active workflow should own that webhook path. Otherwise n8n may route requests to the wrong workflow or report a duplicate webhook registration.

### 5. Configure file access

If n8n is running with file-access restrictions, add this directory to its allowed file paths:

```text
D:\job-agent
```

The workflows need to:

- write `candidate-profile.json`
- read `candidate-profile.json`
- write `entry-level-job-report.json`

### 6. Verify workflow nodes

Before using the dashboard, check the following:

- The resume Webhook node accepts `POST`.
- The resume binary field is named `resume`.
- The resume workflow uses the `qwen2.5:7b` Ollama model.
- The search Webhook node accepts `POST`.
- The search workflow uses the `qwen2.5:7b` Ollama model.
- Both workflows return their final result through the configured Respond to Webhook node.
- The file nodes point to `D:\job-agent`.

## Start CareerPilot

### Development mode

From the project directory:

```powershell
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

Keep the n8n and Ollama processes running while using the dashboard.

### Production build preview

Build the frontend:

```powershell
npm run build
```

Preview the production build:

```powershell
npm run preview
```

Open:

```text
http://127.0.0.1:4173
```

The Vite proxy configuration is available for both development and preview mode.

## Use the dashboard

### First-time setup

1. Start Ollama.
2. Confirm `qwen2.5:7b` is installed.
3. Start n8n.
4. Confirm both workflows are imported and active.
5. Start the Vite frontend.
6. Open `http://127.0.0.1:5173`.

### Upload a resume

1. Click **Upload resume**.
2. Select a PDF under 12 MB.
3. Click **Update profile**.
4. Wait for the profile status to show success.
5. Confirm that n8n created or updated:

```text
D:\job-agent\candidate-profile.json
```

The upload field must remain named `resume`. Do not rename it without updating the Webhook and file-extraction nodes in the resume workflow.

### Run a search

1. Set the location or countries.
2. Select the work arrangement.
3. Select the maximum required experience.
4. Expand **More filters** if you need role families, sources, employment types, posting age, keywords, salary settings, or job-analysis limits.
5. Click **Search jobs**.
6. Wait for n8n to query sources and for Qwen to classify the results.
7. Review confirmed roles separately from roles that require verification.

### Load an existing report

Use the upload icon in the top bar to select a previously generated JSON report, such as:

```text
D:\job-agent\entry-level-job-report.json
```

You can also load a report copied from another machine if it follows the same report format.

### Download a report

When a report is loaded, use the dashboard download action to save a copy of the complete JSON report.

## Search filters

The frontend sends the filter object inside the search request without changing the existing webhook path:

```json
{
  "source": "careerpilot-frontend",
  "requested_at": "2026-01-01T00:00:00.000Z",
  "filters": {
    "locations": ["India"],
    "workMode": "remote",
    "experienceMaxYears": 1,
    "postedWithinDays": 30,
    "maxJobsToClassify": 80,
    "minSalary": "",
    "roleCategories": ["backend", "ai_ml"],
    "employmentTypes": ["full-time"],
    "sources": ["himalayas", "greenhouse"],
    "includeKeywords": ["Python"],
    "excludeKeywords": ["senior"],
    "salaryOnly": false,
    "includeRemoteWithUnknownLocation": true
  }
}
```

Available filter behavior:

- **Locations**: comma-separated alternatives. Blank means all locations.
- **Work arrangement**: any, remote, hybrid, or on-site.
- **Maximum experience**: no experience, 0–1, 0–2, 0–3, 0–5, or any experience.
- **Role families**: controls targeted role searches and job matching.
- **Employment types**: full-time, internship, contract/freelance, and part-time.
- **Sources**: public feeds and supported company career boards.
- **Posting age**: limits how recent listings should be.
- **Include keywords**: listings must contain at least one selected term.
- **Exclude keywords**: listings containing excluded terms are removed.
- **Minimum salary**: passes a minimum disclosed salary preference when supported by the imported workflow.
- **Salary only**: hides listings without disclosed salary information.
- **Remote jobs with unclear location**: keeps ambiguous remote roles for manual verification when enabled.
- **Jobs to assess with Qwen**: controls the classification workload and search duration.

The workflow remains the source of truth for filtering and classification. Always verify the original posting before applying.

## Generated files

The application itself does not commit local reports or candidate data to the repository.

| File | Purpose |
|---|---|
| `D:\job-agent\candidate-profile.json` | Structured candidate profile generated from the resume |
| `D:\job-agent\entry-level-job-report.json` | Latest search report, classifications, company data, and drafts |

The repository `.gitignore` also excludes generated report filenames if they are copied into the project directory accidentally.

## Troubleshooting

### Frontend does not start

Check Node and npm:

```powershell
node --version
npm --version
```

Then reinstall dependencies:

```powershell
cd D:\careerpilot-local-ai-job-agent
npm install
npm run dev
```

If port `5173` is already in use, stop the existing Vite process or close the other development server before starting CareerPilot again.

### Search returns a 404 or webhook error

Confirm:

1. n8n is running at `http://127.0.0.1:5678`.
2. The search workflow is active.
3. The path is exactly `ai-job-agent-search`.
4. No older workflow owns the same path.
5. The Webhook node uses `POST`.
6. The final response is returned by a Respond to Webhook node.

Inspect the latest execution in n8n for the failing node.

### Resume upload returns 400 or 502

Confirm:

1. The selected file is a PDF.
2. The file is under 12 MB.
3. The resume Webhook node accepts `POST`.
4. The binary field is exactly `resume`.
5. Ollama is running.
6. `qwen2.5:7b` is installed.
7. n8n can write to `D:\job-agent`.

The frontend sends the upload as multipart form data with:

```text
field name: resume
```

### Ollama errors

Check that Ollama is reachable:

```powershell
ollama list
```

If the model is missing:

```powershell
ollama pull qwen2.5:7b
```

If the workflow reports a connection failure, make sure Ollama is listening on:

```text
http://127.0.0.1:11434
```

### Search takes several minutes

This is expected when many sources and jobs are selected. Qwen evaluates roles locally and may take longer on a CPU-only machine.

For a faster run:

- reduce **Jobs to assess with Qwen**
- select fewer sources
- select a narrower posting age
- select fewer role families

Do not refresh the page while a search is running unless you are prepared to restart the request.

### No confirmed matches

This does not necessarily mean no suitable jobs exist. The strict confirmed bucket only includes roles whose experience evidence fits the selected maximum. Review:

- likely entry-level roles
- manual-review roles
- company career pages
- the original employer posting

### Report loads but some fields are blank

Reports can contain optional fields depending on the source. CareerPilot handles missing fields defensively, but source feeds may not provide salary, location, company career URLs, or publication dates for every listing.

## Security and privacy

- Keep the frontend and n8n bound to localhost unless you intentionally configure authentication and network controls.
- Do not commit resume files, candidate profiles, reports, API keys, or credentials.
- Do not place Ollama or n8n authentication tokens in frontend source code.
- Review location, work authorization, salary, and experience requirements on the original posting.
- Review all AI-generated cover letters, resume suggestions, and screening answers before using them.
- CareerPilot does not submit applications automatically.

## License

CareerPilot is licensed under the [PolyForm Noncommercial License 1.0.0](./LICENSE).

You may use, study, modify, and share this project for non-commercial purposes,
subject to the terms in the license. Commercial use is not permitted under this
license.

Because this license restricts commercial use, it is **not an OSI-approved
open-source license** in the strict legal sense. It is a source-available,
non-commercial license. If you later want OSI open-source status and broad
commercial adoption, use a permissive license such as MIT or Apache-2.0 instead.

The project depends on third-party software, including React, React DOM, Vite,
n8n, Ollama, and Qwen. Those tools and models remain subject to their own
licenses and terms. This project license does not relicense them.

## Development commands

Run the development server:

```powershell
npm run dev
```

Create a production build:

```powershell
npm run build
```

Preview the production build:

```powershell
npm run preview
```

The project currently has no automated test script. At minimum, run `npm run build` after frontend changes to verify that the React application compiles successfully.
