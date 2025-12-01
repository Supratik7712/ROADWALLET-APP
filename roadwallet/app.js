// app.js — full updated file (with FROM / TO date filters)
// Paste your Firebase config into the firebaseConfig object below.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged,
  GoogleAuthProvider, signInWithPopup, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, query, orderBy, getDocs, serverTimestamp,
  deleteDoc, doc, updateDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js";

/* ======= PASTE YOUR FIREBASE CONFIG HERE ======= */
const firebaseConfig = {
  apiKey: "AIzaSyAa33XnRLPXL6J-sjgm16Ka3FwF-abfe-8",
  authDomain: "roadwallet-app-4d3c5.firebaseapp.com",
  projectId: "roadwallet-app-4d3c5",
  storageBucket: "roadwallet-app-4d3c5.firebasestorage.app",
  messagingSenderId: "146462055576",
  appId: "1:146462055576:web:a490ea53720cb9630604ed",
  measurementId: "G-EPFKLXBLFB"
};
/* ============================================== */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

/* ---------- DOM refs ---------- */
const userNameEl = document.getElementById('userName');
const userEmailEl = document.getElementById('userEmail');
const userAvatarImg = document.getElementById('userAvatar');
const userInitialsEl = document.getElementById('userInitials');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const displayNameInput = document.getElementById('displayNameInput');
const saveNameBtn = document.getElementById('saveNameBtn');

const tripSelect = document.getElementById('tripSelect');
const createTripBtn = document.getElementById('createTripBtn');
const newTripName = document.getElementById('newTripName');

const expenseForm = document.getElementById('expenseForm');
const expensesList = document.getElementById('expenses');
const totalEl = document.getElementById('total');
const tripLabel = document.getElementById('tripLabel');

const fromDate = document.getElementById('fromDate');
const toDate = document.getElementById('toDate');
const applyFilters = document.getElementById('applyFilters');
const clearFilters = document.getElementById('clearFilters');

const exportCSV = document.getElementById('exportCSV');
const formMsg = document.getElementById('formMsg');
const editingIdEl = document.getElementById('editingId');
const cancelEditBtn = document.getElementById('cancelEditBtn');

let currentUser = null;

/* ---------- Authentication ---------- */
// Try anonymous sign-in for quick use; user can sign in with Google for persistent account
signInAnonymously(auth).catch(err => {
  console.warn('Anonymous sign-in failed', err);
  userNameEl.textContent = 'Auth error';
});

// Listen for auth changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    renderUser(user);
    loadTrips();
  } else {
    currentUser = null;
    userNameEl.textContent = 'Not signed in';
  }
});

// Google sign-in button
googleSignInBtn.addEventListener('click', async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error('Google sign-in failed', err);
    alert('Google sign-in failed: ' + (err.message || err.code));
  }
});

// Sign out (and return to anonymous)
signOutBtn.addEventListener('click', async () => {
  try {
    await signOut(auth);
    await signInAnonymously(auth);
  } catch (err) {
    console.error('Sign out error', err);
  }
});

/* Render user info (avatar / initials / name) */
function renderUser(user) {
  const name = user.displayName || 'Guest';
  const email = user.email || '';
  const photo = user.photoURL || null;

  userNameEl.textContent = name;
  userEmailEl.textContent = email;

  if (photo) {
    userAvatarImg.src = photo;
    userAvatarImg.style.display = 'block';
    userInitialsEl.style.display = 'none';
  } else {
    const initials = (name.split(' ').map(s => s[0]).join('').slice(0,2) || 'G').toUpperCase();
    userInitialsEl.textContent = initials;
    userInitialsEl.style.display = 'flex';
    userAvatarImg.style.display = 'none';
  }

  displayNameInput.value = name === 'Guest' ? '' : name;
  googleSignInBtn.style.display = user.isAnonymous ? 'inline-block' : 'none';
  signOutBtn.style.display = user.isAnonymous ? 'none' : 'inline-block';
}

/* ---------- Save display name ---------- */
saveNameBtn.addEventListener('click', async () => {
  if (!currentUser) return alert('Signing in...');
  const newName = (displayNameInput.value || '').trim();
  if (!newName) return alert('Enter a name');
  try {
    await updateProfile(auth.currentUser, { displayName: newName });
    const profileRef = doc(db, 'users', currentUser.uid, 'profile', 'meta');
    await setDoc(profileRef, { displayName: newName, updatedAt: serverTimestamp() }, { merge: true });
    renderUser(auth.currentUser);
    alert('Name saved');
  } catch (err) {
    console.error('Save name failed', err);
    alert('Could not save name');
  }
});

