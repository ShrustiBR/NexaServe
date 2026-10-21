import { db } from "./firebase-config.js";
import { collection, addDoc, getDocs, query, where, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { DEFAULT_RATES } from "./rates.js";

const requestStep = document.getElementById("requestStep");
const matchStep = document.getElementById("matchStep");
const confirmStep = document.getElementById("confirmStep");

const requestForm = document.getElementById("requestForm");
const matchStatus = document.getElementById("matchStatus");
const findBtn = document.getElementById("findBtn");
const matchListEl = document.getElementById("matchList");

const scheduleFields = document.getElementById("scheduleFields");
const schedDateEl = document.getElementById("schedDate");
const schedTimeEl = document.getElementById("schedTime");

let currentRequest = {};  // holds what the customer selected
let currentMatches = [];  // holds the ranked list of matched workers for this search

// Federation rates set by Admin (config/rates in Firestore), falling back to
// DEFAULT_RATES for any service the admin hasn't saved a custom price for yet.
async function getRates() {
  const snap = await getDoc(doc(db, "config", "rates"));
  const savedRates = snap.exists() ? snap.data() : {};
  return { ...DEFAULT_RATES, ...savedRates };
}

// ------------------------------------------------------------
// Emergency vs. Scheduled toggle
// ------------------------------------------------------------
document.querySelectorAll('input[name="bookingType"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const isScheduled = document.querySelector('input[name="bookingType"]:checked').value === "scheduled";
    scheduleFields.style.display = isScheduled ? "block" : "none";
    schedDateEl.required = isScheduled;
    schedTimeEl.required = isScheduled;
  });
});

// Default the date picker to today so it's never left blank by accident
schedDateEl.min = new Date().toISOString().split("T")[0];

// ------------------------------------------------------------
// STEP 1 → STEP 2: search for matching workers
// ------------------------------------------------------------
requestForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const custName = document.getElementById("custName").value;
  const service = document.getElementById("service").value;
  const area = document.getElementById("area").value;
  const bookingType = document.querySelector('input[name="bookingType"]:checked').value;
  const scheduledDate = bookingType === "scheduled" ? schedDateEl.value : null;
  const scheduledTime = bookingType === "scheduled" ? schedTimeEl.value : null;

  if (bookingType === "scheduled" && (!scheduledDate || !scheduledTime)) {
    matchStatus.textContent = "❌ Please pick a date and time for a scheduled booking.";
    matchStatus.style.color = "#B5473A";
    return;
  }

  findBtn.disabled = true;
  matchStatus.textContent = "Searching for verified workers...";
  matchStatus.style.color = "#57655D";

  try {
    // READ: every verified worker with this skill, anywhere in the city.
    // We rank client-side so we can surface the best area match AND a few
    // useful alternates (same skill, nearby area) instead of just one pick.
    const q = query(
      collection(db, "workers"),
      where("skills", "array-contains", service),
      where("status", "==", "verified")
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      matchStatus.textContent = "❌ No verified worker available yet for this service. Try another service, or verify a worker first in Admin View.";
      matchStatus.style.color = "#B5473A";
      findBtn.disabled = false;
      return;
    }

    const workers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Rank: same-area workers first, then by rating, capped to a shortlist
    const ranked = workers
      .map((w) => ({ ...w, sameArea: w.area === area }))
      .sort((a, b) => {
        if (a.sameArea !== b.sameArea) return a.sameArea ? -1 : 1;
        return (b.avgRating || 0) - (a.avgRating || 0);
      })
      .slice(0, 4);

    currentMatches = ranked;
    const rates = await getRates();
    currentRequest = { custName, service, area, bookingType, scheduledDate, scheduledTime, rate: rates[service] || 300 };

    renderMatches(ranked, area, service, currentRequest.rate);

    requestStep.style.display = "none";
    matchStep.style.display = "block";

  } catch (err) {
    matchStatus.textContent = "❌ Error: " + err.message;
    matchStatus.style.color = "#B5473A";
    console.error(err);
  } finally {
    findBtn.disabled = false;
  }
});

