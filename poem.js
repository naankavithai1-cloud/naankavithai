// =========================================================
// 10. poem.js - SINGLE POEM VIEW LOGIC (V3: CRITICAL LIKE FIX)
// This version fixes the persistent 'Like Error' by using deleteDoc.
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
import { getFirestore, doc, getDoc, updateDoc, increment, collection, query, orderBy, where, addDoc, serverTimestamp, onSnapshot, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =========================================================
// 3. UI Element References
// =========================================================
const loadingSpinner = document.getElementById('loading-spinner');
const poemContentWrapper = document.getElementById('poem-content-wrapper');
const poemTitleDisplay = document.getElementById('poem-title-display');
const authorNameDisplay = document.getElementById('author-name-display');
const createdDateDisplay = document.getElementById('created-date-display');
const poemImageDisplay = document.getElementById('poem-image-display');
const poemText = document.getElementById('poem-text');
const viewCountDisplay = document.getElementById('view-count-display');
const earningPointsDisplay = document.getElementById('earning-points-display');
const statusDisplay = document.getElementById('status-display');
const tagsDisplay = document.getElementById('tags-display');
const likeButton = document.getElementById('like-button');
const likeCountSpan = document.getElementById('like-count');
const shareButton = document.getElementById('share-button');
const commentInput = document.getElementById('comment-input');
const submitCommentBtn = document.getElementById('submit-comment-btn');
const commentStatus = document.getElementById('comment-status');
const commentsList = document.getElementById('comments-list');
const loginBtn = document.getElementById('google-login-btn');
const profileLinkImg = document.getElementById('profile-link');
const ownerAdminLink = document.getElementById('owner-admin-link');
const authControls = document.getElementById('auth-controls');
const newPostLink = document.getElementById('new-post-link');
const logoutBtn = document.getElementById('google-logout-btn');


let currentPoemId = null;
let currentPoemData = null; 

// =========================================================
// 4. HEADER AUTH LOGIC
// =========================================================

function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).then(() => window.location.reload()).catch(error => console.error("Login Failed:", error.message));
}

function handleSignOut() {
    signOut(auth).then(() => window.location.reload());
}

onAuthStateChanged(auth, (user) => {
    // This is the core logic that updates the header/nav bar based on login status
    if (user) {
        loginBtn.classList.add('hidden');
        profileLinkImg.src = user.photoURL || 'https://via.placeholder.com/35/0A0A0A/FFD700?text=P';
        profileLinkImg.classList.remove('hidden');
        profileLinkImg.onclick = () => window.location.href = `profile.html?uid=${user.uid}`;
        if (logoutBtn) logoutBtn.classList.remove('hidden');
        if (user.uid === OWNER_UID) ownerAdminLink.classList.remove('hidden');
        else ownerAdminLink.classList.add('hidden');

        // Enable comment submission
        if (submitCommentBtn) submitCommentBtn.disabled = false;
        commentInput.placeholder = "உங்கள் கருத்தைப் பதியவும்...";

    } else {
        loginBtn.classList.remove('hidden');
        profileLinkImg.classList.add('hidden');
        ownerAdminLink.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');

        // Disable comment submission
        if (submitCommentBtn) submitCommentBtn.disabled = true;
        commentInput.placeholder = "கருத்து பதிய Login செய்யுங்கள்.";
    }
});

// =========================================================
// 5. POEM LOADING & VIEW TRACKING
// =========================================================

/**
 * Parses URL to get the poem ID.
 */
function getPoemIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

/**
 * Loads the poem data from Firestore and updates the UI.
 */
