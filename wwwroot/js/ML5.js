let state = 'collection';
let model;

setup();
function setup() {
    ml5.setBackend("webgl");
    const options = {
        inputs: ['x', 'y', 'z', 'm', 't'],
        outputs: ['label'],
        task: 'classification',
        debug: false,
    };
    model = ml5.neuralNetwork(options);
}

async function loadData() {
    try {
        console.log('Starting to load data...');
        const response = await fetch('./JSON/immigration_training_data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        data.forEach(JSONItem => {
            const inputs = {
                x: parseFloat(JSONItem["Q1"]),
                y: parseFloat(JSONItem["Q2"]),
                z: parseFloat(JSONItem["Q3"]),
                m: parseFloat(JSONItem["Q4"]),
                t: parseFloat(JSONItem["Q5"]),
            };

            const target = {
                label: JSONItem["aliyahChances"]
            };

            model.addData(inputs, target);
        });
        model.normalizeData();
        console.log('Data loaded and normalized');
        return true;
    } catch (error) {
        console.error('Error loading data:', error);
        return false;
    }
}

function whileTraining(epoch, loss) {
    console.log(`Epoch: ${epoch}, Loss: ${loss}`);
}

function finishedTraining() {
    state = 'prediction';
    console.log('Training completed');
}

async function trainModel() {
    if (state === 'collection') {
        state = 'training';

        // יצירת רקע לטעינה
        const loadingAnimation = document.createElement('div');
        loadingAnimation.id = 'loadingAnimation';
        loadingAnimation.style.position = 'fixed';
        loadingAnimation.style.top = '0';
        loadingAnimation.style.left = '0';
        loadingAnimation.style.width = '100%';
        loadingAnimation.style.height = '100%';
        loadingAnimation.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        loadingAnimation.style.display = 'flex';
        loadingAnimation.style.flexDirection = 'column';
        loadingAnimation.style.justifyContent = 'center';
        loadingAnimation.style.alignItems = 'center';
        loadingAnimation.style.zIndex = '1000';

        // יצירת מיכל לספינר + תמונה
        const spinnerContainer = document.createElement('div');
        spinnerContainer.style.position = 'relative';
        spinnerContainer.style.width = '100px';
        spinnerContainer.style.height = '100px';
        spinnerContainer.style.display = 'flex';
        spinnerContainer.style.justifyContent = 'center';
        spinnerContainer.style.alignItems = 'center';

        // יצירת הספינר שיסתובב סביב התמונה
        const spinner = document.createElement('div');
        spinner.style.width = '100px';
        spinner.style.height = '100px';
        spinner.style.border = '5px solid #332B1B';
        spinner.style.borderTop = '5px solid transparent';
        spinner.style.borderRadius = '50%';
        spinner.style.position = 'absolute';
        spinner.style.animation = 'spin 1s linear infinite';

        // יצירת תמונת ה-FavIcon בתוך הגלגלת
        const spinnerImage = document.createElement('img');
        spinnerImage.src = '/img/FavIcon.png';
        spinnerImage.style.width = '100px';
        spinnerImage.style.height = '100px';
        spinnerImage.style.position = 'absolute'; // מבטיח שהתמונה נשארת באמצע
        spinnerImage.style.zIndex = '2'; // שומר שהתמונה תהיה מעל הספינר

        // הוספת הספינר והתמונה למיכל
        spinnerContainer.appendChild(spinner);
        spinnerContainer.appendChild(spinnerImage);

        // יצירת טקסט
        const loadingText = document.createElement('p');
        loadingText.textContent = 'Setting up… Your journey home begins!';
        loadingText.style.marginTop = '20px';
        loadingText.style.color = '#170F49';
        loadingText.style.fontSize = '20px';
        loadingText.style.fontWeight = 'bold';

        // הוספת אנימציה לסיבוב
        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(styleSheet);

        // הוספת האלמנטים למסך הטעינה
        loadingAnimation.appendChild(spinnerContainer);
        loadingAnimation.appendChild(loadingText);
        document.body.appendChild(loadingAnimation);

        const options = {
            epochs: 50,
            batchSize: 12,
        };

        try {
            await model.train(options, whileTraining, finishedTraining);
            return true;
        } catch (error) {
            console.error('Training error:', error);
            return false;
        }
    }
    return false;
}



