// =========================================================
// 12. admin.js - OWNER DASHBOARD LOGIC (V2: Security Rules Fix)
// =========================================================

// =========================================================
// 1. CONFIGURATION (Firebase & Owner UID)
// =========================================================
const firebaseConfig = {
    apiKey: "AIzaSyDvO6u6srQuwIRHB0n3FajjYT1GdACrDEw",
    authDomain: "naankavithai-nk.firebaseapp.com",
    projectId: "naankavithai-nk",
    storageBucket: "naankavithai-nk.firebasestorage.app",
    messagingSenderId: "805424161171",
    appId: "1:805424161171:web:ffde12b945e8378baf8866"
};
const OWNER_UID = "LmTvYY2A13cuQdnUryowcTHiAD82"; 

// =========================================================
// 2. FIREBASE SDK IMPORTS & INITIALIZATION
// =========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =========================================================
// 3. UI Element References
// =========================================================
const authGuardMessage = document.getElementById('auth-guard-message');
const dashboardContent = document.getElementById('dashboard-content');
const adminLogoutLink = document.getElementById('admin-logout-link');
const guardLoginBtn = document.getElementById('guard-login-btn');

const tabNavigation = document.querySelector('.tab-navigation');
const pendingPoemsList = document.getElementById('pending-poems-list');
const userManagementList = document.getElementById('user-management-list');
const withdrawalRequestsList = document.getElementById('withdrawal-requests-list');

// =========================================================
// 4. AUTH GUARD & INITIALIZATION
// =========================================================

function handleSignOut() {
    signOut(auth).then(() => {
        window.location.href = 'index.html';
    }).catch((error) => console.error("Logout failed:", error.message));
}

function handleLoginRedirect() {
    window.location.href = 'index.html'; 
}

// CRITICAL FIX: Check if the user is the Admin and if their Firestore doc confirms it.
async function checkAdminStatus(user) {
    if (!user) {
        showGuard();
        return;
    }
    
    // 1. Quick check against local OWNER_UID
    if (user.uid !== OWNER_UID) {
        showGuard();
        return;
    }

    // 2. Security Check against Firestore (To confirm isAdmin field is set)
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists() && userSnap.data().isAdmin === true) {
        // Admin is logged in and confirmed
        authGuardMessage.classList.add('hidden');
        dashboardContent.classList.remove('hidden');
        
        setupTabListeners();
        setupPendingPoemsListener(); 
        setupUserManagementListener();
        setupWithdrawalRequestsListener();

    } else {
        showGuard();
    }
}

function showGuard() {
    dashboardContent.classList.add('hidden');
    authGuardMessage.classList.remove('hidden');
    guardLoginBtn.onclick = handleLoginRedirect;
}


onAuthStateChanged(auth, (user) => {
    checkAdminStatus(user);
});

adminLogoutLink.addEventListener('click', (e) => {
    e.preventDefault();
    handleSignOut();
});

// =========================================================
// 5. TAB SWITCHING LOGIC
// =========================================================

function setupTabListeners() {
    tabNavigation.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const targetTab = e.target.getAttribute('data-tab');

            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.add('hidden'));

            e.target.classList.add('active');
            document.getElementById(targetTab).classList.remove('hidden');
        }
    });
}

// =========================================================
// 6. POST APPROVAL SYSTEM
// =========================================================

function renderPendingPoem(poem, id) {
    // ... (no change)
    const card = document.createElement('div');
    card.className = 'admin-item poem-approval-item';
    
    card.innerHTML = `
        <div class="item-content">
            <h3>${poem.title} <span class="tag-status tag-pending">PENDING</span></h3>
            <p><strong>Author:</strong> ${poem.authorName} (${poem.authorId.substring(0, 5)}...)</p>
            <p class="preview-text">${poem.content.substring(0, 150)}...</p>
            <small>Submitted: ${poem.createdAt ? new Date(poem.createdAt.toDate()).toLocaleDateString('ta-IN') : 'N/A'}</small>
        </div>
        <div class="item-actions">
            <button class="btn-primary approve-btn" data-id="${id}">
                <i class="fas fa-check"></i> Approve
            </button>
            <button class="btn-primary reject-btn" data-id="${id}">
                <i class="fas fa-times"></i> Reject
            </button>
        </div>
    `;
    return card;
}