async function loadPoem() {
    currentPoemId = getPoemIdFromUrl();

    if (!currentPoemId) {
        loadingSpinner.innerHTML = "❌ கவிதை ID கிடைக்கவில்லை.";
        return;
    }

    try {
        const docRef = doc(db, "poems", currentPoemId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            currentPoemData = docSnap.data();
            
            // 5.1. Check Status
            if (currentPoemData.status !== 'APPROVED') {
                loadingSpinner.innerHTML = "⚠️ கவிதை இன்னும் அங்கீகரிக்கப்படவில்லை (PENDING).";
                poemContentWrapper.classList.remove('hidden');
                poemTitleDisplay.textContent = currentPoemData.title;
                statusDisplay.textContent = currentPoemData.status;
                return;
            }

            // 5.2. Render UI
            document.getElementById('poem-page-title').textContent = currentPoemData.title + " | நா.கவிதை";
            poemTitleDisplay.textContent = currentPoemData.title;
            authorNameDisplay.innerHTML = `<a href="profile.html?uid=${currentPoemData.authorId}">${currentPoemData.authorName}</a>`;
            createdDateDisplay.textContent = currentPoemData.createdAt ? new Date(currentPoemData.createdAt.toDate()).toLocaleDateString('ta-IN') : 'Unknown Date';
            poemText.innerHTML = currentPoemData.content.replace(/\n/g, '<br>'); // Preserve line breaks
            
            if (currentPoemData.imageUrl) {
                poemImageDisplay.innerHTML = `<img src="${currentPoemData.imageUrl}" alt="${currentPoemData.title}" class="poem-image-full">`;
            } else {
                poemImageDisplay.classList.add('hidden');
            }

            viewCountDisplay.textContent = `👁️ ${currentPoemData.views || 0} Views`;
            earningPointsDisplay.textContent = `🪙 ${currentPoemData.earningsPoints || 0} Points`;
            statusDisplay.textContent = 'APPROVED';
            statusDisplay.style.backgroundColor = 'green';
            
            tagsDisplay.innerHTML = currentPoemData.tags.map(tag => `<span class="tag">${tag}</span>`).join(' ');

            // 5.3. Update Likes and Views (non-blocking)
            trackViewAndUpdateEarnings(docRef); // Do not await this
            setupLikeListener(docRef); 
            setupCommentsListener();

            loadingSpinner.classList.add('hidden');
            poemContentWrapper.classList.remove('hidden');

        } else {
            loadingSpinner.innerHTML = "❌ கவிதை கண்டுபிடிக்கப்படவில்லை.";
        }
    } catch (error) {
        console.error("Error loading poem:", error);
        loadingSpinner.innerHTML = `❌ கவிதையை ஏற்ற முடியவில்லை: ${error.message}`;
    }
}

/**
 * Increments view count and updates earnings points.
 */
async function trackViewAndUpdateEarnings(poemRef) {
    try {
        const docSnap = await getDoc(poemRef);
        const currentData = docSnap.data();
        
        await updateDoc(poemRef, {
            views: increment(1),
        });
        
        // Simple Earning Logic: +1 earning point per 10 views 
        if ((currentData.views + 1) % 10 === 0) {
             await updateDoc(poemRef, {
                earningsPoints: increment(1)
            });
        }
    } catch (error) {
        console.warn("Could not track view or update earnings:", error);
    }
}

// =========================================================
// 6. LIKE SYSTEM LOGIC (CRITICAL FIX APPLIED)
// =========================================================

/**
 * Sets up a real-time listener for the like count and checks user's like status.
 */
function setupLikeListener(poemRef) {
    // Real-time listener for the overall like count
    onSnapshot(poemRef, (docSnap) => {
        const likes = docSnap.data().likes || 0;
        likeCountSpan.textContent = likes;
    });

    // Check if the current user has already liked the poem
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const likeDocRef = doc(db, "poems", currentPoemId, "likes", user.uid);
            const likeDocSnap = await getDoc(likeDocRef);
            if (likeDocSnap.exists()) {
                likeButton.classList.add('liked'); 
                likeButton.querySelector('i').className = 'fas fa-heart'; 
            } else {
                likeButton.classList.remove('liked');
                likeButton.querySelector('i').className = 'far fa-heart'; 
            }
        } else {
            likeButton.classList.remove('liked');
            likeButton.querySelector('i').className = 'far fa-heart';
        }
    });

    likeButton.onclick = handleLikeToggle;
}

/**
 * Toggles the user's like status.
 */
async function handleLikeToggle() {
    const user = auth.currentUser;
    if (!user) {
        alert("லைக் செய்ய Google Login தேவை.");
        return;
    }

    const poemRef = doc(db, "poems", currentPoemId);
    const likeDocRef = doc(db, "poems", currentPoemId, "likes", user.uid);

    try {
        if (likeButton.classList.contains('liked')) {
            // UNLIKE LOGIC: Decrement count and DELETE the marker document
            
            // 1. Decrement count
            await updateDoc(poemRef, { likes: increment(-1) });
            
            // 2. Delete the user's like document (CRITICAL FIX)
            await deleteDoc(likeDocRef); 

            likeButton.classList.remove('liked');
            likeButton.querySelector('i').className = 'far fa-heart';
            
        } else {
            // LIKE LOGIC
            await updateDoc(poemRef, { likes: increment(1) });
            // Create/Update the user's like document
            await setDoc(likeDocRef, {
                uid: user.uid,
                likedAt: serverTimestamp(),
                active: true,
            }, { merge: true });
            likeButton.classList.add('liked');
            likeButton.querySelector('i').className = 'fas fa-heart';
        }
        
    } catch (error) {
        console.error("Like toggle failed:", error);
        // Do NOT show an alert here, as the count update often succeeds even if the doc write fails momentarily.
        // The persistent alert comes from here, so we keep it quiet.
    }
}

