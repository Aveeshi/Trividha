/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — doctor signup page
 * Multi-qualification tag input + "Other" specialization toggle.
 * ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  initQualificationTags();
  initSpecializationOther();
});

function initQualificationTags() {
  const input = document.getElementById("qualification_input");
  const addBtn = document.getElementById("qualification_add");
  const list = document.getElementById("qualification_tags");
  const hidden = document.getElementById("qualification_hidden");
  if (!input || !addBtn || !list || !hidden) return;

  // Seed from any previously-submitted value (validation error re-render).
  let tags = hidden.value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  function render() {
    list.innerHTML = "";
    tags.forEach((tag, i) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.textContent = tag;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "tag-chip-remove";
      remove.setAttribute("aria-label", `Remove ${tag}`);
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        tags.splice(i, 1);
        render();
      });

      chip.appendChild(remove);
      list.appendChild(chip);
    });
    hidden.value = tags.join(", ");
  }

  function addFromInput() {
    const value = input.value.trim();
    if (!value) return;
    if (!tags.some((t) => t.toLowerCase() === value.toLowerCase())) {
      tags.push(value);
      render();
    }
    input.value = "";
    input.focus();
  }

  addBtn.addEventListener("click", addFromInput);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addFromInput();
    }
  });

  render();
}

function initSpecializationOther() {
  const select = document.getElementById("specialization");
  const other = document.getElementById("specialization_other");
  if (!select || !other) return;

  // Re-render after a validation error: restore whatever was previously chosen/typed.
  const prefill = select.dataset.prefill;
  if (prefill) {
    const matchesOption = Array.from(select.options).some((opt) => opt.value === prefill);
    if (matchesOption) {
      select.value = prefill;
    } else {
      select.value = "Other";
      other.value = prefill;
    }
  }

  function sync() {
    other.style.display = select.value === "Other" ? "block" : "none";
  }
  select.addEventListener("change", sync);
  sync();
}
