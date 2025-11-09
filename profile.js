// =========================================================
// 11. profile.js - USER PROFILE AND FOLLOWER LOGIC
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
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, increment, collection, query, where, onSnapshot, setDoc, deleteDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =========================================================
// 3. UI Element References
// =========================================================
const loadingSpinner = document.getElementById('loading-spinner');
const profileContentWrapper = document.getElementById('profile-content-wrapper');
const profilePhoto = document.getElementById('profile-photo');
const displayNameH1 = document.getElementById('display-name');
const authorBioP = document.getElementById('author-bio');
const totalPostsSpan = document.getElementById('total-posts');
const followerCountSpan = document.getElementById('follower-count');
const totalEarningsSpan = document.getElementById('total-earnings');
const totalLikesSpan = document.getElementById('total-likes'); // Placeholder
const authorBadgesDiv = document.getElementById('author-badges');
const followButton = document.getElementById('follow-button');
const settingsLink = document.getElementById('settings-link');
const authorPoemsFeed = document.getElementById('author-poems-feed');

// Header elements (for Auth status)
const loginBtn = document.getElementById('google-login-btn');
const profileLinkImg = document.getElementById('profile-link');
const ownerAdminLink = document.getElementById('owner-admin-link');
const authControls = document.getElementById('auth-controls');

let targetAuthorUid = null; // The UID of the profile being viewed

// =========================================================
// 4. AUTHENTICATION LOGIC (Minimal for Header)
// =========================================================

function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(error => console.error("Login Failed:", error.message));
}
function handleSignOut() {
    signOut(auth);
}

onAuthStateChanged(auth, (user) => {
    // Header UI Logic
    const logoutBtn = document.getElementById('google-logout-btn');
    if (user) {
        loginBtn.classList.add('hidden');
        profileLinkImg.src = user.photoURL || 'https://via.placeholder.com/35/0A0A0A/FFD700?text=P';
        profileLinkImg.classList.remove('hidden');
        profileLinkImg.onclick = () => window.location.href = `profile.html?uid=${user.uid}`;
        if (logoutBtn) logoutBtn.classList.remove('hidden');
        if (user.uid === OWNER_UID) ownerAdminLink.classList.remove('hidden');
        else ownerAdminLink.classList.add('hidden');

        // Check if the current user is viewing their OWN profile
        if (user.uid === targetAuthorUid) {
            followButton.classList.add('hidden');
            settingsLink.classList.remove('hidden');
        } else {
            followButton.classList.remove('hidden');
            settingsLink.classList.add('hidden');
            checkFollowStatus(user.uid, targetAuthorUid); // Check follow status only if logged in and not own profile
        }

    } else {
        // Logged out state
        loginBtn.classList.remove('hidden');
        profileLinkImg.classList.add('hidden');
        ownerAdminLink.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
        followButton.classList.remove('hidden'); // Show follow button but disable it (handled below)
        settingsLink.classList.add('hidden');
        updateFollowButton(false, false); // Disabled state when logged out
    }
});
loginBtn.addEventListener('click', signInWithGoogle);
document.getElementById('google-logout-btn').addEventListener('click', handleSignOut);

// =========================================================
// 5. PROFILE LOADING & BADGES
// =========================================================

/**
 * Loads the target author's data from Firestore.
 */
async function loadAuthorProfile() {
    const params = new URLSearchParams(window.location.search);
    targetAuthorUid = params.get('uid');

    if (!targetAuthorUid) {
        loadingSpinner.innerHTML = "❌ சுயவிவரம் ID கிடைக்கவில்லை.";
        return;
    }

    try {
        const userRef = doc(db, "users", targetAuthorUid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const data = userSnap.data();
            
            // Render UI
            document.getElementById('profile-page-title').textContent = `${data.name} | சுயவிவரம்`;
            profilePhoto.src = data.photoURL || 'https://via.placeholder.com/150/0A0A0A/FFD700?text=P';
            displayNameH1.textContent = data.name;
            authorBioP.textContent = data.authorBio || "கவிஞர் இன்னும் சுயவிவரம் சேர்க்கவில்லை.";
            totalPostsSpan.textContent = data.totalPosts || 0;
            totalEarningsSpan.textContent = data.earningsPoints || 0;
            
            // Placeholder: Total Likes (Requires calculation across all posts, simplified for now)
            totalLikesSpan.textContent = "N/A";

            // Gamification: Author Badges
            renderBadges(data.totalPosts, data.earningsPoints);

            // Load the author's poems
            setupAuthorPoemsFeed(targetAuthorUid);
            
            // Hide loading, show content
            loadingSpinner.classList.add('hidden');
            profileContentWrapper.classList.remove('hidden');

        } else {
            loadingSpinner.innerHTML = "❌ சுயவிவரம் கண்டுபிடிக்கப்படவில்லை.";
        }
    } catch (error) {
        console.error("Error loading profile:", error);
        loadingSpinner.innerHTML = `❌ சுயவிவரத்தை ஏற்ற முடியவில்லை: ${error.message}`;
    }
}

/**
 * Assigns badges based on post count (Simple Gamification Logic).
 */