async function predict() {
    if (state !== 'prediction') {
        console.warn('Prediction can only be performed after training.');
        return null;
    }

    function getFormData() {
        const formData = {
            x: document.querySelector('input[name="jewish_status"]:checked')?.value,
            y: document.querySelector('input[name="aliyah_stage"]:checked')?.value,
            z: document.querySelector('input[name="entry_denial"]:checked')?.value,
            m: document.querySelector('input[name="criminal_record"]:checked')?.value,
            t: document.querySelector('input[name="security_threat"]:checked')?.value,
        };

        if (Object.values(formData).some(value => !value)) {
            throw new Error("Please fill in all fields");
        }

        return {
            x: parseFloat(formData.x),
            y: parseFloat(formData.y),
            z: parseFloat(formData.z),
            m: parseFloat(formData.m),
            t: parseFloat(formData.t),
        };
    }

    try {
        const formData = getFormData();
        const predictions = await model.classify(formData);
        return predictions[0].label;
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

function getProcessStageDescription(value) {
    const stages = {
        "1": "Preliminary Research and Decision-Making",
        "2": "Eligibility Verification and Aliyah Planning",
        "3": "Submitting Your Official Aliyah Application",
        "4": "Logistical Preparations Before the Move",
        "5": "Arrival in Israel and Absorption Package"
    };
    return stages[value] || value;
}

document.addEventListener("DOMContentLoaded", function () {
    const part1Fields = ['fullName', 'birthDate', 'country', 'nativeLanguage'];
    part1Fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        field?.addEventListener('input', updateNextButtonState);
    });

    const part1RadioGroups = ['reason_status', 'jewish_status'];
    part1RadioGroups.forEach(groupName => {
        const radioButtons = document.querySelectorAll(`input[name="${groupName}"]`);
        radioButtons.forEach(radio => {
            radio.addEventListener('change', updateNextButtonState);
        });
    });

    const part2RadioGroups = ['aliyah_stage', 'entry_denial', 'criminal_record', 'security_threat'];
    part2RadioGroups.forEach(groupName => {
        const radioButtons = document.querySelectorAll(`input[name="${groupName}"]`);
        radioButtons.forEach(radio => {
            radio.addEventListener('change', updateSubmitButtonState);
        });
    });

    const form = document.getElementById("surveyForm");
    const part1 = document.getElementById("part1");
    const part2 = document.getElementById("part2");
    const nextBtn = document.getElementById("nextBtn");
    const backBtn = document.getElementById("backBtn");

    nextBtn?.addEventListener("click", function() {
        part1.style.display = "none";
        part2.style.display = "block";
        updateSubmitButtonState();
    });

    backBtn?.addEventListener("click", function() {
        part2.style.display = "none";
        part1.style.display = "block";
    });

    form?.addEventListener("submit", async function (e) {
        e.preventDefault();

        try {
            const dataLoaded = await loadData();
            if (!dataLoaded) {
                console.error("Failed to load training data");
                return;
            }

            const modelTrained = await trainModel();
            if (!modelTrained) {
                console.error("Failed to train model");
                const existingAnimation = document.getElementById('loadingAnimation');
                if (existingAnimation) {
                    document.body.removeChild(existingAnimation);
                }
                return;
            }

            const prediction = await predict();
            if (prediction) {
                try {
                    // Create AliyahApplication object
                    const aliyahApplication = {
                        fullName: document.getElementById('fullName').value,
                        birthDate: document.getElementById('birthDate').value,
                        language: document.getElementById('nativeLanguage').value,
                        countryOfOrigin: document.getElementById('country').value,
                        aliyahReason: document.querySelector('input[name="reason_status"]:checked').value,
                        processStage: getProcessStageDescription(document.querySelector('input[name="aliyah_stage"]:checked').value),
                        isJewish: document.querySelector('input[name="jewish_status"]:checked').value === "1",
                        aliyahChances: prediction
                    };

                    // Detailed console logging
                    console.log('Detailed Aliyah Application Details:');
                    console.log('Full Name:', aliyahApplication.fullName);
                    console.log('Birth Date:', aliyahApplication.birthDate);
                    console.log('Language:', aliyahApplication.language);
                    console.log('Country of Origin:', aliyahApplication.countryOfOrigin);
                    console.log('Aliyah Reason:', aliyahApplication.aliyahReason);
                    console.log('Process Stage:', aliyahApplication.processStage);
                    console.log('Is Jewish:', aliyahApplication.isJewish);
                    console.log('Aliyah Chances:', aliyahApplication.aliyahChances);

                    console.log('Full Aliyah Application Object:', JSON.stringify(aliyahApplication, null, 2));

                    // Store in localStorage
                    localStorage.setItem('aliyahApplication', JSON.stringify(aliyahApplication));

                    // Remove loading animation
                    const loadingAnimation = document.getElementById('loadingAnimation');
                    if (loadingAnimation) {
                        document.body.removeChild(loadingAnimation);
                    }

                    // Indicate process completion
                    localStorage.setItem('processCompleted', 'true');

                    // Navigate to next page
                    window.location.replace('openai.html');
                } catch (error) {
                    console.error('Error in final processing:', error);
                    const loadingAnimation = document.getElementById('loadingAnimation');
                    if (loadingAnimation) {
                        document.body.removeChild(loadingAnimation);
                    }
                }
            } else {
                console.error("Failed to make prediction");
                const existingAnimation = document.getElementById('loadingAnimation');
                if (existingAnimation) {
                    document.body.removeChild(existingAnimation);
                }
            }
        } catch (error) {
            console.error("An error occurred while processing your submission:", error);
            const existingAnimation = document.getElementById('loadingAnimation');
            if (existingAnimation) {
                document.body.removeChild(existingAnimation);
            }
        }
    });
});