function setupPendingPoemsListener() {
    const q = query(
        collection(db, "poems"),
        where("status", "==", "PENDING"),
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {
        pendingPoemsList.innerHTML = '';
        if (snapshot.empty) {
            pendingPoemsList.innerHTML = '<p class="empty-message">புதிய கவிதைகள் எதுவும் அங்கீகாரத்திற்கு இல்லை. 🥳</p>';
            return;
        }

        snapshot.forEach((doc) => {
            const card = renderPendingPoem(doc.data(), doc.id);
            pendingPoemsList.appendChild(card);
        });

        pendingPoemsList.querySelectorAll('.approve-btn').forEach(btn => {
            btn.onclick = () => updatePoemStatus(btn.dataset.id, 'APPROVED');
        });
        pendingPoemsList.querySelectorAll('.reject-btn').forEach(btn => {
            btn.onclick = () => updatePoemStatus(btn.dataset.id, 'REJECTED');
        });
    }, (error) => {
        console.error("Error fetching pending poems:", error);
        pendingPoemsList.innerHTML = '<p class="empty-message status-error">Pending கவிதைகளை ஏற்ற முடியவில்லை.</p>';
    });
}

async function updatePoemStatus(poemId, status) {
    try {
        const poemRef = doc(db, "poems", poemId);
        await updateDoc(poemRef, {
            status: status,
            approvedAt: (status === 'APPROVED') ? serverTimestamp() : null
        });

        alert(`கவிதை ID ${poemId} வெற்றிகரமாக ${status} செய்யப்பட்டது.`);

    } catch (error) {
        console.error(`Error updating poem status to ${status}:`, error);
        alert(`கவிதை நிலையை மாற்ற முடியவில்லை.`);
    }
}

// =========================================================
// 7. USER MANAGEMENT SYSTEM
// =========================================================

function renderUserRow(user) {
    const row = document.createElement('div');
    row.className = 'admin-item user-item';
    
    const banStatus = user.isBanned ? 'UNBAN' : 'BAN';
    const statusClass = user.isBanned ? 'tag-rejected' : 'tag-approved';

    row.innerHTML = `
        <div class="item-content">
            <img src="${user.photoURL || 'https://via.placeholder.com/40/0A0A0A/FFD700?text=U'}" alt="${user.name}" class="comment-avatar">
            <div>
                <p><strong>${user.name}</strong> (${user.uid.substring(0, 5)}...)</p>
                <small>Posts: ${user.totalPosts || 0} | Points: ${user.earningsPoints || 0}</small>
                <span class="${statusClass} tag-status">${user.isBanned ? 'BANNED' : 'Active'}</span>
            </div>
        </div>
        <div class="item-actions">
            <button class="btn-primary ban-toggle-btn" data-uid="${user.uid}" data-banned="${user.isBanned}">
                <i class="fas ${user.isBanned ? 'fa-undo' : 'fa-ban'}"></i> ${banStatus}
            </button>
            <a href="profile.html?uid=${user.uid}" target="_blank" class="btn-primary view-profile-btn">View</a>
        </div>
    `;
    return row;
}

function setupUserManagementListener() {
    const q = query(
        collection(db, "users"),
        orderBy("createdAt", "asc")
    );

    onSnapshot(q, (snapshot) => {
        userManagementList.innerHTML = '';
        snapshot.forEach((doc) => {
            const user = doc.data();
            if (user.uid !== OWNER_UID) { 
                const row = renderUserRow(user);
                userManagementList.appendChild(row);
            }
        });

        userManagementList.querySelectorAll('.ban-toggle-btn').forEach(btn => {
            btn.onclick = () => toggleUserBan(btn.dataset.uid, btn.dataset.banned === 'false');
        });
    }, (error) => {
        console.error("Error fetching users:", error);
        userManagementList.innerHTML = '<p class="empty-message status-error">பயனர் தரவுகளை ஏற்ற முடியவில்லை.</p>';
    });
}

