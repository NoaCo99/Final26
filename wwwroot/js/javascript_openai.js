// Base URL for API endpoints
const baseUrl = "https://localhost:7036/api/";
let isNewChatClicked = false;


// Global state variables
let jsonData = null;
let isLoading = false;
let jsonName = 'teva.json';
let chatHistory = [];
let aliyahApplication = null;
let isInitialized = false;

// Load aliyah application data from localStorage
function loadAliyahData() {
    try {
        const storedData = localStorage.getItem('aliyahApplication');
        if (!storedData) {
            console.error('No application data found');
            window.location.replace('index.html');
            return null;
        }

        aliyahApplication = JSON.parse(storedData);

        // Detailed logging of user application data
        console.log('Detailed Loaded Aliyah Application Data:');
        console.log('Full Name:', aliyahApplication.fullName);
        console.log('Birth Date:', aliyahApplication.birthDate);
        console.log('Language:', aliyahApplication.language);
        console.log('Country of Origin:', aliyahApplication.countryOfOrigin);
        console.log('Aliyah Reason:', aliyahApplication.aliyahReason);
        console.log('Process Stage:', aliyahApplication.processStage);
        console.log('Is Jewish:', aliyahApplication.isJewish);
        console.log('Aliyah Chances:', aliyahApplication.aliyahChances);

        console.log('Full Aliyah Application Object:', JSON.stringify(aliyahApplication, null, 2));

        // Clear after successful load
        localStorage.removeItem('aliyahApplication');
        localStorage.removeItem('processCompleted');

        return true;
    } catch (error) {
        console.error('Error loading Aliyah data:', error);
        return false;
    }
}

// Loads the jsonData file
async function loadjsonData() {
    try {
        const response = await fetch(jsonName);
        if (!response.ok) {
            throw new Error(`Failed to load json: ${response.status}`);
        }
        jsonData = await response.json();
        console.log("jsonData loaded successfully");
        return true;
    } catch (error) {
        console.error('Error loading json:', error);
        return false;
    }
}

// Initialize system
async function initializeSystem() {
    if (!localStorage.getItem('processCompleted')) {
        window.location.replace('index.html');
        return;
    }

    try {
        const [jsonLoaded, aliyahLoaded] = await Promise.all([
            loadjsonData(),
            loadAliyahData()
        ]);

        if (jsonLoaded && aliyahLoaded) {
            isInitialized = true;
            await updateWelcomeMessage();
            await getSuggestedQuestions();
        } else {
            addMessage("Oops! We ran into a small hiccup while loading your data", "system");
        }
    } catch (error) {
        console.error('Initialization error:', error);
        addMessage("Hmm, something went wrong during startup. Let's try again!", "system");
    }
}

// Add message to chat
function addMessage(message, type) {

    if (isNewChatClicked) {
        return;
    }
    
    const chatContainer = document.getElementById("chat-container");
    const loadingElement = document.getElementById("loading");

    if (!chatContainer) return;

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}-message`;

    if (aliyahApplication.language.toLowerCase() === 'hebrew' ||
        aliyahApplication.language.toLowerCase() === 'arabic' ||
        aliyahApplication.language.toLowerCase() === 'persian') {
        messageDiv.style.direction = 'rtl';
    }
    
    messageDiv.innerHTML = message;
    chatContainer.appendChild(messageDiv);
    if (loadingElement) {
        chatContainer.appendChild(loadingElement);
    }
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Toggle loading spinner
function setLoading(loading) {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) {
        loadingDiv.classList.toggle('d-none', !loading);
    }
}


// Handle question submission
async function handleQuestionSubmit(question) {
    if (!isInitialized || !aliyahApplication || !jsonData) {
        addMessage("המערכת עדיין לא מוכנה. אנא המתן...", "system");
        return false;
    }

    try {
        console.log('Sending User Data to API:', aliyahApplication);

        const data = {
            prompt: {
                Data: JSON.stringify(jsonData),
                Question: question,
                ChatHistory: chatHistory
            },
            aliyahApplication: aliyahApplication
        };

        const response = await fetch(`${baseUrl}GPT/GPTChat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${errorText}`);
        }

        const responseData = await response.json();
        return responseData;
    } catch (error) {
        console.error('API call error:', error);
        throw error;
    }
}

// Main question handling function
async function getQuestion() {
    const questionInput = document.getElementById("question");
    if (!questionInput || isLoading) return;

    const question = questionInput.value.trim();
    if (!question) return;

    const welcomeMessage = document.getElementById('welcome-message');
    const suggestedQuestions = document.getElementById('suggested-questions');

    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    if (suggestedQuestions) {
        suggestedQuestions.remove();
    }

    questionInput.value = "";
    addMessage(question, 'user');
    hideSuggestedQuestions();

    isLoading = true;
    setLoading(true);

    try {
        const responseData = await handleQuestionSubmit(question);
        console.log("Full API response:", responseData);
        if (responseData.messages) {
            chatHistory = responseData.messages;
        }

        if (responseData.content) {
            addMessage(responseData.content, 'assistant');
        } else {
            throw new Error('No content in response');
        }
    } catch (error) {
        console.error('Question processing error:', error);
        addMessage("אירעה שגיאה בעיבוד השאלה. אנא נסה שוב.", "system");
    } finally {
        isLoading = false;
        setLoading(false);
    }
}

// Function to get suggested questions from GPT
async function getSuggestedQuestions() {
    if (!isInitialized || !aliyahApplication) {
        console.error("System not initialized");
        return;
    }

    try {
        const response = await fetch(`${baseUrl}GPT/GenerateSuggestedQuestions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(aliyahApplication)
        });

        if (!response.ok) {
            throw new Error(`Server error: ${await response.text()}`);
        }

        const responseData = await response.json();
        console.log("Raw response from GPT:", responseData); // בדיקה של כל התגובה שמגיעה

        if (responseData.content && Array.isArray(responseData.content)) {
            displaySuggestedQuestions(responseData.content);
        } else {
            console.error("Invalid response format for suggested questions");
        }
    } catch (error) {
        console.error('Error getting suggested questions:', error);
    }
}

