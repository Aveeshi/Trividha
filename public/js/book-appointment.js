/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — book appointment page
 * Three steps, driven entirely by the /patient/doctors and /patient/appointments
 * JSON API (see controller/appointmentController.js):
 *   1. Browse/search doctors
 *   2. Pick a hospital-wise open slot for the chosen doctor
 *   3. Confirmation with the booked token
 *
 * If the patient arrived here from the AI voice pre-consult ("Done" button
 * on /booking), window.__AI_SESSION_ID__ carries that intake session id so
 * the booking call can link the reason-for-visit/transcript to it.
 * ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const aiSessionId = window.__AI_SESSION_ID__ || null;
  let allDoctors = [];
  let selectedDoctor = null;

  const ui = {
    steps: {
      list: document.getElementById("step-doctor-list"),
      profile: document.getElementById("step-doctor-profile"),
      confirm: document.getElementById("step-confirmation"),
    },
    search: document.getElementById("doctor-search"),
    cityFilter: document.getElementById("doctor-city-filter"),
    grid: document.getElementById("doctor-grid"),
    listLoading: document.getElementById("doctor-list-loading"),
    listEmpty: document.getElementById("doctor-list-empty"),
    backToListBtn: document.getElementById("back-to-list-btn"),
    profileCard: document.getElementById("doctor-profile-card"),
    slotsLoading: document.getElementById("slots-loading"),
    slotsEmpty: document.getElementById("slots-empty"),
    hospitalGroups: document.getElementById("hospital-slot-groups"),
    confirmToken: document.getElementById("confirm-token"),
    confirmDetails: document.getElementById("confirm-details"),
    errorBox: document.getElementById("booking-error"),
  };

  function showStep(name) {
    Object.entries(ui.steps).forEach(([key, el]) => {
      el.classList.toggle("is-active", key === name);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showError(message) {
    ui.errorBox.textContent = message;
    ui.errorBox.classList.remove("hidden");
  }

  function clearError() {
    ui.errorBox.classList.add("hidden");
  }

  function initials(name) {
    return (name || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase();
  }

  function avatarHtml(doctor, size) {
    if (doctor.profile_photo) {
      return `<img class="doctor-avatar" src="${doctor.profile_photo}" alt="Dr. ${escapeHtml(doctor.name)}" />`;
    }
    return `<div class="doctor-avatar">${escapeHtml(initials(doctor.name))}</div>`;
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  // ---- STEP 1: doctor list ----------------------------------------------

  async function loadDoctors() {
    ui.listLoading.classList.remove("hidden");
    ui.listEmpty.classList.add("hidden");
    ui.grid.innerHTML = "";
    clearError();

    try {
      const res = await fetch("/patient/doctors");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load doctors.");
      allDoctors = data.doctors || [];
      populateCityFilter(allDoctors);
      renderDoctorGrid(allDoctors);
    } catch (err) {
      console.error("loadDoctors:", err);
      showError("Could not load doctors right now. Please try again.");
    } finally {
      ui.listLoading.classList.add("hidden");
    }
  }

  function populateCityFilter(doctors) {
    const cities = new Set();
    doctors.forEach((d) => (d.hospitals || []).forEach((h) => h.city && cities.add(h.city)));
    ui.cityFilter.querySelectorAll("option:not(:first-child)").forEach((o) => o.remove());
    Array.from(cities).sort().forEach((city) => {
      const opt = document.createElement("option");
      opt.value = city;
      opt.textContent = city;
      ui.cityFilter.appendChild(opt);
    });
  }

  function applyFilters() {
    const q = ui.search.value.trim().toLowerCase();
    const city = ui.cityFilter.value;
    const filtered = allDoctors.filter((d) => {
      const matchesQuery =
        !q || d.name.toLowerCase().includes(q) || (d.specialization || "").toLowerCase().includes(q);
      const matchesCity = !city || (d.hospitals || []).some((h) => h.city === city);
      return matchesQuery && matchesCity;
    });
    renderDoctorGrid(filtered);
  }

  function renderDoctorGrid(doctors) {
    ui.grid.innerHTML = "";
    ui.listEmpty.classList.toggle("hidden", doctors.length > 0);

    doctors.forEach((doctor) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "doctor-card";

      const hospitalNames = (doctor.hospitals || []).map((h) => h.hospitalName).join(", ") || "—";
      const rating = Number(doctor.average_rating) || 0;

      card.innerHTML = `
        <div class="doctor-card-top">
          ${avatarHtml(doctor)}
          <div>
            <p class="doctor-name">Dr. ${escapeHtml(doctor.name)}</p>
            <p class="doctor-specialization">${escapeHtml(doctor.specialization || "General Medicine")}</p>
          </div>
        </div>
        <div class="doctor-meta-row">
          <span>${escapeHtml(doctor.qualification || "")}</span>
          <span>${doctor.experience_years != null ? doctor.experience_years + " yrs experience" : ""}</span>
        </div>
        <div class="doctor-meta-row">
          <span class="doctor-rating">★ ${rating > 0 ? rating.toFixed(1) : "New"} (${doctor.review_count || 0})</span>
          <span>${doctor.patients_treated || 0} patients treated</span>
        </div>
        <p class="doctor-hospitals"><strong>Practices at:</strong> ${escapeHtml(hospitalNames)}</p>
      `;
      card.addEventListener("click", () => openDoctorProfile(doctor.doctor_id));
      ui.grid.appendChild(card);
    });
  }

  ui.search.addEventListener("input", applyFilters);
  ui.cityFilter.addEventListener("change", applyFilters);

  // ---- STEP 2: doctor profile + hospital-wise slots ----------------------

  async function openDoctorProfile(doctorId) {
    clearError();
    showStep("profile");
    ui.profileCard.innerHTML = "";
    ui.hospitalGroups.innerHTML = "";
    ui.slotsLoading.classList.remove("hidden");
    ui.slotsEmpty.classList.add("hidden");

    try {
      const [profileRes, slotsRes] = await Promise.all([
        fetch(`/patient/doctors/${doctorId}`),
        fetch(`/patient/doctors/${doctorId}/slots`),
      ]);
      const profileData = await profileRes.json();
      const slotsData = await slotsRes.json();
      if (!profileRes.ok) throw new Error(profileData.error || "Doctor not found.");
      if (!slotsRes.ok) throw new Error(slotsData.error || "Could not load slots.");

      selectedDoctor = profileData.doctor;
      renderDoctorProfile(selectedDoctor);
      renderHospitalSlots(slotsData.hospitals || []);
    } catch (err) {
      console.error("openDoctorProfile:", err);
      showError("Could not load this doctor's details. Please try again.");
    } finally {
      ui.slotsLoading.classList.add("hidden");
    }
  }

  function renderDoctorProfile(doctor) {
    const rating = Number(doctor.average_rating) || 0;
    ui.profileCard.innerHTML = `
      ${avatarHtml(doctor)}
      <div>
        <p class="doctor-name">Dr. ${escapeHtml(doctor.name)}</p>
        <p class="doctor-specialization">${escapeHtml(doctor.specialization || "General Medicine")}</p>
        <p class="doctor-meta-row"><span>${escapeHtml(doctor.qualification || "")}</span></p>
        <div class="doctor-profile-stats">
          <div class="doctor-profile-stat">
            <div class="doctor-profile-stat-value">${doctor.experience_years != null ? doctor.experience_years : "—"}</div>
            <div class="doctor-profile-stat-label">Years experience</div>
          </div>
          <div class="doctor-profile-stat">
            <div class="doctor-profile-stat-value">★ ${rating > 0 ? rating.toFixed(1) : "New"}</div>
            <div class="doctor-profile-stat-label">${doctor.review_count || 0} reviews</div>
          </div>
          <div class="doctor-profile-stat">
            <div class="doctor-profile-stat-value">${doctor.patients_treated || 0}</div>
            <div class="doctor-profile-stat-label">Patients treated</div>
          </div>
        </div>
      </div>
    `;
  }

  function formatSlotDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });
  }

  function formatSlotTime(t) {
    // appointment_slot.start_time / end_time come back as "HH:MM:SS"
    const [h, m] = String(t).split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${m} ${ampm}`;
  }

  function renderHospitalSlots(hospitals) {
    ui.hospitalGroups.innerHTML = "";
    const hasAnySlots = hospitals.some((h) => h.slots && h.slots.length);
    ui.slotsEmpty.classList.toggle("hidden", hasAnySlots);

    hospitals.forEach((hospital) => {
      if (!hospital.slots || !hospital.slots.length) return;

      const group = document.createElement("div");
      group.className = "hospital-group";
      group.innerHTML = `
        <p class="hospital-group-title">${escapeHtml(hospital.hospitalName)}</p>
        <p class="hospital-group-address">${escapeHtml([hospital.address, hospital.city].filter(Boolean).join(", "))}</p>
        <div class="slot-grid"></div>
      `;
      const slotGrid = group.querySelector(".slot-grid");

      hospital.slots.forEach((slot) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "slot-card";
        btn.innerHTML = `
          <div class="slot-card-date">${formatSlotDate(slot.date)}</div>
          <div class="slot-card-time">${formatSlotTime(slot.startTime)} – ${formatSlotTime(slot.endTime)}</div>
          <div class="slot-card-seats">${slot.seatsLeft} seat${slot.seatsLeft === 1 ? "" : "s"} left</div>
        `;
        btn.addEventListener("click", () => bookSlot(slot.slotId, btn));
        slotGrid.appendChild(btn);
      });

      ui.hospitalGroups.appendChild(group);
    });
  }

  ui.backToListBtn.addEventListener("click", () => {
    clearError();
    showStep("list");
  });

  // ---- STEP 3: book + confirm ---------------------------------------------

  async function bookSlot(slotId, btnEl) {
    if (!selectedDoctor) return;
    clearError();
    document.querySelectorAll(".slot-card").forEach((b) => (b.disabled = true));
    const originalHtml = btnEl.innerHTML;
    btnEl.innerHTML = "Booking…";

    try {
      const res = await fetch("/patient/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: selectedDoctor.doctor_id,
          slotId,
          aiSessionId: aiSessionId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not book this slot.");
      renderConfirmation(data);
      showStep("confirm");
    } catch (err) {
      console.error("bookSlot:", err);
      showError(err.message || "Could not book this slot. It may have just filled up — please pick another.");
      document.querySelectorAll(".slot-card").forEach((b) => (b.disabled = false));
      btnEl.innerHTML = originalHtml;
    }
  }

  function renderConfirmation({ appointment, queue }) {
    ui.confirmToken.textContent = appointment.tokenNumber;
    const waitLine =
      queue && queue.estimatedWaitMinutes != null
        ? `<div class="confirm-row"><span>Estimated wait</span><span>${queue.estimatedWaitMinutes} min</span></div>`
        : "";
    ui.confirmDetails.innerHTML = `
      <div class="confirm-row"><span>Doctor</span><span>Dr. ${escapeHtml(selectedDoctor ? selectedDoctor.name : "")}</span></div>
      <div class="confirm-row"><span>Status</span><span>${escapeHtml(appointment.status)}</span></div>
      ${waitLine}
    `;
  }

  loadDoctors();
});
