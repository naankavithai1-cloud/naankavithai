// =========================================================
// 9. main.js - CORE LOGIC (V9: FINAL DEPLOYMENT CODE)
// Fixes all Index/Order issues and confirms full core functionality.
// =========================================================

// =========================================================
// 1. CONFIGURATION (Firebase & Cloudinary)
// =========================================================
const cloudinaryConfig = {
    cloudName: "dir99skeg",
    uploadPreset: "poem_images" 
};
const OWNER_UID = "LmTvYY2A13cuQdnUryowcTHiAD82"; 

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDvO6u6srQuwIRHB0n3FajjYT1GdACrDEw",
    authDomain: "naankavithai-nk.firebaseapp.com",
    projectId: "naankavithai-nk",
    storageBucket: "naankavithai-nk.firebasestorage.app",
    messagingSenderId: "805424161171",
    appId: "1:805424161171:web:ffde12b945e8378baf8866"
};


// =========================================================
// 2. FIREBASE SDK IMPORTS & INITIALIZATION
// =========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp, getDoc, collection, addDoc, query, where, limit, onSnapshot, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// =========================================================
// 3. UI ELEMENT REFERENCES
// =========================================================
const loginBtn = document.getElementById('google-login-btn');
const profileLinkImg = document.getElementById('profile-link');
const ownerAdminLink = document.getElementById('owner-admin-link');
const newPostLink = document.getElementById('new-post-link');
const quickPostSection = document.getElementById('quick-post-section');
const poemSubmissionForm = document.getElementById('poem-submission-form');
const submissionStatus = document.getElementById('submission-status');
const poemFeed = document.getElementById('poem-feed'); 
const logoutBtn = document.getElementById('google-logout-btn');

// Search and Filter elements
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const trendingBtn = document.getElementById('trending-btn');
const latestBtn = document.getElementById('latest-btn');

let currentSortOrder = 'latest'; 
window.searchTimer = null; 


// =========================================================
// 4. AUTHENTICATION LOGIC
// =========================================================

async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        await saveAtomicUserDetails(result.user);
        window.location.reload(); 
    } catch (error) {
        console.error("Google Login Failed:", error.message);
        alert("Login failed! Please try again.");
    }
}

async function saveAtomicUserDetails(user) {
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);

    const isOwner = user.uid === OWNER_UID;

    const userDetails = {
        email: user.email,
        name: user.displayName,
        photoURL: user.photoURL,
        uid: user.uid,
        lastLogin: serverTimestamp(),
        isAdmin: isOwner, 
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
    }
}

function handleSignOut() {
    signOut(auth).then(() => window.location.reload()).catch((error) => console.error("Logout failed:", error.message));
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        loginBtn.classList.add('hidden');
        profileLinkImg.classList.remove('hidden');
        profileLinkImg.src = user.photoURL || 'https://via.placeholder.com/35/0A0A0A/FFD700?text=P';
        profileLinkImg.onclick = () => window.location.href = `profile.html?uid=${user.uid}`;
        
        if (logoutBtn) logoutBtn.classList.remove('hidden');
        
        if (user.uid === OWNER_UID) {
            ownerAdminLink.classList.remove('hidden');
            ownerAdminLink.href = 'admin.html';
        } else {
            ownerAdminLink.classList.add('hidden');
        }

        saveAtomicUserDetails(user).catch(err => console.error("Error updating user details:", err));

    } else {
        loginBtn.classList.remove('hidden');
        profileLinkImg.classList.add('hidden');
        ownerAdminLink.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
        quickPostSection.classList.add('hidden'); 
    }
});


// =========================================================
// 5. POEM SUBMISSION LOGIC 
// =========================================================

