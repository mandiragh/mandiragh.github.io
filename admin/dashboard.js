
import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";

// =====================================================
// 1. SUPABASE CONFIGURATION
// =====================================================

// Replace these with the SAME values from admin.js.

const SUPABASE_URL =
  "https://mbpdourqbwvnbijbcxkj.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_NGNZ4XLP0hqe9Xd-vKGC1g_ZBltPgdg";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

// =====================================================
// 2. PAGE ELEMENTS AND STATE
// =====================================================

const $ = (id) => document.getElementById(id);

const dashboard = $("dashboard");
const authStatus = $("auth-status");
const logoutButton = $("logout-button");

const contactForm = $("contact-form");
const contactMessage = $("contact-message");
const contactsList = $("contacts-list");

let currentUser = null;
let contacts = [];

function showMessage(text) {
  contactMessage.textContent = text;
}

function redirectToLogin() {
  window.location.replace("index.html");
}

// =====================================================
// 3. AUTHENTICATION
// =====================================================

async function initializeDashboard() {
  try {
    const { data, error } =
      await supabase.auth.getUser();

    if (error || !data.user) {
      redirectToLogin();
      return;
    }

    currentUser = data.user;

    // Confirm that this is the authorized owner.
    const { data: isOwner, error: ownerError } =
      await supabase.rpc("is_dashboard_owner");

    if (ownerError) {
      throw ownerError;
    }

    if (isOwner !== true) {
      authStatus.textContent =
        "This account is not authorized to use the dashboard.";
      return;
    }

    $("account-email").textContent =
      currentUser.email || "Signed in";

    dashboard.hidden = false;
    authStatus.hidden = true;

    await loadContacts();
    await loadCareerData();

  } catch (error) {
    authStatus.textContent =
      "Dashboard error: " + error.message;
  }
}

// =====================================================
// 4. LOAD CONTACTS FROM SUPABASE
// =====================================================

async function loadContacts() {
  if (!currentUser) return;

  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", {
      ascending: false
    });

  if (error) {
    showMessage(
      "Unable to load contacts: " + error.message
    );
    return;
  }

  contacts = data || [];

  renderContacts();
  updateDashboardStats();
  renderFollowups();
}

// =====================================================
// 5. DISPLAY CONTACTS
// =====================================================

function renderContacts() {
  const search = $("contact-search")
    .value.trim().toLowerCase();

  const filtered = contacts.filter((contact) => {
    const text = [
      contact.full_name,
      contact.company,
      contact.job_title,
      contact.email
    ].filter(Boolean).join(" ").toLowerCase();

    return text.includes(search);
  });

  contactsList.replaceChildren();

  if (filtered.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 5;
    cell.textContent = "No contacts found.";

    row.appendChild(cell);
    contactsList.appendChild(row);
    return;
  }

  for (const contact of filtered) {
    const row = document.createElement("tr");

    // Name and email
    const nameCell = document.createElement("td");

    const name = document.createElement("strong");
    name.textContent = contact.full_name;

    nameCell.appendChild(name);

    if (contact.email) {
      const email = document.createElement("div");
      email.textContent = contact.email;
      nameCell.appendChild(email);
    }

    // LinkedIn link
    if (contact.linkedin_url) {
      try {
        const url = new URL(contact.linkedin_url);

        const validLinkedIn =
          url.protocol === "https:" &&
          (
            url.hostname === "linkedin.com" ||
            url.hostname.endsWith(".linkedin.com")
          );

        if (validLinkedIn) {
          const link = document.createElement("a");

          link.href = url.href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "LinkedIn Profile";

          nameCell.appendChild(
            document.createElement("br")
          );
          nameCell.appendChild(link);
        }
      } catch {
        // Ignore invalid links.
      }
    }

    // Company and job title
    const companyCell = document.createElement("td");

    companyCell.textContent = [
      contact.company,
      contact.job_title
    ].filter(Boolean).join(" — ") || "—";

    // Relationship status
    const statusCell = document.createElement("td");
    statusCell.textContent =
      contact.relationship_status || "To Contact";

    // Follow-up date
    const followupCell = document.createElement("td");
    followupCell.textContent =
      contact.follow_up_date || "—";

    // Action buttons
    const actionsCell = document.createElement("td");

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "table-action";
    editButton.textContent = "Edit";

    editButton.addEventListener("click", () => {
      editContact(contact.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "table-action";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", () => {
      deleteContact(contact.id);
    });

    actionsCell.append(editButton, deleteButton);

    row.append(
      nameCell,
      companyCell,
      statusCell,
      followupCell,
      actionsCell
    );

    contactsList.appendChild(row);
  }
}

// =====================================================
// 6. CONTACT FORM
// =====================================================

function resetContactForm() {
  contactForm.reset();

  $("contact-id").value = "";
  $("save-contact").textContent = "Save Contact";

  contactForm.hidden = true;
}

$("toggle-contact-form").addEventListener(
  "click",
  () => {
    resetContactForm();
    contactForm.hidden = false;
    $("contact-name").focus();
  }
);

$("cancel-contact").addEventListener(
  "click",
  resetContactForm
);

$("contact-search").addEventListener(
  "input",
  renderContacts
);

// =====================================================
// 7. SAVE OR UPDATE CONTACT
// =====================================================

contactForm.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    if (!currentUser) return;

    const saveButton = $("save-contact");
    const contactId = $("contact-id").value;

    const contactData = {
      full_name: $("contact-name").value.trim(),
      company: $("contact-company").value.trim() || null,
      job_title: $("contact-job-title").value.trim() || null,
      email: $("contact-email").value.trim() || null,
      linkedin_url:
        $("contact-linkedin").value.trim() || null,
      relationship_status: $("contact-status").value,
      follow_up_date:
        $("contact-followup").value || null,
      notes: $("contact-notes").value.trim() || null
    };

    if (!contactData.full_name) {
      showMessage("Full name is required.");
      return;
    }

    saveButton.disabled = true;
    showMessage("Saving contact...");

    try {
      let result;

      if (contactId) {
        // Update an existing contact.
        result = await supabase
          .from("contacts")
          .update(contactData)
          .eq("id", contactId)
          .eq("user_id", currentUser.id)
          .select("id")
          .single();

      } else {
        // Create a new contact.
        result = await supabase
          .from("contacts")
          .insert({
            ...contactData,
            user_id: currentUser.id
          })
          .select("id")
          .single();
      }

      if (result.error) {
        throw result.error;
      }

      resetContactForm();

      await loadContacts();

      showMessage(
        contactId
          ? "Contact updated successfully!"
          : "Contact added successfully!"
      );

    } catch (error) {
      showMessage(
        "Unable to save contact: " + error.message
      );

    } finally {
      saveButton.disabled = false;
    }
  }
);

