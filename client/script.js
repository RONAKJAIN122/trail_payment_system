/* ═══════════════════════════════════════════════════════════════════════════
   SplitPay – script.js
   Vanilla JS SPA logic: view routing, API calls, form handling, UI updates
   ═══════════════════════════════════════════════════════════════════════════ */

const API = '/api';

/* ── State ──────────────────────────────────────────────────────────────────── */
let currentSession   = null; // full session object from server
let currentMemberId  = null; // _id of the logged-in member (member flow)
let refreshInterval  = null; // polling interval for organizer view

/* ════════════════════════════════════════════════════════════════════════════
   UTILITY HELPERS
   ════════════════════════════════════════════════════════════════════════════ */

/** Switch visible view */
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) {
    target.classList.add('active');
    target.style.animation = 'none';
    requestAnimationFrame(() => { target.style.animation = ''; });
  }
}

/** Show/hide loading state on a button */
function setLoading(btn, isLoading) {
  const text   = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = isLoading;
  if (text)   text.classList.toggle('hidden', isLoading);
  if (loader) loader.classList.toggle('hidden', !isLoading);
}

/** Show inline error */
function showError(containerId, msg) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}
function clearError(containerId) {
  const el = document.getElementById(containerId);
  if (el) { el.textContent = ''; el.classList.add('hidden'); }
}

/** Toast notification */
let toastTimer;
function showToast(msg, duration = 2800) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), duration);
}

/** Format currency */
const fmt = (n) => `₹${parseFloat(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

/* ════════════════════════════════════════════════════════════════════════════
   HOME VIEW
   ════════════════════════════════════════════════════════════════════════════ */

document.getElementById('btn-organizer').addEventListener('click', () => showView('view-organizer'));
document.getElementById('btn-member').addEventListener('click', () => showView('view-member'));

// Back buttons
document.querySelectorAll('.back-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    clearInterval(refreshInterval);
    showView(btn.dataset.target || 'view-home');
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   ORGANIZER FLOW
   ════════════════════════════════════════════════════════════════════════════ */

/* ── QR file preview ──────────────────────────────────────────────────────── */
const qrInput       = document.getElementById('qrCode');
const qrDropZone    = document.getElementById('qrDropZone');
const qrPreviewSmall = document.getElementById('qrPreviewSmall');
const dropInner     = qrDropZone.querySelector('.drop-inner');

function handleFilePreview(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    qrPreviewSmall.src = e.target.result;
    qrPreviewSmall.classList.remove('hidden');
    dropInner.classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

qrInput.addEventListener('change', () => handleFilePreview(qrInput.files[0]));

// Drag-and-drop styling
qrDropZone.addEventListener('dragover', (e) => { e.preventDefault(); qrDropZone.classList.add('drag-over'); });
qrDropZone.addEventListener('dragleave', () => qrDropZone.classList.remove('drag-over'));
qrDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  qrDropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    const dt = new DataTransfer();
    dt.items.add(file);
    qrInput.files = dt.files;
    handleFilePreview(file);
  }
});

/* ── Create-Session form submit ───────────────────────────────────────────── */
document.getElementById('form-create-session').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError('create-error');

  const totalAmount = document.getElementById('totalAmount').value.trim();
  const numMembers  = document.getElementById('numMembers').value.trim();
  const file        = qrInput.files[0];

  if (!totalAmount || !numMembers) return showError('create-error', 'Please fill in all fields.');
  if (!file) return showError('create-error', 'Please upload a UPI QR code image.');
  if (parseFloat(totalAmount) <= 0) return showError('create-error', 'Amount must be greater than 0.');
  if (parseInt(numMembers) < 1)     return showError('create-error', 'At least 1 member is required.');

  const submitBtn = document.getElementById('btn-create-submit');
  setLoading(submitBtn, true);

  try {
    const fd = new FormData();
    fd.append('totalAmount', totalAmount);
    fd.append('numMembers', numMembers);
    fd.append('qrCode', file);

    const res  = await fetch(`${API}/create-session`, { method: 'POST', body: fd });
    const data = await res.json();

    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to create session.');

    currentSession = data.data;
    renderOrganizerResult(currentSession);

    document.getElementById('organizer-result').classList.remove('hidden');
    document.getElementById('organizer-result').scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Auto-refresh every 10 s
    clearInterval(refreshInterval);
    refreshInterval = setInterval(() => refreshOrganizerSession(), 10000);

  } catch (err) {
    showError('create-error', err.message);
  } finally {
    setLoading(submitBtn, false);
  }
});

/* ── Render organizer result panel ───────────────────────────────────────── */
function renderOrganizerResult(session) {
  document.getElementById('display-session-id').textContent = session.sessionId;
  document.getElementById('qrImagePreview').src = `/uploads/${session.qrCode}`;

  const collected = session.members.filter(m => m.status === 'Paid').reduce((s, m) => s + m.amount, 0);
  const remaining = session.totalAmount - collected;

  document.getElementById('stat-total').textContent     = fmt(session.totalAmount);
  document.getElementById('stat-per').textContent       = fmt(session.amountPerMember);
  document.getElementById('stat-collected').textContent = fmt(collected);
  document.getElementById('stat-remaining').textContent = fmt(remaining);

  renderMembersList(session.members);
}

/* ── Render members list ──────────────────────────────────────────────────── */
function renderMembersList(members) {
  const list = document.getElementById('members-list');
  if (!members || members.length === 0) {
    list.innerHTML = '<p class="empty-state">No members have joined yet.</p>';
    return;
  }
  list.innerHTML = members.map(m => `
    <div class="member-item">
      <div class="member-info">
        <span class="member-name">${escapeHtml(m.name)}</span>
        ${m.transactionId ? `<span class="member-txn">TXN: ${escapeHtml(m.transactionId)}</span>` : ''}
      </div>
      <div class="member-right">
        <span class="member-amount">${fmt(m.amount)}</span>
        <span class="status-badge ${m.status === 'Paid' ? 'status-paid' : 'status-pending'}">${m.status}</span>
      </div>
    </div>
  `).join('');
}

/* ── Refresh session from server ─────────────────────────────────────────── */
async function refreshOrganizerSession() {
  if (!currentSession) return;
  try {
    const res  = await fetch(`${API}/session/${currentSession.sessionId}`);
    const data = await res.json();
    if (data.success) { currentSession = data.data; renderOrganizerResult(data.data); }
  } catch (_) { /* silent */ }
}

document.getElementById('btn-refresh').addEventListener('click', async () => {
  await refreshOrganizerSession();
  showToast('✅ Status refreshed');
});

/* ── Copy session ID ─────────────────────────────────────────────────────── */
document.getElementById('btn-copy-id').addEventListener('click', () => {
  const id = document.getElementById('display-session-id').textContent;
  navigator.clipboard.writeText(id)
    .then(() => showToast('📋 Session ID copied!'))
    .catch(() => showToast('Could not copy — select and copy manually'));
});

/* ════════════════════════════════════════════════════════════════════════════
   MEMBER FLOW
   ════════════════════════════════════════════════════════════════════════════ */

/* ── Join-Session form submit ─────────────────────────────────────────────── */
document.getElementById('form-join-session').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError('join-error');

  const name      = document.getElementById('memberName').value.trim();
  const sessionId = document.getElementById('joinSessionId').value.trim().toUpperCase();

  if (!name)      return showError('join-error', 'Please enter your name.');
  if (!sessionId) return showError('join-error', 'Please enter the Session ID.');

  const submitBtn = document.getElementById('btn-join-submit');
  setLoading(submitBtn, true);

  try {
    const res  = await fetch(`${API}/join-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sessionId }),
    });
    const data = await res.json();

    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to join session.');

    currentSession  = data.data.session;
    currentMemberId = data.data.memberId;

    renderMemberResult(currentSession, currentMemberId);
    document.getElementById('member-result').classList.remove('hidden');
    document.getElementById('member-result').scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    showError('join-error', err.message);
  } finally {
    setLoading(submitBtn, false);
  }
});

