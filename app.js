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

const form = document.getElementById('deliveryForm');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const pickup = document.getElementById('pickup').value.trim();
    const dropoff = document.getElementById('dropoff').value.trim();
    const phone = document.getElementById('phone')?.value.trim() || '';
    const description = document.getElementById('description').value.trim();
    const confirmation = document.getElementById('confirmation');

    confirmation.style.display = 'none';
    confirmation.innerText = '';

    if (!pickup || !dropoff || !description || !phone) {
      confirmation.style.display = 'block';
      confirmation.style.color = 'red';
      confirmation.innerText = 'Please fill out all fields, including your phone number, before submitting.';
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData?.user?.id;

    console.log('user_id:', user_id);


   const { data, error } = await supabase.from('requests').insert([
  {
    pickup,
    dropoff,
    phone,
    description,
    status: 'open',
    customer_id: user_id   
  }
]);



    if (error) {
      console.error('Error submitting request:', error);
      confirmation.style.display = 'block';
      confirmation.style.color = 'red';
      confirmation.innerText = 'Something went wrong: ' + error.message;
      return;
    }

    confirmation.style.display = 'block';
    confirmation.style.color = 'green';
    confirmation.innerText =
      `Thanks! Your request to deliver "${description}" from ${pickup} to ${dropoff} has been submitted.`;

    form.reset();
    loadRequests();
  });
}

const listContainer = document.getElementById('requestList');
const inProgressContainer = document.getElementById('inProgressList');

if (listContainer || inProgressContainer) {
  window.addEventListener('DOMContentLoaded', loadRequests);
}

function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  const intervals = [
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
    { label: 'second', seconds: 1 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count !== 1 ? 's' : ''} ago`;
    }
  }
  return 'just now';
}

async function updateToInProgress(id, button) {
  try {
    const { data: session, error: sessionError } = await supabase.auth.getUser();
    if (sessionError) throw sessionError;

    const user = session?.user;
    if (!user) throw new Error('No user logged in');

    

    const { data, error } = await supabase
      .from('requests')
      .update({
        status: 'in_progress',
        courier_id: user.id
      })
      .eq('id', id)
      .eq('status', 'open');

    if (error) throw error;

    button.disabled = true;
    button.textContent = 'In Progress';
    button.style.backgroundColor = '#ccc';
    loadRequests();
  } catch (err) {
    console.error('Update failed:', err);
    alert('Something went wrong: ' + err.message);
  }
}

async function deleteRequest(id) {
  const item = document.getElementById(`request-${id}`);
  if (item) item.remove(); // Immediately remove from UI

  const { error } = await supabase
    .from('requests')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting request:', error);
    alert('Failed to delete request.');
    loadRequests(); // fallback
  }
}




async function loadRequests() {
  const { data: session } = await supabase.auth.getUser();
  const user = session?.user;
  const userId = user?.id;
  const role = user?.user_metadata?.role;
  

 let query = supabase.from('requests').select('*').order('created_at', { ascending: false });
 

if (role !== 'courier') {
  query = query.eq('customer_id', userId); // ✅ correct
}

const { data: requests, error } = await query;


  if (error) {
    console.error('Error loading requests:', error);
    return;
  }

  if (listContainer) listContainer.innerHTML = '';
  if (inProgressContainer) inProgressContainer.innerHTML = '';

  const now = new Date();

  for (const req of requests) {
    const createdAt = new Date(req.created_at);
    const hoursOld = (now - createdAt) / (1000 * 60 * 60);

    if (hoursOld > 24) {
      await supabase.from('requests').delete().eq('id', req.id);
      continue;
    }

    const timeAgo = formatTimeAgo(createdAt);

    const item = document.createElement('div');
    item.className = 'request-item';
    item.id = `request-${req.id}`;
    item.innerHTML = `
      <strong>Pickup:</strong> ${req.pickup}<br>
      <strong>Dropoff:</strong> ${req.dropoff}<br>
      <strong>Phone:</strong> ${req.phone || 'N/A'}<br>
      <strong>Description:</strong> ${req.description}<br>
      <strong>Status:</strong> ${req.status}<br>
      <small>Submitted ${timeAgo}</small><br>
    `;

    if (req.status === 'open') {
      if (role === 'courier') {
        const acceptButton = document.createElement('button');
        acceptButton.textContent = 'Accept';
        acceptButton.addEventListener('click', () => updateToInProgress(req.id, acceptButton));
        item.appendChild(acceptButton);
      }
      if (listContainer) listContainer.appendChild(item);
    }
    

  if (req.status === 'in_progress') {
  item.style.opacity = '0.6';
  item.style.pointerEvents = 'none';

  if (role === 'courier') {
    const completeButton = document.createElement('button');
    completeButton.textContent = 'Complete';
    completeButton.addEventListener('click', () => completeRequest(req.id));

    completeButton.disabled = false;
    completeButton.style.pointerEvents = 'auto';
    completeButton.style.opacity = '1';
    item.appendChild(completeButton);
  }

  if (inProgressContainer) inProgressContainer.appendChild(item);
}



    const hr = document.createElement('hr');
    item.appendChild(hr);
  }
}
const navLink = document.getElementById('navButton');
const navBtn = document.getElementById('navBtnLabel');

if (navLink && navBtn) {
  supabase.auth.getUser().then(({ data: { user } }) => {
    const role = user?.user_metadata?.role;
    if (role === 'courier') {
      navLink.href = 'courier.html';
      navBtn.textContent = 'Go to Courier Dashboard';
    } else {
      navLink.href = 'requests.html';
      navBtn.textContent = 'See Available Requests';
    }
  });
}

window.completeRequest = async function(id) {
  console.log("🗑️ Attempting to delete request ID:", id);

  try {
    // Try to remove the item visually first (optional)
    const item = document.getElementById(`request-${id}`);
    if (item) item.remove();

    const { error } = await supabase
      .from('requests')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Error deleting request from Supabase:', error);
      alert('Failed to delete request.');
    } else {
     
      loadRequests(); // Refresh the UI
    }
  } catch (err) {
    console.error('🔥 Fatal error in completeRequest:', err);
    alert('Something went wrong.');
  }
};