// =====================================================
// 8. EDIT CONTACT
// =====================================================

function editContact(id) {
  const contact = contacts.find(
    (item) => item.id === id
  );

  if (!contact) return;

  $("contact-id").value = contact.id;
  $("contact-name").value = contact.full_name || "";
  $("contact-company").value = contact.company || "";
  $("contact-job-title").value = contact.job_title || "";
  $("contact-email").value = contact.email || "";
  $("contact-linkedin").value =
    contact.linkedin_url || "";
  $("contact-status").value =
    contact.relationship_status || "To Contact";
  $("contact-followup").value =
    contact.follow_up_date || "";
  $("contact-notes").value = contact.notes || "";

  $("save-contact").textContent = "Update Contact";

  contactForm.hidden = false;

  contactForm.scrollIntoView({
    behavior: "smooth"
  });
}

// =====================================================
// 9. DELETE CONTACT
// =====================================================

async function deleteContact(id) {
  const confirmed = window.confirm(
    "Are you sure you want to delete this contact?"
  );

  if (!confirmed || !currentUser) return;

  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) {
    showMessage(
      "Unable to delete contact: " + error.message
    );
    return;
  }

  showMessage("Contact deleted successfully.");

  await loadContacts();
}

// =====================================================
// 10. DASHBOARD STATISTICS
// =====================================================

function updateDashboardStats() {
  $("stat-contacts").textContent = contacts.length;

  const statuses = {
    "To Contact": "pipeline-to-contact",
    "Contacted": "pipeline-contacted",
    "Replied": "pipeline-replied",
    "Connected": "pipeline-connected"
  };

  for (const [status, elementId] of
    Object.entries(statuses)) {

    const count = contacts.filter(
      (contact) =>
        contact.relationship_status === status
    ).length;

    $(elementId).textContent = count;
  }

  // Count follow-ups due today or earlier.
  const today = getLocalDate();

  const due = contacts.filter((contact) =>
    contact.follow_up_date &&
    contact.follow_up_date <= today
  );

  $("stat-followups").textContent = due.length;
}

// =====================================================
// 11. UPCOMING FOLLOW-UPS
// =====================================================

function getLocalDate() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    now.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function renderFollowups() {
  const container = $("followups-list");

  container.replaceChildren();

  const upcoming = contacts
    .filter((contact) => contact.follow_up_date)
    .sort((a, b) =>
      a.follow_up_date.localeCompare(b.follow_up_date)
    )
    .slice(0, 5);

  if (!upcoming.length) {
    container.textContent =
      "No follow-ups scheduled.";
    return;
  }

  for (const contact of upcoming) {
    const item = document.createElement("div");

    item.className = "feature";

    const name = document.createElement("strong");
    name.textContent = contact.full_name;

    const date = document.createElement("small");
    date.textContent =
      "Follow-up: " + contact.follow_up_date;

    item.append(name, date);
    container.appendChild(item);
  }
}

