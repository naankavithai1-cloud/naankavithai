// =========================================================
// 9. main.js - CORE LOGIC (V2: Poem Posting & Cloudinary - FINAL)
// =========================================================

// =========================================================
// 1. CONFIGURATION (Firebase & Cloudinary)
// =========================================================

// Firebase Configuration (from previous step)
const firebaseConfig = {
    apiKey: "AIzaSyDvO6u6srQuwIRHB0n3FajjYT1GdACrDEw",
    authDomain: "naankavithai-nk.firebaseapp.com",
    projectId: "naankavithai-nk",
    storageBucket: "naankavithai-nk.firebasestorage.app",
    messagingSenderId: "805424161171",
    appId: "1:805424161171:web:ffde12b945e8378baf8866"
};

// Cloudinary Configuration (Image Hosting)
const cloudinaryConfig = {
    cloudName: "dir99skeg",
    uploadPreset: "poem_images" // Unsigned Upload Preset
};

// Owner/Admin UID (Now set with the actual value)
const OWNER_UID = "LmTvYY2A13cuQdnUryowcTHiAD82"; 

// =========================================================
// 2. FIREBASE SDK IMPORTS & INITIALIZATION
// =========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp, getDoc, collection, addDoc, query, where, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =========================================================
// 3. UI ELEMENT REFERENCES
// =========================================================
const loginBtn = document.getElementById('google-login-btn');
const profileLinkImg = document.getElementById('profile-link');
const authControls = document.getElementById('auth-controls');
const ownerAdminLink = document.getElementById('owner-admin-link');
const newPostLink = document.getElementById('new-post-link');
const quickPostSection = document.getElementById('quick-post-section');
const poemSubmissionForm = document.getElementById('poem-submission-form');
const submissionStatus = document.getElementById('submission-status');
const poemFeed = document.getElementById('poem-feed'); // New: For Real-Time Feed

// =========================================================
// 4. AUTHENTICATION LOGIC (Login, Logout, State Change)
// =========================================================

async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        await saveAtomicUserDetails(result.user);
    } catch (error) {
        console.error("Google Login Failed:", error.message);
        // Display Toast Notification (Future Feature)
        alert("Login failed! Please try again."); 
    }
}

async function saveAtomicUserDetails(user) {
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);

    const userDetails = {
        email: user.email,
        name: user.displayName,
        photoURL: user.photoURL,
        uid: user.uid,
        lastLogin: serverTimestamp(),
        isAdmin: (user.uid === OWNER_UID), 
    };

    if (userDoc.exists()) {
        await setDoc(userRef, { ...userDetails }, { merge: true });
    } else {
        await setDoc(userRef, {
            ...userDetails,
            createdAt: serverTimestamp(),
            totalPosts: 0,
            earningsPoints: 0,
            isBanned: false,
            authorBio: "புதுக் கவிஞன்",
        });
        // Optional: Trigger Automated Welcome Email (Future Firebase Function)
    }
}

function handleSignOut() {
    signOut(auth).catch((error) => console.error("Logout failed:", error.message));
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        loginBtn.classList.add('hidden');
        profileLinkImg.src = user.photoURL || 'https://via.placeholder.com/35/0A0A0A/FFD700?text=P';
        profileLinkImg.classList.remove('hidden');

        // Ensure Logout button exists
        let logoutBtn = document.getElementById('google-logout-btn');
        if (!logoutBtn) {
            logoutBtn = document.createElement('button');
            logoutBtn.id = 'google-logout-btn';
            logoutBtn.classList.add('btn-primary', 'logout-btn'); // Added logout-btn class for style
            logoutBtn.textContent = 'Logout';
            logoutBtn.onclick = handleSignOut;
            authControls.appendChild(logoutBtn);
        }
        
        profileLinkImg.onclick = () => window.location.href = `profile.html?uid=${user.uid}`;
        
        // Admin Link Check
        if (user.uid === OWNER_UID) {
            ownerAdminLink.classList.remove('hidden');
            ownerAdminLink.href = 'admin.html';
        } else {
            ownerAdminLink.classList.add('hidden');
        }

        saveAtomicUserDetails(user).catch(err => console.error("Error updating user details:", err));

    } else {
        // User is signed out
        loginBtn.classList.remove('hidden');
        profileLinkImg.classList.add('hidden');
        ownerAdminLink.classList.add('hidden');
        quickPostSection.classList.add('hidden'); // Hide post form
        
        const logoutBtn = document.getElementById('google-logout-btn');
        if (logoutBtn) {
            logoutBtn.remove();
        }
    }
});

// =========================================================
// 5. CLOUDINARY IMAGE UPLOAD LOGIC
// =========================================================

async function uploadImageToCloudinary(file) {
    if (!file) return null;

    const url = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
        });

        if (response.ok) {
            const data = await response.json();
            return data.secure_url;
        } else {
            console.error("Cloudinary Upload failed response:", response.statusText);
            return null;
        }
    } catch (error) {
        console.error("Cloudinary Upload failed:", error);
        return null;
    }
}

// =========================================================
// 6. POEM SUBMISSION LOGIC
// =========================================================

