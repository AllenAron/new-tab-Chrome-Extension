// Predefined list of calendar names to fetch events from
const calendarNames = ['Privat', 'Studier', 'TimeEdit', 'Kårstyrelsen', 'S + FM: Möten och handlingar', 'Jobb', 'Tasks', 'Alice sommar']; // Replace with your desired calendar names

// Array of image filenames in the folder
const backgroundImages = ['images/R1-04405-000A.JPG', 'images/R1-04405-002A.JPG', 'images/S24 Kodak Gold-15.jpg', 'images/S24 Kodak Gold-19.jpg', 'images/S24 Kodak Gold-22.jpg', 'images/S24 Kodak Gold-37.jpg'];

let cachedToken = null;

// Authenticate with Google and get the OAuth token
async function authenticate() {
    if (cachedToken) return cachedToken;

    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError || !token) {
                reject(chrome.runtime.lastError);
                return;
            }
            cachedToken = token;
            resolve(token);
        });
    });
}

// Fetch events for the current week from matching calendars
async function fetchCalendarEvents(startOfWeek, endOfWeek) {
    console.log(startOfWeek, endOfWeek)
    try {
        const token = await authenticate();

        // Fetch list of calendars
        const calendarListResponse = await fetch(
            "https://www.googleapis.com/calendar/v3/users/me/calendarList",
            {
                headers: { Authorization: `Bearer ${token}` },
            }
        );
        const calendarListData = await calendarListResponse.json();

        // Filter calendars based on predefined names
        const matchingCalendars = calendarListData.items.filter(calendar =>
            calendarNames.includes(calendar.summaryOverride) || calendarNames.includes(calendar.summary)
        );

        // Array to collect events
        const eventsList = [[], [], [], [], [], [], []];

        // Fetch and log events for each matching calendar
        //for (const calendar of matchingCalendars) 
        const eventPromises = matchingCalendars.map(async (calendar) => {
            const eventsResponse = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?timeMin=${startOfWeek.toISOString()}&timeMax=${endOfWeek.toISOString()}&singleEvents=true&orderBy=startTime`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            const eventsData = await eventsResponse.json();

            eventsData.items.forEach(event => {
                const date = event.start.dateTime || event.start.date
                const dayofWeek = (new Date(date).getDay() + 6) % 7
                const startHour = String(new Date(event.start.dateTime).getHours()).padStart(2, '0') || event.start.date;
                const startMinute = String(new Date(event.start.dateTime).getMinutes()).padStart(2, '0') || event.start.date;
                const endHour = String(new Date(event.end.dateTime).getHours()).padStart(2, '0') || event.end.date;
                const endMinute = String(new Date(event.end.dateTime).getMinutes()).padStart(2, '0') || event.end.date;

                // Add each event to the events list
                eventsList[dayofWeek].push({
                    summary: event.summary,
                    start: `${startHour}:${startMinute}`,
                    end: `${endHour}:${endMinute}`,
                    location: event.location || "No location",
                    color: calendar.backgroundColor
                });
            });
        });
        await Promise.all(eventPromises)
        return eventsList;
    } catch (error) {
        console.error("Error fetching calendar events:", error);
    }
}

// Listen for messages to trigger event fetching
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "fetchCalendarEvents") {
        fetchCalendarEvents().then(() => sendResponse({ success: true }));
        return true;  // Keeps the message channel open for async response
    }
});



function updateClock() {
    const now = new Date();
    document.getElementById('clock').innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}



// Function to set a random background image
function setRandomBackground() {
    const randomIndex = Math.floor(Math.random() * backgroundImages.length);
    const selectedImage = backgroundImages[randomIndex];
    document.body.style.backgroundImage = `url('${selectedImage}')`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
    document.body.style.backgroundRepeat = "no-repeat";
}

function generateCalendar() {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const today = new Date();

    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() + (today.getDay() === 0 ? -6 : 1) - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    fetchCalendarEvents(startOfWeek, endOfWeek).then(eventsThisWeek => {
        console.log(eventsThisWeek)

        days.forEach((day, index) => {
            const dayDate = new Date(startOfWeek);
            dayDate.setDate(startOfWeek.getDate() + index);

            const dayContainer = document.getElementById(day);
            dayContainer.innerHTML = '';

            const headerDiv = document.createElement('div');
            headerDiv.className = 'day-header';
            headerDiv.innerHTML = `<strong>${day}</strong><br>${dayDate.getDate()}/${dayDate.getMonth() + 1}`; // Display date in DD/MM format
            dayContainer.appendChild(headerDiv);

            const eventBoxDiv = document.createElement('div');
            eventBoxDiv.className = 'day-event-box'

            const sortedEvents = eventsThisWeek[index].sort((a, b) => {
                const startA = new Date(`${dayDate.toDateString()} ${a.start}`);
                const startB = new Date(`${dayDate.toDateString()} ${b.start}`);
                return startA - startB; // Sort in ascending order
            });

            let eventsHTML = '<div class = day-event-box>'
            sortedEvents.forEach(e => {
                const location = e["location"] === "No location" ? '' : e["location"];
                if (e["start"] == "NaN:NaN") {
                    eventsHTML += `<div class='day-event' style='background-color:${e["color"]};'>
                                   <strong>${e["summary"]}</strong><br>All day<br><i>${location}</i>
                               </div>`;
                }
                else {
                    eventsHTML += `<div class='day-event' style='background-color:${e["color"]};'>
                                   <strong>${e["summary"]}</strong><br>${e["start"]} - ${e["end"]}<br><i>${location}</i>
                               </div>`;
                }
            });
            eventsHTML += '</div>';
            dayContainer.innerHTML += eventsHTML;
        });
    });
}

updateClock();
setInterval(updateClock, 1000);
generateCalendar();
setRandomBackground();