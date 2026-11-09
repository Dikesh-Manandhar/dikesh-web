/**
 * PoseCoach AI - Core Logic
 * Implements robust rep counting with multi-view support and visual guidance.
 */

// --- 1. Pose & Coordinate Utilities ---

class PoseUtils {
    static toPixel(landmark, width, height) {
        return { x: landmark.x * width, y: landmark.y * height, z: landmark.z };
    }

    static calculateAngle(a, b, c) {
        const u = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
        const v = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
        const dot = u.x * v.x + u.y * v.y + u.z * v.z;
        const cross = [
            u.y * v.z - u.z * v.y,
            u.z * v.x - u.x * v.z,
            u.x * v.y - u.y * v.x
        ];
        const normCross = Math.hypot(...cross);
        if (Math.hypot(u.x, u.y, u.z) < 1e-6 || Math.hypot(v.x, v.y, v.z) < 1e-6) return null;
        return Math.atan2(normCross, dot) * 180 / Math.PI;
    }

    static getDistance(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    }

    static createEMAFilter(alpha = 0.45) {
        let prev = null;
        return (cur) => {
            if (prev === null) { prev = cur; return cur; }
            prev = alpha * cur + (1 - alpha) * prev;
            return prev;
        };
    }
}

// --- 2. Repetition State Machine ---

const RepState = {
    WAITING_FOR_START: 'Position yourself',
    READY_AT_TOP: 'Ready',
    DESCENDING: 'Lowering...',
    BOTTOM_REACHED: 'Deep enough!',
    ASCENDING: 'Push up!',
};

class RepStateMachine {
    constructor(config) {
        this.config = config;
        this.state = RepState.WAITING_FOR_START;
        this.count = 0;
        this.hasReachedBottom = false;
    }

    update(currentProgress, isPostureValid) {
        if (!isPostureValid) {
            this.state = RepState.WAITING_FOR_START;
            return { state: this.state, count: this.count, reason: "Invalid Posture" };
        }

        const progress = currentProgress;
        switch (this.state) {
            case RepState.WAITING_FOR_START:
                if (progress < this.config.topThresh) this.state = RepState.READY_AT_TOP;
                break;
            case RepState.READY_AT_TOP:
                if (progress > this.config.topThresh + this.config.hysteresis) this.state = RepState.DESCENDING;
                break;
            case RepState.DESCENDING:
                if (progress >= this.config.bottomThresh) {
                    this.state = RepState.BOTTOM_REACHED;
                    this.hasReachedBottom = true;
                } else if (progress < this.config.topThresh) {
                    this.state = RepState.READY_AT_TOP;
                }
                break;
            case RepState.BOTTOM_REACHED:
                if (progress < this.config.bottomThresh - this.config.hysteresis) this.state = RepState.ASCENDING;
                break;
            case RepState.ASCENDING:
                if (progress < this.config.topThresh) {
                    if (this.hasReachedBottom) { this.count++; this.hasReachedBottom = false; }
                    this.state = RepState.READY_AT_TOP;
                }
                break;
        }
        return { state: this.state, count: this.count, reason: "" };
    }
}

// --- 3. Exercise Definitions ---

class PushupExercise {
    constructor() {
        this.name = "Pushups";
        this.mustHave = [11, 12, 23, 24];
        this.config = { topAngle: 160, bottomAngle: 90, topThresh: 15, bottomThresh: 85, hysteresis: 10 };
        this.sm = new RepStateMachine({ topThresh: this.config.topThresh, bottomThresh: this.config.bottomThresh, hysteresis: this.config.hysteresis });
        this.filter = PoseUtils.createEMAFilter(0.4);
        this.viewMode = "SIDE";
    }

    detectViewMode(landmarks) {
        const shoulderWidth = PoseUtils.getDistance(landmarks[11], landmarks[12]);
        const sX = (landmarks[11].x + landmarks[12].x) / 2;
        const hX = (landmarks[23].x + landmarks[24].x) / 2;
        const xOffset = Math.abs(sX - hX);
        return (xOffset < shoulderWidth * 0.6) ? "FRONT" : "SIDE";
    }

    checkPosture(landmarks, width, height) {
        for (let id of this.mustHave) {
            if (!landmarks[id] || landmarks[id].visibility < 0.3) {
                return { valid: false, reason: "Body not fully visible" };
            }
        }

        this.viewMode = this.detectViewMode(landmarks);

        if (this.viewMode === "SIDE") {
            const sIdx = landmarks[11].visibility > landmarks[12].visibility ? 11 : 12;
            const hIdx = landmarks[23].visibility > landmarks[24].visibility ? 23 : 24;
            const aIdx = landmarks[27].visibility > landmarks[28].visibility ? 27 : 28;
            if (landmarks[aIdx].visibility < 0.4) return { valid: true };
            const s = PoseUtils.toPixel(landmarks[sIdx], width, height);
            const h = PoseUtils.toPixel(landmarks[hIdx], width, height);
            const a = PoseUtils.toPixel(landmarks[aIdx], width, height);
            const linearity = (PoseUtils.getDistance(s, h) + PoseUtils.getDistance(h, a)) / PoseUtils.getDistance(s, a);
            if (linearity > 1.3) return { valid: false, reason: "Fix your plank alignment" };
        } else {
            // FRONT VIEW: Be more lenient. Just check if the person is not standing upright.
            const sY = (landmarks[11].y + landmarks[12].y) / 2;
            const hY = (landmarks[23].y + landmarks[24].y) / 2;
            const verticalDiff = Math.abs(sY - hY);
            // If the vertical gap between shoulders and hips is too large, they are likely standing.
            if (verticalDiff > 0.3) return { valid: false, reason: "Please get into push-up position" };
        }
        return { valid: true };
    }

