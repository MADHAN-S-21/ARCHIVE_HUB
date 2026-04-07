document.addEventListener('DOMContentLoaded', () => {
    // --- Login Logic ---
    const loginForm = document.getElementById('login-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;

            if (!emailInput.value || !passwordInput.value) {
                alert('Please fill in all fields');
                return;
            }

            try {
                // "Directly login to dashboard"
                submitBtn.innerText = 'Redirecting...';
                submitBtn.disabled = true;

                await api.login(emailInput.value, passwordInput.value);
                window.location.href = 'index.html';
            } catch (error) {
                console.error(error);
                alert(error.message || 'Login failed: Invalid credentials');
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }

});