// =====================================================
// 12. LOGOUT
// =====================================================

logoutButton.addEventListener(
  "click",
  async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "Signing out...";

    const { error } = await supabase.auth.signOut();

    if (error) {
      logoutButton.disabled = false;
      logoutButton.textContent = "Sign Out";

      alert(
        "Sign out failed: " + error.message
      );

      return;
    }

    redirectToLogin();
  }
);

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    redirectToLogin();
  }
});

// =====================================================
// 13. START DASHBOARD
// =====================================================

initializeDashboard();


// =====================================================
// CAREER TRACKERS: APPLICATIONS AND INTERVIEWS
// =====================================================

let applications = [];
let interviews = [];

const applicationForm = $("application-form");
const interviewForm = $("interview-form");

function careerMessage(id, text) {
  $(id).textContent = text;
}

function makeCell(value) {
  const td = document.createElement("td");
  td.textContent = value || "—";
  return td;
}

function makeAction(label, callback) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "table-action";
  button.textContent = label;
  button.addEventListener("click", callback);
  return button;
}

function localDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function applicationLabel(id) {
  const a = applications.find(item => item.id === id);
  return a ? `${a.company} — ${a.position}` : "Unknown application";
}

function populateApplicationChoices() {
  const select = $("interview-application");
  const previous = select.value;
  select.replaceChildren();

  for (const a of applications) {
    const option = document.createElement("option");
    option.value = a.id;
    option.textContent = `${a.company} — ${a.position}`;
    select.appendChild(option);
  }

  if (applications.some(a => a.id === previous)) {
    select.value = previous;
  }
}

async function loadCareerData() {
  if (!currentUser) return;

  const [appResult, interviewResult] = await Promise.all([
    supabase.from("job_applications")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false }),

    supabase.from("interviews")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("scheduled_at", { ascending: true })
  ]);

  if (appResult.error) {
    careerMessage("application-message", appResult.error.message);
  } else {
    applications = appResult.data || [];
    renderApplications();
  }

  if (interviewResult.error) {
    careerMessage("interview-message", interviewResult.error.message);
  } else {
    interviews = interviewResult.data || [];
    renderInterviews();
  }

  $("stat-applications").textContent = applications.length;
  $("stat-interviews").textContent =
    interviews.filter(i => i.outcome === "Scheduled").length;

  populateApplicationChoices();
}

// --------------------- APPLICATIONS ---------------------

function resetApplicationForm() {
  applicationForm.reset();
  $("application-id").value = "";
  applicationForm.hidden = true;
}

$("new-application").addEventListener("click", () => {
  resetApplicationForm();
  applicationForm.hidden = false;
  $("application-company").focus();
});

$("cancel-application").addEventListener(
  "click", resetApplicationForm
);

applicationForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentUser) return;

  const id = $("application-id").value;

  const record = {
    company: $("application-company").value.trim(),
    position: $("application-position").value.trim(),
    location: $("application-location").value.trim() || null,
    job_url: $("application-url").value.trim() || null,
    salary: $("application-salary").value.trim() || null,
    status: $("application-status").value,
    application_date: $("application-date").value || null,
    notes: $("application-notes").value.trim() || null
  };

  if (!record.company || !record.position) return;

  const button = applicationForm.querySelector('[type="submit"]');
  button.disabled = true;

  const query = id
    ? supabase.from("job_applications")
        .update(record)
        .eq("id", id)
        .eq("user_id", currentUser.id)
    : supabase.from("job_applications")
        .insert({ ...record, user_id: currentUser.id });

  const { error } = await query.select("id");

  button.disabled = false;

  if (error) {
    careerMessage("application-message", error.message);
    return;
  }

  resetApplicationForm();
  await loadCareerData();
  careerMessage("application-message", "Application saved!");
});

function editApplication(id) {
  const a = applications.find(item => item.id === id);
  if (!a) return;

  $("application-id").value = a.id;
  $("application-company").value = a.company;
  $("application-position").value = a.position;
  $("application-location").value = a.location || "";
  $("application-url").value = a.job_url || "";
  $("application-salary").value = a.salary || "";
  $("application-status").value = a.status;
  $("application-date").value = a.application_date || "";
  $("application-notes").value = a.notes || "";

  applicationForm.hidden = false;
  applicationForm.scrollIntoView({ behavior: "smooth" });
}

