// ==UserScript==
// @name         ChatGPT Message Counter
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Keep track of ChatGPT usage and counter reset timing.
// @author       YourName
// @match        https://*.openai.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // Constants
    const MAX_MESSAGES = 50;
    const RESET_TIME = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

    // Functions to manage local storage
    const getMessageCount = () => parseInt(localStorage.getItem('messageCount'), 10) || 0;
    const setMessageCount = (count) => localStorage.setItem('messageCount', count);
    const getStartTime = () => parseInt(localStorage.getItem('startTime'), 10) || Date.now();
    const setStartTime = (time) => localStorage.setItem('startTime', time);

    // Function to clear local storage and reset counter
    const clearLocalStorage = () => {
        localStorage.removeItem('messageCount');
        localStorage.removeItem('startTime');
        setMessageCount(0);
        setStartTime(Date.now());
        updateCounterDisplay();
    };

    // Initialize the counter display
    const initializeCounterDisplay = () => {
        const textarea = document.getElementById('prompt-textarea');
        if (!textarea) return;

        // Create counter container
        const counterContainer = document.createElement('div');
        counterContainer.id = 'gpt-message-counter-container';
        counterContainer.style.width = '100%';
        counterContainer.style.display = 'flex';
        counterContainer.style.alignItems = 'center';
        counterContainer.style.justifyContent = 'center'; // Center align the text
        counterContainer.style.marginBottom = '10px';
        counterContainer.style.padding = '3.2px 0';
        counterContainer.style.fontSize = '13px';
        counterContainer.style.borderRadius = '4px';
        counterContainer.style.position = 'relative'; // Positioning context for reset button
        counterContainer.style.backgroundColor = '#4A90E2';

        const counter = document.createElement('div');
        counter.id = 'gpt-message-counter';
        counter.style.color = 'white';
        counterContainer.appendChild(counter);

        // Create reset button and position it inside the container
        const resetButton = document.createElement('div');
        resetButton.textContent = '⟲';
        resetButton.style.cursor = 'pointer';
        resetButton.style.color = 'white';
        resetButton.style.position = 'absolute'; // Position the button absolutely
        resetButton.style.right = '10px'; // Position from the right
        resetButton.style.top = '50%'; // Center vertically
        resetButton.style.transform = 'translateY(-50%)'; // Offset the button by half its height
        resetButton.style.fontSize = '18px';
        resetButton.title = 'Reset Counter';
        resetButton.onclick = clearLocalStorage;
        counterContainer.appendChild(resetButton);

        // Insert the counter element before the textarea
        textarea.parentNode.insertBefore(counterContainer, textarea);

        // Update the counter every second
        setInterval(updateCounterDisplay, 1000);
    };

    // Update the counter display dynamically based on time
    const updateCounterDisplay = () => {
        const counter = document.getElementById('gpt-message-counter');
        if (!counter) return;

        const timePassed = Date.now() - getStartTime();
        let messagesLeft = MAX_MESSAGES - getMessageCount();
        const timeForOneMessage = RESET_TIME / MAX_MESSAGES;
        const nextMessageIn = timeForOneMessage - (timePassed % timeForOneMessage);

        // Cap at max messages
        messagesLeft = Math.min(messagesLeft + Math.floor(timePassed / timeForOneMessage), MAX_MESSAGES);

        // Check for reset
        if (timePassed >= RESET_TIME) {
            setMessageCount(0);
            setStartTime(Date.now());
            messagesLeft = MAX_MESSAGES;
        }

        // Convert next message availability to minutes and seconds
        const nextMessageMinutes = Math.floor(nextMessageIn / (60 * 1000));
        const nextMessageSeconds = Math.floor((nextMessageIn % (60 * 1000)) / 1000);

        counter.textContent = `Messages left: ${messagesLeft} | Next message in: ${nextMessageMinutes}m ${nextMessageSeconds}s`;
    };


    // Reset the counter
    const resetCounter = () => {
        setMessageCount(0);
        setStartTime(Date.now());
    };

    // Check for the GPT-4 model badge to count messages only for GPT-4
    const isGPT4Model = () => {
        const badge = document.querySelector('div > span');
        return badge && badge.textContent.includes('GPT-4');
    };

    // Observe changes and attach event listener to the regenerate button
    const observeRegenerateButton = () => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && node.querySelector('button.btn-neutral')) {
                        const regenerateButton = node.querySelector('button.btn-neutral');
                        if (regenerateButton && regenerateButton.textContent.includes('Stop generating')) {
                            setMessageCount(getMessageCount() + 1);
                        }
                    }
                });
            });
        });

        // Start observing the container for the regenerate button
        const container = document.querySelector('div.h-full.flex'); // This selector might need adjustment
        if (container) {
            observer.observe(container, { childList: true, subtree: true });
        }
    };

    // Function to parse the reset time from the message and start the countdown
    const parseResetTimeAndStartCountdown = (message) => {
        const timeRegex = /try again after (\d{1,2}:\d{2}) (AM|PM)/;
        const matches = message.match(timeRegex);
        if (matches) {
            const resetTimeString = matches[1];
            const meridiem = matches[2];
            const [hours, minutes] = resetTimeString.split(':').map(Number);
            const resetDate = new Date();
            resetDate.setHours(meridiem === 'PM' ? hours % 12 + 12 : hours % 12, minutes, 0, 0);

            // If the reset time is in the past, add one day
            if (resetDate < new Date()) {
                resetDate.setDate(resetDate.getDate() + 1);
            }

            // Calculate the milliseconds until the reset time
            const millisecondsUntilReset = resetDate.getTime() - new Date().getTime();

            // Start the countdown
            setTimeout(() => {
                setMessageCount(MAX_MESSAGES);
                setStartTime(Date.now());
            }, millisecondsUntilReset);

            // Update the counter display immediately
            updateCounterDisplay();
        }
    };

    // Function to observe ChatGPT responses for the limit reached message
    const observeChatResponsesForLimitMessage = () => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE && node.textContent.includes("you've reached the current usage cap")) {
                        parseResetTimeAndStartCountdown(node.textContent);
                    }
                });
            });
        });

        // Start observing the container for ChatGPT responses
        const responseContainer = document.querySelector('.chat-container'); // This selector might need adjustment
        if (responseContainer) {
            observer.observe(responseContainer, { childList: true, subtree: true });
        }
    };

    // Monitor for message sends and regenerations
    const monitorMessages = () => {
        observeRegenerateButton();
        observeChatResponsesForLimitMessage();
    };

    // Main function to start the script
    const main = () => {
        initializeCounterDisplay();
        monitorMessages();
    };

    // Run the script after a slight delay to ensure page loads
    setTimeout(main, 1500);
})();
