from flask import Flask, request, jsonify, render_template, send_from_directory
import random
import json
import os
import requests
import time
from collections import Counter

app = Flask(__name__, template_folder='../templates', static_folder='../static')

# Load a dictionary of valid English words
def load_dictionary():
    words = []
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        dict_path = os.path.join(script_dir, 'dictionary.txt')
        with open(dict_path, 'r') as f:
            words = [word.strip().lower() for word in f if len(word.strip()) <= 8]
    except FileNotFoundError:
        # Default list in case dictionary file is not found
        words = ['start', 'game', 'play', 'word', 'letter', 'puzzle', 'solve', 'mind']
    return words

# Dictionary for API-verified words and words we know don't exist
VERIFIED_WORDS = {}
NONEXISTENT_WORDS = set()

# Function to check if a word exists using the Free Dictionary API
def is_valid_word(word):
    # Basic validation - words must be at least 2 characters and no more than 15
    if len(word) < 2 or len(word) > 15:
        return False
    
    # First check our local cache
    if word in VERIFIED_WORDS:
        return True
    if word in NONEXISTENT_WORDS:
        return False
    
    # Check if it's in our local dictionary
    if word in WORD_LIST:
        VERIFIED_WORDS[word] = True
        return True
    
    # If not in local caches, check the API
    try:
        # Rate limiting - don't hit the API too quickly
        time.sleep(0.1)
        
        url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
        response = requests.get(url, timeout=2)
        
        if response.status_code == 200:
            # Word exists
            print(f"API verified word: {word}")
            VERIFIED_WORDS[word] = True
            return True
        else:
            # Word likely doesn't exist
            print(f"API rejected word: {word}")
            NONEXISTENT_WORDS.add(word)
            return False
    except Exception as e:
        print(f"API error for word '{word}': {str(e)}")
        # If API fails, fall back to our word list
        return word in WORD_LIST

WORD_LIST = load_dictionary()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/start-game')
def start_game():
    # Find the longest words in the dictionary (up to 8 characters)
    max_length = min(8, max(len(word) for word in WORD_LIST))
    
    # Get all words with the maximum length
    longest_words = [word for word in WORD_LIST if len(word) == max_length]
    
    # If we have no longest words (unlikely), fall back to 7-letter words, then 6, etc.
    if not longest_words:
        for length in range(max_length-1, 3, -1):
            longest_words = [word for word in WORD_LIST if len(word) == length]
            if longest_words:
                break
    
    # Choose a random word from the longest available
    start_word = random.choice(longest_words)
    
    return jsonify({
        'success': True,
        'word': start_word
    })

@app.route('/api/submit-word', methods=['POST'])
def submit_word():
    data = request.get_json()
    current_word = data.get('current_word', '').lower()
    new_word = data.get('new_word', '').lower()
    
    # Check if the new word is valid using our API-backed validator
    if not is_valid_word(new_word):
        return jsonify({
            'success': False,
            'message': 'Not a valid word'
        })
    
    # Count frequency of each letter in both words
    current_letters = Counter(current_word)
    new_letters = Counter(new_word)
    
    # Special case: if the new word is an anagram of the current word (same letters rearranged)
    if current_letters == new_letters:
        # Get used words to check if we should check for game over
        used_words = data.get('used_words', [])
        
        # Check if word came from a hint
        from_hint = data.get('from_hint', False)
        
        # Calculate points - half points if from a hint
        if from_hint:
            points = len(new_word) * 15 // 2  # Half points for hint-assisted anagrams
            hint_message = " (Half points for using hint)"
        else:
            points = len(new_word) * 15  # Full bonus points for anagrams
            hint_message = ""
        
        # Check if the game is over after this move (only if we have used words)
        if used_words:
            # Add the current word to the list of used words for checking purposes
            used_words_for_check = used_words.copy()
            used_words_for_check.append(current_word)
            
            original_rule_matches, modified_rule_matches = find_possible_words(new_word)
            
            # Filter out words that have already been used
            original_rule_matches = [word for word in original_rule_matches if word not in used_words_for_check]
            modified_rule_matches = [word for word in modified_rule_matches if word not in used_words_for_check]
            
            game_over = len(original_rule_matches) == 0 and len(modified_rule_matches) == 0
        else:
            game_over = False
        
        return jsonify({
            'success': True,
            'points': points,
            'message': f'Valid anagram! Bonus points!{hint_message}',
            'game_over': game_over
        })
    
    # Check if all letters in new word are available in current word with correct frequency
    valid = True
    for letter, count in new_letters.items():
        if letter not in current_letters or current_letters[letter] < count:
            valid = False
            break
    
    if not valid:
        # Modified rules: Check if at least 2 letters from the current word are used
        shared_letters = 0
        for letter in new_letters:
            if letter in current_letters:
                shared_letters += min(new_letters[letter], current_letters[letter])
        
        if shared_letters >= 2:
            # Check if word came from a hint
            from_hint = data.get('from_hint', False)
            
            # Give fewer points when using the modified rule
            base_points = len(new_word) * 5
            
            # Half points if from a hint
            if from_hint:
                points = base_points // 2
                hint_message = " (Half points for using hint)"
            else:
                points = base_points
                hint_message = ""
            
            # Get used words to check if we should check for game over
            used_words = data.get('used_words', [])
            
            # Check if the game is over after this move (only if we have used words)
            if used_words:
                # Add the current word to the list of used words for checking purposes
                used_words_for_check = used_words.copy()
                used_words_for_check.append(current_word)
                
                original_rule_matches, modified_rule_matches = find_possible_words(new_word)
                
                # Filter out words that have already been used
                original_rule_matches = [word for word in original_rule_matches if word not in used_words_for_check]
                modified_rule_matches = [word for word in modified_rule_matches if word not in used_words_for_check]
                
                game_over = len(original_rule_matches) == 0 and len(modified_rule_matches) == 0
            else:
                game_over = False
            
            return jsonify({
                'success': True,
                'points': points,
                'message': f'Valid word with modified rules!{hint_message}',
                'modified_rule': True,
                'game_over': game_over
            })
        else:
            return jsonify({
                'success': False,
                'message': 'The new word must use at least 2 letters from the current word'
            })
    
    # Check if word came from a hint
    from_hint = data.get('from_hint', False)
    
    # Calculate base points (more points for using more letters)
    base_points = len(new_word) * 10
    
    # Apply hint penalty if applicable
    if from_hint:
        points = base_points // 2  # Half points for hint-assisted words
        hint_message = " (Half points for using hint)"
    else:
        points = base_points
        hint_message = ""
    
    # Get used words to check if we should check for game over
    used_words = data.get('used_words', [])
    
    # Check if the game is over after this move (only if we have used words)
    if used_words:
        # Add the current word to the list of used words for checking purposes
        used_words_for_check = used_words.copy()
        used_words_for_check.append(current_word)
        
        original_rule_matches, modified_rule_matches = find_possible_words(new_word)
        
        # Filter out words that have already been used
        original_rule_matches = [word for word in original_rule_matches if word not in used_words_for_check]
        modified_rule_matches = [word for word in modified_rule_matches if word not in used_words_for_check]
        
        game_over = len(original_rule_matches) == 0 and len(modified_rule_matches) == 0
    else:
        game_over = False
    
    return jsonify({
        'success': True,
        'points': points,
        'message': f'Valid word!{hint_message}',
        'game_over': game_over
    })
    