/* ---------- Trips (create / load / select) ---------- */
createTripBtn.addEventListener('click', async () => {
  const name = (newTripName.value || '').trim();
  if (!name) return alert('Enter trip name');
  if (!currentUser) return alert('Signing in...');
  try {
    const metaRef = collection(db, 'users', currentUser.uid, 'tripsMeta');
    const docRef = await addDoc(metaRef, { name, createdAt: serverTimestamp() });
    newTripName.value = '';
    await loadTrips();
    selectTrip(docRef.id);
  } catch (err) {
    console.error('Create trip failed', err);
    alert('Could not create trip');
  }
});

async function loadTrips() {
  tripSelect.innerHTML = '<option>Loading...</option>';
  if (!currentUser) return;
  try {
    const metaRef = collection(db, 'users', currentUser.uid, 'tripsMeta');
    const q = query(metaRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    tripSelect.innerHTML = '';
    let firstId = null;
    snap.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.data().name || 'Trip';
      tripSelect.appendChild(opt);
      if (!firstId) firstId = d.id;
    });
    if (!firstId) {
      const defaultRef = await addDoc(metaRef, { name: 'Default Trip', createdAt: serverTimestamp() });
      tripSelect.innerHTML = `<option value="${defaultRef.id}">Default Trip</option>`;
      firstId = defaultRef.id;
    }
    tripSelect.value = firstId;
    updateTripLabel();
    loadExpenses();
  } catch (err) {
    console.error('Load trips failed', err);
    tripSelect.innerHTML = '<option>Error</option>';
  }
}
tripSelect.addEventListener('change', () => { updateTripLabel(); loadExpenses(); });
function updateTripLabel() {
  const sel = tripSelect.options[tripSelect.selectedIndex];
  tripLabel.textContent = sel ? `Current: ${sel.textContent}` : '';
}
function selectTrip(id) { tripSelect.value = id; updateTripLabel(); loadExpenses(); }

/* ---------- Expense add / edit ---------- */
expenseForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return alert('Signing in...');
  const editingId = editingIdEl.value || null;
  const note = document.getElementById('note').value.trim();
  const amount = parseFloat(document.getElementById('amount').value);
  const currency = document.getElementById('currency').value;
  const category = document.getElementById('category').value;
  const dateVal = document.getElementById('date').value;
  const date = dateVal ? new Date(dateVal).toISOString() : new Date().toISOString();
  const receiptFile = document.getElementById('receiptFile').files[0] || null;
  if (isNaN(amount)) return alert('Enter a valid amount');

  const tripId = tripSelect.value;
  const path = ['users', currentUser.uid, 'trips', tripId, 'expenses'];

  try {
    formMsg.textContent = 'Saving...';
    let receiptUrl = null;
    if (receiptFile) {
      const filename = `${Date.now()}-${receiptFile.name.replace(/[^a-z0-9.\-]/gi,'')}`;
      const sRef = storageRef(storage, `receipts/${currentUser.uid}/${filename}`);
      const uploadRes = await uploadBytes(sRef, receiptFile);
      receiptUrl = await getDownloadURL(uploadRes.ref);
    }

    const payload = { note, amount, currency, category, date, receiptUrl, updatedAt: serverTimestamp() };

    if (editingId) {
      await updateDoc(doc(db, ...path, editingId), payload);
      formMsg.textContent = 'Updated';
    } else {
      await addDoc(collection(db, ...path), { ...payload, createdAt: serverTimestamp() });
      formMsg.textContent = 'Saved';
    }

    expenseForm.reset();
    editingIdEl.value = '';
    cancelEditBtn.style.display = 'none';
    loadExpenses();
    setTimeout(()=> formMsg.textContent = '', 1400);
  } catch (err) {
    console.error('Save expense error', err);
    formMsg.textContent = 'Error saving';
  }
});

cancelEditBtn.addEventListener('click', () => { expenseForm.reset(); editingIdEl.value = ''; cancelEditBtn.style.display = 'none'; });

