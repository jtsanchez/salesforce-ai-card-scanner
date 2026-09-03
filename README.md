# 📇 CardSync — AI Business Card Scanner for Salesforce

> Scan a business card, extract contact details with AI, and push them straight to Salesforce — no manual data entry.

![Salesforce](https://img.shields.io/badge/Salesforce-00A1E0?style=flat&logo=salesforce&logoColor=white)
![Claude AI](https://img.shields.io/badge/Claude_AI-191919?style=flat&logo=anthropic&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-Model_Context_Protocol-blue?style=flat)
![License](https://img.shields.io/badge/License-MIT-green?style=flat)

<!-- 
Add a screenshot or demo GIF here. Replace the placeholder below:
![CardSync Demo](docs/screenshots/demo.png)
-->

---

## What it does

CardSync photographs or uploads a business card image, uses Claude AI to extract structured fields, and syncs the data to Salesforce as a Contact linked to the correct Account.

**Extracted fields:**

| Business Card | Salesforce Field |
|---|---|
| First Name | `Contact.FirstName` |
| Last Name | `Contact.LastName` |
| Job Title | `Contact.Title` |
| Company | `Account` (linked) |
| Phone | `Contact.Phone` |
| Email | `Contact.Email` |

**Smart matching built in:**
- **Fuzzy company matching** — "Acme Corp.", "ACME Cor", and "acme" all resolve to the existing Account "Acme Corp" using SOSL full-text search.
- **Duplicate detection** — If the Contact already exists under the same Account, CardSync updates it instead of creating a duplicate. If two people share the same name at different companies, it correctly creates separate records.

---

## How it works

```
┌──────────────┐     ┌───────────┐     ┌──────────────────┐     ┌────────────┐
│  Upload card │────▶│ Claude AI │────▶│ Review & confirm │────▶│ Salesforce │
│  image       │     │ extracts  │     │ extracted fields │     │ via MCP    │
└──────────────┘     └───────────┘     └──────────────────┘     └────────────┘
```

1. User uploads or photographs a business card
2. Claude AI (Sonnet) reads the image and returns structured JSON
3. User reviews and optionally edits the extracted fields
4. Claude AI calls Salesforce via MCP to search for existing Accounts/Contacts, then creates or updates as needed

---

## Tech stack

- **AI**: Claude API (Sonnet 4.6) — vision for card reading, agentic for Salesforce operations
- **Salesforce integration**: Model Context Protocol (MCP) via SObject All server
- **Auth**: OAuth 2.0 with External Client App (JWT)
- **Frontend**: Vanilla HTML/JS (standalone) or React JSX (Claude artifact)

---

## Two ways to use CardSync

| Option | Description | Requires |
|---|---|---|
| [**Try it in Claude**](https://claude.ai/share/002829f1-5edc-455c-9b6b-c3291802df1b) | Interactive artifact — click and go | Claude account (free) |
| `cardsync.html` | Standalone — open in any browser | Anthropic API key |

The JSX source code (`business-card-scanner.jsx`) is also included for anyone who wants to study or remix it.

Both options require a one-time Salesforce org setup. See the full [Setup Guide](docs/setup-guide.md).

---

## Quick start

### Option A: Claude Artifact (easiest)

1. Open the [CardSync artifact](https://claude.ai/share/002829f1-5edc-455c-9b6b-c3291802df1b)
2. Add your Salesforce connector in Claude settings (Customize → Connectors) — see the [Setup Guide](docs/setup-guide.md) for details
3. Upload a business card and hit **Push to Salesforce**

### Option B: Standalone HTML (no Claude account needed)

1. Download `cardsync.html` and open it in any browser
2. Paste your [Anthropic API key](https://console.anthropic.com) into the field at the top
3. Expand ⚙️ and confirm the Salesforce MCP endpoint matches your org
4. Upload a business card and hit **Push to Salesforce**

📖 **Full setup instructions including Salesforce org configuration:** [docs/setup-guide.md](docs/setup-guide.md)

---

## Salesforce setup (summary)

Detailed steps are in the [Setup Guide](docs/setup-guide.md). At a high level:

1. **Activate the MCP server** — Setup → MCP → Salesforce Servers → SObject All → Activate
2. **Create an External Client App** — for OAuth 2.0 authentication
3. **Connect to Claude** — add a custom connector with the SObject All URL and your Consumer Key

---

## Project structure

```
salesforce-ai-card-scanner/
├── cardsync.html                  # Standalone version (open in browser)
├── business-card-scanner.jsx      # Claude artifact version
├── docs/
│   ├── setup-guide.md             # Full setup instructions
│   └── screenshots/               # Add your demo screenshots here
├── .gitignore
├── LICENSE
└── README.md
```

---

## Adding screenshots

To make this repo shine on LinkedIn and GitHub, add screenshots to `docs/screenshots/`:

1. **Scan step** — the upload screen with a card image
2. **Review step** — extracted fields filled in
3. **Result step** — "Contact synced" confirmation
4. **Salesforce** — the Contact record in Salesforce showing the synced data

Then uncomment the image tag at the top of this README and update the path.

---

## Future improvements

- [ ] Bulk scan — process multiple cards from a folder
- [ ] Photo capture — use device camera directly in browser
- [ ] LinkedIn lookup — enrich the contact with LinkedIn profile data
- [ ] Scan history — local log of previously scanned cards
- [ ] Lead vs Contact — option to create as a Salesforce Lead instead

---

## License

MIT — see [LICENSE](LICENSE).

---

## Author

Built as part of a Salesforce AI portfolio. Connect with me on [LinkedIn](https://www.linkedin.com/in/jann-pauline-sanchez/).
