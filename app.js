// Supabase Configuration
const SUPABASE_URL = 'https://yrwjqzbpdigjzzxmmqnm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyd2pxemJwZGlnanp6eG1tcW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4Njc0NjYsImV4cCI6MjA4OTQ0MzQ2Nn0.9sHzHehUr6u2eL8LYXKBxR9jdQcBj9-bLc0lGfPgQtw';

const supabaseClient = typeof supabase !== 'undefined' ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// State
let currentUser = null;
let userLocation = null;
let isSignUpMode = false;

// DOM Elements
const views = {
    landing: document.getElementById('landing-page'),
    dashboard: document.getElementById('dashboard-view'),
    nav: document.getElementById('main-nav'),
    footer: document.getElementById('main-footer'),
    modal: document.getElementById('auth-modal')
};

const elements = {
    // Auth Modal Elements
    authForm: document.getElementById('auth-form'),
    authTitle: document.getElementById('auth-title'),
    authSubtitle: document.getElementById('auth-subtitle'),
    authFirstName: document.getElementById('auth-first-name'),
    authLastName: document.getElementById('auth-last-name'),
    authEmail: document.getElementById('auth-email'),
    authPassword: document.getElementById('auth-password'),
    passwordToggle: document.getElementById('password-toggle'),
    signupFields: document.getElementById('signup-fields'),
    termsGroup: document.getElementById('terms-group'),
    authTerms: document.getElementById('auth-terms'),
    authSubmitBtn: document.getElementById('auth-submit-btn'),
    googleLoginBtn: document.getElementById('google-login-btn'),
    authSwitchLink: document.getElementById('auth-switch-link'),
    authSwitchText: document.getElementById('auth-switch-text'),
    authLoading: document.getElementById('auth-loading'),
    authError: document.getElementById('auth-error'),

    // Dashboard Elements
    userName: document.getElementById('user-display-name'),
    userEmail: document.getElementById('user-display-email'),
    welcomeName: document.getElementById('welcome-name'),
    navAvatar: document.getElementById('nav-avatar'),
    dateBadge: document.getElementById('date-badge'),

    // Search & AI
    hospitalSearchInput: document.getElementById('hospital-search-input'),
    resultsContainer: document.getElementById('hospital-results'),
    aiInput: document.getElementById('ai-input'),
    aiSendBtn: document.getElementById('ai-send-btn')
};

// --- HOSPITAL DATA (Mock/Demo Data) ---
// Note: This is an unscalable static JS array meant purely for UI demonstration.
// In a real application, this should be fetched from Supabase DB or a geo-location API.
const MOCK_HOSPITALS = [
    { name: 'Krishna Medical Centre', address: 'Dampier Nagar, Mathura', rating: 4.7, distance: '0.8km', tags: ['Emergency', 'Cardiology', 'ICU'] },
    { name: 'Gokul Health Hospital', address: 'Govind Nagar, Mathura', rating: 4.5, distance: '1.2km', tags: ['Neurology', 'Orthopedics', 'Lab'] },
    { name: 'Vrindavan Super Speciality', address: 'Vrindavan Road, Mathura', rating: 4.8, distance: '2.1km', tags: ['Cardiology', 'Oncology', 'ICU'] },
    { name: 'Janaki Maternity Clinic', address: 'Deeg Gate, Mathura', rating: 4.4, distance: '1.7km', tags: ['Pediatrics', 'Maternity', 'NICU'] }
];

let activeFilter = 'All';

// --- DATE BADGE ---
const now = new Date();
if (elements.dateBadge) {
    elements.dateBadge.textContent = '📅 ' + now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}

// --- AUTH LOGIC ---
async function checkAuth() {
    if (!supabaseClient) {
        console.error("Supabase client not initialized.");
        return;
    }
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        currentUser = session?.user || null;
    } catch (err) {
        console.error("Authentication check failed (Network or Supabase Error):", err.message);
        currentUser = null;
        alert("Warning: Could not connect to Supabase authentication server. Please check your network.");
    }
    toggleView();
}

