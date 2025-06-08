import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://zakaerddsmwebuerjsge.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha2FlcmRkc213ZWJ1ZXJqc2dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MTg1MjUsImV4cCI6MjA2NDM5NDUyNX0.tYF3hlQIl3rGyquh8WxDUHGbAiPsJi4usYfvTTA9k2Y';
const supabase = createClient(supabaseUrl, supabaseKey);

// Redirect to login page if not logged in
if (!window.location.pathname.includes('auth.html')) {
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) {
      window.location.href = 'auth.html';
    } else {
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.style.display = 'inline-block';
        logoutBtn.addEventListener('click', async () => {
          await supabase.auth.signOut();
          window.location.href = 'auth.html';
        });
      }
    }
  });
}

// Handle sign up with role selection (e.g., from auth.html form)
const signUpForm = document.getElementById('signup-form');
if (signUpForm) {
  signUpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const role = document.querySelector('input[name="role"]:checked')?.value || 'customer';

   const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: ' https://lucascourson.github.io/Courier/', // ✅ Replace with your hosted URL later
    data: { role }
  }
});


    if (error) {
      alert('Sign up error: ' + error.message);
    } else {
      alert('Check your email to complete sign up.');
    }
  });
}


// Handle login form
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      alert('Login error: ' + error.message);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const role = user?.user_metadata?.role;
      if (role === 'courier') {
        window.location.href = 'courier.html';
      } else {
        window.location.href = 'index.html';
      }
    }
  });
}


async function loadRequests() {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  const role = user?.user_metadata?.role;

  let query = supabase.from('requests').select('*').order('created_at', { ascending: false });
  if (role !== 'courier') {
    query = query.eq('user_id', userId);
  }

  const { data: requests, error } = await query;

  if (error) {
    console.error('Error loading requests:', error);
    return;
  }

  const listContainer = document.getElementById('requestList');
  const inProgressContainer = document.getElementById('inProgressList');
  listContainer.innerHTML = '';
  inProgressContainer.innerHTML = '';

  const now = new Date();

  for (const req of requests) {
    const createdAt = new Date(req.created_at);
    const hoursOld = (now - createdAt) / (1000 * 60 * 60);

    if (hoursOld > 24) {
      await supabase.from('requests').delete().eq('id', req.id);
      continue;
    }

    const item = document.createElement('div');
    item.className = 'request-item';
    item.innerHTML = `
      <strong>Pickup:</strong> ${req.pickup}<br>
      <strong>Dropoff:</strong> ${req.dropoff}<br>
      <strong>Phone:</strong> ${req.phone || 'N/A'}<br>
      <strong>Description:</strong> ${req.description}<br>
      <strong>Status:</strong> ${req.status}<br>
      <small>Submitted ${new Date(req.created_at).toLocaleString()}</small><br>
    `;

    if (req.status === 'pending') {
      if (role === 'courier') {
        const acceptButton = document.createElement('button');
        acceptButton.textContent = 'Accept';
        acceptButton.addEventListener('click', () => updateToInProgress(req.id, acceptButton));
        item.appendChild(acceptButton);
      }
      listContainer.appendChild(item);
    }

    if (req.status === 'in-progress') {
      item.style.opacity = '0.6';
      item.style.pointerEvents = 'none';

      const completeButton = document.createElement('button');
      completeButton.textContent = 'Complete';
      completeButton.addEventListener('click', () => deleteRequest(req.id));
      completeButton.disabled = false;
      completeButton.style.pointerEvents = 'auto';
      completeButton.style.opacity = '1';
      item.appendChild(completeButton);
      inProgressContainer.appendChild(item);
    }

    const hr = document.createElement('hr');
    item.appendChild(hr);
  }
}

if (document.getElementById('requestList') || document.getElementById('inProgressList')) {
  window.addEventListener('DOMContentLoaded', loadRequests);
}
