document.addEventListener('DOMContentLoaded', () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
        window.location.href = 'login.html';
        return;
    }
    let user = JSON.parse(userStr);
    loadProfile(user);

    const saveBtn = document.getElementById('save-profile-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            try {
                saveBtn.disabled = true;
                const originalText = saveBtn.textContent;
                saveBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Saving...';

                const fname = document.getElementById('profile-firstname').value.trim();
                const lname = document.getElementById('profile-lastname').value.trim();
                const newFullname = (fname + ' ' + lname).trim();

                const updates = {
                    firstname: fname,
                    lastname: lname,
                    bio: document.getElementById('profile-bio').value
                };
                if (newFullname) {
                    updates.fullname = newFullname;
                }

                await api.updateUser(user.id, updates);
                alert('Profile updated successfully!');
                
                user = JSON.parse(localStorage.getItem('user')); // Refresh user
                
                // Update UI immediately
                if (updates.fullname) {
                    document.querySelectorAll('.user-info h4').forEach(el => el.textContent = updates.fullname);
                    const initText = updates.fullname.substring(0, 2).toUpperCase();
                    document.querySelectorAll('.user-avatar').forEach(el => {
                        if (!user.profilePhotoUrl) {
                            el.innerHTML = `${initText}<span class="online-dot"></span>`;
                        }
                    });
                }
            } catch (e) {
                console.error('Failed to update profile:', e);
                alert('Failed to update profile: ' + e.message);
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Changes';
            }
        });
    }
});

async function loadProfile(user) {
    try {
        const profile = await api.getUserProfile(user.id, user.id);
        // Populate common fields
        let fname = profile.firstname;
        let lname = profile.lastname;

        if (!fname && !lname && profile.fullname) {
            const parts = profile.fullname.split(' ');
            fname = parts.shift();
            lname = parts.join(' ');
        }

        document.getElementById('profile-firstname').value = fname || '';
        document.getElementById('profile-lastname').value = lname || '';
        document.getElementById('profile-email').value = profile.email || '';
        document.getElementById('profile-bio').value = profile.bio || '';
        const studentSection = document.getElementById('student-fields');
        const facultySection = document.getElementById('faculty-fields');

        function setReadOnly(elementId) {
            const el = document.getElementById(elementId);
            if (el) {
                el.setAttribute('readonly', 'true');
                el.style.color = 'var(--text-muted)';
                el.style.cursor = 'not-allowed';
                el.style.backgroundColor = 'var(--surface-color)';
            }
        }

        if (profile.role === 'STUDENT') {
            studentSection.style.display = 'grid';
            facultySection.style.display = 'none';
            document.getElementById('profile-rollnumber').value = profile.rollNumber || '';
            document.getElementById('profile-department').value = profile.department || '';
            setReadOnly('profile-rollnumber');
            setReadOnly('profile-department');
        } else if (profile.role === 'FACULTY') {
            facultySection.style.display = 'grid';
            studentSection.style.display = 'none';
            document.getElementById('profile-facultyid').value = profile.facultyId || '';
            setReadOnly('profile-facultyid');
        } else {
            studentSection.style.display = 'none';
            facultySection.style.display = 'none';
        }
    } catch (e) {
        console.error('Failed to load profile:', e);
        alert('Unable to load profile information.');
    }
}
