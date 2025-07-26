document.addEventListener('DOMContentLoaded', () => {
    // Show cute welcome message on load
    const welcomeMsg = document.getElementById('welcome-message');
    if (welcomeMsg) {
        welcomeMsg.classList.remove('hidden');
        setTimeout(() => {
            welcomeMsg.classList.add('hidden');
        }, 3000);
    }
    // --- DOM Elements ---
    const characterGif = document.getElementById('character-gif');
    const micButton = document.getElementById('mic-button');
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const characterSelect = document.getElementById('character-select');

    // --- API and State ---
    // IMPORTANT: Replace with your actual Google AI Studio API key
    const API_KEY = 'AIzaSyDmBT57nfysG-6RTro2VNljwhMWKtN6tvs'; 
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
    
    let isListening = false;
    let recognition;

    // --- Character States (GIFs) ---
    const characterSets = {
        '1': {
            idle: '4.webp',
            listening: '5.webp',
            speaking: '3.webp',
            thinking: '2.webp',
            error: '4.webp'
        },
        '2': {
            idle: '9.webp',
            listening: '10.webp',
            speaking: '8.webp',
            thinking: '6.webp',
            error: '7.webp'
        }
    };
    let currentCharacter = '1';
    let characterStates = characterSets[currentCharacter];
    // --- Character Selection Event ---
    if (characterSelect) {
        characterSelect.addEventListener('change', (e) => {
            currentCharacter = characterSelect.value;
            characterStates = characterSets[currentCharacter];
            setCharacterState('idle');
        });
    }

    // --- Speech Recognition Setup ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;

        recognition.onstart = () => {
            isListening = true;
            micButton.classList.add('listening');
            userInput.placeholder = 'Listening...';
            setCharacterState('listening');
        };

        recognition.onend = () => {
            isListening = false;
            micButton.classList.remove('listening');
            userInput.placeholder = 'Ask something...';
            if (characterGif.src.includes(characterStates.listening)) {
                 setCharacterState('idle');
            }
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.trim();
            if (transcript) {
                userInput.value = transcript;
                addMessageToChat('user', transcript);
                getGeminiResponse(transcript);
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            setCharacterState('error', 2000); // Show error for 2 seconds
            if (event.error === 'no-speech') {
                speak("I didn't hear anything. Please try again.");
            } else {
                speak("Sorry, I couldn't understand. Please try again.");
            }
        };

    } else {
        console.error('Speech Recognition not supported in this browser.');
        micButton.disabled = true;
        userInput.placeholder = "Voice input not supported.";
    }

    // --- Event Listeners ---
    micButton.addEventListener('click', () => {
        if (API_KEY === 'YOUR_API_KEY_HERE') {
            alert('Please set your API_KEY in script.js first!');
            return;
        }
        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });

    // --- Core Functions ---

    function setCharacterState(state, duration = 0) {
        characterGif.src = characterStates[state];
        if (duration > 0) {
            setTimeout(() => {
                if (characterGif.src.includes(characterStates[state])) {
                   setCharacterState('idle');
                }
            }, duration);
        }
    }

    function addMessageToChat(sender, message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', `${sender}-message`);
        messageElement.textContent = message;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll
    }

    async function getGeminiResponse(prompt) {
        setCharacterState('thinking');
        try {
            const response = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            const geminiText = data.candidates[0].content.parts[0].text;

            addMessageToChat('gemini', geminiText);

            // Sanitize text for speech by removing markdown characters like *, #, _, etc.
            const textToSpeak = geminiText.replace(/[*#_`]/g, '');
            speak(textToSpeak);
        } catch (error) {
            console.error('Error calling Gemini API:', error);
            const errorMessage = "I'm having trouble connecting right now. Please try again later.";
            addMessageToChat('gemini', errorMessage);
            speak(errorMessage);
            setCharacterState('error', 3000);
        }
    }

    function speak(text) {
    if (!window.speechSynthesis) {
        console.warn("Speech Synthesis not supported.");
        setCharacterState('idle');
        return;
    }

    // Detect Hindi input (basic check: contains Devanagari characters or 'हिंदी')
    const isHindi = /[\u0900-\u097F]|हिंदी/i.test(text);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = isHindi ? 'hi-IN' : 'en-US';

    // Select a female voice
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = null;
    if (isHindi) {
        selectedVoice = voices.find(v => v.lang === 'hi-IN' && v.name.toLowerCase().includes('female'))
            || voices.find(v => v.lang === 'hi-IN');
    } else {
        selectedVoice = voices.find(v => v.lang === 'en-US' && v.name.toLowerCase().includes('female'))
            || voices.find(v => v.lang === 'en-US' && v.gender === 'female')
            || voices.find(v => v.lang === 'en-US');
    }
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }

    utterance.onstart = () => {
        setCharacterState('speaking');
    };
    utterance.onend = () => {
        setCharacterState('idle');
    };
    utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event.error);
        setCharacterState('error', 2000);
    };

    // Cancel any previous speech before starting a new one
    window.speechSynthesis.cancel();
    // Some browsers need voices to be loaded asynchronously
    if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
            const newVoices = window.speechSynthesis.getVoices();
            if (isHindi) {
                utterance.voice = newVoices.find(v => v.lang === 'hi-IN' && v.name.toLowerCase().includes('female'))
                    || newVoices.find(v => v.lang === 'hi-IN');
            } else {
                utterance.voice = newVoices.find(v => v.lang === 'en-US' && v.name.toLowerCase().includes('female'))
                    || newVoices.find(v => v.lang === 'en-US' && v.gender === 'female')
                    || newVoices.find(v => v.lang === 'en-US');
            }
            window.speechSynthesis.speak(utterance);
        };
    } else {
        window.speechSynthesis.speak(utterance);
    }
}

    // --- Preload Character Images ---
function preloadCharacterImages(characterSets) {
    Object.values(characterSets).forEach(set => {
        Object.values(set).forEach(src => {
            const img = new Image();
            img.src = src;
        });
    });
}
preloadCharacterImages(characterSets);

    // --- Initial State ---
    setCharacterState('idle');
    speak("Hello! I'm ready to chat. Just press the microphone button to talk to me.");
});