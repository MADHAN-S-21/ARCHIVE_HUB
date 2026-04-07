document.addEventListener('DOMContentLoaded', () => {
    const createUserForm = document.getElementById('create-user-form');
    const submitBtn = document.getElementById('submit-btn');

    if (createUserForm) {
        createUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(createUserForm);
            const userData = Object.fromEntries(formData.entries());

            // Clear irrelevant fields before submitting
            if (userData.role === 'STUDENT') {
                delete userData.facultyId;
            } else if (userData.role === 'FACULTY') {
                delete userData.rollNumber;
                delete userData.department;
            } else {
                delete userData.facultyId;
                delete userData.rollNumber;
                delete userData.department;
            }

            try {
                // Disable button and show loading
                submitBtn.disabled = true;
                const originalContent = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> <span>Creating...</span>';

                const currentUser = JSON.parse(localStorage.getItem('user'));
                if (!currentUser || !currentUser.id) {
                    throw new Error('Not authenticated');
                }

                // Use the existing API structure (fetching from main.js/api.js logic)
                const response = await fetch(`/api/users?requesterId=${currentUser.id}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(userData)
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to create user');
                }

                // Show success and redirect
                alert('User created successfully!');
                window.location.href = 'admin.html';
            } catch (err) {
                alert(err.message);
                console.error(err);

                // Reset button
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="ri-user-add-line"></i> <span>Create User</span>';
            }
        });
    }

    // Auto-fill username from email if empty
    const emailInput = document.getElementById('email');
    const usernameInput = document.getElementById('username');

    if (emailInput && usernameInput) {
        emailInput.addEventListener('input', () => {
            if (!usernameInput.value || usernameInput.dataset.autoFilled === 'true') {
                const prefix = emailInput.value.split('@')[0];
                usernameInput.value = prefix;
                usernameInput.dataset.autoFilled = 'true';
            }
        });

        usernameInput.addEventListener('input', () => {
            usernameInput.dataset.autoFilled = 'false';
        });
    }

    // Toggle fields based on role
    const roleSelect = document.getElementById('role');
    const studentFields = document.getElementById('student-fields');
    const facultyFields = document.getElementById('faculty-fields');

    if (roleSelect) {
        roleSelect.addEventListener('change', () => {
            const role = roleSelect.value;
            if (role === 'STUDENT') {
                studentFields.style.display = 'block';
                facultyFields.style.display = 'none';
            } else if (role === 'FACULTY') {
                studentFields.style.display = 'none';
                facultyFields.style.display = 'block';
            } else {
                studentFields.style.display = 'none';
                facultyFields.style.display = 'none';
            }
        });
    }
});