// Function to display the suggested questions
function displaySuggestedQuestions(questions) {
    const container = document.getElementById('suggested-questions');
    if (container) {
        container.style.visibility = 'visible'; // אם משתמשים בvisibility
    }
    questions.forEach((question, index) => {
        const button = document.getElementById(`question${index + 1}`);
        if (button) {
            button.textContent = question;
            button.style.display = 'block';

            if (aliyahApplication.language.toLowerCase() === 'hebrew' ||
                aliyahApplication.language.toLowerCase() === 'arabic' ||
                aliyahApplication.language.toLowerCase() === 'persian') {
                button.style.direction = 'rtl'; // שינוי כיוון הטקסט של כפתורי השאלות המוצעות ל-RTL
            } else {
                button.style.direction = 'ltr';
            }
        }
    });
}

// Function to handle when a suggested question is clicked
function handleSuggestedQuestion(button) {
    const questionInput = document.getElementById('question');
    if (questionInput) {
        const welcomeMessage = document.getElementById('welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
        questionInput.value = button.textContent;
        getQuestion();
    }
}

// Function to hide suggested questions
function hideSuggestedQuestions() {
    const suggestedQuestions = document.getElementById('suggested-questions');
    if (suggestedQuestions) {
        suggestedQuestions.style.visibility = 'hidden';
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initializeSystem();

    const textarea = document.getElementById('question');
    if (textarea) {
        textarea.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                e.preventDefault();
                getQuestion();
            }
        });
    }
});


async function updateWelcomeMessage() {
    if (!aliyahApplication) return;

    try {
        const response = await fetch(`${baseUrl}GPT/GetWelcomeMessage`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(aliyahApplication)
        });

        if (!response.ok) {
            throw new Error(`Server error: ${await response.text()}`);
        }

        const data = await response.json();

        if (data.content && Array.isArray(data.content) && data.content.length === 3) {
            const welcomeTitle = document.querySelector('.primary-language');
            const hebrewName = document.querySelector('.secondary-language');
            const subtitle = document.querySelector('.welcome-subtitle');

            welcomeTitle.textContent = data.content[0];
            hebrewName.textContent = `שלום, ${data.content[2]}`; // השם בעברית מהמערך
            subtitle.textContent = data.content[1];

            if (aliyahApplication.language.toLowerCase() === 'hebrew') {
                hebrewName.remove(); // הסרת השורה לגמרי אם השפה היא עברית
                subtitle.style.direction = 'rtl'; // שינוי כיוון הטקסט של כותרת המשנה ל-RTL
            } else if (aliyahApplication.language.toLowerCase() === 'arabic' || aliyahApplication.language.toLowerCase() === 'persian') {
                subtitle.style.direction = 'rtl'; // שינוי כיוון הטקסט של כותרת המשנה ל-RTL
            }
        }
    } catch (error) {
        console.error('Error getting welcome message:', error);
    }
}


function openDatePicker() {
    const datePicker = document.getElementById('datePicker');
    datePicker.showPicker();
}