function toggleView() {
    if (currentUser) {
        views.landing.classList.add('hidden');
        views.nav.classList.add('hidden');
        views.footer.classList.add('hidden');
        views.dashboard.classList.remove('hidden');
        closeModal();
        showDashboard();

        const metadata = currentUser.user_metadata || {};
        const fullName = metadata.full_name || metadata.name || 'User';
        
        // Smarter first name extraction for Google login or Email signup
        let firstName = metadata.first_name || metadata.given_name || fullName.split(' ')[0];
        
        if (firstName === 'User') {
            firstName = currentUser.email.split('@')[0];
            firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
        }

        elements.userName.textContent = fullName !== 'User' ? fullName : firstName;
        elements.userEmail.textContent = currentUser.email;
        elements.welcomeName.textContent = firstName;
        elements.navAvatar.textContent = (firstName[0] || 'U').toUpperCase();

        // Load saved profile photo
        loadSavedAvatar();
    } else {
        views.landing.classList.remove('hidden');
        views.dashboard.classList.add('hidden');
        views.nav.classList.remove('hidden');
        views.footer.classList.remove('hidden');
    }
}

// --- PROFILE PHOTO (Supabase Storage) ---
async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file || !currentUser || !supabaseClient) return;

    const fileExt = file.name.split('.').pop();
    const filePath = `${currentUser.id}/avatar.${fileExt}`;

    try {
        // Upload to Supabase Storage (avatars bucket)
        const { error: uploadError } = await supabaseClient.storage
            .from('avatars')
            .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabaseClient.storage
            .from('avatars')
            .getPublicUrl(filePath);

        const publicUrl = urlData.publicUrl + '?t=' + Date.now(); // cache bust

        // Save URL to profiles table
        await supabaseClient
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', currentUser.id);

        setAvatarImage(publicUrl);
    } catch (err) {
        console.error('Avatar upload failed:', err.message);
    }
}
window.handleAvatarUpload = handleAvatarUpload;

function setAvatarImage(url) {
    const avatar = elements.navAvatar;
    if (avatar && url) {
        avatar.innerHTML = `<img src="${url}" alt="Profile">`;
    }
}

async function loadSavedAvatar() {
    if (!currentUser || !supabaseClient) return;
    try {
        const { data } = await supabaseClient
            .from('profiles')
            .select('avatar_url')
            .eq('id', currentUser.id)
            .single();

        if (data && data.avatar_url) {
            setAvatarImage(data.avatar_url);
        }
    } catch (err) {
        console.error('Load avatar failed:', err.message);
    }
}

// --- INNER PAGE SWITCHING ---
function setActiveNav(id) {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(id);
    if (btn) btn.classList.add('active');
}

function switchDashPage(pageId) {
    document.querySelectorAll('.dash-page').forEach(p => p.classList.remove('active-page'));
    const page = document.getElementById(pageId);
    if (page) page.classList.add('active-page');
}

function showDashboard() {
    views.dashboard.classList.remove('hidden');
    switchDashPage('dash-home');
    setActiveNav('nav-dashboard-btn');
}

function showSearch() {
    views.dashboard.classList.remove('hidden');
    switchDashPage('dash-search');
    setActiveNav('nav-search-btn');
    renderHospitals(MOCK_HOSPITALS);
}

function showAI() {
    views.dashboard.classList.remove('hidden');
    switchDashPage('dash-ai');
    setActiveNav('nav-ai-btn');
}

// Global Exports
window.showDashboard = showDashboard;
window.showSearch = showSearch;
window.showAI = showAI;

// --- MODAL LOGIC ---
function showAuth(mode = 'login') {
    isSignUpMode = mode === 'signup';
    views.modal.classList.add('active');
    
    // Reset Form
    elements.authFirstName.value = "";
    elements.authLastName.value = "";
    elements.authEmail.value = "";
    elements.authPassword.value = "";
    elements.authError.classList.add('hidden');

    elements.authTitle.textContent = isSignUpMode ? 'Sign Up' : 'Login';
    elements.authSubtitle.textContent = isSignUpMode ? 'Create your account to get started.' : 'Welcome back! Please enter your details.';
    elements.authSubmitBtn.textContent = isSignUpMode ? 'Sign Up' : 'Login';
    elements.authSwitchText.textContent = isSignUpMode ? 'Already have an account?' : "Don't have an account?";
    elements.authSwitchLink.textContent = isSignUpMode ? 'Login' : 'Sign Up';
    
    if (isSignUpMode) {
        elements.signupFields.classList.remove('hidden');
        elements.termsGroup.classList.remove('hidden');
    } else {
        elements.signupFields.classList.add('hidden');
        elements.termsGroup.classList.add('hidden');
    }

    // Reset styles and visibility
    elements.authSubtitle.style.color = ""; 
    elements.authForm.classList.remove('hidden');
    elements.googleLoginBtn.classList.remove('hidden');
    const divider = document.querySelector('div[style*="text-align: center; color: #ccc"]');
    if (divider) divider.classList.remove('hidden');
}