async function handlePoemSubmission(e) {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
        submissionStatus.textContent = "கவிதை சமர்ப்பிக்க முதலில் Login செய்யவும்.";
        submissionStatus.className = 'status-error';
        return;
    }

    submissionStatus.textContent = "சமர்ப்பிக்கப்படுகிறது... படத்தை அப்லோட் செய்கிறது...";
    submissionStatus.className = 'status-loading';
    document.getElementById('submit-poem-btn').disabled = true;

    const title = document.getElementById('poem-title').value.trim();
    const content = document.getElementById('poem-content').value.trim();
    const tagsInput = document.getElementById('poem-tags').value.trim();
    const imageFile = document.getElementById('poem-image').files[0];

    if (!title || !content) {
        submissionStatus.textContent = "தலைப்பு மற்றும் கவிதை வரிகள் கட்டாயம்.";
        submissionStatus.className = 'status-error';
        document.getElementById('submit-poem-btn').disabled = false;
        return;
    }

    let imageUrl = null;
    if (imageFile) {
        imageUrl = await uploadImageToCloudinary(imageFile);
        if (!imageUrl) {
            submissionStatus.textContent = "படம் அப்லோட் செய்வதில் பிழை ஏற்பட்டது. கவிதையை மட்டும் சமர்ப்பிக்கிறது...";
            submissionStatus.className = 'status-error';
            // Continue submission without image
        }
    }

    const newPoemData = {
        title: title,
        content: content,
        tags: tagsInput ? tagsInput.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag) : [],
        imageUrl: imageUrl,
        authorId: user.uid,
        authorName: user.displayName,
        status: 'PENDING', // CRITICAL: New posts are pending owner approval
        createdAt: serverTimestamp(),
        views: 0,
        likes: 0,
        earningsPoints: 0,
    };

    try {
        await addDoc(collection(db, "poems"), newPoemData);

        submissionStatus.textContent = "✅ கவிதை வெற்றிகரமாகச் சமர்ப்பிக்கப்பட்டது! அனுமதிக்குப் பிறகு வெளியிடப்படும்.";
        submissionStatus.className = 'status-success';
        poemSubmissionForm.reset(); 
    } catch (error) {
        console.error("Firestore submission failed:", error);
        submissionStatus.textContent = `❌ சமர்ப்பிப்பதில் பிழை ஏற்பட்டது: ${error.message}`;
        submissionStatus.className = 'status-error';
    } finally {
        document.getElementById('submit-poem-btn').disabled = false;
    }
}


// =========================================================
// 7. REAL-TIME POEM FEED DISPLAY LOGIC
// =========================================================

/**
 * Renders a single poem card element.
 * @param {Object} poem - Poem data object.
 * @param {string} id - Poem document ID.
 */
function renderPoemCard(poem, id) {
    const card = document.createElement('div');
    card.className = 'poem-card';
    card.setAttribute('data-id', id);
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
            <small>By: ${poem.authorName}</small>
            <small>❤️ ${poem.likes} | 👁️ ${poem.views}</small>
        </div>
        <div class="tags-container">${tagsHTML}</div>
    `;

    return card;
}

/**
 * Fetches and displays real-time approved poems.
 */
function setupRealtimeFeed() {
    // Query: Only APPROVED poems, newest first, limit to 20 for feed
    const q = query(
        collection(db, "poems"),
        where("status", "==", "APPROVED"),
        limit(20) 
    );

    // Set up real-time listener
    onSnapshot(q, (snapshot) => {
        poemFeed.innerHTML = ''; // Clear existing feed
        if (snapshot.empty) {
            poemFeed.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--color-text-dark);">இப்போது கவிதைகள் எதுவும் இல்லை. நீங்கள் ஒரு கவிதை சமர்ப்பிக்கலாமே!</p>';
            return;
        }

        snapshot.forEach((doc) => {
            const card = renderPoemCard(doc.data(), doc.id);
            poemFeed.appendChild(card);
        });
    }, (error) => {
        console.error("Error fetching real-time feed:", error);
        poemFeed.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--color-error);">கவிதைகளை ஏற்ற முடியவில்லை. இணைய இணைப்பைச் சரிபார்க்கவும்.</p>';
    });
}


// =========================================================
// 8. EVENT LISTENERS & INITIALIZATION
// =========================================================

// Event Listener for the Login Button
loginBtn.addEventListener('click', signInWithGoogle);

// Event Listener for New Post Link (Toggle the form)
newPostLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (auth.currentUser) {
        quickPostSection.classList.toggle('hidden');
    } else {
        alert("கவிதை சமர்ப்பிக்க Google Login செய்யுங்கள்.");
    }
});

// Event Listener for Poem Submission
poemSubmissionForm.addEventListener('submit', handlePoemSubmission);


function setCurrentYear() {
    document.getElementById('current-year').textContent = new Date().getFullYear();
}

// Initialization on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    setCurrentYear();
    setupRealtimeFeed(); // Start fetching poems
    
    // Feature: Sticky Header implementation
    const header = document.querySelector('header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 0) {
            header.classList.add('sticky-header-active'); 
        } else {
            header.classList.remove('sticky-header-active');
        }
    });
});
