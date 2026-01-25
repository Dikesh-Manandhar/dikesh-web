// Habit Tracker App
class HabitTracker {
    constructor() {
        this.habits = this.loadHabits();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.render();
    }

    setupEventListeners() {
        const addBtn = document.getElementById('addHabitBtn');
        const habitInput = document.getElementById('habitInput');

        addBtn.addEventListener('click', () => this.addHabit());
        habitInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addHabit();
        });
    }

    loadHabits() {
        const stored = localStorage.getItem('habits');
        return stored ? JSON.parse(stored) : [];
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

    formatDate(dateStr) {
        const date = new Date(dateStr);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getDate()}`;
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

        const sortedDates = habit.completedDates
            .map(d => new Date(d))
            .sort((a, b) => b - a);

        let streak = 0;
        let currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);

        for (let i = 0; i <= 1; i++) {
            const checkDate = this.getDateString(currentDate);
            if (habit.completedDates.includes(checkDate)) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
                i = -1; // Continue checking previous days
            } else if (i === 0) {
                // Check yesterday
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
        const days = 90; // Show last 90 days
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
                        <div class="calendar-title">Last 90 Days</div>
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
    }
}

// Initialize app
const app = new HabitTracker();
