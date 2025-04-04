document.addEventListener('DOMContentLoaded', function() {
    const currentWordElement = document.getElementById('current-word');
    const scoreElement = document.getElementById('score');
    const wordInput = document.getElementById('word-input');
    const submitButton = document.getElementById('submit-btn');
    const hintButton = document.getElementById('hint-btn');
    const messagesElement = document.getElementById('messages');
    const historyList = document.getElementById('history-list');
    const hintResults = document.getElementById('hint-results');
    const originalHintsList = document.getElementById('original-hints');
    const modifiedHintsList = document.getElementById('modified-hints');
    const gameOverElement = document.getElementById('game-over');
    const finalScoreElement = document.getElementById('final-score');
    const playAgainButton = document.getElementById('play-again-btn');

    let currentWord = '';
    let score = 0;
    let usedWords = [];

    // Initialize the game
    async function initGame() {
        console.log('Initializing game...');
        
        // Hide game over at start
        gameOverElement.classList.add('hidden');
        
        // Enable controls in case they were disabled
        wordInput.disabled = false;
        submitButton.disabled = false;
        hintButton.disabled = false;
        
        try {
            const response = await fetch('/api/start-game');
            const data = await response.json();
            console.log('Start game response:', data);
            
            if (data.success) {
                currentWord = data.word;
                currentWordElement.textContent = currentWord;
                
                // Clear history and add the starting word
                historyList.innerHTML = '';
                addToHistory(currentWord, 0, false);
                
                clearMessages();
                wordInput.focus();
                
                console.log('Game initialized with word:', currentWord);
            } else {
                showError('Failed to start game: ' + data.message);
                wordInput.focus();
            }
        } catch (error) {
            showError('Network error: ' + error.message);
            wordInput.focus();
        }
    }

    // Submit a new word
    async function submitWord() {
        const newWord = wordInput.value.trim().toLowerCase();
        
        if (!newWord) {
            showError('Please enter a word');
            return;
        }

        if (usedWords.includes(newWord)) {
            showError('You already used this word');
            return;
        }
        
        // Check if the word came from a hint
        const fromHint = wordInput.dataset.fromHint === "true";
        
        // Clear the hint flag for next submission
        wordInput.dataset.fromHint = "false";
        
        // Check if the new word is an anagram of the current word
        if (isAnagram(currentWord, newWord)) {
            // Special handling for anagrams in the UI
            showInfo('Anagram detected! Bonus points will be awarded.');
        }
        
        // Close hint box if it's open
        if (hintResults.classList.contains('hidden') === false) {
            hintResults.classList.add('hidden');
        }

        try {
            const response = await fetch('/api/submit-word', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    current_word: currentWord,
                    new_word: newWord,
                    used_words: usedWords,
                    from_hint: fromHint
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Update game state
                usedWords.push(currentWord);
                currentWord = newWord;
                currentWordElement.textContent = currentWord;
                score += data.points;
                scoreElement.textContent = score;
                
                // Add to history
                addToHistory(newWord, data.points, data.modified_rule);
                
                // Update all existing words in the history to show used status
                const wordElements = document.querySelectorAll('#history-list .word');
                wordElements.forEach(element => {
                    if (usedWords.includes(element.textContent)) {
                        element.classList.add('used');
                    }
                });
                
                // Clear input and show appropriate success message
                wordInput.value = '';
                if (data.modified_rule) {
                    showInfo(`Valid word with modified rules! +${data.points} points`);
                } else {
                    showSuccess(`Valid word! +${data.points} points`);
                }
                
                // Check if the game is over
                if (data.game_over) {
                    console.log('Game over detected from submit word response');
                    showGameOver();
                }
            } else {
                // Show error but also clear input to encourage trying a different word
                showError(data.message);
                wordInput.value = '';
                wordInput.focus();
            }
        } catch (error) {
            showError('Network error: ' + error.message);
            wordInput.value = '';
            wordInput.focus();
        }
    }

    // Add a word to the history list
    function addToHistory(word, points, isModifiedRule) {
        const listItem = document.createElement('li');
        
        // Add animation class for entry effect
        listItem.classList.add('new-word-entry');
        
        // Add anagram effect if it's an anagram of the current word
        if (currentWord && word && isAnagram(currentWord, word) && currentWord !== word) {
            listItem.classList.add('anagram-bonus');
        }
        
        const wordSpan = document.createElement('span');
        wordSpan.className = 'word';
        wordSpan.textContent = word;
        
        // Add strikethrough class for used words
        if (usedWords.includes(word)) {
            wordSpan.classList.add('used');
        }
        
        // Add modified-rule class if applicable
        if (isModifiedRule) {
            wordSpan.classList.add('modified-rule');
        }
        
        const pointsSpan = document.createElement('span');
        pointsSpan.className = 'points';
        pointsSpan.textContent = `+${points} points`;
        
        listItem.appendChild(wordSpan);
        listItem.appendChild(pointsSpan);
        
        // Insert the list item at the top of the history
        historyList.insertBefore(listItem, historyList.firstChild);
        
        // Create firework effect if this is not the initial word (points > 0)
        if (points > 0) {
            // More fireworks for anagrams or high-scoring words!
            const isHighScore = points >= 50;
            const numFireworks = isAnagram(word, currentWord) || isHighScore ? 5 : 3;
            
            createFireworkEffect(listItem, numFireworks);
        }
    }
    
    // Create firework effect inside a list item
    function createFireworkEffect(element, numFireworks = 3) {
        // Create firework particles (default 3)
        
        for (let i = 0; i < numFireworks; i++) {
            setTimeout(() => {
                const firework = document.createElement('div');
                firework.className = 'firework';
                
                // Add a slight random offset to each firework
                const xOffset = (Math.random() - 0.5) * 40;  // -20px to 20px
                const yOffset = (Math.random() - 0.5) * 20;  // -10px to 10px
                
                firework.style.marginLeft = `${xOffset}px`;
                firework.style.marginTop = `${yOffset}px`;
                
                element.appendChild(firework);
                
                // Remove the firework element after animation completes
                setTimeout(() => {
                    firework.remove();
                }, 1100);  // Animation duration + small buffer
                
            }, i * 200);  // Stagger the fireworks
        }
    }

    // Helper function to check if two words are anagrams
    function isAnagram(word1, word2) {
        if (word1.length !== word2.length) return false;
        
        const sortedWord1 = word1.split('').sort().join('');
        const sortedWord2 = word2.split('').sort().join('');
        
        return sortedWord1 === sortedWord2;
    }
    
    // Message timeout handler
    let messageTimeout = null;
    
    // Display generic message
    function showMessage(message, type) {
        // Clear any existing timeout
        if (messageTimeout) {
            clearTimeout(messageTimeout);
        }
        
        messagesElement.textContent = message;
        messagesElement.className = type;
        
        // Auto-clear messages after 5 seconds
        messageTimeout = setTimeout(clearMessages, 5000);
    }
    
    // Display error message
    function showError(message) {
        showMessage(message, 'error');
    }

    // Display success message
    function showSuccess(message) {
        showMessage(message, 'success');
    }
    
    // Display info message
    function showInfo(message) {
        showMessage(message, 'info');
    }

    // Clear messages
    function clearMessages() {
        messagesElement.textContent = '';
        messagesElement.className = '';
        
        if (messageTimeout) {
            clearTimeout(messageTimeout);
            messageTimeout = null;
        }
    }

    // Get hints from the server
    async function getHints() {
        if (!currentWord) {
            showError('No word to get hints for');
            return;
        }
        
        try {
            // Show loading state
            hintButton.textContent = 'Loading...';
            hintButton.disabled = true;
            
            const response = await fetch('/api/get-hint', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    current_word: currentWord,
                    used_words: usedWords
                })
            });
            
            const data = await response.json();
            
            // Reset button state
            hintButton.textContent = 'Hint';
            hintButton.disabled = false;
            
            if (data.success) {
                displayHints(data.original_rule_hints, data.modified_rule_hints);
                
                // Check if the game is over
                if (data.game_over) {
                    console.log('Game over detected from submit word response');
                    showGameOver();
                }
            } else {
                showError(data.message);
            }
        } catch (error) {
            hintButton.textContent = 'Hint';
            hintButton.disabled = false;
            console.error("Hint error:", error);
            showError('Error fetching hints. Please try again.');
        }
    }
    
    // Display hints in the UI
    function displayHints(originalHints, modifiedHints) {
        // Clear previous hints
        originalHintsList.innerHTML = '';
        modifiedHintsList.innerHTML = '';
        
        // Add original rule hints
        if (originalHints.length > 0) {
            originalHints.forEach(hint => {
                const li = document.createElement('li');
                li.textContent = hint;
                li.classList.add('hint-original');
                
                // Allow clicking on hint to use it
                li.addEventListener('click', function() {
                    wordInput.value = hint;
                    
                    // Flag this word as a hint word
                    wordInput.dataset.fromHint = "true";
                    
                    // Hide hints
                    hintResults.classList.add('hidden');
                    
                    // Auto-submit the word
                    submitWord();
                });
                
                originalHintsList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = 'No hints available';
            li.style.fontStyle = 'italic';
            li.style.color = '#95a5a6';
            originalHintsList.appendChild(li);
        }
        
        // Add modified rule hints
        if (modifiedHints.length > 0) {
            modifiedHints.forEach(hint => {
                const li = document.createElement('li');
                li.textContent = hint;
                li.classList.add('hint-modified');
                
                // Allow clicking on hint to use it
                li.addEventListener('click', function() {
                    wordInput.value = hint;
                    
                    // Flag this word as a hint word
                    wordInput.dataset.fromHint = "true";
                    
                    // Hide hints
                    hintResults.classList.add('hidden');
                    
                    // Auto-submit the word
                    submitWord();
                });
                
                modifiedHintsList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = 'No hints available';
            li.style.fontStyle = 'italic';
            li.style.color = '#95a5a6';
            modifiedHintsList.appendChild(li);
        }
        
        // Show the hint results
        hintResults.classList.remove('hidden');
        
        // Add a subtle animation to the hint results
        hintResults.style.animation = 'none';
        setTimeout(() => {
            hintResults.style.animation = 'slideIn 0.3s ease-out forwards';
        }, 10);
    }
    
    // Event listeners
    submitButton.addEventListener('click', submitWord);
    
    wordInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            submitWord();
        }
    });
    
    // Add hint button event listener
    hintButton.addEventListener('click', function() {
        if (hintResults.classList.contains('hidden')) {
            getHints();
        } else {
            hintResults.classList.add('hidden');
        }
    });
    
    // Function to show game over screen
    function showGameOver() {
        console.log('showGameOver called! currentWord:', currentWord, 'score:', score);
        
        // Only show game over if we have a current word and have made at least one move
        if (!currentWord || score === 0) {
            console.log('Preventing game over because no current word or score is 0');
            return;
        }
        
        console.log('Showing game over screen');
        
        // Update the final score
        finalScoreElement.textContent = score;
        
        // Show the game over container
        gameOverElement.classList.remove('hidden');
        gameOverElement.style.display = 'flex';
        
        // Create confetti effect
        createConfettiEffect();
        
        // Disable game controls
        wordInput.disabled = true;
        submitButton.disabled = true;
        hintButton.disabled = true;
    }
    
    // Create a confetti effect for game over
    function createConfettiEffect() {
        // Number of confetti pieces
        const confettiCount = 200;
        const container = document.querySelector('.game-over-content');
        
        for (let i = 0; i < confettiCount; i++) {
            // Create a confetti piece
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            
            // Random color
            const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.backgroundColor = color;
            
            // Random position, size, and animation delay
            const size = Math.random() * 10 + 5;
            confetti.style.width = `${size}px`;
            confetti.style.height = `${size}px`;
            confetti.style.left = `${Math.random() * 100}%`;
            confetti.style.top = 0;
            confetti.style.animationDelay = `${Math.random() * 5}s`;
            
            // Add to body (outside the container for better effect)
            document.body.appendChild(confetti);
            
            // Remove after animation completes
            setTimeout(() => {
                confetti.remove();
            }, 10000);
        }
    }
    
    // Function to reset the game
    function resetGame() {
        // Reset all game state
        score = 0;
        scoreElement.textContent = '0';
        usedWords = [];
        currentWord = '';
        wordInput.value = '';
        clearMessages();
        
        // Clear history
        historyList.innerHTML = '';
        
        // Hide hint results
        hintResults.classList.add('hidden');
        
        // Hide game over
        gameOverElement.classList.add('hidden');
        gameOverElement.style.display = 'none';
        
        // Re-enable controls
        wordInput.disabled = false;
        submitButton.disabled = false;
        hintButton.disabled = false;
        
        // Start fresh game
        initGame();
    }
    
    // Add restart button event listener
    const restartButton = document.getElementById('restart-btn');
    restartButton.addEventListener('click', resetGame);
    
    // Add play again button event listener
    playAgainButton.addEventListener('click', resetGame);

    // Start the game
    initGame();
});