async function uploadImageToCloudinary(file) {
    if (!file) return null;

    const url = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);

    try {
        const response = await fetch(url, { method: 'POST', body: formData });
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
        }
    }

    const newPoemData = {
        title: title,
        content: content,
        tags: tagsInput ? tagsInput.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag) : [],
        imageUrl: imageUrl,
        authorId: user.uid,
        authorName: user.displayName,
        status: 'PENDING', 
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
// 6. REAL-TIME FEED & SEARCH/FILTER LOGIC (CRITICAL FIX)
// =========================================================

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
            <small>❤️ ${poem.likes || 0} | 👁️ ${poem.views || 0}</small>
        </div>
        <div class="tags-container">${tagsHTML}</div>
    `;
    return card;
}

/**
 * Main function to fetch and display poems based on search and filter parameters.
 */
async function loadPoemFeed(searchQuery = '') {
    const poemFeedContainer = document.getElementById('poem-feed');
    const poemFeedSectionTitle = document.querySelector('#poem-feed-section h2');
    poemFeedContainer.innerHTML = '<p class="loading-message" style="grid-column: 1 / -1; text-align: center;">கவிதைகள் ஏற்றப்படுகிறது...</p>';

    let q = query(collection(db, "poems"), where("status", "==", "APPROVED"));
    
    // 1. Apply Sorting based on currentSortOrder
    if (currentSortOrder === 'latest') {
        // FIX: Using DESCENDING order which is required for the "Latest" index
        q = query(q, orderBy("createdAt", "desc")); 
        poemFeedSectionTitle.textContent = "சமீபத்திய கவிதைகள்";
    } else if (currentSortOrder === 'trending') {
        q = query(q, orderBy("views", "desc")); 
        poemFeedSectionTitle.textContent = "🔥 Trending கவிதைகள்";
    }

    // 2. Apply Search Filter if query is provided (Advanced Firestore Range Search)
    if (searchQuery) {
        const searchUpper = searchQuery.toLowerCase();
        const searchLower = searchUpper.substring(0, searchUpper.length - 1) + String.fromCharCode(searchUpper.charCodeAt(searchUpper.length - 1) + 1);

        q = query(q, 
            where("title", ">=", searchUpper), 
            where("title", "<", searchLower)
        );
        poemFeedSectionTitle.textContent = `தேடல் முடிவுகள்: "${searchQuery}"`;
    }
    
    q = query(q, limit(30));

    try {
        const querySnapshot = await getDocs(q);
        
        poemFeedContainer.innerHTML = '';
        if (querySnapshot.empty) {
            poemFeedContainer.innerHTML = '<p class="empty-message" style="grid-column: 1 / -1; text-align: center;">தேடல் முடிவுகள் எதுவும் இல்லை. 😥</p>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const poemData = doc.data();
            const card = renderPoemCard(poemData, doc.id);
            poemFeedContainer.appendChild(card);
        });

    } catch (error) {
        console.error("கவிதைகளைப் பெறுவதில் பிழை:", error);
        poemFeedContainer.innerHTML = `<p class="error-message status-error" style="grid-column: 1 / -1; text-align: center;">கவிதைகளைப் பெறுவதில் சிக்கல். (Index/Rules Error). Console-ஐச் சரிபார்க்கவும்.</p>`;
    }
}


// =========================================================
// 7. EVENT LISTENERS & INITIALIZATION
// =========================================================

function setupListeners() {
    // Auth listeners
    loginBtn.addEventListener('click', signInWithGoogle);
    logoutBtn.addEventListener('click', handleSignOut); 
    newPostLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (auth.currentUser) { quickPostSection.classList.toggle('hidden'); } else { alert("Login செய்யுங்கள்."); }
    });
    poemSubmissionForm.addEventListener('submit', handlePoemSubmission);

    // Search and Filter Listeners
    trendingBtn.addEventListener('click', () => {
        currentSortOrder = 'trending';
        trendingBtn.classList.add('active');
        latestBtn.classList.remove('active');
        loadPoemFeed();
    });

    latestBtn.addEventListener('click', () => {
        currentSortOrder = 'latest';
        latestBtn.classList.add('active');
        trendingBtn.classList.remove('active');
        loadPoemFeed();
    });
    
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim();
        if (query.length > 0) {
            clearSearchBtn.classList.remove('hidden');
        } else {
            clearSearchBtn.classList.add('hidden');
        }
        // Debounce to prevent excessive Firestore reads
        clearTimeout(window.searchTimer);
        window.searchTimer = setTimeout(() => {
            loadPoemFeed(query.toLowerCase()); 
        }, 500); 
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.classList.add('hidden');
        loadPoemFeed(); 
    });
}


function setCurrentYear() {
    document.getElementById('current-year').textContent = new Date().getFullYear();
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js').catch(error => { console.error('ServiceWorker registration failed: ', error); });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setCurrentYear();
    setupListeners(); 
    loadPoemFeed(); 
    registerServiceWorker();
    
    // Sticky Header implementation
    const header = document.querySelector('header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 0) {
            header.classList.add('sticky-header-active'); 
        } else {
            header.classList.remove('sticky-header-active');
        }
    });
});
