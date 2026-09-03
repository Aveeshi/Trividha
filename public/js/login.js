let mode = 'login';
const $ = id => document.getElementById(id);

document.querySelectorAll('.eye-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = $(btn.dataset.target);
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    btn.querySelector('.eye-open').style.display = showing ? '' : 'none';
    btn.querySelector('.eye-closed').style.display = showing ? 'none' : '';
    btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  });
});

function setMode(next){
  mode = next;
  const isSignup = mode === 'signup';
  $('modeLoginBtn').classList.toggle('active', !isSignup);
  $('modeSignupBtn').classList.toggle('active', isSignup);
  $('fieldHospitalName').style.display = isSignup ? '' : 'none';
  $('passwordHint').style.display = isSignup ? '' : 'none';
  $('forgotRow').style.display = isSignup ? 'none' : 'flex';
  $('formTitle').textContent = isSignup ? 'Create your hospital account' : 'Sign in to your hospital';
  $('formLead').textContent = isSignup
    ? 'Set up your hospital once — then add doctors and kiosks in minutes.'
    : 'Manage doctors and kiosks for your hospital.';
  $('submitLabel').textContent = isSignup ? 'Create account' : 'Sign in';
  $('formFoot').innerHTML = isSignup
    ? 'Already registered? <a id="footLink">Sign in instead</a>'
    : 'New to Trividha? <a id="footLink">Create a hospital account</a>';
  $('footLink').addEventListener('click', () => setMode(isSignup ? 'login' : 'signup'));
  hideAlert();
}

function showAlert(msg){ const a = $('formAlert'); a.textContent = msg; a.className = 'alert show'; }
function hideAlert(){ $('formAlert').classList.remove('show'); }

function isGmail(email){
  const parts = String(email||'').toLowerCase().trim().split('@');
  return parts.length === 2 && (parts[1] === 'gmail.com' || parts[1] === 'googlemail.com');
}

$('modeLoginBtn').addEventListener('click', () => setMode('login'));
$('modeSignupBtn').addEventListener('click', () => setMode('signup'));
$('footLink').addEventListener('click', () => setMode('signup'));

$('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();
  const email = $('email').value.trim();
  const password = $('password').value;

  if (!email || !password){ showAlert('Please fill in email and password.'); return; }
  if (!isGmail(email)){ showAlert('Please use a Gmail address (must end with @gmail.com).'); return; }
  if (mode === 'signup' && !$('hospitalName').value.trim()){ showAlert('Please enter your hospital name.'); return; }

  $('submitBtn').disabled = true;
  $('spinner').classList.add('show');

  try {
    const url = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
    const body = mode === 'signup'
      ? { hospitalName: $('hospitalName').value.trim(), email, password }
      : { email, password };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await resp.json();

    if (!resp.ok){ showAlert(data.error || 'Something went wrong. Please try again.'); return; }
    window.location.href = '/dashboard';
  } catch (err) {
    showAlert('Could not reach the server. Please check your connection.');
  } finally {
    $('submitBtn').disabled = false;
    $('spinner').classList.remove('show');
  }
});

function showForgotAlert(msg, ok){ const a = $('forgotAlert'); a.textContent = msg; a.className = 'alert show' + (ok ? ' ok' : ''); }
function hideForgotAlert(){ $('forgotAlert').classList.remove('show'); }

function openForgot(){
  $('authView').style.display = 'none';
  $('forgotView').style.display = '';
  $('forgotEmailForm').style.display = '';
  $('forgotResetForm').style.display = 'none';
  $('forgotEmail').value = $('email').value.trim();
  hideForgotAlert();
}
function closeForgot(){
  $('forgotView').style.display = 'none';
  $('authView').style.display = '';
}
$('forgotLink').addEventListener('click', openForgot);
$('backToSignInLink').addEventListener('click', closeForgot);

let forgotEmailValue = '';

$('forgotEmailForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideForgotAlert();
  const email = $('forgotEmail').value.trim();
  if (!email){ showForgotAlert('Please enter your email.'); return; }
  if (!isGmail(email)){ showForgotAlert('Please use a Gmail address (must end with @gmail.com).'); return; }

  $('forgotEmailBtn').disabled = true;
  $('forgotEmailSpinner').classList.add('show');
  try {
    const resp = await fetch('/api/auth/forgot', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
    });
    const data = await resp.json();
    if (!resp.ok){ showForgotAlert(data.error || 'Could not send the code.'); return; }
    forgotEmailValue = email;
    showForgotAlert('Code sent — check your inbox.', true);
    $('forgotTitle').textContent = 'Enter the code we emailed you';
    $('forgotLead').textContent = `Sent to ${email}. It expires in 10 minutes.`;
    $('forgotEmailForm').style.display = 'none';
    $('forgotResetForm').style.display = '';
  } catch (err) {
    showForgotAlert('Could not reach the server. Please check your connection.');
  } finally {
    $('forgotEmailBtn').disabled = false;
    $('forgotEmailSpinner').classList.remove('show');
  }
});

$('forgotResetForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideForgotAlert();
  const otp = $('forgotOtp').value.trim();
  const newPassword = $('forgotNewPassword').value;
  if (!otp || !newPassword){ showForgotAlert('Please enter the code and a new password.'); return; }

  $('forgotResetBtn').disabled = true;
  $('forgotResetSpinner').classList.add('show');
  try {
    const resp = await fetch('/api/auth/reset', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotEmailValue, otp, newPassword })
    });
    const data = await resp.json();
    if (!resp.ok){ showForgotAlert(data.error || 'Could not reset your password.'); return; }
    showForgotAlert('Password reset. You can sign in now.', true);
    setTimeout(() => { closeForgot(); setMode('login'); $('email').value = forgotEmailValue; }, 1200);
  } catch (err) {
    showForgotAlert('Could not reach the server. Please check your connection.');
  } finally {
    $('forgotResetBtn').disabled = false;
    $('forgotResetSpinner').classList.remove('show');
  }
});

fetch('/api/auth/me').then(r => { if (r.ok) window.location.href = '/dashboard'; }).catch(()=>{});