async function deleteApplication(id) {
  if (!confirm(
    "Delete this application and all its linked interviews?"
  )) return;

  const { error } = await supabase
    .from("job_applications")
    .delete()
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) {
    careerMessage("application-message", error.message);
    return;
  }

  await loadCareerData();
  careerMessage("application-message", "Application deleted.");
}

function renderApplications() {
  const tbody = $("applications-list");
  tbody.replaceChildren();

  if (!applications.length) {
    const row = document.createElement("tr");
    const cell = makeCell("No applications added yet.");
    cell.colSpan = 4;
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  for (const a of applications) {
    const row = document.createElement("tr");

    const info = document.createElement("td");
    const title = document.createElement("strong");
    title.textContent = a.company;
    info.appendChild(title);
    info.appendChild(document.createElement("br"));
    info.appendChild(document.createTextNode(a.position));

    if (a.job_url) {
      try {
        const url = new URL(a.job_url);
        if (url.protocol === "https:" || url.protocol === "http:") {
          const link = document.createElement("a");
          link.href = url.href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "View job";
          info.appendChild(document.createElement("br"));
          info.appendChild(link);
        }
      } catch {}
    }

    const actions = document.createElement("td");
    actions.append(
      makeAction("Edit", () => editApplication(a.id)),
      makeAction("Delete", () => deleteApplication(a.id))
    );

    row.append(
      info,
      makeCell(a.status),
      makeCell(a.application_date),
      actions
    );

    tbody.appendChild(row);
  }
}

// --------------------- INTERVIEWS ---------------------

function resetInterviewForm() {
  interviewForm.reset();
  $("interview-id").value = "";
  interviewForm.hidden = true;
}

$("new-interview").addEventListener("click", () => {
  if (!applications.length) {
    careerMessage(
      "interview-message",
      "Add a job application before scheduling an interview."
    );
    return;
  }

  resetInterviewForm();
  populateApplicationChoices();
  interviewForm.hidden = false;
});

$("cancel-interview").addEventListener(
  "click", resetInterviewForm
);

interviewForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentUser) return;

  const id = $("interview-id").value;
  const dateValue = $("interview-date").value;

  if (!dateValue) return;

  const record = {
    application_id: $("interview-application").value,
    interview_round: $("interview-round").value,
    scheduled_at: new Date(dateValue).toISOString(),
    interview_format: $("interview-format").value,
    interviewer: $("interview-interviewer").value.trim() || null,
    preparation_notes: $("interview-notes").value.trim() || null,
    outcome: $("interview-outcome").value
  };

  const button = interviewForm.querySelector('[type="submit"]');
  button.disabled = true;

  const query = id
    ? supabase.from("interviews")
        .update(record)
        .eq("id", id)
        .eq("user_id", currentUser.id)
    : supabase.from("interviews")
        .insert({ ...record, user_id: currentUser.id });

  const { error } = await query.select("id");
  button.disabled = false;

  if (error) {
    careerMessage("interview-message", error.message);
    return;
  }

  resetInterviewForm();
  await loadCareerData();
  careerMessage("interview-message", "Interview saved!");
});

function editInterview(id) {
  const i = interviews.find(item => item.id === id);
  if (!i) return;

  populateApplicationChoices();

  $("interview-id").value = i.id;
  $("interview-application").value = i.application_id;
  $("interview-round").value = i.interview_round;
  $("interview-date").value = localDateTime(i.scheduled_at);
  $("interview-format").value = i.interview_format;
  $("interview-interviewer").value = i.interviewer || "";
  $("interview-outcome").value = i.outcome;
  $("interview-notes").value = i.preparation_notes || "";

  interviewForm.hidden = false;
  interviewForm.scrollIntoView({ behavior: "smooth" });
}

async function deleteInterview(id) {
  if (!confirm("Delete this interview?")) return;

  const { error } = await supabase
    .from("interviews")
    .delete()
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) {
    careerMessage("interview-message", error.message);
    return;
  }

  await loadCareerData();
  careerMessage("interview-message", "Interview deleted.");
}

function renderInterviews() {
  const tbody = $("interviews-list");
  tbody.replaceChildren();

  if (!interviews.length) {
    const row = document.createElement("tr");
    const cell = makeCell("No interviews scheduled yet.");
    cell.colSpan = 4;
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  for (const i of interviews) {
    const row = document.createElement("tr");
    const actions = document.createElement("td");

    actions.append(
      makeAction("Edit", () => editInterview(i.id)),
      makeAction("Delete", () => deleteInterview(i.id))
    );

    row.append(
      makeCell(`${applicationLabel(i.application_id)} — ${i.interview_round}`),
      makeCell(new Date(i.scheduled_at).toLocaleString()),
      makeCell(i.outcome),
      actions
    );

    tbody.appendChild(row);
  }
}
