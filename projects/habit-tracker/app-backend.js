// Habit Tracker App with Backend Integration & Guest Mode
// Dynamic API URL detection
const API_URL = (() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';
    }
    return `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}/api`;
})();

// Detect guest mode
const IS_GUEST = new URLSearchParams(window.location.search).get('guest') === 'true';

class HabitTracker {
    constructor() {
        this.habits = [];
        this.todos = [];
        this.isGuest = IS_GUEST;
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
        this.init();
    }

    async init() {
        // If not guest and no token, redirect to landing page
        if (!this.isGuest && !this.token) {
            window.location.href = 'index.html';
            return;
        }

        // If logged in user arrives with guest param, drop the guest mode
        if (this.isGuest && this.token) {
            this.isGuest = false;
        }

        // Initialize dark mode
        this.initDarkMode();

        // Add header UI (logout or guest banner)
        if (this.isGuest) {
            this.addGuestBanner();
        } else {
            this.addLogoutButton();
        }
        
        this.setupEventListeners();

        if (this.isGuest) {
            this.loadGuestTodos();
            this.loadGuestHabits();
            this.render();
            this.showGuestPrompt();
        } else {
            this.loadTodos();
            await this.loadHabits();
        }
    }

    initDarkMode() {
        const darkMode = localStorage.getItem('darkMode') === 'true';
        if (darkMode) {
            document.body.classList.add('dark-mode');
            this.updateDarkModeButton(true);
        }

        const toggleBtn = document.getElementById('darkModeToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleDarkMode());
        }
    }

    toggleDarkMode() {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', isDark);
        this.updateDarkModeButton(isDark);
    }

    updateDarkModeButton(isDark) {
        const icon = document.getElementById('darkModeIcon');
        const text = document.getElementById('darkModeText');
        if (icon && text) {
            icon.textContent = isDark ? '☀️' : '🌙';
            text.textContent = isDark ? 'Light' : 'Dark';
        }
    }

    addLogoutButton() {
        const container = document.querySelector('.container');
        if (container && this.user) {
            const header = container.querySelector('header');
            const userInfo = document.createElement('div');
            userInfo.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;';
            userInfo.innerHTML = `
                <span style="color: white; font-size: 1.1rem;">Welcome, ${this.escapeHtml(this.user.username)}!</span>
                <button id="logoutBtn" style="padding: 8px 16px; background: rgba(255,255,255,0.2); color: white; border: 2px solid white; border-radius: 8px; cursor: pointer; font-weight: 600;">
                    Logout
                </button>
            `;
            header.appendChild(userInfo);

            document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        }
    }

    addGuestBanner() {
        const container = document.querySelector('.container');
        if (!container) return;
        const header = container.querySelector('header');

        // Top bar with sign up CTA
        const guestBar = document.createElement('div');
        guestBar.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;';
        guestBar.innerHTML = `
            <span style="color: rgba(255,255,255,0.85); font-size: 1rem;">👋 You're in <strong>Guest Mode</strong></span>
            <div style="display: flex; gap: 8px;">
                <a href="signup.html" style="padding: 8px 20px; background: white; color: var(--primary-color); border: none; border-radius: 8px; cursor: pointer; font-weight: 700; text-decoration: none; font-size: 0.9rem;">Sign Up Free</a>
                <a href="login.html" style="padding: 8px 16px; background: rgba(255,255,255,0.15); color: white; border: 2px solid rgba(255,255,255,0.4); border-radius: 8px; cursor: pointer; font-weight: 600; text-decoration: none; font-size: 0.9rem;">Log In</a>
            </div>
        `;
        header.appendChild(guestBar);


    }

