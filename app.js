import { db } from "./firebase-config.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

const form = document.getElementById("signupForm");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submitBtn");

// Converts a File object into a Base64 text string we can store directly in Firestore
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // result looks like "data:image/jpeg;base64,...."
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault(); // stop the page from reloading

  const name = document.getElementById("name").value;
  const phone = document.getElementById("phone").value;
  const skill = document.getElementById("skill").value;
  const area = document.getElementById("area").value;
  const file = document.getElementById("idFile").files[0];

  submitBtn.disabled = true;
  statusEl.textContent = "Registering...";
  statusEl.style.color = "#57655D";

  try {
    let certUrl = "";

    // 1. If a file was chosen, convert it to Base64 (no Storage/billing needed)
    if (file) {
      if (file.size > 900 * 1024) { // keep well under Firestore's 1MB per-document limit
        statusEl.textContent = "❌ File too large — please use an image under 800KB.";
        statusEl.style.color = "#B5473A";
        submitBtn.disabled = false;
        return;
      }
      statusEl.textContent = "Processing ID document...";
      certUrl = await fileToBase64(file); // this string gets saved straight into Firestore
    }

    // 2. Write the worker's info to the "workers" collection in Firestore
    statusEl.textContent = "Saving profile...";
    await addDoc(collection(db, "workers"), {
      name,
      phone,
      skills: [skill],
      area,
      certUrl,
      status: "pending",     // admin flips this to "verified" or "rejected" later
      available: true,
      avgRating: 0,
      ratingCount: 0,
      createdAt: new Date()
    });

    // 3. Success — reset the form
    statusEl.textContent = "✅ Registered! Check the Admin View to see and verify this worker.";
    statusEl.style.color = "#2F8F5B";
    form.reset();

  } catch (err) {
    statusEl.textContent = "❌ Error: " + err.message;
    statusEl.style.color = "#B5473A";
    console.error(err);
  } finally {
    submitBtn.disabled = false;
  }
});
