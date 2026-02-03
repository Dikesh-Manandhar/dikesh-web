// Habit Tracker App with Backend Integration
// Dynamic API URL detection
const API_URL = (() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';
    }
    return `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}/api`;
})();

class HabitTracker {
    constructor() {
        this.habits = [];
        this.todos = [];
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
        this.init();
    }

    async init() {
        // Check authentication
        if (!this.token) {
            window.location.href = 'login.html';
            return;
        }

        // Add logout button
        this.addLogoutButton();
        
        this.setupEventListeners();
        this.loadTodos();
        await this.loadHabits();
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
            this.attachTodoEventListeners();
                this.logout();
                return;
            }

            if (response.ok) {
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
            console.error('Failed to load todos:', error);
            this.todos = [];

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
                    id: data.todo.id,
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
        const todo = this.todos.find(t => t.id === id);
        if (!todo) return;

        try {
            const response = await fetch(`${API_URL}/todos/${id}`, {
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
        try {
            const response = await fetch(`${API_URL}/todos/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                credentials: 'include'
            });

            if (response.ok) {
                this.todos = this.todos.filter(t => t.id !== id);
                this.renderTodos();
            }
        } catch (error) {
            console.error('Failed to delete todo:', error);
        }
    }

    renderTodoItem(todo) {
        return `
            <div class="todo-item ${todo.completed ? 'completed' : ''}">
                <div class="todo-checkbox">
                    <input type="checkbox" id="todo-${todo.id}" ${todo.completed ? 'checked' : ''} 
                           onchange="app.toggleTodo(${todo.id})">
                    <label for="todo-${todo.id}">
                        <span class="checkmark"></span>
                    </label>
                </div>
                <span class="todo-text">${this.escapeHtml(todo.text)}</span>
                <button class="todo-delete-btn" onclick="app.deleteTodo(${todo.id})">×</button>
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
        }
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
                completedDates: h.completedDates || [],
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
        await this.toggleDate(habitId, today);
    }

    async logout() {
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
        window.location.href = 'login.html';
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

        let streak = 0;
        let currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);

        for (let i = 0; i <= 1; i++) {
            const checkDate = this.getDateString(currentDate);
            if (habit.completedDates.includes(checkDate)) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
                i = -1;
            } else if (i === 0) {
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
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