    showGuestPrompt() {
        // Show a gentle popup after 30 seconds of usage
        this._guestPromptTimeout = setTimeout(() => {
            if (!this.isGuest) return;
            const overlay = document.createElement('div');
            overlay.id = 'guestPromptOverlay';
            overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;';
            overlay.innerHTML = `
                <div style="background: white; border-radius: 16px; padding: 36px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.3);">
                    <div style="font-size: 3rem; margin-bottom: 12px;">💡</div>
                    <h2 style="color: #111827; margin-bottom: 12px; font-size: 1.4rem;">Enjoying the Habit Tracker?</h2>
                    <p style="color: #6b7280; margin-bottom: 24px; line-height: 1.6;">
                        Create a free account to <strong>save your habits permanently</strong>, access them from any device, and never lose your streaks!
                    </p>
                    <a href="signup.html" style="display: block; padding: 14px; background: #2563eb; color: white; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 1.05rem; margin-bottom: 12px;">Sign Up — It's Free</a>
                    <button id="dismissGuestPrompt" style="background: none; border: none; color: #6b7280; cursor: pointer; font-size: 0.95rem; padding: 8px;">Maybe later</button>
                </div>
            `;
            document.body.appendChild(overlay);
            document.getElementById('dismissGuestPrompt').addEventListener('click', () => {
                overlay.remove();
            });
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.remove();
            });
        }, 30000);
    }

    // Guest mode localStorage methods
    loadGuestHabits() {
        const stored = localStorage.getItem('guest_habits');
        if (!stored) { this.habits = []; return; }
        this.habits = JSON.parse(stored).map(habit => ({
            ...habit,
            completedDates: [...new Set((habit.completedDates || [])
                .map(dateStr => this.normalizeDateString(dateStr))
                .filter(Boolean))]
        }));
    }

    saveGuestHabits() {
        localStorage.setItem('guest_habits', JSON.stringify(this.habits));
    }

    loadGuestTodos() {
        const stored = localStorage.getItem('guest_todos');
        this.todos = stored ? JSON.parse(stored) : [];
        this.renderTodos();
    }

    saveGuestTodos() {
        localStorage.setItem('guest_todos', JSON.stringify(this.todos));
    }

    setupEventListeners() {
        const addBtn = document.getElementById('addHabitBtn');
        const habitInput = document.getElementById('habitInput');
        const addTodoBtn = document.getElementById('addTodoBtn');
        const todoInput = document.getElementById('todoInput');

        if (addBtn) {
            addBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.addHabit();
            });
        }
        
        if (habitInput) {
            habitInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addHabit();
                }
            });
        }

        if (addTodoBtn) {
            addTodoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.addTodo();
            });
        }
        
        if (todoInput) {
            todoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addTodo();
                }
            });
        }
    }

    // Todo methods
    async loadTodos() {
        try {
            const response = await fetch(`${API_URL}/todos`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                credentials: 'include'
            });

            if (response.status === 401 || response.status === 403) {
                this.logout();
                return;
            }

            if (response.ok) {
                const data = await response.json();
                this.todos = data.todos.map(t => ({
                    id: String(t.id || t._id),
                    text: t.text,
                    completed: t.completed || false,
                    createdAt: t.created_at
                }));
            } else {
                this.todos = [];
            }
        } catch (error) {
            console.error('Failed to load todos:', error);
            this.todos = [];
        }
        this.renderTodos();
    }

    async addTodo() {
        const input = document.getElementById('todoInput');
        if (!input) return;

        const text = input.value.trim();

        if (!text) {
            alert('Please enter a todo');
            return;
        }

        if (this.isGuest) {
            this.todos.push({
                id: String(Date.now()),
                text,
                completed: false,
                createdAt: new Date().toISOString()
            });
            input.value = '';
            this.saveGuestTodos();
            this.renderTodos();
            return;
        }

        try {
            const response = await fetch(`${API_URL}/todos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                credentials: 'include',
                body: JSON.stringify({ text, completed: false })
            });

            if (response.ok) {
                const data = await response.json();
                this.todos.push({
                    id: String(data.todo.id || data.todo._id),
                    text: data.todo.text,
                    completed: data.todo.completed || false,
                    createdAt: data.todo.created_at || new Date().toISOString()
                });
                input.value = '';
                this.renderTodos();
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to create todo');
            }
        } catch (error) {
            console.error('Failed to add todo:', error);
            alert('Failed to add todo. Please check your connection.');
        }
    }

    async toggleTodo(id) {
        const todoId = String(id);
        const todo = this.todos.find(t => t.id === todoId);
        if (!todo) return;

        if (this.isGuest) {
            todo.completed = !todo.completed;
            this.saveGuestTodos();
            this.renderTodos();
            return;
        }

        try {
            const response = await fetch(`${API_URL}/todos/${todoId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                credentials: 'include',
                body: JSON.stringify({ completed: !todo.completed })
            });

            if (response.ok) {
                todo.completed = !todo.completed;
                this.renderTodos();
            }
        } catch (error) {
            console.error('Failed to toggle todo:', error);
        }
    }

    async deleteTodo(id) {
        const todoId = String(id);

        if (this.isGuest) {
            this.todos = this.todos.filter(t => t.id !== todoId);
            this.saveGuestTodos();
            this.renderTodos();
            return;
        }

        try {
            const response = await fetch(`${API_URL}/todos/${todoId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                credentials: 'include'
            });

            if (response.ok) {
                this.todos = this.todos.filter(t => t.id !== todoId);
                this.renderTodos();
            }
        } catch (error) {
            console.error('Failed to delete todo:', error);
        }
    }

    renderTodoItem(todo) {
        return `
            <div class="todo-item ${todo.completed ? 'completed' : ''}" data-todo-id="${todo.id}">
                <div class="todo-checkbox">
                    <input type="checkbox" id="todo-${todo.id}" ${todo.completed ? 'checked' : ''} data-action="toggle-todo">
                    <label for="todo-${todo.id}">
                        <span class="checkmark"></span>
                    </label>
                </div>
                <span class="todo-text">${this.escapeHtml(todo.text)}</span>
                <button class="todo-delete-btn" type="button" data-action="delete-todo">×</button>
            </div>
        `;
    }

    renderTodos() {
        const todoContainer = document.getElementById('todoList');
        const todoEmpty = document.getElementById('todoEmpty');

        if (this.todos.length === 0) {
            todoContainer.innerHTML = '';
            todoEmpty.classList.add('show');
        } else {
            todoEmpty.classList.remove('show');
            todoContainer.innerHTML = this.todos.map(todo => this.renderTodoItem(todo)).join('');
            this.attachTodoEventListeners();
        }
    }

    attachTodoEventListeners() {
        document.querySelectorAll('[data-action="toggle-todo"]').forEach(input => {
            input.addEventListener('change', (e) => {
                const todoId = e.target.closest('.todo-item').dataset.todoId;
                this.toggleTodo(todoId);
            });
        });

        document.querySelectorAll('[data-action="delete-todo"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const todoId = e.target.closest('.todo-item').dataset.todoId;
                this.deleteTodo(todoId);
            });
        });
    }

    // Habit methods

    async loadHabits() {
        try {
            const response = await fetch(`${API_URL}/habits`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                credentials: 'include'
            });

            if (response.status === 401 || response.status === 403) {
                this.logout();
                return;
            }

            const data = await response.json();
            this.habits = data.habits.map(h => ({
                id: h.id,
                name: h.name,
                completedDates: [...new Set((h.completedDates || [])
                    .map(dateStr => this.normalizeDateString(dateStr))
                    .filter(Boolean))],
                createdAt: h.created_at
            }));
            this.render();
        } catch (error) {
            console.error('Failed to load habits:', error);
            alert('Failed to load habits. Please make sure the server is running.');
        }
    }

    async addHabit() {
        const input = document.getElementById('habitInput');
        const name = input.value.trim();

        if (!name) {
            alert('Please enter a habit name');
            return;
        }

        if (this.isGuest) {
            this.habits.push({
                id: Date.now(),
                name,
                completedDates: [],
                createdAt: new Date().toISOString()
            });
            input.value = '';
            this.saveGuestHabits();
            this.render();
            return;
        }

        try {
            const response = await fetch(`${API_URL}/habits`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                credentials: 'include',
                body: JSON.stringify({ name })
            });

            if (response.ok) {
                const data = await response.json();
                this.habits.push({
                    id: data.habit.id,
                    name: data.habit.name,
                    completedDates: [],
                    createdAt: data.habit.created_at || new Date().toISOString()
                });
                input.value = '';
                this.render();
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to create habit');
            }
        } catch (error) {
            console.error('Failed to add habit:', error);
            alert('Failed to add habit. Please check your connection.');
        }
    }

    async deleteHabit(id) {
        if (!confirm('Are you sure you want to delete this habit?')) {
            return;
        }

        if (this.isGuest) {
            this.habits = this.habits.filter(h => h.id !== id && String(h.id) !== String(id));
            this.saveGuestHabits();
            this.render();
            return;
        }

        try {
            const response = await fetch(`${API_URL}/habits/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                credentials: 'include'
            });

            if (response.ok) {
                this.habits = this.habits.filter(h => h.id !== id);
                this.render();
            } else {
                alert('Failed to delete habit');
            }
        } catch (error) {
            console.error('Failed to delete habit:', error);
            alert('Failed to delete habit. Please check your connection.');
        }
    }

    async toggleDate(habitId, dateStr) {
        if (this.isGuest) {
            const habit = this.habits.find(h => h.id == habitId);
            if (!habit) return;
            const index = habit.completedDates.indexOf(dateStr);
            if (index > -1) {
                habit.completedDates.splice(index, 1);
            } else {
                habit.completedDates.push(dateStr);
            }
            this.saveGuestHabits();
            this.render();
            return;
        }

        try {
            const response = await fetch(`${API_URL}/habits/${habitId}/toggle`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                credentials: 'include',
                body: JSON.stringify({ date: dateStr })
            });

            if (response.ok) {
                const data = await response.json();
                const habit = this.habits.find(h => h.id === habitId);
                if (habit) {
                    if (data.completed) {
                        habit.completedDates.push(dateStr);
                    } else {
                        habit.completedDates = habit.completedDates.filter(d => d !== dateStr);
                    }
                    this.render();
                }
            }
        } catch (error) {
            console.error('Failed to toggle completion:', error);
        }
    }

    async markToday(habitId) {
        const today = this.getDateString(this.getToday());
        if (this.isGuest) {
            const habit = this.habits.find(h => h.id == habitId);
            if (!habit) return;
            if (!habit.completedDates.includes(today)) {
                habit.completedDates.push(today);
                this.saveGuestHabits();
                this.render();
            }
            return;
        }
        await this.toggleDate(habitId, today);
    }

    async logout() {
        if (this._guestPromptTimeout) clearTimeout(this._guestPromptTimeout);

        try {
            await fetch(`${API_URL}/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
        
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('sessionOnly');
        window.location.href = 'index.html';
    }

    // Use local dates to avoid timezone shifting to previous/next day
    getDateString(date) {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        return [
            d.getFullYear(),
            String(d.getMonth() + 1).padStart(2, '0'),
            String(d.getDate()).padStart(2, '0')
        ].join('-');
    }

    normalizeDateString(dateStr) {
        if (!dateStr) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr;
        }
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return '';
        return this.getDateString(date);
    }

    getToday() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    formatDate(dateStr) {
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getDate()}`;
    }

    formatWeekLabel(dateObj) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[dateObj.getMonth()]} ${dateObj.getDate()}`;
    }

    getCurrentWeek() {
        const today = this.getToday();

        const startOfWeek = new Date(today);
        const day = startOfWeek.getDay(); // 0 (Sun) - 6 (Sat)
        const diff = day === 0 ? -6 : 1 - day; // start on Monday
        startOfWeek.setDate(startOfWeek.getDate() + diff);

        const days = [];
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        for (let i = 0; i < 7; i++) {
            const current = new Date(startOfWeek);
            current.setDate(startOfWeek.getDate() + i);
            const dateStr = this.getDateString(current);

            days.push({
                label: dayNames[i],
                dateStr,
                display: this.formatDate(dateStr),
                isToday: dateStr === this.getDateString(today),
                isFuture: current > today
            });
        }

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        return { days, startOfWeek, endOfWeek };
    }

    calculateStats(habit) {
        const total = habit.completedDates.length;
        const currentStreak = this.calculateCurrentStreak(habit);
        const longestStreak = this.calculateLongestStreak(habit);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentCompletions = habit.completedDates.filter(date => 
            new Date(date) >= thirtyDaysAgo
        ).length;
        const completionRate = Math.round((recentCompletions / 30) * 100);

        return { total, currentStreak, longestStreak, completionRate };
    }

    calculateCurrentStreak(habit) {
        if (habit.completedDates.length === 0) return 0;

        const completedSet = new Set(habit.completedDates);
        let streak = 0;
        let currentDate = this.getToday();

        while (completedSet.has(this.getDateString(currentDate))) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        }

        return streak;
    }

    calculateLongestStreak(habit) {
        if (habit.completedDates.length === 0) return 0;

        const sortedDates = habit.completedDates
            .map(d => new Date(d))
            .sort((a, b) => a - b);

        let maxStreak = 1;
        let currentStreak = 1;

        for (let i = 1; i < sortedDates.length; i++) {
            const diffDays = Math.floor((sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 1;
            }
        }

        return maxStreak;
    }

    generateCalendar(habit) {
        const days = 30;
        const today = this.getToday();
        const calendar = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = this.getDateString(date);
            
            calendar.push({
                date: date,
                dateStr: dateStr,
                isCompleted: habit.completedDates.includes(dateStr),
                isToday: i === 0,
                isFuture: false,
                dayOfMonth: date.getDate(),
                displayDate: this.formatDate(dateStr)
            });
        }

        return calendar;
    }

    renderHabitCard(habit) {
        const stats = this.calculateStats(habit);
        const calendar = this.generateCalendar(habit);
        const todayStr = this.getDateString(new Date());
        const isTodayCompleted = habit.completedDates.includes(todayStr);

        return `
            <div class="habit-card" data-habit-id="${habit.id}">
                <div class="habit-header">
                    <h2 class="habit-title">${this.escapeHtml(habit.name)}</h2>
                    <div class="habit-actions">
                        <button class="mark-today-btn ${isTodayCompleted ? 'completed' : ''}" 
                                data-action="mark-today"
                                ${isTodayCompleted ? 'disabled' : ''}>
                            ${isTodayCompleted ? '✓ Done Today' : 'Mark Today'}
                        </button>
                        <button class="delete-habit-btn" data-action="delete-habit">
                            Delete
                        </button>
                    </div>
                </div>

                <div class="stats-row">
                    <div class="stat-box">
                        <div class="stat-label">Current Streak</div>
                        <div class="stat-value">${stats.currentStreak} 🔥</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Longest Streak</div>
                        <div class="stat-value">${stats.longestStreak}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Total Days</div>
                        <div class="stat-value">${stats.total}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">30-Day Rate</div>
                        <div class="stat-value">${stats.completionRate}%</div>
                    </div>
                </div>

                <div class="calendar-section">
                    <div class="calendar-header">
                        <div class="calendar-title">Last 30 Days</div>
                    </div>
                    <div class="calendar-grid" data-habit-id="${habit.id}">
                        ${calendar.map(day => `
                            <div class="day-cell ${day.isCompleted ? 'completed' : ''} ${day.isToday ? 'today' : ''}"
                                 data-date="${day.dateStr}"
                                 role="button"
                                 tabindex="0">
                                <span>${day.dayOfMonth}</span>
                                <div class="tooltip">
                                    ${day.displayDate}${day.isCompleted ? ' ✓' : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="calendar-legend">
                        <span>Less</span>
                        <div class="legend-item">
                            <div class="legend-box" style="background: var(--level-0)"></div>
                        </div>
                        <div class="legend-item">
                            <div class="legend-box" style="background: var(--level-4)"></div>
                        </div>
                        <span>More</span>
                    </div>
                </div>
            </div>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    renderWeekly() {
        const grid = document.getElementById('weeklyGrid');
        const rangeEl = document.getElementById('weeklyRange');
        if (!grid) return;

        const { days, startOfWeek, endOfWeek } = this.getCurrentWeek();

        if (rangeEl) {
            rangeEl.textContent = `${this.formatWeekLabel(startOfWeek)} - ${this.formatWeekLabel(endOfWeek)}`;
        }

        if (this.habits.length === 0) {
            grid.innerHTML = '<div class="weekly-empty">Add habits to see your weekly tracker.</div>';
            return;
        }

        const headerRow = `
            <div class="weekly-row weekly-header-row">
                <div class="weekly-name-cell">Habit</div>
                ${days.map(day => `
                    <div class="weekly-day-cell ${day.isToday ? 'today' : ''}">
                        <div class="week-day">${day.label}</div>
                        <div class="week-date">${day.display}</div>
                    </div>
                `).join('')}
            </div>
        `;

        const habitRows = this.habits.map(habit => `
            <div class="weekly-row" data-habit-id="${habit.id}">
                <div class="weekly-name-cell">${this.escapeHtml(habit.name)}</div>
                ${days.map(day => {
                    const isDone = habit.completedDates.includes(day.dateStr);
                    const disabled = day.isFuture ? 'disabled' : '';
                    return `
                        <div class="weekly-day-cell ${day.isToday ? 'today' : ''} ${day.isFuture ? 'future' : ''}">
                            <label class="weekly-checkbox">
                                <input type="checkbox" data-date="${day.dateStr}" ${isDone ? 'checked' : ''} ${disabled}>
                                <span aria-label="Mark ${this.escapeHtml(habit.name)} for ${day.display}"></span>
                            </label>
                        </div>
                    `;
                }).join('')}
            </div>
        `).join('');

        grid.innerHTML = headerRow + habitRows;
    }

    render() {
        this.renderWeekly();

        const container = document.getElementById('habitsContainer');
        const emptyState = document.getElementById('emptyState');

        if (this.habits.length === 0) {
            container.innerHTML = '';
            emptyState.classList.add('show');
        } else {
            emptyState.classList.remove('show');
            container.innerHTML = this.habits.map(habit => this.renderHabitCard(habit)).join('');
            
            // Attach event listeners
            this.attachEventListeners();
        }
    }

    attachEventListeners() {
        // Mark today buttons
        document.querySelectorAll('[data-action="mark-today"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const habitId = e.target.closest('.habit-card').dataset.habitId;
                this.markToday(habitId);
            });
        });

        // Delete buttons
        document.querySelectorAll('[data-action="delete-habit"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const habitId = e.target.closest('.habit-card').dataset.habitId;
                this.deleteHabit(habitId);
            });
        });

        // Calendar day cells
        document.querySelectorAll('.day-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                const habitId = e.target.closest('[data-habit-id]').dataset.habitId;
                const dateStr = cell.dataset.date;
                this.toggleDate(habitId, dateStr);
            });
        });

        // Weekly checkboxes
        document.querySelectorAll('.weekly-checkbox input[type="checkbox"]').forEach(input => {
            input.addEventListener('change', (e) => {
                const habitId = e.target.closest('[data-habit-id]').dataset.habitId;
                const dateStr = input.dataset.date;
                this.toggleDate(habitId, dateStr);
            });
        });
    }
}

// Initialize app
const app = new HabitTracker();