def find_possible_words(current_word):
    """Helper function to find all possible valid words for the current word"""
    if not current_word:
        return [], []
        
    # Find possible words using original rule (subsets of letters)
    current_letters = Counter(current_word)
    original_rule_matches = []
    
    # Find possible words using modified rule (at least 2 letters)
    modified_rule_matches = []
    
    # Search through our dictionary for matches first
    for word in WORD_LIST:
        # Skip the current word itself
        if word == current_word:
            continue
            
        # Check if it's a valid word under original rules
        word_letters = Counter(word)
        valid_original = True
        
        for letter, count in word_letters.items():
            if letter not in current_letters or current_letters[letter] < count:
                valid_original = False
                break
                
        if valid_original:
            original_rule_matches.append(word)
            continue
            
        # Check if it's valid under modified rules (shares at least 2 letters)
        shared_letters = 0
        for letter in word_letters:
            if letter in current_letters:
                shared_letters += min(word_letters[letter], current_letters[letter])
                
        if shared_letters >= 2:
            modified_rule_matches.append(word)
    
    # In the find_possible_words function, we won't hit the API for all possible
    # combinations - that would be too expensive. Instead, we use our dictionary
    # and rely on the submit endpoint's use of is_valid_word to validate words
    # on demand.
    
    # Sort matches by length (longer words first)
    original_rule_matches.sort(key=len, reverse=True)
    modified_rule_matches.sort(key=len, reverse=True)
    
    return original_rule_matches, modified_rule_matches

@app.route('/api/get-hint', methods=['POST'])
def get_hint():
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': 'Invalid JSON data'
            })
            
        current_word = data.get('current_word', '').lower()
        
        if not current_word:
            return jsonify({
                'success': False,
                'message': 'Current word is required'
            })
    
        # Find all possible words
        original_rule_matches, modified_rule_matches = find_possible_words(current_word)
        
        # Get already used words to filter from hints
        used_words = data.get('used_words', [])
        if used_words:
            # Filter out words that have already been used
            original_rule_matches = [word for word in original_rule_matches if word not in used_words]
            modified_rule_matches = [word for word in modified_rule_matches if word not in used_words]
        
        # Take up to 3 hints from each category
        original_hints = original_rule_matches[:3]
        modified_hints = modified_rule_matches[:3]
        
        # Check if we need to provide more hints
        if len(original_hints) < 3 and len(modified_hints) > 3:
            # Take more from modified hints if needed
            modified_hints = modified_rule_matches[:6 - len(original_hints)]
        elif len(modified_hints) < 3 and len(original_hints) > 3:
            # Take more from original hints if needed
            original_hints = original_rule_matches[:6 - len(modified_hints)]
        
        # Don't check game over for initial requests or when used words list is empty
        used_words = data.get('used_words', [])
        if not used_words:
            game_over = False
        else:
            # Check if game is over (no more possible words)
            game_over = len(original_rule_matches) == 0 and len(modified_rule_matches) == 0
            
        return jsonify({
            'success': True,
            'original_rule_hints': original_hints,
            'modified_rule_hints': modified_hints,
            'game_over': game_over
        })
        
    except Exception as e:
        # Log the error (for debugging)
        print(f"Error in get_hint: {str(e)}")
        
        # Return a user-friendly error
        return jsonify({
            'success': False,
            'message': f'Server error: {str(e)}'
        })

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5002)