function renderBadges(postCount, earnings) {
    authorBadgesDiv.innerHTML = ''; // Clear previous badges
    let badge = 'No Badge';

    if (postCount >= 20 && earnings >= 50) {
        badge = 'Gold Poet';
        authorBadgesDiv.innerHTML += `<span class="badge badge-gold"><i class="fas fa-crown"></i> Gold Poet</span>`;
    } else if (postCount >= 10 && earnings >= 10) {
        badge = 'Silver Poet';
        authorBadgesDiv.innerHTML += `<span class="badge badge-silver"><i class="fas fa-star"></i> Silver Poet</span>`;
    } else if (postCount >= 1) {
        badge = 'Bronze Poet';
        authorBadgesDiv.innerHTML += `<span class="badge badge-bronze"><i class="fas fa-feather-alt"></i> Bronze Poet</span>`;
    }
    console.log(`User badge: ${badge}`);
}

// =========================================================
// 6. FOLLOWER SYSTEM LOGIC
// =========================================================

/**
 * Sets the UI state of the follow button.
 * @param {boolean} isFollowing - If the current user is following the target.
 * @param {boolean} isLoggedIn - If the current user is logged in.
 */
function updateFollowButton(isFollowing, isLoggedIn) {
    if (!isLoggedIn) {
        followButton.textContent = "Login to Follow";
        followButton.disabled = false; // Allow login click
        followButton.onclick = signInWithGoogle;
        followButton.classList.remove('following');
    } else if (isFollowing) {
        followButton.textContent = "Following";
        followButton.classList.add('following');
        followButton.disabled = false;
        followButton.onclick = handleFollowToggle;
    } else {
        followButton.textContent = "Follow";
        followButton.classList.remove('following');
        followButton.disabled = false;
        followButton.onclick = handleFollowToggle;
    }
}

/**
 * Checks if the current user is already following the target user.
 */
function checkFollowStatus(followerUid, targetUid) {
    const followRef = doc(db, "users", targetUid, "followers", followerUid);

    onSnapshot(followRef, (docSnap) => {
        const isFollowing = docSnap.exists();
        updateFollowButton(isFollowing, true);
    });

    // Real-time listener for the total follower count
    const followersCollectionRef = collection(db, "users", targetUid, "followers");
    onSnapshot(followersCollectionRef, (snapshot) => {
        // Note: Using snapshot.size is cheap for count on small subcollections, 
        // but for larger scale, a Cloud Function count is better.
        followerCountSpan.textContent = snapshot.size;
    });
}

/**
 * Toggles the follow/unfollow status.
 */
async function handleFollowToggle() {
    const currentUser = auth.currentUser;
    if (!currentUser) return; // Should be handled by updateFollowButton

    const targetRef = doc(db, "users", targetAuthorUid);
    const followRef = doc(db, "users", targetAuthorUid, "followers", currentUser.uid);

    try {
        if (followButton.classList.contains('following')) {
            // UNFOLLOW Logic
            await deleteDoc(followRef);
            // Decrement follower count (Optional, as the real-time listener will update)
            console.log("Unfollowed.");
        } else {
            // FOLLOW Logic
            await setDoc(followRef, { 
                followerUid: currentUser.uid,
                followedAt: serverTimestamp(),
                followerName: currentUser.displayName
            });
            // Increment follower count (Optional)
            console.log("Followed.");
        }
    } catch (error) {
        console.error("Follow/Unfollow failed:", error);
        alert("பின்தொடர்வதில் பிழை ஏற்பட்டது.");
    }
}

// =========================================================
// 7. AUTHOR'S POEM LIST LOGIC
// =========================================================

/**
 * Renders a single poem card element (reused from main.js).
 */
function renderPoemCard(poem, id) {
    const card = document.createElement('div');
    card.className = 'poem-card'; // Uses existing poem-card style
    card.onclick = () => window.location.href = `poem.html?id=${id}`;

    const tagsHTML = poem.tags.map(tag => `<span class="tag">${tag}</span>`).join(' ');

    let imageHTML = '';
    if (poem.imageUrl) {
        imageHTML = `<img src="${poem.imageUrl}" alt="${poem.title}" class="poem-image-thumb">`;
    }

    card.innerHTML = `
        ${imageHTML}
        <h3>${poem.title}</h3>
        <p class="content-preview">${poem.content.substring(0, 80)}...</p>
        <div class="card-meta">
            <small>❤️ ${poem.likes || 0} | 👁️ ${poem.views || 0}</small>
        </div>
        <div class="tags-container">${tagsHTML}</div>
    `;
    return card;
}

/**
 * Fetches and displays real-time poems by the target author.
 */
function setupAuthorPoemsFeed(authorId) {
    // Query: Poems by this author, must be APPROVED, newest first.
    const q = query(
        collection(db, "poems"),
        where("authorId", "==", authorId),
        where("status", "==", "APPROVED"),
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {
        authorPoemsFeed.innerHTML = ''; 
        if (snapshot.empty) {
            authorPoemsFeed.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--color-text-dark);">இந்தக் கவிஞர் இன்னும் கவிதைகள் எதையும் அங்கீகரித்து வெளியிடவில்லை.</p>';
            return;
        }

        snapshot.forEach((doc) => {
            const card = renderPoemCard(doc.data(), doc.id);
            authorPoemsFeed.appendChild(card);
        });
    }, (error) => {
        console.error("Error fetching author's feed:", error);
        authorPoemsFeed.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--color-error);">கவிதைகளை ஏற்ற முடியவில்லை.</p>';
    });
}

// =========================================================
// 8. INITIALIZATION
// =========================================================

function setCurrentYear() {
    document.getElementById('current-year').textContent = new Date().getFullYear();
}

document.addEventListener('DOMContentLoaded', () => {
    setCurrentYear();
    loadAuthorProfile();
});
