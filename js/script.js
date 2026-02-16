// Basic JavaScript example

// Get the current date and time
const currentDate = new Date();

// Format date and time in YYYY-MM-DD HH:MM:SS
const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');

console.log(`Current Date and Time (UTC): ${formattedDate}`);