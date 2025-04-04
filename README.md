# Word Chain Game

A browser-based word game where players create new words using letters from the current word.

## Game Rules

1. The game starts with a random word (maximum 8 characters).
2. Players must create a new valid word using only letters from the current word.
3. Points are awarded based on the length of the new word.
4. The new word becomes the current word for the next round.

## Project Structure

```
src/
├── static/           # Static assets
│   ├── css/          # CSS stylesheets
│   ├── js/           # JavaScript files
│   └── images/       # Image assets
├── templates/        # HTML templates
└── server/           # Python backend
```

## Setup and Run

### Prerequisites

- Python 3.6+
- Flask

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   pip install flask
   ```

### Running the Game

1. Navigate to the project directory
2. Run the Flask application:
   ```
   python src/server/app.py
   ```
3. Open your browser and go to `http://localhost:5000`

## Technologies Used

- Frontend: HTML, CSS, JavaScript
- Backend: Python, Flask

## Future Enhancements

- User accounts and high scores
- Multiplayer mode
- Timer mode
- Different difficulty levels (word length restrictions)
- Word definitions