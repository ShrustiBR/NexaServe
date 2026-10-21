import { db } from "./firebase-config.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

const lookupStep = document.getElementById("lookupStep");
const jobsStep = document.getElementById("jobsStep");
const lookupForm = document.getElementById("lookupForm");
const lookupBtn = document.getElementById("lookupBtn");
const lookupStatus = document.getElementById("lookupStatus");
const profileCard = document.getElementById("profileCard");
const myBookingListEl = document.getElementById("myBookingList");
const refreshJobsBtn = document.getElementById("refreshJobsBtn");
const switchWorkerBtn = document.getElementById("switchWorkerBtn");

let currentWorker = null; // { id, name, skills, area, status, avgRating, ratingCount, ... }

function statusBadge(status) {
  if (status === "verified") return `<span class="badge verified">✓ Verified</span>`;
  if (status === "rejected") return `<span class="badge rejected">✗ Rejected</span>`;
  return `<span class="badge pending">⏳ Pending review</span>`;
}

function renderProfile(w) {
  const ratingText = w.ratingCount > 0
    ? `<span class="rating-pill">★ ${w.avgRating} (${w.ratingCount} rating${w.ratingCount === 1 ? "" : "s"})</span>`
    : `<span class="rating-pill">No ratings yet</span>`;

  profileCard.innerHTML = `
    <div class="worker-info">
      <b>${w.name}</b>
      <div class="worker-meta">${w.skills?.join(", ") || ""} · ${w.area || ""}</div>
      <div class="worker-meta" style="margin-top:6px;">${ratingText}</div>
    </div>
    <div>${statusBadge(w.status)}</div>
  `;
}

function formatSchedule(b) {
  if (b.bookingType === "scheduled" && b.scheduledDate) {
    const dateStr = new Date(b.scheduledDate + "T00:00:00").toLocaleDateString("en-IN", {
      day: "numeric", month: "short"
    });
    return `<span class="schedule-tag">📅 Scheduled — ${dateStr}${b.scheduledTime ? " at " + b.scheduledTime : ""}</span>`;
  }
  return `<span class="urgent-tag">⚡ Emergency — now</span>`;
}

async function loadMyBookings(workerId) {
  myBookingListEl.innerHTML = "<p class='hint'>Loading your bookings...</p>";

  const q = query(collection(db, "bookings"), where("workerId", "==", workerId));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    myBookingListEl.innerHTML = "<p class='hint'>No bookings assigned to you yet. They'll show up here as customers book you.</p>";
    return;
  }

  const bookings = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  bookings.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

  myBookingListEl.innerHTML = "";
  bookings.forEach((b) => {
    const item = document.createElement("div");
    const statusClass = b.status === "completed" ? "verified" : "pending";
    const statusLabel = b.status === "completed" ? "✓ Completed" : "⏳ " + (b.status || "confirmed");
    item.className = "worker-item";

    item.innerHTML = `
      <div class="worker-info">
        <b>${b.customerName}</b> — ${b.service}
        <div class="worker-meta">
          ${b.area} · ₹${b.amount}
          <br>${formatSchedule(b)}
          <br>Payment: ${b.paymentStatus === "paid" ? "✓ Paid" : "Pending"}
          ${b.rating ? `<br><span class="rating-pill">★ Rated ${b.rating}/5</span>` : ""}
        </div>
      </div>
      <span class="badge ${statusClass}">${statusLabel}</span>
    `;
    myBookingListEl.appendChild(item);
  });
}

lookupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const phone = document.getElementById("lookupPhone").value.trim();

  lookupBtn.disabled = true;
  lookupStatus.textContent = "Looking you up...";
  lookupStatus.style.color = "#57655D";

  try {
    const q = query(collection(db, "workers"), where("phone", "==", phone));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      lookupStatus.textContent = "❌ No worker found with that phone number. Check the number, or register first.";
      lookupStatus.style.color = "#B5473A";
      lookupBtn.disabled = false;
      return;
    }

    const workerDoc = snapshot.docs[0];
    currentWorker = { id: workerDoc.id, ...workerDoc.data() };

    renderProfile(currentWorker);
    await loadMyBookings(currentWorker.id);

    lookupStep.style.display = "none";
    jobsStep.style.display = "block";

  } catch (err) {
    lookupStatus.textContent = "❌ Error: " + err.message;
    lookupStatus.style.color = "#B5473A";
  } finally {
    lookupBtn.disabled = false;
  }
});

refreshJobsBtn.addEventListener("click", async () => {
  if (!currentWorker) return;
  await loadMyBookings(currentWorker.id);
});

switchWorkerBtn.addEventListener("click", () => {
  currentWorker = null;
  jobsStep.style.display = "none";
  lookupStep.style.display = "block";
  lookupStatus.textContent = "";
  document.getElementById("lookupPhone").value = "";
});