function closeModal() {
    views.modal.classList.remove('active');
}

window.showAuth = showAuth;
window.closeModal = closeModal;

// --- AUTH SUBMISSION ---
elements.authForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = elements.authEmail.value.trim();
    const password = elements.authPassword.value;
    const firstName = elements.authFirstName.value.trim();
    const lastName = elements.authLastName.value.trim();

    if (isSignUpMode && !elements.authTerms.checked) {
        elements.authError.textContent = "Please agree to the terms.";
        elements.authError.classList.remove('hidden');
        return;
    }

    elements.authLoading.classList.remove('hidden');
    elements.authSubmitBtn.disabled = true;

    try {
        let result;
        if (isSignUpMode) {
            result = await supabaseClient.auth.signUp({ 
                email, password,
                options: { data: { first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}` } }
            });
            
            if (result.error) throw result.error;

            if (result.data.user && !result.data.session) {
                elements.authSubtitle.textContent = "Account created! Please check your email for confirmation.";
                elements.authSubtitle.style.color = "var(--accent)";
                elements.authForm.classList.add('hidden');
                elements.googleLoginBtn.classList.add('hidden');
                const d = document.querySelector('div[style*="text-align: center; color: #ccc"]');
                if (d) d.classList.add('hidden');
                return;
            } else {
                elements.authSubtitle.textContent = "Account created successfully!";
                elements.authSubtitle.style.color = "var(--accent)";
            }
        } else {
            result = await supabaseClient.auth.signInWithPassword({ email, password });
            if (result.error) throw result.error;
            elements.authSubtitle.textContent = "Login successful!";
            elements.authSubtitle.style.color = "var(--accent)";
        }
        
        setTimeout(() => { checkAuth(); }, 1500);

    } catch (error) {
        elements.authError.textContent = error.message;
        elements.authError.classList.remove('hidden');
    } finally {
        elements.authLoading.classList.add('hidden');
        elements.authSubmitBtn.disabled = false;
    }
};

async function handleLogout() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    toggleView();
}
window.handleLogout = handleLogout;

// --- UI EFFECTS ---
window.onscroll = () => {
    if (views.nav && window.scrollY > 50) {
        views.nav.classList.add('scrolled');
    } else if (views.nav) {
        views.nav.classList.remove('scrolled');
    }
};

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
    });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

views.modal.onclick = (e) => {
    if (e.target === views.modal) closeModal();
};

window.onkeydown = (e) => {
    if (e.key === 'Escape') closeModal();
};

// --- HOSPITAL SEARCH LOGIC ---
function renderHospitals(list) {
    const container = elements.resultsContainer;
    if (!container) return;
    container.innerHTML = list.map(h => `
        <div class="hospital-card-dark">
            <div class="h-top">
                <div class="h-icon-box">🏥</div>
                <div class="h-rating">⭐ ${h.rating}</div>
            </div>
            <h3>${h.name}</h3>
            <p class="h-address">${h.address}</p>
            <div class="h-tags">${h.tags.map(t => `<span class="h-tag">${t}</span>`).join('')}</div>
            <div class="h-bottom">
                <span class="h-distance">📍 ${h.distance}</span>
                <button class="h-dir-btn">Get Directions →</button>
            </div>
        </div>
    `).join('');
}

function setFilter(el) {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    activeFilter = el.dataset.filter;
    filterHospitals();
}
window.setFilter = setFilter;

function filterHospitals() {
    const query = elements.hospitalSearchInput ? elements.hospitalSearchInput.value.toLowerCase() : '';
    let filtered = MOCK_HOSPITALS;

    if (activeFilter !== 'All') {
        filtered = filtered.filter(h => h.tags.some(t => t === activeFilter));
    }

    if (query) {
        filtered = filtered.filter(h =>
            h.name.toLowerCase().includes(query) ||
            h.address.toLowerCase().includes(query) ||
            h.tags.some(t => t.toLowerCase().includes(query))
        );
    }

    renderHospitals(filtered);
}

// --- AI CHAT LOGIC ---
async function handleAIChat() {
    const input = elements.aiInput;
    if (!input) return;
    const message = input.value.trim();
    if (!message) return;

    const chatContainer = document.getElementById('chat-container');
    if (!chatContainer) return;

    // Add user message
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-msg user';
    userMsg.innerHTML = `<div class="chat-avatar">👤</div><div class="chat-bubble">${message}</div>`;
    chatContainer.appendChild(userMsg);
    input.value = '';

    // Add typing indicator
    const typing = document.createElement('div');
    typing.className = 'chat-msg bot';
    typing.id = 'typing-indicator';
    typing.innerHTML = `<div class="chat-avatar">🤖</div><div class="chat-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
    chatContainer.appendChild(typing);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
        // Only talking to our AI backend proxy
        const res = await fetch('http://localhost:5000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        
        if (!res.ok) {
            throw new Error(`Proxy error: ${res.status}`);
        }
        
        const data = await res.json();

        const typingEl = document.getElementById('typing-indicator');
        if (typingEl) typingEl.remove();

        const aiMsg = document.createElement('div');
        aiMsg.className = 'chat-msg bot';
        aiMsg.innerHTML = `<div class="chat-avatar">🤖</div><div class="chat-bubble">${data.reply || data.message || "I don't know what to say."}</div>`;
        chatContainer.appendChild(aiMsg);
    } catch (err) {
        console.error('AI Chat Error:', err);
        const typingEl = document.getElementById('typing-indicator');
        if (typingEl) typingEl.remove();

        const errMsg = document.createElement('div');
        errMsg.className = 'chat-msg bot';
        errMsg.innerHTML = `<div class="chat-avatar">🤖</div><div class="chat-bubble" style="color:#ff6b6b; border: 1px solid rgba(255,107,107,0.3);">⚠️ Our AI service is currently taking a break. In a health emergency, please contact a doctor immediately!</div>`;
        chatContainer.appendChild(errMsg);
    }
    chatContainer.scrollTop = chatContainer.scrollHeight;
}
window.handleAIChat = handleAIChat;

function sendSuggestion(text) {
    const input = elements.aiInput;
    if (input) {
        input.value = text;
        handleAIChat();
    }
}
window.sendSuggestion = sendSuggestion;

// --- INITIALIZATION ---
document.getElementById('nav-login-btn').onclick = () => showAuth('login');
document.getElementById('nav-get-started-btn').onclick = () => showAuth('signup');
document.getElementById('get-started-hero').onclick = () => showAuth('signup');
document.getElementById('cta-signup-btn').onclick = () => showAuth('signup');
document.getElementById('cta-login-btn').onclick = () => showAuth('login');

elements.authSwitchLink.onclick = (e) => { e.preventDefault(); showAuth(isSignUpMode ? 'login' : 'signup'); };
elements.googleLoginBtn.onclick = async () => {
    try {
        if (!supabaseClient) throw new Error("Supabase client not initialized.");
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: { 
                redirectTo: window.location.origin,
                queryParams: {
                    prompt: 'select_account' // Forces the account selection screen
                }
            }
        });
        if (error) throw error;
    } catch (error) {
        elements.authError.textContent = error.message;
        elements.authError.classList.remove('hidden');
    }
};

elements.passwordToggle.onclick = () => {
    const type = elements.authPassword.type === 'password' ? 'text' : 'password';
    elements.authPassword.type = type;
    elements.passwordToggle.textContent = type === 'password' ? '👁️' : '🔒';
};

// Search button binding
const searchBtn = document.getElementById('search-btn');
if (searchBtn) searchBtn.onclick = filterHospitals;

// Hospital search input live filtering
if (elements.hospitalSearchInput) {
    elements.hospitalSearchInput.oninput = filterHospitals;
}

if (supabaseClient) checkAuth();
