// =========================================================
// 13. earnings.js - AUTHOR EARNINGS & WITHDRAWAL LOGIC
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
const MINIMUM_WITHDRAWAL_POINTS = 1000;

// =========================================================
// 2. FIREBASE SDK IMPORTS & INITIALIZATION
// =========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =========================================================
// 3. UI Element References
// =========================================================
const authCheckMessage = document.getElementById('auth-check-message');
const earningsContent = document.getElementById('earnings-content');
const currentPointsSpan = document.getElementById('current-points');
const totalViewsSpan = document.getElementById('total-views');
const withdrawalForm = document.getElementById('withdrawal-form');
const requestPointsInput = document.getElementById('request-points');
const paymentMethodSelect = document.getElementById('payment-method');
const paymentDetailsTextarea = document.getElementById('payment-details');
const submitWithdrawalBtn = document.getElementById('submit-withdrawal-btn');
const withdrawalStatusP = document.getElementById('withdrawal-status');
const poemEarningsLedger = document.getElementById('poem-earnings-ledger');

// Header elements (for Auth status)
const loginBtn = document.getElementById('google-login-btn');
const profileLinkImg = document.getElementById('profile-link');
const ownerAdminLink = document.getElementById('owner-admin-link');
const authControls = document.getElementById('auth-controls');
const newPostLink = document.getElementById('new-post-link');

let currentAuthorData = null; // Store current logged-in author data

// =========================================================
// 4. AUTHENTICATION LOGIC (Minimal for Header & Access Guard)
// =========================================================

function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(error => console.error("Login Failed:", error.message));
}
function handleSignOut() {
    signOut(auth).then(() => window.location.reload());
}

onAuthStateChanged(auth, (user) => {
    const logoutBtn = document.getElementById('google-logout-btn');
    if (user) {
        // Logged In State (Header UI Update)
        loginBtn.classList.add('hidden');
        profileLinkImg.src = user.photoURL || 'https://via.placeholder.com/35/0A0A0A/FFD700?text=P';
        profileLinkImg.classList.remove('hidden');
        profileLinkImg.onclick = () => window.location.href = `profile.html?uid=${user.uid}`;
        if (logoutBtn) logoutBtn.classList.remove('hidden');
        if (user.uid === OWNER_UID) ownerAdminLink.classList.remove('hidden');
        else ownerAdminLink.classList.add('hidden');

        // Access Granted
        authCheckMessage.classList.add('hidden');
        earningsContent.classList.remove('hidden');
        
        // Load Author Data and Earnings
        loadAuthorDataAndEarnings(user.uid);
        setupPoemEarningsLedger(user.uid);
        
    } else {
        // Logged Out State (Access Guard)
        loginBtn.classList.remove('hidden');
        profileLinkImg.classList.add('hidden');
        ownerAdminLink.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');

        authCheckMessage.classList.remove('hidden');
        earningsContent.classList.add('hidden');
        authCheckMessage.querySelector('p').textContent = "⚠️ வருவாய் விவரங்களைக் காண Login செய்யவும்.";
    }
});

loginBtn.addEventListener('click', signInWithGoogle);
document.getElementById('google-logout-btn').addEventListener('click', handleSignOut);
// Handle new post link click (simple redirection/login check)
document.getElementById('new-post-link').addEventListener('click', (e) => { 
    e.preventDefault(); 
    if (!auth.currentUser) signInWithGoogle(); 
    else window.location.href = 'index.html#quick-post-section'; // Assuming post form is in index
});

// =========================================================
// 5. EARNINGS OVERVIEW LOGIC
// =========================================================

/**
 * Loads the author's primary financial data from the user document.
 */
async function loadAuthorDataAndEarnings(uid) {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        currentAuthorData = userSnap.data();
        
        // Update Stats UI
        currentPointsSpan.textContent = currentAuthorData.earningsPoints || 0;
        
        // Optional: Calculate Total Views (Requires querying all poems by author, complex/expensive. 
        // We'll calculate a simpler 'Total Views' from poems ledger for demo simplicity).
        totalViewsSpan.textContent = "Loading..."; 
        
        // Set minimum withdrawal input limit
        requestPointsInput.setAttribute('min', MINIMUM_WITHDRAWAL_POINTS);
        
    } else {
        alert("பயனர் விவரங்களைக் காண முடியவில்லை.");
    }
}

/**
 * Renders a single poem's earning details.
 */
function renderPoemEarningRow(poem) {
    const row = document.createElement('div');
    row.className = 'admin-item withdrawal-item'; // Reuse admin item style
    
    row.innerHTML = `
        <div class="item-content">
            <p><strong>கவிதை:</strong> <a href="poem.html?id=${poem.id}" target="_blank">${poem.title}</a></p>
            <p><small>Views: ${poem.views || 0} | Status: ${poem.status}</small></p>
        </div>
        <div class="item-actions">
            <span class="tag-status tag-pending" style="background-color: var(--color-accent); color: var(--color-secondary); font-size: 14px;">
                ${poem.earningsPoints || 0} Points
            </span>
        </div>
    `;
    return row;
}

