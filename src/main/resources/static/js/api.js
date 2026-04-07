const api = {
    // --- Data Store Helpers (Kept for Collections mocking for now) ---
    _getCollections() {
        return JSON.parse(localStorage.getItem('mock_collections') || '[]');
    },
    _saveCollections(collections) {
        localStorage.setItem('mock_collections', JSON.stringify(collections));
    },
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    _getCurrentUser() {
        const userStr = localStorage.getItem('user');
        if (!userStr) return null;
        try {
            return JSON.parse(userStr);
        } catch (e) {
            console.error('Failed to parse user from localStorage', e);
            return null;
        }
    },

    // --- Dashboard ---
    async getUserProfile(userId, requesterId) {
        const response = await fetch(`/api/users/${userId}?requesterId=${requesterId}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to fetch profile');
        return data;
    },
    async getDashboardStats() {
        const currentUser = this._getCurrentUser();
        if (!currentUser || !currentUser.id) throw new Error('Unauthorized: Session invalid');
        const response = await fetch(`/api/dashboard/stats?userId=${currentUser.id}`);
        if (!response.ok) throw new Error('Failed to fetch dashboard stats');
        const data = await response.json();

        const updatedUser = {
            ...currentUser,
            cgpa: data.cgpa,
            semesterSgpas: data.semesterSgpas || [],
            attendancePercentage: data.attendancePercentage
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));

        return data;
    },

    // --- Auth ---
    async login(username, password) {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Login failed');

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data));
        return data;
    },

    async logout() {
        try {
            await fetch('/api/auth/logout', { 
                method: 'POST',
                credentials: 'same-origin' 
            });
        } catch (e) {
            console.warn('Backend logout failed, proceeding with local logout', e);
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return { message: 'Logged out successfully' };
    },

    async register(fullname, username, email, password, role, rollNumber, department, facultyId) {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullname, username, email, password, role, rollNumber, department, facultyId })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Registration failed');
        return data;
    },

    // --- Files ---
    async getFiles(collectionId = null) {
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (!currentUser) throw new Error('Unauthorized');

        let url = `/api/documents?userId=${currentUser.id}`;
        if (collectionId) {
            url += `&collectionId=${collectionId}`;
        }

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch files');
        return await response.json();
    },

    async uploadFile(file, collectionId = null) {
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (!currentUser) throw new Error('Unauthorized');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', currentUser.id);
        if (collectionId) {
            formData.append('collectionId', collectionId);
        }

        const response = await fetch('/api/documents/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        });

        if (!response.ok) throw new Error('Upload failed');
        return await response.json();
    },

    async deleteFile(id) {
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (!currentUser) throw new Error('Unauthorized');

        const response = await fetch(`/api/documents/${id}?userId=${currentUser.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (!response.ok) throw new Error('Delete failed');
        return { message: 'File deleted successfully' };
    },

    // --- Collections ---
    async getCollections() {
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (!currentUser) throw new Error('Unauthorized');

        const response = await fetch(`/api/collections?userId=${currentUser.id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch collections');
        return await response.json();
    },

    async createCollection(name, description, parentId = null) {
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (!currentUser) throw new Error('Unauthorized');

        const response = await fetch('/api/collections', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ name, description, parentId, ownerId: currentUser.id })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to create collection');
        }
        return await response.json();
    },

    async deleteCollection(id) {
        const currentUser = this._getCurrentUser();
        if (!currentUser || !currentUser.id) throw new Error('Unauthorized: Session invalid');

        const response = await fetch(`/api/collections/${id}?userId=${currentUser.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Failed to delete collection');
        return { message: 'Collection deleted successfully' };
    },

    // --- Users ---
    async getUsers(requesterId) {
        if (!requesterId) throw new Error('Requester ID is required');
        const response = await fetch(`/api/users?requesterId=${requesterId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch users');
        return await response.json();
    },

    getPendingRequests: async function (requesterId) {
        return this.request(`/admin/requests?requesterId=${requesterId}`);
    },

    approveRequest: async function (requestId, requesterId) {
        return this.request(`/admin/requests/${requestId}/approve?requesterId=${requesterId}`, {
            method: 'POST'
        });
    },

    rejectRequest: async function (requestId, requesterId) {
        return this.request(`/admin/requests/${requestId}/reject?requesterId=${requesterId}`, {
            method: 'POST'
        });
    },

    async deleteUser(id) {
        const currentUser = this._getCurrentUser();
        if (!currentUser || !currentUser.id) throw new Error('Unauthorized: Session invalid');

        const response = await fetch(`/api/users/${id}?requesterId=${currentUser.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Failed to delete user');
        return { message: 'User deleted successfully' };
    },

    async updateUser(id, updates) {
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (!currentUser) throw new Error('Unauthorized');

        const response = await fetch(`/api/users/${id}?requesterId=${currentUser.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(updates)
        });

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Update failed');

            // Update local storage user if it's the current user
            const currentUser = JSON.parse(localStorage.getItem('user'));
            if (currentUser && currentUser.id === id) {
                const updatedUser = { ...currentUser, ...data };
                localStorage.setItem('user', JSON.stringify(updatedUser));
            }
            return data;
        } else {
            const text = await response.text();
            throw new Error(`Server returned non-JSON response: ${response.status} ${response.statusText}. Content: ${text.substring(0, 100)}...`);
        }
    },

    async uploadProfilePhoto(id, file) {
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (!currentUser) throw new Error('Unauthorized');

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`/api/users/${id}/photo?requesterId=${currentUser.id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        });

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Photo upload failed');

            // Update local storage user if it's the current user
            const currentUser = JSON.parse(localStorage.getItem('user'));
            if (currentUser && currentUser.id === id) {
                currentUser.profilePhotoUrl = data.url;
                localStorage.setItem('user', JSON.stringify(currentUser));
            }
            return data;
        } else {
            const text = await response.text();
            throw new Error(`Server returned non-JSON response: ${response.status} ${response.statusText}. Content: ${text.substring(0, 100)}...`);
        }
    }
};

// Also patch uploadFile and getFiles to support collectionId
api.getFiles = async function (collectionId, isPersonal = false) {
    const userStr = localStorage.getItem('user');
    if (!userStr) throw new Error('Unauthorized');
    const currentUser = JSON.parse(userStr);

    if (!currentUser.id) {
        console.error('Current user object in localStorage is missing ID:', currentUser);
        throw new Error('User session is invalid. Please log out and log in again.');
    }

    let url = `/api/documents?userId=${currentUser.id}`;
    if (collectionId) url += `&collectionId=${collectionId}`;
    if (isPersonal) url += `&isPersonal=true`;

    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch files');
    }
    return await response.json();
};

api.uploadFile = async function (file, collectionId, isPersonal = false) {
    const userStr = localStorage.getItem('user');
    if (!userStr) throw new Error('Unauthorized');
    const currentUser = JSON.parse(userStr);

    if (!currentUser.id) {
        throw new Error('User session is invalid. Please log out and log in again.');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', currentUser.id);
    if (collectionId) formData.append('collectionId', collectionId);
    if (isPersonal) formData.append('isPersonal', 'true');

    const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Upload failed');
    }
    return await response.json();
};

api.updateDocument = async function (id, updates) {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) throw new Error('Unauthorized');

    const response = await fetch(`/api/documents/${id}?userId=${currentUser.id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Update failed');
    return await response.json();
};

// Generic request helper if needed (was missing in some files)
api.request = async function (url, options = {}) {
    const response = await fetch(`/api${url}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            ...options.headers
        }
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Request failed');
    }
    return await response.json();
};

api.getStudents = async function () {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) throw new Error('Unauthorized');

    const response = await fetch(`/api/users/students?requesterId=${currentUser.id}`, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to fetch students');
    }
    return await response.json();
};

api.updateUserStats = async function (id, updates) {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) throw new Error('Unauthorized');

    const response = await fetch(`/api/users/${id}?requesterId=${currentUser.id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updates)
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Update failed');
    }
    return await response.json();
};
