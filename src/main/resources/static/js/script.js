document.addEventListener('DOMContentLoaded', () => {
    // --- Navigation Logic ---
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-link');

    // Remove 'active' from all links first to avoid duplicates
    navLinks.forEach(link => link.classList.remove('active'));

    navLinks.forEach(link => {
        const linkHref = link.getAttribute('href');
        // Check if the link matches current path
        if (linkHref === currentPath) {
            link.classList.add('active');
        }
    });

    // --- Theme Toggler ---
    const themeBtn = document.querySelector('.ri-moon-line')?.parentElement;
    const body = document.body;

    // Check saved theme
    if (localStorage.getItem('theme') === 'dark') {
        body.classList.add('dark-mode');
        updateThemeIcon();
    }

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            const isDark = body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateThemeIcon();
        });
    }

    function updateThemeIcon() {
        const icon = themeBtn?.querySelector('i');
        if (icon) {
            if (body.classList.contains('dark-mode')) {
                icon.classList.remove('ri-moon-line');
                icon.classList.add('ri-sun-line');
            } else {
                icon.classList.remove('ri-sun-line');
                icon.classList.add('ri-moon-line');
            }
        }
    }

    // --- Visual Feedback ---
    // Search bar interaction
    const searchInputs = document.querySelectorAll('input[type="text"]');
    searchInputs.forEach(input => {
        input.addEventListener('focus', () => {
            if (body.classList.contains('dark-mode')) {
                input.parentElement.style.boxShadow = '0 0 0 2px rgba(96, 165, 250, 0.4)';
                // Maintain dark bg
            } else {
                input.parentElement.style.boxShadow = '0 0 0 2px rgba(37, 99, 235, 0.2)';
                input.parentElement.style.background = '#ffffff';
            }
        });

        input.addEventListener('blur', () => {
            input.parentElement.style.boxShadow = 'none';
            if (!body.classList.contains('dark-mode')) {
                input.parentElement.style.background = '#f1f5f9';
            }
        });
    });

    // File cards interaction (Event Delegation for dynamic items)
    document.addEventListener('click', (e) => {
        const card = e.target.closest('.file-card');
        if (card && !e.target.closest('.icon-btn')) {
            // Toggle selection visual
            const isSelected = card.style.borderColor === 'var(--primary-color)';
            // Reset others
            document.querySelectorAll('.file-card').forEach(c => c.style.borderColor = '');

            if (!isSelected) {
                card.style.borderColor = 'var(--primary-color)';
            }
        }
    });

    // --- Notification Logic ---
    const notificationBtn = document.querySelector('.ri-notification-3-line')?.parentElement;
    if (notificationBtn) {
        // Add badge
        const badge = document.createElement('span');
        badge.className = 'notification-badge';
        notificationBtn.appendChild(badge);

        // Check if admin to show badge for pending requests
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        if (user && (user.role === 'ADMIN' || user.email === 'admin@gmail.com')) {
            // For demo/simplicity, we just show the badge. 
            // In a real app, we'd fetch the count.
            badge.classList.add('active');
        }

        // Create Dropdown if not exists
        let dropdown = document.querySelector('.notifications-dropdown');
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'notifications-dropdown';
            dropdown.innerHTML = `
                <div class="notifications-header">
                    <h3>Notifications</h3>
                    <button class="icon-btn" style="width: 32px; height: 32px; border: none; background: transparent;" onclick="this.closest('.notifications-dropdown').classList.remove('active')">
                        <i class="ri-close-line"></i>
                    </button>
                </div>
                <div class="notifications-list">
                    <div class="no-notifications">
                        <i class="ri-notification-off-line"></i>
                        <p>No new notifications</p>
                    </div>
                </div>
            `;
            document.querySelector('.header-actions')?.appendChild(dropdown);
        }

        const renderNotifications = async () => {
            const list = dropdown.querySelector('.notifications-list');
            list.innerHTML = '<div style="padding: 2rem; text-align: center;"><i class="ri-loader-4-line ri-spin" style="font-size: 1.5rem;"></i></div>';

            try {
                let notifications = [];
                if (user && (user.role === 'ADMIN' || user.email === 'admin@gmail.com')) {
                    const requests = await api.getPendingRequests(user.id);
                    notifications = requests.map(req => ({
                        title: 'New Registration Request',
                        message: `${req.fullname || req.username} is waiting for approval.`,
                        time: new Date(req.requestedAt || Date.now()).toLocaleTimeString(),
                        icon: 'ri-user-add-line',
                        link: 'approvals.html'
                    }));
                } else if (user && (user.role === 'FACULTY' || user.email?.endsWith('@faculty.gmail.com'))) {
                    const files = await api.getFiles();
                    notifications = (files || []).slice(0, 8).map(file => {
                        const uploaderName = file.ownerName || 'A student';
                        return {
                            title: 'New Student Upload',
                            message: `<b>${uploaderName}</b> uploaded ${file.name}`,
                            time: new Date(file.uploadDate).toLocaleTimeString(),
                            icon: 'ri-file-list-3-line',
                            link: 'files.html'
                        };
                    });
                } else {
                    const files = await api.getFiles();
                    notifications = (files || []).slice(0, 5).map(file => ({
                        title: 'File Uploaded',
                        message: `You uploaded ${file.name}`,
                        time: new Date(file.uploadDate).toLocaleTimeString(),
                        icon: 'ri-file-upload-line',
                        link: 'files.html'
                    }));

                    // Add academic stats notification if updated recently
                    if (user && user.academicStatsLastUpdated) {
                        notifications.unshift({
                            title: 'Academic Stats Updated',
                            message: 'Your CGPA, SGPA, or Attendance has been updated by faculty.',
                            time: new Date(user.academicStatsLastUpdated).toLocaleDateString(),
                            icon: 'ri-line-chart-line',
                            link: 'profile.html'
                        });
                    }
                }

                if (notifications.length === 0) {
                    list.innerHTML = `
                        <div class="no-notifications">
                            <i class="ri-notification-off-line"></i>
                            <p>No new updates</p>
                        </div>
                    `;
                } else {
                    list.innerHTML = notifications.map(n => `
                        <div class="notification-item" onclick="window.location.href='${n.link}'">
                            <div class="notification-icon">
                                <i class="${n.icon}"></i>
                            </div>
                            <div class="notification-content">
                                <h4>${n.title}</h4>
                                <p>${n.message}</p>
                                <span class="notification-time">${n.time}</span>
                            </div>
                        </div>
                    `).join('');
                }
            } catch (err) {
                console.error('Failed to load notifications:', err);
                list.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--danger);">Failed to load updates.</div>';
            }
        };

        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasActive = dropdown.classList.contains('active');
            dropdown.classList.toggle('active');
            
            if (!wasActive) {
                renderNotifications();
                badge.classList.remove('active');
            }
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== notificationBtn) {
                dropdown.classList.remove('active');
            }
        });
    }
});
