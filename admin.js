import { db } from "./firebase-config.js";
import { collection, getDocs, doc, updateDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { DEFAULT_RATES, SERVICES } from "./rates.js";

// ============================================
// SERVICE RATES (admin-editable, live for customers)
// ============================================
const ratesListEl = document.getElementById("ratesList");
const saveRatesBtn = document.getElementById("saveRatesBtn");
const ratesStatusEl = document.getElementById("ratesStatus");
const ratesDocRef = doc(db, "config", "rates");

async function loadRates() {
  ratesListEl.innerHTML = "<p class='hint'>Loading rates...</p>";

  const snap = await getDoc(ratesDocRef);
  const savedRates = snap.exists() ? snap.data() : {};
  // Merge saved values over the defaults so a newly added service always shows up
  const rates = { ...DEFAULT_RATES, ...savedRates };

  ratesListEl.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "rates-grid";

  SERVICES.forEach((service) => {
    const row = document.createElement("div");
    row.className = "rate-row";
    row.innerHTML = `
      <label class="rate-label">${service}</label>
      <div class="rate-input-wrap">
        <span>₹</span>
        <input type="number" min="0" step="10" class="rate-input" data-service="${service}" value="${rates[service]}">
      </div>
    `;
    grid.appendChild(row);
  });

  ratesListEl.appendChild(grid);
}

saveRatesBtn.addEventListener("click", async () => {
  saveRatesBtn.disabled = true;
  saveRatesBtn.textContent = "Saving...";
  ratesStatusEl.textContent = "";

  const newRates = {};
  document.querySelectorAll(".rate-input").forEach((input) => {
    newRates[input.getAttribute("data-service")] = Number(input.value) || 0;
  });

  try {
    // WRITE: overwrite the whole rates document — customer.js reads this live
    await setDoc(ratesDocRef, newRates);
    ratesStatusEl.textContent = "✅ Rates saved — customers will see these immediately.";
    ratesStatusEl.style.color = "#2F8F5B";
  } catch (err) {
    ratesStatusEl.textContent = "❌ Error: " + err.message;
    ratesStatusEl.style.color = "#B5473A";
  } finally {
    saveRatesBtn.disabled = false;
    saveRatesBtn.textContent = "Save rates";
  }
});

loadRates();

const listEl = document.getElementById("workerList");
const refreshBtn = document.getElementById("refreshBtn");

// READ: fetch every document in the "workers" collection
async function loadWorkers() {
  listEl.innerHTML = "<p class='hint'>Loading workers...</p>";

  const snapshot = await getDocs(collection(db, "workers"));

  // Rejected workers are filtered out client-side so they disappear from this
  // panel entirely, while the record itself stays in Firestore for reference.
  const workers = snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((w) => w.status !== "rejected");

  if (workers.length === 0) {
    listEl.innerHTML = "<p class='hint'>No workers yet. Register one on the Worker Signup page first.</p>";
    return;
  }

  listEl.innerHTML = ""; // clear loading text

  workers.forEach((w) => {
    const workerId = w.id;
    const isVerified = w.status === "verified";
    const isPending = !w.status || w.status === "pending";

    const item = document.createElement("div");
    item.className = "worker-item " + (isVerified ? "verified" : "pending");

    item.innerHTML = `
      <div class="worker-info">
        <b>${w.name}</b>
        <div class="worker-meta">
          ${w.skills?.join(", ") || ""} · ${w.area || ""}
          ${w.ratingCount > 0 ? ` · ★ ${w.avgRating} (${w.ratingCount})` : ""}
          ${w.certUrl ? `<br><a href="${w.certUrl}" target="_blank">View ID document ↗</a>` : "<br>No ID uploaded"}
        </div>
      </div>
      <div style="text-align:right;">
        <span class="badge ${isVerified ? "verified" : "pending"}">
          ${isVerified ? "✓ Verified" : "⏳ Pending"}
        </span>
        ${isPending ? `
          <div>
            <button class="approve-btn" data-id="${workerId}">Approve</button>
            <button class="reject-btn" data-id="${workerId}">Reject</button>
          </div>
        ` : ""}
      </div>
    `;

    listEl.appendChild(item);
  });

  // Wire up every "Approve" button that exists right now
  document.querySelectorAll(".approve-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const workerId = btn.getAttribute("data-id");
      btn.disabled = true;
      btn.textContent = "Approving...";

      // UPDATE: flip this one worker's status to verified
      await updateDoc(doc(db, "workers", workerId), { status: "verified" });

      loadWorkers(); // re-fetch the list so the UI reflects the change
    });
  });

  // Wire up every "Reject" button that exists right now
  document.querySelectorAll(".reject-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const workerId = btn.getAttribute("data-id");
      btn.disabled = true;
      btn.textContent = "Rejecting...";

      // UPDATE: flip this worker's status to rejected — loadWorkers() will
      // then filter it out of the panel entirely on the next refresh.
      await updateDoc(doc(db, "workers", workerId), { status: "rejected" });

      loadWorkers();
    });
  });
}

refreshBtn.addEventListener("click", loadWorkers);

// Load workers as soon as the page opens
loadWorkers();

// ============================================
// BOOKINGS OVERVIEW (read-only)
// ============================================
const bookingListEl = document.getElementById("bookingList");
const refreshBookingsBtn = document.getElementById("refreshBookingsBtn");

function formatSchedule(b) {
  if (b.bookingType === "scheduled" && b.scheduledDate) {
    const dateStr = new Date(b.scheduledDate + "T00:00:00").toLocaleDateString("en-IN", {
      day: "numeric", month: "short"
    });
    return `<span class="schedule-tag">📅 Scheduled — ${dateStr}${b.scheduledTime ? " at " + b.scheduledTime : ""}</span>`;
  }
  return `<span class="urgent-tag">⚡ Emergency — now</span>`;
}

async function loadBookings() {
  bookingListEl.innerHTML = "<p class='hint'>Loading bookings...</p>";

  const snapshot = await getDocs(collection(db, "bookings"));

  if (snapshot.empty) {
    bookingListEl.innerHTML = "<p class='hint'>No bookings yet. Make one on the Customer Booking page.</p>";
    return;
  }

  bookingListEl.innerHTML = "";

  // Show newest first
  const bookings = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  bookings.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

  bookings.forEach((b) => {
    const item = document.createElement("div");
    item.className = "worker-item";

    const statusClass = b.status === "completed" ? "verified" : "pending";
    const statusLabel = b.status === "completed" ? "✓ Completed" : "⏳ " + (b.status || "confirmed");

    item.innerHTML = `
      <div class="worker-info">
        <b>${b.customerName}</b> → ${b.workerName}
        <div class="worker-meta">
          ${b.service} · ${b.area} · ₹${b.amount}
          <br>${formatSchedule(b)}
          <br>Payment: ${b.paymentStatus === "paid" ? "✓ Paid" : "Pending"}
        </div>
      </div>
      <span class="badge ${statusClass}">${statusLabel}</span>
    `;

    bookingListEl.appendChild(item);
  });
}

refreshBookingsBtn.addEventListener("click", loadBookings);
loadBookings();