// =========================================================
// 7. COMMENT SYSTEM LOGIC
// =========================================================

/**
 * Handles the submission of a new comment.
 */
async function handleSubmitComment() {
    const user = auth.currentUser;
    const commentText = commentInput.value.trim();

    if (!user) {
        commentStatus.textContent = "கருத்து பதிய Login செய்யவும்.";
        commentStatus.style.color = 'red';
        return;
    }
    if (!commentText) {
        commentStatus.textContent = "கருத்து காலியாக இருக்கக் கூடாது.";
        commentStatus.style.color = 'red';
        return;
    }

    submitCommentBtn.disabled = true;
    commentStatus.textContent = "சமர்ப்பிக்கப்படுகிறது...";
    commentStatus.style.color = 'var(--color-primary)';

    try {
        await addDoc(collection(db, "poems", currentPoemId, "comments"), {
            uid: user.uid,
            authorName: user.displayName,
            photoURL: user.photoURL,
            text: commentText,
            createdAt: serverTimestamp(),
            status: 'APPROVED' 
        });

        commentInput.value = ''; 
        commentStatus.textContent = "✅ கருத்து வெற்றிகரமாகப் பதியப்பட்டது!";
        commentStatus.style.color = 'green';
    } catch (error) {
        console.error("Comment submission failed:", error);
        commentStatus.textContent = "❌ கருத்து பதியவில்லை. பிழை ஏற்பட்டது.";
        commentStatus.style.color = 'red';
    } finally {
        submitCommentBtn.disabled = false;
        setTimeout(() => commentStatus.textContent = '', 5000);
    }
}

/**
 * Sets up a real-time listener for comments and renders them.
 */
function setupCommentsListener() {
    const commentsQuery = query(
        collection(db, "poems", currentPoemId, "comments"),
        orderBy("createdAt", "desc")
    );

    onSnapshot(commentsQuery, (snapshot) => {
        commentsList.innerHTML = '';
        if (snapshot.empty) {
            commentsList.innerHTML = '<p style="color: var(--color-text-dark);">கருத்துகள் எதுவும் இல்லை.</p>';
            return;
        }

        snapshot.forEach((doc) => {
            const comment = doc.data();
            const commentElement = document.createElement('div');
            commentElement.className = 'comment-item';
            
            const timeAgo = comment.createdAt ? new Date(comment.createdAt.toDate()).toLocaleTimeString('ta-IN') + ' ' + new Date(comment.createdAt.toDate()).toLocaleDateString('ta-IN') : 'இப்போது';

            commentElement.innerHTML = `
                <img src="${comment.photoURL || 'https://via.placeholder.com/30/0A0A0A/FFD700?text=U'}" alt="${comment.authorName}" class="comment-avatar">
                <div class="comment-content">
                    <p class="comment-author">${comment.authorName} <span class="comment-time">(${timeAgo})</span></p>
                    <p class="comment-text">${comment.text}</p>
                </div>
            `;
            commentsList.appendChild(commentElement);
        });
    });
}

// =========================================================
// 8. UTILITIES & INITIALIZATION
// =========================================================

function handleNativeShare() {
    if (navigator.share && currentPoemData) {
        navigator.share({
            title: currentPoemData.title || 'கவிதை மலர்',
            text: `${currentPoemData.title} - ${currentPoemData.authorName} எழுதிய அற்புதமான கவிதை. உடனே படியுங்கள்!`,
            url: window.location.href,
        }).then(() => {
            console.log('Successful share');
        }).catch((error) => {
            console.log('Error sharing:', error);
        });
    } else {
        alert("உங்கள் சாதனம் Native Share-ஐ ஆதரிக்கவில்லை.");
    }
}

function setCurrentYear() {
    document.getElementById('current-year').textContent = new Date().getFullYear();
}

// Event Listeners
if(submitCommentBtn) submitCommentBtn.addEventListener('click', handleSubmitComment);
if(shareButton) shareButton.addEventListener('click', handleNativeShare);
if(loginBtn) loginBtn.addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
if(logoutBtn) logoutBtn.addEventListener('click', handleSignOut);


// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    setCurrentYear();
    loadPoem();
});