async function toggleUserBan(uid, banStatus) {
    try {
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, {
            isBanned: banStatus 
        });
        alert(`பயனர் ID ${uid} நிலை: ${banStatus ? 'BANNED' : 'UNBANNED'}.`);
    } catch (error) {
        console.error(`Error toggling ban status for ${uid}:`, error);
        alert(`பயனர் நிலையை மாற்ற முடியவில்லை.`);
    }
}


// =========================================================
// 8. WITHDRAWAL REQUESTS SYSTEM
// =========================================================

function renderWithdrawalRequest(request, id) {
    const row = document.createElement('div');
    row.className = 'admin-item withdrawal-item';
    
    const statusText = request.isPaid ? 'PAID' : 'PENDING';
    const statusClass = request.isPaid ? 'tag-approved' : 'tag-pending';
    const dateSubmitted = request.submittedAt ? new Date(request.submittedAt.toDate()).toLocaleDateString('ta-IN') : 'N/A';

    row.innerHTML = `
        <div class="item-content">
            <p><strong>Author:</strong> ${request.authorName} (${request.authorId.substring(0, 5)}...)</p>
            <p><strong>Points:</strong> ${request.points} | <strong>Submitted:</strong> ${dateSubmitted}</p>
            <p><strong>Payment Method:</strong> ${request.paymentMethod || 'N/A'}</p>
        </div>
        <div class="item-actions">
            <span class="${statusClass} tag-status">${statusText}</span>
            <button class="btn-primary mark-paid-btn" data-id="${id}" ${request.isPaid ? 'disabled' : ''}>
                <i class="fas fa-money-check-alt"></i> Mark Paid
            </button>
        </div>
    `;
    return row;
}

function setupWithdrawalRequestsListener() {
    const q = query(
        collection(db, "withdrawals"),
        orderBy("submittedAt", "desc")
    );

    onSnapshot(q, (snapshot) => {
        withdrawalRequestsList.innerHTML = '';
        if (snapshot.empty) {
            withdrawalRequestsList.innerHTML = '<p class="empty-message">புதிய கோரிக்கைகள் எதுவும் இல்லை. 🥳</p>';
            return;
        }

        snapshot.forEach((doc) => {
            const row = renderWithdrawalRequest(doc.data(), doc.id);
            withdrawalRequestsList.appendChild(row);
        });

        withdrawalRequestsList.querySelectorAll('.mark-paid-btn').forEach(btn => {
            btn.onclick = () => markRequestAsPaid(btn.dataset.id);
        });
    }, (error) => {
        console.error("Error fetching withdrawal requests:", error);
        withdrawalRequestsList.innerHTML = '<p class="empty-message status-error">கோரிக்கைகளை ஏற்ற முடியவில்லை.</p>';
    });
}

async function markRequestAsPaid(requestId) {
    const confirmPaid = confirm("பணப் பரிமாற்றம் முடிந்துவிட்டதா? 'Paid' என குறிக்க உறுதிப்படுத்தவும்.");

    if (confirmPaid) {
        try {
            const requestRef = doc(db, "withdrawals", requestId);
            await updateDoc(requestRef, {
                isPaid: true,
                paidAt: serverTimestamp(),
                processedBy: auth.currentUser.uid, 
            });
            alert(`கோரிக்கை ID ${requestId} வெற்றிகரமாக 'Paid' என குறிக்கப்பட்டது.`);
        } catch (error) {
            console.error(`Error marking request ${requestId} as paid:`, error);
            alert(`கோரிக்கையை 'Paid' என குறிக்க முடியவில்லை.`);
        }
    }
}


// =========================================================
// 9. UTILITIES
// =========================================================

function setCurrentYear() {
    document.getElementById('current-year').textContent = new Date().getFullYear();
}

document.addEventListener('DOMContentLoaded', () => {
    setCurrentYear();
});