/* ── Render member payment panel ─────────────────────────────────────────── */
function renderMemberResult(session, memberId) {
  const member = session.members.find(m => m._id === memberId || m._id?.toString() === memberId?.toString());

  document.getElementById('member-amount').textContent = fmt(session.amountPerMember);
  document.getElementById('member-qr-image').src = `/uploads/${session.qrCode}`;

  if (member && member.status === 'Paid') {
    // Already paid
    document.getElementById('payment-form-wrap').classList.add('hidden');
    const banner = document.getElementById('payment-success-banner');
    banner.classList.remove('hidden');
    document.getElementById('success-txn-id').textContent = `Transaction ID: ${member.transactionId}`;
  } else {
    document.getElementById('payment-form-wrap').classList.remove('hidden');
    document.getElementById('payment-success-banner').classList.add('hidden');
  }
}

/* ── Payment confirmation form ───────────────────────────────────────────── */
document.getElementById('form-payment').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError('payment-error');

  const transactionId = document.getElementById('transactionId').value.trim();
  if (!transactionId) return showError('payment-error', 'Please enter your UPI Transaction / UTR ID.');

  const submitBtn = document.getElementById('btn-pay-submit');
  setLoading(submitBtn, true);

  try {
    const res  = await fetch(`${API}/update-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId:     currentSession.sessionId,
        memberId:      currentMemberId,
        transactionId,
      }),
    });
    const data = await res.json();

    if (!res.ok || !data.success) throw new Error(data.message || 'Payment update failed.');

    currentSession = data.data;

    // Show success banner, hide form
    document.getElementById('payment-form-wrap').classList.add('hidden');
    const banner = document.getElementById('payment-success-banner');
    banner.classList.remove('hidden');
    document.getElementById('success-txn-id').textContent = `Transaction ID: ${transactionId}`;

    showToast('🎉 Payment recorded successfully!');

  } catch (err) {
    showError('payment-error', err.message);
  } finally {
    setLoading(submitBtn, false);
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   XSS GUARD
   ════════════════════════════════════════════════════════════════════════════ */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}