/**
 * Sets up real-time listener for the author's APPROVED poems and updates the ledger.
 */
function setupPoemEarningsLedger(authorId) {
    const q = query(
        collection(db, "poems"),
        where("authorId", "==", authorId),
        where("status", "==", "APPROVED"),
        orderBy("createdAt", "desc")
    );
    
    let totalAuthorViews = 0; // Initialize total views for this session

    onSnapshot(q, (snapshot) => {
        poemEarningsLedger.innerHTML = '';
        totalAuthorViews = 0; // Reset total views
        
        if (snapshot.empty) {
            poemEarningsLedger.innerHTML = '<p class="empty-message">நீங்கள் அங்கீகரிக்கப்பட்ட கவிதைகள் எதையும் பதியவில்லை.</p>';
            totalViewsSpan.textContent = 0;
            return;
        }

        snapshot.forEach((doc) => {
            const poem = { ...doc.data(), id: doc.id };
            totalAuthorViews += poem.views || 0;
            const row = renderPoemEarningRow(poem);
            poemEarningsLedger.appendChild(row);
        });
        
        // Update Total Views after summing up
        totalViewsSpan.textContent = totalAuthorViews;

    }, (error) => {
        console.error("Error fetching poem earnings ledger:", error);
        poemEarningsLedger.innerHTML = '<p class="empty-message status-error">வருவாய் அறிக்கையை ஏற்ற முடியவில்லை.</p>';
    });
}


// =========================================================
// 6. WITHDRAWAL FORM LOGIC
// =========================================================

/**
 * Handles the submission of the withdrawal request form using a Firestore Transaction.
 */
async function handleWithdrawalSubmission(e) {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user || !currentAuthorData) return;

    const requestedPoints = parseInt(requestPointsInput.value);
    const paymentMethod = paymentMethodSelect.value;
    const paymentDetails = paymentDetailsTextarea.value.trim();
    const availablePoints = currentAuthorData.earningsPoints || 0;

    if (requestedPoints < MINIMUM_WITHDRAWAL_POINTS) {
        withdrawalStatusP.textContent = `குறைந்தபட்சம் ${MINIMUM_WITHDRAWAL_POINTS} Points கோர வேண்டும்.`;
        withdrawalStatusP.className = 'status-error';
        return;
    }
    if (requestedPoints > availablePoints) {
        withdrawalStatusP.textContent = `உங்களிடம் போதுமான புள்ளிகள் இல்லை. (கிடைப்பது: ${availablePoints})`;
        withdrawalStatusP.className = 'status-error';
        return;
    }

    submitWithdrawalBtn.disabled = true;
    withdrawalStatusP.textContent = "கோரிக்கை சமர்ப்பிக்கப்படுகிறது...";
    withdrawalStatusP.className = 'status-loading';

    try {
        // Use a Firestore Transaction to ensure atomic update (points deducted ONLY if request is recorded)
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "users", user.uid);
            
            // 1. Check points again inside the transaction (safety)
            const userDoc = await transaction.get(userRef);
            const currentPointsInDB = userDoc.data().earningsPoints || 0;
            
            if (requestedPoints > currentPointsInDB) {
                // This means points changed between form load and submission
                throw new Error("Points changed. Please refresh and try again.");
            }
            
            // 2. Deduct points from the user's document
            transaction.update(userRef, {
                earningsPoints: currentPointsInDB - requestedPoints,
                totalPointsWithdrawn: (userDoc.data().totalPointsWithdrawn || 0) + requestedPoints
            });

            // 3. Create the Withdrawal Request document
            const requestData = {
                authorId: user.uid,
                authorName: user.displayName,
                points: requestedPoints,
                paymentMethod: paymentMethod,
                paymentDetails: paymentDetails,
                submittedAt: serverTimestamp(),
                isPaid: false, // Owner needs to mark this as true later
            };
            
            const newRequestRef = doc(collection(db, "withdrawals"));
            transaction.set(newRequestRef, requestData);
        });

        // Success outside the transaction
        withdrawalStatusP.textContent = "✅ கோரிக்கை வெற்றிகரமாகப் பதிவு செய்யப்பட்டது! நிர்வாகம் விரைவில் செயலாக்கும்.";
        withdrawalStatusP.className = 'status-success';
        withdrawalForm.reset();
        
    } catch (error) {
        console.error("Withdrawal failed:", error);
        withdrawalStatusP.textContent = `❌ கோரிக்கை சமர்ப்பிப்பதில் பிழை: ${error.message}`;
        withdrawalStatusP.className = 'status-error';
        // Note: If transaction fails, the deducted points will be rolled back automatically.
    } finally {
        submitWithdrawalBtn.disabled = false;
        // Reload data to show updated points
        loadAuthorDataAndEarnings(user.uid); 
    }
}


// =========================================================
// 7. INITIALIZATION
// =========================================================

function setCurrentYear() {
    document.getElementById('current-year').textContent = new Date().getFullYear();
}

// Event Listeners
withdrawalForm.addEventListener('submit', handleWithdrawalSubmission);

document.addEventListener('DOMContentLoaded', () => {
    setCurrentYear();
    // Auth state listener handles the primary load
});