function updateDate(value) {
    // בדיקה אם המשתמש ביטל את הבחירה
    if (!value) return;

    const selectedDate = new Date(value);
    const dateBtn = document.getElementById('dateBtn');

    const daysUntil = calculateDaysUntil(selectedDate);
    dateBtn.classList.add('has-date');

    if (daysUntil > 0) {
        dateBtn.textContent = `${daysUntil} days until your Aliyah`;
    } else if (daysUntil < 0) {
        dateBtn.textContent = `${Math.abs(daysUntil)} days since your Aliyah`;
    } else {
        dateBtn.textContent = "Today is your Aliyah!";
    }
}

function calculateDaysUntil(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
}

document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    document.getElementById('datePicker').valueAsDate = today;
});







document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    const mobileNav = document.querySelector('.mobile-nav');
    const mobileToggle = document.querySelector('.mobile-toggle');
    const minimizeBtn = document.querySelector('.minimize-btn');
    const expandBtn = document.querySelector('.expand-btn');
    const navOverlay = document.querySelector('.nav-overlay');

    // Mobile toggle handler - opens the sidebar
    mobileToggle.addEventListener('click', () => {
        if (sidebar.classList.contains('expanded')) {
            // אם התפריט כבר פתוח, נסגור אותו
            sidebar.classList.remove('expanded');
            navOverlay.classList.remove('show');
        } else {
            // אם התפריט סגור, נפתח אותו
            sidebar.classList.add('expanded');
            navOverlay.classList.add('show');
        }
    });

    // Minimize button handler
    minimizeBtn.addEventListener('click', () => {
        if (window.innerWidth <= 850) {
            // במובייל - סגור את הסיידבר ואת האוברליי
            sidebar.classList.remove('expanded');
            navOverlay.classList.remove('show');
        } else {
            // בדסקטופ - מזער את הסיידבר
            sidebar.classList.add('minimized');
        }
    });

    // Expand button handler
    expandBtn.addEventListener('click', () => {
        sidebar.classList.remove('minimized');
        if (window.innerWidth <= 850) {
            sidebar.classList.add('expanded');
            navOverlay.classList.add('show');
        }
    });

    // Overlay click handler - סגירת התפריט בלחיצה על הרקע השחור
    navOverlay.addEventListener('click', () => {
        sidebar.classList.remove('expanded');
        navOverlay.classList.remove('show');
    });

    // Document click handler - סגירת התפריט בלחיצה מחוץ לתפריט
    document.addEventListener('click', (event) => {
        if (window.innerWidth <= 850) {
            const isClickInsideNav = sidebar.contains(event.target) ||
                mobileNav.contains(event.target);

            if (!isClickInsideNav) {
                sidebar.classList.remove('expanded');
                navOverlay.classList.remove('show');
            }
        }
    });
});






document.addEventListener('DOMContentLoaded', () => {
    const newChatBtn = document.querySelector('.new-chat-btn');

    newChatBtn.addEventListener('click', async () => {
        isNewChatClicked = true;
        chatHistory = [];

        const chatContainer = document.getElementById('chat-container');
        chatContainer.innerHTML = '';

        // Recreate loading element
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loading';
        loadingDiv.className = 'text-center d-none';
        loadingDiv.innerHTML = `
            <div class="spinner-border text-success" role="status">
                <span class="visually-hidden">טוען...</span>
            </div>
        `;
        chatContainer.appendChild(loadingDiv);

        // Create welcome message structure
        const welcomeDiv = document.createElement('div');
        welcomeDiv.id = 'welcome-message';
        welcomeDiv.className = 'text-center mb-4';

        const titleH1 = document.createElement('h1');
        titleH1.className = 'welcome-title';

        const primarySpan = document.createElement('span');
        primarySpan.className = 'primary-language';

        const lineBreak = document.createElement('br');

        const secondarySpan = document.createElement('span');
        secondarySpan.className = 'secondary-language';
        secondarySpan.setAttribute('dir', 'rtl');
        secondarySpan.textContent = 'שלום, ';

        const subtitleP = document.createElement('p');
        subtitleP.className = 'welcome-subtitle';

        titleH1.appendChild(primarySpan);
        titleH1.appendChild(lineBreak);
        titleH1.appendChild(secondarySpan);
        welcomeDiv.appendChild(titleH1);
        welcomeDiv.appendChild(subtitleP);

        const suggestedQuestionsDiv = document.createElement('div');
        suggestedQuestionsDiv.id = 'suggested-questions';
        suggestedQuestionsDiv.className = 'suggested-questions-container mb-3 d-flex flex-column flex-md-row align-items-stretch justify-content-center gap-2';

        for (let i = 1; i <= 3; i++) {
            const button = document.createElement('button');
            button.id = `question${i}`;
            button.className = 'suggested-question btn btn-outline-primary';
            button.onclick = function() { handleSuggestedQuestion(this); };
            suggestedQuestionsDiv.appendChild(button);
        }

        chatContainer.appendChild(welcomeDiv);
        chatContainer.appendChild(suggestedQuestionsDiv);

        await updateWelcomeMessage();
        await getSuggestedQuestions();

        isNewChatClicked = false;
    });
});










