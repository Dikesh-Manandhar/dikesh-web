// Habit Tracker App
class HabitTracker {
    constructor() {
        this.habits = this.loadHabits();
        this.todos = this.loadTodos();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.render();
    }

    setupEventListeners() {
        const addBtn = document.getElementById('addHabitBtn');
        const habitInput = document.getElementById('habitInput');
        const addTodoBtn = document.getElementById('addTodoBtn');
        const todoInput = document.getElementById('todoInput');

        addBtn.addEventListener('click', () => this.addHabit());
        habitInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addHabit();
        });

        addTodoBtn.addEventListener('click', () => this.addTodo());
        todoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTodo();
        });
    }

    // Habit methods
    loadHabits() {
        const stored = localStorage.getItem('habits');
        if (!stored) return [];
        const habits = JSON.parse(stored);
        return habits.map(habit => ({
            ...habit,
            completedDates: [...new Set((habit.completedDates || [])
                .map(dateStr => this.normalizeDateString(dateStr))
                .filter(Boolean))]
        }));
    }

    saveHabits() {
        localStorage.setItem('habits', JSON.stringify(this.habits));
    }

    addHabit() {
        const input = document.getElementById('habitInput');
        const name = input.value.trim();

        if (!name) {
            alert('Please enter a habit name');
            return;
        }

        const habit = {
            id: Date.now(),
            name: name,
            completedDates: [],
            createdAt: new Date().toISOString()
        };

        this.habits.push(habit);
        this.saveHabits();
        input.value = '';
        this.render();
    }

    deleteHabit(id) {
        if (confirm('Are you sure you want to delete this habit?')) {
            this.habits = this.habits.filter(h => h.id !== id);
            this.saveHabits();
            this.render();
        }
    }

    toggleDate(habitId, dateStr) {
        const habit = this.habits.find(h => h.id === habitId);
        if (!habit) return;

        const index = habit.completedDates.indexOf(dateStr);
        if (index > -1) {
            habit.completedDates.splice(index, 1);
        } else {
            habit.completedDates.push(dateStr);
        }

        this.saveHabits();
        this.render();
    }

    markToday(habitId) {
        const today = this.getDateString(new Date());
        const habit = this.habits.find(h => h.id === habitId);
        
        if (!habit) return;

        if (!habit.completedDates.includes(today)) {
            habit.completedDates.push(today);
            this.saveHabits();
            this.render();
        }
    }

    getDateString(date) {
        return date.toISOString().split('T')[0];
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

    formatDate(dateStr) {
        const date = new Date(dateStr);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getDate()}`;
    }

    // Todo methods
    loadTodos() {
        const stored = localStorage.getItem('todos');
        return stored ? JSON.parse(stored) : [];
    }

    saveTodos() {
        localStorage.setItem('todos', JSON.stringify(this.todos));
    }

    addTodo() {
        const input = document.getElementById('todoInput');
        const text = input.value.trim();

        if (!text) {
            alert('Please enter a todo');
            return;
        }

        const todo = {
            id: Date.now(),
            text: text,
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.todos.push(todo);
        this.saveTodos();
        input.value = '';
        this.render();
    }

    toggleTodo(id) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.completed = !todo.completed;
            this.saveTodos();
            this.render();
        }
    }

    deleteTodo(id) {
        this.todos = this.todos.filter(t => t.id !== id);
        this.saveTodos();
        this.render();
    }

    clearCompletedTodos() {
        this.todos = this.todos.filter(t => !t.completed);
        this.saveTodos();
        this.render();
    }

    calculateStats(habit) {
        const total = habit.completedDates.length;
        const currentStreak = this.calculateCurrentStreak(habit);
        const longestStreak = this.calculateLongestStreak(habit);

        // Calculate completion rate for last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentCompletions = habit.completedDates.filter(date => 
            new Date(date) >= thirtyDaysAgo
        ).length;
        const completionRate = Math.round((recentCompletions / 30) * 100);

        return {
            total,
            currentStreak,
            longestStreak,
            completionRate
        };
    }

    calculateCurrentStreak(habit) {
        if (habit.completedDates.length === 0) return 0;

        const completedSet = new Set(habit.completedDates);
        let streak = 0;
        let currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);

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
        const days = 30; // Show last 30 days
        const today = new Date();
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
            <div class="habit-card">
                <div class="habit-header">
                    <h2 class="habit-title">${this.escapeHtml(habit.name)}</h2>
                    <div class="habit-actions">
                        <button class="mark-today-btn ${isTodayCompleted ? 'completed' : ''}" 
                                onclick="app.markToday(${habit.id})"
                                ${isTodayCompleted ? 'disabled' : ''}>
                            ${isTodayCompleted ? '✓ Done Today' : 'Mark Today'}
                        </button>
                        <button class="delete-habit-btn" onclick="app.deleteHabit(${habit.id})">
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
                    <div class="calendar-grid">
                        ${calendar.map(day => `
                            <div class="day-cell ${day.isCompleted ? 'completed' : ''} ${day.isToday ? 'today' : ''}"
                                 onclick="app.toggleDate(${habit.id}, '${day.dateStr}')">
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

    render() {
        const container = document.getElementById('habitsContainer');
        const emptyState = document.getElementById('emptyState');

        if (this.habits.length === 0) {
            container.innerHTML = '';
            emptyState.classList.add('show');
        } else {
            emptyState.classList.remove('show');
            container.innerHTML = this.habits.map(habit => this.renderHabitCard(habit)).join('');
        }

        // Render todos
        this.renderTodos();
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
}

// Initialize app
const app = new HabitTracker();
