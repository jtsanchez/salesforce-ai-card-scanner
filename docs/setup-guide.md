# CardSync Setup Guide

A business card scanner that extracts contact details using AI and syncs them to your Salesforce org.

---

## Which version should I use?

There are two versions of CardSync. Pick the one that fits your situation.

| | **Claude Artifact (.jsx)** | **Standalone File (.html)** |
|---|---|---|
| Requires a Claude account | Yes (free or paid) | No |
| Requires an Anthropic API key | No | Yes ($) |
| How to open | Open the shared conversation link in Claude | Double-click the file in any browser |
| Best for | Quick use, no technical setup | Sharing broadly, no Claude account needed |

Both versions require a one-time Salesforce setup (below).

---

## Part 1 — Salesforce Setup (required for both versions)

You need admin access to your Salesforce org. If you don't have one, sign up for a free Developer Edition at [developer.salesforce.com/signup](https://developer.salesforce.com/signup).

### 1A. Activate the MCP Server

1. Log in to Salesforce. Click the gear icon → **Setup**.
2. In the Quick Find box, search for **MCP**.
3. Click **Salesforce Servers** under MCP.
4. Find **SObject All** and click into it.
5. Click **Activate**.

This enables the API endpoint that lets CardSync read and write Contacts and Accounts.

### 1B. Create an External Client App

This gives Claude permission to authenticate with your org via OAuth.

1. In Setup, search for **External Client** in Quick Find.
2. Click **External Client App Manager** → **New External Client App**.
3. Fill in the Basic Information (name it something like "CardSync").
4. Expand **API (Enable OAuth Settings)** and check **Enable OAuth**.
5. Set the **Callback URL** to:
   - If using the Claude artifact: `https://claude.ai/api/mcp/auth_callback`
   - If using the standalone HTML with the Anthropic API directly: `https://claude.ai/api/mcp/auth_callback` (same URL — the API routes through the same auth flow)
6. Add these **OAuth Scopes**:
   - **Access MCP servers** (`mcp_api`)
   - **Perform requests at any time** (`refresh_token`)
7. Under **Security**, select **Issue JSON Web Token (JWT)-based access tokens for named users** and deselect the others.
8. Click **Create**.
9. **Wait up to 30 minutes** for the app to become available.
10. Once ready, go to **Settings → Consumer Key and Secret** under OAuth Settings and copy the **Consumer Key**. You'll need this in Part 2.

---

## Part 2A — Setup for Claude Artifact (.jsx version)

**Requires:** A Claude account (free or paid) at [claude.ai](https://claude.ai).

### Connect Salesforce to Claude

1. In Claude, click **Customize** in the left sidebar.
2. Click **Connectors** → click the **+** button → **Add custom connector**.
3. Enter a name (e.g. "Salesforce SObject All").
4. Enter the server URL:
   - **Production org:** `https://api.salesforce.com/platform/mcp/v1/platform/sobject-all`
   - **Sandbox org:** `https://api.salesforce.com/platform/mcp/v1/sandbox/platform/sobject-all`
5. Under **OAuth client**, select **"Use your own OAuth client"**.
6. Paste the **Consumer Key** from Part 1B. Leave the secret blank.
7. Click **Add**.
8. Click **Connect** next to the connector. You'll be redirected to Salesforce to log in and authorize.

### Use CardSync

1. Open the shared CardSync conversation link.
2. Click the artifact to open the scanner.
3. Upload or photograph a business card.
4. Review and edit the extracted fields.
5. Click **Push to Salesforce**.

---

## Part 2B — Setup for Standalone HTML (.html version)

**Requires:** An Anthropic API key. No Claude account needed.

### Get an API key

1. Go to [console.anthropic.com](https://console.anthropic.com) and create an account.
2. Go to **API Keys** → **Create Key**. Copy it.
3. Add billing/credits — API calls cost a small amount per scan (typically a few cents each).

### Use CardSync

1. Open `cardsync.html` in any browser.
2. Paste your **API key** into the field at the top of the page.
3. Expand the **⚙️ Salesforce MCP endpoint** section at the bottom of the card.
4. Set the **MCP Server Name** to: `salesforce-sobject-all`
5. Set the **MCP Server URL** to:
   - **Production:** `https://api.salesforce.com/platform/mcp/v1/platform/sobject-all`
   - **Sandbox:** `https://api.salesforce.com/platform/mcp/v1/sandbox/platform/sobject-all`
6. Upload or photograph a business card.
7. Review and edit the extracted fields.
8. Click **Push to Salesforce**.

---

## What CardSync does

When you push a card, CardSync:

1. **Searches for the company** using fuzzy matching — "Acme Corp.", "ACME Cor", and "acme" all match "Acme Corp".
2. **Creates the Account** if no match is found.
3. **Checks for an existing Contact** with the same name at that company.
4. **Updates** the existing Contact if found, or **creates** a new one if not.
5. If two people share the same name but work at different companies, it correctly creates separate Contact records.

### Fields synced

| Business Card | Salesforce Contact Field |
|---|---|
| First Name | `FirstName` |
| Last Name | `LastName` |
| Job Title | `Title` |
| Company | `Account` (linked) |
| Phone | `Phone` |
| Email | `Email` |

---

## Troubleshooting

**"Couldn't register with sign-in service"**
→ Make sure you selected "Use your own OAuth client" and pasted the Consumer Key. The default "No client ID — register one automatically" option does not work.

**Claude responds with instructions instead of actually creating the Contact**
→ The MCP connector isn't connected or is pointing to the wrong server. Verify the server URL is `https://api.salesforce.com/platform/mcp/v1/platform/sobject-all` and that the connector shows as connected in Claude settings.

**"FIELD_INTEGRITY_EXCEPTION" on BillingState**
→ Your org has state/country picklists enabled. You can ignore this — it only affects Account creation, and CardSync will retry without the state field.

**Duplicate detected but not updated**
→ This was fixed in the latest version. If you're seeing this, re-open the artifact or re-download the HTML file.

**External Client App not showing up**
→ It can take up to 30 minutes after creation. Wait and try again.
