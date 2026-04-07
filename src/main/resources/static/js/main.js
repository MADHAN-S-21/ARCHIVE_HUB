document.addEventListener('DOMContentLoaded', () => {
    // 1. Check Auth
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    if (!token || !user || !user.id) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('signup.html')) {
            window.location.href = 'login.html';
        }
        return;
    }

    // 2. Update UI with User Info
    updateUserInfo(user);

    const isAdmin = user.role === 'ADMIN' || user.email === 'admin@gmail.com';
    const isFaculty = user.role === 'FACULTY' || user.email?.endsWith('@faculty.gmail.com');

    const currentPath = window.location.pathname.split('/').pop() || 'index.html';

    const dashboardLink = document.querySelector('a[href="index.html"]');
    const adminLink = document.querySelector('a[href="admin.html"]');
    const approvalsLink = document.querySelector('a[href="approvals.html"]');
    const myFilesLink = document.querySelector('a[href="files.html"]');
    const collectionsLink = document.querySelector('a[href="collections.html"]');
    const uploadBtn = document.querySelector('a[href="new-entry.html"]');
    const createCollectionBtn = document.querySelector('button[onclick="openCreateCollectionModal()"]');

    if (isAdmin) {
        dashboardLink?.closest('.nav-item')?.style.setProperty('display', 'none', 'important');
        // Admins should only manage the website (Admin Panel & Approvals)
        // Hide personal archive sections
        myFilesLink?.closest('.nav-item')?.style.setProperty('display', 'none', 'important');
        collectionsLink?.closest('.nav-item')?.style.setProperty('display', 'none', 'important');
        uploadBtn?.style.setProperty('display', 'none', 'important');
        createCollectionBtn?.style.setProperty('display', 'none', 'important');

        // Ensure Admin and Approvals links are visible
        adminLink?.closest('.nav-item')?.style.setProperty('display', 'block', 'important');
        approvalsLink?.closest('.nav-item')?.style.setProperty('display', 'block', 'important');

        const dashAddUserBtn = document.getElementById('dash-add-user-btn');
        if (dashAddUserBtn) dashAddUserBtn.style.display = 'flex';
    } else {
        // Non-admins shouldn't see Admin and Approvals links
        adminLink?.closest('.nav-item')?.style.setProperty('display', 'none', 'important');
        approvalsLink?.closest('.nav-item')?.style.setProperty('display', 'none', 'important');

        // Faculty can view but NOT upload or create collections
        if (isFaculty) {
            document.querySelectorAll('.faculty-only').forEach(el => el.style.setProperty('display', 'block', 'important'));
            uploadBtn?.style.setProperty('display', 'none', 'important');
            createCollectionBtn?.style.setProperty('display', 'none', 'important');
            // Rename "Collections" to "Student Dashboard" for Faculty
            const collectionsSpan = collectionsLink?.querySelector('span');
            if (collectionsSpan) collectionsSpan.textContent = 'Student Dashboard';

            // Hide My Files ("Individual Student") for Faculty
            myFilesLink?.closest('.nav-item')?.style.setProperty('display', 'none', 'important');

            // Also update page title if on collections.html
            if (currentPath === 'collections.html') {
                const pageTitle = document.querySelector('.page-title h1');
                const pageDesc = document.querySelector('.page-title p');
                if (pageTitle) pageTitle.textContent = 'Student Dashboard';
                if (pageDesc) pageDesc.textContent = 'View and manage student archival collections.';
            }

            // Also update page title if on files.html
            if (currentPath === 'files.html') {
                const pageTitle = document.getElementById('folder-name');
                const pageDesc = document.getElementById('folder-description');
                if (pageTitle && pageTitle.textContent === 'My Files') pageTitle.textContent = 'Individual Student';
                if (pageDesc && pageDesc.textContent.includes('Manage, organize')) pageDesc.textContent = 'View and manage individual student records and archives.';
            }

            // Rename back button if it exists (e.g. in files.html)
            const backToCollections = document.getElementById('back-to-collections');
            if (backToCollections) {
                const backLink = backToCollections.querySelector('a');
                if (backLink) {
                    backLink.innerHTML = '<i class="ri-arrow-left-line"></i> Back to Student Dashboard';
                }
            }
        } else {
            // Ensure personal sections are visible for regular Students/staff
            myFilesLink?.closest('.nav-item')?.style.setProperty('display', 'none', 'important');
        }

        collectionsLink?.closest('.nav-item')?.style.setProperty('display', 'block', 'important');
    }

    // Hide academic metrics for non-students
    if (isAdmin || isFaculty) {
        document.getElementById('stat-cgpa')?.closest('.stat-card')?.style.setProperty('display', 'none', 'important');
        document.getElementById('stat-attendance')?.closest('.stat-card')?.style.setProperty('display', 'none', 'important');
        document.querySelector('.sgpa-chart-section')?.style.setProperty('display', 'none', 'important');
    }

    // Admins cannot see data uploaded by student/faculty
    if (isAdmin) {
        document.querySelector('.recent-activity')?.style.setProperty('display', 'none', 'important');
    }

    // 3. Load Data based on page

    // Redirect logic
    if (currentPath === 'index.html' && isAdmin) {
        window.location.href = 'admin.html';
        return;
    }

    if ((currentPath === 'admin.html' || currentPath === 'approvals.html') && !isAdmin) {
        window.location.href = 'index.html';
        return;
    }

    if ((currentPath === 'files.html' || currentPath === 'collections.html' || currentPath === 'new-entry.html') && isAdmin) {
        // Admins restricted from these pages
        window.location.href = 'admin.html';
        return;
    }

    if (currentPath === 'index.html' || currentPath === 'files.html') {
        loadFiles();
    } else if (currentPath === 'collections.html') {
        loadCollections();
    } else if (currentPath === 'profile.html') {
        // loadProfile(user); // Profile loading handled by profile.js
    } else if (currentPath === 'admin.html') {
        loadUsers();
    } else if (currentPath === 'approvals.html') {
        loadPendingRequests();
    } else if (currentPath === 'faculty-stats.html') {
        if (!isFaculty) {
            window.location.href = 'index.html';
        } else {
            loadStudentsForStats();
        }
    } else if (currentPath === 'faculty-docs.html') {
        if (!isFaculty) {
            window.location.href = 'index.html';
        } else {
            loadPersonalDocuments();
        }
    }

    // --- Logout Logic ---
    // Assuming there's a logout button, or we can add one.
    setupLogout();

    if (window.location.pathname.includes('new-entry.html')) {
        setupUpload();
    }
    function updateUserInfo(user) {
        const userNames = document.querySelectorAll('.user-info h4');
        const userEmails = document.querySelectorAll('.user-info p');
        const userAvatars = document.querySelectorAll('.user-avatar');

        userNames.forEach(el => el.textContent = user.fullname || user.username);
        userEmails.forEach(el => el.textContent = user.email);
        userAvatars.forEach(el => {
            if (user.profilePhotoUrl) {
                el.style.backgroundImage = `url(${user.profilePhotoUrl})`;
                el.style.backgroundSize = 'cover';
                el.style.backgroundPosition = 'center';
                el.innerHTML = '<span class="online-dot"></span>';
            } else {
                el.style.backgroundImage = '';
                const name = user.fullname || user.username;
                el.innerHTML = `${name.substring(0, 2).toUpperCase()}<span class="online-dot"></span>`;
            }
        });

        // Also update header welcome message in index.html if exists
        const welcomeMsg = document.querySelector('.page-title p');
        if (welcomeMsg && welcomeMsg.textContent.includes('Welcome back')) {
            welcomeMsg.textContent = `Welcome back, ${user.fullname || user.username}. Here's your archival summary.`;
        }
    }

    function setupLogout() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to sign out?')) {
                    logoutBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Signing out...';
                    await api.logout();
                    window.location.replace('login.html');
                }
            });
        }
    }

    function normalizeSearchText(value) {
        return (value || '').toString().trim().toLowerCase();
    }

    function applyElementFilter(elements, query) {
        const normalizedQuery = normalizeSearchText(query);
        let visibleCount = 0;

        elements.forEach((element) => {
            const haystack = normalizeSearchText(element.dataset.searchText || element.textContent);
            const isMatch = !normalizedQuery || haystack.includes(normalizedQuery);
            element.style.display = isMatch ? '' : 'none';
            if (isMatch) visibleCount++;
        });

        return visibleCount;
    }

    async function loadFiles() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const collectionId = urlParams.get('collectionId');

            const files = await api.getFiles(collectionId);

            const folderNameEl = document.getElementById('folder-name');
            const folderDescEl = document.getElementById('folder-description');
            const backBtn = document.getElementById('back-to-collections');
            const uploadLink = document.getElementById('upload-link-context');

            // Handle Folder Context UI
            if (collectionId) {
                if (backBtn) backBtn.style.display = 'block';
                if (uploadLink) uploadLink.href = `new-entry.html?collectionId=${collectionId}`;

                // Get collection details to show name
                try {
                    const collections = await api.getCollections();
                    const currentCollection = collections.find(c => c.id == collectionId);
                    if (currentCollection) {
                        if (folderNameEl) folderNameEl.textContent = currentCollection.name;
                        if (folderDescEl) folderDescEl.textContent = currentCollection.description || 'No description';
                    }
                } catch (e) {
                    console.error('Failed to load collection details', e);
                }
            }

            // Handle Table View (e.g., index.html)
            const fileTableBody = document.querySelector('.data-table tbody');
            if (fileTableBody) {
                // Update Stats if on Dashboard
                await updateStats(files);

                fileTableBody.innerHTML = '';
                if (files.length === 0) {
                    fileTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No files found.</td></tr>';
                } else {
                    // Limit to 5 recent files for dashboard
                    const recentFiles = files.slice(0, 5);
                    recentFiles.forEach(file => {
                        const isOwner = file.ownerId === user.id;
                        const canManage = isOwner || user.role === 'ADMIN';
                        const row = document.createElement('tr');
                        row.dataset.searchText = `${file.name} ${getPrettyFileType(file.type)} ${file.ownerName || ''}`;
                        // Columns: Name, Status, Size, Date, Action
                        row.innerHTML = `
                        <td>
                            <div class="file-cell">
                                <div class="file-icon ${getFileIconClass(file.type)}">
                                    <i class="${getFileIcon(file.type)}"></i>
                                </div>
                                <div class="file-info">
                                    <span>${file.name}</span>
                                    <span class="file-meta">${getPrettyFileType(file.type)}</span>
                                </div>
                            </div>
                        </td>
                        <td><span class="status-badge status-active">Synced</span></td>
                        <td>${formatSize(file.size)}</td>
                        <td>${new Date(file.uploadDate).toLocaleDateString()}</td>
                        <td>
                            <div class="action-buttons">
                                <a href="${file.url}" download class="icon-btn" title="Download"><i class="ri-download-line"></i></a>
                                ${canManage ? `
                                <button class="icon-btn" onclick="renameFile(${file.id}, '${file.name}')" title="Rename"><i class="ri-edit-line"></i></button>
                                <button class="icon-btn" onclick="deleteFile(${file.id})" title="Delete"><i class="ri-delete-bin-line"></i></button>
                                ` : ''}
                            </div>
                        </td>
                    `;
                        fileTableBody.appendChild(row);
                    });
                }
            }

            // Handle Grid View (e.g., files.html)
            const fileGrid = document.querySelector('.files-grid');
            if (fileGrid) {
                fileGrid.innerHTML = '';
                if (files.length === 0) {
                    fileGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 2rem;">No files found.</p>';
                } else {
                    files.forEach(file => {
                        const isOwner = file.ownerId === user.id;
                        const canManage = isOwner || user.role === 'ADMIN';
                        const card = document.createElement('div');
                        card.className = 'file-card';
                        card.dataset.searchText = `${file.name} ${getPrettyFileType(file.type)} ${file.ownerName || ''}`;
                        card.innerHTML = `
                        <div class="file-card-icon ${getFileIconClass(file.type)}">
                            <i class="${getFileIcon(file.type)}"></i>
                        </div>
                        <h3 class="file-card-name" style="word-break: break-all;">${file.name}</h3>
                        <div class="file-card-meta">
                            <span>${formatSize(file.size)}</span>
                            <span>•</span>
                            <span>${getPrettyFileType(file.type)}</span>
                        </div>
                        <span class="status-badge status-active" style="position: absolute; top: 1rem; right: 1rem; font-size: 0.6rem;">Synced</span>
                        <div class="file-actions">
                             <a href="${file.url}" target="_blank" class="icon-btn" style="width: 32px; height: 32px;" title="Download"><i class="ri-download-line"></i></a>
                             ${canManage ? `
                            <button class="icon-btn" style="width: 32px; height: 32px;" onclick="renameFile(${file.id}, '${file.name}')" title="Rename"><i class="ri-edit-line"></i></button>
                            <button class="icon-btn" style="width: 32px; height: 32px;" onclick="deleteFile(${file.id})" title="Delete"><i class="ri-delete-bin-line"></i></button>
                            ` : ''}
                        </div>
                    `;
                        fileGrid.appendChild(card);
                    });
                }

                const filesSearchInput = document.querySelector('.filter-bar .search-input-group input');
                if (filesSearchInput) {
                    const runFilesFilter = () => {
                        const cards = Array.from(document.querySelectorAll('.files-grid .file-card'));
                        const visibleCount = applyElementFilter(cards, filesSearchInput.value);
                        const existingEmpty = fileGrid.querySelector('[data-search-empty="true"]');
                        if (existingEmpty) existingEmpty.remove();

                        if (cards.length > 0 && visibleCount === 0 && normalizeSearchText(filesSearchInput.value)) {
                            const empty = document.createElement('p');
                            empty.dataset.searchEmpty = 'true';
                            empty.style.gridColumn = '1/-1';
                            empty.style.textAlign = 'center';
                            empty.style.padding = '2rem';
                            empty.textContent = 'No matching files found.';
                            fileGrid.appendChild(empty);
                        }
                    };

                    filesSearchInput.oninput = runFilesFilter;
                    runFilesFilter();
                }
            }

        } catch (error) {
            console.error('Error loading files:', error);
            const grid = document.querySelector('.files-grid');
            const table = document.querySelector('tbody');
            if (grid) grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 2rem;">Failed to load files: ${error.message}</p>`;
            if (table) table.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #ef4444; padding: 2rem;">Error: ${error.message}</td></tr>`;
        }
    }

    async function deleteFile(id) {
        if (confirm('Are you sure you want to delete this file?')) {
            try {
                await api.deleteFile(id);
                loadFiles(); // Reload
            } catch (e) {
                alert('Failed to delete file');
            }
        }
    }

    async function loadCollections() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            let parentId = urlParams.get('parentId');
            if (parentId === 'root') parentId = null;

            let collections = await api.getCollections();
            const grid = document.querySelector('.collections-grid');
            if (!grid) return;

            // Handle Student Root Collection
            if (!isFaculty && !isAdmin) {
                console.log('Checking root collection for student:', user.id);
                // Use loose equality for IDs to handle string/number mismatch
                const rootCol = collections.find(c => c.ownerId == user.id && !c.parentId);
                console.log('Found root collection:', rootCol);
                
                if (!rootCol) {
                    // Create root for existing student who doesn't have one
                    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 2rem;">Initializing your root archive space...</p>';
                    try {
                        console.log('Auto-creating root collection for student...');
                        const newRoot = await api.createCollection(user.fullname.toUpperCase(), "Default root collection");
                        console.log('Root created:', newRoot);
                        window.location.href = `collections.html?parentId=${newRoot.id}`;
                        return;
                    } catch (e) {
                        console.error("Failed to auto-create root", e);
                        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--danger);">Failed to initialize: ${e.message}</p>`;
                        return;
                    }
                }

                // If on top-level Collections page, force redirect to root collection's view
                if (!parentId) {
                    console.log('Redirecting to root collection view:', rootCol.id);
                    window.location.href = `collections.html?parentId=${rootCol.id}`;
                    return;
                }
            }

            // Filter by parentId
            const filtered = collections.filter(c => {
                if (parentId) return c.parentId == parentId;
                return !c.parentId; // Top level for Faculty
            });

            // Update Page Header / Breadcrumbs
            updateCollectionBreadcrumbs(parentId, collections);

            grid.innerHTML = '';

            if (filtered.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem; background: var(--surface-glass); border-radius: 1.5rem; border: 1px dashed var(--border-glass);">
                        <i class="ri-folder-open-line" style="font-size: 3rem; color: var(--text-secondary); opacity: 0.3;"></i>
                        <p style="margin-top: 1rem; color: var(--text-secondary);">No sub-collections here yet.</p>
                    </div>
                `;
                return;
            }

            filtered.forEach(col => {
                const card = document.createElement('div');
                card.className = 'collection-card';
                card.style.cursor = 'pointer';
                card.dataset.searchText = `${col.name} ${col.description || ''}`;
                
                const isOwner = col.ownerId === user.id;
                const canDelete = isAdmin || isOwner;
                const targetUrl = col.parentId ? `files.html?collectionId=${col.id}` : `collections.html?parentId=${col.id}`;
                const actionText = col.parentId ? 'View Files' : 'Open Folder';

                card.innerHTML = `
                    <div class="collection-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
                        <div class="folder-icon" onclick="event.stopPropagation(); window.location.href='${targetUrl}'" style="width: 54px; height: 54px; background: hsla(228, 88%, 58%, 0.1); border-radius: 1rem; display: flex; align-items: center; justify-content: center; color: var(--primary); font-size: 1.8rem; transition: transform 0.3s var(--transition);">
                            <i class="ri-folder-fill"></i>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="icon-btn" onclick="event.stopPropagation(); window.location.href='files.html?collectionId=${col.id}'" title="View Files"><i class="ri-external-link-line"></i></button>
                            ${canDelete ? `<button class="icon-btn" onclick="event.stopPropagation(); deleteCollection(${col.id})"><i class="ri-delete-bin-line"></i></button>` : ''}
                        </div>
                    </div>
                    <div onclick="window.location.href='${targetUrl}'">
                        <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--text-main);">${col.name}</h3>
                        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1.25rem; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${col.description || 'No description provided.'}</p>
                        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">
                            <span>${new Date(col.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            <span style="background: hsla(var(--p-h), var(--p-s), var(--p-l), 0.1); padding: 0.2rem 0.6rem; border-radius: 2rem; color: var(--primary);">${actionText}</span>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });

            const collectionSearchInput = document.querySelector('.top-header .search-bar input');
            if (collectionSearchInput) {
                const runCollectionFilter = () => {
                    const cards = Array.from(document.querySelectorAll('.collections-grid .collection-card'));
                    const visibleCount = applyElementFilter(cards, collectionSearchInput.value);
                    const existingEmpty = grid.querySelector('[data-search-empty="true"]');
                    if (existingEmpty) existingEmpty.remove();

                    if (cards.length > 0 && visibleCount === 0 && normalizeSearchText(collectionSearchInput.value)) {
                        const empty = document.createElement('div');
                        empty.dataset.searchEmpty = 'true';
                        empty.style.gridColumn = '1/-1';
                        empty.style.textAlign = 'center';
                        empty.style.padding = '2rem';
                        empty.style.color = 'var(--text-secondary)';
                        empty.textContent = 'No matching collections found.';
                        grid.appendChild(empty);
                    }
                };

                collectionSearchInput.oninput = runCollectionFilter;
                runCollectionFilter();
            }
        } catch (error) {
            console.error('Error loading collections:', error);
            const grid = document.querySelector('.collections-grid');
            if (grid) grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 2rem;">Failed to load collections: ${error.message}</p>`;
        }
    }

    function updateCollectionBreadcrumbs(parentId, allCollections) {
        const header = document.querySelector('.page-header');
        if (!header) return;

        let breadcrumbHtml = `<h1 style="font-size: 2rem; font-weight: 800; letter-spacing: -0.04em; margin-bottom: 0.5rem;">Collections</h1>`;
        
        if (parentId) {
            const current = allCollections.find(c => c.id == parentId);
            if (current) {
                breadcrumbHtml = `
                    <div class="breadcrumbs" style="display: flex; align-items: center; gap: 0.75rem; color: var(--text-muted); font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">
                        <a href="collections.html" style="color: var(--primary);">All Collections</a>
                        <i class="ri-arrow-right-s-line"></i>
                        <span style="color: var(--text-main);">${current.name}</span>
                    </div>
                    <h1 style="font-size: 2.2rem; font-weight: 800; letter-spacing: -0.04em;">${current.name}</h1>
                `;
                
                const desc = document.querySelector('.page-title p');
                if (desc) desc.textContent = current.description || 'Sub-collections and folders.';
            }
        }
        
        const titleContainer = header.querySelector('.page-title');
        if (titleContainer) {
            const h1 = titleContainer.querySelector('h1');
            const existingBreadcrumbs = titleContainer.querySelector('.breadcrumbs');
            if (existingBreadcrumbs) existingBreadcrumbs.remove();
            
            if (parentId) {
                const temp = document.createElement('div');
                temp.innerHTML = breadcrumbHtml;
                titleContainer.prepend(temp.querySelector('.breadcrumbs'));
                h1.textContent = allCollections.find(c => c.id == parentId)?.name || 'Collections';
            } else {
                h1.textContent = 'Collections';
            }
        }
    }

    async function renameFile(id, currentName) {
        const newName = prompt('Enter new filename:', currentName);
        if (newName && newName !== currentName) {
            try {
                await api.updateDocument(id, { name: newName });
                loadFiles();
            } catch (e) {
                alert('Failed to rename file');
            }
        }
    }

    async function deleteCollection(id) {
        if (confirm('Delete this collection?')) {
            try {
                await api.deleteCollection(id);
                loadCollections();
            } catch (e) {
                alert('Failed to delete collection');
            }
        }
    }

    async function loadUsers() {
        try {
            if (!user || !user.id) throw new Error('User session not found');
            const users = await api.getUsers(user.id);
            const userTableBody = document.querySelector('tbody');
            if (userTableBody) {
                userTableBody.innerHTML = '';
                if (users.length === 0) {
                    userTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No users found.</td></tr>';
                } else {
                    users.forEach(u => {
                        const row = document.createElement('tr');
                        row.dataset.searchText = `${u.fullname || u.username} ${u.username || ''} ${u.email || ''} ${u.role || ''}`;
                        const displayName = u.fullname || u.username;
                        const initial = displayName.substring(0, 2).toUpperCase();
                        let avatarHtml = `<div class="user-avatar" style="width: 32px; height: 32px; font-size: 0.75rem;">${initial}</div>`;

                        if (u.profilePhotoUrl) {
                            avatarHtml = `
                                <div class="user-avatar" style="width: 32px; height: 32px; font-size: 0.75rem; background-image: url('${u.profilePhotoUrl}'); background-size: cover; background-position: center;">
                                </div>`;
                        }

                        row.innerHTML = `
                        <td>
                            <div class="file-cell">
                                ${avatarHtml}
                                <div class="file-info">
                                    <span>${displayName}</span>
                                    <span class="file-meta">${u.email}</span>
                                </div>
                            </div>
                        </td>
                        <td><span class="status-badge role">${u.role === 'USER' ? 'STUDENT' : u.role}</span></td>
                        <td><span class="status-badge active">Active</span></td>
                        <td style="color: var(--text-muted); font-size: 0.9rem;">${u.joinedAt ? new Date(u.joinedAt).toLocaleDateString() : 'Oct 12, 2023'}</td>
                        <td>
                            <div class="action-btns">
                                <button class="icon-btn delete-btn" onclick="deleteUser(${u.id})"><i class="ri-delete-bin-line"></i></button>
                            </div>
                        </td>
                    `;
                        userTableBody.appendChild(row);
                    });
                }

                // Update stats
                const stats = document.querySelectorAll('.stat-info h3');
                if (stats.length >= 2) {
                    stats[0].textContent = users.length.toLocaleString();
                    stats[1].textContent = "1"; // Current active session
                }
                const userCountFooter = document.getElementById('user-count-footer');
                if (userCountFooter) {
                    userCountFooter.textContent = `Showing ${users.length} of ${users.length} users`;
                }

                const userSearchInput = document.querySelector('.section-title .search-bar input');
                if (userSearchInput) {
                    const runUserFilter = () => {
                        const rows = Array.from(document.querySelectorAll('.data-table tbody tr'));
                        const visibleCount = applyElementFilter(rows, userSearchInput.value);
                        const existingEmpty = userTableBody.querySelector('[data-search-empty="true"]');
                        if (existingEmpty) existingEmpty.remove();

                        if (rows.length > 0 && visibleCount === 0 && normalizeSearchText(userSearchInput.value)) {
                            const row = document.createElement('tr');
                            row.dataset.searchEmpty = 'true';
                            row.innerHTML = '<td colspan="5" style="text-align:center; padding: 2rem;">No matching users found.</td>';
                            userTableBody.appendChild(row);
                        }
                    };

                    userSearchInput.oninput = runUserFilter;
                    runUserFilter();
                }
            }
        } catch (e) {
            console.error('Error loading users:', e);
        }
    }

    async function loadPendingRequests() {
        try {
            if (!user || !user.id) throw new Error('User session not found');
            const requests = await api.getPendingRequests(user.id);
            const reqSection = document.getElementById('requests-section');
            const reqTableContainer = document.getElementById('requests-table-container');
            const reqTable = document.getElementById('requests-table');
            const reqTableBody = reqTable ? reqTable.querySelector('tbody') : null;
            const reqBadge = document.getElementById('request-count-badge');
            const noRequestsMsg = document.getElementById('no-requests-msg');

            if (requests.length > 0) {
                if (reqSection) reqSection.style.display = 'flex';
                if (reqTableContainer) reqTableContainer.style.display = 'block';
                if (reqTable) reqTable.style.display = 'table';
                if (noRequestsMsg) noRequestsMsg.style.display = 'none';
                if (reqBadge) reqBadge.textContent = `${requests.length} Request${requests.length > 1 ? 's' : ''}`;

                if (reqTableBody) {
                    reqTableBody.innerHTML = '';
                    requests.forEach(req => {
                        const row = document.createElement('tr');
                        row.dataset.searchText = `${req.fullname || req.username} ${req.username || ''} ${req.email || ''} ${req.role || 'STUDENT'}`;
                        row.innerHTML = `
                            <td>
                                <div class="file-cell">
                                    <div class="user-avatar" style="width: 32px; height: 32px; font-size: 0.75rem;">
                                        ${req.fullname ? req.fullname.substring(0, 2).toUpperCase() : req.username.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div class="file-info">
                                        <span>${req.fullname || req.username}</span>
                                        <span class="file-meta">${req.email}</span>
                                    </div>
                                </div>
                            </td>
                            <td><span class="status-badge role">${req.role || 'STUDENT'}</span></td>
                            <td style="color: var(--text-muted); font-size: 0.9rem;">${new Date(req.requestedAt).toLocaleDateString()}</td>
                            <td>
                                <div class="action-btns">
                                    <button class="icon-btn" onclick="approveRequest(${req.id})" title="Approve" style="color: var(--success);"><i class="ri-check-line"></i></button>
                                    <button class="icon-btn" onclick="rejectRequest(${req.id})" title="Reject" style="color: var(--danger);"><i class="ri-close-line"></i></button>
                                </div>
                            </td>
                        `;
                        reqTableBody.appendChild(row);
                    });

                    const requestSearchInput = document.querySelector('.top-header .search-bar input');
                    if (requestSearchInput) {
                        const runRequestFilter = () => {
                            const rows = Array.from(document.querySelectorAll('#requests-table tbody tr'));
                            const visibleCount = applyElementFilter(rows, requestSearchInput.value);
                            const existingEmpty = reqTableBody.querySelector('[data-search-empty="true"]');
                            if (existingEmpty) existingEmpty.remove();

                            if (rows.length > 0 && visibleCount === 0 && normalizeSearchText(requestSearchInput.value)) {
                                const row = document.createElement('tr');
                                row.dataset.searchEmpty = 'true';
                                row.innerHTML = '<td colspan="4" style="text-align:center; padding: 2rem;">No matching requests found.</td>';
                                reqTableBody.appendChild(row);
                            }
                        };

                        requestSearchInput.oninput = runRequestFilter;
                        runRequestFilter();
                    }
                }
            } else {
                if (reqBadge) reqBadge.textContent = '0 Requests';
                if (reqTable) reqTable.style.display = 'none';
                if (noRequestsMsg) noRequestsMsg.style.display = 'block';
            }
        } catch (e) {
            console.error('Error loading requests:', e);
        }
    }

    async function approveRequest(id) {
        if (confirm('Approve this registration?')) {
            try {
                if (!user || !user.id) throw new Error('User session not found. Please log in again.');
                await api.approveRequest(id, user.id);
                alert('Account approved successfully!');
                loadPendingRequests();
                loadUsers();
            } catch (e) {
                alert('Failed to approve request: ' + e.message);
            }
        }
    }

    async function rejectRequest(id) {
        if (confirm('Reject this registration?')) {
            try {
                if (!user || !user.id) throw new Error('User session not found. Please log in again.');
                await api.rejectRequest(id, user.id);
                alert('Account rejected.');
                loadPendingRequests();
            } catch (e) {
                alert('Failed to reject request: ' + e.message);
            }
        }
    }

    window.approveRequest = approveRequest;
    window.rejectRequest = rejectRequest;
    async function deleteUser(id) {
        if (confirm('Are you sure you want to delete this user?')) {
            try {
                if (!user || !user.id) throw new Error('User session not found. Please log in again.');
                await api.deleteUser(id, user.id);
                loadUsers();
            } catch (e) {
                alert('Failed to delete user');
            }
        }
    }

    window.deleteUser = deleteUser;

    // Modal Logic
    function openCreateCollectionModal() {
        const modal = document.getElementById('createCollectionModal');
        if (modal) {
            modal.style.display = 'flex';
            // Focus input
            setTimeout(() => document.getElementById('collectionName').focus(), 100);
        }
    }

    function closeCreateCollectionModal() {
        const modal = document.getElementById('createCollectionModal');
        if (modal) modal.style.display = 'none';
    }

    // Setup Collection Form
    const createCollectionForm = document.getElementById('createCollectionForm');
    if (createCollectionForm) {
        createCollectionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('collectionName').value;
            const description = document.getElementById('collectionDesc').value;

            try {
                const urlParams = new URLSearchParams(window.location.search);
                let parentId = urlParams.get('parentId');
                
                // Robustly handle parentId (convert "null" or empty string to actual null)
                if (parentId === 'null' || parentId === '' || !parentId) {
                    parentId = null;
                }
                
                await api.createCollection(name, description, parentId);
                closeCreateCollectionModal();
                loadCollections();
                createCollectionForm.reset();
            } catch (error) {
                alert('Failed to create collection: ' + (error.message || 'Unknown error'));
            }
        });
    }

    async function updateStats(files) {
        try {
            const stats = document.querySelectorAll('.stat-info h3');
            if (stats && stats.length >= 4) {
                // Fetch real-time stats from the backend
                const backendStats = await api.getDashboardStats();

                // 1. Total Archives
                const totalArchivesEl = document.getElementById('stat-total-archives');
                if (totalArchivesEl) totalArchivesEl.textContent = (backendStats.totalArchives || 0).toLocaleString();
                else if (stats.length > 0) stats[0].textContent = (backendStats.totalArchives || 0).toLocaleString();

                // 2. Active Users
                const activeUsersEl = document.getElementById('stat-active-users');
                if (activeUsersEl) activeUsersEl.textContent = (backendStats.activeStudents || 0).toLocaleString();
                else if (stats.length > 1) stats[1].textContent = (backendStats.activeStudents || 0).toLocaleString();
                
                // Active Users text change
                const p = activeUsersEl ? activeUsersEl.nextElementSibling : (stats.length > 1 ? stats[1].nextElementSibling : null);
                if (p) {
                    p.textContent = (user && (user.role === 'ADMIN' || user.email === 'admin@gmail.com'))
                        ? "Active Users"
                        : "Active Session";
                }

                // 3. Storage Used
                const storageUsedEl = document.getElementById('stat-storage-used');
                if (storageUsedEl) storageUsedEl.textContent = formatSize(backendStats.storageUsed || 0);
                else if (stats.length > 2) stats[2].textContent = formatSize(backendStats.storageUsed || 0);

                // 4. Recent Uploads (Last 24h)
                const recentUploadsEl = document.getElementById('stat-recent-uploads');
                if (recentUploadsEl) recentUploadsEl.textContent = (backendStats.recentUploads || 0).toLocaleString();
                else if (stats.length > 3) stats[3].textContent = (backendStats.recentUploads || 0).toLocaleString();

                // 5. CGPA
                const cgpaEl = document.getElementById('stat-cgpa');
                if (cgpaEl) {
                    cgpaEl.textContent = backendStats.cgpa != null ? backendStats.cgpa.toFixed(2) : 'N/A';
                }

                // 6. Attendance
                const attendanceEl = document.getElementById('stat-attendance');
                if (attendanceEl) {
                    attendanceEl.textContent = backendStats.attendancePercentage != null 
                        ? `${backendStats.attendancePercentage.toFixed(1)}%` 
                        : 'N/A';
                }

                // 7. SGPA (Graph)
                const sgpaCanvas = document.getElementById('sgpaChart');
                if (sgpaCanvas) {
                    const semesterSgpas = backendStats.semesterSgpas || [];
                    let chartData = semesterSgpas.length > 0 ? [...semesterSgpas] : [];
                    const hasData = chartData.some(val => val > 0);
                    
                    let labels = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
                    let finalData = [];
                    const statusEl = document.getElementById('sgpa-update-status');

                    if (!hasData) {
                        finalData = new Array(labels.length).fill(0);
                        if (statusEl) statusEl.textContent = 'No SGPA records yet';
                    } else {
                        // Display till which sem they have updated: find last index > 0
                        let lastIndex = chartData.length - 1;
                        while(lastIndex >= 0 && chartData[lastIndex] <= 0) {
                            lastIndex--;
                        }
                        const displayCount = Math.max(1, lastIndex + 1); // show at least 1 bar
                        
                        labels = labels.slice(0, displayCount);
                        finalData = chartData.slice(0, displayCount);
                        
                        const lastSemName = labels[labels.length - 1];
                        if (statusEl) statusEl.innerHTML = `<i class="ri-checkbox-circle-fill" style="color: var(--primary-color);"></i> Updated till Semester ${lastSemName}`;
                    }

                    if (window.sgpaChartInstance) {
                        window.sgpaChartInstance.data.labels = labels;
                        window.sgpaChartInstance.data.datasets[0].data = finalData;
                        window.sgpaChartInstance.update();
                    } else {
                        // Register DataLabels plugin safely
                        if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
                            Chart.register(ChartDataLabels);
                        }

                        window.sgpaChartInstance = new Chart(sgpaCanvas, {
                            type: 'bar',
                            data: {
                                labels: labels,
                                datasets: [{
                                    label: 'SGPA',
                                    data: finalData,
                                    backgroundColor: 'rgba(59, 130, 246, 0.9)', // Blue bars
                                    borderRadius: 4,
                                    barPercentage: 0.5,
                                    categoryPercentage: 0.8
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { display: false },
                                    tooltip: {
                                        callbacks: {
                                            label: function(context) {
                                                return ` SGPA: ${context.raw.toFixed(2)}`;
                                            }
                                        }
                                    },
                                    datalabels: {
                                        color: '#ffffff',
                                        anchor: 'center',
                                        align: 'center',
                                        font: {
                                            weight: 'bold',
                                            family: "'Outfit', sans-serif"
                                        },
                                        formatter: function(value) {
                                            return value > 0 ? value.toFixed(2) : '';
                                        }
                                    }
                                },
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        max: 10.0,
                                        ticks: {
                                            color: '#a1a1aa',
                                            font: { family: "'Outfit', sans-serif" },
                                            stepSize: 2.0,
                                            callback: function(value) {
                                                return value.toFixed(2);
                                            }
                                        },
                                        grid: {
                                            color: 'rgba(255, 255, 255, 0.05)',
                                            drawBorder: false
                                        }
                                    },
                                    x: {
                                        ticks: {
                                            color: '#e4e4e7',
                                            font: { weight: 'bold', family: "'Outfit', sans-serif" }
                                        },
                                        grid: {
                                            display: false,
                                            drawBorder: false
                                        }
                                    }
                                }
                            }
                        });
                    }
                }
            }
        } catch (err) {
            console.error('Stats error:', err);
        }
    }

    // Expose checks
    window.openCreateCollectionModal = openCreateCollectionModal;
    window.closeCreateCollectionModal = closeCreateCollectionModal;
    window.deleteCollection = deleteCollection;
    window.renameFile = renameFile;

    function loadProfile(user) {
        const firstNameEl = document.getElementById('profile-firstname');
        const lastNameEl = document.getElementById('profile-lastname');
        const emailEl = document.getElementById('profile-email');
        const bioEl = document.getElementById('profile-bio');
        const avatarLargeEl = document.getElementById('profile-avatar-large');

        if (firstNameEl) firstNameEl.value = user.firstname || user.fullname?.split(' ')[0] || '';
        if (lastNameEl) lastNameEl.value = user.lastname || user.fullname?.split(' ').slice(1).join(' ') || '';
        if (emailEl) emailEl.value = user.email || '';
        if (bioEl) bioEl.value = user.bio || '';

        const rollEl = document.getElementById('profile-rollnumber');
        const deptEl = document.getElementById('profile-department');
        const facultyIdEl = document.getElementById('profile-facultyid');
        const studentFields = document.getElementById('student-fields');
        const facultyFields = document.getElementById('faculty-fields');

        if (user.role === 'FACULTY') {
            if (facultyFields) facultyFields.style.display = 'grid';
            if (facultyIdEl) facultyIdEl.value = user.facultyId || '';
        } else if (user.role === 'STUDENT' || user.role === 'USER') {
            if (studentFields) studentFields.style.display = 'grid';
            if (rollEl) rollEl.value = user.rollNumber || '';
            if (deptEl) deptEl.value = user.department || '';
        } else {
            // Admin or other roles: hide both
            if (studentFields) studentFields.style.display = 'none';
            if (facultyFields) facultyFields.style.display = 'none';
        }

        if (avatarLargeEl) {
            if (user.profilePhotoUrl) {
                avatarLargeEl.style.backgroundImage = `url(${user.profilePhotoUrl})`;
                avatarLargeEl.textContent = '';
            } else {
                avatarLargeEl.style.backgroundImage = 'none';
                const name = user.fullname || user.username || 'Student';
                avatarLargeEl.textContent = name.substring(0, 2).toUpperCase();
            }
        }

        // Setup listeners for profile page
        setupProfileListeners(user);
    }

    function setupProfileListeners(user) {
        const saveBtn = document.getElementById('save-profile-btn');
        const changePhotoBtn = document.getElementById('change-photo-btn');
        const photoInput = document.getElementById('profile-photo-input');

        if (saveBtn) {
            saveBtn.onclick = async () => {
                const updates = {
                    firstname: document.getElementById('profile-firstname').value,
                    lastname: document.getElementById('profile-lastname').value,
                    bio: document.getElementById('profile-bio').value,
                    fullname: document.getElementById('profile-firstname').value + ' ' + document.getElementById('profile-lastname').value
                };

                if (user.role === 'FACULTY') {
                    updates.facultyId = document.getElementById('profile-facultyid')?.value;
                } else if (user.role === 'STUDENT' || user.role === 'USER') {
                    updates.rollNumber = document.getElementById('profile-rollnumber')?.value;
                    updates.department = document.getElementById('profile-department')?.value;
                }

                try {
                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Saving...';
                    await api.updateUser(user.id, updates);
                    alert('Profile updated successfully!');
                    window.location.reload(); // Force full reload to refresh all UI components
                } catch (e) {
                    alert('Failed to update profile: ' + e.message);
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save Changes';
                }
            };
        }

        if (changePhotoBtn && photoInput) {
            changePhotoBtn.onclick = () => photoInput.click();
            photoInput.onchange = async (e) => {
                if (e.target.files.length > 0) {
                    try {
                        changePhotoBtn.textContent = 'Uploading...';
                        await api.uploadProfilePhoto(user.id, e.target.files[0]);
                        alert('Photo updated successfully!');
                        window.location.reload(); // Force full reload to refresh all UI components
                    } catch (e) {
                        alert('Photo upload failed: ' + e.message);
                        changePhotoBtn.textContent = 'Change Photo';
                    }
                }
            };
        }
    }

    // Helpers
    function getFileIcon(mimeType) {
        if (mimeType.includes('image')) return 'ri-image-line';
        if (mimeType.includes('pdf')) return 'ri-file-pdf-line';
        if (mimeType.includes('video')) return 'ri-movie-line';
        return 'ri-file-text-line';
    }

    function getFileIconClass(mimeType) {
        if (mimeType.includes('image')) return 'icon-blue';
        if (mimeType.includes('pdf')) return 'icon-orange';
        if (mimeType.includes('video')) return 'icon-green';
        return 'icon-purple'; // default
    }

    function getPrettyFileType(mimeType) {
        if (!mimeType) return 'FILE';
        if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) return 'DOCX';
        if (mimeType.includes('spreadsheetml') || mimeType.includes('excel')) return 'XLSX';
        if (mimeType.includes('presentationml') || mimeType.includes('powerpoint')) return 'PPTX';
        if (mimeType.includes('pdf')) return 'PDF';
        if (mimeType.includes('image/')) return mimeType.split('/')[1].toUpperCase();
        if (mimeType.includes('video/')) return mimeType.split('/')[1].toUpperCase();

        const parts = mimeType.split('/');
        let type = parts[parts.length - 1].toUpperCase();
        if (type.includes('VND.')) type = type.replace('VND.', '');
        if (type.length > 10) type = type.substring(0, 10);
        return type;
    }

    function formatSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Expose deleteFile to window for onclick (Alias for deleteDocument)
    window.deleteFile = (id) => window.deleteDocument(id, false);

    // Setup Upload
    async function setupUpload() {
        const fileInput = document.getElementById('fileInput');
        const collectionSelect = document.getElementById('collectionSelect');

        // Populate Collections dropdown
        if (collectionSelect) {
            try {
                const collections = await api.getCollections();
                const urlParams = new URLSearchParams(window.location.search);
                const targetCollectionId = urlParams.get('collectionId');

                // If student, they MUST upload to a collection (usually starting with root)
                if (!isFaculty && !isAdmin) {
                    const rootCol = collections.find(c => c.ownerId == user.id && !c.parentId);
                    // Remove "No Collection" option for students
                    const generalOption = collectionSelect.querySelector('option[value=""]');
                    if (generalOption) generalOption.remove();
                    
                    if (!targetCollectionId && rootCol) {
                        // Default to root if not specified in URL
                        console.log('Defaulting upload to root collection:', rootCol.name);
                    }
                }

                collections.forEach(col => {
                    const isRoot = !col.parentId; // It's a root if no parentId
                    
                    const option = document.createElement('option');
                    option.value = col.id;
                    option.textContent = isRoot && col.ownerId == user.id ? `📁 ${col.name} (Root - No Uploads)` : col.name;
                    
                    // Disable root collection for students as they must upload to sub-collections
                    if (!isFaculty && !isAdmin && isRoot && col.ownerId == user.id) {
                        option.disabled = true;
                    }

                    if (targetCollectionId && col.id == targetCollectionId) {
                        option.selected = true;
                    }
                    collectionSelect.appendChild(option);
                });

                // Update Page Heading if uploading to a specific collection
                if (targetCollectionId) {
                    const targetCol = collections.find(c => c.id == targetCollectionId);
                    if (targetCol) {
                        const heading = document.querySelector('.page-title h1');
                        const subheading = document.querySelector('.page-title p');
                        if (heading) heading.textContent = `Upload to ${targetCol.name}`;
                        if (subheading) subheading.textContent = `Adding new records to ${targetCol.name}'s folder.`;
                    }
                }
            } catch (e) {
                console.error('Failed to load collections for dropdown', e);
            }
        }

        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                const files = e.target.files;
                if (files.length > 0) {
                    const file = files[0];
                    const collectionId = collectionSelect ? collectionSelect.value : null;
                    const uploadContainer = document.getElementById('uploadStatusContainer');

                    // Show uploading UI (Mocking progress)
                    const progressHtml = `
                    <div class="upload-item" style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; background-color: var(--background-color); padding: 0.75rem; border-radius: 0.5rem;">
                        <div style="font-size: 1.5rem; color: var(--primary-color);"><i class="ri-file-line"></i></div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.25rem;">
                                <span style="font-weight: 500; font-size: 0.875rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">${file.name}</span>
                                <span class="upload-status" style="font-size: 0.75rem; color: var(--text-secondary); flex-shrink: 0;">Uploading...</span>
                            </div>
                            <div style="width: 100%; height: 4px; background-color: #e2e8f0; border-radius: 2px;">
                                <div class="upload-progress" style="width: 0%; height: 100%; background-color: var(--primary-color); border-radius: 2px; transition: width 0.3s;" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                        </div>
                    </div>
                `;

                    // Remove existing upload items for cleaner demo
                    // uploadContainer.innerHTML = '<h4 style="font-size: 0.875rem; font-weight: 600; margin-bottom: 1rem;">Uploading...</h4>';
                    // Append instead?
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = progressHtml;
                    uploadContainer.appendChild(tempDiv.firstElementChild);

                    const progressBar = uploadContainer.lastElementChild.querySelector('.upload-progress');
                    const statusText = uploadContainer.lastElementChild.querySelector('.upload-status');

                    // Simulate progress
                    let width = 0;
                    const interval = setInterval(() => {
                        if (width >= 90) clearInterval(interval);
                        width += 10;
                        progressBar.style.width = width + '%';
                    }, 200);

                    try {
                        await api.uploadFile(file, collectionId);
                        clearInterval(interval);
                        progressBar.style.width = '100%';
                        progressBar.style.backgroundColor = '#10b981'; // Green
                        statusText.textContent = 'Completed';
                        statusText.style.color = '#10b981';

                        // Maybe redirect to files page calls
                        setTimeout(() => {
                            if (confirm('Upload successful! Go to files?')) {
                                window.location.href = 'files.html' + (collectionId ? `?collectionId=${collectionId}` : '');
                            }
                        }, 500);

                    } catch (error) {
                        clearInterval(interval);
                        progressBar.style.backgroundColor = '#ef4444'; // Red
                        statusText.textContent = 'Failed';
                        statusText.style.color = '#ef4444';
                        alert('Upload failed: ' + (error.message || 'Unknown error'));
                    }
                }
            });
        }
    }

    // Setup Admin Panel if on admin.html
    // Note: Modal logic removed in favor of redirection to create-user.html

    // --- Faculty Stats Functions ---
    async function loadStudentsForStats() {
        window.loadStudentsForStats = loadStudentsForStats; // keep it on window just in case
        const tbody = document.getElementById('student-stats-list');
        if (!tbody) return;

        try {
            const students = await api.getStudents();
            renderStatsTable(students, tbody);

            // Handle search
            const searchInput = document.getElementById('student-search');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const term = e.target.value.toLowerCase();
                    const filtered = students.filter(s => 
                        (s.fullname && s.fullname.toLowerCase().includes(term)) || 
                        (s.email && s.email.toLowerCase().includes(term))
                    );
                    renderStatsTable(filtered, tbody);
                });
            }
        } catch (err) {
            console.error('Failed to load students for stats:', err);
            tbody.innerHTML = `<tr><td colspan="6" style="color:var(--error-color); text-align:center;">${err.message}</td></tr>`;
        }
    }

    function renderStatsTable(students, tbody) {
        if (!students || students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">No students found.</td></tr>';
            return;
        }

        tbody.innerHTML = students.map(student => {
            const sgpas = student.semesterSgpas || [];
            let sum = 0, count = 0;
            sgpas.forEach(val => {
                const num = parseFloat(val);
                if (num > 0) {
                    sum += num;
                    count++;
                }
            });
            const avgSgpa = count > 0 ? (sum / count).toFixed(2) : '-';

            return `
            <tr data-id="${student.id}" data-search-text="${(student.fullname || student.username || '').replace(/"/g, '&quot;')} ${(student.email || '').replace(/"/g, '&quot;')}">
                <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div class="user-avatar" style="${student.profilePhotoUrl ? `background-image: url(${student.profilePhotoUrl}); background-size: cover;` : ''}">
                            ${!student.profilePhotoUrl ? (student.fullname || student.username).charAt(0).toUpperCase() : ''}
                        </div>
                        <div>
                            <div style="font-weight: 500">${student.fullname || student.username}</div>
                            <div style="font-size: 0.75rem; color: var(--text-color); opacity: 0.7">${student.email}</div>
                        </div>
                    </div>
                </td>
                <td>${student.email}</td>
                <td>
                    <span class="view-mode">${student.cgpa != null ? student.cgpa.toFixed(2) : '-'}</span>
                    <input type="number" class="edit-input edit-mode" style="display:none;" value="${student.cgpa || ''}" step="0.01" min="0" max="10" data-field="cgpa">
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span class="view-mode" style="font-weight: 500; font-size: 0.9rem;">${avgSgpa}</span>
                        <button class="btn-edit" onclick="openSgpaModal(${student.id}, '${student.fullname || student.username}')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius: 4px; border: 1px solid var(--border-color); background: rgba(59, 130, 246, 0.1); color: #3b82f6; cursor: pointer; white-space: nowrap;">
                            Manage SGPA
                        </button>
                    </div>
                </td>
                <td>
                    <span class="view-mode">${student.attendancePercentage != null ? student.attendancePercentage.toFixed(1) : '-'}</span>
                    <input type="number" class="edit-input edit-mode" style="display:none;" value="${student.attendancePercentage || ''}" step="0.1" min="0" max="100" data-field="attendancePercentage">
                </td>
                <td>
                    <div class="action-btns">
                        <button class="icon-btn btn-edit" onclick="toggleEditStats(${student.id}, this)" title="Edit Core Stats">
                            <i class="ri-edit-line"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `}).join('');
    }

    // Modal functions for SGPA
    let currentStudentIdForSgpa = null;

    window.openSgpaModal = async function(userId, fullname) {
        currentStudentIdForSgpa = userId;
        const modal = document.getElementById('sgpaModal');
        const title = document.getElementById('modalStudentName');
        const container = document.getElementById('modalSgpaInputs');
        
        if (!modal || !container) return;

        title.textContent = `Manage SGPAs for ${fullname}`;
        container.innerHTML = 'Loading SGPAs...';
        modal.style.display = 'flex';

        try {
            // Use api.getStudents() which faculty have access to
            const students = await api.getStudents();
            const student = students.find(u => u.id === userId);
            
            if (!student) throw new Error('Student not found');

            // Ensure we have 8 semesters shown even if backend list is empty or shorter
            const semesterSgpas = student.semesterSgpas || [];
            const displaySgpas = new Array(8).fill(0);
            for (let i = 0; i < semesterSgpas.length && i < 8; i++) {
                displaySgpas[i] = semesterSgpas[i];
            }
            
            container.innerHTML = displaySgpas.map((val, i) => `
                <div class="sgpa-card">
                    <label>Semester ${i + 1}</label>
                    <input type="number" class="modal-sgpa-input" 
                           data-sem="${i}" 
                           value="${val > 0 ? val : ''}" 
                           placeholder="0.00"
                           step="0.01" min="0" max="10" 
                           oninput="updateModalAverage()">
                </div>
            `).join('');

            updateModalAverage();
            document.getElementById('saveSgpaDetailsBtn').onclick = () => saveSgpaDetails(userId);
        } catch (err) {
            container.innerHTML = `<div style="color:var(--error-color); grid-column: 1 / -1; text-align: center; padding: 2rem;">
                <i class="ri-error-warning-line" style="font-size: 2rem; display: block; margin-bottom: 1rem;"></i>
                Error: ${err.message}
            </div>`;
        }
    }

    window.updateModalAverage = function() {
        const inputs = document.querySelectorAll('.modal-sgpa-input');
        let sum = 0;
        let count = 0;
        inputs.forEach(input => {
            const val = parseFloat(input.value);
            if (!isNaN(val) && val > 0) {
                sum += val;
                count++;
            }
        });
        const avg = count > 0 ? (sum / count).toFixed(2) : '0.00';
        const avgEl = document.getElementById('modalAvgSgpa');
        if (avgEl) {
            avgEl.innerHTML = `<i class="ri-line-chart-line"></i><span>AVERAGE: ${avg}</span>`;
            // Add a visual indicator for the average
            avgEl.style.transition = 'all 0.3s ease';
            if (parseFloat(avg) > 0) {
                avgEl.style.background = 'rgba(59, 130, 246, 0.2)';
                avgEl.style.color = 'var(--primary-color)';
            } else {
                avgEl.style.background = 'rgba(156, 163, 175, 0.1)';
                avgEl.style.color = 'var(--text-muted)';
            }
        }
    }

    window.closeSgpaModal = function() {
        const modal = document.getElementById('sgpaModal');
        if (modal) {
            modal.style.opacity = '0';
            setTimeout(() => {
                modal.style.display = 'none';
                modal.style.opacity = '1';
            }, 300);
        }
        currentStudentIdForSgpa = null;
    }

    async function saveSgpaDetails(userId) {
        const inputs = document.querySelectorAll('.modal-sgpa-input');
        const semesterSgpas = new Array(8).fill(0);
        inputs.forEach(input => {
            const index = parseInt(input.dataset.sem);
            semesterSgpas[index] = parseFloat(input.value) || 0;
        });

        const btn = document.getElementById('saveSgpaDetailsBtn');
        if (!btn) return;

        const btnText = btn.querySelector('span');
        const btnIcon = btn.querySelector('i');
        const originalHtml = btn.innerHTML;

        try {
            btn.disabled = true;
            if (btnText) {
                btnText.textContent = 'Saving...';
            } else {
                btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Saving...';
            }
            if (btnIcon) {
                btnIcon.className = 'ri-loader-4-line ri-spin';
            }
            
            await api.updateUserStats(userId, { semesterSgpas: semesterSgpas });
            
            showToast('Success', 'Academic records updated successfully!', 'success');
            closeSgpaModal();
            loadStudentsForStats(); // Refresh table
        } catch (err) {
            showToast('Error', 'Failed to save SGPAs: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }

    // Helper for toast notifications if present, else fallback to alert
    function showToast(title, message, type) {
        if (window.toast) {
            window.toast({ title, message, type });
        } else {
            alert(message);
        }
    }

    window.toggleEditStats = async function(userId, btn) {
        const row = document.querySelector(`tr[data-id="${userId}"]`);
        if (!row) return;

        const isEditing = btn.classList.contains('btn-save');

        if (isEditing) {
            // Save mode
            const inputs = row.querySelectorAll('.edit-input');
            const updates = {};
            let hasChanges = false;

            inputs.forEach(input => {
                const field = input.getAttribute('data-field');
                const val = input.value.trim();
                // For CGPA and Attendance, we allow partial updates
                if (val !== '') {
                    updates[field] = parseFloat(val);
                    if (!isNaN(updates[field])) hasChanges = true;
                }
            });

            if (hasChanges) {
                try {
                    btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i>';
                    await api.updateUserStats(userId, updates);
                    // Refresh table
                    loadStudentsForStats();
                } catch (err) {
                    alert('Error saving stats: ' + err.message);
                    btn.innerHTML = '<i class="ri-edit-line"></i>';
                }
            } else {
                // Cancel edit if no changes
                toggleView(row, btn);
            }
        } else {
            // Edit mode
            toggleView(row, btn, true);
        }
    }

    function toggleView(row, btn, toEdit = false) {
        const viewModes = row.querySelectorAll('.view-mode');
        const editModes = row.querySelectorAll('.edit-mode');

        if (toEdit) {
            viewModes.forEach(el => el.style.display = 'none');
            editModes.forEach(el => el.style.display = 'inline-block');
            btn.classList.remove('btn-edit');
            btn.classList.add('btn-save');
            btn.innerHTML = '<i class="ri-save-line"></i>';
            btn.title = 'Save Stats';
            
            // Auto focus first input
            if(editModes.length > 0) editModes[0].focus();
        } else {
            viewModes.forEach(el => el.style.display = 'inline');
            editModes.forEach(el => el.style.display = 'none');
            btn.classList.add('btn-edit');
            btn.classList.remove('btn-save');
            btn.innerHTML = '<i class="ri-edit-line"></i>';
            btn.title = 'Edit Stats';
        }
    }
    // --- Personal Documents (Faculty) ---
    async function loadPersonalDocuments() {
        const grid = document.querySelector('.files-grid');
        if (!grid) return;

        try {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 2rem;"><i class="ri-loader-4-line ri-spin"></i> Loading your personal documents...</p>';
            
            const docs = await api.getFiles(null, true); // true for isPersonal

            if (docs.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem;">
                        <i class="ri-folder-open-line" style="font-size: 3rem; color: var(--text-secondary); opacity: 0.5;"></i>
                        <h3 style="margin-top: 1rem; color: var(--text-primary);">No personal documents yet</h3>
                        <p style="color: var(--text-secondary);">Upload files that are only visible to you.</p>
                    </div>
                `;
                return;
            }

            grid.innerHTML = docs.map(doc => `
                <div class="file-card" data-search-text="${`${doc.name} ${doc.type || ''}`.replace(/"/g, '&quot;')}">
                    <div class="file-icon">
                        <i class="${getFileIcon(doc.type)}"></i>
                    </div>
                    <div class="file-info">
                        <h4>${doc.name}</h4>
                        <p>${formatSize(doc.size)} • ${new Date(doc.uploadDate).toLocaleDateString()}</p>
                    </div>
                    <div class="file-actions">
                        <button class="icon-btn" onclick="window.open('${doc.url}', '_blank')"><i class="ri-eye-line"></i></button>
                        <button class="icon-btn" onclick="deleteDocument(${doc.id}, true)"><i class="ri-delete-bin-line"></i></button>
                    </div>
                </div>
            `).join('');

            const docsSearchInput = document.querySelector('.top-header .search-bar input');
            if (docsSearchInput) {
                const runDocsFilter = () => {
                    const cards = Array.from(document.querySelectorAll('.files-grid .file-card'));
                    const visibleCount = applyElementFilter(cards, docsSearchInput.value);
                    const existingEmpty = grid.querySelector('[data-search-empty="true"]');
                    if (existingEmpty) existingEmpty.remove();

                    if (cards.length > 0 && visibleCount === 0 && normalizeSearchText(docsSearchInput.value)) {
                        const empty = document.createElement('p');
                        empty.dataset.searchEmpty = 'true';
                        empty.style.gridColumn = '1/-1';
                        empty.style.textAlign = 'center';
                        empty.style.padding = '2rem';
                        empty.textContent = 'No matching personal documents found.';
                        grid.appendChild(empty);
                    }
                };

                docsSearchInput.oninput = runDocsFilter;
                runDocsFilter();
            }

        } catch (err) {
            grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--error-color);">Error: ${err.message}</p>`;
        }
    }

    window.handlePersonalUpload = async function(input) {
        const file = input.files[0];
        if (!file) return;

        const btn = document.getElementById('upload-personal-btn');
        const originalHtml = btn.innerHTML;

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Uploading...';
            
            await api.uploadFile(file, null, true); // true for isPersonal
            loadPersonalDocuments();
            input.value = ''; // Reset input
        } catch (err) {
            alert('Upload failed: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }
    window.deleteDocument = async function(id, isPersonal = false) {
        if (!confirm('Are you sure you want to delete this document?')) return;
        try {
            await api.deleteFile(id);
            if (isPersonal) {
                loadPersonalDocuments();
            } else {
                loadFiles();
            }
        } catch (err) {
            alert('Delete failed: ' + err.message);
        }
    }
});