const dictionaryData = {
    'Hello/Goodbye': {
        hebrew: 'שלום',
        explanation: 'Greeting or farewell',
        audioFile: '/audio/hello.mp3'
    },
    'Thank you': {
        hebrew: 'תודה',
        explanation: 'Expression of gratitude',
        audioFile: '/audio/thankYou.mp3'
    },
    'Please': {
        hebrew: 'בבקשה',
        explanation: 'To ask for something politely',
        audioFile: '/audio/please.mp3'
    },
    'Sorry': {
        hebrew: 'סליחה',
        explanation: 'To ask for forgiveness',
        audioFile: '/audio/sorry.mp3'
    },
    'Yes': {
        hebrew: 'כן',
        explanation: 'Affirmative response',
        audioFile: '/audio/yes.mp3'
    },
    'No': {
        hebrew: 'לא',
        explanation: 'Negative response',
        audioFile: '/audio/no.mp3'
    },
    'How are you?': {
        hebrew: 'מה שלומך',
        explanation: 'Asking about wellbeing',
        audioFile: '/audio/HowAreYou.mp3'
    },
    'Welcome': {  // שם אחר לגמרי
        hebrew: 'ברוך הבא',
        explanation: 'Expression of welcome',
        audioFile: '/audio/welcome.mp3'
    }
};

