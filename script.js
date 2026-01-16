
// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => console.log('ServiceWorker registration successful with scope: ', registration.scope))
            .catch(err => console.log('ServiceWorker registration failed: ', err));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURATION ---
    const GOOGLE_SHEET_ID = '1ZMEfBGZQHGf-UVvNJj8D7cOhQ3M2Z2cYNBrNMT4pnn0';
    const BASE_OPENSHEET_URL = `https://opensheet.elk.sh/${GOOGLE_SHEET_ID}/`;
    const AVAILABLE_LEVELS = ["Level 1", "Level 2", "Level 3", "Level 4", "Level 5", "Level 6"];
    const MEDIAPIPE_HANDS_CONFIG = {
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1635986972/${file}`
    };
    const HANDS_OPTIONS = {
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    };

    // --- 2. UI ELEMENTS ---
    const ui = {
        videoElement: document.getElementById('video-input'),
        outputCanvas: document.getElementById('output-canvas'),
        ctx: document.getElementById('output-canvas').getContext('2d'),
        score: document.getElementById('score'),
        questionCounter: document.getElementById('question-counter'),
        cameraPermissionScreen: document.getElementById('camera-permission'),
        levelSelectionScreen: document.getElementById('level-selection-screen'),
        startScreen: document.getElementById('start-screen'),
        gameOverScreen: document.getElementById('game-over'),
        cameraBtn: document.getElementById('camera-btn'),
        startBtn: document.getElementById('start-btn'),
        restartBtn: document.getElementById('restart-btn'),
        sheetNameInput: document.getElementById('sheet-name-input'),
        goBtn: document.getElementById('go-btn'),
        levelButtonsContainer: document.getElementById('level-buttons-container'),
        mainMenuBtn: document.getElementById('main-menu-btn'),
        bgmVolumeSlider: document.getElementById('bgm-volume'),
        sfxVolumeSlider: document.getElementById('sfx-volume'),
        finalScore: document.getElementById('final-score'),
        handStatus: document.getElementById('hand-status'),
        videoContainer: document.querySelector('.video-container'),
        wordContainer: document.getElementById('word-container'),
        feedback: document.getElementById('feedback'),
        startScreenTitle: document.getElementById('start-screen-title'),
        startScreenDescription: document.getElementById('start-screen-description'),
    };

    // --- 3. AUDIO ELEMENTS ---
    const audio = {
        backgroundMusic: document.getElementById('backgroundMusic'),
        buttonClick: document.getElementById('buttonClickSound'),
        popBubble: document.getElementById('popBubbleSound'),
        correctAnswer: document.getElementById('correctAnswerSound'),
        wrongAnswer: document.getElementById('wrongAnswerSound'),
    };

    // --- 4. GAME STATE ---
    const state = {
        score: 0,
        currentQuestionIndex: 0,
        gameActive: false,
        letterBubbles: [],
        handLandmarks: null,
        cameraInitialized: false,
        videoAspectRatio: 16 / 9,
        currentWord: "",
        correctLetter: "",
        selectedQuestions: [],
        waitingForNextQuestion: false,
        selectedLevelName: '',
    };

    const hands = new Hands(MEDIAPIPE_HANDS_CONFIG);
    hands.setOptions(HANDS_OPTIONS);
    hands.onResults(onHandResults);

    // --- 5. CORE FUNCTIONS ---

    // --- 5a. UI & Drawing Functions ---
    const showScreen = (screen) => {
        [ui.cameraPermissionScreen, ui.levelSelectionScreen, ui.startScreen, ui.gameOverScreen].forEach(s => s.style.display = 'none');
        if (screen) {
            screen.style.display = 'flex';
        }
    };

    const updateCanvasSize = () => {
        const { clientWidth: containerWidth, clientHeight: containerHeight } = ui.videoContainer;
        let canvasWidth, canvasHeight;

        if (containerWidth / containerHeight > state.videoAspectRatio) {
            canvasHeight = containerHeight;
            canvasWidth = containerHeight * state.videoAspectRatio;
        } else {
            canvasWidth = containerWidth;
            canvasHeight = containerWidth / state.videoAspectRatio;
        }

        ui.outputCanvas.width = canvasWidth;
        ui.outputCanvas.height = canvasHeight;
        ui.outputCanvas.style.left = `${(containerWidth - canvasWidth) / 2}px`;
        ui.outputCanvas.style.top = `${(containerHeight - canvasHeight) / 2}px`;
        ui.videoElement.style.width = `${canvasWidth}px`;
        ui.videoElement.style.height = `${canvasHeight}px`;
    };

    const displayWord = (word, missingIndex) => {
        ui.wordContainer.innerHTML = word.split('').map((letter, i) =>
            `<div class="letter-box ${i === missingIndex ? 'missing' : ''}">${i === missingIndex ? '?' : letter}</div>`
        ).join('');
    };

    const createLetterBubbles = (options) => {
        const { width: canvasWidth, height: canvasHeight } = ui.outputCanvas;
        const bubbleRadius = Math.min(canvasWidth, canvasHeight) * 0.05;

        const positions = shuffleArray([
            { x: canvasWidth * 0.25, y: canvasHeight * 0.3 },
            { x: canvasWidth * 0.5, y: canvasHeight * 0.3 },
            { x: canvasWidth * 0.75, y: canvasHeight * 0.3 },
        ]);

        state.letterBubbles = options.map((letter, i) => ({
            x: positions[i].x,
            y: positions[i].y,
            radius: bubbleRadius,
            letter,
            isCorrect: letter === state.correctLetter,
            createdAt: Date.now(),
            popped: false,
        }));
    };

    const drawLetterBubbles = () => {
        state.letterBubbles.forEach(bubble => {
            if (bubble.popped) return;
            const { ctx } = ui;
            const age = Date.now() - bubble.createdAt;
            const pulseScale = 1 + 0.05 * Math.sin(age / 300);
            const floatOffset = Math.sin(age / 1000) * 5;

            ctx.save();
            ctx.beginPath();
            ctx.arc(bubble.x, bubble.y + floatOffset, bubble.radius * pulseScale, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#333';
            ctx.font = `bold ${bubble.radius * 0.8}px Comic Sans MS, Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.scale(-1, 1);
            ctx.fillText(bubble.letter, -bubble.x, bubble.y + floatOffset);
            ctx.restore();
        });
    };
    
    const showFeedback = (message, isCorrect) => {
        ui.feedback.textContent = message;
        ui.feedback.className = `feedback ${isCorrect ? 'correct' : 'incorrect'}`;
        ui.feedback.style.opacity = 1;
        setTimeout(() => { ui.feedback.style.opacity = 0; }, 1500);
    };

    // --- 5b. Audio Functions ---
    const playSound = (sound) => {
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => {
                if (e.name !== 'AbortError') {
                    console.error("Audio playback failed:", e);
                }
            });
        }
    };

    const initializeAudio = () => {
        audio.backgroundMusic.volume = ui.bgmVolumeSlider.value;
        playSound(audio.backgroundMusic);
    };
    
    const setSfxVolume = (volume) => {
        [audio.buttonClick, audio.popBubble, audio.correctAnswer, audio.wrongAnswer].forEach(s => {
            if (s) s.volume = volume;
        });
    };
    
    // --- 5c. API & Data Handling ---
    const shuffleArray = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    };

    const fetchWords = async (sheetName) => {
        try {
            const response = await fetch(`${BASE_OPENSHEET_URL}${encodeURIComponent(sheetName)}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data.map(row => row.Word?.toUpperCase()).filter(word => word && word.length > 1);
        } catch (error) {
            console.error(`Error fetching words for ${sheetName}:`, error);
            alert(`Failed to load words for "${sheetName}". Please check the sheet name and public access.`);
            return [];
        }
    };
    
    const generateQuestionData = (word) => {
        const missingIndex = Math.floor(Math.random() * (word.length - 2)) + 1;
        const correctLetter = word[missingIndex];
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const incorrectLetters = [];
        while (incorrectLetters.length < 2) {
            const randomLetter = alphabet[Math.floor(Math.random() * alphabet.length)];
            if (randomLetter !== correctLetter && !incorrectLetters.includes(randomLetter)) {
                incorrectLetters.push(randomLetter);
            }
        }
        return {
            word,
            missingIndex,
            correctLetter,
            options: shuffleArray([correctLetter, ...incorrectLetters]),
        };
    };

    // --- 5d. Camera & MediaPipe ---
    const initCamera = async () => {
        if (state.cameraInitialized) return;
        initializeAudio();

        const processVideo = async () => {
            // Ensure the video is playing before sending frames
            if (!ui.videoElement.paused && !ui.videoElement.ended) {
                await hands.send({ image: ui.videoElement });
            }
            requestAnimationFrame(processVideo);
        };

        try {
            // Simplified constraints for better mobile compatibility
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            ui.videoElement.srcObject = stream;

            ui.videoElement.onloadedmetadata = () => {
                ui.videoElement.play();
                state.videoAspectRatio = ui.videoElement.videoWidth / ui.videoElement.videoHeight;
                updateCanvasSize();
                state.cameraInitialized = true;
                showLevelSelectionScreen();
                processVideo(); // Start the processing loop
            };
        } catch (err) {
            console.error("Failed to acquire camera feed: ", err);
            alert(`Failed to acquire camera feed: ${err.name}: ${err.message}`);
        }
    };
    
    function onHandResults(results) {
        const { ctx, outputCanvas } = ui;
        ctx.save();
        ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
        ctx.drawImage(results.image, 0, 0, outputCanvas.width, outputCanvas.height);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            state.handLandmarks = results.multiHandLandmarks[0];
            ui.handStatus.textContent = "Yes";
            drawConnectors(ctx, state.handLandmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 3 });
            drawLandmarks(ctx, state.handLandmarks, { color: '#FF0000', radius: 3 });
            if (state.gameActive && !state.waitingForNextQuestion) {
                checkBubbleCollision();
            }
        } else {
            state.handLandmarks = null;
            ui.handStatus.textContent = "No";
        }

        drawLetterBubbles();
        ctx.restore();
    }
    
    // --- 5e. Game Logic ---
    const loadQuestion = (question) => {
        state.currentWord = question.word;
        state.correctLetter = question.correctLetter;
        state.waitingForNextQuestion = false;

        displayWord(question.word, question.missingIndex);
        createLetterBubbles(question.options);
        ui.questionCounter.textContent = `${state.currentQuestionIndex + 1}/${state.selectedQuestions.length}`;
    };

    const checkBubbleCollision = () => {
        if (!state.handLandmarks?.[8]) return; // Index finger tip landmark

        const indexFinger = {
            x: state.handLandmarks[8].x * ui.outputCanvas.width,
            y: state.handLandmarks[8].y * ui.outputCanvas.height,
        };

        for (const bubble of state.letterBubbles) {
            if (bubble.popped) continue;

            const distance = Math.hypot(indexFinger.x - bubble.x, indexFinger.y - bubble.y);
            if (distance < bubble.radius) {
                handleBubblePop(bubble);
                break; 
            }
        }
    };

    const handleBubblePop = (bubble) => {
        bubble.popped = true;
        state.waitingForNextQuestion = true;
        playSound(audio.popBubble);

        if (bubble.isCorrect) {
            state.score++;
            ui.score.textContent = state.score;
            showFeedback("Correct! 🎉", true);
            playSound(audio.correctAnswer);
        } else {
            showFeedback("Try again! 🤔", false);
            playSound(audio.wrongAnswer);
        }

        setTimeout(() => {
            state.currentQuestionIndex++;
            if (state.currentQuestionIndex < state.selectedQuestions.length) {
                loadQuestion(state.selectedQuestions[state.currentQuestionIndex]);
            } else {
                endGame();
            }
        }, 1500);
    };

    const startGame = async () => {
        playSound(audio.buttonClick);
        if (!state.selectedLevelName) {
            alert("Please choose a level.");
            return;
        }

        ui.startScreenTitle.textContent = `Loading ${state.selectedLevelName}...`;
        ui.startScreenDescription.textContent = 'Fetching quiz words...';
        ui.startBtn.style.display = 'none';

        const words = await fetchWords(state.selectedLevelName);
        if (words.length === 0) {
            ui.startScreenTitle.textContent = 'Error!';
            ui.startScreenDescription.textContent = 'Could not load words for this level.';
            ui.startBtn.textContent = 'Back to Levels';
            ui.startBtn.onclick = showLevelSelectionScreen;
            ui.startBtn.style.display = 'block';
            return;
        }

        state.selectedQuestions = shuffleArray(words.map(generateQuestionData)).slice(0, 10);
        state.score = 0;
        state.currentQuestionIndex = 0;
        state.gameActive = true;
        ui.score.textContent = state.score;
        ui.mainMenuBtn.style.display = 'block';

        showScreen(null); // Hide all major screens
        loadQuestion(state.selectedQuestions[0]);
    };

    const endGame = () => {
        state.gameActive = false;
        ui.finalScore.textContent = state.score;
        document.querySelector('#game-over p').innerHTML = `Your score: <span id="final-score">${state.score}</span>/${state.selectedQuestions.length}`;
        showScreen(ui.gameOverScreen);
        ui.mainMenuBtn.style.display = 'none';
    };
    
    const selectLevel = (levelName) => {
        state.selectedLevelName = levelName;
        ui.startScreenTitle.textContent = `✏️ PopAR Kit - ${levelName} ✏️`;
        ui.startScreenDescription.textContent = 'Use your index finger to pop the correct letter bubble!';
        ui.startBtn.textContent = 'Start Quiz';
        ui.startBtn.onclick = startGame;
        showScreen(ui.startScreen);
    };
    
    const showLevelSelectionScreen = () => {
        state.gameActive = false;
        state.letterBubbles = [];
        ui.wordContainer.innerHTML = '';
        ui.feedback.textContent = '';
        ui.mainMenuBtn.style.display = 'none';
        
        // Populate level buttons
        ui.levelButtonsContainer.innerHTML = '';
        AVAILABLE_LEVELS.forEach(level => {
            const button = document.createElement('button');
            button.className = 'btn';
            button.textContent = level;
            button.onclick = () => { playSound(audio.buttonClick); selectLevel(level); };
            ui.levelButtonsContainer.appendChild(button);
        });

        showScreen(ui.levelSelectionScreen);
    };

    // --- 6. EVENT LISTENERS ---
    const setupEventListeners = () => {
        window.addEventListener('resize', updateCanvasSize);
        window.addEventListener('orientationchange', updateCanvasSize);
        
        ui.cameraBtn.addEventListener('click', initCamera);
        ui.restartBtn.addEventListener('click', () => { playSound(audio.buttonClick); showLevelSelectionScreen(); });
        ui.mainMenuBtn.addEventListener('click', () => { playSound(audio.buttonClick); showLevelSelectionScreen(); });
        
        const handleCustomLevel = () => {
            playSound(audio.buttonClick);
            const sheetName = ui.sheetNameInput.value.trim();
            if (sheetName) selectLevel(sheetName);
        };
        ui.goBtn.addEventListener('click', handleCustomLevel);
        ui.sheetNameInput.addEventListener('keypress', (e) => e.key === 'Enter' && handleCustomLevel());
        
        ui.bgmVolumeSlider.addEventListener('input', (e) => audio.backgroundMusic.volume = e.target.value);
        ui.sfxVolumeSlider.addEventListener('input', (e) => setSfxVolume(e.target.value));
    };

    // --- 7. INITIALIZATION ---
    const main = () => {
        setupEventListeners();
        updateCanvasSize();
        setSfxVolume(ui.sfxVolumeSlider.value);
        showScreen(ui.cameraPermissionScreen);
    };

    main();
});