/* ---------- Load & render expenses (with FROM/TO filters) ---------- */
async function loadExpenses() {
  expensesList.innerHTML = '<li class="muted">Loading...</li>';
  if (!currentUser) return;
  const tripId = tripSelect.value;
  const path = ['users', currentUser.uid, 'trips', tripId, 'expenses'];
  try {
    const ref = collection(db, ...path);
    const q = query(ref, orderBy('date', 'desc'));
    const snap = await getDocs(q);
    let total = 0;
    expensesList.innerHTML = '';
    const rowsForExport = [];

    // prepare filters
    const filterFrom = fromDate && fromDate.value ? new Date(fromDate.value) : null;
    const filterTo = toDate && toDate.value ? new Date(toDate.value) : null;
    // normalize filterTo to end of day if present
    let filterToEnd = null;
    if (filterTo) {
      filterToEnd = new Date(filterTo.getFullYear(), filterTo.getMonth(), filterTo.getDate(), 23,59,59,999);
    }

    snap.forEach(s => {
      const d = s.data();
      const expDate = new Date(d.date);

      // apply FROM/TO filters (client-side)
      if (filterFrom && expDate < new Date(filterFrom.getFullYear(), filterFrom.getMonth(), filterFrom.getDate(), 0,0,0)) {
        return;
      }
      if (filterToEnd && expDate > filterToEnd) {
        return;
      }

      total += Number(d.amount || 0);
      rowsForExport.push({ id: s.id, ...d });

      const li = document.createElement('li');
      li.className = 'item';
      li.innerHTML = `
        <div class="item-left">
          <div><strong>${escapeHtml(d.category)}</strong> — ${escapeHtml(d.note || '')}</div>
          <div class="muted">${new Date(d.date).toLocaleDateString()} • ${escapeHtml(d.currency)} ${Number(d.amount).toFixed(2)}</div>
          ${d.receiptUrl ? `<div class="muted small"><a href="${d.receiptUrl}" target="_blank" style="color:var(--accent1)">View receipt</a></div>` : ''}
        </div>
        <div class="item-actions">
          <button class="btn ghost edit" data-id="${s.id}">Edit</button>
          <button class="btn ghost del" data-id="${s.id}">Delete</button>
        </div>
      `;
      expensesList.appendChild(li);

      li.querySelector('.edit').addEventListener('click', () => startEdit(s.id, d));
      li.querySelector('.del').addEventListener('click', async () => {
        if (!confirm('Delete this expense?')) return;
        try { await deleteDoc(doc(db, ...path, s.id)); loadExpenses(); } catch (err) { console.error('Delete failed', err); alert('Delete failed'); }
      });
    });

    totalEl.textContent = total.toFixed(2);
    if (!expensesList.hasChildNodes()) expensesList.innerHTML = '<li class="muted">No expenses yet</li>';
    loadExpenses._lastRows = rowsForExport;
  } catch (err) {
    console.error('Load expenses failed', err);
    expensesList.innerHTML = '<li class="muted">Error loading</li>';
  }
}

/* Start edit: populate form for editing */
function startEdit(id, data) {
  editingIdEl.value = id;
  document.getElementById('note').value = data.note || '';
  document.getElementById('amount').value = data.amount || '';
  document.getElementById('currency').value = data.currency || 'USD';
  document.getElementById('category').value = data.category || 'Other';
  document.getElementById('date').value = data.date ? new Date(data.date).toISOString().slice(0,10) : '';
  cancelEditBtn.style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- Export CSV ---------- */
exportCSV.addEventListener('click', () => exportExpensesCSV());
function exportExpensesCSV() {
  const rows = loadExpenses._lastRows || [];
  if (!rows.length) return alert('No expenses to export');
  const header = ['date','category','note','amount','currency','receiptUrl'];
  const lines = [header.join(',')];
  rows.forEach(r => {
    const dt = new Date(r.date).toLocaleDateString();
    const line = [
      `"${dt}"`,
      `"${(r.category||'').replace(/"/g,'""')}"`,
      `"${(r.note||'').replace(/"/g,'""')}"`,
      `${Number(r.amount).toFixed(2)}`,
      `${r.currency || ''}`,
      `"${(r.receiptUrl||'').replace(/"/g,'""')}"`
    ].join(',');
    lines.push(line);
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `roadwallet-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/* ---------- Filter buttons ---------- */
applyFilters.addEventListener('click', () => loadExpenses());
clearFilters.addEventListener('click', () => { if (fromDate) fromDate.value=''; if (toDate) toDate.value=''; loadExpenses(); });

/* ---------- Helpers ---------- */
function escapeHtml(text) {
  return (text || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
}