// ניהול הקומפוננטה
function initTranslationWidget() {
    const widget = document.querySelector('.translation-widget');
    const wordsList = document.querySelector('.words-list');

    // Add minimized class by default
    widget.classList.add('minimized');

    // יצירת פריטי המילון
    Object.entries(dictionaryData).forEach(([english, data]) => {
        const wordItem = document.createElement('div');
        wordItem.className = 'word-item';
        wordItem.innerHTML = `
            <div class="word-main">
                <span class="english">${english}</span>
                <div class="right-content">
                    <span class="hebrew">${data.hebrew}</span>
                    <button class="speaker-btn" data-audio="${data.audioFile}">
                        <img src="./img/speaker.png" alt="play">
                    </button>
                </div>
            </div>
            <div class="explanation">${data.explanation}</div>
        `;
        wordsList.appendChild(wordItem);
    });

    // טיפול בהשמעת שמע
    const audioCache = {};

    document.querySelectorAll('.speaker-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            event.stopPropagation();
            const audioFile = button.dataset.audio;

            if (!audioCache[audioFile]) {
                audioCache[audioFile] = new Audio(audioFile);
            }

            try {
                Object.values(audioCache).forEach(audio => {
                    audio.pause();
                    audio.currentTime = 0;
                });

                await audioCache[audioFile].play();
            } catch (error) {
                console.error('Error playing audio:', error);
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initTranslationWidget();
    initFactWidget();
    initWidgetInteractions();
    
});











// Function to manage widget states
function initWidgetInteractions() {
    const factWidget = document.querySelector('.fact-widget');
    const translationWidget = document.querySelector('.translation-widget');
    const factContainer = document.querySelector('.fact-container');
    const widgetContainer = document.querySelector('.widget-container');

    // Event handler for fact widget
    factContainer.addEventListener('click', () => {
        const isFactMinimized = factWidget.classList.contains('minimized');

        if (isFactMinimized) {
            // Opening fact widget - close translation widget
            translationWidget.classList.add('minimized');
            factWidget.classList.remove('minimized');
            const fact = getNextFact();
            updateFactWidget(fact);
        } else {
            // Closing fact widget
            factWidget.classList.add('minimized');
        }
    });

    // Event handler for translation widget
    widgetContainer.addEventListener('click', (event) => {
        // Don't toggle if clicking audio button
        if (!event.target.closest('.speaker-btn')) {
            const isTranslationMinimized = translationWidget.classList.contains('minimized');

            if (isTranslationMinimized) {
                // Opening translation widget - close fact widget
                factWidget.classList.add('minimized');
                translationWidget.classList.remove('minimized');
            } else {
                // Closing translation widget
                translationWidget.classList.add('minimized');
            }
        }
    });
}








// Facts data
const factsData = [
    {
        fact: "Israel has the highest number of museums per capita in the world, with over 230 museums.",
        imageUrl: "./img/museums.png"
    },
    {
        fact: "Tel Aviv is known as the 'White City' due to its collection of over 4,000 Bauhaus-style buildings.",
        imageUrl: "./img/white-city.png"
    },
    {
        fact: "Israel leads the world in water recycling, reusing approximately 90% of its wastewater.",
        imageUrl: "./img/water.png"
    },
    {
        fact: "The Dead Sea, at 400 meters below sea level, is Earth's lowest point on land.",
        imageUrl: "./img/dead-sea.png"
    },
    {
        fact: "Israel has more high-tech startups per capita than any other country in the world.",
        imageUrl: "./img/startup.png"
    },
    {
        fact: "Jerusalem's Western Wall receives over 12 million notes in its cracks each year.",
        imageUrl: "./img/western-wall.png"
    },
    {
        fact: "Israel has planted over 250 million trees in the past century, transforming arid landscapes.",
        imageUrl: "./img/trees.png"
    },
    {
        fact: "The Israeli city of Haifa is home to the beautiful Bahá'í Gardens, a UNESCO World Heritage site.",
        imageUrl: "./img/bahai.png"
    },
    {
        fact: "Israeli scientists developed the cherry tomato, making it a global agricultural success.",
        imageUrl: "./img/tomato.png"
    },
    {
        fact: "Israel was the first country to ban underweight models in advertising.",
        imageUrl: "./img/model.png"
    }
];

let currentFactIndex = -1;
let shuffledFacts = [];

// Preload all images
function preloadImages() {
    factsData.forEach(fact => {
        const img = new Image();
        img.src = fact.imageUrl;
    });
}

// Shuffle facts array
function shuffleFacts() {
    shuffledFacts = [...factsData].sort(() => Math.random() - 0.5);
}

// Get next fact
function getNextFact() {
    if (shuffledFacts.length === 0) {
        shuffleFacts();
    }

    currentFactIndex = (currentFactIndex + 1) % shuffledFacts.length;
    return shuffledFacts[currentFactIndex];
}

// Update widget display
function updateFactWidget(factData) {
    if (!factData) return;

    const factTextElement = document.querySelector('.fact-text');
    const factImageElement = document.querySelector('.fact-image');

    if (factTextElement) {
        factTextElement.textContent = factData.fact;
    }

    if (factImageElement) {
        factImageElement.src = factData.imageUrl;
        factImageElement.alt = 'Israel fact illustration';

        // Handle image load error
        factImageElement.onerror = function() {
            this.src = './img/default-israel.png';
        };
    }
}

// Initialize fact widget
function initFactWidget() {
    console.log('Initializing fact widget');
    const widget = document.querySelector('.fact-widget');

    if (!widget) {
        console.error('Fact widget elements not found');
        return;
    }

    // Set initial state
    widget.classList.add('minimized');

    // Prepare facts
    shuffleFacts();
    preloadImages();
}




function toggleProcessDetails() {
    const details = document.getElementById('processDetails');
    const card = document.querySelector('.process-card');
    if (details.classList.contains('open')) {
        details.classList.remove('open');
        card.classList.remove('open');
    } else {
        details.classList.add('open');
        card.classList.add('open');
    }
}

function updateCurrentStage(stageNumber) {
    const currentStageElement = document.getElementById('currentStage');
    if (currentStageElement) {
        currentStageElement.textContent = `You are in Stage ${stageNumber} of the Aliyah Process`;
    }
    localStorage.setItem('currentAliyahStage', stageNumber);
}



document.addEventListener('DOMContentLoaded', () => {
    const stageDescription = aliyahApplication?.processStage;

    if (stageDescription) {
        // Get stage number based on the full description
        let stageNumber;
        switch(stageDescription) {
            case "Arrival in Israel and Absorption Package":
                stageNumber = 5;
                break;
            case "Logistical Preparations Before the Move":
                stageNumber = 4;
                break;
            case "Submitting Your Official Aliyah Application":
                stageNumber = 3;
                break;
            case "Eligibility Verification and Aliyah Planning":
                stageNumber = 2;
                break;
            case "Preliminary Research and Decision-Making":
                stageNumber = 1;
                break;
        }

        if (stageNumber) {
            updateCurrentStage(stageNumber);
            const radioBtn = document.querySelector(`input[value="${stageNumber}"]`);
            if (radioBtn) {
                radioBtn.checked = true;
            }
        }
    } else {
        const savedStage = localStorage.getItem('currentAliyahStage');
        if (savedStage) {
            updateCurrentStage(savedStage);
            document.querySelector(`input[value="${savedStage}"]`).checked = true;
        }
    }
});