function renderMatches(workers, area, service, rate) {
  matchListEl.innerHTML = "";

  workers.forEach((w, i) => {
    const isBest = i === 0 && w.sameArea;
    const card = document.createElement("div");
    card.className = "match-card" + (isBest ? " best-match" : "");

    card.innerHTML = `
      <div class="match-row">
        <div class="worker-info">
          <b>${w.name}</b>
          <div class="worker-meta">
            ${w.skills.join(", ")} · ${w.area}${w.sameArea ? "" : " (nearby)"}
            ${w.avgRating ? `· ★ ${w.avgRating}` : ""}
          </div>
        </div>
        <div class="match-rate">₹${rate}</div>
      </div>
      <button class="select-btn" data-id="${w.id}">Book this worker</button>
    `;

    matchListEl.appendChild(card);
  });

  document.querySelectorAll(".select-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const workerId = btn.getAttribute("data-id");
      const worker = currentMatches.find((w) => w.id === workerId);
      btn.disabled = true;
      btn.textContent = "Booking...";
      await confirmBooking(worker);
    });
  });
}

// ------------------------------------------------------------
// STEP 2 → STEP 3: create the booking
// ------------------------------------------------------------
async function confirmBooking(worker) {
  const rate = currentRequest.rate;

  // WRITE: create the booking document — this is what Admin's Bookings tab will show
  const bookingRef = await addDoc(collection(db, "bookings"), {
    customerName: currentRequest.custName,
    workerId: worker.id,
    workerName: worker.name,
    service: currentRequest.service,
    area: currentRequest.area,
    urgent: currentRequest.bookingType === "emergency",
    bookingType: currentRequest.bookingType,
    scheduledDate: currentRequest.scheduledDate,
    scheduledTime: currentRequest.scheduledTime,
    amount: rate,
    status: "confirmed",
    paymentStatus: "pending",
    createdAt: new Date()
  });

  window.__bookingId = bookingRef.id;
  window.__workerId = worker.id;

  document.getElementById("serviceAmt").textContent = `₹${rate}`;
  document.getElementById("totalAmt").textContent = `₹${rate}`;

  const lede = document.getElementById("confirmLede");
  if (currentRequest.bookingType === "scheduled") {
    const dateStr = new Date(currentRequest.scheduledDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    lede.textContent = `${worker.name} is scheduled for ${dateStr} at ${currentRequest.scheduledTime}. Payment happens after the job is completed.`;
  } else {
    lede.textContent = `${worker.name} has been assigned for your emergency booking. Payment happens after the job is completed.`;
  }

  matchStep.style.display = "none";
  confirmStep.style.display = "block";
}

// ------------------------------------------------------------
// STEP 3: fake payment
// ------------------------------------------------------------
document.getElementById("payBtn").addEventListener("click", async () => {
  const btn = document.getElementById("payBtn");
  const payStatus = document.getElementById("payStatus");
  btn.disabled = true;
  btn.textContent = "Processing...";

  // UPDATE: mark the booking as paid + completed (fake payment, real Firestore update)
  await updateDoc(doc(db, "bookings", window.__bookingId), {
    paymentStatus: "paid",
    status: "completed"
  });

  payStatus.textContent = "✅ Paid! Check Admin View → Bookings to see this update live.";
  payStatus.style.color = "#2F8F5B";
  btn.textContent = "Paid ✓";

  document.getElementById("ratingSection").style.display = "block";
});

// ------------------------------------------------------------
// Rate the worker (updates the booking + the worker's avgRating)
// ------------------------------------------------------------
document.querySelectorAll(".star-btn").forEach((star) => {
  star.addEventListener("click", async () => {
    const value = Number(star.getAttribute("data-value"));
    const ratingStatus = document.getElementById("ratingStatus");

    document.querySelectorAll(".star-btn").forEach((s) => {
      s.classList.toggle("filled", Number(s.getAttribute("data-value")) <= value);
      s.disabled = true;
    });

    ratingStatus.textContent = "Saving rating...";
    ratingStatus.style.color = "#57655D";

    try {
      // WRITE: attach the rating to this booking
      await updateDoc(doc(db, "bookings", window.__bookingId), { rating: value });

      // WRITE: recompute the worker's running average rating
      const workerRef = doc(db, "workers", window.__workerId);
      const workerSnap = await getDoc(workerRef);
      const w = workerSnap.data();
      const prevCount = w.ratingCount || 0;
      const prevAvg = w.avgRating || 0;
      const newCount = prevCount + 1;
      const newAvg = (prevAvg * prevCount + value) / newCount;

      await updateDoc(workerRef, {
        ratingCount: newCount,
        avgRating: Math.round(newAvg * 10) / 10
      });

      ratingStatus.textContent = "✅ Thanks for rating your worker!";
      ratingStatus.style.color = "#2F8F5B";
    } catch (err) {
      ratingStatus.textContent = "❌ Error: " + err.message;
      ratingStatus.style.color = "#B5473A";
    }
  });
});