    update(landmarks, width, height) {
        const posture = this.checkPosture(landmarks, width, height);
        if (!posture.valid) {
            const result = this.sm.update(0, false);
            return { ...result, progress: 0, issues: [posture.reason], state: posture.reason };
        }

        const leftVis = landmarks[13]?.visibility || 0;
        const rightVis = landmarks[14]?.visibility || 0;
        let angle = null;
        if (leftVis > 0.4 && rightVis > 0.4) {
            angle = (PoseUtils.calculateAngle(landmarks[11], landmarks[13], landmarks[15]) + PoseUtils.calculateAngle(landmarks[12], landmarks[14], landmarks[16])) / 2;
        } else if (leftVis > 0.4) {
            angle = PoseUtils.calculateAngle(landmarks[11], landmarks[13], landmarks[15]);
        } else if (rightVis > 0.4) {
            angle = PoseUtils.calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
        }

        if (angle === null) return { ...this.sm.update(0, false), progress: 0, issues: ["Arms not visible"], state: "Adjust camera" };

        const smoothedAngle = this.filter(angle);
        const progress = Math.max(0, Math.min(100, ((this.config.topAngle - smoothedAngle) / (this.config.topAngle - this.config.bottomAngle)) * 100));
        const result = this.sm.update(progress, true);
        const issues = [];
        if (leftVis > 0.4 && rightVis > 0.4) {
            if (PoseUtils.calculateAngle(landmarks[11], landmarks[13], landmarks[15]) < 60 || PoseUtils.calculateAngle(landmarks[12], landmarks[14], landmarks[16]) < 60) issues.push("Elbows flaring");
        }
        return { ...result, progress, issues, state: this.sm.state };
    }
}

// --- 4. Main Application Logic ---

const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const loadingOverlay = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');
const feedbackDiv = document.getElementById('feedback');
const exerciseSelect = document.getElementById('exercise_select');
const startBtn = document.getElementById('start_btn');
const stopBtn = document.getElementById('stop_btn');
const countVal = document.getElementById('count_val');
const rangeVal = document.getElementById('range_val');
const progressBar = document.getElementById('progress-bar');
const guideOverlay = document.getElementById('guide-overlay');
const guideTitle = document.getElementById('guide-title');
const guideText = document.getElementById('guide-text');
const guideIcon = document.getElementById('guide-icon');

let isRunning = false;
let activeExercise = null;
let pose = null;
let camera = null;

const GUIDE_DATA = {
    "Pushups": {
        title: "Push-up Setup",
        text: "Place your phone on the floor. Ensure your full body is visible from the side or front.",
        icon: "💪"
    },
    "Squats": {
        title: "Squat Setup",
        text: "Position camera at hip height. Ensure your knees and ankles are clearly visible.",
        icon: "🦵"
    },
    "Pullups": {
        title: "Pull-up Setup",
        text: "Ensure the camera captures your entire range of motion from the bar to full extension.",
        icon: "🏋️"
    }
};

function showGuide(exercise) {
    const data = GUIDE_DATA[exercise];
    if (!data) return;
    guideTitle.innerText = data.title;
    guideText.innerText = data.text;
    guideIcon.innerText = data.icon;
    guideOverlay.style.display = "flex";
}

function hideGuide() {
    guideOverlay.style.display = "none";
}

function onResults(results) {
    if (!results.poseLandmarks) return;
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    const landmarks = results.poseLandmarks;
    drawConnectors(canvasCtx, landmarks, POSE_CONNECTIONS, {color: '#4ade80', lineWidth: 6});
    drawLandmarks(canvasCtx, landmarks, {color: '#facc15', lineWidth: 3});

    if (isRunning && activeExercise) {
        const { state, count, progress, issues } = activeExercise.update(landmarks, window.innerWidth, window.innerHeight);
        countVal.innerText = count;
        rangeVal.innerText = Math.round(progress) + "% Range";
        progressBar.style.width = progress + "%";
        if (issues.length > 0) {
            feedbackDiv.innerText = issues[0];
            if (issues[0] === "Position yourself" || issues[0] === "Invalid Posture") showGuide(exerciseSelect.value);
        } else {
            feedbackDiv.innerText = state;
            hideGuide();
        }
    }
}

async function initAI() {
    try {
        loadingText.innerText = "Initializing AI Engine...";
        pose = new Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
        pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        pose.onResults(onResults);
        camera = new Camera(videoElement, { onFrame: async () => { await pose.send({ image: videoElement }); }, width: 1280, height: 720 });
        loadingOverlay.style.display = "none";
        feedbackDiv.innerText = "Ready to track your session!";
    } catch (e) {
        console.error(e);
        loadingOverlay.style.display = "none";
        feedbackDiv.innerText = "Error initializing AI. Please refresh.";
    }
}

startBtn.addEventListener("click", () => {
    if (!isRunning) {
        const exType = exerciseSelect.value;
        if (exType === "Pushups") activeExercise = new PushupExercise();
        else { alert("Only Pushups are fully implemented in this version."); return; }
        isRunning = true;
        startBtn.innerText = "Running...";
        startBtn.disabled = true;
        camera.start();
    }
});

stopBtn.addEventListener("click", () => {
    isRunning = false;
    startBtn.innerText = "Start Session";
    startBtn.disabled = false;
    feedbackDiv.innerText = "Session stopped.";
    progressBar.style.width = "0%";
    hideGuide();
    if (camera) camera.stop();
});

window.addEventListener('resize', () => {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
});

initAI();
