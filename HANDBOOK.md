# Reader Dashboard Handbook

A plain-English guide to using the Amar Ujala Reader Dashboard. No computer experience needed — if you can use WhatsApp or Google, you can use this.

## Contents

1. [What this dashboard is for](#1-what-this-dashboard-is-for)
2. [Logging in](#2-logging-in)
3. [Finding your way around](#3-finding-your-way-around)
4. [The Dashboard home page](#4-the-dashboard-home-page)
5. [Managing Readers](#5-managing-readers)
6. [Marking Attendance](#6-marking-attendance)
7. [Payments](#7-payments)
8. [Coupons](#8-coupons)
9. [Billing — Close Month](#9-billing--close-month)
10. [Reports](#10-reports)
11. [Setting up your organization (Admin only)](#11-setting-up-your-organization-admin-only)
12. [Your account settings](#12-your-account-settings)
13. [Common problems and what they mean](#13-common-problems-and-what-they-mean)
14. [Glossary — words used in this app](#14-glossary--words-used-in-this-app)

---

## 1. What this dashboard is for

This app helps a newspaper business keep track of everyone who gets the paper delivered to them (**Readers**), who delivered it each day (**Attendance**), who has paid and who still owes money (**Payments**), and how the whole business is organized into areas (**Zones, Units, Cities, Centers**).

There are two kinds of people who use this app:

- **Administrator** — can see and do everything, everywhere.
- **AU POC** (Point of Contact) — can only see and manage the Centers they've been assigned to, like a local area manager.

If you're not sure which one you are, ask your Administrator.

---

## 2. Logging in

1. Open the dashboard link in your web browser.
2. Enter the **email** and **password** your Administrator gave you.
3. Click the sign-in button.
4. You'll land on the **Dashboard** home page.

Your first password is usually a temporary one your Administrator shares with you. You can change it any time — see [Section 12](#12-your-account-settings).

**Forgot your password?** Ask your Administrator to create you a new one (see [Section 11](#11-setting-up-your-organization-admin-only)) — there's no self-service "forgot password" link for POCs.

---

## 3. Finding your way around

Everything is controlled from the black **sidebar** on the left. It's organized into groups:

- **Main** — Dashboard, Readers, Attendance, Payments, Reports. Everyone sees these.
- **Admin** — Coupons, Billing. Only Administrators see this group.
- **Master Data** — Zones, Units, Cities, Centers, POCs, Pricing. Only Administrators see this group — this is where the organization's structure and pricing gets set up.

At the bottom of the sidebar you'll see your name and a **Settings** link — that's your own account.

Whichever page you're on is highlighted in the sidebar, so you always know where you are.

---

## 4. The Dashboard home page

This is your at-a-glance summary. It's organized into sections:

- **Readers** — Total readers, how many are Active vs Inactive, and how many were added in the last 30 days.
- **Payments** — Total money collected, money still owed (Outstanding Dues), and how much came in Today and This Month.
- **Delivery** — How many papers were marked Delivered today, how many Absent, and what percent of this month's deliveries have happened.
- **Readers by City** — A quick count of readers in each city you cover.

If you're an AU POC, all of these numbers only reflect your assigned Centers — not the whole business.

---

## 5. Managing Readers

A **Reader** is a person who subscribes to the paper.

### Viewing the list

Click **Readers** in the sidebar. You'll see a table of everyone, with their name, mobile number, city, center, assigned POC, when they subscribed, how much they owe, and whether they're Active or Inactive.

Use the boxes above the table to narrow it down:
- **Search** — type a name, mobile number, email, or reader ID.
- **Status** — Any / Active / Inactive.
- **Center** — Any, or pick a specific one.

Click **Apply filters** to update the list. Click a reader's name to open their full profile.

### A reader's profile page

Here you'll find their contact details, current balance, recent delivery history, payment history, and any coupons applied to them. From here you can also:

- **Send Payment Reminder** — sends them a text message reminding them what they owe.
- **Send Payment Link** (Administrators only) — texts them a secure link they can tap to pay online. This only works once your Administrator has switched online payments on — see [Section 13](#13-common-problems-and-what-they-mean) if it doesn't work.
- **Transfer** (Administrators only) — move this reader to a different Center. Their whole history stays with them.

### Adding one reader

1. Click **Readers**, then the red **Add Reader** button.
2. Fill in: Reader name, Mobile number, Address, and pick a Center. (Email, Landmark, Assigned POC, and Remarks are optional.)
3. Pick their **Subscription start date** — the day their paper deliveries began.
4. Click **Add Reader**.

The system gives every reader an automatic ID code (like `RDR-000123`) — you never need to make one up.

### Adding many readers at once (Bulk Upload)

If you have a list of new readers in an Excel file, you don't have to type them in one by one.

1. Click **Readers**, then **Bulk Upload**.
2. Your spreadsheet needs these columns:
   - **Required:** Reader Name, Mobile Number, Complete Address, City, Center, Subscription Start Date
   - **Optional:** Email, Landmark, Remarks
3. Choose your `.xlsx` file and click **Upload**.
4. You'll see how many readers were added successfully. If some rows had a problem (like a missing Center that doesn't exist yet), you'll see exactly which rows and why — and you can click **Download failed rows** to get a file of just the ones to fix and re-upload.

---

## 6. Marking Attendance

Every day, someone marks whether each reader's paper was **Delivered** or **Not Delivered** (absent). This matters because a reader is only charged for the days they actually received the paper.

**You don't have to mark every single day for every reader.** If a day is never marked, the system assumes it was delivered — so you only really need to mark the days something went wrong (a reader was skipped).

1. Click **Attendance** in the sidebar.
2. Choose your **Scope**:
   - **Individual Reader** — mark one specific person.
   - **Center**, **City**, **Unit**, or **Entire Organization** — mark everyone in that group at once (Administrators only).
3. Pick the **Target** (which reader/center/city/unit — skip this if you chose Entire Organization).
4. Pick the **Date** (or a date range, if marking several days at once).
5. Choose **Delivered** or **Not Delivered (Absent)**.
6. Click **Mark Attendance**.

---

## 7. Payments

### Recording a payment someone made in person

1. Open the reader's profile (search for them under **Readers**), or go to **Payments** and find them there.
2. Fill in the **Amount**, how they paid (**Cash**, **UPI**, **Bank Transfer**, **Razorpay**, or **Other**), the date, and any reference number or note.
3. Click **Record Payment**.

Their outstanding balance updates immediately.

### Seeing all payments

Click **Payments** in the sidebar to see every payment across all your readers. You can filter by search term, date range, Center, and payment method, and (if you're an Administrator) export the list to Excel or CSV.

### Fixing a mistake (reversing a payment)

If a payment was entered wrong or twice, an **Administrator** can undo it:

1. Go to the reader's profile.
2. Find the payment in their history and click **Reverse**.
3. Confirm, and optionally type a reason.

The reader's balance goes back up by that amount, and the payment is marked as reversed (it's never deleted — you can always see what happened).

### Getting paid online (PayU payment links)

Administrators can text a reader a secure payment link so they can pay by card/UPI from their phone, without anyone handling cash. See the **Send Payment Link** button on a reader's profile ([Section 5](#5-managing-readers)). If this doesn't do anything, online payments may not be switched on yet — ask whoever manages the technical setup.

---

## 8. Coupons

A **Coupon** is a fixed discount (like ₹50 or ₹100 off) that an Administrator can give a specific reader — for example, as a welcome offer or a festive discount.

### Creating a coupon (Administrators only)

1. Click **Coupons** in the sidebar.
2. Fill in a **Code** (like `WELCOME50`), an optional description, and the **Discount amount**.
3. Click **Create Coupon**.

### Giving a coupon to a reader

1. Open the reader's profile.
2. Find the coupon section, pick the coupon from the dropdown, and click **Apply Coupon**.

The discount is subtracted from what they owe right away.

---

## 9. Billing — Close Month

This is an **Administrator-only** monthly task. It's the step that actually charges every reader for the papers they received that month.

1. Click **Billing** in the sidebar.
2. Pick the month you want to close (it defaults to the current one).
3. Click **Close Month**.

The system looks at every reader's delivery record for that month and the price that applied on each day, and adds the correct charge to their balance. It's safe to click twice by accident — anyone already charged for that month gets skipped, not charged again.

**Tip:** do this once the month has fully finished, so all the delivery marking for that month is complete.

---

## 10. Reports

Click **Reports** in the sidebar and choose a report type from the dropdown:

- **Reader Report** — everyone's status and balance
- **Payment Due Report** — who still owes money
- **Collection Report** — every payment received, with dates
- **Attendance Report** — delivery/absence counts (pick a date range for this one)
- **City-wise Report / Center-wise Report / POC-wise Report** — totals grouped by area
- **Monthly Summary** — charges, payments, and discounts by month

Click **Run report** to see it on screen. Administrators also get an **Export** button to download it as Excel or CSV.

---

## 11. Setting up your organization (Admin only)

Before you can add readers, your organization's structure needs to exist. Think of it like nested folders — you build from the top down:

**Zone → Unit → City → Center → (then Pricing and POCs, then Readers)**

You must create each level before the next one can point to it — for example, you can't create a Center until its City exists.

1. **Zones** — the biggest regions (e.g. "North Zone"). Just needs a name.
2. **Units** — pick which Zone it belongs to, give it a name.
3. **Cities** — pick which Unit, give it a name.
4. **Centers** — pick which City, give it a name and (optionally) an address. This is the level readers actually belong to.
5. **Pricing** — pick a City, set the monthly price and the date it starts applying from. You can add a new price later that takes over from a future date — old months still bill at the old price automatically.
6. **POCs** — create a login for a local area manager, give them a name, email, optional password (if you leave it blank, one is generated for you to share with them), and tick which Centers they're responsible for.
7. **Administrators** — same page as POCs, lower down. Creates another full-access login.

### Deleting things

Every one of these can be deleted with the **Delete** button next to it — but only if nothing is relying on it. For example, you can't delete a City that still has Centers in it, or a Center that still has readers assigned. If you try, you'll see a message explaining what's still attached — remove or move that first, then delete.

Deleting a POC or Administrator also removes their ability to log in.

---

## 12. Your account settings

Click your name at the bottom of the sidebar, then **Settings**. From there you can update your display name, your email, and your password.

---

## 13. Common problems and what they mean

| What you see | What it means |
|---|---|
| "Cannot delete — other records still depend on this." | You're trying to delete something (a City, Center, POC, etc.) that other things still point to. The message tells you what — for example, a Center with readers in it. Move or remove those first. |
| "This reader has no outstanding balance to collect." | You tried to send a payment link to someone who doesn't owe anything. |
| "PayU payments are disabled." | Online payment links haven't been switched on for this dashboard yet. Ask whoever handles the technical setup. |
| A reader doesn't show up when I search | Check you're not filtered to the wrong Center or Status, and double-check the spelling — search matches name, mobile, email, or reader ID. |
| I can't see a page other Administrators can see | You're probably logged in as an AU POC, not an Administrator — those roles see different things. |
| Excel bulk upload skipped some rows | Open the "failed rows" file it gives you — it lists the exact reason for each row (often a Center name that doesn't match exactly, or a missing required column). |

If something looks wrong and isn't covered here, contact your Administrator or technical support.

---

## 14. Glossary — words used in this app

- **Reader** — a person who receives the newspaper and pays for it.
- **Zone / Unit / City / Center** — the four levels of organization, biggest to smallest. A reader always belongs to one Center.
- **POC (Point of Contact)** — a staff member responsible for one or more Centers.
- **Administrator** — a user with full access to everything.
- **Attendance** — the daily record of whether a reader's paper was delivered or not.
- **Outstanding Balance** — how much money a reader currently owes.
- **Close Month** — the once-a-month action that turns a month's delivery record into an actual bill.
- **Coupon** — a fixed discount applied to one reader's balance.
- **Ledger** — the full history of every charge, payment, and discount for a reader — nothing is ever erased from it, so you can always see how a balance was reached.
- **PayU** — the online payment service readers can use to pay by card or UPI through a text-message link.
- **DLT template** — a pre-approved wording for text messages, required by Indian telecom rules — this is why SMS wording in this app can't be freely changed.
