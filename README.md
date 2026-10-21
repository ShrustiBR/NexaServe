# NexaServe — Cooperative Gig Services (Worker Signup + Admin + Customer Booking)

A working template using plain HTML/CSS/JS + Firebase. No React, no build tools.

## What's new in this version
- **Ratings**: after a customer pays, a 5-star rating widget appears. It updates the booking (`rating`) and recalculates the worker's `avgRating`/`ratingCount`, which now feeds the "highly matched worker" ranking on the booking page.
- **Worker "My Jobs" view** (`worker.html`): a worker enters their registered phone number to see their verification status, rating, and every booking assigned to them — read-only, no separate login system needed.
- **Admin-set rates**: Admin can now set the price for each service from a "Service Rates" panel. Prices live in Firestore (`config/rates`) and `customer.js` reads them live, so a change is reflected the next time a customer searches — no code edits needed.
- **Reject flow**: Admin can now Approve *or* Reject a pending worker. Rejected workers are filtered out of the Admin panel entirely (the record stays in Firestore with `status: "rejected"`, it just won't render).
- **Scheduled bookings**: Customers choose Emergency or Scheduled. Scheduled bookings ask for a date + time, which is stored on the booking and shown in the Admin → Bookings panel.
- **Multiple worker matches**: instead of auto-picking one worker, customers now see a shortlist (best area match highlighted as "Best match", plus other verified workers with the same skill) and pick who to book.
- **More services**: Plumbing, Electrical, Cleaning, Carpentry, Painting, Caregiving, Pest Control, Appliance Repair, AC Repair, Gardening, Home Tutoring, Packers & Movers, Salon at Home, Cooking & Catering.
- **More Bengaluru areas**: Whitefield, Koramangala, HSR Layout, Jayanagar, Indiranagar, Marathahalli, Electronic City, BTM Layout, Malleswaram, Rajajinagar, Yelahanka, JP Nagar, Banashankari, Hebbal, Sarjapur Road, Bellandur.
- **Redesigned CSS**: new malachite-green + brass palette, Fraunces/Inter typography, restyled cards, badges, buttons, and a dedicated "best match" worker card.

## Files
- `index.html` + `app.js` — worker signup form (writes to Firestore; ID doc stored as Base64, no Storage/billing needed)
- `admin.html` + `admin.js` — admin view (reads workers + bookings from Firestore; approve/reject workers; set service rates)
- `customer.html` + `customer.js` — customer booking flow (search → shortlist → book → pay → rate)
- `worker.html` + `worker.js` — worker view (look up by phone → see status, rating, and assigned bookings)
- `style.css` — shared styling
- `rates.js` — default service list + fallback prices, shared by admin.js and customer.js
- `firebase-config.js` — your Firebase credentials go here

## Data model
**`workers` collection**
```
{ name, phone, skills: [skill], area, certUrl, status: "pending" | "verified" | "rejected",
  available, avgRating, ratingCount, createdAt }
```

**`config/rates` document** (single doc, one field per service)
```
{ Plumbing: 300, Electrical: 350, ... }
```

**`bookings` collection**
```
{ customerName, workerId, workerName, service, area, urgent, bookingType: "emergency" | "scheduled",
  scheduledDate, scheduledTime, amount, status, paymentStatus, rating, createdAt }
```

## Setup (do this once, ~10 minutes)

### 1. Create a Firebase project
- Go to https://console.firebase.google.com
- Click "Add project" → name it (e.g. "nexaserve") → skip Google Analytics
- Once created, click the **`</>`** (web) icon → register an app (any nickname) → **copy the `firebaseConfig` object** it shows you

### 2. Paste your config
Open `firebase-config.js` and replace the placeholder values with what you copied (this project's file already has a working demo config — swap in your own for a fresh project).

### 3. Turn on Firestore
- In the Firebase Console sidebar: **Build → Firestore Database → Create database**
- Choose **Start in test mode** (open read/write — fine for a hackathon)
- Pick any region, click Enable

That's it — no other setup needed (ID documents are stored as Base64 strings directly in Firestore, so Storage isn't required).

## Running it locally

Because these files use `type="module"` script imports, you can't just double-click the HTML file — it needs to be served.

**VS Code Live Server extension**
- Install the "Live Server" extension in VS Code
- Right-click `index.html` → "Open with Live Server"

**Or Python's built-in server**
```bash
cd nexaserve
python3 -m http.server 5500
```
Then open `http://localhost:5500` in your browser.

## How to test it
1. Open `index.html`, fill the form, upload any image as the ID, click Register.
2. Open `admin.html` — you'll see the worker you just registered, live from Firestore. Click **Approve** (or **Reject** — try it, the worker disappears from the panel). Try the **Service Rates** panel too — change a price and hit Save.
3. Open `customer.html`, search for the same service/area, choose Emergency or Scheduled (pick a date + time for Scheduled), and you'll see a shortlist of verified workers with the best area match highlighted, priced at whatever Admin set.
4. Pick a worker → confirm → Pay Now → rate the worker with the star widget that appears.
5. Open `worker.html`, enter the worker's phone number — you'll see their status, updated rating, and the booking you just made, right there.
6. Back in `admin.html` → Bookings, refresh to see the booking with its schedule info, payment status, and rating.

## Deploying (when you're ready to demo on a real link)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# when it asks for your public directory, type: .
# when it asks "configure as single-page app", say No
firebase deploy
```
You'll get a live URL like `https://nexaserve-xxxx.web.app` to demo from.

## Extending further
- **Writing data** → copy the pattern in `app.js`: read form values → `addDoc(collection(db, "COLLECTION_NAME"), {...})`
- **Reading data** → copy the pattern in `admin.js`: `getDocs(collection(db, "COLLECTION_NAME"))` then loop over the results
- **Filtered/ranked reading** → see `customer.js`: a `query()` with `where()` clauses, then client-side `.sort()` to rank matches
- **Updating a status** → copy the pattern in `admin.js`'s approve/reject buttons: `updateDoc(doc(db, "COLLECTION_NAME", id), { field: newValue })`

Every teammate can build their screen as its own `.html` + `.js` pair, all importing the same `firebase-config.js` — no merge conflicts on a shared backend file, no separate server to run.
