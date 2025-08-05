# You Draw, AI Guesses

This is a simple web-based game where you draw an object, and a server-side AI tries to guess what you've drawn from a given list of words.

## How to Play

1.  A category and a list of words will be displayed.
2.  Click on one of the words to select it as your drawing subject.
3.  Draw the object on the canvas.
4.  Click the "Guess What I Drew" button.
5.  The AI will analyze your drawing and make a guess.
6.  See if the AI guessed correctly!

## Features

*   **Frontend:** A clean and simple user interface built with HTML, CSS, and vanilla JavaScript.
*   **Drawing Canvas:** A simple canvas for drawing with mouse and touch support.
*   **AI-Powered Guessing:** Uses Cloudflare Workers and the Cloudflare AI platform to analyze the drawing and make a guess.
*   **Dynamic Word Categories:** The game randomly selects a category and a set of words for each new game.

## Tech Stack

*   **Frontend:** HTML, CSS, JavaScript
*   **Backend:** Cloudflare Workers
*   **AI:** Cloudflare AI (`@cf/deepseek-ai/deepseek-vl-1.3b-chat`)

## How to Run Locally

This project is set up to be deployed on Cloudflare Pages.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/lucyfer81/draw_guess.git
    cd draw_guess
    ```

2.  **Install Wrangler CLI:**
    If you don't have it, install the Cloudflare Wrangler CLI.
    ```bash
    npm install -g wrangler
    ```

3.  **Run the development server:**
    ```bash
    wrangler pages dev .
    ```
    This will start a local server, and you can open the provided URL in your browser to play the game.

## File Structure

*   `index.html`: The main HTML file for the game interface.
*   `style.css`: Contains all the styles for the application.
*   `script.js`: The frontend JavaScript that handles drawing, user interactions, and communication with the backend.
*   `wrangler.toml`: Configuration file for Cloudflare Pages and Workers.
*   `functions/api/[[path]].js`: The Cloudflare Worker that handles the game logic, including starting a new game and processing the AI guess.