function updateNextButtonState() {
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
        nextBtn.disabled = !validatePart1();
    }
}

function updateSubmitButtonState() {
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = !validatePart2();
    }
}

function validatePart1() {
    const fullName = document.getElementById('fullName').value;
    const birthDate = document.getElementById('birthDate').value;
    const country = document.getElementById('country').value;
    const nativeLanguage = document.getElementById('nativeLanguage').value;
    const reasonStatus = document.querySelector('input[name="reason_status"]:checked');
    const jewishStatus = document.querySelector('input[name="jewish_status"]:checked');

    const nextButton = document.querySelector('#part1 .btn-next');

    // בדיקה האם כל השדות מלאים
    const isValid = fullName && birthDate && country && nativeLanguage && reasonStatus && jewishStatus;

    // הפעלה/ביטול של כפתור NEXT
    nextButton.disabled = !isValid;
}

function validatePart2() {
    const aliyahStage = document.querySelector('input[name="aliyah_stage"]:checked');
    const entryDenial = document.querySelector('input[name="entry_denial"]:checked');
    const criminalRecord = document.querySelector('input[name="criminal_record"]:checked');
    const securityThreat = document.querySelector('input[name="security_threat"]:checked');

    const submitButton = document.querySelector('#part2 .btn-next');

    // בדיקה האם כל השדות מלאים
    const isValid = aliyahStage && entryDenial && criminalRecord && securityThreat;

    // הפעלה/ביטול של כפתור SUBMIT
    submitButton.disabled = !isValid;
}


document.addEventListener('DOMContentLoaded', function() {
    // מאזינים לחלק הראשון
    const part1Inputs = document.querySelectorAll('#part1 input, #part1 select');
    part1Inputs.forEach(input => {
        input.addEventListener('change', validatePart1);
        input.addEventListener('input', validatePart1);
    });

    // מאזינים לחלק השני
    const part2Inputs = document.querySelectorAll('#part2 input');
    part2Inputs.forEach(input => {
        input.addEventListener('change', validatePart2);
    });

    // בדיקה ראשונית של הטפסים
    validatePart1();
    validatePart2();
});


function showPart(partNumber) {
    document.querySelectorAll('.form-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`part${partNumber}`).classList.add('active');

    // בדיקה מחדש של תקינות הטופס הנוכחי
    if (partNumber === 1) {
        validatePart1();
    } else if (partNumber === 2) {
        validatePart2();
    }
}